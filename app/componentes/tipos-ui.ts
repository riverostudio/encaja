// Tipos que viajan por la API hacia la UI.
export interface PlazoUi {
  estado: "urgente" | "aviso" | "abierta" | "proxima" | "cerrada" | "sin_fechas";
  dias: number | null;
}

export interface ResumenLlanoUi {
  que: string;
  quien: string;
  consigues: string;
}

export interface ResumenIaUi {
  titular: string;
  que: string;
  consigues: string;
  aQuien: string;
  ojo?: string;
}

export type VeredictoUi = "encaja" | "no_encaja" | "duda" | "pendiente";

export const SELLO: Record<VeredictoUi, { texto: string; color: string } | null> = {
  encaja: { texto: "Encajas", color: "var(--bosque)" },
  no_encaja: { texto: "No encajas", color: "var(--senal)" },
  duda: { texto: "Con dudas", color: "var(--ocre)" },
  pendiente: null,
};

export interface ConvUi {
  codigoBdns: string;
  titulo: string;
  /** El plazo en fechas de calendario, ya formateado por el servidor. */
  rangoFechas: string;
  llano: ResumenLlanoUi;
  resumen?: ResumenIaUi | null;
  veredicto?: VeredictoUi | null;
  /** Cuántas convocatorias iguales se han plegado bajo esta. */
  hermanas?: number;
  /** El plazo se rescató del PDF porque la BDNS no lo publicaba. */
  fechasDelPdf?: boolean;
  plazoRelativo?: string | null;
  tituloCoof?: string | null;
  nivel1: string;
  nivel2: string;
  nivel3?: string | null;
  fechaRegistro: string;
  mrr: boolean;
  fechaInicioSol?: string | null;
  fechaFinSol?: string | null;
  presupuesto?: number | null;
  urlBases?: string | null;
  sede?: string | null;
  finalidad?: string | null;
  beneficiarios: string[];
  instrumentos: string[];
  sectores: string[];
  regiones: string[];
  fondos: string[];
  detalleAt?: string | null;
  plazo: PlazoUi;
}

export interface RequisitoUi {
  id: string;
  literal: string;
  tipo: "dato" | "documento" | "condicion";
  clave?: string;
  pregunta?: string;
  respuestas?: string[];
}

export interface MotivoUi {
  origen: "estructural" | "bases";
  detalle: string;
  literal?: string;
}

/**
 * El plazo como cifra editorial: un número grande y una palabra pequeña.
 * El color es la única señal cromática de toda la interfaz.
 */
/** El color y la cuenta atrás que acompañan al rango de fechas. */
export function plazoVisual(p: PlazoUi): { pie: string; color: string } {
  switch (p.estado) {
    case "urgente":
      return p.dias === 0
        ? { pie: "hoy es el último día", color: "var(--senal)" }
        : { pie: `cierra en ${p.dias} ${p.dias === 1 ? "día" : "días"}`, color: "var(--senal)" };
    case "aviso":
      return { pie: `cierra en ${p.dias} días`, color: "var(--ocre)" };
    case "abierta":
      return p.dias != null
        ? { pie: `abierta · quedan ${p.dias} días`, color: "var(--bosque)" }
        : { pie: "abierta", color: "var(--bosque)" };
    case "proxima":
      return { pie: `abre dentro de ${p.dias} días`, color: "var(--grafito)" };
    case "cerrada":
      return { pie: "plazo cerrado", color: "var(--niebla)" };
    default:
      return { pie: "plazo sin publicar", color: "var(--niebla)" };
  }
}

/** 23.559.000 → "23,6 M€" · espejo de lib/resumen para el navegador. */
export function importeCortoUi(n?: number | null): string | null {
  if (!n || n <= 0) return null;
  if (n >= 1_000_000) {
    const millones = n / 1_000_000;
    const texto = millones >= 10 ? millones.toFixed(1) : millones.toFixed(2);
    return `${texto.replace(/[.,]?0+$/, "").replace(".", ",")} M€`;
  }
  return `${new Intl.NumberFormat("es-ES", { useGrouping: "always" }).format(Math.round(n))} €`;
}

/** Frase de plazo para cabeceras del cajón y del expediente. */
export function fraseP1azo(p: PlazoUi): string {
  switch (p.estado) {
    case "urgente":
      return p.dias === 0 ? "Último día para solicitarla" : `Cierra en ${p.dias} días`;
    case "aviso":
      return `Cierra en ${p.dias} días`;
    case "abierta":
      return p.dias != null ? `Abierta · quedan ${p.dias} días` : "Abierta";
    case "proxima":
      return `Abre dentro de ${p.dias} días`;
    case "cerrada":
      return "Plazo cerrado";
    default:
      return "Plazo sin publicar";
  }
}

export function colorPlazo(p: PlazoUi): string {
  return plazoVisual(p).color;
}

const NIVELES: Record<string, string> = {
  ESTADO: "Estatal",
  AUTONOMICA: "Autonómica",
  LOCAL: "Local",
  OTROS: "Otros",
};

export function nivelBonito(nivel1: string): string {
  return NIVELES[nivel1] ?? nivel1;
}

/** Solo se nombra el instrumento cuando NO es una subvención normal. */
export function tipoAyuda(instrumentos: string[]): string | null {
  const texto = instrumentos.join(" ").toUpperCase();
  if (!texto) return null;
  if (texto.includes("PRÉSTAMO")) return "Préstamo";
  if (texto.includes("GARANTÍA")) return "Aval";
  if (texto.includes("FISCAL")) return "Ventaja fiscal";
  if (texto.includes("RIESGO")) return "Financiación";
  if (texto.includes("SUBVENCIÓN") || texto.includes("ENTREGA DINERARIA")) return null;
  return "Otra ayuda";
}

export function euros(n?: number | null): string | null {
  if (!n) return null;
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(n);
}
