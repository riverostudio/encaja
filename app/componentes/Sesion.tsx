"use client";

import { useEffect } from "react";
import {
  borrarHechoPublico,
  guardarHechoPublico,
  guardarResultadoEncaje,
  perfilPublicoConDerivados,
} from "../lib/estado-publico";

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

      const metodo = (init?.method ?? "GET").toUpperCase();

      // Las respuestas se guardan antes de salir para que esta misma petición
      // ya lleve el perfil actualizado. Las entrevistas alimentan la ficha.
      if (url.includes("/api/perfil") && init?.method === "POST" && typeof init.body === "string") {
        try {
          const { clave, valor } = JSON.parse(init.body) as { clave?: string; valor?: string };
          if (clave) guardarHechoPublico(clave, valor ?? "");
        } catch {
          // Cuerpo inesperado: se envía tal cual y el servidor decidirá.
        }
      }
      if (url.includes("/api/perfil") && metodo === "DELETE") {
        try {
          const clave = new URL(url, window.location.origin).searchParams.get("clave");
          if (clave) borrarHechoPublico(clave);
        } catch {
          // Una URL inesperada la resolverá el servidor.
        }
      }
      if (url.includes("/api/encaje/") && metodo === "POST" && typeof init?.body === "string") {
        try {
          const cuerpo = JSON.parse(init.body) as { accion?: string; clave?: string; valor?: string };
          if (cuerpo.accion === "responder" && cuerpo.clave) {
            guardarHechoPublico(cuerpo.clave, cuerpo.valor ?? "");
          }
        } catch {
          // El servidor validará el cuerpo.
        }
      }

      const cab = new Headers(init?.headers);
      const necesitaPerfil =
        url.includes("/api/perfil") ||
        url.includes("/api/encaje/") ||
        url.includes("/api/convocatorias") ||
        url.includes("/api/borrador/");
      if (necesitaPerfil) cab.set("x-perfil", JSON.stringify(perfilPublicoConDerivados()));
      if (url.includes("/api/encaje/")) cab.set("x-sesion", idSesion());

      const ia = leer<{ proveedor?: string; modelo?: string; clave?: string }>(LLAVE_IA, {});
      const pruebaAjustes = url.includes("/api/ajustes") && metodo === "POST";
      const necesitaIa =
        pruebaAjustes ||
        url.includes("/api/resumen/") ||
        url.includes("/api/encaje/") ||
        url.includes("/api/borrador/");
      if (url.includes("/api/ajustes") && ia.proveedor) {
        cab.set("x-ia-configurada", ia.clave ? "1" : "0");
        cab.set("x-ia-proveedor", ia.proveedor);
        if (ia.modelo) cab.set("x-ia-modelo", ia.modelo);
      }
      if (necesitaIa && ia.proveedor && ia.clave) {
        cab.set("x-ia-proveedor", ia.proveedor);
        cab.set("x-ia-clave", ia.clave);
        if (ia.modelo) cab.set("x-ia-modelo", ia.modelo);
      }
      const respuesta = await original(entrada, { ...init, headers: cab });
      if (url.includes("/api/encaje/") && metodo === "POST" && respuesta.ok) {
        try {
          const codigo = new URL(url, window.location.origin).pathname.split("/").pop();
          if (codigo) guardarResultadoEncaje(codigo, await respuesta.clone().json());
        } catch {
          // La llamada sigue siendo válida aunque no se pueda cachear su resultado.
        }
      }
      return respuesta;
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
