import type { Plazo } from "./tipos";

const DIA_MS = 24 * 60 * 60 * 1000;

function aFecha(iso: string): Date {
  return new Date(`${iso}T00:00:00`);
}

function diasEntre(desde: Date, hastaIso: string): number {
  const medianoche = new Date(desde.getFullYear(), desde.getMonth(), desde.getDate());
  return Math.round((aFecha(hastaIso).getTime() - medianoche.getTime()) / DIA_MS);
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
  const anioActual = String(hoy.getFullYear());
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
