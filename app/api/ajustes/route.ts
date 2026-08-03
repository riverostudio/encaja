import { NextRequest, NextResponse } from "next/server";
import { getRepo, errorJson } from "@/lib/servidor";
import { hayClave, modelo } from "@/lib/gemini";
import { resolverCP } from "@/lib/territorio";

export const dynamic = "force-dynamic";

export async function GET() {
  const repo = getRepo();
  const cp = repo.getAjuste("cp");
  return NextResponse.json({
    // La clave JAMÁS viaja al navegador: solo si existe o no.
    tieneClaveGemini: hayClave(repo),
    modelo: modelo(repo),
    cp,
    zona: cp ? resolverCP(cp) : null,
    ccaa: repo.getAjuste("ccaa") ? Number(repo.getAjuste("ccaa")) : 54,
  });
}

export async function POST(req: NextRequest) {
  try {
    const cuerpo = (await req.json()) as {
      gemini_key?: string;
      modelo?: string;
      cp?: string;
      ccaa?: number;
    };
    const repo = getRepo();
    if (cuerpo.gemini_key !== undefined) {
      const limpia = cuerpo.gemini_key.trim();
      if (limpia) repo.setAjuste("gemini_key", limpia);
    }
    if (cuerpo.modelo) repo.setAjuste("gemini_modelo", cuerpo.modelo.trim());
    if (cuerpo.cp !== undefined) {
      repo.setAjuste("cp", cuerpo.cp.trim());
      if (cuerpo.cp.trim()) repo.setHecho(1, "cp", cuerpo.cp.trim(), "ajustes");
    }
    if (cuerpo.ccaa) repo.setAjuste("ccaa", String(cuerpo.ccaa));
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(errorJson(e), { status: 500 });
  }
}
