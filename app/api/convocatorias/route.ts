import { NextRequest, NextResponse } from "next/server";
import { getRepo, buscarRadarConRed, errorJson } from "@/lib/servidor";
import { hechosDe } from "@/lib/sesion";
import { buscarPrestaciones } from "@/lib/prestaciones";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const q = req.nextUrl.searchParams;
    const r = buscarRadarConRed(getRepo(), {
      texto: q.get("texto") ?? undefined,
      nivel1: q.get("nivel1") ?? undefined,
      instrumento: q.get("instrumento") ?? undefined,
      beneficiario: q.get("beneficiario") ?? undefined,
      estado: q.get("estado") ?? undefined,
      region: q.get("region") ? Number(q.get("region")) : undefined,
      cp: q.get("cp") ?? undefined,
      soloAplicables: q.get("soloAplicables") === "1",
      hechos: hechosDe(req) ?? undefined });
    return NextResponse.json({
      ...r,
      prestaciones: q.get("texto") ? buscarPrestaciones(q.get("texto")!) : [],
    });
  } catch (e) {
    return NextResponse.json(errorJson(e), { status: 500 });
  }
}
