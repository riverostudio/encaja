import { NextRequest, NextResponse } from "next/server";
import { getRepo, errorJson } from "@/lib/servidor";
import {
  fichaDe,
  hayClave,
  modeloActual,
  probarClave,
  proveedorActual,
  PROVEEDORES,
  type Proveedor,
} from "@/lib/ia";
import { resolverCP } from "@/lib/territorio";

export const dynamic = "force-dynamic";

export async function GET() {
  const repo = getRepo();
  const cp = repo.getAjuste("cp");
  const proveedor = proveedorActual(repo);
  return NextResponse.json({
    // La clave JAMÁS viaja al navegador: solo si existe o no.
    configurada: hayClave(repo),
    proveedor,
    proveedorNombre: fichaDe(proveedor).nombre,
    modelo: modeloActual(repo),
    proveedores: PROVEEDORES,
    cp,
    zona: cp ? resolverCP(cp) : null,
    ccaa: repo.getAjuste("ccaa") ? Number(repo.getAjuste("ccaa")) : 54,
  });
}

export async function POST(req: NextRequest) {
  try {
    const cuerpo = (await req.json()) as {
      proveedor?: Proveedor;
      clave?: string;
      modelo?: string;
      cp?: string;
      ccaa?: number;
    };
    const repo = getRepo();

    if (cuerpo.clave !== undefined && cuerpo.clave.trim()) {
      const proveedor = cuerpo.proveedor ?? proveedorActual(repo);
      // Nunca se guarda una clave sin comprobar antes que de verdad funciona.
      const prueba = await probarClave(proveedor, cuerpo.clave, cuerpo.modelo);
      if (!prueba.ok) return NextResponse.json({ error: prueba.error }, { status: 400 });

      repo.setAjuste(`ia_clave_${proveedor}`, cuerpo.clave.trim());
      repo.setAjuste("ia_proveedor", proveedor);
      repo.setAjuste("ia_modelo", cuerpo.modelo?.trim() || fichaDe(proveedor).modeloDefecto);
    } else if (cuerpo.proveedor) {
      repo.setAjuste("ia_proveedor", cuerpo.proveedor);
      if (cuerpo.modelo?.trim()) repo.setAjuste("ia_modelo", cuerpo.modelo.trim());
    } else if (cuerpo.modelo?.trim()) {
      repo.setAjuste("ia_modelo", cuerpo.modelo.trim());
    }

    if (cuerpo.cp !== undefined) {
      repo.setAjuste("cp", cuerpo.cp.trim());
      if (cuerpo.cp.trim()) repo.setHecho(1, "cp", cuerpo.cp.trim(), "ajustes");
    }
    if (cuerpo.ccaa) repo.setAjuste("ccaa", String(cuerpo.ccaa));
    return NextResponse.json({ ok: true, configurada: hayClave(repo) });
  } catch (e) {
    return NextResponse.json(errorJson(e), { status: 500 });
  }
}
