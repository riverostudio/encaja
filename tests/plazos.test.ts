import { describe, it, expect } from "vitest";
import { estadoPlazo } from "../lib/plazos";

const HOY = new Date("2026-08-03T12:00:00");

describe("estadoPlazo", () => {
  it("urgente cuando quedan ≤7 días", () => {
    expect(estadoPlazo("2026-07-01", "2026-08-05", HOY)).toEqual({ estado: "urgente", dias: 2 });
    expect(estadoPlazo(null, "2026-08-03", HOY)).toEqual({ estado: "urgente", dias: 0 });
  });

  it("aviso cuando quedan ≤21 días", () => {
    expect(estadoPlazo("2026-07-01", "2026-08-20", HOY)).toEqual({ estado: "aviso", dias: 17 });
  });

  it("abierta con margen", () => {
    expect(estadoPlazo("2026-07-01", "2026-10-29", HOY)).toEqual({ estado: "abierta", dias: 87 });
  });

  it("proxima cuando aún no ha abierto", () => {
    expect(estadoPlazo("2026-09-15", "2026-09-30", HOY)).toEqual({ estado: "proxima", dias: 43 });
  });

  it("cerrada cuando el fin pasó (fin inclusive)", () => {
    expect(estadoPlazo("2026-07-01", "2026-07-31", HOY).estado).toBe("cerrada");
    expect(estadoPlazo(null, "2026-08-02", HOY).estado).toBe("cerrada");
  });

  it("sin fechas", () => {
    expect(estadoPlazo(null, null, HOY)).toEqual({ estado: "sin_fechas", dias: null });
    expect(estadoPlazo(undefined, undefined, HOY)).toEqual({ estado: "sin_fechas", dias: null });
  });

  it("abierta sin fecha fin (inicio pasado)", () => {
    expect(estadoPlazo("2026-07-01", null, HOY)).toEqual({ estado: "abierta", dias: null });
  });
});
