import type { Prestacion } from "./prestaciones";

export type EscenarioAsistente =
  | "pocos_recursos"
  | "estudiante"
  | "autonomo"
  | "profesional"
  | "trabajador"
  | "desempleo"
  | "vivienda"
  | "familia"
  | "general";

export interface MensajeAsistente {
  rol: "usuario" | "asistente";
  texto: string;
}

export interface RecursoAsistente {
  id: string;
  tipo: "via_directa" | "convocatoria";
  codigo?: string;
  titulo: string;
  organismo: string;
  resumen: string;
  requisitos: string[];
  plazo: string;
  urlInfo: string;
  urlSolicitud: string;
  accion: string;
}

function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

export function detectarEscenario(texto: string): EscenarioAsistente {
  const q = normalizar(texto);
  if (/no puedo pagar|pocos? recursos?|sin ingresos?|no llego|necesidad|vulnerab|exclusion|pobreza/.test(q)) {
    return "pocos_recursos";
  }
  if (/alquiler|desahuc|vivienda|hipoteca|alojamiento/.test(q)) return "vivienda";
  if (/estudiant|universidad|beca|bachiller|\bfp\b|estudiar/.test(q)) return "estudiante";
  if (/autonom|cuenta propia|freelance|negocio propio/.test(q)) return "autonomo";
  if (/profesional/.test(q)) return "profesional";
  if (/trabajador|cuenta ajena|asalariad|tengo trabajo|emplead/.test(q)) return "trabajador";
  if (/desemple|sin trabajo|paro|me han despedido/.test(q)) return "desempleo";
  if (/familia|hij[oa]|madre|padre|monoparental|numerosa/.test(q)) return "familia";
  return "general";
}

const CONSULTAS: Record<Exclude<EscenarioAsistente, "general">, string> = {
  pocos_recursos:
    "ingreso mínimo|renta|emergencia social|vulnerabilidad|necesidades básicas|bono social|alimentos",
  estudiante: "beca|ayudas al estudio|universidad|formación profesional|estudiantes",
  autonomo: "autónomos|autoempleo|cese de actividad|digitalización|contratación|emprendimiento",
  profesional: "formación|competencias profesionales|digitalización|empleo|emprendimiento",
  trabajador: "formación|conciliación|transporte|vivienda|personas trabajadoras",
  desempleo: "desempleo|parados|inserción laboral|empleabilidad|formación",
  vivienda: "alquiler|vivienda|alojamiento|desahucio|emergencia vivienda",
  familia: "familia|infancia|hijos|conciliación|comedor|libros",
};

export function consultaParaAsistente(texto: string): string {
  const escenario = detectarEscenario(texto);
  if (escenario !== "general") return CONSULTAS[escenario];
  return texto.replace(/[|\n\r]/g, " ").trim().slice(0, 240);
}

/**
 * Completa solo el perfil de búsqueda de esta respuesta. No se persiste ni se
 * convierte en un hecho sobre la persona: sirve para que una frase como “soy
 * estudiante” encuentre becas aunque todavía no haya terminado la ficha.
 */
export function hechosInferidosParaBuscar(
  originales: Map<string, string>,
  escenario: EscenarioAsistente,
): Map<string, string> {
  const hechos = new Map(originales);
  if (
    ["pocos_recursos", "estudiante", "trabajador", "desempleo", "vivienda", "familia"].includes(
      escenario,
    ) &&
    !hechos.has("perfil")
  ) {
    hechos.set("perfil", "particular");
  }
  if (escenario === "pocos_recursos") hechos.set("ingresos", "menos_12000");
  if (escenario === "estudiante") hechos.set("situacion", "estudiante");
  if (escenario === "autonomo") {
    hechos.set("perfil", "autonomo");
    hechos.set("situacion", "autonomo_activo");
  }
  if (escenario === "trabajador") hechos.set("situacion", "cuenta_ajena");
  if (escenario === "desempleo") hechos.set("situacion", "desempleado");
  return hechos;
}

const TERMINOS_DIRECTOS: Record<EscenarioAsistente, string[]> = {
  pocos_recursos: ["ingreso mínimo vital", "bono social", "renta", "alquiler"],
  estudiante: ["beca", "estudios"],
  autonomo: ["cese", "autónomo"],
  profesional: ["formación"],
  trabajador: ["bono social"],
  desempleo: ["paro", "subsidio", "desempleo"],
  vivienda: ["alquiler", "bono social"],
  familia: ["familia", "hijo", "infancia"],
  general: [],
};

export function terminosDirectosParaAsistente(texto: string): string[] {
  const escenario = detectarEscenario(texto);
  const propios = texto.trim().length >= 3 ? [texto.trim().slice(0, 240)] : [];
  return [...propios, ...TERMINOS_DIRECTOS[escenario]];
}

export function recursoDesdePrestacion(p: Prestacion): RecursoAsistente {
  return {
    id: p.id,
    tipo: "via_directa",
    titulo: p.titular,
    organismo: p.organismo,
    resumen: p.que,
    requisitos: p.requisitos,
    plazo: p.plazo,
    urlInfo: p.url,
    urlSolicitud: p.urlSolicitud,
    accion: p.accion,
  };
}

