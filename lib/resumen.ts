// Traducción de la jerga administrativa a castellano llano, SIN IA:
// se calcula desde los datos que la BDNS ya publica, así que es
// instantánea, gratis y no puede inventarse nada. La IA, cuando hay
// clave, escribe encima un resumen mejor (ver lib/requisitos.ts).
import type { Convocatoria } from "./tipos";

export interface ResumenLlano {
  que: string;
  consigues: string;
}

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
 * Dos frases para la tarjeta: qué es esto y qué te puedes llevar.
 * Nunca afirma cuánto te tocaría a ti: el presupuesto es la bolsa total.
 */
export function resumirEstructural(conv: Convocatoria): ResumenLlano {
  const quien = aQuienVa(conv.beneficiarios);
  const finalidad = conv.finalidad?.trim();

  let que: string;
  if (finalidad && quien) que = `Ayuda de ${finalidad.toLowerCase()} para ${quien}.`;
  else if (finalidad) que = `Ayuda pública en materia de ${finalidad.toLowerCase()}.`;
  else if (quien) que = `Ayuda pública dirigida a ${quien}.`;
  else que = "Ayuda pública: las bases detallan el objeto y a quién va dirigida.";

  const bolsa = importeCorto(conv.presupuesto);
  const consigues = bolsa
    ? `${queTeDan(conv.instrumentos)}. Hay ${bolsa} en total, que se reparte entre quienes la piden.`
    : `${queTeDan(conv.instrumentos)}. La cuantía la fijan las bases.`;

  return { que, consigues };
}
