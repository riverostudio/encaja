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
