import { describe, it, expect } from "vitest";
import { dictaminar } from "../lib/dictamen";
import type { Requisito, Veredicto } from "../lib/tipos";

const estructuralPasa = { resultado: "pasa" as const, motivos: [] };
const reqs: Requisito[] = [
  { id: "r1", literal: "Estar al corriente con Hacienda", tipo: "condicion", clave: "al_corriente_hacienda", pregunta: "¿?" },
  { id: "r2", literal: "Memoria descriptiva", tipo: "documento" },
];

describe("dictaminar", () => {
  it("estructural no → no_encaja", () => {
    const r = dictaminar(
      { resultado: "no", motivos: [{ regla: "plazo", detalle: "Cerró" }] },
      reqs,
      [],
    );
    expect(r.dictamen).toBe("no_encaja");
    expect(r.motivos[0].origen).toBe("estructural");
  });

  it("algún no_cumple → no_encaja con el literal de las bases", () => {
    const v: Veredicto[] = [{ id: "r1", veredicto: "no_cumple", motivo: "Debe deudas" }];
    const r = dictaminar(estructuralPasa, reqs, v);
    expect(r.dictamen).toBe("no_encaja");
    expect(r.motivos[0].literal).toContain("Hacienda");
  });

  it("todos cumplen y estructural pasa → encaja", () => {
    const v: Veredicto[] = [{ id: "r1", veredicto: "cumple", motivo: "Al corriente" }];
    expect(dictaminar(estructuralPasa, reqs, v).dictamen).toBe("encaja");
  });

  it("alguna duda → duda", () => {
    const v: Veredicto[] = [{ id: "r1", veredicto: "duda", motivo: "Sin dato" }];
    expect(dictaminar(estructuralPasa, reqs, v).dictamen).toBe("duda");
  });

  it("estructural duda también arrastra a duda aunque las bases cumplan", () => {
    const v: Veredicto[] = [{ id: "r1", veredicto: "cumple", motivo: "OK" }];
    const r = dictaminar(
      { resultado: "duda", motivos: [{ regla: "sector", detalle: "CNAE no casa" }] },
      reqs,
      v,
    );
    expect(r.dictamen).toBe("duda");
  });

  it("sin veredictos aún (entrevista a medias) → pendiente", () => {
    expect(dictaminar(estructuralPasa, reqs, []).dictamen).toBe("pendiente");
  });

  it("sin requisitos evaluables (solo documentos) y estructural pasa → encaja", () => {
    const soloDocs: Requisito[] = [{ id: "r2", literal: "Memoria", tipo: "documento" }];
    expect(dictaminar(estructuralPasa, soloDocs, []).dictamen).toBe("encaja");
  });
});

describe("compromisos posteriores a la concesión", () => {
  const reqCompromiso: Requisito[] = [
    { id: "r1", literal: "Estar matriculado", tipo: "condicion", clave: "k1", pregunta: "¿?" },
    { id: "r2", literal: "Compromiso de mantener los requisitos", tipo: "condicion", clave: "k2", pregunta: "¿?" },
  ];

  it("una duda sobre algo que pasa DESPUÉS no tumba el dictamen", () => {
    const v: Veredicto[] = [
      { id: "r1", veredicto: "cumple", motivo: "Está matriculado" },
      {
        id: "r2",
        veredicto: "duda",
        motivo: "Este requisito se refiere a un compromiso posterior a la concesión de la ayuda",
      },
    ];
    expect(dictaminar(estructuralPasa, reqCompromiso, v).dictamen).toBe("encaja");
  });

  it("pero una duda real sobre un requisito de entrada sí", () => {
    const v: Veredicto[] = [
      { id: "r1", veredicto: "duda", motivo: "No consta si está matriculado" },
      { id: "r2", veredicto: "cumple", motivo: "Aceptado" },
    ];
    expect(dictaminar(estructuralPasa, reqCompromiso, v).dictamen).toBe("duda");
  });
});
