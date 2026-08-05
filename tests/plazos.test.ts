import { describe, it, expect } from "vitest";
import { estadoPlazo, formatoRango } from "../lib/plazos";

const HOY = new Date("2026-08-03T12:00:00");

describe("formatoRango", () => {
  it("con las dos fechas, del día al día", () => {
    expect(formatoRango("2026-09-15", "2026-09-30", HOY)).toBe("15 sep — 30 sep");
  });

  it("solo fin o solo inicio", () => {
    expect(formatoRango(null, "2026-10-29", HOY)).toBe("hasta el 29 oct");
    expect(formatoRango("2026-07-01", null, HOY)).toBe("desde el 1 jul");
  });

  it("añade el año cuando no es el corriente", () => {
    expect(formatoRango("2027-01-10", "2027-02-01", HOY)).toBe("10 ene 2027 — 1 feb 2027");
    expect(formatoRango(null, "2027-02-01", HOY)).toBe("hasta el 1 feb 2027");
  });

  it("sin fechas lo dice, no inventa", () => {
    expect(formatoRango(null, null, HOY)).toBe("sin fechas");
    expect(formatoRango(undefined, undefined, HOY)).toBe("sin fechas");
  });

  it("mismo día de inicio y fin no se repite", () => {
    expect(formatoRango("2026-09-15", "2026-09-15", HOY)).toBe("solo el 15 sep");
  });
});

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

  it("usa el día civil de Madrid aunque el servidor siga en UTC", () => {
    const medianocheMadrid = new Date("2026-08-05T22:30:00.000Z");
    expect(estadoPlazo(null, "2026-08-05", medianocheMadrid)).toEqual({
      estado: "cerrada",
      dias: -1,
    });
    expect(estadoPlazo(null, "2026-08-06", medianocheMadrid)).toEqual({
      estado: "urgente",
      dias: 0,
    });
  });

  it("sin fechas", () => {
    expect(estadoPlazo(null, null, HOY)).toEqual({ estado: "sin_fechas", dias: null });
    expect(estadoPlazo(undefined, undefined, HOY)).toEqual({ estado: "sin_fechas", dias: null });
  });

  it("abierta sin fecha fin (inicio pasado)", () => {
    expect(estadoPlazo("2026-07-01", null, HOY)).toEqual({ estado: "abierta", dias: null });
  });
});
