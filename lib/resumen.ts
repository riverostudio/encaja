// Traducción de la jerga administrativa a castellano llano, SIN IA:
// se calcula desde los datos que la BDNS ya publica, así que es
// instantánea, gratis y no puede inventarse nada. La IA, cuando hay
// clave, escribe encima un resumen mejor (ver lib/requisitos.ts).
import type { Convocatoria } from "./tipos";

export interface ResumenLlano {
  /** Para qué es el dinero. */
  que: string;
  /** Quién puede pedirla. */
  quien: string;
  /** Qué te llevas (dinero, préstamo, aval…). */
  consigues: string;
}

// Las categorías oficiales de la BDNS, dichas como las diría un vecino.
// Cuando no se reconoce una, se usa la oficial tal cual: nunca se inventa.
const PARA_QUE: Record<string, string> = {
  educación: "Para estudiar: colegio, universidad, cursos o material",
  cultura: "Para cultura: música, teatro, libros, patrimonio o fiestas",
  "servicios sociales y promoción social": "Para ayudar a quien lo está pasando mal",
  "comercio, turismo y pymes": "Para montar o sostener un negocio pequeño",
  "agricultura, pesca y alimentación": "Para el campo, la ganadería o la pesca",
  "investigación, desarrollo e innovación": "Para investigar o innovar",
  "otras prestaciones económicas": "Una prestación en dinero",
  "fomento del empleo": "Para crear empleo o encontrar trabajo",
  sanidad: "Para salud y atención sanitaria",
  "industria y energía": "Para industria o para gastar menos energía",
  justicia: "Para asuntos de justicia y defensa jurídica",
  infraestructuras: "Para obras e instalaciones",
  "acceso a la vivienda y fomento de la edificación": "Para vivienda: comprar, alquilar o reformar",
  desempleo: "Para gente que está sin trabajo",
  "cooperación internacional para el desarrollo y cultural": "Para cooperación y ayuda internacional",
  "seguridad ciudadana e instituciones penitenciarias": "Para seguridad ciudadana",
  "subvenciones al transporte": "Para transporte y desplazamientos",
  "otras actuaciones de carácter económico": "Ayuda económica de un programa concreto",
};

/** 23.559.000 → "23,6 M€" · 318.000 → "318.000 €" */
export function importeCorto(n?: number | null): string | null {
  if (!n || n <= 0) return null;
  if (n >= 1_000_000) {
    const millones = n / 1_000_000;
    const texto = millones >= 10 ? millones.toFixed(1) : millones.toFixed(2);
    return `${texto.replace(/[.,]?0+$/, "").replace(".", ",")} M€`;
  }
  // useGrouping "always": la RAE no separa los millares de 4 cifras, pero en
  // una columna de importes "7.000 €" alinea con "318.000 €" y se lee mejor.
  return `${new Intl.NumberFormat("es-ES", { useGrouping: "always" }).format(Math.round(n))} €`;
}

const QUIEN: { busca: string; dice: string }[] = [
  { busca: "PYME Y PERSONAS FÍSICAS QUE DESARROLLAN", dice: "pymes y autónomos" },
  { busca: "GRAN EMPRESA", dice: "grandes empresas" },
  { busca: "PERSONAS FÍSICAS QUE NO DESARROLLAN", dice: "particulares" },
  {
    busca: "PERSONAS JURÍDICAS QUE NO DESARROLLAN",
    dice: "asociaciones y entidades sin ánimo de lucro",
  },
];

/** "PYME Y PERSONAS FÍSICAS QUE DESARROLLAN…" → "pymes y autónomos" */
export function aQuienVa(beneficiarios: string[]): string | null {
  const vistos: string[] = [];
  for (const b of beneficiarios) {
    const mayus = b.toUpperCase();
    for (const q of QUIEN) {
      if (mayus.includes(q.busca) && !vistos.includes(q.dice)) vistos.push(q.dice);
    }
  }
  if (vistos.length === 0) return null;
  return vistos.join(" y ");
}

const INSTRUMENTO: { busca: string; dice: string }[] = [
  { busca: "PRÉSTAMO", dice: "Un préstamo en mejores condiciones que las del banco" },
  { busca: "GARANTÍA", dice: "Un aval público para que el banco te preste" },
  { busca: "FISCAL", dice: "Pagar menos impuestos" },
  { busca: "RIESGO", dice: "Entrada de capital en tu proyecto" },
  { busca: "SUBVENCIÓN", dice: "Dinero a fondo perdido: no se devuelve" },
  { busca: "ENTREGA DINERARIA", dice: "Dinero a fondo perdido: no se devuelve" },
];

function queTeDan(instrumentos: string[]): string {
  const texto = instrumentos.join(" ").toUpperCase();
  for (const i of INSTRUMENTO) {
    if (texto.includes(i.busca)) return i.dice;
  }
  return "Una ayuda pública";
}

/**
 * Lo que hace falta saber de un vistazo: para qué es y quién puede pedirla.
 * Todo sale de los datos oficiales, así que no puede afirmar nada falso;
 * cuando un dato no está publicado, lo dice en vez de rellenarlo.
 */
export function resumirEstructural(conv: Convocatoria): ResumenLlano {
  const finalidad = conv.finalidad?.trim();
  const clave = finalidad?.toLowerCase();
  const que = clave
    ? (PARA_QUE[clave] ?? `Para ${finalidad!.toLowerCase()}`)
    : "El objeto lo detallan las bases";

  const destinatarios = aQuienVa(conv.beneficiarios);
  const quien = destinatarios
    ? `Pueden pedirla ${destinatarios}`
    : "Las bases dicen quién puede pedirla";

  const bolsa = importeCorto(conv.presupuesto);
  const consigues = bolsa
    ? `${queTeDan(conv.instrumentos)}. Hay ${bolsa} en total, que se reparte entre quienes la piden.`
    : `${queTeDan(conv.instrumentos)}. La cuantía la fijan las bases.`;

  return { que, quien, consigues };
}
