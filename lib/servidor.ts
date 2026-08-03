// Utilidades de la capa servidor (API routes): una única conexión SQLite por
// proceso y la búsqueda compuesta que alimenta el radar.
import path from "node:path";
import { abrirDb } from "./db";
import { crearRepo, type Repo } from "./repo";
import { estadoPlazo, formatoRango } from "./plazos";
import { resolverCP, esOrganoDeMiZona } from "./territorio";
import { resumirEstructural, type ResumenLlano } from "./resumen";
import type { Convocatoria, DictamenValor, Plazo, ResumenIA } from "./tipos";

let repoGlobal: Repo | null = null;

export function getRepo(): Repo {
  if (!repoGlobal) repoGlobal = crearRepo(abrirDb());
  return repoGlobal;
}

export function dirExpedientes(): string {
  return path.join(process.cwd(), "expedientes");
}

export function errorJson(e: unknown): { error: string } {
  return { error: e instanceof Error ? e.message : String(e) };
}

export type ConvocatoriaConPlazo = Convocatoria & {
  plazo: Plazo;
  /** El plazo en fechas de calendario: "15 sep — 30 sep". */
  rangoFechas: string;
  /** Traducción instantánea desde los datos oficiales (siempre presente). */
  llano: ResumenLlano;
  /** Traducción escrita por la IA, si ya se generó para esta convocatoria. */
  resumen: ResumenIA | null;
  /** Veredicto de encaje ya emitido para el perfil, si lo hay. */
  veredicto: DictamenValor | null;
};

function leerResumen(json?: string | null): ResumenIA | null {
  if (!json) return null;
  try {
    return JSON.parse(json) as ResumenIA;
  } catch {
    return null;
  }
}

export interface FiltrosRadar {
  texto?: string;
  nivel1?: string;
  instrumento?: string;
  beneficiario?: string;
  estado?: string; // abiertas | urgentes | proximas | todas
  region?: number;
  cp?: string;
}

const ORDEN_ESTADO: Record<string, number> = {
  urgente: 0,
  aviso: 1,
  abierta: 2,
  proxima: 3,
  sin_fechas: 4,
  cerrada: 5,
};

/** Búsqueda del radar: filtros + semáforo + prioridad por cierre de plazo. */
export function buscarRadar(repo: Repo, f: FiltrosRadar): ConvocatoriaConPlazo[] {
  const zona = f.cp ? resolverCP(f.cp) : null;
  const filas = repo.buscar({
    texto: f.texto,
    nivel1: f.nivel1,
    instrumento: f.instrumento,
    beneficiario: f.beneficiario,
    regionSync: f.region,
    limite: 3000,
  });

  const conPlazo: ConvocatoriaConPlazo[] = filas.map((c) => ({
    ...c,
    plazo: estadoPlazo(c.fechaInicioSol, c.fechaFinSol),
    rangoFechas: formatoRango(c.fechaInicioSol, c.fechaFinSol),
    llano: resumirEstructural(c),
    resumen: leerResumen(c.resumenIa),
    veredicto: repo.getEvaluacion(c.codigoBdns, 1)?.dictamen ?? null,
  }));

  let filtradas = conPlazo;

  // Con CP: las LOCALES de fuera de tu zona se quitan (las tuyas se quedan).
  if (zona) {
    filtradas = filtradas.filter(
      (c) => c.nivel1 !== "LOCAL" || esOrganoDeMiZona(c.nivel2, c.nivel3, zona),
    );
  }

  switch (f.estado) {
    case "abiertas":
      filtradas = filtradas.filter((c) =>
        ["urgente", "aviso", "abierta"].includes(c.plazo.estado),
      );
      break;
    case "urgentes":
      filtradas = filtradas.filter((c) => ["urgente", "aviso"].includes(c.plazo.estado));
      break;
    case "proximas":
      filtradas = filtradas.filter((c) => c.plazo.estado === "proxima");
      break;
    case "todas":
      break;
    default:
      // Por defecto fuera las cerradas
      filtradas = filtradas.filter((c) => c.plazo.estado !== "cerrada");
  }

  filtradas.sort((a, b) => {
    const orden = ORDEN_ESTADO[a.plazo.estado] - ORDEN_ESTADO[b.plazo.estado];
    if (orden !== 0) return orden;
    if (a.plazo.dias != null && b.plazo.dias != null) return a.plazo.dias - b.plazo.dias;
    return (b.fechaRegistro ?? "").localeCompare(a.fechaRegistro ?? "");
  });

  return filtradas.slice(0, 400);
}
