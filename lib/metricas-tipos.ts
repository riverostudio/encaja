export const TIPOS_METRICA = [
  "pagina",
  "busqueda",
  "ayuda_abierta",
  "expediente_creado",
  "solicitud_abierta",
  "encaje_iniciado",
  "encaje_terminado",
  "agente_abierto",
  "agente_usado",
  "perfil",
  "accion",
  "latido",
] as const;

export type TipoMetrica = (typeof TIPOS_METRICA)[number];

export interface ResumenAdmin {
  generadoAt: string;
  persistente: boolean;
  periodoDias: number;
  resumen: {
    activosAhora: number;
    visitantes: number;
    visitantesTotal: number;
    visitantesNuevos: number;
    sesiones: number;
    interacciones: number;
    busquedas: number;
    usosAgente: number;
    expedientes: number;
    solicitudes: number;
    comprobaciones: number;
    tiempoMedioSegundos: number;
  };
  eventosPorTipo: { nombre: string; total: number }[];
  paginas: { nombre: string; total: number }[];
  categorias: { nombre: string; total: number }[];
  ayudas: { codigo: string; total: number }[];
  serie: { dia: string; visitantes: number; sesiones: number; interacciones: number }[];
  activos: { sesion: string; pagina: string; segundos: number; ultima: string }[];
  recientes: {
    id: string;
    tipo: string;
    pagina: string;
    categoria: string | null;
    codigo: string | null;
    fecha: string;
    visitante: string;
  }[];
}
