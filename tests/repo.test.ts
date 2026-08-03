import { describe, it, expect, beforeEach } from "vitest";
import { abrirDb } from "../lib/db";
import { crearRepo, type Repo } from "../lib/repo";
import type { Convocatoria } from "../lib/tipos";

const fila = (extra: Partial<Convocatoria> = {}): Convocatoria => ({
  codigoBdns: "923287",
  titulo: "Premios EcoRiba 2026",
  tituloCoof: null,
  nivel1: "LOCAL",
  nivel2: "RIBA-ROJA DE TÚRIA",
  nivel3: "AYUNTAMIENTO DE RIBA-ROJA DE TÚRIA",
  fechaRegistro: "2026-08-03",
  mrr: false,
  beneficiarios: [],
  instrumentos: [],
  sectores: [],
  regiones: [],
  fondos: [],
  ...extra,
});

describe("repo", () => {
  let repo: Repo;

  beforeEach(() => {
    repo = crearRepo(abrirDb(":memory:"));
  });

  it("la migración es idempotente", () => {
    expect(() => abrirDb(":memory:")).not.toThrow();
    const db = abrirDb(":memory:");
    expect(() => crearRepo(db)).not.toThrow();
  });

  it("upsertLista inserta y no duplica", () => {
    repo.upsertLista([fila()]);
    repo.upsertLista([fila({ titulo: "Premios EcoRiba 2026 (bis)" })]);
    const todas = repo.buscar({});
    expect(todas).toHaveLength(1);
    expect(todas[0].titulo).toContain("bis");
  });

  it("upsertDetalle rellena fechas y sale de pendientes", () => {
    repo.upsertLista([fila()]);
    expect(repo.pendientesDetalle(10).map((c) => c.codigoBdns)).toContain("923287");
    repo.upsertDetalle(
      fila({
        fechaInicioSol: "2026-09-01",
        fechaFinSol: "2026-09-30",
        beneficiarios: ["PYME Y PERSONAS FÍSICAS QUE DESARROLLAN ACTIVIDAD ECONÓMICA"],
        detalleJson: "{}",
      }),
    );
    expect(repo.pendientesDetalle(10)).toHaveLength(0);
    const c = repo.getConvocatoria("923287");
    expect(c?.fechaFinSol).toBe("2026-09-30");
    expect(c?.beneficiarios[0]).toContain("PYME");
  });

  it("hechos: set sobrescribe y get devuelve", () => {
    repo.setHecho(1, "tipo_actividad", "autonomo", "manual");
    repo.setHecho(1, "tipo_actividad", "pyme", "entrevista 923287");
    const hechos = repo.getHechos(1);
    expect(hechos.get("tipo_actividad")).toBe("pyme");
  });

  it("buscar por texto encuentra sin distinguir mayúsculas", () => {
    repo.upsertLista([fila(), fila({ codigoBdns: "111", titulo: "Ayudas LABORA contratación" })]);
    expect(repo.buscar({ texto: "labora" })).toHaveLength(1);
    expect(repo.buscar({ texto: "ecoriba" })[0].codigoBdns).toBe("923287");
  });

  it("la búsqueda ignora los acentos", () => {
    repo.upsertLista([fila({ codigoBdns: "222", titulo: "Ayudas de eficiencia energética" })]);
    expect(repo.buscar({ texto: "energetica" })[0].codigoBdns).toBe("222");
    expect(repo.buscar({ texto: "ENERGÉTICA" })[0].codigoBdns).toBe("222");
  });

  it("exige TODAS las palabras, no cualquiera", () => {
    repo.upsertLista([
      fila({ codigoBdns: "301", titulo: "Ayudas para eficiencia energética en empresas" }),
      fila({ codigoBdns: "302", titulo: "Ayudas para vivienda" }),
    ]);
    expect(repo.buscar({ texto: "eficiencia energetica" })).toHaveLength(1);
    expect(repo.buscar({ texto: "eficiencia vivienda" })).toHaveLength(0);
  });

  it("busca también en el órgano y en la finalidad", () => {
    repo.upsertDetalle(
      fila({ codigoBdns: "401", titulo: "Convocatoria X", finalidad: "Fomento del Empleo" }),
    );
    expect(repo.buscar({ texto: "empleo" })[0].codigoBdns).toBe("401");
    expect(repo.buscar({ texto: "riba-roja" }).length).toBeGreaterThan(0);
  });

  it("evaluaciones y expedientes: ida y vuelta", () => {
    repo.upsertLista([fila()]);
    repo.guardarEvaluacion("923287", 1, { dictamen: "duda", requisitosJson: "[]" });
    expect(repo.getEvaluacion("923287", 1)?.dictamen).toBe("duda");
    repo.crearExpediente("923287", 1, "/tmp/x", "[]");
    repo.actualizarExpediente("923287", { estado: "preparacion" });
    expect(repo.listarExpedientes()[0].estado).toBe("preparacion");
  });

  it("filtra por región de sync dejando pasar lo ESTATAL", () => {
    repo.upsertLista([fila({ codigoBdns: "A", nivel1: "AUTONOMICA" })], 54);
    repo.upsertLista([fila({ codigoBdns: "B", nivel1: "AUTONOMICA" })], 49);
    repo.upsertLista([fila({ codigoBdns: "C", nivel1: "ESTADO" })], 49);
    const cv = repo.buscar({ regionSync: 54 }).map((c) => c.codigoBdns);
    expect(cv).toContain("A");
    expect(cv).toContain("C"); // lo estatal aplica en todas partes
    expect(cv).not.toContain("B");
  });

  it("ajustes y sync_runs", () => {
    repo.setAjuste("cp", "46183");
    expect(repo.getAjuste("cp")).toBe("46183");
    expect(repo.getAjuste("no_existe")).toBeNull();
    repo.registrarSync(54, "2025-08-03", "2026-08-03", 198);
    expect(repo.ultimoSync(54)?.nuevas).toBe(198);
    expect(repo.ultimoSync(99)).toBeNull();
  });
});
