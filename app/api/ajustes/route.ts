import { NextRequest, NextResponse } from "next/server";
import { esPublico, credencialesDe } from "@/lib/sesion";
import { getRepo, errorJson } from "@/lib/servidor";
import {
  fichaDe,
  hayClave,
  modeloActual,
  probarClave,
  proveedorActual,
  PROVEEDORES,
  type Proveedor } from "@/lib/ia";
import { resolverCP } from "@/lib/territorio";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const repo = getRepo();
  const propia = credencialesDe(req);
  const cp = repo.getAjuste("cp");
  const proveedor = proveedorActual(repo);
  return NextResponse.json({
    // La clave JAMÁS viaja al navegador: solo si existe o no.
    configurada: Boolean(propia) || hayClave(repo),
    proveedor: propia?.proveedor ?? proveedor,
    proveedorNombre: fichaDe(propia?.proveedor ?? proveedor).nombre,
    modelo: modeloActual(repo),
    proveedores: PROVEEDORES,
    cp,
    zona: cp ? resolverCP(cp) : null,
    ccaa: repo.getAjuste("ccaa") ? Number(repo.getAjuste("ccaa")) : 54 });
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

      // En la app pública la clave se comprueba y se devuelve para que la
      // guarde el navegador. Aquí no se escribe: no es nuestra.
      if (esPublico()) {
        return NextResponse.json({
          ok: true,
          configurada: true,
          guardarEnNavegador: {
            proveedor,
            modelo: cuerpo.modelo?.trim() || fichaDe(proveedor).modeloDefecto,
            clave: cuerpo.clave.trim(),
          },
        });
      }
      repo.setAjuste(`ia_clave_${proveedor}`, cuerpo.clave.trim());
      repo.setAjuste("ia_proveedor", proveedor);
      repo.setAjuste("ia_modelo", cuerpo.modelo?.trim() || fichaDe(proveedor).modeloDefecto);
    } else if (cuerpo.proveedor) {
      repo.setAjuste("ia_proveedor", cuerpo.proveedor);
      if (cuerpo.modelo?.trim()) repo.setAjuste("ia_modelo", cuerpo.modelo.trim());
    } else if (cuerpo.modelo?.trim()) {
      repo.setAjuste("ia_modelo", cuerpo.modelo.trim());
    }

    if (cuerpo.cp !== undefined && !esPublico()) {
      repo.setAjuste("cp", cuerpo.cp.trim());
      if (cuerpo.cp.trim()) repo.setHecho(1, "cp", cuerpo.cp.trim(), "ajustes");
    }
    if (cuerpo.ccaa && !esPublico()) repo.setAjuste("ccaa", String(cuerpo.ccaa));
    return NextResponse.json({ ok: true, configurada: Boolean(credencialesDe(req)) || hayClave(repo) });
  } catch (e) {
    return NextResponse.json(errorJson(e), { status: 500 });
  }
}
