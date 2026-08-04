"use client";

import { useEffect } from "react";

/**
 * En la app pública nada tuyo se guarda en el servidor: tu perfil y tu clave
 * de IA viven en este navegador y se envían en cada petición.
 *
 * En vez de tocar las treinta llamadas repartidas por la interfaz, se envuelve
 * fetch una sola vez. Cualquier petición a /api/ sale con lo que haga falta, y
 * las pantallas siguen escritas como si nada de esto existiera.
 *
 * En tu ordenador este componente no hace nada: la app se comporta como
 * siempre y el estado vive en la base.
 */

const PUBLICO = process.env.NEXT_PUBLIC_ENCAJA_PUBLICO === "1";
const LLAVE_SESION = "encaja.sesion";
const LLAVE_PERFIL = "encaja.perfil";
const LLAVE_IA = "encaja.ia";

function leer<T>(llave: string, porDefecto: T): T {
  try {
    const crudo = localStorage.getItem(llave);
    return crudo ? (JSON.parse(crudo) as T) : porDefecto;
  } catch {
    return porDefecto;
  }
}

/** Identificador de este navegador. No dice quién eres, solo que eres el mismo. */
function idSesion(): string {
  let id = "";
  try {
    id = localStorage.getItem(LLAVE_SESION) ?? "";
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(LLAVE_SESION, id);
    }
  } catch {
    // Navegación privada con el almacenamiento bloqueado: sesión de un solo uso.
    id = crypto.randomUUID();
  }
  return id;
}

export default function Sesion() {
  useEffect(() => {
    if (!PUBLICO) return;
    const original = window.fetch;

    window.fetch = async (entrada, init) => {
      const url =
        typeof entrada === "string"
          ? entrada
          : entrada instanceof URL
            ? entrada.pathname
            : entrada.url;
      if (!url.includes("/api/")) return original(entrada, init);

      // Una respuesta del perfil se guarda AQUÍ antes de salir, para que la
      // cabecera que acompaña a esta misma petición ya la incluya.
      if (url.includes("/api/perfil") && init?.method === "POST" && typeof init.body === "string") {
        try {
          const { clave, valor } = JSON.parse(init.body) as { clave?: string; valor?: string };
          if (clave) {
            const perfil = leer<Record<string, string>>(LLAVE_PERFIL, {});
            perfil[clave] = valor ?? "";
            localStorage.setItem(LLAVE_PERFIL, JSON.stringify(perfil));
          }
        } catch {
          // Cuerpo inesperado: se envía tal cual y el servidor decidirá.
        }
      }

      const cab = new Headers(init?.headers);
      cab.set("x-sesion", idSesion());
      cab.set("x-perfil", JSON.stringify(leer<Record<string, string>>(LLAVE_PERFIL, {})));

      const ia = leer<{ proveedor?: string; modelo?: string; clave?: string }>(LLAVE_IA, {});
      if (ia.proveedor && ia.clave) {
        cab.set("x-ia-proveedor", ia.proveedor);
        cab.set("x-ia-clave", ia.clave);
        if (ia.modelo) cab.set("x-ia-modelo", ia.modelo);
      }
      return original(entrada, { ...init, headers: cab });
    };

    return () => {
      window.fetch = original;
    };
  }, []);

  return null;
}

/** Lo usa Ajustes: en modo público la clave se guarda aquí, no en el servidor. */
export function guardarIaLocal(proveedor: string, modelo: string, clave: string) {
  if (!PUBLICO) return false;
  localStorage.setItem(LLAVE_IA, JSON.stringify({ proveedor, modelo, clave }));
  return true;
}

export function hayIaLocal(): boolean {
  if (!PUBLICO) return false;
  return Boolean(leer<{ clave?: string }>(LLAVE_IA, {}).clave);
}

export function olvidarIaLocal() {
  localStorage.removeItem(LLAVE_IA);
}

export const APP_PUBLICA = PUBLICO;
