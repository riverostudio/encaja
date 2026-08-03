import { NextRequest, NextResponse } from "next/server";
import { getRepo, errorJson } from "@/lib/servidor";
import { syncLista, syncDetalles, refrescarAbiertas } from "@/lib/sync";

export const dynamic = "force-dynamic";

export async function GET() {
  const repo = getRepo();
  return NextResponse.json({
    ultimo: repo.ultimoSyncGlobal()?.ts ?? null,
    total: repo.contar(),
    pendientesDetalle: repo.contarPendientes(),
  });
}

export async function POST(req: NextRequest) {
  try {
    const { regionId } = (await req.json()) as { regionId?: number };
    const repo = getRepo();
    const region = regionId ?? 54;
    const lista = await syncLista(repo, region);
    const detalles = await syncDetalles(repo, { limite: 300 });
    const refrescadas = await refrescarAbiertas(repo, { limite: 60 });
    return NextResponse.json({
      nuevas: lista.nuevas,
      detalles,
      refrescadas,
      pendientesDetalle: repo.contarPendientes(),
    });
  } catch (e) {
    return NextResponse.json(errorJson(e), { status: 500 });
  }
}
