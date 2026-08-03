// Extracción de requisitos de las bases reguladoras + motor de entrevista.
// Los prompts piden SIEMPRE el literal de las bases: el dictamen nunca se
// apoya en texto que no pueda enseñarse.
import type { Requisito, Veredicto } from "./tipos";

export const PROMPT_EXTRACCION = `Eres un técnico experto en subvenciones públicas españolas.
Lee las bases reguladoras adjuntas y extrae TODOS los requisitos que un
solicitante debe cumplir o aportar. Devuelve SOLO un JSON con esta forma:

{"requisitos":[{
  "id": "r1",
  "literal": "cita TEXTUAL exacta de las bases (frase completa)",
  "tipo": "dato" | "documento" | "condicion",
  "clave": "snake_case reutilizable (ej: tipo_actividad, num_empleados, al_corriente_hacienda, al_corriente_ss, antiguedad_alta_autonomo, municipio, facturacion_anual)",
  "pregunta": "pregunta clara en español para un no-experto",
  "respuestas": ["sí","no"]  // solo si es de sí/no
}]}

Reglas:
- "documento" = algo que hay que APORTAR (memoria, certificado, presupuesto…): sin clave ni pregunta.
- "dato"/"condicion" = algo que hay que SER o CUMPLIR: con clave y pregunta.
- Usa claves GENÉRICAS y reutilizables entre convocatorias.
- No inventes requisitos: si no está en el texto, no existe.
- Máximo 25 requisitos, los realmente exigidos al solicitante.`;

export const PROMPT_VEREDICTO = `Eres un técnico experto en subvenciones públicas españolas.
Te doy los requisitos de una convocatoria (con su cita literal) y los datos
declarados por el solicitante. Devuelve SOLO un JSON:

{"veredictos":[{
  "id": "id del requisito",
  "veredicto": "cumple" | "no_cumple" | "duda",
  "motivo": "explicación breve en español citando el dato del solicitante"
}]}

Reglas:
- "duda" cuando el dato no baste para decidir. NUNCA adivines.
- Los requisitos tipo "documento" no se evalúan aquí (van a la checklist).`;

function extraerJson(texto: string): unknown | null {
  const sinFences = texto.replace(/```json/gi, "```").split("```");
  const candidatos = sinFences.length > 1 ? [sinFences[1], texto] : [texto];
  for (const c of candidatos) {
    const ini = c.indexOf("{");
    const fin = c.lastIndexOf("}");
    if (ini === -1 || fin <= ini) continue;
    try {
      return JSON.parse(c.slice(ini, fin + 1));
    } catch {
      continue;
    }
  }
  return null;
}

/** Valida la respuesta del modelo. Ítems malformados se descartan en silencio. */
export function parsearRequisitos(jsonTexto: string): Requisito[] {
  const data = extraerJson(jsonTexto) as { requisitos?: unknown[] } | null;
  if (!data?.requisitos || !Array.isArray(data.requisitos)) return [];
  const vistos = new Set<string>();
  const salida: Requisito[] = [];
  for (const cru of data.requisitos) {
    const r = cru as Partial<Requisito>;
    if (!r.id || !r.literal || typeof r.literal !== "string") continue;
    if (r.tipo !== "dato" && r.tipo !== "documento" && r.tipo !== "condicion") continue;
    if (vistos.has(r.id)) continue;
    vistos.add(r.id);
    salida.push({
      id: String(r.id),
      literal: r.literal.trim(),
      tipo: r.tipo,
      clave: r.clave ? String(r.clave) : undefined,
      pregunta: r.pregunta ? String(r.pregunta) : undefined,
      respuestas: Array.isArray(r.respuestas) ? r.respuestas.map(String) : undefined,
    });
  }
  return salida;
}

export function parsearVeredictos(jsonTexto: string): Veredicto[] {
  const data = extraerJson(jsonTexto) as { veredictos?: unknown[] } | null;
  if (!data?.veredictos || !Array.isArray(data.veredictos)) return [];
  const salida: Veredicto[] = [];
  for (const cru of data.veredictos) {
    const v = cru as Partial<Veredicto>;
    if (!v.id || !v.motivo) continue;
    if (v.veredicto !== "cumple" && v.veredicto !== "no_cumple" && v.veredicto !== "duda") continue;
    salida.push({ id: String(v.id), veredicto: v.veredicto, motivo: String(v.motivo) });
  }
  return salida;
}

/**
 * Siguiente pregunta de la entrevista: primer requisito dato/condición cuya
 * clave no esté ya en la ficha. Los "documento" no preguntan (checklist).
 */
export function siguientePregunta(
  requisitos: Requisito[],
  hechos: Map<string, string>,
): Requisito | null {
  for (const r of requisitos) {
    if (r.tipo === "documento") continue;
    if (!r.clave || !r.pregunta) continue;
    if (!hechos.has(r.clave)) return r;
  }
  return null;
}
