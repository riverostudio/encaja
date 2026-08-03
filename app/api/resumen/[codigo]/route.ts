import { NextRequest, NextResponse } from "next/server";
import { getRepo, errorJson } from "@/lib/servidor";
import { generar, hayClave } from "@/lib/gemini";
import { PROMPT_RESUMEN, parsearResumen } from "@/lib/requisitos";
import { importeCorto } from "@/lib/resumen";

export const dynamic = "force-dynamic";

/**
 * Escribe (una vez) el resumen en cristiano de una convocatoria y lo guarda.
 * Sin clave de Gemini no falla: la app sigue enseñando el resumen estructural.
 */
export async function POST(_req: NextRequest, ctx: { params: Promise<{ codigo: string }> }) {
  try {
    const { codigo } = await ctx.params;
    const repo = getRepo();
    const conv = repo.getConvocatoria(codigo);
    if (!conv) return NextResponse.json({ error: "Convocatoria no encontrada" }, { status: 404 });

    if (conv.resumenIa) {
      return NextResponse.json({ resumen: JSON.parse(conv.resumenIa), cacheado: true });
    }
    if (!hayClave(repo)) {
      return NextResponse.json({ resumen: null, sinClave: true });
    }

    const bolsa = importeCorto(conv.presupuesto);
    const ficha = [
      `Título oficial: ${conv.titulo}`,
      `Organismo: ${conv.nivel3 ?? conv.nivel2} (${conv.nivel1})`,
      conv.finalidad ? `Finalidad: ${conv.finalidad}` : null,
      conv.beneficiarios.length ? `Beneficiarios: ${conv.beneficiarios.join("; ")}` : null,
      conv.instrumentos.length ? `Instrumento: ${conv.instrumentos.join("; ")}` : null,
      bolsa ? `Presupuesto TOTAL del programa: ${bolsa}` : null,
      conv.fechaInicioSol || conv.fechaFinSol
        ? `Plazo: ${conv.fechaInicioSol ?? "?"} a ${conv.fechaFinSol ?? "?"}`
        : null,
      conv.fondos.length ? `Fondos: ${conv.fondos.join("; ")}` : null,
    ]
      .filter(Boolean)
      .join("\n");

    const respuesta = await generar(repo, [{ texto: `${PROMPT_RESUMEN}\n\n${ficha}` }], {
      esperaJson: true,
    });
    const resumen = parsearResumen(respuesta);
    if (!resumen) return NextResponse.json({ resumen: null, error: "Respuesta ilegible" });

    repo.guardarResumen(codigo, JSON.stringify(resumen));
    return NextResponse.json({ resumen, cacheado: false });
  } catch (e) {
    return NextResponse.json(errorJson(e), { status: 500 });
  }
}
