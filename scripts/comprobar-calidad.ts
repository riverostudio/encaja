#!/usr/bin/env tsx
import { PRESTACIONES } from "../lib/prestaciones";
import { DERIVACIONES_OFICIALES, derivacionesParaEscenarios } from "../lib/derivaciones";
import type { EscenarioAsistente } from "../lib/asistente";

const ids = [...PRESTACIONES.map((p) => p.id), ...DERIVACIONES_OFICIALES.map((d) => d.id)];
if (new Set(ids).size !== ids.length) throw new Error("Hay IDs duplicados entre ayudas y derivaciones.");

for (const p of PRESTACIONES) {
  if (p.requisitos.length < 3) throw new Error(`${p.id}: faltan requisitos verificables.`);
  for (const incompatible of p.incompatibleCon ?? []) {
    const otra = PRESTACIONES.find((x) => x.id === incompatible);
    if (!otra) throw new Error(`${p.id}: incompatibilidad con ID inexistente ${incompatible}.`);
    if (!otra.incompatibleCon?.includes(p.id)) throw new Error(`${p.id}: incompatibilidad no recíproca con ${incompatible}.`);
  }
}

for (const d of DERIVACIONES_OFICIALES) {
  const url = new URL(d.url);
  if (url.protocol !== "https:" || url.username || url.password) throw new Error(`${d.id}: enlace no seguro.`);
  if (d.pasos.length < 3) throw new Error(`${d.id}: orientación incompleta.`);
}

const criticos: EscenarioAsistente[] = [
  "violencia_genero", "alimentacion", "dependencia", "discapacidad", "mayores", "migracion", "extutelado",
];
for (const escenario of criticos) {
  if (!derivacionesParaEscenarios([escenario]).length) throw new Error(`Sin derivación humana para ${escenario}.`);
}

console.log(`OK calidad: ${PRESTACIONES.length} ayudas directas, ${DERIVACIONES_OFICIALES.length} derivaciones y ${criticos.length} escenarios críticos.`);
