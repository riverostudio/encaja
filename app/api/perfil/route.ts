import { NextRequest, NextResponse } from "next/server";
import { getRepo, errorJson } from "@/lib/servidor";
import {
  atajosParaPerfil,
  beneficiarioDesdePerfil,
  hechosDerivados,
  preguntasAplicables,
  progresoPerfil,
  resumenPerfil,
  siguientePreguntaPerfil,
} from "@/lib/perfil";
import { resolverCP } from "@/lib/territorio";

export const dynamic = "force-dynamic";
const PERFIL = 1;

function estado() {
  const repo = getRepo();
  const hechos = repo.getHechos(PERFIL);
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
          opciones: siguiente.opciones ?? null,
        }
      : null,
    progreso: progresoPerfil(hechos),
    resumen: resumenPerfil(hechos),
    beneficiario: beneficiarioDesdePerfil(hechos),
    atajos: atajosParaPerfil(hechos),
    zona: cp ? resolverCP(cp) : null,
    preguntas: preguntasAplicables(hechos).map((p) => ({
      clave: p.clave,
      pregunta: p.pregunta,
      tipo: p.tipo,
      opciones: p.opciones ?? null,
    })),
  });
}

export async function GET() {
  return estado();
}

export async function POST(req: NextRequest) {
  try {
    const { clave, valor } = (await req.json()) as { clave: string; valor: string };
    if (!clave) return NextResponse.json({ error: "Falta la pregunta" }, { status: 400 });
    const repo = getRepo();
    repo.setHecho(PERFIL, clave, valor ?? "", "perfil");

    // El perfil alimenta a la entrevista de cada ayuda: así no repregunta.
    for (const [k, v] of Object.entries(hechosDerivados(repo.getHechos(PERFIL)))) {
      repo.setHecho(PERFIL, k, v, "perfil");
    }
    if (clave === "cp" && valor) repo.setAjuste("cp", valor);
    return estado();
  } catch (e) {
    return NextResponse.json(errorJson(e), { status: 500 });
  }
}

/** Borra una respuesta para volver a preguntarla. */
export async function DELETE(req: NextRequest) {
  try {
    const clave = req.nextUrl.searchParams.get("clave");
    if (!clave) return NextResponse.json({ error: "Falta la pregunta" }, { status: 400 });
    getRepo().borrarHecho(PERFIL, clave);
    return estado();
  } catch (e) {
    return NextResponse.json(errorJson(e), { status: 500 });
  }
}
