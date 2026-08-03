#!/usr/bin/env tsx
// Sync por línea de comandos: `npm run sync` (o `npm run sync -- 49` para otra
// región BDNS). Mismo motor que el botón ⟳ de la app. Victor eligió NO tener
// cron: este script existe para poder enchufarle uno el día que quiera
// (crontab / launchd), sin tocar la app.
import { abrirDb } from "../lib/db";
import { crearRepo } from "../lib/repo";
import { refrescarAbiertas, syncDetalles, syncLista } from "../lib/sync";

const region = Number(process.argv[2] ?? "") || 54; // por defecto C. Valenciana

const repo = crearRepo(abrirDb());
console.log(`📡 Radar de Ayudas — sync de la región BDNS ${region}`);

const lista = await syncLista(repo, region, {
  onProgreso: (p, t) => console.log(`   lista: página ${p}/${t}`),
});
console.log(`   ${lista.nuevas} convocatorias en lista (${lista.paginas} páginas)`);

const detalles = await syncDetalles(repo, {
  limite: 400,
  onProgreso: (h, t) => {
    if (h % 25 === 0 || h === t) console.log(`   detalles: ${h}/${t}`);
  },
});
const refrescadas = await refrescarAbiertas(repo, { limite: 80 });

console.log(
  `✔ Hecho: ${detalles} detalles nuevos, ${refrescadas} refrescados, ` +
    `${repo.contarPendientes()} pendientes, ${repo.contar()} convocatorias en total.`,
);
