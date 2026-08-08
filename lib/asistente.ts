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

const PATRONES_ESCENARIO: Array<{
  escenario: Exclude<EscenarioAsistente, "general">;
  patron: RegExp;
}> = [
  // Lo concreto manda sobre lo genérico. Así, «estudiante con pocos
  // recursos» conserva las becas y «trabajador despedido» busca desempleo.
  { escenario: "vivienda", patron: /alquiler|desahuc|vivienda|hipoteca|alojamiento/ },
  { escenario: "estudiante", patron: /estudiant|universidad|universitari|beca|bachiller|\bfp\b|estudiar/ },
  { escenario: "autonomo", patron: /autonom|cuenta propia|freelance|negocio propio/ },
  { escenario: "desempleo", patron: /desemple|sin trabajo|\bparo\b|me han despedido|despedid[oa]|he perdido (?:mi|el) trabajo/ },
  { escenario: "familia", patron: /familia|hij[oa]|madre|padre|monoparental|numerosa/ },
  { escenario: "trabajador", patron: /trabajador|cuenta ajena|asalariad|tengo trabajo|emplead/ },
  { escenario: "profesional", patron: /profesional/ },
  { escenario: "pocos_recursos", patron: /no puedo pagar|pocos? recursos?|sin ingresos?|no llego|necesidad|vulnerab|exclusion|pobreza/ },
];

/** Detecta todas las necesidades expresadas, de más concreta a más general. */
export function detectarEscenarios(texto: string): EscenarioAsistente[] {
  const q = normalizar(texto);
  const detectados = PATRONES_ESCENARIO.filter(({ patron }) => patron.test(q)).map(
    ({ escenario }) => escenario,
  );
  return detectados.length ? detectados : ["general"];
}

export function detectarEscenario(texto: string): EscenarioAsistente {
  return detectarEscenarios(texto)[0];
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
  const escenarios = detectarEscenarios(texto).filter((e) => e !== "general");
  if (escenarios.length) {
    return escenarios.map((e) => CONSULTAS[e]).join("|");
  }
  return texto.replace(/[|\n\r]/g, " ").trim().slice(0, 240);
}

function anadirValor(hechos: Map<string, string>, clave: string, valor: string): void {
  const actuales = (hechos.get(clave) ?? "").split(",").filter(Boolean);
  if (!actuales.includes(valor)) hechos.set(clave, [...actuales, valor].join(","));
}

function tramoIngresosExplicito(texto: string): string | null {
  const q = normalizar(texto).replace(/\s+/g, " ");
  const match = q.match(
    /(?:ingres(?:o|os)|gan(?:o|amos|an)|cobr(?:o|amos|an)|entran?|renta)?[^\d]{0,24}(\d{1,3}(?:[.\s]\d{3})+|\d{4,6})(?:[,.]\d{1,2})?\s*(?:€|euros?)(?:\s*(?:al|por)\s+ano)?/,
  );
  if (!match) return null;
  const cantidad = Number(match[1].replace(/[.\s]/g, ""));
  if (!Number.isFinite(cantidad)) return null;
  if (cantidad < 12_000) return "menos_12000";
  if (cantidad < 18_000) return "12000_18000";
  if (cantidad < 25_000) return "18000_25000";
  if (cantidad < 40_000) return "25000_40000";
  return "mas_40000";
}

function numeroHijosExplicito(texto: string): string | null {
  const q = normalizar(texto);
  const match = q.match(/\b(un|una|1|dos|2|tres|3|cuatro|4|cinco|5|seis|6)\s+hij[oa]s?\b/);
  if (!match) return null;
  const n = { un: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6 }[
    match[1]
  ] ?? Number(match[1]);
  return n >= 3 ? "3+" : String(n);
}

function personasHogarExplicitas(texto: string): string | null {
  const q = normalizar(texto);
  const match = q.match(
    /\b(?:somos|vivimos|viven)\s+(una|1|dos|2|tres|3|cuatro|4|cinco|5|seis|6)(?:\s+personas?)?(?:\s+en casa)?\b/,
  );
  if (!match) return null;
  const n = { una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6 }[match[1]] ?? Number(match[1]);
  return n >= 5 ? "5+" : String(n);
}

