// El perfil de la persona, en preguntas que se entienden. De aquí sale
// tanto el filtrado automático del radar como los datos que la entrevista
// de cada ayuda ya no tendrá que volver a preguntar.

export interface OpcionPerfil {
  valor: string;
  texto: string;
  ayuda?: string;
}

export interface PreguntaPerfil {
  clave: string;
  pregunta: string;
  ayuda?: string;
  tipo: "opcion" | "varias" | "cp" | "numero";
  opciones?: OpcionPerfil[];
  /** Se salta si esta función dice que no aplica al perfil que llevamos. */
  soloSi?: (hechos: Map<string, string>) => boolean;
}

export const PREGUNTAS_PERFIL: PreguntaPerfil[] = [
  {
    clave: "perfil",
    pregunta: "¿Cómo pedirías una ayuda?",
    ayuda: "Casi todas las convocatorias separan a las personas de los negocios.",
    tipo: "opcion",
    opciones: [
      { valor: "particular", texto: "Como persona", ayuda: "Para mí o para mi familia" },
      { valor: "autonomo", texto: "Como autónomo", ayuda: "Estoy dado de alta por mi cuenta" },
      { valor: "empresa", texto: "Como empresa", ayuda: "Tengo una sociedad (SL, cooperativa…)" },
    ],
  },
  {
    clave: "situacion",
    pregunta: "¿En qué situación estás ahora?",
    ayuda: "Muchas ayudas van dirigidas justo a una de estas.",
    tipo: "opcion",
    opciones: [
      { valor: "desempleado", texto: "Sin trabajo", ayuda: "Buscando empleo" },
      { valor: "cuenta_ajena", texto: "Trabajando para otro", ayuda: "Por cuenta ajena" },
      { valor: "autonomo_activo", texto: "Trabajando por mi cuenta", ayuda: "Autónomo en activo" },
      { valor: "estudiante", texto: "Estudiando" },
      { valor: "jubilado", texto: "Jubilado o pensionista" },
    ],
  },
  {
    clave: "ingresos",
    pregunta: "¿Cuánto entra en tu casa al año?",
    ayuda: "Sumando todo lo que cobráis los que vivís juntos, antes de impuestos. Es orientativo.",
    tipo: "opcion",
    opciones: [
      { valor: "menos_12000", texto: "Menos de 12.000 €" },
      { valor: "12000_18000", texto: "Entre 12.000 y 18.000 €" },
      { valor: "18000_25000", texto: "Entre 18.000 y 25.000 €" },
      { valor: "25000_40000", texto: "Entre 25.000 y 40.000 €" },
      { valor: "mas_40000", texto: "Más de 40.000 €" },
      { valor: "prefiero_no_decir", texto: "Prefiero no decirlo" },
    ],
  },
  {
    clave: "personas_hogar",
    pregunta: "¿Cuántas personas vivís en casa?",
    ayuda: "Contándote a ti. Casi todas las ayudas por renta dividen los ingresos entre esto.",
    tipo: "opcion",
    opciones: [
      { valor: "1", texto: "Vivo solo" },
      { valor: "2", texto: "Dos" },
      { valor: "3", texto: "Tres" },
      { valor: "4", texto: "Cuatro" },
      { valor: "5+", texto: "Cinco o más" },
    ],
  },
  {
    clave: "menores_cargo",
    pregunta: "¿Tienes hijos o menores a tu cargo?",
    tipo: "opcion",
    opciones: [
      { valor: "no", texto: "No" },
      { valor: "1", texto: "Uno" },
      { valor: "2", texto: "Dos" },
      { valor: "3+", texto: "Tres o más" },
    ],
  },
  {
    clave: "circunstancias",
    pregunta: "¿Te reconoce la Administración alguna de estas situaciones?",
    ayuda: "Suman puntos en muchísimas convocatorias. Marca las que tengas; si ninguna, sigue.",
    tipo: "varias",
    opciones: [
      { valor: "discapacidad", texto: "Discapacidad reconocida" },
      { valor: "familia_numerosa", texto: "Familia numerosa" },
      { valor: "monoparental", texto: "Familia monoparental" },
      { valor: "dependencia", texto: "Grado de dependencia" },
      { valor: "victima_violencia", texto: "Víctima de violencia de género" },
      { valor: "menor_30", texto: "Tengo menos de 30 años" },
      { valor: "mayor_45", texto: "Tengo más de 45 años" },
      { valor: "larga_duracion", texto: "Llevo más de un año sin trabajar" },
    ],
  },
  {
    clave: "cp",
    pregunta: "¿Cuál es tu código postal?",
    ayuda: "Con esto aparecen también las ayudas de tu ayuntamiento y tu diputación.",
    tipo: "cp",
  },
  {
    clave: "al_corriente",
    pregunta: "¿Estás al día con Hacienda y la Seguridad Social?",
    ayuda: "Lo piden prácticamente todas. Si debes algo, muchas se caen automáticamente.",
    tipo: "opcion",
    opciones: [
      { valor: "si", texto: "Sí, al día" },
      { valor: "no", texto: "No, debo algo" },
      { valor: "no_lo_se", texto: "No lo sé" },
    ],
  },
  {
    clave: "cnae_letras",
    pregunta: "¿A qué se dedica tu negocio?",
    ayuda: "Sirve para descartar las convocatorias de otros sectores.",
    tipo: "opcion",
    soloSi: (h) => h.get("perfil") === "autonomo" || h.get("perfil") === "empresa",
    opciones: [
      { valor: "G", texto: "Comercio" },
      { valor: "I", texto: "Hostelería y restauración" },
      { valor: "C", texto: "Fabricación o taller" },
      { valor: "F", texto: "Construcción y reformas" },
      { valor: "M", texto: "Servicios profesionales", ayuda: "Consultoría, diseño, ingeniería…" },
      { valor: "J", texto: "Informática y comunicación" },
      { valor: "R", texto: "Ocio, cultura y deporte" },
      { valor: "Q", texto: "Salud y servicios sociales" },
      { valor: "P", texto: "Educación y formación" },
      { valor: "A", texto: "Agricultura y ganadería" },
      { valor: "H", texto: "Transporte" },
      { valor: "S", texto: "Otros servicios" },
    ],
  },
];

