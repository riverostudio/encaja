import { NextRequest, NextResponse } from "next/server";
import { COOKIE_ADMIN, sesionAdminValida } from "@/lib/admin-auth";
import { obtenerResumenAdmin } from "@/lib/metricas-servidor";
import { getRepo } from "@/lib/servidor";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!sesionAdminValida(req.cookies.get(COOKIE_ADMIN)?.value)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const dias = Number(new URL(req.url).searchParams.get("dias") ?? 7);
  const resumen = await obtenerResumenAdmin(dias);
  const repo = getRepo();
  const titulos = Object.fromEntries(
    resumen.ayudas.map((ayuda) => {
      const conv = repo.getConvocatoria(ayuda.codigo);
      return [ayuda.codigo, conv?.titulo ?? `BDNS ${ayuda.codigo}`];
    }),
  );
  return NextResponse.json({ ...resumen, titulos });
}
