import { describe, it, expect } from "vitest";
import { evaluarEstructural } from "../lib/encaje";
import type { Convocatoria } from "../lib/tipos";

const HOY = new Date("2026-08-03T12:00:00");

const conv = (extra: Partial<Convocatoria> = {}): Convocatoria => ({
  codigoBdns: "1",
  titulo: "Ayuda test",
  nivel1: "AUTONOMICA",
  nivel2: "COMUNITAT VALENCIANA",
  nivel3: "GVA",
  fechaRegistro: "2026-08-01",
  mrr: false,
  fechaInicioSol: "2026-08-01",
  fechaFinSol: "2026-10-15",
  beneficiarios: ["PYME Y PERSONAS FÍSICAS QUE DESARROLLAN ACTIVIDAD ECONÓMICA"],
  instrumentos: [],
  sectores: [],
  regiones: [],
  fondos: [],
  ...extra,
});

const hechos = (m: Record<string, string>) => new Map(Object.entries(m));

describe("evaluarEstructural", () => {
  it("plazo cerrado descarta", () => {
    const r = evaluarEstructural(conv({ fechaFinSol: "2026-07-31" }), hechos({}), HOY);
    expect(r.resultado).toBe("no");
    expect(r.motivos.some((m) => m.regla === "plazo")).toBe(true);
  });

  it("autónomo con beneficiario PYME pasa", () => {
    const r = evaluarEstructural(conv(), hechos({ tipo_actividad: "autonomo" }), HOY);
    expect(r.resultado).toBe("pasa");
  });

  it("particular contra beneficiario PYME descarta", () => {
    const r = evaluarEstructural(conv(), hechos({ tipo_actividad: "particular" }), HOY);
    expect(r.resultado).toBe("no");
    expect(r.motivos.some((m) => m.regla === "beneficiario")).toBe(true);
  });

  it("particular con beneficiario de personas físicas pasa", () => {
    const c = conv({ beneficiarios: ["PERSONAS FÍSICAS QUE NO DESARROLLAN ACTIVIDAD ECONÓMICA"] });
    expect(evaluarEstructural(c, hechos({ tipo_actividad: "particular" }), HOY).resultado).toBe("pasa");
  });

  it("LOCAL de otro municipio con mi CP descarta; el mío pasa", () => {
    const paiporta = conv({ nivel1: "LOCAL", nivel2: "PAIPORTA", nivel3: "AYUNTAMIENTO DE PAIPORTA" });
    const r1 = evaluarEstructural(paiporta, hechos({ tipo_actividad: "autonomo", cp: "46183" }), HOY);
    expect(r1.resultado).toBe("no");
    expect(r1.motivos.some((m) => m.regla === "territorio")).toBe(true);

    const eliana = conv({ nivel1: "LOCAL", nivel2: "ELIANA (L')", nivel3: "AYUNTAMIENTO DE L'ELIANA" });
    expect(evaluarEstructural(eliana, hechos({ tipo_actividad: "autonomo", cp: "46183" }), HOY).resultado).toBe("pasa");
  });

  it("sin datos de beneficiarios ni sectores: duda, nunca descarta", () => {
    const c = conv({ beneficiarios: [] });
    const r = evaluarEstructural(c, hechos({ tipo_actividad: "autonomo" }), HOY);
    expect(r.resultado).toBe("duda");
  });

  it("sector no coincidente: duda", () => {
    const c = conv({ sectores: ["A"] }); // agricultura
    const r = evaluarEstructural(c, hechos({ tipo_actividad: "autonomo", cnae_letras: "R,S" }), HOY);
    expect(r.resultado).toBe("duda");
    expect(r.motivos.some((m) => m.regla === "sector")).toBe(true);
  });

  it("sector coincidente pasa", () => {
    const c = conv({ sectores: ["S", "Q"] });
    expect(
      evaluarEstructural(c, hechos({ tipo_actividad: "autonomo", cnae_letras: "R,S" }), HOY).resultado,
    ).toBe("pasa");
  });

  it("sin tipo_actividad en la ficha: duda (falta el dato)", () => {
    const r = evaluarEstructural(conv(), hechos({}), HOY);
    expect(r.resultado).toBe("duda");
  });
});
