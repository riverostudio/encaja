import { NextRequest, NextResponse } from "next/server";
import { getRepo, errorJson } from "@/lib/servidor";

export const dynamic = "force-dynamic";
const PERFIL = 1;

export async function GET() {
  return NextResponse.json({ hechos: getRepo().getHechosDetalle(PERFIL) });
}

export async function POST(req: NextRequest) {
  try {
    const { clave, valor } = (await req.json()) as { clave: string; valor: string };
    if (!clave?.trim()) return NextResponse.json({ error: "Falta la clave" }, { status: 400 });
    getRepo().setHecho(PERFIL, clave.trim(), valor ?? "", "manual");
    return NextResponse.json({ hechos: getRepo().getHechosDetalle(PERFIL) });
  } catch (e) {
    return NextResponse.json(errorJson(e), { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const clave = req.nextUrl.searchParams.get("clave");
    if (!clave) return NextResponse.json({ error: "Falta la clave" }, { status: 400 });
    getRepo().borrarHecho(PERFIL, clave);
    return NextResponse.json({ hechos: getRepo().getHechosDetalle(PERFIL) });
  } catch (e) {
    return NextResponse.json(errorJson(e), { status: 500 });
  }
}
