// Utilidades de la capa servidor (API routes): una única conexión SQLite por
// proceso y la búsqueda compuesta que alimenta el radar.
import path from "node:path";
import { abrirDb } from "./db";
import { crearRepo, type Repo } from "./repo";
import { estadoPlazo, formatoRango } from "./plazos";
import { resolverCP, esOrganoDeMiZona } from "./territorio";
import { resumirEstructural, type ResumenLlano } from "./resumen";
import { evaluarEstructural } from "./encaje";
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
  /** Cuántas convocatorias hermanas se han plegado bajo esta (1 = ninguna). */
  hermanas: number;
  /** Los códigos de las hermanas, para poder abrirlas. */
  codigosHermanas: string[];
};

const ORDEN_ESTADO: Record<string, number> = {
  urgente: 0,
  aviso: 1,
  abierta: 2,
  proxima: 3,
  sin_fechas: 4,
  cerrada: 5,
};

/**
 * La BDNS registra cada línea de un mismo decreto por separado: 60 fichas
 * idénticas de "AYUDAS PARA INSERCIÓN LABORAL" llenan la pantalla. Se pliegan
 * bajo una sola, quedándose con la de plazo más cercano.
 */
export function agruparHermanas(filas: ConvocatoriaConPlazo[]): ConvocatoriaConPlazo[] {
  const grupos = new Map<string, ConvocatoriaConPlazo[]>();
  for (const c of filas) {
    const llave = `${c.titulo.trim().toLowerCase()}|${(c.nivel3 ?? c.nivel2).toLowerCase()}`;
    const grupo = grupos.get(llave);
    if (grupo) grupo.push(c);
    else grupos.set(llave, [c]);
  }

  const salida: ConvocatoriaConPlazo[] = [];
  for (const grupo of grupos.values()) {
    // Se enseña la que antes cierra: es la que corre prisa.
    const cabeza = grupo.reduce((mejor, c) =>
      ORDEN_ESTADO[c.plazo.estado] < ORDEN_ESTADO[mejor.plazo.estado] ? c : mejor,
    );
    salida.push({
      ...cabeza,
      hermanas: grupo.length,
      codigosHermanas: grupo.map((c) => c.codigoBdns),
    });
  }
  return salida;
}

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
  /** Con perfil completo, esconde lo que el filtro oficial ya descarta. */
  soloAplicables?: boolean;
}

export type Relajado = "perfil" | "beneficiario" | "plazo" | null;

export interface ResultadoRadar {
  filas: ConvocatoriaConPlazo[];
  /** Qué filtro hubo que soltar para no dejar la pantalla vacía. */
  relajado: Relajado;
  /** Cuántas había con los filtros estrictos (0 si hizo falta relajar). */
  estrictas: number;
}

/**
 * Busca con red: si con los filtros del perfil no sale nada, los va soltando
 * de uno en uno y dice cuál soltó. Una pantalla vacía no informa; una que
 * dice "para ti no hay, pero mira estas" sí.
 */
export function buscarRadarConRed(repo: Repo, f: FiltrosRadar): ResultadoRadar {
  const estricto = buscarRadar(repo, f);
  if (estricto.length > 0) return { filas: estricto, relajado: null, estrictas: estricto.length };

  // 1 · Fuera el descarte automático por perfil.
  if (f.soloAplicables) {
    const r = buscarRadar(repo, { ...f, soloAplicables: false });
    if (r.length > 0) return { filas: r, relajado: "perfil", estrictas: 0 };
  }

  // 2 · Fuera el filtro de a quién van dirigidas.
  if (f.beneficiario) {
    const r = buscarRadar(repo, { ...f, soloAplicables: false, beneficiario: undefined });
    if (r.length > 0) return { filas: r, relajado: "beneficiario", estrictas: 0 };
  }

  // 3 · Último recurso: enseñar también las que ya cerraron, bien marcadas.
  const r = buscarRadar(repo, {
    ...f,
    soloAplicables: false,
    beneficiario: undefined,
    estado: "todas",
  });
  return { filas: r, relajado: r.length > 0 ? "plazo" : null, estrictas: 0 };
}

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
    rangoFechas:
      !c.fechaInicioSol && !c.fechaFinSol && c.plazoRelativo
        ? c.plazoRelativo.length > 46
          ? `${c.plazoRelativo.slice(0, 46)}…`
          : c.plazoRelativo
        : formatoRango(c.fechaInicioSol, c.fechaFinSol),
    llano: resumirEstructural(c),
    resumen: leerResumen(c.resumenIa),
    veredicto: repo.getEvaluacion(c.codigoBdns, 1)?.dictamen ?? null,
    hermanas: 1,
    codigosHermanas: [c.codigoBdns],
  }));

  let filtradas = conPlazo;

  // Con CP: las LOCALES de fuera de tu zona se quitan (las tuyas se quedan).
  if (zona) {
    filtradas = filtradas.filter(
      (c) => c.nivel1 !== "LOCAL" || esOrganoDeMiZona(c.nivel2, c.nivel3, zona),
    );
  }

  // Solo lo que esta persona puede pedir de verdad: fuera lo que el filtro
  // oficial descarta sin lugar a dudas (beneficiario, territorio, plazo).
  if (f.soloAplicables) {
    const hechos = repo.getHechos(1);
    filtradas = filtradas.filter(
      (c) => evaluarEstructural(c, hechos).resultado !== "no",
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

  filtradas = agruparHermanas(filtradas);

  filtradas.sort((a, b) => {
    const orden = ORDEN_ESTADO[a.plazo.estado] - ORDEN_ESTADO[b.plazo.estado];
    if (orden !== 0) return orden;
    if (a.plazo.dias != null && b.plazo.dias != null) return a.plazo.dias - b.plazo.dias;
    return (b.fechaRegistro ?? "").localeCompare(a.fechaRegistro ?? "");
  });

  return filtradas.slice(0, 400);
}