/**
 * Completa solo el perfil de búsqueda de esta respuesta. No se persiste ni se
 * convierte en un hecho sobre la persona: sirve para que una frase como “soy
 * estudiante” encuentre becas aunque todavía no haya terminado la ficha.
 */
export function hechosInferidosParaBuscar(
  originales: Map<string, string>,
  escenario: EscenarioAsistente,
  mensajeActual = "",
): Map<string, string> {
  const hechos = new Map(originales);
  const q = normalizar(mensajeActual);
  const escenarios = new Set(detectarEscenarios(mensajeActual));
  escenarios.add(escenario);
  const cpEscrito = mensajeActual.match(/\b((?:0[1-9]|[1-4]\d|5[0-2])\d{3})\b/)?.[1];
  if (cpEscrito) hechos.set("cp", cpEscrito);
  if (
    [...escenarios].some((e) =>
      ["pocos_recursos", "estudiante", "trabajador", "desempleo", "vivienda", "familia"].includes(e),
    ) &&
    !hechos.has("perfil")
  ) {
    hechos.set("perfil", "particular");
  }
  // «Pocos recursos» nunca se transforma en una cifra inventada. Solo se usa
  // un tramo cuando la persona ha escrito una cantidad de forma explícita.
  const ingresos = tramoIngresosExplicito(mensajeActual);
  if (ingresos) hechos.set("ingresos", ingresos);
  const menores = numeroHijosExplicito(mensajeActual);
  if (menores) hechos.set("menores_cargo", menores);
  const personasHogar = personasHogarExplicitas(mensajeActual);
  if (personasHogar) hechos.set("personas_hogar", personasHogar);
  if (/familia numerosa|madre numerosa|padre numeroso/.test(q)) {
    anadirValor(hechos, "circunstancias", "familia_numerosa");
  }
  if (/monoparental|madre soltera|padre soltero|madre sola|padre solo/.test(q)) {
    anadirValor(hechos, "circunstancias", "monoparental");
  }
  if (escenarios.has("vivienda")) anadirValor(hechos, "objetivo", "vivienda");
  if (escenarios.has("familia")) anadirValor(hechos, "objetivo", "familia");
  if (escenarios.has("estudiante") || /formacion|formarme|curso/.test(q)) {
    anadirValor(hechos, "objetivo", "aprender");
  }
  if (escenarios.has("estudiante")) hechos.set("situacion", "estudiante");
  if (escenarios.has("autonomo")) {
    hechos.set("perfil", "autonomo");
    hechos.set("situacion", "autonomo_activo");
  }
  if (escenarios.has("trabajador") && !escenarios.has("desempleo")) {
    hechos.set("situacion", "cuenta_ajena");
  }
  if (escenarios.has("desempleo")) hechos.set("situacion", "desempleado");
  return hechos;
}

const TERMINOS_DIRECTOS: Record<EscenarioAsistente, string[]> = {
  pocos_recursos: ["ingreso mínimo vital", "bono social", "renta", "alquiler"],
  estudiante: ["beca", "estudios"],
  autonomo: ["cese", "autónomo"],
  profesional: ["formación"],
  trabajador: ["formación gratuita", "cursos trabajadores"],
  desempleo: ["paro", "subsidio", "desempleo"],
  vivienda: ["alquiler", "bono social"],
  familia: ["familia", "hijo", "infancia", "bono social", "ingreso mínimo vital"],
  general: [],
};

