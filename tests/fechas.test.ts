import { describe, it, expect } from "vitest";
import { parsearFechas } from "../lib/fechas";

const ok = (o: object) => JSON.stringify(o);

describe("parsearFechas", () => {
  it("acepta un plazo completo con su cita", () => {
    const r = parsearFechas(
      ok({
        inicio: "2026-09-01",
        fin: "2026-09-30",
        literal: "El plazo de presentación será del 1 al 30 de septiembre de 2026",
      }),
    );
    expect(r).toEqual({
      inicio: "2026-09-01",
      fin: "2026-09-30",
      relativo: null,
      literal: "El plazo de presentación será del 1 al 30 de septiembre de 2026",
    });
  });

  it("acepta solo fecha de fin", () => {
    const r = parsearFechas(
      ok({ inicio: null, fin: "2026-10-29", literal: "hasta el 29 de octubre de 2026" }),
    );
    expect(r?.inicio).toBeNull();
    expect(r?.fin).toBe("2026-10-29");
  });

  it("rechaza cuando la IA no encuentra nada", () => {
    expect(parsearFechas(ok({ inicio: null, fin: null, relativo: null, literal: "no consta" }))).toBeNull();
  });

  it("rechaza fechas mal formadas o imposibles", () => {
    expect(parsearFechas(ok({ inicio: "1 de septiembre", fin: null, literal: "xxxxxxxxxxx" }))).toBeNull();
    expect(parsearFechas(ok({ inicio: null, fin: "2026-13-45", literal: "xxxxxxxxxxx" }))).toBeNull();
    expect(parsearFechas(ok({ inicio: null, fin: "1899-01-01", literal: "xxxxxxxxxxx" }))).toBeNull();
  });

  it("rechaza un plazo que termina antes de empezar", () => {
    expect(
      parsearFechas(ok({ inicio: "2026-10-01", fin: "2026-09-01", literal: "xxxxxxxxxxx" })),
    ).toBeNull();
  });

  it("sin cita literal no se fía: podría estar inventándoselo", () => {
    expect(parsearFechas(ok({ inicio: "2026-09-01", fin: "2026-09-30", literal: "" }))).toBeNull();
    expect(parsearFechas(ok({ inicio: "2026-09-01", fin: "2026-09-30" }))).toBeNull();
  });

  it("tolera texto alrededor del JSON", () => {
    const r = parsearFechas(
      '```json\n{"inicio":null,"fin":"2026-12-31","literal":"hasta el 31 de diciembre"}\n```',
    );
    expect(r?.fin).toBe("2026-12-31");
  });

  it("con basura devuelve null en vez de reventar", () => {
    expect(parsearFechas("no soy json")).toBeNull();
    expect(parsearFechas("")).toBeNull();
  });
});

describe("plazo relativo", () => {
  it("rescata la regla cuando no hay fechas concretas", () => {
    const r = parsearFechas(
      JSON.stringify({
        inicio: null,
        fin: null,
        relativo: "un mes desde la publicación del extracto en el DOE",
        literal: "El plazo de presentación será de un mes contado desde la publicación",
      }),
    );
    expect(r?.inicio).toBeNull();
    expect(r?.relativo).toContain("un mes");
  });

  it("una regla demasiado corta no cuenta", () => {
    expect(
      parsearFechas(
        JSON.stringify({ inicio: null, fin: null, relativo: "pronto", literal: "xxxxxxxxxxx" }),
      ),
    ).toBeNull();
  });
});
