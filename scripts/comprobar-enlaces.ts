#!/usr/bin/env tsx
import { PRESTACIONES } from "../lib/prestaciones";

async function comprobar() {
  let rotos = 0;
  for (const prestacion of PRESTACIONES) {
    const enlaces = [
      { tipo: "información", url: prestacion.url },
      { tipo: "solicitud", url: prestacion.urlSolicitud },
    ].filter((enlace, indice, todos) => todos.findIndex((otro) => otro.url === enlace.url) === indice);
    for (const enlace of enlaces) {
      try {
        const respuesta = await fetch(enlace.url, {
          redirect: "follow",
          headers: { "User-Agent": "Encaja/1.0 comprobador de enlaces" },
          signal: AbortSignal.timeout(20_000),
        });
        const final = respuesta.url.toLowerCase();
        const html = (respuesta.headers.get("content-type") ?? "").includes("text/html")
          ? await respuesta.text()
          : "";
        const soft404 =
          /\/404(?:[./?#]|$)/.test(final) ||
          /<title>[^<]*(?:404|página no encontrada|page not found)/i.test(html);
        if (soft404) {
          rotos++;
          console.error(`ROTO ${prestacion.id} (${enlace.tipo}): termina en ${respuesta.url}`);
        } else if (!respuesta.ok) {
          console.warn(`AVISO ${prestacion.id} (${enlace.tipo}): HTTP ${respuesta.status} (puede ser antibot)`);
        } else {
          console.log(`OK ${prestacion.id} (${enlace.tipo}): ${respuesta.url}`);
        }
      } catch (error) {
        console.warn(`AVISO ${prestacion.id} (${enlace.tipo}): ${error instanceof Error ? error.message : error}`);
      }
    }
  }
  if (rotos) throw new Error(`${rotos} enlace(s) llevan a una página 404.`);
}

comprobar().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
