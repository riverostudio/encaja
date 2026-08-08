// Cliente de la API pública de la BDNS (Sistema Nacional de Publicidad de
// Subvenciones y Ayudas Públicas). Sin clave. Reutilización sujeta a su aviso
// legal: siempre enlazamos la fuente y sincronizamos de forma incremental.
import type { Convocatoria } from "./tipos";

export const BASE = "https://www.infosubvenciones.es/bdnstrans/api";
const UA = "radar-ayudas-local/1.0 (uso personal)";
const TIMEOUT_MS = 30_000;

export interface FilaLista {
  codigoBdns: string;
  titulo: string;
  tituloCoof: string | null;
  nivel1: string;
  nivel2: string;
  nivel3: string | null;
  fechaRegistro: string;
  mrr: boolean;
}

export interface OpcionesBusqueda {
  regiones?: number[];
  fechaDesde?: string; // ISO YYYY-MM-DD
  fechaHasta?: string; // ISO YYYY-MM-DD
  texto?: string;
  /** C = Estado · A = autonómica · L = local · O = otros */
  tipoAdministracion?: "C" | "A" | "L" | "O";
  page: number;
  pageSize?: number;
}

type FetchFn = typeof fetch;

async function pedir(url: string, fetchFn: FetchFn, binario = false): Promise<unknown> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const r = await fetchFn(url, {
      headers: { "User-Agent": UA, Accept: binario ? "*/*" : "application/json" },
      signal: ctrl.signal,
    });
    if (!r.ok) throw new Error(`BDNS HTTP ${r.status} en ${url}`);
    return binario ? r.arrayBuffer() : r.json();
  } finally {
    clearTimeout(timer);
  }
}

/**
 * La BDNS publica muchos enlaces sin protocolo ("ujiapps.uji.es/..."). En un
 * href del navegador eso se toma como ruta relativa y lleva a ninguna parte,
 * así que se les pone https:// al guardarlos.
 */
