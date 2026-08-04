import { NextRequest, NextResponse } from "next/server";
import { getRepo, errorJson } from "@/lib/servidor";
import { detalle } from "@/lib/bdns";
import { estadoPlazo, formatoRango } from "@/lib/plazos";
import { urlFichaBdns } from "@/lib/expediente";
import { resumirEstructural } from "@/lib/resumen";
import type { ResumenIA } from "@/lib/tipos";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ codigo: string }> },
) {
  try {
    const { codigo } = await ctx.params;
    const repo = getRepo();
    let conv = repo.getConvocatoria(codigo);
    if (!conv || !conv.detalleAt) {
      // fetch-through: si no tenemos el detalle, se pide en vivo a la BDNS
      const vivo = await detalle(codigo);
      repo.upsertDetalle(vivo);
      conv = repo.getConvocatoria(codigo) ?? vivo;
    }
    const evaluacion = repo.getEvaluacion(codigo, 1);
    const expediente = repo.getExpediente(codigo);
    let resumen: ResumenIA | null = null;
    try {
      resumen = conv.resumenIa ? (JSON.parse(conv.resumenIa) as ResumenIA) : null;
    } catch {
      resumen = null;
    }

    return NextResponse.json({
      conv: {
        ...conv,
        plazo: estadoPlazo(conv.fechaInicioSol, conv.fechaFinSol),
        rangoFechas: formatoRango(conv.fechaInicioSol, conv.fechaFinSol),
        llano: resumirEstructural(conv),
        resumen },
      urlFicha: urlFichaBdns(codigo),
      evaluacion,
      expediente });
  } catch (e) {
    return NextResponse.json(errorJson(e), { status: 500 });
  }
}
