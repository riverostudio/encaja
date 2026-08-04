import fs from "node:fs";
import path from "node:path";

export interface Zona {
  municipio: string;
  provincia: string;
}

export interface ResultadoCP extends Zona {
  ccaa: string;
  regionIds: number[];
}

/**
 * ¿La ayuda transcurre en España? La BDNS publica convocatorias de organismos
 * españoles cuya acción ocurre fuera: la cooperación de la AECID marca
 * "XXXX - TODO EL MUNDO", y algún programa europeo marca solo Francia o Reino
 * Unido. Las convoca España, pero nadie que viva aquí puede pedirlas.
 *
 * Sin dato NO se descarta: la app prefiere enseñar de más a esconder una ayuda
 * real por un campo que el organismo dejó vacío.
 */
export function transcurreEnEspana(regiones: string[] | null | undefined): boolean {
  if (!regiones || regiones.length === 0) return true;
  // Los códigos NUTS de España empiezan por ES; ojo con SE (Suecia) y EE (Estonia).
  return regiones.some((r) => String(r).trim().toUpperCase().startsWith("ES"));
}

const ARTICULOS = new Set(["EL", "LA", "LOS", "LAS", "ELS", "LES", "ES", "SA", "SES", "NA", "L", "S", "A", "O", "OS", "AS"]);

/**
 * Normaliza un nombre de municipio/órgano para comparar:
 * mayúsculas, sin acentos, separadores a espacio, sin artículos.
 * "L'Eliana" → "ELIANA" · "Riba-roja de Túria" → "RIBA ROJA DE TURIA"
 */
export function normalizar(s: string): string {
  const limpio = s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[-'’·./()]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const palabras = limpio.split(" ").filter((p) => p.length > 0);
  // Quita artículos iniciales o finales (formato INE "ELIANA L")
  while (palabras.length > 1 && ARTICULOS.has(palabras[0])) palabras.shift();
  while (palabras.length > 1 && ARTICULOS.has(palabras[palabras.length - 1])) palabras.pop();
  return palabras.join(" ");
}

interface Datos {
  porCp: Map<string, ResultadoCP>;
  ccaas: { id: number; nombre: string }[];
}

let cache: Datos | null = null;

function cargar(): Datos {
  if (cache) return cache;
  const raiz = process.cwd();
  const regiones = JSON.parse(
    fs.readFileSync(path.join(raiz, "datasets", "regiones-bdns.json"), "utf8"),
  ) as {
    ccaa: { id: number; nombre: string }[];
    provinciasINE: Record<string, [string, string, number | null, number]>;
  };

  const provinciaPorNombre = new Map<string, [string, string, number | null, number]>();
  for (const v of Object.values(regiones.provinciasINE)) provinciaPorNombre.set(v[0], v);

  const porCp = new Map<string, ResultadoCP>();
  const csv = fs.readFileSync(path.join(raiz, "datasets", "cp-municipios.csv"), "utf8");
  for (const linea of csv.split("\n").slice(1)) {
    if (!linea.trim()) continue;
    const campos = parsearLineaCsv(linea);
    const [cp, municipio, provincia, ccaa] = campos;
    const prov = provinciaPorNombre.get(provincia);
    const regionIds: number[] = [];
    if (prov) {
      regionIds.push(prov[3]); // id CCAA en BDNS
      if (prov[2] != null) regionIds.push(prov[2]); // id provincia en BDNS
    }
    porCp.set(cp, { municipio, provincia, ccaa, regionIds });
  }
  cache = { porCp, ccaas: regiones.ccaa };
  return cache;
}

function parsearLineaCsv(linea: string): string[] {
  const campos: string[] = [];
  let actual = "";
  let dentro = false;
  for (let i = 0; i < linea.length; i++) {
    const ch = linea[i];
    if (dentro) {
      if (ch === '"' && linea[i + 1] === '"') { actual += '"'; i++; }
      else if (ch === '"') dentro = false;
      else actual += ch;
    } else if (ch === '"') dentro = true;
    else if (ch === ",") { campos.push(actual); actual = ""; }
    else actual += ch;
  }
  campos.push(actual);
  return campos;
}

/** Resuelve un código postal a municipio/provincia/CCAA + ids de región BDNS. */
export function resolverCP(cp: string): ResultadoCP | null {
  if (!/^\d{5}$/.test(cp.trim())) return null;
  return cargar().porCp.get(cp.trim()) ?? null;
}

/** Las 19 comunidades con su id del árbol de regiones de la BDNS. */
export const CCAAS: { id: number; nombre: string }[] = (() => {
  try {
    return cargar().ccaas;
  } catch {
    return [];
  }
})();

/** Compara con límites de palabra: "ELIANA" no casa dentro de "MELIANA". */
function contienePalabras(texto: string, buscado: string): boolean {
  if (!buscado) return false;
  return ` ${texto} `.includes(` ${buscado} `);
}

/**
 * ¿El órgano LOCAL (nivel2/nivel3 de la BDNS) pertenece a la zona del usuario?
 * Casa el municipio (con límites de palabra) o la diputación de su provincia.
 */
export function esOrganoDeMiZona(
  nivel2: string,
  nivel3: string | null | undefined,
  zona: Zona,
): boolean {
  const n2 = normalizar(nivel2 ?? "");
  const n3 = normalizar(nivel3 ?? "");
  const mun = normalizar(zona.municipio);
  const prov = normalizar(zona.provincia);

  if (contienePalabras(n2, mun) || contienePalabras(n3, mun)) return true;

  const esDiputacion = n3.includes("DIPUTACION") || n3.includes("DIPUTACIO") || n3.includes("CABILDO") || n3.includes("CONSELL INSULAR");
  if (esDiputacion && (contienePalabras(n3, prov) || contienePalabras(n2, prov))) return true;

  return false;
}
