import { NextRequest, NextResponse } from "next/server";
import { getRepo, errorJson } from "@/lib/servidor";
import { descargarBases, detalle } from "@/lib/bdns";
import { evaluarEstructural } from "@/lib/encaje";
import { dictaminar } from "@/lib/dictamen";
import { generar, hayClave, type Parte } from "@/lib/gemini";
import {
  PROMPT_EXTRACCION,
  PROMPT_VEREDICTO,
  parsearRequisitos,
  parsearVeredictos,
  siguientePregunta,
} from "@/lib/requisitos";
import type { Convocatoria, Requisito } from "@/lib/tipos";

export const dynamic = "force-dynamic";
const PERFIL = 1;

async function obtenerRequisitos(conv: Convocatoria): Promise<Requisito[]> {
  const repo = getRepo();
  const previa = repo.getEvaluacion(conv.codigoBdns, PERFIL);
  if (previa?.requisitosJson) return JSON.parse(previa.requisitosJson) as Requisito[];

  const bases = await descargarBases(conv);
  const partes: Parte[] = [{ texto: PROMPT_EXTRACCION }];
  if (bases?.tipo === "pdf") {
    partes.push({ pdf: bases.datos as Buffer });
  } else if (bases?.tipo === "url") {
    // Bases publicadas como página web: se baja el HTML y se manda como texto plano.
    const r = await fetch(bases.datos as string, { redirect: "follow" }).catch(() => null);
    const html = r && r.ok ? await r.text() : "";
    const textoPlano = html.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<[^>]+>/g, " ");
    if (textoPlano.trim().length < 200) return [];
    partes.push({ texto: `BASES REGULADORAS (extraídas de ${bases.datos}):\n${textoPlano.slice(0, 100_000)}` });
  } else {
    return [];
  }
  const respuesta = await generar(getRepo(), partes, { esperaJson: true });
  const requisitos = parsearRequisitos(respuesta);
  repo.guardarEvaluacion(conv.codigoBdns, PERFIL, { requisitosJson: JSON.stringify(requisitos) });
  return requisitos;
}

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ codigo: string }> },
) {
  try {
    const { codigo } = await ctx.params;
    const cuerpo = (await req.json()) as {
      accion: "iniciar" | "responder" | "dictaminar";
      clave?: string;
      valor?: string;
    };
    const repo = getRepo();
    let conv = repo.getConvocatoria(codigo);
    if (!conv || !conv.detalleAt) {
      repo.upsertDetalle(await detalle(codigo));
      conv = repo.getConvocatoria(codigo)!;
    }

    if (cuerpo.accion === "responder" && cuerpo.clave && cuerpo.valor != null) {
      repo.setHecho(PERFIL, cuerpo.clave, cuerpo.valor, `entrevista ${codigo}`);
    }

    const hechos = repo.getHechos(PERFIL);
    const estructural = evaluarEstructural(conv, hechos);

    if (estructural.resultado === "no") {
      const resultado = dictaminar(estructural, [], []);
      repo.guardarEvaluacion(codigo, PERFIL, {
        dictamen: resultado.dictamen,
        motivosJson: JSON.stringify(resultado.motivos),
      });
      return NextResponse.json({ fase: "dictamen", ...resultado, estructural });
    }

    if (!hayClave(repo)) {
      return NextResponse.json({
        fase: "sin_ia",
        estructural,
        aviso:
          "Sin clave de Gemini solo puedo hacer el filtro estructural. Pega tu clave en Ajustes para leer las bases y hacer la entrevista completa.",
      });
    }

    const requisitos = await obtenerRequisitos(conv);
    if (requisitos.length === 0) {
      return NextResponse.json({
        fase: "sin_bases",
        estructural,
        aviso:
          "No he podido leer las bases (no hay PDF descargable). Ábrelas desde el enlace oficial y revisa los requisitos a mano.",
      });
    }

    if (cuerpo.accion === "dictaminar") {
      const lineasHechos = [...hechos.entries()].map(([k, v]) => `- ${k}: ${v}`).join("\n");
      const respuesta = await generar(
        repo,
        [
          {
            texto: `${PROMPT_VEREDICTO}\n\nREQUISITOS:\n${JSON.stringify(
              requisitos.filter((r) => r.tipo !== "documento"),
            )}\n\nDATOS DEL SOLICITANTE:\n${lineasHechos}`,
          },
        ],
        { esperaJson: true },
      );
      const veredictos = parsearVeredictos(respuesta);
      const resultado = dictaminar(estructural, requisitos, veredictos);
      repo.guardarEvaluacion(codigo, PERFIL, {
        dictamen: resultado.dictamen,
        veredictosJson: JSON.stringify(veredictos),
        motivosJson: JSON.stringify(resultado.motivos),
      });
      return NextResponse.json({ fase: "dictamen", ...resultado, requisitos, estructural });
    }

    const pregunta = siguientePregunta(requisitos, hechos);
    const evaluables = requisitos.filter((r) => r.tipo !== "documento" && r.clave);
    const respondidas = evaluables.filter((r) => hechos.has(r.clave!)).length;
    return NextResponse.json({
      fase: pregunta ? "entrevista" : "listo_para_dictamen",
      pregunta,
      progreso: { respondidas, total: evaluables.length },
      requisitos,
      estructural,
    });
  } catch (e) {
    return NextResponse.json(errorJson(e), { status: 500 });
  }
}
