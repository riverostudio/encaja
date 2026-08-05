import { NextRequest, NextResponse } from "next/server";
import { generarBorradorDocxBuffer } from "@/lib/expediente";
import { generar, hayClave } from "@/lib/ia";
import { credencialesDe, hechosDe, idDeSesion } from "@/lib/sesion";
import { errorJson, getRepo } from "@/lib/servidor";
import { protegerApi } from "@/lib/seguridad";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ codigo: string }> },
) {
  try {
    const bloqueo = protegerApi(req, "borrador", 20);
    if (bloqueo) return bloqueo;
    const { codigo } = await ctx.params;
    const { tipo = "memoria" } = (await req.json()) as {
      tipo?: "memoria" | "declaracion";
    };
    if (tipo !== "memoria" && tipo !== "declaracion") {
      return NextResponse.json({ error: "Tipo de borrador no válido" }, { status: 400 });
    }
    const repo = getRepo();
    const conv = repo.getConvocatoria(codigo);
    if (!conv) return NextResponse.json({ error: "Convocatoria no encontrada" }, { status: 404 });
    const cred = credencialesDe(req);
    if (!cred && !hayClave(repo)) {
      return NextResponse.json({ error: "SIN_CLAVE: configura una clave de IA" }, { status: 400 });
    }
    const perfil = hechosDe(req) ?? repo.getHechos(idDeSesion(req));
    const hechos = [...perfil.entries()].map(([k, v]) => `- ${k}: ${v}`).join("\n");
    const tipoDoc = tipo === "declaracion" ? "declaración responsable" : "memoria técnica";
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
Donde falte un dato usa [COMPLETAR: qué falta]. No inventes cifras ni fechas.`,
        },
      ],
      { esperaJson: true, credenciales: cred },
    );
    const ini = respuesta.indexOf("{");
    const fin = respuesta.lastIndexOf("}");
    if (ini < 0 || fin <= ini) throw new Error("La IA no ha devuelto un borrador válido.");
    const data = JSON.parse(respuesta.slice(ini, fin + 1)) as {
      titulo?: string;
      secciones?: { h: string; p: string[] }[];
    };
    const buffer = await generarBorradorDocxBuffer(
      data.titulo ?? tipoDoc,
      Array.isArray(data.secciones) ? data.secciones : [],
    );
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="encaja-${codigo}-${tipo}.docx"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    return NextResponse.json(errorJson(e), { status: 500 });
  }
}
