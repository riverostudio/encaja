#!/usr/bin/env tsx

export {};

const base = (process.env.ENCAJA_URL ?? "https://usar-encaja.vercel.app").replace(/\/$/, "");

interface Recurso {
  id: string;
  titulo: string;
  urlInfo: string;
  urlSolicitud: string;
}

interface RespuestaChat {
  respuesta?: string;
  recursos?: Recurso[];
  preguntas?: string[];
  modo?: string;
  error?: string;
}

interface Caso {
  nombre: string;
  mensaje: string;
  incluye: string[];
  excluye?: string[];
  tituloProhibido?: RegExp;
  preguntaProhibida?: RegExp;
  sinRecursos?: boolean;
}

const casos: Caso[] = [
  {
    nombre: "persona despedida",
    mensaje: "Me han despedido y quiero saber qué ayuda por desempleo puedo pedir. Vivo en el 28013.",
    incluye: ["paro", "subsidio"],
  },
  {
    nombre: "madre monoparental",
    mensaje: "Soy madre soltera con dos hijos, pocos recursos y vivo en el 28013.",
    incluye: ["deduccion-ascendiente-dos-hijos", "imv"],
    excluye: ["deduccion-familia-numerosa"],
  },
  {
    nombre: "familia numerosa",
    mensaje:
      "Somos una familia numerosa con tres hijos, ingresamos 22.000 euros al año y vivimos en el 28013.",
    incluye: ["deduccion-familia-numerosa", "bono-social"],
    excluye: ["deduccion-ascendiente-dos-hijos"],
    tituloProhibido: /premio|centros? docentes? .{0,20} exterior|creación joven/i,
    preguntaProhibida: /ingresos/i,
  },
  {
    nombre: "emergencia de alquiler",
    mensaje: "No puedo pagar el alquiler este mes y vivo en el 28013.",
    incluye: ["emergencia-alquiler-madrid", "vivienda-especial-necesidad-madrid"],
    tituloProhibido: /Cuenca|Santiago de Compostela|estudiantes extranjeros/i,
  },
  {
    nombre: "estudiante con pocos recursos",
    mensaje: "Soy estudiante universitario, tengo pocos recursos y vivo en el 46001.",
    incluye: ["beca-mec", "imv"],
    tituloProhibido: /comedor de tus hijos|material escolar|centros? docentes? .{0,20} exterior/i,
  },
  {
    nombre: "autónomo en dificultad",
    mensaje: "Soy autónomo de diseño gráfico, estoy perdiendo clientes y vivo en el 46001.",
    incluye: ["cese-actividad", "formacion-fundae"],
    tituloProhibido: /subvención .{0,20} entidad|concesión directa .{0,30} sociedad|South Summit/i,
  },
  {
    nombre: "trabajador que busca formación",
    mensaje: "Trabajo por cuenta ajena y busco formación gratuita para mejorar. Vivo en el 28013.",
    incluye: ["formacion-fundae"],
    preguntaProhibida: /ingresos/i,
  },
  {
    nombre: "profesional ambiguo",
    mensaje: "Soy profesional y quiero saber qué ayudas puedo pedir.",
    incluye: [],
    sinRecursos: true,
  },
];

function asegurarEnlace(valor: string, caso: string, id: string): void {
  const url = new URL(valor);
  if (url.protocol !== "https:" || url.username || url.password || /[\s\\]/.test(valor)) {
    throw new Error(`${caso}: ${id} contiene un enlace no seguro: ${valor}`);
  }
}

async function evaluar(caso: Caso): Promise<void> {
  const respuesta = await fetch(`${base}/api/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-perfil": encodeURIComponent("{}"),
    },
    body: JSON.stringify({ mensajes: [{ rol: "usuario", texto: caso.mensaje }] }),
    signal: AbortSignal.timeout(30_000),
  });
  const datos = (await respuesta.json()) as RespuestaChat;
  if (!respuesta.ok) throw new Error(`${caso.nombre}: HTTP ${respuesta.status} ${datos.error ?? ""}`);
  const recursos = datos.recursos ?? [];
  const ids = recursos.map((r) => r.id);
  for (const id of caso.incluye) {
    if (!ids.includes(id)) throw new Error(`${caso.nombre}: falta ${id}; recibidos: ${ids.join(", ")}`);
  }
  for (const id of caso.excluye ?? []) {
    if (ids.includes(id)) throw new Error(`${caso.nombre}: apareció el recurso incompatible ${id}`);
  }
  if (caso.sinRecursos && recursos.length) {
    throw new Error(`${caso.nombre}: debía aclarar antes de mostrar recursos; recibió ${ids.join(", ")}`);
  }
  const titulos = recursos.map((r) => r.titulo).join(" | ");
  if (caso.tituloProhibido?.test(titulos)) {
    throw new Error(`${caso.nombre}: hay ruido no pertinente en «${titulos}»`);
  }
  const preguntas = (datos.preguntas ?? []).join(" ");
  if (caso.preguntaProhibida?.test(preguntas)) {
    throw new Error(`${caso.nombre}: repite una pregunta ya contestada o irrelevante: ${preguntas}`);
  }
  if (new Set(ids).size !== ids.length) throw new Error(`${caso.nombre}: hay recursos duplicados`);
  for (const recurso of recursos) {
    asegurarEnlace(recurso.urlInfo, caso.nombre, recurso.id);
    asegurarEnlace(recurso.urlSolicitud, caso.nombre, recurso.id);
  }
  if (/https?:\/\//i.test(datos.respuesta ?? "")) {
    throw new Error(`${caso.nombre}: el texto del asistente escribió una URL fuera de las tarjetas`);
  }
  console.log(`OK ${caso.nombre}: ${ids.length} recursos · ${datos.modo ?? "sin modo"}`);
}

async function main(): Promise<void> {
  console.log(`Evaluando orientador en ${base}`);
  for (const caso of casos) await evaluar(caso);
  console.log(`Orientador verificado: ${casos.length}/${casos.length} escenarios críticos.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