/** Las preguntas que tocan según lo ya respondido. */
export function preguntasAplicables(hechos: Map<string, string>): PreguntaPerfil[] {
  return PREGUNTAS_PERFIL.filter((p) => !p.soloSi || p.soloSi(hechos));
}

/** La siguiente sin responder, o null si el perfil está completo. */
export function siguientePreguntaPerfil(hechos: Map<string, string>): PreguntaPerfil | null {
  return preguntasAplicables(hechos).find((p) => !hechos.has(p.clave)) ?? null;
}

export function progresoPerfil(hechos: Map<string, string>): {
  respondidas: number;
  total: number;
  completo: boolean;
} {
  const aplicables = preguntasAplicables(hechos);
  const respondidas = aplicables.filter((p) => hechos.has(p.clave)).length;
  return { respondidas, total: aplicables.length, completo: respondidas === aplicables.length };
}

/**
 * El filtro de beneficiario de la BDNS que corresponde al perfil.
 * Es lo que hace que el radar enseñe directamente lo que le sirve.
 */
export function beneficiarioDesdePerfil(hechos: Map<string, string>): string | null {
  switch (hechos.get("perfil")) {
    case "particular":
      return "PERSONAS FÍSICAS QUE NO DESARROLLAN";
    case "autonomo":
    case "empresa":
      return "PYME";
    default:
      return null;
  }
}

/**
 * El perfil traducido a los "hechos" que usa la entrevista de cada ayuda,
 * para no volver a preguntar lo que ya sabemos.
 */
export function hechosDerivados(hechos: Map<string, string>): Record<string, string> {
  const derivados: Record<string, string> = {};
  const perfil = hechos.get("perfil");
  if (perfil === "particular") derivados.tipo_actividad = "particular";
  else if (perfil === "autonomo") derivados.tipo_actividad = "autonomo";
  else if (perfil === "empresa") derivados.tipo_actividad = "pyme";

  const alCorriente = hechos.get("al_corriente");
  if (alCorriente === "si") {
    derivados.al_corriente_hacienda = "sí";
    derivados.al_corriente_ss = "sí";
  } else if (alCorriente === "no") {
    derivados.al_corriente_hacienda = "no";
    derivados.al_corriente_ss = "no";
  }
  return derivados;
}

const ETIQUETAS: Record<string, Record<string, string>> = {
  perfil: { particular: "como persona", autonomo: "como autónomo", empresa: "como empresa" },
  situacion: {
    desempleado: "sin trabajo",
    cuenta_ajena: "trabajando por cuenta ajena",
    autonomo_activo: "trabajando por tu cuenta",
    estudiante: "estudiando",
    jubilado: "jubilado o pensionista",
  },
  ingresos: {
    menos_12000: "menos de 12.000 € al año en casa",
    "12000_18000": "entre 12.000 y 18.000 € al año en casa",
    "18000_25000": "entre 18.000 y 25.000 € al año en casa",
    "25000_40000": "entre 25.000 y 40.000 € al año en casa",
    mas_40000: "más de 40.000 € al año en casa",
    prefiero_no_decir: "sin decir los ingresos",
  },
};

