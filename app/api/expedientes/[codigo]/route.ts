import { NextRequest, NextResponse } from "next/server";
import { credencialesDe, idDeSesion } from "@/lib/sesion";
import { execFile } from "node:child_process";
import { getRepo, errorJson } from "@/lib/servidor";
import { generarBorradorDocx, escribirInstrucciones, urlFichaBdns } from "@/lib/expediente";
import { generar, hayClave } from "@/lib/ia";
import { estadoPlazo, formatoRango } from "@/lib/plazos";
import { resumirEstructural } from "@/lib/resumen";
import type { ItemChecklist, Requisito, ResumenIA } from "@/lib/tipos";
import { esPublico } from "@/lib/sesion";

function leerResumenIa(json?: string | null): ResumenIA | null {
  if (!json) return null;
  try {
    return JSON.parse(json) as ResumenIA;
  } catch {
    return null;
  }
}

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ codigo: string }> },
) {
  if (esPublico()) {
    return NextResponse.json(
      { error: "El expediente público pertenece al navegador que lo creó." },
      { status: 405 },
    );
  }
  const perfil = idDeSesion(req);
  const { codigo } = await ctx.params;
  const repo = getRepo();
  const e = repo.getExpediente(codigo);
  if (!e) return NextResponse.json({ error: "No existe el expediente" }, { status: 404 });
  const conv = repo.getConvocatoria(codigo);
  const evaluacion = repo.getEvaluacion(codigo, perfil);
  const destinoSolicitud = conv?.sede ? "sede" : conv?.urlBases ? "bases" : "ficha";
  const requisitos: Requisito[] = evaluacion?.requisitosJson
    ? (JSON.parse(evaluacion.requisitosJson) as Requisito[])
    : [];

  return NextResponse.json({
    expediente: e,
    conv: conv
      ? {
          ...conv,
          plazo: estadoPlazo(conv.fechaInicioSol, conv.fechaFinSol),
          rangoFechas: formatoRango(conv.fechaInicioSol, conv.fechaFinSol),
          llano: resumirEstructural(conv),
          resumen: leerResumenIa(conv.resumenIa),
          urlFicha: urlFichaBdns(codigo) }
      : null,
    // Todo lo que hay que cumplir, no solo lo que hay que aportar.
    condiciones: requisitos.filter((r) => r.tipo !== "documento"),
    veredicto: evaluacion?.dictamen ?? null,
    // Dónde se presenta: sede, bases o, como alternativa segura, ficha BDNS.
    dondeSolicitar: conv?.sede ?? conv?.urlBases ?? urlFichaBdns(codigo),
    destinoSolicitud });
}

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ codigo: string }> },
) {
  try {
    if (esPublico()) {
      return NextResponse.json({ error: "Operación local no disponible en la web." }, { status: 405 });
    }
    const { codigo } = await ctx.params;
    const cuerpo = (await req.json()) as {
      estado?: string;
      item?: { id: string; estado: ItemChecklist["estado"]; nota?: string };
    };
    const repo = getRepo();
    const e = repo.getExpediente(codigo);
    if (!e) return NextResponse.json({ error: "No existe el expediente" }, { status: 404 });

    if (cuerpo.estado) repo.actualizarExpediente(codigo, { estado: cuerpo.estado });
    if (cuerpo.item) {
      const lista = JSON.parse(e.checklistJson) as ItemChecklist[];
      const item = lista.find((i) => i.id === cuerpo.item!.id);
      if (item) {
        item.estado = cuerpo.item.estado;
        if (cuerpo.item.nota !== undefined) item.nota = cuerpo.item.nota;
      }
      repo.actualizarExpediente(codigo, { checklistJson: JSON.stringify(lista) });
    }
    return NextResponse.json({ expediente: repo.getExpediente(codigo) });
  } catch (e) {
    return NextResponse.json(errorJson(e), { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ codigo: string }> },
) {
  try {
    if (esPublico()) {
      return NextResponse.json({ error: "Operación local no disponible en la web." }, { status: 405 });
    }
    const perfil = idDeSesion(req);
    const cred = credencialesDe(req);
    const { codigo } = await ctx.params;
    const cuerpo = (await req.json()) as {
      accion: "borrador" | "abrir_carpeta" | "regenerar_instrucciones";
      tipo?: "memoria" | "declaracion";
    };
    const repo = getRepo();
    const e = repo.getExpediente(codigo);
    const conv = repo.getConvocatoria(codigo);
    if (!e || !conv) return NextResponse.json({ error: "No existe el expediente" }, { status: 404 });

    if (cuerpo.accion === "abrir_carpeta") {
      // App local en el Mac del usuario: abre la carpeta en Finder.
      execFile("open", [e.carpeta]);
      return NextResponse.json({ ok: true });
    }

    if (cuerpo.accion === "regenerar_instrucciones") {
      const evalu = repo.getEvaluacion(codigo, perfil);
      const reqs: Requisito[] = evalu?.requisitosJson ? JSON.parse(evalu.requisitosJson) : [];
      escribirInstrucciones(e.carpeta, conv, reqs);
      return NextResponse.json({ ok: true });
    }

    if (!hayClave(repo)) {
      return NextResponse.json(
        { error: "SIN_CLAVE_GEMINI: pega tu clave en Ajustes para redactar borradores" },
        { status: 400 },
      );
    }

    const hechos = [...repo.getHechos(perfil).entries()]
      .map(([k, v]) => `- ${k}: ${v}`)
      .join("\n");
    const tipoDoc = cuerpo.tipo === "declaracion" ? "declaración responsable" : "memoria técnica";
    const respuesta = await generar(
      repo,
      [
        {
          texto: `Redacta una ${tipoDoc} en español formal administrativo para solicitar esta subvención.
Convocatoria: ${conv.titulo}
Órgano: ${conv.nivel3 ?? conv.nivel2}
Datos del solicitante:
${hechos || "(sin datos: deja huecos [COMPLETAR])"}

Devuelve SOLO JSON: {"titulo":"...","secciones":[{"h":"encabezado","p":["párrafo 1","párrafo 2"]}]}
Donde falte un dato usa [COMPLETAR: qué falta]. No inventes cifras ni fechas.` },
      ],
      { esperaJson: true, credenciales: cred },
    );
    const ini = respuesta.indexOf("{");
    const fin = respuesta.lastIndexOf("}");
    const data = JSON.parse(respuesta.slice(ini, fin + 1)) as {
      titulo?: string;
      secciones?: { h: string; p: string[] }[];
    };
    const ruta = await generarBorradorDocx(
      e.carpeta,
      data.titulo ?? tipoDoc,
      data.secciones ?? [],
    );
    return NextResponse.json({ ruta });
  } catch (e) {
    return NextResponse.json(errorJson(e), { status: 500 });
  }
}
