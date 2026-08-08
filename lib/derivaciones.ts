import type { EscenarioAsistente, RecursoAsistente } from "./asistente";

/**
 * Vías humanas oficiales para necesidades que no siempre son una subvención
 * de la BDNS. No se muestran como una concesión ni como un derecho ya
 * reconocido: sirven para llegar al servicio público que valora el caso.
 */
export interface DerivacionOficial {
  id: string;
  escenarios: EscenarioAsistente[];
  titulo: string;
  organismo: string;
  resumen: string;
  pasos: string[];
  url: string;
  accion: string;
  urgente?: boolean;
}

export const DERIVACIONES_OFICIALES: DerivacionOficial[] = [
  {
    id: "orientacion-060",
    escenarios: ["general", "pocos_recursos", "alimentacion", "mayores", "extutelado"],
    titulo: "Orientación de la Administración: teléfono 060 y oficinas",
    organismo: "Punto de Acceso General · Gobierno de España",
    resumen:
      "Ayuda humana para localizar el organismo, el trámite o la oficina pública que corresponde a tu caso.",
    pasos: [
      "Explica tu necesidad y tu municipio; no hace falta conocer el nombre de la ayuda.",
      "Pide que te indiquen el organismo competente y el trámite oficial.",
      "Para una emergencia social, pide también el contacto de Servicios Sociales de tu ayuntamiento.",
    ],
    url: "https://administracion.gob.es/pag_Home/es/contacto/telefono-060.html",
    accion: "Ver atención 060 y oficinas",
  },
  {
    id: "violencia-016",
    escenarios: ["violencia_genero"],
    titulo: "Atención inmediata y confidencial 016",
    organismo: "Ministerio de Igualdad · Delegación del Gobierno contra la Violencia de Género",
    resumen:
      "Información, asesoramiento jurídico y atención psicosocial inmediata por teléfono, WhatsApp, chat y correo.",
    pasos: [
      "Si hay peligro inmediato, llama al 112.",
      "Para orientación confidencial, llama al 016 o usa el canal accesible que figura en la página oficial.",
      "El personal puede derivarte a recursos cercanos y explicar tus derechos.",
    ],
    url: "https://violenciagenero.igualdad.gob.es/informacion-3/recursos/telefono016/",
    accion: "Abrir los canales oficiales del 016",
    urgente: true,
  },
  {
    id: "dependencia-saad",
    escenarios: ["dependencia", "mayores", "discapacidad"],
    titulo: "Valoración de dependencia y prestaciones del SAAD",
    organismo: "Imserso · Sistema para la Autonomía y Atención a la Dependencia",
    resumen:
      "La comunidad autónoma valora el grado de dependencia y, si procede, acuerda servicios o prestaciones mediante el programa individual de atención.",
    pasos: [
      "Solicita la valoración ante el órgano de dependencia de tu comunidad autónoma.",
      "Prepara identidad, empadronamiento e informes de salud; la lista exacta depende de tu comunidad.",
      "No confundas dependencia con discapacidad: son procedimientos distintos y pueden tramitarse ambos.",
    ],
    url: "https://imserso.es/es/autonomia-personal-dependencia/sistema-autonomia-atencion-dependencia-saad/preguntas-frecuentes/conceptos-generales",
    accion: "Entender el sistema y pedir orientación",
  },
  {
    id: "grado-discapacidad",
    escenarios: ["discapacidad"],
    titulo: "Reconocimiento del grado de discapacidad",
    organismo: "Imserso · órgano competente de tu comunidad autónoma",
    resumen:
      "Procedimiento para valorar y reconocer oficialmente un grado de discapacidad. La solicitud se presenta en la comunidad autónoma de residencia, salvo Ceuta y Melilla.",
    pasos: [
      "Busca el órgano de valoración de discapacidad de tu comunidad autónoma.",
      "Prepara la solicitud, documento de identidad e informes médicos o psicológicos actualizados.",
      "Comprueba en el formulario autonómico si piden documentos adicionales.",
    ],
    url: "https://imserso.es/es/autonomia-personal-dependencia/grado-de-discapacidad",
    accion: "Ver el procedimiento oficial",
  },
  {
    id: "integracion-migrantes",
    escenarios: ["migracion"],
    titulo: "Información y recursos de integración para personas migrantes",
    organismo: "Ministerio de Inclusión, Seguridad Social y Migraciones",
    resumen:
      "Información oficial sobre programas de integración, inclusión y recursos vinculados a la situación de las personas migrantes.",
    pasos: [
      "Comprueba qué recurso corresponde a tu situación administrativa y territorio.",
      "No compartas documentación sensible en el chat; tramítala solo en la sede u oficina oficial.",
      "Si buscas protección internacional, utiliza la vía específica del sistema de acogida.",
    ],
    url: "https://www.inclusion.gob.es/es/web/migraciones/integracion",
    accion: "Ver recursos oficiales de integración",
  },
  {
    id: "acogida-proteccion-internacional",
    escenarios: ["migracion"],
    titulo: "Sistema de acogida de protección internacional",
    organismo: "Ministerio de Inclusión, Seguridad Social y Migraciones",
    resumen:
      "Información oficial del sistema de acogida para solicitantes o beneficiarios de protección internacional y temporal.",
    pasos: [
      "Comprueba primero si tu situación es de protección internacional o temporal.",
      "Sigue únicamente los canales y entidades indicados por el Ministerio.",
      "Para una urgencia básica, contacta también con Servicios Sociales de tu municipio.",
    ],
    url: "https://www.inclusion.gob.es/web/migraciones/sistema-de-acogida",
    accion: "Ver el sistema oficial de acogida",
  },
  {
    id: "joven-extutelado",
    escenarios: ["extutelado"],
    titulo: "Apoyo autonómico para la transición a la vida adulta",
    organismo: "Servicios de protección a la infancia de tu comunidad autónoma",
    resumen:
      "Los apoyos para jóvenes extutelados —alojamiento, acompañamiento, empleo o prestaciones— se gestionan principalmente por cada comunidad autónoma.",
    pasos: [
      "Contacta con el servicio autonómico que llevó tu tutela o con Servicios Sociales.",
      "Pregunta expresamente por programas de mayoría de edad, emancipación y pisos asistidos.",
      "Si no sabes qué oficina es, el 060 puede ayudarte a localizar el órgano competente.",
    ],
    url: "https://www.juventudeinfancia.gob.es/es/infancia/planes-estrategicos/estrategia-estatal-derechos-infancia-adolescencia",
    accion: "Ver el marco oficial y localizar el servicio",
  },
];

export function derivacionesParaEscenarios(escenarios: EscenarioAsistente[]): DerivacionOficial[] {
  const conjunto = new Set(escenarios);
  return DERIVACIONES_OFICIALES.filter((d) => d.escenarios.some((e) => conjunto.has(e))).slice(0, 3);
}

export function recursoDesdeDerivacion(d: DerivacionOficial): RecursoAsistente {
  return {
    id: d.id,
    tipo: "orientacion",
    titulo: d.titulo,
    organismo: d.organismo,
    resumen: d.resumen,
    requisitos: d.pasos,
    plazo: d.urgente ? "Atención inmediata" : "Disponible para orientación",
    urlInfo: d.url,
    urlSolicitud: d.url,
    accion: d.accion,
  };
}
