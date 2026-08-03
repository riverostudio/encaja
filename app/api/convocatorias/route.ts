import { NextRequest, NextResponse } from "next/server";
import { getRepo, buscarRadar, errorJson } from "@/lib/servidor";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const q = req.nextUrl.searchParams;
    const filas = buscarRadar(getRepo(), {
      texto: q.get("texto") ?? undefined,
      nivel1: q.get("nivel1") ?? undefined,
      instrumento: q.get("instrumento") ?? undefined,
      beneficiario: q.get("beneficiario") ?? undefined,
      estado: q.get("estado") ?? undefined,
      region: q.get("region") ? Number(q.get("region")) : undefined,
      cp: q.get("cp") ?? undefined,
      soloAplicables: q.get("soloAplicables") === "1",
    });
    return NextResponse.json({ filas });
  } catch (e) {
    return NextResponse.json(errorJson(e), { status: 500 });
  }
}
