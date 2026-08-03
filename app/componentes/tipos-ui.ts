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

export function textoPlazo(p: PlazoUi): string {
  switch (p.estado) {
    case "urgente":
      return p.dias === 0 ? "¡CIERRA HOY!" : `CIERRA EN ${p.dias} DÍA${p.dias === 1 ? "" : "S"}`;
    case "aviso":
      return `CIERRA EN ${p.dias} DÍAS`;
    case "abierta":
      return p.dias != null ? `ABIERTA · ${p.dias} DÍAS` : "ABIERTA";
    case "proxima":
      return `ABRE EN ${p.dias} DÍAS`;
    case "cerrada":
      return "CERRADA";
    default:
      return "PLAZO: VER BASES";
  }
}

export function clasePlazo(p: PlazoUi): string {
  switch (p.estado) {
    case "urgente":
      return "plazo plazo-urgente";
    case "aviso":
      return "plazo plazo-aviso";
    case "abierta":
      return "plazo plazo-abierta";
    case "proxima":
      return "plazo plazo-proxima";
    default:
      return "plazo plazo-muted";
  }
}

export function chipInstrumento(instrumentos: string[]): string | null {
  const texto = instrumentos.join(" ").toUpperCase();
  if (!texto) return null;
  if (texto.includes("SUBVENCIÓN") || texto.includes("ENTREGA DINERARIA")) return "€ FONDO PERDIDO";
  if (texto.includes("PRÉSTAMO")) return "PRÉSTAMO";
  if (texto.includes("GARANTÍA")) return "AVAL";
  if (texto.includes("FISCAL")) return "VENTAJA FISCAL";
  if (texto.includes("RIESGO")) return "FINANCIACIÓN";
  return "OTRA AYUDA";
}

export function euros(n?: number | null): string | null {
  if (!n) return null;
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(n);
}
