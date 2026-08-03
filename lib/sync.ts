// Sync BDNS en dos niveles: lista en masa (barata) + detalles en cola.
import type { Repo } from "./repo";
import type { Convocatoria } from "./tipos";
import { buscarPagina, detalle, type FilaLista, type OpcionesBusqueda } from "./bdns";

const BACKFILL_DIAS = 365;
const MAX_PAGINAS = 200; // tope de seguridad por sync

type BuscarFn = (
  o: OpcionesBusqueda,
) => Promise<{ filas: FilaLista[]; totalPaginas: number; total: number }>;
type DetalleFn = (codigo: string) => Promise<Convocatoria>;

function hoyIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function haceDiasIso(dias: number): string {
  return new Date(Date.now() - dias * 86_400_000).toISOString().slice(0, 10);
}

function filaAConvocatoria(f: FilaLista): Convocatoria {
  return { ...f, beneficiarios: [], instrumentos: [], sectores: [], regiones: [], fondos: [] };
}

/**
 * Sincroniza la LISTA de un territorio (id de región BDNS).
 * Primer sync: backfill de 365 días. Siguientes: desde el último sync.
 */
export async function syncLista(
  repo: Repo,
  regionId: number,
  opts: { buscarFn?: BuscarFn; onProgreso?: (pagina: number, total: number) => void } = {},
): Promise<{ nuevas: number; paginas: number }> {
  const buscarFn = opts.buscarFn ?? ((o) => buscarPagina(o));
  const previo = repo.ultimoSync(regionId);
  const desde = previo?.hasta ?? haceDiasIso(BACKFILL_DIAS);
  const hasta = hoyIso();

  let nuevas = 0;
  let pagina = 0;
  let totalPaginas = 1;
  while (pagina < totalPaginas && pagina < MAX_PAGINAS) {
    const r = await buscarFn({
      regiones: [regionId],
      fechaDesde: desde,
      fechaHasta: hasta,
      page: pagina,
      pageSize: 200,
    });
    totalPaginas = Math.min(r.totalPaginas, MAX_PAGINAS);
    nuevas += repo.upsertLista(r.filas.map(filaAConvocatoria), regionId);
    opts.onProgreso?.(pagina + 1, totalPaginas);
    pagina++;
    if (r.filas.length === 0) break;
  }
  repo.registrarSync(regionId, desde, hasta, nuevas);
  return { nuevas, paginas: pagina };
}

/**
 * Completa la cola de DETALLES pendientes (más recientes primero).
 * Un fallo por ítem no rompe la cola: reintenta una vez con pausa y,
 * si vuelve a fallar, lo deja pendiente para el siguiente sync.
 */
export async function syncDetalles(
  repo: Repo,
  opts: {
    detalleFn?: DetalleFn;
    limite?: number;
    concurrencia?: number;
    reintentoMs?: number;
    onProgreso?: (hechos: number, total: number) => void;
  } = {},
): Promise<number> {
  const detalleFn = opts.detalleFn ?? ((c) => detalle(c));
  const pendientes = repo.pendientesDetalle(opts.limite ?? 300);
  const concurrencia = opts.concurrencia ?? 4;
  const reintentoMs = opts.reintentoMs ?? 2000;

  let hechos = 0;
  let indice = 0;

  async function trabajador(): Promise<void> {
    while (indice < pendientes.length) {
      const mio = pendientes[indice++];
      for (let intento = 0; intento < 2; intento++) {
        try {
          const conv = await detalleFn(mio.codigoBdns);
          repo.upsertDetalle(conv);
          hechos++;
          opts.onProgreso?.(hechos, pendientes.length);
          break;
        } catch {
          if (intento === 0) await new Promise((r) => setTimeout(r, reintentoMs));
        }
      }
    }
  }

  await Promise.all(Array.from({ length: concurrencia }, trabajador));
  return hechos;
}

/**
 * Re-descarga el detalle de convocatorias que siguen potencialmente abiertas
 * (fin en el futuro cercano o sin fechas) con detalle de hace >7 días.
 */
export async function refrescarAbiertas(
  repo: Repo,
  opts: { detalleFn?: DetalleFn; limite?: number } = {},
): Promise<number> {
  const detalleFn = opts.detalleFn ?? ((c) => detalle(c));
  const corte = haceDiasIso(3);
  const detalleViejo = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const candidatas = repo
    .buscar({ limite: opts.limite ?? 100 })
    .filter(
      (c) =>
        c.detalleAt &&
        c.detalleAt < detalleViejo &&
        (!c.fechaFinSol || c.fechaFinSol >= corte),
    );
  let n = 0;
  for (const c of candidatas) {
    try {
      repo.upsertDetalle(await detalleFn(c.codigoBdns));
      n++;
    } catch {
      // se reintentará en el próximo sync
    }
  }
  return n;
}
