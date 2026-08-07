import { NextRequest, NextResponse } from "next/server";
import { protegerApi } from "@/lib/seguridad";
import {
  registrarMetrica,
  type EntradaMetrica,
} from "@/lib/metricas-servidor";
import { TIPOS_METRICA, type TipoMetrica } from "@/lib/metricas-tipos";

export const dynamic = "force-dynamic";

const CATEGORIAS = new Set([
  "vivienda",
  "empleo",
  "estudios",
  "familia",
  "autonomos",
  "ingresos",
  "energia",
  "discapacidad",
  "transporte",
  "otros",
  "ia",
  "guiado",
  "particular",
  "autonomo",
  "empresa",
  "encaja",
  "no_encaja",
  "duda",
  "pendiente",
]);

function paginaSegura(valor: unknown): string {
  if (typeof valor !== "string" || !valor.startsWith("/")) return "/";
  const sinConsulta = valor.split("?")[0].slice(0, 100);
  if (/^\/expedientes\/\d+$/.test(sinConsulta)) return "/expedientes/[ayuda]";
  return /^\/[a-z0-9/_-]*$/i.test(sinConsulta) ? sinConsulta : "/";
}

export async function POST(req: NextRequest) {
  const limite = protegerApi(req, "metricas", 600, 60 * 60 * 1000);
  if (limite) return limite;
  const longitud = Number(req.headers.get("content-length") ?? 0);
  if (longitud > 4_000) {
    return NextResponse.json({ error: "Evento demasiado grande" }, { status: 413 });
  }
  try {
    const cuerpo = (await req.json()) as Partial<EntradaMetrica>;
    if (
      typeof cuerpo.visitanteId !== "string" ||
      !/^[a-f0-9-]{36}$/i.test(cuerpo.visitanteId) ||
      typeof cuerpo.sesionId !== "string" ||
      !/^[a-f0-9-]{36}$/i.test(cuerpo.sesionId) ||
      !TIPOS_METRICA.includes(cuerpo.tipo as TipoMetrica)
    ) {
      return NextResponse.json({ error: "Evento no válido" }, { status: 400 });
    }
    const categoria =
      typeof cuerpo.categoria === "string" && CATEGORIAS.has(cuerpo.categoria)
        ? cuerpo.categoria
        : null;
    const codigoBdns =
      typeof cuerpo.codigoBdns === "string" && /^\d{1,12}$/.test(cuerpo.codigoBdns)
        ? cuerpo.codigoBdns
        : null;
    await registrarMetrica({
      visitanteId: cuerpo.visitanteId,
      sesionId: cuerpo.sesionId,
      tipo: cuerpo.tipo as TipoMetrica,
      pagina: paginaSegura(cuerpo.pagina),
      categoria,
      codigoBdns,
      valor:
        typeof cuerpo.valor === "number" && Number.isFinite(cuerpo.valor)
          ? Math.max(0, Math.min(100_000, Math.round(cuerpo.valor)))
          : null,
      duracionSegundos: cuerpo.duracionSegundos,
      radarSegundos: cuerpo.radarSegundos,
    });
    return NextResponse.json({ ok: true }, { status: 202 });
  } catch {
    // La analítica nunca debe impedir usar la aplicación.
    return NextResponse.json({ ok: false }, { status: 202 });
  }
}
