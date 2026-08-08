#!/usr/bin/env tsx
import fs from "node:fs";
import Database from "better-sqlite3";
import { PRESTACIONES } from "../lib/prestaciones";
import { urlAbsoluta } from "../lib/url-oficial";

function comprobarCatalogo() {
  const ruta = "data/radar-publico.db";
  if (!fs.existsSync(ruta)) return;
  const db = new Database(ruta, { readonly: true });
  try {
    const filas = db
      .prepare(
        `SELECT codigo_bdns AS codigo, url_bases AS url FROM convocatorias WHERE url_bases IS NOT NULL
         UNION ALL
         SELECT codigo_bdns AS codigo, sede AS url FROM convocatorias WHERE sede IS NOT NULL`,
      )
      .all() as Array<{ codigo: string; url: string }>;
    let validos = 0;
    let fallback = 0;
    for (const fila of filas) {
      const limpia = urlAbsoluta(fila.url);
      if (!limpia) {
        fallback++;
        continue;
      }
      const url = new URL(limpia);
      if (
        !["http:", "https:"].includes(url.protocol) ||
        url.username ||
        url.password ||
        /[\s\\]/.test(limpia)
      ) {
        throw new Error(`Enlace inseguro en BDNS ${fila.codigo}: ${limpia}`);
      }
      validos++;
    }
    console.log(
      `OK catálogo: ${validos.toLocaleString("es-ES")} enlaces web seguros · ${fallback.toLocaleString("es-ES")} usan fallback BDNS`,
    );
  } finally {
    db.close();
  }
}

async function comprobar() {
  comprobarCatalogo();
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
