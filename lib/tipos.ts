// Tipos compartidos de toda la app. Los módulos de lib/ son puros:
// nada de Next/React aquí.

export interface Convocatoria {
  codigoBdns: string;
  titulo: string;
  tituloCoof?: string | null;
  nivel1: string; // ESTADO | AUTONOMICA | LOCAL | OTROS
  nivel2: string;
  nivel3?: string | null;
  fechaRegistro: string; // ISO YYYY-MM-DD
  mrr: boolean;
  fechaInicioSol?: string | null;
  fechaFinSol?: string | null;
  abiertaFlag?: boolean | null;
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
  detalleJson?: string | null;
  /** Resumen en cristiano escrito por la IA (JSON de ResumenIA), si ya se pidió. */
  resumenIa?: string | null;
  resumenAt?: string | null;
}

/** Lo que la IA escribe sobre una convocatoria, en lenguaje llano. */
export interface ResumenIA {
  titular: string;
  que: string;
  consigues: string;
  aQuien: string;
  ojo?: string;
}

export type EstadoPlazo =
  | "urgente"
  | "aviso"
  | "abierta"
  | "proxima"
  | "cerrada"
  | "sin_fechas";

export interface Plazo {
  estado: EstadoPlazo;
  dias: number | null;
}

export interface Requisito {
  id: string;
  literal: string; // cita textual de las bases
  tipo: "dato" | "documento" | "condicion";
  clave?: string; // clave de perfil en snake_case
  pregunta?: string;
  respuestas?: string[];
}

export interface Veredicto {
  id: string;
  veredicto: "cumple" | "no_cumple" | "duda";
  motivo: string;
}

export type DictamenValor = "encaja" | "no_encaja" | "duda" | "pendiente";

export interface Motivo {
  origen: "estructural" | "bases";
  detalle: string;
  literal?: string;
}

export interface ResultadoDictamen {
  dictamen: DictamenValor;
  motivos: Motivo[];
}

export interface ItemChecklist {
  id: string;
  texto: string;
  estado: "lo_tengo" | "pedirlo" | "redactarlo" | "pendiente";
  nota?: string;
}

export interface Evaluacion {
  codigoBdns: string;
  perfilId: number;
  dictamen: DictamenValor;
  requisitosJson?: string | null;
  veredictosJson?: string | null;
  motivosJson?: string | null;
  updatedAt?: string;
}

export interface Expediente {
  codigoBdns: string;
  perfilId: number;
  estado: "interesa" | "preparacion" | "presentada" | "concedida" | "denegada";
  carpeta: string;
  checklistJson: string;
  creadoAt?: string;
  updatedAt?: string;
}

export interface Hecho {
  clave: string;
  valor: string;
  fuente: string;
  updatedAt: string;
}
