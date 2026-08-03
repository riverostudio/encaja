import { describe, it, expect } from "vitest";
import { resumirEstructural, importeCorto, aQuienVa } from "../lib/resumen";
import type { Convocatoria } from "../lib/tipos";

const conv = (extra: Partial<Convocatoria> = {}): Convocatoria => ({
  codigoBdns: "1",
  titulo: "RESOLUCIÓN de 10 de julio de 2026, de la Dirección General de LABORA…",
  nivel1: "AUTONOMICA",
  nivel2: "COMUNITAT VALENCIANA",
  fechaRegistro: "2026-08-01",
  mrr: false,
  finalidad: "Fomento del Empleo",
  presupuesto: 23_559_000,
  beneficiarios: ["PYME Y PERSONAS FÍSICAS QUE DESARROLLAN ACTIVIDAD ECONÓMICA"],
  instrumentos: ["SUBVENCIÓN Y ENTREGA DINERARIA SIN CONTRAPRESTACIÓN "],
  sectores: [],
  regiones: [],
  fondos: [],
  ...extra,
});

describe("importeCorto", () => {
  it("abrevia millones y miles en castellano", () => {
    expect(importeCorto(23_559_000)).toBe("23,6 M€");
    expect(importeCorto(2_000_000)).toBe("2 M€");
    expect(importeCorto(318_000)).toBe("318.000 €");
    expect(importeCorto(7_000)).toBe("7.000 €");
  });

  it("sin importe devuelve null", () => {
    expect(importeCorto(0)).toBeNull();
    expect(importeCorto(null)).toBeNull();
    expect(importeCorto(undefined)).toBeNull();
  });
});

describe("aQuienVa", () => {
  it("traduce la jerga de beneficiarios", () => {
    expect(aQuienVa(["PYME Y PERSONAS FÍSICAS QUE DESARROLLAN ACTIVIDAD ECONÓMICA"])).toBe(
      "pymes y autónomos",
    );
    expect(aQuienVa(["PERSONAS FÍSICAS QUE NO DESARROLLAN ACTIVIDAD ECONÓMICA"])).toBe(
      "particulares",
    );
    expect(aQuienVa(["GRAN EMPRESA"])).toBe("grandes empresas");
    expect(aQuienVa(["PERSONAS JURÍDICAS QUE NO DESARROLLAN ACTIVIDAD ECONÓMICA"])).toBe(
      "asociaciones y entidades sin ánimo de lucro",
    );
  });

  it("junta varios con «y» y no repite", () => {
    expect(
      aQuienVa([
        "GRAN EMPRESA",
        "PYME Y PERSONAS FÍSICAS QUE DESARROLLAN ACTIVIDAD ECONÓMICA",
      ]),
    ).toBe("grandes empresas y pymes y autónomos");
  });

  it("sin datos devuelve null", () => {
    expect(aQuienVa([])).toBeNull();
  });
});

describe("resumirEstructural", () => {
  it("dice para qué es, sin repetir la jerga oficial", () => {
    const r = resumirEstructural(conv());
    // "Fomento del Empleo" es categoría de la BDNS: se cuenta en cristiano
    expect(r.que.toLowerCase()).toContain("empleo");
    expect(r.que.toLowerCase()).not.toContain("fomento del empleo");
  });

  it("dice quién puede pedirla, separado de para qué es", () => {
    const r = resumirEstructural(conv());
    expect(r.quien).toContain("pymes y autónomos");
    expect(r.quien.toLowerCase()).toContain("pueden pedirla");
  });

  it("el dinero se cuenta aparte, sin prometer lo que te toca", () => {
    const r = resumirEstructural(conv());
    expect(r.consigues).toContain("fondo perdido");
    expect(r.consigues).toContain("23,6 M€");
  });

  it("una finalidad que no conocemos se enseña tal cual, no se inventa", () => {
    const r = resumirEstructural(conv({ finalidad: "Materia rarísima nueva" }));
    expect(r.que.toLowerCase()).toContain("materia rarísima nueva");
  });

  it("sin beneficiarios publicados lo dice, no se lo inventa", () => {
    const r = resumirEstructural(conv({ beneficiarios: [] }));
    expect(r.quien.toLowerCase()).toContain("las bases");
  });

  it("un préstamo no se llama dinero regalado", () => {
    const r = resumirEstructural(conv({ instrumentos: ["PRÉSTAMO"] }));
    expect(r.consigues).toContain("préstamo");
    expect(r.consigues).not.toContain("fondo perdido");
  });

  it("aval y ventaja fiscal tienen su frase", () => {
    expect(resumirEstructural(conv({ instrumentos: ["GARANTÍA"] })).consigues).toContain("aval");
    expect(resumirEstructural(conv({ instrumentos: ["VENTAJA FISCAL"] })).consigues).toContain(
      "impuestos",
    );
  });

  it("sin presupuesto no inventa cifras", () => {
    const r = resumirEstructural(conv({ presupuesto: null }));
    expect(r.consigues).not.toContain("€");
  });

  it("sin finalidad ni beneficiarios sigue diciendo algo útil", () => {
    const r = resumirEstructural(conv({ finalidad: null, beneficiarios: [] }));
    expect(r.que.length).toBeGreaterThan(10);
    expect(r.quien.length).toBeGreaterThan(10);
    expect(r.consigues.length).toBeGreaterThan(10);
  });

  it("avisa de que el presupuesto es la bolsa total, no lo tuyo", () => {
    expect(resumirEstructural(conv()).consigues.toLowerCase()).toContain("reparte");
  });
});
