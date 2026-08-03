// Cliente Gemini SOLO server-side. La clave vive en .env.local
// (GEMINI_API_KEY) o en la tabla ajustes (clave "gemini_key") — nunca en el
// código, nunca en git, nunca en el navegador.
import type { Repo } from "./repo";

const MODELO_DEFECTO = "gemini-2.5-flash";

export type Parte = { texto: string } | { pdf: Buffer };

function clave(repo: Repo): string | null {
  return process.env.GEMINI_API_KEY?.trim() || repo.getAjuste("gemini_key");
}

export function hayClave(repo: Repo): boolean {
  return Boolean(clave(repo));
}

export function modelo(repo: Repo): string {
  return repo.getAjuste("gemini_modelo") || MODELO_DEFECTO;
}

/**
 * Llama a generateContent con texto y/o PDFs y devuelve el texto plano.
 * Con esperaJson=true fuerza responseMimeType application/json.
 */
export async function generar(
  repo: Repo,
  partes: Parte[],
  opts: { esperaJson?: boolean; fetchFn?: typeof fetch } = {},
): Promise<string> {
  const k = clave(repo);
  if (!k) throw new Error("SIN_CLAVE_GEMINI: pega tu clave en Ajustes o en .env.local");
  const fetchFn = opts.fetchFn ?? fetch;

  const parts = partes.map((p) =>
    "texto" in p
      ? { text: p.texto }
      : { inlineData: { mimeType: "application/pdf", data: p.pdf.toString("base64") } },
  );

  const cuerpo: Record<string, unknown> = {
    contents: [{ role: "user", parts }],
  };
  if (opts.esperaJson) {
    cuerpo.generationConfig = { responseMimeType: "application/json", temperature: 0.1 };
  }

  const r = await fetchFn(
    `https://generativelanguage.googleapis.com/v1beta/models/${modelo(repo)}:generateContent`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": k },
      body: JSON.stringify(cuerpo),
    },
  );
  if (!r.ok) {
    const detalle = await r.text().catch(() => "");
    throw new Error(`Gemini HTTP ${r.status}: ${detalle.slice(0, 300)}`);
  }
  const data = (await r.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const texto = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
  if (!texto) throw new Error("Gemini devolvió una respuesta vacía");
  return texto;
}