export function terminosDirectosParaAsistente(texto: string): string[] {
  const propios = texto.trim().length >= 3 ? [texto.trim().slice(0, 240)] : [];
  const guiados = detectarEscenarios(texto).flatMap((escenario) => TERMINOS_DIRECTOS[escenario]);
  return [...new Set([...propios, ...guiados])];
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
  mensajeActual = "",
): string[] {
  const q = normalizar(mensajeActual);
  const preguntas: string[] = [];
  if (escenario === "profesional" && profesionalNecesitaAclaracion(hechos, mensajeActual)) {
    preguntas.push("¿Trabajas por cuenta propia, por cuenta ajena o tienes una empresa?");
  }
  if (!hechos.has("cp") && !/\b(?:0[1-9]|[1-4]\d|5[0-2])\d{3}\b/.test(q)) {
    preguntas.push("¿Cuál es tu código postal?");
  }
  if (
    ["pocos_recursos", "vivienda", "familia"].includes(escenario) &&
    !hechos.has("ingresos")
  ) {
    preguntas.push("¿En qué tramo están aproximadamente los ingresos anuales de tu hogar?");
  }
  if (escenario === "pocos_recursos" && !hechos.has("personas_hogar")) {
    preguntas.push("¿Cuántas personas vivís en casa?");
  }
  const actividadDescrita =
    /\bautonom\w*\s+de\s+\w+|\bme dedico a\b|\bmi actividad (?:es|consiste)\b|\btengo (?:un|una) (?:taller|tienda|bar|restaurante|consulta|despacho|agencia|estudio)\b/.test(
      q,
    );
  if (escenario === "autonomo" && !hechos.has("cnae_letras") && !actividadDescrita) {
    preguntas.push("¿A qué se dedica tu actividad?");
  }
  if (
    escenario === "estudiante" &&
    !hechos.has("tipo_estudios") &&
    !/bachiller|universidad|universitari|\bfp\b|formacion profesional|otra ensenanza/.test(q)
  ) {
    preguntas.push("¿Qué estudias: Bachillerato, FP, universidad u otra enseñanza?");
  }
  return preguntas.slice(0, 2);
}

export function profesionalNecesitaAclaracion(
  hechos: Map<string, string>,
  mensajeActual = "",
): boolean {
  const q = normalizar(mensajeActual);
  if (/cuenta propia|autonom|freelance|cuenta ajena|asalariad|emplead|tengo una empresa/.test(q)) {
    return false;
  }
  return !(
    ["autonomo", "empresa"].includes(hechos.get("perfil") ?? "") ||
    ["autonomo_activo", "cuenta_ajena"].includes(hechos.get("situacion") ?? "")
  );
}

export function convocatoriaRelevanteParaEscenario(
  texto: string,
  escenario: EscenarioAsistente,
): boolean {
  return puntuarConvocatoriaParaEscenario(texto, [escenario]) > 0;
}

const PATRONES_RELEVANCIA: Partial<Record<EscenarioAsistente, RegExp>> = {
  autonomo: /autonom|autoemple|emprend|pyme|negocio|actividad economica|empresa/,
  estudiante: /estudiant|universit|beca|estudio|bachiller|formacion profesional|doctorad|tesis|practicas/,
  trabajador: /concili|\btrabajador|\bemplead|\basalariad|\bcuenta ajena|formacion profesional para el empleo|formacion subvencionada|curso gratuito|transporte.{0,30}laboral|laboral.{0,30}transporte/,
  pocos_recursos: /vulnerab|exclusion|pobreza|emergencia|renta|ingreso|alquiler|vivienda|necesidad|familia|infancia|comedor|alimento/,
  desempleo: /desemple|parad[oa]|sin trabajo|insercion laboral|empleabilidad/,
  vivienda: /alquiler|vivienda|alojamiento|desahuc|hipoteca/,
  familia: /familia|infancia|hij[oa]|concili|comedor|libros/,
};

/**
 * Prioriza convocatorias útiles y penaliza el ruido típico de la BDNS. Las
 * subvenciones nominativas y los premios no son una vía abierta para alguien
 * que llega buscando una necesidad crítica.
 */
