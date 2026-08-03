// Lectura de las bases reguladoras: se usa tanto en la entrevista de encaje
// como al abrir un expediente, para que este nunca nazca a medias.
import type { Repo } from "./repo";
import type { Convocatoria, Requisito } from "./tipos";
import { descargarBases } from "./bdns";
import { generar, hayClave } from "./gemini";
import { PROMPT_EXTRACCION, parsearRequisitos } from "./requisitos";

export type MotivoSinBases = "sin_clave" | "sin_documento" | "ilegible";

export interface ResultadoBases {
  requisitos: Requisito[];
  motivo?: MotivoSinBases;
}

/**
 * Devuelve los requisitos de una convocatoria, leyéndolos de las bases la
 * primera vez y cacheándolos después. Si no se puede, dice POR QUÉ en vez
 * de devolver una lista vacía sin explicación.
 */
export async function obtenerRequisitos(
  repo: Repo,
  conv: Convocatoria,
  perfilId = 1,
): Promise<ResultadoBases> {
  const previa = repo.getEvaluacion(conv.codigoBdns, perfilId);
  if (previa?.requisitosJson) {
    const guardados = JSON.parse(previa.requisitosJson) as Requisito[];
    if (guardados.length > 0) return { requisitos: guardados };
  }
  if (!hayClave(repo)) return { requisitos: [], motivo: "sin_clave" };

  const bases = await descargarBases(conv);
  const partes: Parameters<typeof generar>[1] = [{ texto: PROMPT_EXTRACCION }];

  if (bases?.tipo === "pdf") {
    partes.push({ pdf: bases.datos as Buffer });
  } else if (bases?.tipo === "url") {
    const r = await fetch(bases.datos as string, { redirect: "follow" }).catch(() => null);
    const html = r && r.ok ? await r.text() : "";
    const plano = html.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<[^>]+>/g, " ");
    if (plano.trim().length < 200) return { requisitos: [], motivo: "sin_documento" };
    partes.push({
      texto: `BASES REGULADORAS (de ${bases.datos}):\n${plano.slice(0, 100_000)}`,
    });
  } else {
    return { requisitos: [], motivo: "sin_documento" };
  }

  const respuesta = await generar(repo, partes, { esperaJson: true });
  const requisitos = parsearRequisitos(respuesta);
  if (requisitos.length === 0) return { requisitos: [], motivo: "ilegible" };

  repo.guardarEvaluacion(conv.codigoBdns, perfilId, {
    requisitosJson: JSON.stringify(requisitos),
  });
  return { requisitos };
}

export const EXPLICACION_SIN_BASES: Record<MotivoSinBases, string> = {
  sin_clave:
    "Para leer las bases y sacar la lista de documentos hace falta la clave de Gemini: pégala en Ajustes.",
  sin_documento:
    "Esta convocatoria no publica un documento de bases descargable. Ábrela en el enlace oficial y revisa los requisitos allí.",
  ilegible:
    "No he conseguido entender el documento de bases. Ábrelo en el enlace oficial y revísalo a mano.",
};
