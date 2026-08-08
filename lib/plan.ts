export type EstadoSeguimiento = "interesa" | "preparacion" | "presentada" | "concedida" | "denegada";
export type EstadoTarea = "lo_tengo" | "pedirlo" | "redactarlo" | "pendiente";

export interface ExpedientePlan {
  codigo: string;
  titulo: string;
  estado: EstadoSeguimiento;
  plazo: "urgente" | "aviso" | "abierta" | "proxima" | "cerrada" | "sin_fechas";
  dias: number | null;
  tareas: { estado: EstadoTarea }[];
}

export interface AlertaPlan {
  id: string;
  prioridad: 1 | 2 | 3;
  titulo: string;
  detalle: string;
  codigo?: string;
}

export function progresoSolicitud(expediente: Pick<ExpedientePlan, "estado" | "tareas">): number {
  if (expediente.estado === "concedida" || expediente.estado === "denegada") return 100;
  if (expediente.estado === "presentada") return 80;
  const documentos = expediente.tareas.length
    ? expediente.tareas.filter((t) => t.estado === "lo_tengo").length / expediente.tareas.length
    : 0;
  const base = expediente.estado === "preparacion" ? 30 : 10;
  return Math.min(70, Math.round(base + documentos * 40));
}

export function siguientePasoSolicitud(expediente: ExpedientePlan): string {
  if (expediente.estado === "concedida") return "Guarda la resolución y revisa las obligaciones posteriores.";
  if (expediente.estado === "denegada") return "Lee el motivo y comprueba el plazo de recurso en la resolución.";
  if (expediente.estado === "presentada") return "Guarda el justificante y consulta las notificaciones oficiales.";
  if (expediente.plazo === "cerrada") return "El plazo está cerrado: comprueba si habrá una nueva convocatoria.";
  const falta = expediente.tareas.filter((t) => t.estado !== "lo_tengo").length;
  if (falta) return `Prepara ${falta} documento${falta === 1 ? "" : "s"} pendiente${falta === 1 ? "" : "s"}.`;
  return "Revisa las bases y abre la sede oficial para presentar la solicitud.";
}

export function alertasParaExpedientes(expedientes: ExpedientePlan[]): AlertaPlan[] {
  const alertas: AlertaPlan[] = [];
  for (const e of expedientes) {
    if (e.estado === "concedida" || e.estado === "denegada") continue;
    if (e.plazo === "cerrada") {
      alertas.push({ id: `cerrada-${e.codigo}`, prioridad: 3, titulo: "Plazo cerrado", detalle: e.titulo, codigo: e.codigo });
    } else if (e.plazo === "urgente") {
      alertas.push({ id: `urgente-${e.codigo}`, prioridad: 1, titulo: e.dias === 0 ? "Cierra hoy" : `Cierra en ${e.dias} días`, detalle: e.titulo, codigo: e.codigo });
    } else if (e.plazo === "aviso") {
      alertas.push({ id: `aviso-${e.codigo}`, prioridad: 2, titulo: `Quedan ${e.dias} días`, detalle: e.titulo, codigo: e.codigo });
    }
    if (e.estado === "presentada") {
      alertas.push({ id: `seguimiento-${e.codigo}`, prioridad: 2, titulo: "Solicitud presentada", detalle: "Revisa tus notificaciones y conserva el justificante.", codigo: e.codigo });
    }
  }
  return alertas.sort((a, b) => a.prioridad - b.prioridad).slice(0, 12);
}
