import { NextRequest, NextResponse } from "next/server";
import { getRepo, errorJson } from "@/lib/servidor";
import { syncLista, syncEstatal, syncDetalles, refrescarAbiertas } from "@/lib/sync";
import { CCAAS } from "@/lib/territorio";
import { mantenimientoAutorizado } from "@/lib/seguridad";
import { esPublico } from "@/lib/sesion";

export const dynamic = "force-dynamic";

export async function GET() {
  const repo = getRepo();
  return NextResponse.json({
    ultimo: repo.ultimoSyncGlobal()?.ts ?? null,
    total: repo.contar(),
    pendientesDetalle: repo.contarPendientes(),
    regionesSincronizadas: repo.regionesSincronizadas(),
    cobertura: `${repo.regionesSincronizadas().length}/${CCAAS.length}` });
}

export async function POST(req: NextRequest) {
  try {
    if (esPublico()) {
      return NextResponse.json(
        { error: "La base pública se actualiza antes del despliegue." },
        { status: 405 },
      );
    }
    if (!mantenimientoAutorizado(req)) {
      return NextResponse.json({ error: "Ruta de mantenimiento protegida" }, { status: 403 });
    }
    const { regionId, todaEspana } = (await req.json()) as {
      regionId?: number;
      todaEspana?: boolean;
    };
    const repo = getRepo();

    // España entera: las 19 comunidades, una a una. Solo la lista — el detalle
    // lo va vaciando la cola después, para no tener esto media hora parado.
    if (todaEspana) {
      let nuevas = 0;
      const hechas: string[] = [];
      for (const c of CCAAS) {
        const r = await syncLista(repo, c.id);
        nuevas += r.nuevas;
        hechas.push(c.nombre);
      }
      const estatal = await syncEstatal(repo);
      const detalles = await syncDetalles(repo, { limite: 400 });
      return NextResponse.json({
        nuevas: nuevas + estatal.nuevas,
        comunidades: hechas.length,
        delEstado: estatal.nuevas,
        detalles,
        pendientesDetalle: repo.contarPendientes() });
    }

    const region = regionId ?? 54;
    const lista = await syncLista(repo, region);
    // Lo del Estado sirve vivas donde vivas: siempre se trae también.
    const estatal = await syncEstatal(repo);
    const detalles = await syncDetalles(repo, { limite: 600 });
    const refrescadas = await refrescarAbiertas(repo, { limite: 60 });
    return NextResponse.json({
      nuevas: lista.nuevas + estatal.nuevas,
      deTuComunidad: lista.nuevas,
      delEstado: estatal.nuevas,
      detalles,
      refrescadas,
      pendientesDetalle: repo.contarPendientes() });
  } catch (e) {
    return NextResponse.json(errorJson(e), { status: 500 });
  }
}
