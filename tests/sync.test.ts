import { describe, it, expect, vi } from "vitest";
import { abrirDb } from "../lib/db";
import { crearRepo } from "../lib/repo";
import { syncLista, syncDetalles } from "../lib/sync";
import type { FilaLista } from "../lib/bdns";

const fila = (n: number): FilaLista => ({
  codigoBdns: String(900000 + n),
  titulo: `Convocatoria ${n}`,
  tituloCoof: null,
  nivel1: "AUTONOMICA",
  nivel2: "COMUNITAT VALENCIANA",
  nivel3: "GVA",
  fechaRegistro: "2026-08-01",
  mrr: false,
});

describe("syncLista", () => {
  it("backfill inicial pagina hasta agotar y registra el sync", async () => {
    const repo = crearRepo(abrirDb(":memory:"));
    const paginas = [
      { filas: [fila(1), fila(2)], totalPaginas: 2, total: 3 },
      { filas: [fila(3)], totalPaginas: 2, total: 3 },
    ];
    const buscar = vi.fn(async (o: { page: number }) => paginas[o.page]);
    const r = await syncLista(repo, 54, { buscarFn: buscar });
    expect(r.nuevas).toBe(3);
    expect(repo.contar()).toBe(3);
    expect(repo.ultimoSync(54)).not.toBeNull();
    // backfill: fechaDesde ≈ hace 365 días
    const args = buscar.mock.calls[0][0] as { fechaDesde?: string };
    expect(args.fechaDesde).toBeTruthy();
  });

  it("el segundo sync parte del último y no duplica", async () => {
    const repo = crearRepo(abrirDb(":memory:"));
    const buscar = vi.fn(async (_o: { fechaDesde?: string; page: number }) => ({
      filas: [fila(1)],
      totalPaginas: 1,
      total: 1,
    }));
    await syncLista(repo, 54, { buscarFn: buscar });
    await syncLista(repo, 54, { buscarFn: buscar });
    expect(repo.contar()).toBe(1);
    // el segundo sync arranca donde terminó el primero (hoy)
    expect(buscar.mock.calls[1][0].fechaDesde).toBe(new Date().toISOString().slice(0, 10));
  });
});

describe("syncDetalles", () => {
  it("completa pendientes y un fallo no rompe la cola", async () => {
    const repo = crearRepo(abrirDb(":memory:"));
    repo.upsertLista([fila(1), fila(2), fila(3)].map((f) => ({ ...f, beneficiarios: [], instrumentos: [], sectores: [], regiones: [], fondos: [] })));
    const detalleFn = vi.fn(async (codigo: string) => {
      if (codigo === "900002") throw new Error("BDNS HTTP 500");
      return {
        codigoBdns: codigo,
        titulo: `Convocatoria ${codigo}`,
        nivel1: "AUTONOMICA",
        nivel2: "COMUNITAT VALENCIANA",
        fechaRegistro: "2026-08-01",
        mrr: false,
        fechaInicioSol: "2026-08-01",
        fechaFinSol: "2026-10-15",
        beneficiarios: ["PYME"],
        instrumentos: [],
        sectores: [],
        regiones: [],
        fondos: [],
        detalleAt: new Date().toISOString(),
        detalleJson: "{}",
      };
    });
    const hechos = await syncDetalles(repo, { detalleFn, concurrencia: 2, reintentoMs: 1 });
    expect(hechos).toBe(2); // 900002 falla sus 2 intentos
    expect(repo.pendientesDetalle(10).map((c) => c.codigoBdns)).toEqual(["900002"]);
    expect(repo.getConvocatoria("900001")?.fechaFinSol).toBe("2026-10-15");
  });
});
