// Rescate de plazos: el 39 % de las convocatorias no publica fechas en la
// BDNS aunque sí estén en el PDF de las bases. Aquí se le pide a la IA que
// las saque — y se valida a conciencia, porque una fecha inventada haría
// que alguien se confiara y perdiera el plazo.

export const PROMPT_FECHAS = `Lee las bases adjuntas y busca ÚNICAMENTE el plazo
de presentación de solicitudes.

Devuelve SOLO este JSON:
{"inicio":"YYYY-MM-DD o null","fin":"YYYY-MM-DD o null","relativo":"la regla del plazo si no hay fechas concretas, o null","literal":"la frase exacta de las bases"}

Reglas estrictas:
- Si el plazo no aparece de forma inequívoca, devuelve null en ambas. NO deduzcas.
- No confundas con la fecha del decreto, la de publicación ni la de justificación:
  solo el plazo para PRESENTAR la solicitud.
- Si dice algo como "un mes desde la publicación" sin fecha concreta, deja inicio y
  fin en null y escribe esa regla en "relativo" tal cual la dicen. NO la calcules tú.
- "literal" debe ser texto copiado de las bases, no un resumen tuyo.`;

export interface FechasRescatadas {
  inicio: string | null;
  fin: string | null;
  /** "un mes desde la publicación en el DOE": la regla, sin calcularla. */
  relativo: string | null;
  literal: string;
}

function esFechaIso(v: unknown): v is string {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const d = new Date(`${v}T00:00:00`);
  if (Number.isNaN(d.getTime())) return false;
  // Fuera de este rango es que la IA ha leído mal algo.
  const anio = Number(v.slice(0, 4));
  return anio >= 2000 && anio <= 2100;
}

/**
 * Valida lo que devuelve la IA. Ante la mínima duda, null: es preferible
 * seguir diciendo "sin fechas" que dar un plazo falso.
 */
export function parsearFechas(jsonTexto: string): FechasRescatadas | null {
  const ini = jsonTexto.indexOf("{");
  const fin = jsonTexto.lastIndexOf("}");
  if (ini === -1 || fin <= ini) return null;

  let d: Partial<FechasRescatadas>;
  try {
    d = JSON.parse(jsonTexto.slice(ini, fin + 1)) as Partial<FechasRescatadas>;
  } catch {
    return null;
  }

  const inicio = esFechaIso(d.inicio) ? d.inicio : null;
  const finFecha = esFechaIso(d.fin) ? d.fin : null;
  const relativo =
    typeof d.relativo === "string" && d.relativo.trim().length > 8 ? d.relativo.trim() : null;
  // Sin fechas y sin regla, no hay nada que contar.
  if (!inicio && !finFecha && !relativo) return null;
  // Un plazo que termina antes de empezar es un error de lectura.
  if (inicio && finFecha && finFecha < inicio) return null;
  // Sin la cita literal no hay forma de comprobarlo: no vale.
  if (!d.literal || String(d.literal).trim().length < 10) return null;

  return { inicio, fin: finFecha, relativo, literal: String(d.literal).trim() };
}
