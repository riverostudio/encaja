// Capa de IA con varios proveedores. La clave vive en .env.local o en la
// tabla ajustes — nunca en el código, nunca en git, nunca en el navegador.
import type { Repo } from "./repo";

export type Proveedor = "gemini" | "claude" | "openai";

export interface ModeloOfrecido {
  id: string;
  nombre: string;
  nota: string;
  tipo: "potente" | "barato";
}

export interface FichaProveedor {
  id: Proveedor;
  nombre: string;
  quien: string;
  modeloDefecto: string;
  modelos: ModeloOfrecido[];
  leePdf: boolean;
  dondeSacarla: string;
  pista: string;
}

// Cuatro por proveedor: dos que van finos y dos que salen baratos. Si tu
// cuenta no tiene alguno, la comprobación de la clave te lo dirá al guardar.
export const PROVEEDORES: FichaProveedor[] = [
  {
    id: "gemini",
    nombre: "Gemini",
    quien: "Google",
    modeloDefecto: "gemini-2.5-flash",
    leePdf: true,
    dondeSacarla: "https://aistudio.google.com/apikey",
    pista: "Tiene plan gratuito. Es el que mejor encaja aquí: lee los PDF de las bases.",
    modelos: [
      { id: "gemini-2.5-pro", nombre: "Gemini 2.5 Pro", nota: "El que mejor razona", tipo: "potente" },
      { id: "gemini-2.5-flash", nombre: "Gemini 2.5 Flash", nota: "Rápido y muy capaz", tipo: "potente" },
      { id: "gemini-2.5-flash-lite", nombre: "Gemini 2.5 Flash Lite", nota: "El más económico", tipo: "barato" },
      { id: "gemini-2.0-flash", nombre: "Gemini 2.0 Flash", nota: "Barato y de sobra", tipo: "barato" },
    ],
  },
  {
    id: "claude",
    nombre: "Claude",
    quien: "Anthropic",
    modeloDefecto: "claude-sonnet-5",
    leePdf: true,
    dondeSacarla: "https://console.anthropic.com/settings/keys",
    pista: "De pago. También lee los PDF de las bases directamente.",
    modelos: [
      { id: "claude-opus-5", nombre: "Claude Opus 5", nota: "El más potente", tipo: "potente" },
      { id: "claude-sonnet-5", nombre: "Claude Sonnet 5", nota: "Potente y equilibrado", tipo: "potente" },
      { id: "claude-haiku-4-5-20251001", nombre: "Claude Haiku 4.5", nota: "El más económico", tipo: "barato" },
      { id: "claude-3-5-haiku-20241022", nombre: "Claude Haiku 3.5", nota: "Barato y veterano", tipo: "barato" },
    ],
  },
  {
    id: "openai",
    nombre: "GPT",
    quien: "OpenAI",
    modeloDefecto: "gpt-4o-mini",
    leePdf: false,
    dondeSacarla: "https://platform.openai.com/api-keys",
    pista: "De pago. No lee los PDF de las bases: solo servirá con las publicadas como página web.",
    modelos: [
      { id: "gpt-4.1", nombre: "GPT-4.1", nota: "El más capaz", tipo: "potente" },
      { id: "gpt-4o", nombre: "GPT-4o", nota: "Potente y probado", tipo: "potente" },
      { id: "gpt-4.1-mini", nombre: "GPT-4.1 mini", nota: "El más económico", tipo: "barato" },
      { id: "gpt-4o-mini", nombre: "GPT-4o mini", nota: "Barato y rápido", tipo: "barato" },
    ],
  },
];

export function fichaDe(p: Proveedor): FichaProveedor {
  return PROVEEDORES.find((x) => x.id === p) ?? PROVEEDORES[0];
}

export type Parte = { texto: string } | { pdf: Buffer };

export function proveedorActual(repo: Repo): Proveedor {
  const guardado = repo.getAjuste("ia_proveedor") as Proveedor | null;
  if (guardado && PROVEEDORES.some((p) => p.id === guardado)) return guardado;
  return "gemini";
}

function claveDe(repo: Repo, p: Proveedor): string | null {
  const env =
    p === "gemini"
      ? process.env.GEMINI_API_KEY
      : p === "claude"
        ? process.env.ANTHROPIC_API_KEY
        : process.env.OPENAI_API_KEY;
  return env?.trim() || repo.getAjuste(`ia_clave_${p}`);
}

export function hayClave(repo: Repo): boolean {
  return Boolean(claveDe(repo, proveedorActual(repo)));
}

export function modeloActual(repo: Repo): string {
  return repo.getAjuste("ia_modelo") || fichaDe(proveedorActual(repo)).modeloDefecto;
}

interface Peticion {
  clave: string;
  modelo: string;
  partes: Parte[];
  esperaJson: boolean;
}