export function preguntasQueFaltan(
  hechos: Map<string, string>,
  escenario: EscenarioAsistente,
): string[] {
  const preguntas: string[] = [];
  if (escenario === "profesional" && !hechos.has("perfil")) {
    preguntas.push("¿Trabajas por cuenta propia, por cuenta ajena o tienes una empresa?");
  }
  if (!hechos.has("cp")) preguntas.push("¿Cuál es tu código postal?");
  if (
    ["pocos_recursos", "vivienda", "familia", "trabajador"].includes(escenario) &&
    !hechos.has("ingresos")
  ) {
    preguntas.push("¿En qué tramo están aproximadamente los ingresos anuales de tu hogar?");
  }
  if (escenario === "pocos_recursos" && !hechos.has("personas_hogar")) {
    preguntas.push("¿Cuántas personas vivís en casa?");
  }
  if (escenario === "autonomo" && !hechos.has("cnae_letras")) {
    preguntas.push("¿A qué se dedica tu actividad?");
  }
  if (escenario === "estudiante" && !hechos.has("tipo_estudios")) {
    preguntas.push("¿Qué estudias: Bachillerato, FP, universidad u otra enseñanza?");
  }
  return preguntas.slice(0, 2);
}

export function respuestaGuiada(
  escenario: EscenarioAsistente,
  recursos: RecursoAsistente[],
  preguntas: string[],
): string {
  const aclaracion =
    escenario === "profesional"
      ? "“Profesional” puede significar trabajar por cuenta propia o por cuenta ajena, y las ayudas cambian bastante. "
      : "";
  if (escenario === "profesional" && recursos.length === 0) {
    return `${aclaracion}Antes de buscar, necesito distinguirlo para no mezclar ayudas de empresas con ayudas personales. ${preguntas.join(" ")}`.trim();
  }
  if (recursos.length === 0) {
    return `${aclaracion}No he encontrado una ayuda que pueda recomendarte con suficiente seguridad todavía. ${preguntas.join(" ")}`.trim();
  }
  const tipo = recursos.length === 1 ? "una posible ayuda o vía oficial" : `${recursos.length} posibles ayudas y vías oficiales`;
  const siguiente = preguntas.length
    ? ` Para afinar y no enseñarte cosas que no te corresponden: ${preguntas.join(" ")}`
    : " Revisa los requisitos de cada tarjeta antes de solicitar; la fuente oficial es la que decide.";
  return `${aclaracion}He encontrado ${tipo}. Te las dejo con sus requisitos conocidos, plazo y acceso oficial.${siguiente}`;
}

const PATRON_PREGUNTA_NO_AUTORIZADA =
  /[¿?]|\bpara (?:poder )?afinar\b|\bnecesit(?:o|amos|aría|aríamos) (?:saber|conocer)\b|\b(?:nos|me) falt(?:a|aría)\b|\b(?:dime|cuéntame|indícame|confírmame)\b/i;

/**
 * La IA redacta la explicación, pero no decide qué datos pedir. Eliminamos
 * cualquier intento de seguimiento y añadimos únicamente las preguntas que
 * Encaja ha calculado de forma determinista a partir del perfil real.
 */
export function respuestaIaSegura(texto: string, preguntas: string[]): string {
  const limpio = texto
    .replace(/\*\*/g, "")
    .replace(/^#{1,6}\s*/gm, "")
    .replace(/\[([^\]]+)]\([^)]+\)/g, "$1")
    .trim();
  const explicacion = limpio
    .split(/\n{2,}|(?<=[.!?])\s+(?=[A-ZÁÉÍÓÚ¿])/)
    .map((parte) => parte.trim())
    .filter((parte) => parte && !PATRON_PREGUNTA_NO_AUTORIZADA.test(parte))
    .join(" ")
    .trim()
    .slice(0, 2_500);
  if (!explicacion) return "";
  const seguimiento = preguntas.length
    ? `\n\nPara afinar y no mezclar ayudas: ${preguntas.join(" ")}`
    : "";
  return `${explicacion}${seguimiento}`.slice(0, 3_000);
}

export function promptConversacional(args: {
  historial: MensajeAsistente[];
  perfil: string;
  recursos: RecursoAsistente[];
  preguntas: string[];
}): string {
  return `Eres el orientador de Encaja, una aplicación española de ayudas públicas.

Tu objetivo es escuchar a la persona, explicar en lenguaje muy sencillo qué opciones pueden servirle y qué dato falta para afinar.

REGLAS OBLIGATORIAS:
- Usa únicamente los recursos del CATÁLOGO RECUPERADO de esta petición. No inventes ayudas, cuantías, requisitos, plazos ni enlaces.
- Habla de "posible ayuda" hasta que se hayan comprobado todos los requisitos oficiales.
- Si una convocatoria está cerrada, dilo claramente y no invites a solicitarla ahora.
- Los botones y enlaces los dibuja la interfaz: no escribas URLs.
- No pidas DNI, cuenta bancaria, contraseña, clave API ni otros datos sensibles.
- Responde en español claro, cálido y directo, con un máximo de 130 palabras.
- Escribe texto plano: no uses Markdown, asteriscos, títulos ni enlaces.
- No hagas preguntas ni menciones datos que falten. La aplicación añadirá después, de forma segura, las preguntas necesarias.

PERFIL CONOCIDO: ${args.perfil}

CATÁLOGO RECUPERADO:
${JSON.stringify(args.recursos)}

CONVERSACIÓN:
${args.historial.map((m) => `${m.rol.toUpperCase()}: ${m.texto}`).join("\n")}

Escribe solo la respuesta para la persona.`;
}
