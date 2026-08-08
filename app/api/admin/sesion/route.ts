import { NextRequest, NextResponse } from "next/server";
import {
  COOKIE_ADMIN,
  claveAdminConfigurada,
  claveAdminCorrecta,
  crearSesionAdmin,
} from "@/lib/admin-auth";
import { identificadorCliente, protegerApi } from "@/lib/seguridad";
import { leerTextoLimitado } from "@/lib/cuerpo-limitado";
import {
  estadoLimiteAdmin,
  limpiarFallosAdmin,
  registrarFalloAdmin,
} from "@/lib/metricas-servidor";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const limite = protegerApi(req, "admin-login", 6, 15 * 60 * 1000, true);
  if (limite) return limite;
  const cliente = identificadorCliente(req);
  const bloqueo = await estadoLimiteAdmin(cliente);
  if (bloqueo.bloqueado) {
    return NextResponse.json(
      { error: "Demasiados intentos. Espera antes de volver a probar." },
      { status: 429, headers: { "Retry-After": String(bloqueo.esperaSegundos) } },
    );
  }
  if (!claveAdminConfigurada()) {
    return NextResponse.json({ error: "Administración no configurada" }, { status: 503 });
  }
  if (!req.headers.get("content-type")?.toLowerCase().includes("application/json")) {
    return NextResponse.json({ error: "Se requiere JSON" }, { status: 415 });
  }
  try {
    const texto = await leerTextoLimitado(req, 500);
    if (texto === null) {
      return NextResponse.json({ error: "Petición demasiado grande" }, { status: 413 });
    }
    const { clave } = JSON.parse(texto) as { clave?: unknown };
    if (typeof clave !== "string" || clave.length > 200 || !claveAdminCorrecta(clave)) {
      const fallo = await registrarFalloAdmin(cliente);
      if (fallo.bloqueado) {
        return NextResponse.json(
          { error: "Demasiados intentos. Espera antes de volver a probar." },
          { status: 429, headers: { "Retry-After": String(fallo.esperaSegundos) } },
        );
      }
      return NextResponse.json({ error: "Clave incorrecta" }, { status: 401 });
    }
  } catch {
    return NextResponse.json({ error: "Petición no válida" }, { status: 400 });
  }
  await limpiarFallosAdmin(cliente);
  const sesion = crearSesionAdmin();
  const respuesta = NextResponse.json({ ok: true });
  respuesta.cookies.set(COOKIE_ADMIN, sesion.token, {
    httpOnly: true,
    secure: process.env.VERCEL === "1" || req.nextUrl.protocol === "https:",
    sameSite: "strict",
    path: "/",
    maxAge: sesion.maxAge,
    priority: "high",
  });
  return respuesta;
}

export async function DELETE(req: NextRequest) {
  const limite = protegerApi(req, "admin-logout", 20, 15 * 60 * 1000, true);
  if (limite) return limite;
  const respuesta = NextResponse.json({ ok: true });
  respuesta.cookies.set(COOKIE_ADMIN, "", {
    httpOnly: true,
    secure: process.env.VERCEL === "1" || req.nextUrl.protocol === "https:",
    sameSite: "strict",
    path: "/",
    maxAge: 0,
  });
  return respuesta;
}
