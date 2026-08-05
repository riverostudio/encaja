import { NextResponse } from "next/server";
import { getRepo } from "@/lib/servidor";
import { CCAAS } from "@/lib/territorio";

export const dynamic = "force-dynamic";

export async function GET() {
  const repo = getRepo();
  const regiones = repo.regionesSincronizadas();
  return NextResponse.json({
    ...repo.metricasPublicas(),
    pendientesDetalle: repo.contarPendientes(),
    ultimaSincronizacion: repo.ultimoSyncGlobal()?.ts ?? null,
    regionesSincronizadas: regiones,
    cobertura: { sincronizadas: regiones.length, total: CCAAS.length },
  });
}