export function urlAbsoluta(u: string | null | undefined): string | null {
  const limpio = u?.trim();
  if (!limpio) return null;

  // Algún organismo publica el subdominio separado con una arroba
  // ("https://sede@calahorra.es") en vez de un punto. El navegador lo
  // interpreta como credenciales HTTP y termina en el dominio equivocado.
  const arrobaComoPunto = limpio.match(
    /^(https?):\/\/([a-z0-9-]+)@([a-z0-9.-]+\.[a-z]{2,})([/?#].*)?$/i,
  );
  if (arrobaComoPunto) {
    return `${arrobaComoPunto[1]}://${arrobaComoPunto[2]}.${arrobaComoPunto[3]}${arrobaComoPunto[4] ?? ""}`;
  }
  if (/^https?:\/\//i.test(limpio)) return limpio;

  // A veces el organismo pega algo delante ("Inmahttps://cindi.gva.es/…").
  // Si dentro hay una URL de verdad, se rescata.
  const dentro = limpio.match(/https?:\/\/\S+/i);
  if (dentro) return dentro[0];

  // Protocolo mal escrito: "ttps://…", "ttp://…" (se comieron la hache).
  const mutilado = limpio.match(/^t?tps?:\/\/(.+)$/i);
  if (mutilado) return `https://${mutilado[1]}`;

  // Basura publicada por el propio organismo: rutas de su ordenador.
  if (/^[a-z]:\\/i.test(limpio) || limpio.includes("\\")) return null;

  // Protocolos que no son web (mailto:, ftp:…) se dejan como están.
  if (/^[a-z][a-z0-9+.-]*:/i.test(limpio)) return limpio;

  // Sin un punto no es un dominio: no se inventa un enlace.
  const sinBarras = limpio.replace(/^\/+/, "");
  if (!/^[^\s/]+\.[^\s/]{2,}/.test(sinBarras)) return null;
  return `https://${sinBarras}`;
}

function aFechaBdns(iso: string): string {
  const [a, m, d] = iso.split("-");
  return `${d}/${m}/${a}`;
}

/** Busca una página de convocatorias (ordenadas por fecha de registro desc). */
export async function buscarPagina(
  opts: OpcionesBusqueda,
  fetchFn: FetchFn = fetch,
): Promise<{ filas: FilaLista[]; totalPaginas: number; total: number }> {
  const p = new URLSearchParams({
    vpd: "GE",
    order: "fechaRecepcion",
    direccion: "desc",
    page: String(opts.page),
    pageSize: String(opts.pageSize ?? 200),
  });
  for (const r of opts.regiones ?? []) p.append("regiones", String(r));
  if (opts.tipoAdministracion) p.set("tipoAdministracion", opts.tipoAdministracion);
  if (opts.fechaDesde) p.set("fechaDesde", aFechaBdns(opts.fechaDesde));
  if (opts.fechaHasta) p.set("fechaHasta", aFechaBdns(opts.fechaHasta));
  if (opts.texto) {
    p.set("descripcion", opts.texto);
    p.set("descripcionTipoBusqueda", "1");
  }
  const data = (await pedir(`${BASE}/convocatorias/busqueda?${p}`, fetchFn)) as {
    content?: Array<Record<string, unknown>>;
    totalPages?: number;
    totalElements?: number;
  };
  const filas: FilaLista[] = (data.content ?? []).map((c) => ({
    codigoBdns: String(c.numeroConvocatoria ?? ""),
    titulo: String(c.descripcion ?? ""),
    tituloCoof: (c.descripcionLeng as string | null) ?? null,
    nivel1: String(c.nivel1 ?? ""),
    nivel2: String(c.nivel2 ?? ""),
    nivel3: (c.nivel3 as string | null) ?? null,
    fechaRegistro: String(c.fechaRecepcion ?? ""),
    mrr: Boolean(c.mrr),
  }));
  return { filas, totalPaginas: data.totalPages ?? 0, total: data.totalElements ?? 0 };
}

interface DetalleCrudo {
  codigoBDNS?: string;
  organo?: { nivel1?: string; nivel2?: string; nivel3?: string };
  descripcion?: string;
  descripcionLeng?: string | null;
  fechaRecepcion?: string;
  mrr?: boolean;
  fechaInicioSolicitud?: string | null;
  fechaFinSolicitud?: string | null;
  abierto?: boolean | null;
  presupuestoTotal?: number | null;
  urlBasesReguladoras?: string | null;
  sedeElectronica?: string | null;
  descripcionFinalidad?: string | null;
  tiposBeneficiarios?: Array<{ descripcion?: string }>;
  instrumentos?: Array<{ descripcion?: string }>;
  sectores?: Array<{ descripcion?: string; codigo?: string }>;
  regiones?: Array<{ descripcion?: string }>;
  fondos?: Array<{ descripcion?: string }>;
  documentos?: Array<{ id?: number; descripcion?: string; nombreFic?: string }>;
}

/** Detalle completo de una convocatoria por su código BDNS. */
export async function detalle(
  codigoBdns: string,
  fetchFn: FetchFn = fetch,
): Promise<Convocatoria> {
  const d = (await pedir(
    `${BASE}/convocatorias?vpd=GE&numConv=${encodeURIComponent(codigoBdns)}`,
    fetchFn,
  )) as DetalleCrudo;
  const limpiar = (s?: string | null) => (s ? s.trim() : null);
  return {
    codigoBdns: String(d.codigoBDNS ?? codigoBdns),
    titulo: String(d.descripcion ?? ""),
    tituloCoof: (d.descripcionLeng as string | null) ?? null,
    nivel1: String(d.organo?.nivel1 ?? ""),
    nivel2: String(d.organo?.nivel2 ?? ""),
    nivel3: d.organo?.nivel3 ?? null,
    fechaRegistro: String(d.fechaRecepcion ?? ""),
    mrr: Boolean(d.mrr),
    fechaInicioSol: limpiar(d.fechaInicioSolicitud),
    fechaFinSol: limpiar(d.fechaFinSolicitud),
    abiertaFlag: d.abierto ?? null,
    presupuesto: d.presupuestoTotal ?? null,
    urlBases: urlAbsoluta(d.urlBasesReguladoras),
    sede: urlAbsoluta(d.sedeElectronica),
    finalidad: limpiar(d.descripcionFinalidad),
    beneficiarios: (d.tiposBeneficiarios ?? []).map((b) => (b.descripcion ?? "").trim()).filter(Boolean),
    instrumentos: (d.instrumentos ?? []).map((i) => (i.descripcion ?? "").trim()).filter(Boolean),
    sectores: (d.sectores ?? []).map((s) => (s.codigo ?? s.descripcion ?? "").trim()).filter(Boolean),
    regiones: (d.regiones ?? []).map((r) => (r.descripcion ?? "").trim()).filter(Boolean),
    fondos: (d.fondos ?? []).map((f) => (f.descripcion ?? "").trim()).filter(Boolean),
    detalleAt: new Date().toISOString(),
    documentoId: d.documentos?.find((doc) => doc.id)?.id ?? null,
    detalleJson: JSON.stringify(d),
  };
}

/**
 * Descarga las bases reguladoras: primero el documento adjunto en la BDNS
 * (PDF oficial), si no existe devuelve la URL externa de las bases.
 */
export async function descargarBases(
  conv: Convocatoria,
  fetchFn: FetchFn = fetch,
): Promise<{ tipo: "pdf" | "url"; datos: Buffer | string } | null> {
  const crudo = conv.detalleJson ? (JSON.parse(conv.detalleJson) as DetalleCrudo) : null;
  const documentoId = conv.documentoId ?? crudo?.documentos?.find((x) => x.id)?.id;
  if (documentoId) {
    const buf = (await pedir(
      `${BASE}/convocatorias/documentos?idDocumento=${documentoId}`,
      fetchFn,
      true,
    )) as ArrayBuffer;
    return { tipo: "pdf", datos: Buffer.from(buf) };
  }
  if (conv.urlBases) return { tipo: "url", datos: conv.urlBases };
  return null;
}
