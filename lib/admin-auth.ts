import "server-only";

import { createHmac, createHash, timingSafeEqual } from "node:crypto";

export const COOKIE_ADMIN = "encaja_admin";
const OCHO_HORAS = 8 * 60 * 60;

function secreto(): string | null {
  const valor = process.env.ENCAJA_ADMIN_SESSION_SECRET;
  if (valor) return valor;
  return process.env.NODE_ENV === "production" ? null : "encaja-admin-desarrollo";
}

function firma(expira: string, clave: string): string {
  return createHmac("sha256", clave).update(`encaja-admin:${expira}`).digest("base64url");
}

export function claveAdminConfigurada(): boolean {
  return Boolean(process.env.ENCAJA_ADMIN_PASSWORD && secreto());
}

export function claveAdminCorrecta(intento: string): boolean {
  const esperada = process.env.ENCAJA_ADMIN_PASSWORD;
  if (!esperada) return false;
  const a = createHash("sha256").update(intento).digest();
  const b = createHash("sha256").update(esperada).digest();
  return timingSafeEqual(a, b);
}

export function crearSesionAdmin(): { token: string; maxAge: number } {
  const clave = secreto();
  if (!clave) throw new Error("Sesión de administración no configurada");
  const expira = String(Math.floor(Date.now() / 1000) + OCHO_HORAS);
  return { token: `${expira}.${firma(expira, clave)}`, maxAge: OCHO_HORAS };
}

export function sesionAdminValida(token?: string | null): boolean {
  if (!token) return false;
  const clave = secreto();
  if (!clave) return false;
  const [expira, recibida, resto] = token.split(".");
  if (!expira || !recibida || resto || !/^\d+$/.test(expira)) return false;
  if (Number(expira) <= Math.floor(Date.now() / 1000)) return false;
  const esperada = firma(expira, clave);
  const a = Buffer.from(recibida);
  const b = Buffer.from(esperada);
  return a.length === b.length && timingSafeEqual(a, b);
}
