import { NextRequest, NextResponse } from "next/server";
import {
  COOKIE_ADMIN,
  claveAdminConfigurada,
  claveAdminCorrecta,
  crearSesionAdmin,
} from "@/lib/admin-auth";
import { protegerApi } from "@/lib/seguridad";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const limite = protegerApi(req, "admin-login", 6, 15 * 60 * 1000);
  if (limite) return limite;
  if (!claveAdminConfigurada()) {
    return NextResponse.json({ error: "Administración no configurada" }, { status: 503 });
  }
  const { clave } = (await req.json()) as { clave?: unknown };
  if (typeof clave !== "string" || !claveAdminCorrecta(clave)) {
    return NextResponse.json({ error: "Clave incorrecta" }, { status: 401 });
  }
  const sesion = crearSesionAdmin();
  const respuesta = NextResponse.json({ ok: true });
  respuesta.cookies.set(COOKIE_ADMIN, sesion.token, {
    httpOnly: true,
    secure: req.nextUrl.protocol === "https:",
    sameSite: "strict",
    path: "/",
    maxAge: sesion.maxAge,
    priority: "high",
  });
  return respuesta;
}

export async function DELETE(req: NextRequest) {
  const limite = protegerApi(req, "admin-logout", 20, 15 * 60 * 1000);
  if (limite) return limite;
  const respuesta = NextResponse.json({ ok: true });
  respuesta.cookies.set(COOKIE_ADMIN, "", {
    httpOnly: true,
    secure: req.nextUrl.protocol === "https:",
    sameSite: "strict",
    path: "/",
    maxAge: 0,
  });
  return respuesta;
}