/** Una frase que le recuerda a la persona con qué perfil está mirando. */
export function resumenPerfil(hechos: Map<string, string>): string {
  const trozos: string[] = [];
  for (const clave of ["perfil", "situacion", "ingresos"]) {
    const valor = hechos.get(clave);
    const etiqueta = valor ? ETIQUETAS[clave]?.[valor] : null;
    if (etiqueta) trozos.push(etiqueta);
  }
  if (trozos.length === 0) return "Sin perfil todavía";
  return `Buscas ${trozos.join(", ")}`;
}

export interface Atajo {
  texto: string;
  busca: string;
}

const ATAJOS_PERSONA: Atajo[] = [
  { texto: "Alquiler y vivienda", busca: "alquiler" },
  { texto: "Emergencia social", busca: "emergencia" },
  { texto: "Luz, agua y gas", busca: "suministros" },
];
const ATAJOS_NEGOCIO: Atajo[] = [
  { texto: "Digitalización", busca: "digitalización" },
  { texto: "Contratar a alguien", busca: "contratación" },
  { texto: "Ahorro de energía", busca: "eficiencia energética" },
  { texto: "Innovación", busca: "innovación" },
];

/**
 * Los atajos que le sirven a ESTA persona, no un cajón de sastre.
 * Se ordenan por lo que más le puede tocar según su perfil.
 */
export function atajosParaPerfil(hechos: Map<string, string>): Atajo[] {
  const perfil = hechos.get("perfil");
  const atajos: Atajo[] = [];
  const añadir = (a: Atajo) => {
    if (!atajos.some((x) => x.busca === a.busca)) atajos.push(a);
  };

  if (perfil === "autonomo" || perfil === "empresa") {
    ATAJOS_NEGOCIO.forEach(añadir);
    if (hechos.get("situacion") === "desempleado") {
      añadir({ texto: "Volver a empezar", busca: "emprendedores" });
    }
    return atajos.slice(0, 6);
  }

  // Persona: primero lo que le toca por su situación.
  const situacion = hechos.get("situacion");
  if (situacion === "desempleado") {
    añadir({ texto: "Estando sin trabajo", busca: "desempleo" });
    añadir({ texto: "Cursos y formación", busca: "formación" });
  }
  if (situacion === "estudiante") añadir({ texto: "Becas y estudios", busca: "beca" });
  if (situacion === "jubilado") añadir({ texto: "Mayores", busca: "mayores" });

  const ingresos = hechos.get("ingresos");
  if (ingresos === "menos_12000" || ingresos === "12000_18000") {
    ATAJOS_PERSONA.forEach(añadir);
  }

  const menores = hechos.get("menores_cargo");
  if (menores && menores !== "no") {
    añadir({ texto: "Comedor y libros", busca: "comedor" });
    añadir({ texto: "Familia e infancia", busca: "familia" });
  }

  const circunstancias = (hechos.get("circunstancias") ?? "").split(",");
  if (circunstancias.includes("discapacidad") || circunstancias.includes("dependencia")) {
    añadir({ texto: "Discapacidad y dependencia", busca: "discapacidad" });
  }
  if (circunstancias.includes("familia_numerosa")) {
    añadir({ texto: "Familia numerosa", busca: "familia numerosa" });
  }
  if (circunstancias.includes("victima_violencia")) {
    añadir({ texto: "Violencia de género", busca: "violencia" });
  }
  if (circunstancias.includes("menor_30")) añadir({ texto: "Gente joven", busca: "jóvenes" });

  // Relleno con lo que le sirve a casi todo el mundo.
  añadir({ texto: "Becas y estudios", busca: "beca" });
  añadir({ texto: "Alquiler y vivienda", busca: "alquiler" });
  añadir({ texto: "Rehabilitar la casa", busca: "rehabilitación" });
  return atajos.slice(0, 7);
}

/** Texto legible de una respuesta guardada, para la pantalla de repaso. */
export function textoRespuesta(pregunta: PreguntaPerfil, valor: string): string {
  if (pregunta.tipo === "varias") {
    const marcadas = valor.split(",").filter(Boolean);
    if (marcadas.length === 0) return "Ninguna";
    return marcadas
      .map((v) => pregunta.opciones?.find((o) => o.valor === v)?.texto ?? v)
      .join(", ");
  }
  return pregunta.opciones?.find((o) => o.valor === valor)?.texto ?? valor;
}
