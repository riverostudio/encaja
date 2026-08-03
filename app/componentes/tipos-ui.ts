// Tipos que viajan por la API hacia la UI.
export interface PlazoUi {
  estado: "urgente" | "aviso" | "abierta" | "proxima" | "cerrada" | "sin_fechas";
  dias: number | null;
}

export interface ConvUi {
  codigoBdns: string;
  titulo: string;
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
export function plazoVisual(p: PlazoUi): {
  cifra: string;
  pie: string;
  color: string;
  grande: boolean;
} {
  switch (p.estado) {
    case "urgente":
      return p.dias === 0
        ? { cifra: "hoy", pie: "último día", color: "var(--senal)", grande: false }
        : {
            cifra: String(p.dias),
            pie: p.dias === 1 ? "día" : "días",
            color: "var(--senal)",
            grande: true,
          };
    case "aviso":
      return { cifra: String(p.dias), pie: "días", color: "var(--ocre)", grande: true };
    case "abierta":
      return p.dias != null
        ? { cifra: String(p.dias), pie: "días", color: "var(--bosque)", grande: true }
        : { cifra: "·", pie: "abierta", color: "var(--bosque)", grande: false };
    case "proxima":
      return {
        cifra: String(p.dias),
        pie: "para abrir",
        color: "var(--grafito)",
        grande: true,
      };
    case "cerrada":
      return { cifra: "—", pie: "cerrada", color: "var(--niebla)", grande: false };
    default:
      return { cifra: "—", pie: "ver bases", color: "var(--niebla)", grande: false };
  }
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
