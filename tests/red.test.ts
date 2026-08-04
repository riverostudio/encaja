import { describe, it, expect, beforeEach } from "vitest";
import { abrirDb } from "../lib/db";
import { crearRepo, type Repo } from "../lib/repo";
import { buscarRadarConRed } from "../lib/servidor";
import type { Convocatoria } from "../lib/tipos";

const hoy = new Date().toISOString().slice(0, 10);
const dentroDe = (dias: number) =>
  new Date(Date.now() + dias * 86_400_000).toISOString().slice(0, 10);

const conv = (extra: Partial<Convocatoria>): Convocatoria => ({
  codigoBdns: "1",
  titulo: "Ayudas contra la exclusión social",
  nivel1: "AUTONOMICA",
  nivel2: "COMUNITAT VALENCIANA",
  fechaRegistro: hoy,
  mrr: false,
  fechaInicioSol: hoy,
  fechaFinSol: dentroDe(30),
  beneficiarios: ["PERSONAS JURÍDICAS QUE NO DESARROLLAN ACTIVIDAD ECONÓMICA"],
  instrumentos: [],
  sectores: [],
  regiones: [],
  fondos: [],
  ...extra,
});

describe("buscarRadarConRed", () => {
  let repo: Repo;

  beforeEach(() => {
    repo = crearRepo(abrirDb(":memory:"));
  });

  it("con resultados no relaja nada", () => {
    repo.upsertDetalle(conv({}));
    const r = buscarRadarConRed(repo, {});
    expect(r.filas).toHaveLength(1);
    expect(r.relajado).toBeNull();
    expect(r.estrictas).toBe(1);
  });

  it("si el perfil lo descarta todo, lo suelta y lo dice", () => {
    // Ayuda para asociaciones; el usuario es particular → estructural dice no.
    repo.upsertDetalle(conv({}));
    repo.setHecho(1, "tipo_actividad", "particular", "test");
    const r = buscarRadarConRed(repo, { soloAplicables: true });
    expect(r.filas.length).toBeGreaterThan(0);
    expect(r.relajado).toBe("perfil");
  });

  it("si el filtro de beneficiario lo vacía, también lo suelta", () => {
    repo.upsertDetalle(conv({}));
    const r = buscarRadarConRed(repo, {
      beneficiario: "PERSONAS FÍSICAS QUE NO DESARROLLAN",
      soloAplicables: false,
    });
    expect(r.filas.length).toBeGreaterThan(0);
    expect(r.relajado).toBe("beneficiario");
  });

  it("si todo ha cerrado, las enseña marcadas en vez de dejar la pantalla vacía", () => {
    repo.upsertDetalle(
      conv({ codigoBdns: "2", fechaInicioSol: "2020-01-01", fechaFinSol: "2020-02-01" }),
    );
    const r = buscarRadarConRed(repo, {});
    expect(r.filas).toHaveLength(1);
    expect(r.filas[0].plazo.estado).toBe("cerrada");
    expect(r.relajado).toBe("plazo");
  });

  it("cuando de verdad no hay nada, no inventa", () => {
    repo.upsertDetalle(conv({}));
    const r = buscarRadarConRed(repo, { texto: "criptomonedas lunares" });
    expect(r.filas).toHaveLength(0);
    expect(r.relajado).toBeNull();
  });

  it("prefiere lo vigente: solo llega a las cerradas si no queda otra", () => {
    repo.upsertDetalle(conv({ codigoBdns: "3" })); // abierta
    repo.upsertDetalle(
      conv({ codigoBdns: "4", fechaInicioSol: "2020-01-01", fechaFinSol: "2020-02-01" }),
    );
    const r = buscarRadarConRed(repo, {});
    expect(r.relajado).toBeNull();
    expect(r.filas.every((f) => f.plazo.estado !== "cerrada")).toBe(true);
  });
});