export function puntuarConvocatoriaParaEscenario(
  texto: string,
  escenarios: EscenarioAsistente[],
  mensajeActual = "",
): number {
  const q = normalizar(texto);
  const peticion = normalizar(mensajeActual);
  if (
    /subvencion nominativa|concesion directa (?:a|al)|subvencion (?:directa )?a la entidad|subvencion (?:directa )?a (?:la )?(?:fundacion|asociacion|sociedad|federacion)|aportacion nominativa/.test(
      q,
    )
  ) {
    return -500;
  }
  if (/\bpremios?\b/.test(q) && !/\bpremios?\b|concurso/.test(peticion)) return -300;
  if (
    /centros? docentes? (?:espanoles? )?en el exterior|centros? docentes? en el exterior|creacion joven/.test(
      q,
    ) &&
    !/exterior|creacion/.test(peticion)
  ) {
    return -250;
  }

  let puntuacion = 0;
  for (const [indice, escenario] of escenarios.entries()) {
    if (escenario === "general" || escenario === "profesional") continue;
    const esSoloOtroPerfil =
      /desemple|parad[oa]|sin trabajo|estudiant|universit|doctorad|beca/.test(q) &&
      !/\btrabajador|\bemplead|\basalariad|\bcuenta ajena/.test(q);
    if (escenario === "trabajador" && esSoloOtroPerfil) continue;
    if (PATRONES_RELEVANCIA[escenario]?.test(q)) puntuacion += Math.max(20, 100 - indice * 15);
  }
  return puntuacion;
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

/**
 * La IA no redacta hechos: solo ordena IDs que Encaja ya recuperó y validó.
 * El resultado visible (títulos, requisitos, plazos y enlaces) siempre sale
 * del catálogo oficial, nunca del texto libre del modelo.
 */
export function promptRankingRecursos(args: {
  mensaje: string;
  perfil: string;
  recursos: RecursoAsistente[];
}): string {
  const catalogo = args.recursos.map((r) => ({
    id: r.id,
    titulo: r.titulo,
    organismo: r.organismo,
    resumen: r.resumen,
    requisitos: r.requisitos,
    plazo: r.plazo,
  }));
  return `OBJETIVO
Ordena las opciones recuperadas por Encaja según su utilidad probable para la necesidad expresada.

CRITERIOS DE ÉXITO
- Devuelve solo IDs existentes en CATÁLOGO, sin inventar ni modificar ninguno.
- Prioriza primero prestaciones o vías directas y después convocatorias claramente relacionadas.
- No decidas que la persona cumple requisitos: faltan comprobaciones oficiales.
- No deduzcas ingresos, convivencia, cotizaciones, edad, discapacidad ni ninguna circunstancia no escrita.
- No crees explicaciones, requisitos, cuantías, fechas, enlaces ni nombres de ayudas.
- Si una opción no guarda relación clara, omítela.
- Máximo 5 IDs, sin duplicados.

SALIDA JSON EXACTA
{"ids":["id-existente"]}

NECESIDAD ESCRITA: ${JSON.stringify(args.mensaje)}
PERFIL CONOCIDO: ${JSON.stringify(args.perfil)}
CATÁLOGO: ${JSON.stringify(catalogo)}`;
}

function extraerObjetoJson(texto: string): unknown {
  const limpio = texto.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  const inicio = limpio.indexOf("{");
  const fin = limpio.lastIndexOf("}");
  if (inicio < 0 || fin <= inicio) return null;
  try {
    return JSON.parse(limpio.slice(inicio, fin + 1));
  } catch {
    return null;
  }
}

/** Rechaza IDs inventados, duplicados y cualquier forma distinta del JSON esperado. */
export function parsearRankingRecursos(
  texto: string,
  recursos: RecursoAsistente[],
): string[] {
  const dato = extraerObjetoJson(texto);
  if (!dato || typeof dato !== "object" || !Array.isArray((dato as { ids?: unknown }).ids)) {
    return [];
  }
  const permitidos = new Set(recursos.map((r) => r.id));
  return [
    ...new Set(
      (dato as { ids: unknown[] }).ids.filter(
        (id): id is string => typeof id === "string" && permitidos.has(id),
      ),
    ),
  ].slice(0, 5);
}

export function ordenarRecursosPorRanking(
  recursos: RecursoAsistente[],
  ids: string[],
): RecursoAsistente[] {
  if (!ids.length) return recursos;
  const posicion = new Map(ids.map((id, indice) => [id, indice]));
  return recursos
    .map((recurso, indice) => ({ recurso, indice }))
    .sort((a, b) => {
      const pa = posicion.get(a.recurso.id);
      const pb = posicion.get(b.recurso.id);
      if (pa != null && pb != null) return pa - pb;
      if (pa != null) return -1;
      if (pb != null) return 1;
      return a.indice - b.indice;
    })
    .map(({ recurso }) => recurso);
}
