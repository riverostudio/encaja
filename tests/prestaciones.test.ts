import { describe, it, expect } from "vitest";
import { PRESTACIONES, buscarPrestaciones, prestacionesParaPerfil } from "../lib/prestaciones";

const h = (o: Record<string, string>) => new Map(Object.entries(o));

describe("catálogo de prestaciones", () => {
  it("todas llevan enlace oficial a una administración pública", () => {
    for (const p of PRESTACIONES) {
      expect(p.url).toMatch(/^https:\/\//);
      expect(p.urlSolicitud).toMatch(/^https:\/\//);
      expect(p.url).toMatch(/\.gob\.es|seg-social\.es|sepe\.es|imserso\.es|madrid\.es|comunidad\.madrid/);
      expect(p.urlSolicitud).toMatch(/\.gob\.es|seg-social\.es|sepe\.es|imserso\.es|madrid\.es|comunidad\.madrid/);
      expect(p.accion.length).toBeGreaterThan(8);
      expect(p.plazo.length).toBeGreaterThan(8);
      expect(p.requisitos.length).toBeGreaterThanOrEqual(3);
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
    expect(ids).toContain("deduccion-familia-numerosa");
    expect(ids).toContain("deduccion-ascendiente-dos-hijos");
    expect(ids).toContain("emergencia-alquiler-madrid");
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

  it("no confunde «renta» con la palabra monoparental", () => {
    expect(buscarPrestaciones("renta").map((p) => p.id)).not.toContain(
      "deduccion-ascendiente-dos-hijos",
    );
  });

  it("entiende una frase de necesidad y devuelve la vía local correcta", () => {
    const ids = buscarPrestaciones(
      "no puedo pagar el alquiler",
      h({ perfil: "particular", situacion: "desempleado", ingresos: "menos_12000", cp: "28013" }),
    ).map((p) => p.id);
    expect(ids).toContain("emergencia-alquiler-madrid");
    expect(ids).toContain("vivienda-especial-necesidad-madrid");
  });

  it("no enseña recursos territoriales de Madrid fuera de Madrid", () => {
    const ids = buscarPrestaciones(
      "alquiler",
      h({ perfil: "particular", situacion: "desempleado", ingresos: "menos_12000", cp: "08001" }),
    ).map((p) => p.id);
    expect(ids).not.toContain("emergencia-alquiler-madrid");
    expect(ids).not.toContain("vivienda-especial-necesidad-madrid");
  });

  it("respeta el perfil al buscar desempleo", () => {
    const ids = buscarPrestaciones(
      "desempleo",
      h({ perfil: "particular", situacion: "desempleado", ingresos: "menos_12000" }),
    ).map((p) => p.id);
    expect(ids).toContain("paro");
    expect(ids).not.toContain("cese-actividad");
  });

  it("pone la coincidencia familiar exacta antes que las genéricas", () => {
    const monoparental = buscarPrestaciones(
      "familia monoparental",
      h({
        perfil: "particular",
        situacion: "desempleado",
        ingresos: "menos_12000",
        menores_cargo: "2",
        circunstancias: "monoparental",
      }),
    ).map((p) => p.id);
    expect(monoparental[0]).toBe("deduccion-ascendiente-dos-hijos");

    const numerosa = buscarPrestaciones(
      "familia numerosa",
      h({
        perfil: "particular",
        situacion: "desempleado",
        ingresos: "menos_12000",
        menores_cargo: "3+",
        circunstancias: "familia_numerosa",
      }),
    ).map((p) => p.id);
    expect(numerosa[0]).toBe("deduccion-familia-numerosa");
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
    const ids = prestacionesParaPerfil(h({ perfil: "autonomo", situacion: "autonomo_activo" })).map((p) => p.id);
    expect(ids).toContain("cese-actividad");
  });

  it("no confunde a un particular desempleado con un autónomo que cesa", () => {
    const ids = prestacionesParaPerfil(
      h({ perfil: "particular", situacion: "desempleado", ingresos: "menos_12000" }),
    ).map((p) => p.id);
    expect(ids).not.toContain("cese-actividad");
  });

  it("ofrece la deducción precisa a una familia monoparental con dos hijos", () => {
    const ids = prestacionesParaPerfil(
      h({
        perfil: "particular",
        situacion: "desempleado",
        ingresos: "menos_12000",
        menores_cargo: "2",
        circunstancias: "monoparental",
      }),
    ).map((p) => p.id);
    expect(ids).toContain("deduccion-ascendiente-dos-hijos");
    expect(ids).not.toContain("deduccion-familia-numerosa");
    expect(ids[0]).toBe("deduccion-ascendiente-dos-hijos");
  });

  it("no generaliza la deducción de dos hijos a cualquier familia monoparental", () => {
    const ids = prestacionesParaPerfil(
      h({
        perfil: "particular",
        situacion: "desempleado",
        ingresos: "menos_12000",
        menores_cargo: "1",
        circunstancias: "monoparental",
      }),
    ).map((p) => p.id);
    expect(ids).not.toContain("deduccion-ascendiente-dos-hijos");
  });

  it("una familia numerosa ve su deducción y el bono social aunque supere el tramo bajo", () => {
    const ids = prestacionesParaPerfil(
      h({
        perfil: "particular",
        situacion: "cuenta_ajena",
        ingresos: "mas_40000",
        menores_cargo: "3+",
        circunstancias: "familia_numerosa",
      }),
    ).map((p) => p.id);
    expect(ids).toContain("deduccion-familia-numerosa");
    expect(ids).toContain("bono-social");
  });

  it("prioriza las dos vías de vivienda de Madrid para un hogar en apuros", () => {
    const ids = prestacionesParaPerfil(
      h({
        perfil: "particular",
        objetivo: "apuro,vivienda",
        situacion: "desempleado",
        ingresos: "menos_12000",
        cp: "28013",
      }),
    ).map((p) => p.id);
    expect(ids).toContain("emergencia-alquiler-madrid");
    expect(ids).toContain("vivienda-especial-necesidad-madrid");
    expect(ids.slice(0, 2)).toEqual([
      "emergencia-alquiler-madrid",
      "vivienda-especial-necesidad-madrid",
    ]);
  });
});
