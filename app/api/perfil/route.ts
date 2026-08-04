import { NextRequest, NextResponse } from "next/server";
import { hechosDe, idDeSesion, esPublico } from "@/lib/sesion";
import { getRepo, errorJson } from "@/lib/servidor";
import {
  atajosParaPerfil,
  beneficiarioDesdePerfil,
  hechosDerivados,
  preguntasAplicables,
  progresoPerfil,
  resumenPerfil,
  siguientePreguntaPerfil } from "@/lib/perfil";
import { resolverCP } from "@/lib/territorio";
import { prestacionesParaPerfil } from "@/lib/prestaciones";

export const dynamic = "force-dynamic";

function estado(req: NextRequest) {
  const repo = getRepo();
  // En la app pública el perfil viaja en la petición y no se guarda en el
  // servidor; en tu ordenador sale de la base, como siempre.
  const hechos = hechosDe(req) ?? repo.getHechos(idDeSesion(req));
  const siguiente = siguientePreguntaPerfil(hechos);
  const cp = hechos.get("cp");
  return NextResponse.json({
    respuestas: Object.fromEntries(hechos),
    siguiente: siguiente
      ? {
          clave: siguiente.clave,
          pregunta: siguiente.pregunta,
          ayuda: siguiente.ayuda,
          tipo: siguiente.tipo,
          opciones: siguiente.opciones ?? null }
      : null,
    progreso: progresoPerfil(hechos),
    resumen: resumenPerfil(hechos),
    beneficiario: beneficiarioDesdePerfil(hechos),
    atajos: atajosParaPerfil(hechos),
    // Lo que NO está en la BDNS: paro, IMV, bono social… (ver lib/prestaciones)
    prestaciones: prestacionesParaPerfil(hechos),
    zona: cp ? resolverCP(cp) : null,
    preguntas: preguntasAplicables(hechos).map((p) => ({
      clave: p.clave,
      pregunta: p.pregunta,
      tipo: p.tipo,
      opciones: p.opciones ?? null })) });
}

export async function GET(req: NextRequest) {
  return estado(req);
}

export async function POST(req: NextRequest) {
  try {
    const { clave, valor } = (await req.json()) as { clave: string; valor: string };
    if (!clave) return NextResponse.json({ error: "Falta la pregunta" }, { status: 400 });
    // El navegador que trae su propio perfil se lo guarda él: aquí solo se
    // calcula la siguiente pregunta y se devuelve el estado.
    if (hechosDe(req)) return estado(req);

    const repo = getRepo();
    const perfil = idDeSesion(req);
    repo.setHecho(perfil, clave, valor ?? "", "perfil");

    // El perfil alimenta a la entrevista de cada ayuda: así no repregunta.
    for (const [k, v] of Object.entries(hechosDerivados(repo.getHechos(perfil)))) {
      repo.setHecho(perfil, k, v, "perfil");
    }
    if (clave === "cp" && valor && !esPublico()) repo.setAjuste("cp", valor);
    return estado(req);
  } catch (e) {
    return NextResponse.json(errorJson(e), { status: 500 });
  }
}

/** Borra una respuesta para volver a preguntarla. */
export async function DELETE(req: NextRequest) {
  try {
    const clave = req.nextUrl.searchParams.get("clave");
    if (!clave) return NextResponse.json({ error: "Falta la pregunta" }, { status: 400 });
    if (!hechosDe(req)) getRepo().borrarHecho(idDeSesion(req), clave);
    return estado(req);
  } catch (e) {
    return NextResponse.json(errorJson(e), { status: 500 });
  }
}
