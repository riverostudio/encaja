import { NextRequest, NextResponse } from "next/server";
import { credencialesDe, esPublico, hechosDe, idDeSesion, validarRequisitos } from "@/lib/sesion";
import { getRepo, errorJson } from "@/lib/servidor";
import { detalle } from "@/lib/bdns";
import { obtenerRequisitos, EXPLICACION_SIN_BASES } from "@/lib/bases";
import { evaluarEstructural } from "@/lib/encaje";
import { dictaminar } from "@/lib/dictamen";
import { generar, hayClave } from "@/lib/ia";
import {
  PROMPT_VEREDICTO,
  parsearVeredictos,
  siguientePregunta,
  preguntables } from "@/lib/requisitos";
import { protegerApi } from "@/lib/seguridad";


export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ codigo: string }> },
) {
  try {
    const bloqueo = protegerApi(req, "encaje", 80);
    if (bloqueo) return bloqueo;
    const { codigo } = await ctx.params;
    const cuerpo = (await req.json()) as {
      accion: "iniciar" | "responder" | "dictaminar";
      clave?: string;
      valor?: string;
      requisitos?: unknown;
    };
    const repo = getRepo();
    // Si el navegador trae su perfil, es un visitante: nada suyo se guarda aquí.
    const propios = hechosDe(req);
    const perfil = idDeSesion(req);
    const guardar = !propios;
    const cred = credencialesDe(req);
    let conv = repo.getConvocatoria(codigo);
    if (!conv || !conv.detalleAt) {
      const vivo = await detalle(codigo);
      if (!esPublico()) repo.upsertDetalle(vivo);
      conv = esPublico() ? vivo : repo.getConvocatoria(codigo)!;
    }

    const hechos = propios ?? repo.getHechos(perfil);
    if (cuerpo.accion === "responder" && cuerpo.clave && cuerpo.valor != null) {
      hechos.set(cuerpo.clave, cuerpo.valor);
      if (guardar) repo.setHecho(perfil, cuerpo.clave, cuerpo.valor, `entrevista ${codigo}`);
    }
    const estructural = evaluarEstructural(conv, hechos);

    if (estructural.resultado === "no") {
      const resultado = dictaminar(estructural, [], []);
      if (guardar) repo.guardarEvaluacion(codigo, perfil, {
        dictamen: resultado.dictamen,
        motivosJson: JSON.stringify(resultado.motivos) });
      return NextResponse.json({ fase: "dictamen", ...resultado, estructural });
    }

    if (!cred && !hayClave(repo)) {
      return NextResponse.json({
        fase: "sin_ia",
        estructural,
        aviso:
          "Sin clave de IA solo puedo hacer el filtro con los datos oficiales. Pon tu clave en Ajustes para que además lea las bases y te entreviste." });
    }

    const propiosRequisitos = validarRequisitos(cuerpo.requisitos);
    const lectura = propiosRequisitos
      ? { requisitos: propiosRequisitos }
      : await obtenerRequisitos(repo, conv, perfil, cred);
    const requisitos = lectura.requisitos;
    if (requisitos.length === 0) {
      return NextResponse.json({
        fase: "sin_bases",
        estructural,
        aviso: lectura.motivo
          ? EXPLICACION_SIN_BASES[lectura.motivo]
          : "No he podido sacar los requisitos de las bases. Ábrelas en el enlace oficial." });
    }

    if (cuerpo.accion === "dictaminar") {
      const lineasHechos = [...hechos.entries()].map(([k, v]) => `- ${k}: ${v}`).join("\n");
      const respuesta = await generar(
        repo,
        [
          {
            texto: `${PROMPT_VEREDICTO}\n\nREQUISITOS:\n${JSON.stringify(
              requisitos.filter((r) => r.tipo !== "documento"),
            )}\n\nDATOS DEL SOLICITANTE:\n${lineasHechos}` },
        ],
        { esperaJson: true, credenciales: cred },
      );
      const veredictos = parsearVeredictos(respuesta);
      const resultado = dictaminar(estructural, requisitos, veredictos);
      if (guardar) repo.guardarEvaluacion(codigo, perfil, {
        dictamen: resultado.dictamen,
        veredictosJson: JSON.stringify(veredictos),
        motivosJson: JSON.stringify(resultado.motivos) });
      return NextResponse.json({ fase: "dictamen", ...resultado, requisitos, estructural });
    }

    const pregunta = siguientePregunta(requisitos, hechos);
    // El total que se enseña es el que de verdad se va a preguntar.
    const quedan = preguntables(requisitos, hechos).length;
    const yaRespondidas = requisitos.filter(
      (r) => r.tipo !== "documento" && r.clave && hechos.has(r.clave),
    ).length;
    return NextResponse.json({
      fase: pregunta ? "entrevista" : "listo_para_dictamen",
      pregunta,
      progreso: { respondidas: yaRespondidas, total: yaRespondidas + quedan },
      requisitos,
      estructural });
  } catch (e) {
    return NextResponse.json(errorJson(e), { status: 500 });
  }
}
