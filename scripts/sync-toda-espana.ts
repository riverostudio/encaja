#!/usr/bin/env tsx
import { abrirDb } from "../lib/db";
import { crearRepo } from "../lib/repo";
import { CCAAS } from "../lib/territorio";
import { refrescarAbiertas, syncDetalles, syncEstatal, syncLista } from "../lib/sync";

async function main() {
  const repo = crearRepo(abrirDb());

  console.log(`Sincronizando Estado y ${CCAAS.length} territorios`);
  for (const [indice, territorio] of CCAAS.entries()) {
    const resultado = await syncLista(repo, territorio.id);
    console.log(
      `[${indice + 1}/${CCAAS.length}] ${territorio.nombre}: ${resultado.nuevas} nuevas, ${resultado.paginas} páginas`,
    );
  }

  const estatal = await syncEstatal(repo);
  console.log(`Estado: ${estatal.nuevas} nuevas, ${estatal.paginas} páginas`);

  let descargados = 0;
  for (let tanda = 1; tanda <= 100 && repo.contarPendientes() > 0; tanda++) {
    const antes = repo.contarPendientes();
    const hechos = await syncDetalles(repo, { limite: 600, concurrencia: 6 });
    descargados += hechos;
    console.log(`Detalles ${tanda}: ${hechos} descargados, ${repo.contarPendientes()} pendientes`);
    if (hechos === 0 || repo.contarPendientes() >= antes) break;
  }

  const refrescadas = await refrescarAbiertas(repo, { limite: 250 });
  console.log(
    `Terminado: ${repo.contar()} convocatorias, ${descargados} detalles nuevos, ` +
      `${refrescadas} vigentes refrescadas, ${repo.contarPendientes()} pendientes.`,
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
