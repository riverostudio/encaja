import { describe, it, expect } from "vitest";
import { PRESTACIONES, buscarPrestaciones, prestacionesParaPerfil } from "../lib/prestaciones";

const h = (o: Record<string, string>) => new Map(Object.entries(o));

describe("catálogo de prestaciones", () => {
  it("todas llevan enlace oficial a un dominio del Estado", () => {
    for (const p of PRESTACIONES) {
      expect(p.url).toMatch(/^https:\/\//);
      expect(p.url).toMatch(/\.gob\.es|seg-social\.es|sepe\.es|imserso\.es/);
    }
  });

  it("ninguna promete cuantías: cambian cada año", () => {
    for (const p of PRESTACIONES) {
      expect(`${p.que} ${p.quien}`).not.toMatch(/\d+\s?€/);
    }
  });

  it("está lo que más falta hace", () => {
    const ids = PRESTACIONES.map((p) => p.id);
    expect(ids).toContain("paro");
    expect(ids).toContain("imv");
    expect(ids).toContain("subsidio");
  });
});

describe("buscarPrestaciones", () => {
  it("«paro» encuentra la prestación y el subsidio", () => {
    const ids = buscarPrestaciones("paro").map((p) => p.id);
    expect(ids).toContain("paro");
    expect(ids).toContain("subsidio");
  });

  it("ignora acentos y mayúsculas", () => {
    expect(buscarPrestaciones("PENSION").map((p) => p.id)).toContain("no-contributiva");
  });

  it("no dispara con dos letras", () => {
    expect(buscarPrestaciones("pa")).toHaveLength(0);
  });
});

describe("prestacionesParaPerfil", () => {
  it("a un parado sin recursos le salen el paro, el subsidio y el IMV", () => {
    const ids = prestacionesParaPerfil(
      h({ situacion: "desempleado", ingresos: "menos_12000" }),
    ).map((p) => p.id);
    expect(ids).toContain("paro");
    expect(ids).toContain("subsidio");
    expect(ids).toContain("imv");
  });

  it("el complemento por hijos solo si hay hijos", () => {
    const sin = prestacionesParaPerfil(h({ situacion: "desempleado", ingresos: "menos_12000" }));
    expect(sin.map((p) => p.id)).not.toContain("cuc");
    const con = prestacionesParaPerfil(
      h({ situacion: "desempleado", ingresos: "menos_12000", menores_cargo: "2" }),
    );
    expect(con.map((p) => p.id)).toContain("cuc");
  });

  it("a quien gana bien no se le ofrecen las de renta baja", () => {
    const ids = prestacionesParaPerfil(
      h({ situacion: "cuenta_ajena", ingresos: "mas_40000" }),
    ).map((p) => p.id);
    expect(ids).not.toContain("imv");
    expect(ids).not.toContain("bono-social");
  });

  it("al autónomo le sale su cese de actividad", () => {
    const ids = prestacionesParaPerfil(h({ situacion: "autonomo_activo" })).map((p) => p.id);
    expect(ids).toContain("cese-actividad");
  });
});
