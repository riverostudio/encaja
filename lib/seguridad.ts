import { NextRequest, NextResponse } from "next/server";
import { esPublico } from "./sesion";

const ventanas = new Map<string, number[]>();

function ipDe(req: NextRequest): string {
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
    return new URL(origen).host === req.headers.get("host");
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
): NextResponse | null {
  if (!mismoOrigen(req)) {
    return NextResponse.json({ error: "Origen no permitido" }, { status: 403 });
  }
  const ahora = Date.now();
  const clave = `${ambito}:${ipDe(req)}`;
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

