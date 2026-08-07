import { NextRequest, NextResponse } from "next/server";
import {
  consultaParaAsistente,
  detectarEscenario,
  hechosInferidosParaBuscar,
  preguntasQueFaltan,
  profesionalNecesitaAclaracion,
  promptConversacional,
  recursoDesdePrestacion,
  respuestaGuiada,
  respuestaIaSegura,
  terminosDirectosParaAsistente,
  type MensajeAsistente,
  type RecursoAsistente,
} from "@/lib/asistente";
import { urlAbsoluta } from "@/lib/bdns";
import { beneficiarioDesdePerfil, resumenPerfil } from "@/lib/perfil";
import { buscarPrestaciones } from "@/lib/prestaciones";
import { protegerApi } from "@/lib/seguridad";
import { credencialesDe, esPublico, hechosDe, idDeSesion } from "@/lib/sesion";
import { errorJson, getRepo, buscarRadar, type ConvocatoriaConPlazo } from "@/lib/servidor";
import { generar, hayClave } from "@/lib/ia";
import { urlFichaBdns } from "@/lib/expediente";
import { resolverCP } from "@/lib/territorio";

export const dynamic = "force-dynamic";

function limpiarMensajes(valor: unknown): MensajeAsistente[] {
  if (!Array.isArray(valor)) return [];
  return valor
    .slice(-12)
    .flatMap((m): MensajeAsistente[] => {
      if (!m || typeof m !== "object") return [];
      const x = m as { rol?: unknown; texto?: unknown };
      if (!(["usuario", "asistente"] as unknown[]).includes(x.rol) || typeof x.texto !== "string") return [];
      const texto = x.texto.trim().slice(0, 1_200);
      return texto ? [{ rol: x.rol as MensajeAsistente["rol"], texto }] : [];
    });
}

function requisitoConvocatoria(c: ConvocatoriaConPlazo): string[] {
  const requisitos: string[] = [];
  const quien = c.resumen?.aQuien ?? c.llano.quien;
  if (quien) requisitos.push(`A quién va dirigida: ${quien}`);
  else if (c.beneficiarios.length) requisitos.push(`Beneficiarios oficiales: ${c.beneficiarios.slice(0, 3).join(", ")}.`);
  if (c.regiones.length) requisitos.push(`Ámbito territorial publicado: ${c.regiones.slice(0, 3).join(", ")}.`);
  if (c.sectores.length) requisitos.push(`Sectores publicados: ${c.sectores.slice(0, 3).join(", ")}.`);
  requisitos.push("Las condiciones detalladas deben comprobarse en las bases oficiales o con «¿Encajo?».");
  return requisitos.slice(0, 4);
}

function recursoDesdeConvocatoria(c: ConvocatoriaConPlazo): RecursoAsistente {
  const ficha = urlFichaBdns(c.codigoBdns);
  const sede = urlAbsoluta(c.sede);
  const bases = urlAbsoluta(c.urlBases);
  const urlSolicitud = sede ?? bases ?? ficha;
  const accion = sede
    ? "Ir a la sede oficial para solicitar"
    : bases
      ? "Ver bases y forma de solicitud"
      : "Ver ficha oficial en la BDNS";
  const estado = c.plazo.estado === "cerrada" ? "Cerrada" : c.rangoFechas || "Consulta el plazo oficial";
  return {
    id: `bdns-${c.codigoBdns}`,
    tipo: "convocatoria",
    codigo: c.codigoBdns,
    titulo: c.resumen?.titular ?? c.titulo,
    organismo: c.nivel3 ?? c.nivel2,
    resumen: c.resumen?.que ?? c.llano.que,
    requisitos: requisitoConvocatoria(c),
    plazo: estado,
    urlInfo: ficha,
    urlSolicitud,
    accion,
  };
}

function unicos<T extends { id: string }>(items: T[]): T[] {
  return [...new Map(items.map((x) => [x.id, x])).values()];
}

export async function POST(req: NextRequest) {
  try {
    const bloqueo = protegerApi(req, "chat", 80);
    if (bloqueo) return bloqueo;
    const cuerpo = (await req.json()) as { mensajes?: unknown };
    const historial = limpiarMensajes(cuerpo.mensajes);
    const ultimo = [...historial].reverse().find((m) => m.rol === "usuario")?.texto ?? "";
    if (ultimo.length < 2) {
      return NextResponse.json({ error: "Cuéntame un poco más para poder buscar." }, { status: 400 });
    }

    const repo = getRepo();
    const hechosOriginales = hechosDe(req) ?? repo.getHechos(idDeSesion(req));
    const escenario = detectarEscenario(ultimo);
    const hechosBusqueda = hechosInferidosParaBuscar(hechosOriginales, escenario, ultimo);
    const cp = hechosBusqueda.get("cp");
    const zona = cp ? resolverCP(cp) : null;
    const consulta = consultaParaAsistente(ultimo);
    const filasRadar = buscarRadar(repo, {
      texto: consulta || undefined,
      beneficiario: beneficiarioDesdePerfil(hechosBusqueda) ?? undefined,
      region: zona?.regionIds?.[0],
      cp,
      soloAplicables: hechosBusqueda.has("perfil"),
      hechos: hechosBusqueda,
    });

    const directas = unicos(
      terminosDirectosParaAsistente(ultimo).flatMap((termino) => buscarPrestaciones(termino, hechosBusqueda)),
    )
      .slice(0, 4)
      .map(recursoDesdePrestacion);
    const necesitaAclararProfesional =
      escenario === "profesional" && profesionalNecesitaAclaracion(hechosOriginales, ultimo);
    const convocatorias = necesitaAclararProfesional
      ? []
      : filasRadar.slice(0, 5).map(recursoDesdeConvocatoria);
    const recursos = [...directas, ...convocatorias].slice(0, 7);
    const preguntas = preguntasQueFaltan(hechosOriginales, escenario, ultimo);

    const credenciales = credencialesDe(req);
    const puedeUsarIa = Boolean(credenciales) || (!esPublico() && hayClave(repo));
    let respuesta = respuestaGuiada(escenario, recursos, preguntas);
    let modo: "ia" | "guiado" = "guiado";
    if (puedeUsarIa) {
      try {
        const respuestaIa = respuestaIaSegura(await generar(
          repo,
          [{ texto: promptConversacional({ historial, perfil: resumenPerfil(hechosOriginales), recursos, preguntas }) }],
          { credenciales },
        ), preguntas);
        if (respuestaIa) {
          respuesta = respuestaIa;
          modo = "ia";
        }
      } catch {
        // La orientación determinista conserva resultados y enlaces aunque el
        // proveedor esté sin cuota, lento o temporalmente indisponible.
      }
    }

    return NextResponse.json({ respuesta, recursos, consulta, preguntas, modo });
  } catch (error) {
    return NextResponse.json(errorJson(error), { status: 500 });
  }
}
