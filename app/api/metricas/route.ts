import { NextRequest, NextResponse } from "next/server";
import { protegerApi } from "@/lib/seguridad";
import { leerTextoLimitado } from "@/lib/cuerpo-limitado";
import {
  borrarMetricasVisitante,
  registrarMetrica,
  type EntradaMetrica,
} from "@/lib/metricas-servidor";
import { TIPOS_METRICA, type TipoMetrica } from "@/lib/metricas-tipos";

export const dynamic = "force-dynamic";

const MAX_EVENTO_BYTES = 4_000;

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

function numeroAcotado(valor: unknown, maximo: number): number | undefined {
  if (typeof valor !== "number" || !Number.isFinite(valor)) return undefined;
  return Math.max(0, Math.min(maximo, Math.round(valor)));
}

export async function POST(req: NextRequest) {
  const limite = protegerApi(req, "metricas", 600, 60 * 60 * 1000, true);
  if (limite) return limite;
  if (!req.headers.get("content-type")?.toLowerCase().includes("application/json")) {
    return NextResponse.json({ error: "Se requiere JSON" }, { status: 415 });
  }
  const texto = await leerTextoLimitado(req, MAX_EVENTO_BYTES);
  if (texto === null) {
    return NextResponse.json({ error: "Evento demasiado grande" }, { status: 413 });
  }
  let cuerpo: Partial<EntradaMetrica>;
  try {
    cuerpo = JSON.parse(texto) as Partial<EntradaMetrica>;
  } catch {
    return NextResponse.json({ error: "JSON no válido" }, { status: 400 });
  }
  if (
    typeof cuerpo.visitanteId !== "string" ||
    !/^[a-f0-9-]{36}$/i.test(cuerpo.visitanteId) ||
    typeof cuerpo.sesionId !== "string" ||
    !/^[a-f0-9-]{36}$/i.test(cuerpo.sesionId) ||
    !TIPOS_METRICA.includes(cuerpo.tipo as TipoMetrica) ||
    (cuerpo.duracionSegundos !== undefined &&
      numeroAcotado(cuerpo.duracionSegundos, 86_400) === undefined) ||
    (cuerpo.radarSegundos !== undefined &&
      numeroAcotado(cuerpo.radarSegundos, 86_400) === undefined)
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
  try {
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
      duracionSegundos: numeroAcotado(cuerpo.duracionSegundos, 86_400),
      radarSegundos: numeroAcotado(cuerpo.radarSegundos, 86_400),
    });
    return NextResponse.json({ ok: true }, { status: 202 });
  } catch {
    // La analítica nunca debe impedir usar la aplicación.
    return NextResponse.json({ ok: false }, { status: 202 });
  }
}

export async function DELETE(req: NextRequest) {
  const limite = protegerApi(req, "borrar-metricas", 10, 60 * 60 * 1000, true);
  if (limite) return limite;
  if (!req.headers.get("content-type")?.toLowerCase().includes("application/json")) {
    return NextResponse.json({ error: "Se requiere JSON" }, { status: 415 });
  }
  const texto = await leerTextoLimitado(req, 500);
  if (texto === null) {
    return NextResponse.json({ error: "Petición demasiado grande" }, { status: 413 });
  }
  let cuerpo: { visitanteId?: unknown };
  try {
    cuerpo = JSON.parse(texto) as { visitanteId?: unknown };
  } catch {
    return NextResponse.json({ error: "JSON no válido" }, { status: 400 });
  }
  if (typeof cuerpo.visitanteId !== "string" || !/^[a-f0-9-]{36}$/i.test(cuerpo.visitanteId)) {
    return NextResponse.json({ error: "Identificador no válido" }, { status: 400 });
  }
  try {
    await borrarMetricasVisitante(cuerpo.visitanteId);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "No se han podido borrar las métricas" }, { status: 500 });
  }
}
