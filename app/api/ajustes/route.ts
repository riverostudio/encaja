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
  guardarClaveSegura,
  type Proveedor } from "@/lib/ia";
import { resolverCP } from "@/lib/territorio";
import { protegerApi } from "@/lib/seguridad";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const repo = getRepo();
  const propia = credencialesDe(req);
  const cp = repo.getAjuste("cp");
  const proveedor = proveedorActual(repo);
  const proveedorVisitante = req.headers.get("x-ia-proveedor") as Proveedor | null;
  const modeloVisitante = req.headers.get("x-ia-modelo")?.trim() || null;
  const configuradaVisitante = req.headers.get("x-ia-configurada") === "1";
  const proveedorSeguro = proveedorVisitante && PROVEEDORES.some((p) => p.id === proveedorVisitante)
    ? proveedorVisitante
    : proveedor;
  return NextResponse.json({
    // La clave JAMÁS viaja al navegador: solo si existe o no.
    configurada: configuradaVisitante || Boolean(propia) || hayClave(repo),
    proveedor: propia?.proveedor ?? proveedorSeguro,
    proveedorNombre: fichaDe(propia?.proveedor ?? proveedorSeguro).nombre,
    modelo: modeloVisitante ?? modeloActual(repo),
    proveedores: PROVEEDORES,
    cp,
    zona: cp ? resolverCP(cp) : null,
    ccaa: repo.getAjuste("ccaa") ? Number(repo.getAjuste("ccaa")) : 54 });
}

export async function POST(req: NextRequest) {
  try {
    const bloqueo = protegerApi(req, "probar-clave", 20);
    if (bloqueo) return bloqueo;
    const cuerpo = (await req.json()) as {
      proveedor?: Proveedor;
      clave?: string;
      modelo?: string;
      cp?: string;
      ccaa?: number;
    };
    const repo = getRepo();

    if (esPublico() && !cuerpo.clave?.trim()) {
      const propia = credencialesDe(req);
      if (cuerpo.proveedor && propia && cuerpo.proveedor !== propia.proveedor) {
        return NextResponse.json(
          { error: "Pega una clave del nuevo proveedor antes de cambiarlo." },
          { status: 400 },
        );
      }
      return NextResponse.json({
        ok: true,
        configurada: Boolean(propia),
        guardarEnNavegador: propia
          ? {
              proveedor: propia.proveedor,
              modelo: cuerpo.modelo?.trim() || propia.modelo || fichaDe(propia.proveedor).modeloDefecto,
              clave: propia.clave,
            }
          : undefined,
      });
    }

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
      guardarClaveSegura(repo, proveedor, cuerpo.clave.trim());
      repo.setAjuste("ia_proveedor", proveedor);
      repo.setAjuste("ia_modelo", cuerpo.modelo?.trim() || fichaDe(proveedor).modeloDefecto);
    } else if (cuerpo.proveedor && !esPublico()) {
      repo.setAjuste("ia_proveedor", cuerpo.proveedor);
      if (cuerpo.modelo?.trim()) repo.setAjuste("ia_modelo", cuerpo.modelo.trim());
    } else if (cuerpo.modelo?.trim() && !esPublico()) {
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
