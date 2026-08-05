import { NextRequest, NextResponse } from "next/server";
import { credencialesDe } from "@/lib/sesion";
import { getRepo, errorJson } from "@/lib/servidor";
import { generar, hayClave } from "@/lib/ia";
import { PROMPT_RESUMEN, parsearResumen } from "@/lib/requisitos";
import { importeCorto } from "@/lib/resumen";
import type { Convocatoria, ResumenIA } from "@/lib/tipos";
import { protegerApi } from "@/lib/seguridad";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/** Tope por llamada: lo que cabe en una pantalla, no el archivo entero. */
const MAX_POR_TANDA = 8;

function ficha(conv: Convocatoria): string {
  const bolsa = importeCorto(conv.presupuesto);
  return [
    `Título oficial: ${conv.titulo}`,
    `Organismo: ${conv.nivel3 ?? conv.nivel2} (${conv.nivel1})`,
    conv.finalidad ? `Finalidad: ${conv.finalidad}` : null,
    conv.beneficiarios.length ? `Beneficiarios: ${conv.beneficiarios.join("; ")}` : null,
    conv.instrumentos.length ? `Instrumento: ${conv.instrumentos.join("; ")}` : null,
    bolsa ? `Presupuesto TOTAL del programa: ${bolsa}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

/**
 * Traduce SOLO las convocatorias que se le piden — las que el usuario tiene
 * delante — y guarda el resultado para siempre. Las que ya estaban traducidas
 * se devuelven de la base sin gastar ni una llamada.
 */
export async function POST(req: NextRequest) {
  try {
    const bloqueo = protegerApi(req, "resumen-lote", 40);
    if (bloqueo) return bloqueo;
    const cred = credencialesDe(req);
    const { codigos } = (await req.json()) as { codigos: string[] };
    if (!Array.isArray(codigos) || codigos.length === 0) {
      return NextResponse.json({ resumenes: {} });
    }
    const repo = getRepo();
    const resumenes: Record<string, ResumenIA> = {};
    const porTraducir: Convocatoria[] = [];

    for (const codigo of codigos.slice(0, 60)) {
      const conv = repo.getConvocatoria(codigo);
      if (!conv) continue;
      if (conv.resumenIa) {
        // Ya estaba: sale de la base, coste cero.
        try {
          resumenes[codigo] = JSON.parse(conv.resumenIa) as ResumenIA;
        } catch {
          porTraducir.push(conv);
        }
      } else {
        porTraducir.push(conv);
      }
    }

    if (porTraducir.length === 0 || (!cred && !hayClave(repo))) {
      return NextResponse.json({ resumenes, quedan: porTraducir.length });
    }

    // Se traducen unas pocas por llamada; el navegador vuelve a pedir si quedan.
    const tanda = porTraducir.slice(0, MAX_POR_TANDA);
    await Promise.all(
      tanda.map(async (conv) => {
        try {
          const texto = await generar(repo, [{ texto: `${PROMPT_RESUMEN}\n\n${ficha(conv)}` }], { esperaJson: true, credenciales: cred });
          const resumen = parsearResumen(texto);
          if (!resumen) return;
          repo.guardarResumen(conv.codigoBdns, JSON.stringify(resumen));
          resumenes[conv.codigoBdns] = resumen;
        } catch {
          // Una que falle no tumba la tanda: se reintentará al volver a verla.
        }
      }),
    );

    return NextResponse.json({
      resumenes,
      quedan: Math.max(0, porTraducir.length - tanda.length) });
  } catch (e) {
    return NextResponse.json(errorJson(e), { status: 500 });
  }
}
