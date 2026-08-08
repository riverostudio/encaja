import { NextRequest, NextResponse } from "next/server";
import { documentosParaPerfil } from "@/lib/acompanamiento";
import { derivacionesParaEscenarios } from "@/lib/derivaciones";
import type { EscenarioAsistente } from "@/lib/asistente";
import { prestacionesParaPerfil } from "@/lib/prestaciones";
import { hechosDe, idDeSesion } from "@/lib/sesion";
import { getRepo } from "@/lib/servidor";

export const dynamic = "force-dynamic";

function escenariosDesdePerfil(hechos: Map<string, string>): EscenarioAsistente[] {
  const resultado: EscenarioAsistente[] = [];
  const circunstancias = hechos.get("circunstancias") ?? "";
  const objetivos = hechos.get("objetivo") ?? "";
  const situacion = hechos.get("situacion") ?? "";
  if (circunstancias.includes("victima_violencia")) resultado.push("violencia_genero");
  if (circunstancias.includes("dependencia")) resultado.push("dependencia");
  if (circunstancias.includes("discapacidad")) resultado.push("discapacidad");
  if (objetivos.includes("apuro")) resultado.push("pocos_recursos");
  if (objetivos.includes("vivienda")) resultado.push("vivienda");
  if (objetivos.includes("familia")) resultado.push("familia");
  if (situacion === "desempleado") resultado.push("desempleo");
  if (situacion === "estudiante") resultado.push("estudiante");
  if (situacion === "autonomo_activo") resultado.push("autonomo");
  if (situacion === "cuenta_ajena") resultado.push("trabajador");
  if (situacion === "jubilado") resultado.push("mayores");
  return [...new Set(resultado.length ? resultado : ["general"] as EscenarioAsistente[])];
}

export async function GET(req: NextRequest) {
  const repo = getRepo();
  const hechos = hechosDe(req) ?? repo.getHechos(idDeSesion(req));
  return NextResponse.json({
    prestaciones: prestacionesParaPerfil(hechos).slice(0, 10),
    documentos: documentosParaPerfil(hechos),
    derivaciones: derivacionesParaEscenarios(escenariosDesdePerfil(hechos)),
    privacidad:
      "Encaja solo guarda el estado de la lista en este navegador. No permite subir documentos ni envía su contenido al servidor o a la IA.",
  });
}
