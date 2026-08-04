import { NextRequest, NextResponse } from "next/server";
import { idDeSesion } from "@/lib/sesion";
import { getRepo, errorJson } from "@/lib/servidor";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  return NextResponse.json({ hechos: getRepo().getHechosDetalle(idDeSesion(req)) });
}

export async function POST(req: NextRequest) {
  try {
    const { clave, valor } = (await req.json()) as { clave: string; valor: string };
    if (!clave?.trim()) return NextResponse.json({ error: "Falta la clave" }, { status: 400 });
    const perfil = idDeSesion(req);
    getRepo().setHecho(perfil, clave.trim(), valor ?? "", "manual");
    return NextResponse.json({ hechos: getRepo().getHechosDetalle(perfil) });
  } catch (e) {
    return NextResponse.json(errorJson(e), { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const clave = req.nextUrl.searchParams.get("clave");
    if (!clave) return NextResponse.json({ error: "Falta la clave" }, { status: 400 });
    const perfil = idDeSesion(req);
    getRepo().borrarHecho(perfil, clave);
    return NextResponse.json({ hechos: getRepo().getHechosDetalle(perfil) });
  } catch (e) {
    return NextResponse.json(errorJson(e), { status: 500 });
  }
}