async function llamarGemini({ clave, modelo, partes, esperaJson }: Peticion): Promise<string> {
  const parts = partes.map((p) =>
    "texto" in p
      ? { text: p.texto }
      : { inlineData: { mimeType: "application/pdf", data: p.pdf.toString("base64") } },
  );
  const cuerpo: Record<string, unknown> = { contents: [{ role: "user", parts }] };
  if (esperaJson) {
    cuerpo.generationConfig = { responseMimeType: "application/json", temperature: 0.1 };
  }
  const r = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": clave },
      body: JSON.stringify(cuerpo),
    },
  );
  if (!r.ok) throw new Error(await mensajeError(r, "Gemini"));
  const data = (await r.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  return data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
}

async function llamarClaude({ clave, modelo, partes, esperaJson }: Peticion): Promise<string> {
  const content = partes.map((p) =>
    "texto" in p
      ? { type: "text", text: p.texto }
      : {
          type: "document",
          source: { type: "base64", media_type: "application/pdf", data: p.pdf.toString("base64") },
        },
  );
  if (esperaJson) {
    content.push({ type: "text", text: "Responde ÚNICAMENTE con el JSON pedido, sin nada más." });
  }
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": clave,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: modelo,
      max_tokens: 4096,
      messages: [{ role: "user", content }],
    }),
  });
  if (!r.ok) throw new Error(await mensajeError(r, "Claude"));
  const data = (await r.json()) as { content?: Array<{ type: string; text?: string }> };
  return (data.content ?? [])
    .filter((c) => c.type === "text")
    .map((c) => c.text ?? "")
    .join("");
}

async function llamarOpenai({ clave, modelo, partes, esperaJson }: Peticion): Promise<string> {
  const conPdf = partes.some((p) => "pdf" in p);
  if (conPdf) {
    throw new Error(
      "SIN_PDF: GPT no puede leer el PDF de las bases desde aquí. Cambia a Gemini o Claude en Ajustes.",
    );
  }
  const texto = partes.map((p) => ("texto" in p ? p.texto : "")).join("\n\n");
  const r = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${clave}` },
    body: JSON.stringify({
      model: modelo,
      messages: [{ role: "user", content: texto }],
      ...(esperaJson ? { response_format: { type: "json_object" } } : {}),
    }),
  });
  if (!r.ok) throw new Error(await mensajeError(r, "GPT"));
  const data = (await r.json()) as { choices?: Array<{ message?: { content?: string } }> };
  return data.choices?.[0]?.message?.content ?? "";
}

async function mensajeError(r: Response, quien: string): Promise<string> {
  const crudo = (await r.text().catch(() => "")).toLowerCase();
  const dice = (frase: string) => crudo.includes(frase);

  // Cada proveedor avisa de la clave mala con un código distinto (Gemini usa
  // un 400), así que se mira también el texto.
  if (
    r.status === 401 ||
    r.status === 403 ||
    dice("api key not valid") ||
    dice("invalid api key") ||
    dice("incorrect api key") ||
    dice("api_key_invalid") ||
    dice("authentication")
  ) {
    return `CLAVE_INVALIDA: ${quien} rechaza la clave.`;
  }
  if (r.status === 429 || dice("quota") || dice("rate limit") || dice("credit balance")) {
    return `LIMITE: ${quien} dice que tu cuenta no tiene cuota ahora mismo.`;
  }
  if (r.status === 404 || dice("model not found") || dice("does not exist")) {
    return `MODELO: ${quien} no conoce ese modelo.`;
  }
  return `${quien} ha respondido ${r.status}. Prueba otra vez en un momento.`;
}

/** Llama al proveedor configurado y devuelve el texto de la respuesta. */
export async function generar(
  repo: Repo,
  partes: Parte[],
  opts: { esperaJson?: boolean } = {},
): Promise<string> {
  const proveedor = proveedorActual(repo);
  const clave = claveDe(repo, proveedor);
  if (!clave) throw new Error("SIN_CLAVE: configura tu clave de IA en Ajustes.");

  const peticion: Peticion = {
    clave,
    modelo: modeloActual(repo),
    partes,
    esperaJson: Boolean(opts.esperaJson),
  };
  const texto =
    proveedor === "gemini"
      ? await llamarGemini(peticion)
      : proveedor === "claude"
        ? await llamarClaude(peticion)
        : await llamarOpenai(peticion);

  if (!texto.trim()) throw new Error("La IA ha devuelto una respuesta vacía.");
  return texto;
}

/** Comprueba una clave con una llamada mínima antes de guardarla. */
export async function probarClave(
  proveedor: Proveedor,
  clave: string,
  modelo?: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const peticion: Peticion = {
    clave: clave.trim(),
    modelo: modelo?.trim() || fichaDe(proveedor).modeloDefecto,
    partes: [{ texto: "Responde exactamente: OK" }],
    esperaJson: false,
  };
  try {
    const r =
      proveedor === "gemini"
        ? await llamarGemini(peticion)
        : proveedor === "claude"
          ? await llamarClaude(peticion)
          : await llamarOpenai(peticion);
    return r.trim() ? { ok: true } : { ok: false, error: "Respuesta vacía." };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
