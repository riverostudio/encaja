// Extracción de requisitos de las bases reguladoras + motor de entrevista.
// Los prompts piden SIEMPRE el literal de las bases: el dictamen nunca se
// apoya en texto que no pueda enseñarse.
import type { Requisito, ResumenIA, Veredicto } from "./tipos";

export const PROMPT_RESUMEN = `Eres quien traduce el BOE a lenguaje de la calle.
Te doy el título oficial y los datos de una convocatoria de ayuda pública española.
Explícasela a alguien SIN formación jurídica ni económica: un autónomo con prisa.

Devuelve SOLO un JSON:
{
 "titular": "de qué va, en menos de 9 palabras, sin jerga",
 "que": "1-2 frases: qué es esto y para qué sirve el dinero",
 "consigues": "1 frase: qué te llevas exactamente (dinero que no se devuelve, préstamo, aval, menos impuestos…) y de cuánto se habla",
 "aQuien": "1 frase: a quién va dirigida, en cristiano",
 "ojo": "opcional, 1 frase: la trampa o el requisito que más gente incumple"
}

Reglas:
- Prohibido copiar la jerga del título. Nada de "concurrencia competitiva",
  "bases reguladoras" ni "en el marco del programa operativo".
- Tutea. Frases cortas. Cero adjetivos de folleto.
- No inventes cifras ni plazos: si no te los doy, no los menciones.
- Si el presupuesto es la bolsa total del programa, dilo así, no como si fuera para uno.`;

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
- "documento" = algo que hay que APORTAR o FIRMAR al solicitar: memoria,
  certificado, presupuesto, y también las **declaraciones responsables y los
  compromisos** ("declaro aceptar las bases", "me comprometo a mantener los
  requisitos", "autorizo la consulta de mis datos"). Sin clave ni pregunta:
  no deciden si alguien puede pedirla, se firman y ya está.
- "dato"/"condicion" = algo que hay que SER o CUMPLIR **antes de solicitar** y
  que de verdad decide si encajas: con clave y pregunta.
- Nunca marques como "condicion" algo que ocurre DESPUÉS de que te la concedan
  (justificar, mantener la actividad, presentar memoria final): eso es
  "documento" o no lo incluyas.
- Usa claves GENÉRICAS y reutilizables entre convocatorias.
- No inventes requisitos: si no está en el texto, no existe.
- **Máximo 8 requisitos CON pregunta**, y que sean los que de verdad deciden
  si alguien puede pedirla o no. El resto, si los incluyes, sin pregunta.
- Formula una pregunta reutilizable para cada condición comprobable. La app
  omitirá automáticamente las que ya conozca del perfil.
- Nada de preguntas obvias ni de trámite ("¿va a presentar la solicitud?").
- **No extraigas cláusulas paraguas** del tipo "cumplir todos los requisitos
  exigidos", "reunir las condiciones a la fecha de fin de plazo" o "no estar
  incurso en las prohibiciones del art. 13": no son requisitos concretos, no
  se pueden comprobar y solo ensucian el dictamen. Extrae los requisitos
  CONCRETOS que esas cláusulas resumen.`;

/** Lo que ya sabemos, para que la IA no lo vuelva a preguntar. */
export function bloqueLoQueYaSe(hechos: Map<string, string>): string {
  if (hechos.size === 0) return "No sé nada todavía del solicitante.";
  const lineas = [...hechos.entries()]
    .filter(([k]) => !k.startsWith("_"))
    .map(([k, v]) => `- ${k}: ${v}`);
  return `YA SÉ ESTO DEL SOLICITANTE (no lo preguntes otra vez):\n${lineas.join("\n")}`;
}

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
- Los requisitos tipo "documento" no se evalúan aquí (van a la checklist).
- Devuelve EXACTAMENTE un veredicto por cada requisito recibido. Conserva su id
  literalmente y no omitas ninguno.`;

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

/** Valida el resumen de la IA. Si le falta lo esencial, se descarta entero. */
export function parsearResumen(jsonTexto: string): ResumenIA | null {
  const d = extraerJson(jsonTexto) as Partial<ResumenIA> | null;
  if (!d?.titular || !d.que || !d.consigues) return null;
  return {
    titular: String(d.titular).trim(),
    que: String(d.que).trim(),
    consigues: String(d.consigues).trim(),
    aQuien: d.aQuien ? String(d.aQuien).trim() : "",
    ojo: d.ojo ? String(d.ojo).trim() : undefined,
  };
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
  return preguntables(requisitos, hechos)[0] ?? null;
}

/** Tope duro: nadie contesta 21 preguntas, por muy bien extraídas que estén. */
export const MAX_PREGUNTAS = 8;

/** Los requisitos que el flujo puede preguntar y, por tanto, dictaminar. */
export function requisitosEvaluables(requisitos: Requisito[]): Requisito[] {
  return requisitos
    .filter((r) => r.tipo !== "documento" && Boolean(r.clave) && Boolean(r.pregunta))
    .slice(0, MAX_PREGUNTAS);
}

/**
 * Cierra una respuesta parcial del modelo con dudas explícitas. Solo se usa
 * después de reintentar los ids omitidos: un dictamen final nunca debe volver
 * a la pantalla contradictoria de «entrevista sin terminar».
 */
export function completarVeredictos(
  requisitos: Requisito[],
  veredictos: Veredicto[],
): Veredicto[] {
  const evaluables = requisitosEvaluables(requisitos);
  const ids = new Set(evaluables.map((r) => r.id));
  const porId = new Map<string, Veredicto>();
  for (const veredicto of veredictos) {
    if (ids.has(veredicto.id) && !porId.has(veredicto.id)) porId.set(veredicto.id, veredicto);
  }
  for (const requisito of evaluables) {
    if (!porId.has(requisito.id)) {
      porId.set(requisito.id, {
        id: requisito.id,
        veredicto: "duda",
        motivo: "No he podido confirmar automáticamente este requisito con tus respuestas; compruébalo en las bases.",
      });
    }
  }
  return evaluables.map((requisito) => porId.get(requisito.id)!);
}

/**
 * Las preguntas que quedan por hacer, ya recortadas. El tope se aplica aquí
 * y no solo en el prompt, para no depender de que la IA obedezca.
 */
export function preguntables(
  requisitos: Requisito[],
  hechos: Map<string, string>,
): Requisito[] {
  // El recorte se hace ANTES de descartar las respondidas: si no, cada
  // respuesta destaparía una nueva y la entrevista no acabaría nunca.
  return requisitosEvaluables(requisitos)
    .filter((r) => !hechos.has(r.clave!));
}
