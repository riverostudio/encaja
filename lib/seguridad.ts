import { NextRequest, NextResponse } from "next/server";
import { esPublico } from "./sesion";

const ventanas = new Map<string, number[]>();

export function identificadorCliente(req: NextRequest): string {
  return (
    req.headers.get("x-real-ip") ??
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "desconocida"
  );
}

function mismoOrigen(req: NextRequest): boolean {
  const origen = req.headers.get("origin");
  if (!origen) return true; // CLI, tarea programada o llamada servidor-servidor.
  try {
    const protocolo =
      req.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() ||
      req.nextUrl.protocol.replace(":", "");
    const host =
      req.headers.get("x-forwarded-host")?.split(",")[0]?.trim() || req.headers.get("host");
    return Boolean(host && new URL(origen).origin === `${protocolo}://${host}`);
  } catch {
    return false;
  }
}

/** Protección ligera por instancia; la plataforma añade su propio cortafuegos. */
export function protegerApi(
  req: NextRequest,
  ambito: string,
  maximo = 40,
  ventanaMs = 60 * 60 * 1000,
  exigirOrigen = false,
): NextResponse | null {
  if (exigirOrigen && process.env.NODE_ENV === "production" && !req.headers.get("origin")) {
    return NextResponse.json({ error: "Origen requerido" }, { status: 403 });
  }
  if (!mismoOrigen(req)) {
    return NextResponse.json({ error: "Origen no permitido" }, { status: 403 });
  }
  const ahora = Date.now();
  const clave = `${ambito}:${identificadorCliente(req)}`;
  const recientes = (ventanas.get(clave) ?? []).filter((ts) => ahora - ts < ventanaMs);
  if (recientes.length >= maximo) {
    const espera = Math.max(1, Math.ceil((ventanaMs - (ahora - recientes[0])) / 1000));
    return NextResponse.json(
      { error: "Demasiadas peticiones. Espera un poco y vuelve a intentarlo." },
      { status: 429, headers: { "Retry-After": String(espera) } },
    );
  }
  recientes.push(ahora);
  ventanas.set(clave, recientes);
  return null;
}

export function mantenimientoAutorizado(req: NextRequest): boolean {
  if (!esPublico()) return true;
  const secreto = process.env.ADMIN_SECRET ?? process.env.CRON_SECRET;
  return Boolean(secreto && req.headers.get("authorization") === `Bearer ${secreto}`);
}
