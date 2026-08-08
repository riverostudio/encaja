import { describe, expect, it } from "vitest";
import { alertasParaExpedientes, progresoSolicitud, siguientePasoSolicitud, type ExpedientePlan } from "../lib/plan";
import { compararPrestaciones, documentosParaPerfil } from "../lib/acompanamiento";
import { PRESTACIONES } from "../lib/prestaciones";
import { DERIVACIONES_OFICIALES, derivacionesParaEscenarios } from "../lib/derivaciones";

function expediente(cambios: Partial<ExpedientePlan> = {}): ExpedientePlan {
  return {
    codigo: "123",
    titulo: "Ayuda de prueba",
    estado: "preparacion",
    plazo: "abierta",
    dias: 30,
    tareas: [{ estado: "lo_tengo" }, { estado: "pendiente" }],
    ...cambios,
  };
}

describe("plan personal de solicitudes", () => {
  it("calcula progreso sin presentarlo como concesión", () => {
    expect(progresoSolicitud(expediente())).toBe(50);
    expect(progresoSolicitud(expediente({ estado: "presentada" }))).toBe(80);
    expect(progresoSolicitud(expediente({ estado: "concedida" }))).toBe(100);
  });

  it("prioriza avisos urgentes y no alerta expedientes resueltos", () => {
    const alertas = alertasParaExpedientes([
      expediente({ codigo: "1", plazo: "aviso", dias: 12 }),
      expediente({ codigo: "2", plazo: "urgente", dias: 1 }),
      expediente({ codigo: "3", estado: "concedida", plazo: "urgente", dias: 0 }),
    ]);
    expect(alertas[0]).toMatchObject({ codigo: "2", prioridad: 1 });
    expect(alertas.some((a) => a.codigo === "3")).toBe(false);
  });

  it("da un siguiente paso concreto según estado y documentos", () => {
    expect(siguientePasoSolicitud(expediente())).toContain("1 documento");
    expect(siguientePasoSolicitud(expediente({ estado: "presentada" }))).toContain("justificante");
    expect(siguientePasoSolicitud(expediente({ plazo: "cerrada" }))).toContain("cerrado");
  });
});

describe("documentos y compatibilidad", () => {
  it("añade solo documentos coherentes con el perfil", () => {
    const docs = documentosParaPerfil(new Map(Object.entries({ situacion: "estudiante", menores_cargo: "1" })));
    const ids = docs.map((d) => d.id);
    expect(ids).toContain("matricula");
    expect(ids).toContain("familia");
    expect(ids).not.toContain("autonomo");
  });

  it("detecta la incompatibilidad familiar expresa", () => {
    const ayudas = PRESTACIONES.filter((p) => ["deduccion-familia-numerosa", "deduccion-ascendiente-dos-hijos"].includes(p.id));
    expect(compararPrestaciones(ayudas)).toEqual([
      expect.objectContaining({ estado: "incompatible" }),
    ]);
  });

  it("no promete compatibilidad si no consta una prohibición", () => {
    const ayudas = PRESTACIONES.filter((p) => ["imv", "bono-social"].includes(p.id));
    expect(compararPrestaciones(ayudas)[0]).toMatchObject({ estado: "revisar" });
  });
});

describe("derivación humana oficial", () => {
  it.each([
    ["violencia_genero", "violencia-016"],
    ["dependencia", "dependencia-saad"],
    ["discapacidad", "grado-discapacidad"],
    ["migracion", "integracion-migrantes"],
    ["extutelado", "joven-extutelado"],
    ["alimentacion", "orientacion-060"],
  ] as const)("cubre %s con %s", (escenario, id) => {
    expect(derivacionesParaEscenarios([escenario]).map((d) => d.id)).toContain(id);
  });

  it("todas las derivaciones usan una fuente pública HTTPS", () => {
    for (const d of DERIVACIONES_OFICIALES) {
      const url = new URL(d.url);
      expect(url.protocol).toBe("https:");
      expect(url.hostname).toMatch(/\.gob\.es$|imserso\.es$|inclusion\.gob\.es$|juventudeinfancia\.gob\.es$/);
      expect(d.pasos.length).toBeGreaterThanOrEqual(3);
    }
  });
});
