import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Repo } from "../lib/repo";
import type { Convocatoria } from "../lib/tipos";

const generar = vi.fn();
const hayClave = vi.fn();

vi.mock("../lib/ia", () => ({
  generar,
  hayClave,
}));

vi.mock("../lib/bdns", () => ({
  descargarBases: vi.fn(async () => ({ tipo: "pdf", datos: Buffer.from("PDF") })),
}));

const conv: Convocatoria = {
  codigoBdns: "1",
  titulo: "Ayuda",
  nivel1: "ESTADO",
  nivel2: "Ministerio",
  fechaRegistro: "2026-08-05",
  mrr: false,
  beneficiarios: [],
  instrumentos: [],
  sectores: [],
  regiones: ["ES"],
  fondos: [],
};

function repoFalso(): Repo {
  return {
    getEvaluacion: vi.fn(() => null),
    guardarEvaluacion: vi.fn(),
  } as unknown as Repo;
}

describe("bases con credenciales de un visitante", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hayClave.mockReturnValue(false);
    generar.mockResolvedValue(
      JSON.stringify({
        requisitos: [{
          id: "r1",
          literal: "Estar empadronado",
          tipo: "condicion",
          clave: "empadronado",
          pregunta: "¿Estás empadronado?",
          respuestas: ["sí", "no"],
        }],
      }),
    );
  });

  it("usa la clave que llega del navegador aunque el servidor no tenga una", async () => {
    const { obtenerRequisitos } = await import("../lib/bases");
    const resultado = await obtenerRequisitos(repoFalso(), conv, 2, {
      proveedor: "gemini",
      modelo: "gemini-2.5-flash",
      clave: "visitante",
    });
    expect(resultado.requisitos).toHaveLength(1);
    expect(generar).toHaveBeenCalledOnce();
  });

  it("explica que falta clave cuando no hay ninguna", async () => {
    const { obtenerRequisitos } = await import("../lib/bases");
    const resultado = await obtenerRequisitos(repoFalso(), conv, 2, null);
    expect(resultado).toEqual({ requisitos: [], motivo: "sin_clave" });
  });
});
