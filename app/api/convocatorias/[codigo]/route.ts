import { NextRequest, NextResponse } from "next/server";
import { getRepo, errorJson } from "@/lib/servidor";
import { detalle } from "@/lib/bdns";
import { estadoPlazo } from "@/lib/plazos";
import { urlFichaBdns } from "@/lib/expediente";

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
    return NextResponse.json({
      conv: { ...conv, plazo: estadoPlazo(conv.fechaInicioSol, conv.fechaFinSol) },
      urlFicha: urlFichaBdns(codigo),
      evaluacion,
      expediente,
    });
  } catch (e) {
    return NextResponse.json(errorJson(e), { status: 500 });
  }
}
