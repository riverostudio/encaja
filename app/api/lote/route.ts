import { NextRequest, NextResponse } from "next/server";
import { credencialesDe } from "@/lib/sesion";
import { getRepo, errorJson } from "@/lib/servidor";
import { generar, hayClave } from "@/lib/ia";
import { PROMPT_RESUMEN, parsearResumen } from "@/lib/requisitos";
import { PROMPT_FECHAS, parsearFechas } from "@/lib/fechas";
import { descargarBases } from "@/lib/bdns";
import { importeCorto } from "@/lib/resumen";
import { estadoPlazo } from "@/lib/plazos";
import type { Convocatoria } from "@/lib/tipos";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

function fichaDe(conv: Convocatoria): string {
  const bolsa = importeCorto(conv.presupuesto);
  return [
    `Título oficial: ${conv.titulo}`,
    `Organismo: ${conv.nivel3 ?? conv.nivel2} (${conv.nivel1})`,
    conv.finalidad ? `Finalidad: ${conv.finalidad}` : null,
    conv.beneficiarios.length ? `Beneficiarios: ${conv.beneficiarios.join("; ")}` : null,
    conv.instrumentos.length ? `Instrumento: ${conv.instrumentos.join("; ")}` : null,
    bolsa ? `Presupuesto TOTAL del programa: ${bolsa}` : null,
    conv.fechaInicioSol || conv.fechaFinSol
      ? `Plazo: ${conv.fechaInicioSol ?? "?"} a ${conv.fechaFinSol ?? "?"}`
      : null,
  ]
    .filter(Boolean)
    .join("\n");
}

/**
 * Trabajo en lote sobre las convocatorias vigentes: traducirlas a lenguaje
 * llano y rescatar del PDF las fechas que la BDNS no publica. Se hace por
 * tandas cortas para poder ver el avance y poder pararlo.
 */
export async function POST(req: NextRequest) {
  try {
    const cred = credencialesDe(req);
    const { tarea, tanda = 12 } = (await req.json()) as {
      tarea: "traducir" | "fechas";
      tanda?: number;
    };
    const repo = getRepo();
    if (!cred && !hayClave(repo)) {
      return NextResponse.json({ error: "Configura tu clave de IA en Ajustes" }, { status: 400 });
    }

    const candidatas = repo
      .buscar({ limite: 4000 })
      .filter((c) => {
        const abierta = estadoPlazo(c.fechaInicioSol, c.fechaFinSol).estado;
        if (tarea === "traducir") {
          return !c.resumenIa && abierta !== "cerrada";
        }
        // Solo tiene sentido buscar fechas donde no las hay y hay dónde mirar.
        return (
          !c.fechaFinSol && !c.fechaInicioSol && !c.sinFechasConfirmado && !c.plazoRelativo && Boolean(c.detalleJson)
        );
      });

    let hechas = 0;
    let fallos = 0;
    for (const conv of candidatas.slice(0, tanda)) {
      try {
        if (tarea === "traducir") {
          const texto = await generar(repo, [{ texto: `${PROMPT_RESUMEN}\n\n${fichaDe(conv)}` }], { esperaJson: true, credenciales: cred });
          const resumen = parsearResumen(texto);
          if (!resumen) {
            fallos++;
            continue;
          }
          repo.guardarResumen(conv.codigoBdns, JSON.stringify(resumen));
        } else {
          const bases = await descargarBases(conv);
          if (!bases || bases.tipo !== "pdf") {
            // Sin PDF no hay nada que rescatar: se marca para no reintentarlo.
            repo.marcarSinFechas(conv.codigoBdns);
            fallos++;
            continue;
          }
          const texto = await generar(
            repo,
            [{ texto: PROMPT_FECHAS }, { pdf: bases.datos as Buffer }],
            { esperaJson: true, credenciales: cred },
          );
          const fechas = parsearFechas(texto);
          if (!fechas) {
            repo.marcarSinFechas(conv.codigoBdns);
            fallos++;
            continue;
          }
          repo.guardarFechasRescatadas(conv.codigoBdns, fechas.inicio, fechas.fin, fechas.relativo);
        }
        hechas++;
      } catch {
        fallos++;
      }
    }

    return NextResponse.json({
      hechas,
      fallos,
      quedan: Math.max(0, candidatas.length - tanda),
      total: candidatas.length });
  } catch (e) {
    return NextResponse.json(errorJson(e), { status: 500 });
  }
}

/** Cuánto queda por hacer, para poder enseñar el avance. */
export async function GET() {
  const repo = getRepo();
  const todas = repo.buscar({ limite: 4000 });
  const sinTraducir = todas.filter(
    (c) => !c.resumenIa && estadoPlazo(c.fechaInicioSol, c.fechaFinSol).estado !== "cerrada",
  ).length;
  const sinFechas = todas.filter(
    (c) => !c.fechaFinSol && !c.fechaInicioSol && !c.sinFechasConfirmado && !c.plazoRelativo && Boolean(c.detalleJson),
  ).length;
  return NextResponse.json({
    sinTraducir,
    sinFechas,
    // Lo ya guardado: es lo que de verdad interesa ver crecer.
    traducidas: todas.filter((c) => Boolean(c.resumenIa)).length,
    total: todas.length,
    configurada: hayClave(repo) });
}
