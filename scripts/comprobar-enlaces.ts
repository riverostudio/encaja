#!/usr/bin/env tsx
import { PRESTACIONES } from "../lib/prestaciones";

async function comprobar() {
  let rotos = 0;
  for (const prestacion of PRESTACIONES) {
    try {
      const respuesta = await fetch(prestacion.url, {
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
        console.error(`ROTO ${prestacion.id}: termina en ${respuesta.url}`);
      } else if (!respuesta.ok) {
        console.warn(`AVISO ${prestacion.id}: HTTP ${respuesta.status} (puede ser antibot)`);
      } else {
        console.log(`OK ${prestacion.id}: ${respuesta.url}`);
      }
    } catch (error) {
      console.warn(`AVISO ${prestacion.id}: ${error instanceof Error ? error.message : error}`);
    }
  }
  if (rotos) throw new Error(`${rotos} enlace(s) llevan a una página 404.`);
}

comprobar().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});

