import type { Plazo } from "./tipos";

const DIA_MS = 24 * 60 * 60 * 1000;
const ZONA_HORARIA = "Europe/Madrid";

export function fechaCalendarioMadrid(fecha: Date): string {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: ZONA_HORARIA,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(fecha);
  const valor = (tipo: Intl.DateTimeFormatPartTypes) =>
    partes.find((parte) => parte.type === tipo)?.value ?? "";
  return `${valor("year")}-${valor("month")}-${valor("day")}`;
}

function diasEntre(desde: Date, hastaIso: string): number {
  const comoUtc = (iso: string) => {
    const [anio, mes, dia] = iso.split("-").map(Number);
    return Date.UTC(anio, mes - 1, dia);
  };
  return Math.round((comoUtc(hastaIso) - comoUtc(fechaCalendarioMadrid(desde))) / DIA_MS);
}

const MESES = [
  "ene",
  "feb",
  "mar",
  "abr",
  "may",
  "jun",
  "jul",
  "ago",
  "sep",
  "oct",
  "nov",
  "dic",
];

function dia(iso: string, conAnio: boolean): string {
  const [a, m, d] = iso.split("-");
  const texto = `${Number(d)} ${MESES[Number(m) - 1]}`;
  return conAnio ? `${texto} ${a}` : texto;
}

/**
 * El plazo en fechas de calendario, que es lo que de verdad hace falta
 * saber. El año solo aparece cuando no es el corriente, para no ensuciar.
 */
export function formatoRango(
  inicio: string | null | undefined,
  fin: string | null | undefined,
  hoy: Date = new Date(),
): string {
  if (!inicio && !fin) return "sin fechas";
  const anioActual = fechaCalendarioMadrid(hoy).slice(0, 4);
  const otroAnio = [inicio, fin].some((f) => f && f.slice(0, 4) !== anioActual);

  if (inicio && fin) {
    if (inicio === fin) return `solo el ${dia(fin, otroAnio)}`;
    return `${dia(inicio, otroAnio)} — ${dia(fin, otroAnio)}`;
  }
  if (fin) return `hasta el ${dia(fin, otroAnio)}`;
  return `desde el ${dia(inicio!, otroAnio)}`;
}

/**
 * Semáforo de plazos de una convocatoria. Fechas ISO YYYY-MM-DD.
 * El día de fin es inclusive (se puede presentar ese día).
 */
export function estadoPlazo(
  inicio: string | null | undefined,
  fin: string | null | undefined,
  hoy: Date = new Date(),
): Plazo {
  if (!inicio && !fin) return { estado: "sin_fechas", dias: null };

  if (inicio && diasEntre(hoy, inicio) > 0) {
    return { estado: "proxima", dias: diasEntre(hoy, inicio) };
  }

  if (!fin) return { estado: "abierta", dias: null };

  const dias = diasEntre(hoy, fin);
  if (dias < 0) return { estado: "cerrada", dias };
  if (dias <= 7) return { estado: "urgente", dias };
  if (dias <= 21) return { estado: "aviso", dias };
  return { estado: "abierta", dias };
}
