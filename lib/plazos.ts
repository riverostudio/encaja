import type { Plazo } from "./tipos";

const DIA_MS = 24 * 60 * 60 * 1000;

function aFecha(iso: string): Date {
  return new Date(`${iso}T00:00:00`);
}

function diasEntre(desde: Date, hastaIso: string): number {
  const medianoche = new Date(desde.getFullYear(), desde.getMonth(), desde.getDate());
  return Math.round((aFecha(hastaIso).getTime() - medianoche.getTime()) / DIA_MS);
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
