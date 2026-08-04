/**
 * Aislamiento entre visitantes.
 *
 * En tu ordenador la app es de una sola persona: el perfil y la clave de la IA
 * viven en la base y no hay nada que separar. Publicada en internet eso sería
 * un desastre — todos verían el mismo perfil y gastarían la misma clave — así
 * que en modo público el estado de cada visitante viaja en su propia petición
 * y el servidor no guarda nada suyo.
 *
 * El interruptor es ENCAJA_PUBLICO=1. Sin él, todo se comporta como siempre.
 */

import { PROVEEDORES, type Proveedor, type CredencialesIA } from "./ia";

export type Credenciales = CredencialesIA;

/** ¿Esta instancia está abierta a internet? */
export function esPublico(): boolean {
  return process.env.ENCAJA_PUBLICO === "1";
}

/**
 * La clave que trae el visitante. Se usa para esa llamada y se olvida: nunca
 * toca la base ni los registros.
 */
export function credencialesDe(req: Request): Credenciales | null {
  const proveedor = req.headers.get("x-ia-proveedor")?.trim() as Proveedor | undefined;
  const clave = req.headers.get("x-ia-clave")?.trim();
  if (!proveedor || !clave) return null;
  if (!PROVEEDORES.some((p) => p.id === proveedor)) return null;
  return { proveedor, modelo: req.headers.get("x-ia-modelo")?.trim() || null, clave };
}

/**
 * El perfil que el visitante guarda en su navegador. Solo se aceptan pares de
 * texto: si llega un objeto anidado se descarta, para que nada raro acabe
 * donde se esperaba una respuesta.
 */
export function hechosDe(req: Request): Map<string, string> | null {
  const crudo = req.headers.get("x-perfil");
  if (!crudo) return null;
  try {
    const datos = JSON.parse(crudo);
    if (!datos || typeof datos !== "object" || Array.isArray(datos)) return null;
    const hechos = new Map<string, string>();
    for (const [k, v] of Object.entries(datos)) {
      if (typeof v === "string" || typeof v === "number") hechos.set(k, String(v));
    }
    return hechos;
  } catch {
    return null;
  }
}

/**
 * Cajón donde caen los datos de servidor de este navegador. El 1 es el dueño
 * del ordenador, así que los visitantes empiezan en el 2 y nunca lo pisan.
 */
export function idDeSesion(req: Request): number {
  const s = req.headers.get("x-sesion")?.trim();
  if (!s) return 1;
  // djb2: basta para repartir, no pretende ser criptográfico.
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (Math.abs(h) % 2_000_000_000) + 2;
}
