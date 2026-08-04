import { NextRequest, NextResponse } from "next/server";
import { credencialesDe, idDeSesion } from "@/lib/sesion";
import { getRepo, dirExpedientes, errorJson } from "@/lib/servidor";
import { crearCarpetaExpediente, escribirInstrucciones, montarChecklist } from "@/lib/expediente";
import { obtenerRequisitos, EXPLICACION_SIN_BASES } from "@/lib/bases";
import { estadoPlazo } from "@/lib/plazos";
import type { Requisito } from "@/lib/tipos";

export const dynamic = "force-dynamic";

export async function GET() {
  const repo = getRepo();
  const filas = repo.listarExpedientes().map((e) => {
    const conv = repo.getConvocatoria(e.codigoBdns);
    return {
      ...e,
      titulo: conv?.titulo ?? e.codigoBdns,
      organo: conv ? (conv.nivel3 ?? conv.nivel2) : "",
      plazo: conv ? estadoPlazo(conv.fechaInicioSol, conv.fechaFinSol) : null };
  });
  return NextResponse.json({ filas });
}

export async function POST(req: NextRequest) {
  try {
    const perfil = idDeSesion(req);
    const cred = credencialesDe(req);
    const { codigo } = (await req.json()) as { codigo: string };
    const repo = getRepo();
    const conv = repo.getConvocatoria(codigo);
    if (!conv) return NextResponse.json({ error: "Convocatoria no encontrada" }, { status: 404 });

    // El expediente nunca nace a medias: si aún no se han leído las bases,
    // se leen ahora. Y si no se puede, se dice por qué.
    let aviso: string | null = null;
    let requisitos: Requisito[] = [];
    try {
      const r = await obtenerRequisitos(repo, conv, perfil, cred);
      requisitos = r.requisitos;
      if (r.motivo) aviso = EXPLICACION_SIN_BASES[r.motivo];
    } catch (e) {
      aviso = e instanceof Error ? e.message : "No se han podido leer las bases.";
    }

    const carpeta = crearCarpetaExpediente(dirExpedientes(), conv);
    escribirInstrucciones(carpeta, conv, requisitos);
    repo.crearExpediente(codigo, perfil, carpeta, JSON.stringify(montarChecklist(requisitos)));
    if (requisitos.length > 0) {
      // La checklist puede haberse creado vacía en una visita anterior.
      repo.actualizarExpediente(codigo, {
        checklistJson: JSON.stringify(montarChecklist(requisitos)) });
    }
    return NextResponse.json({ expediente: repo.getExpediente(codigo), aviso });
  } catch (e) {
    return NextResponse.json(errorJson(e), { status: 500 });
  }
}
