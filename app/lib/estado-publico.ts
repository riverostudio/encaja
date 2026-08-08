"use client";

import type {
  ConvUi,
  MotivoUi,
  RequisitoUi,
  VeredictoUi,
  ResumenIaUi,
} from "../componentes/tipos-ui";
import { borrarMetricasLocales, leerMetricasLocales } from "./metricas-cliente";
import { estadoPlazo, formatoRango } from "@/lib/plazos";
import { urlAbsoluta } from "@/lib/url-oficial";

const LLAVE_PERFIL = "encaja.perfil";
const LLAVE_EVALUACIONES = "encaja.evaluaciones";
const LLAVE_EXPEDIENTES = "encaja.expedientes";
const LLAVE_REGION = "encaja.region";
const LLAVE_RESUMENES = "encaja.resumenes";
const LLAVE_DOCUMENTOS_BASE = "encaja.documentos-base";

export interface DocumentoBaseLocal {
  id: string;
  estado: "pendiente" | "listo" | "pedir";
  nota?: string;
  updatedAt: string;
}

export type EstadoExpedientePublico =
  | "interesa"
  | "preparacion"
  | "presentada"
  | "concedida"
  | "denegada";

export interface ItemExpedientePublico {
  id: string;
  texto: string;
  estado: "lo_tengo" | "pedirlo" | "redactarlo" | "pendiente";
  nota?: string;
}

export interface EvaluacionPublica {
  codigoBdns: string;
  requisitos: RequisitoUi[];
  dictamen: VeredictoUi | null;
  motivos: MotivoUi[];
  updatedAt: string;
}

export interface ExpedientePublico {
  codigoBdns: string;
  estado: EstadoExpedientePublico;
  checklist: ItemExpedientePublico[];
  conv: ConvUi;
  urlFicha: string;
  creadoAt: string;
  updatedAt: string;
}

function leer<T>(llave: string, defecto: T): T {
  if (typeof window === "undefined") return defecto;
  try {
    const crudo = localStorage.getItem(llave);
    return crudo ? (JSON.parse(crudo) as T) : defecto;
  } catch {
    return defecto;
  }
}

function guardar<T>(llave: string, valor: T): void {
  localStorage.setItem(llave, JSON.stringify(valor));
}

export function leerPerfilPublico(): Record<string, string> {
  return leer<Record<string, string>>(LLAVE_PERFIL, {});
}

export function guardarHechoPublico(clave: string, valor: string): void {
  const perfil = leerPerfilPublico();
  perfil[clave] = valor;
  guardar(LLAVE_PERFIL, perfil);
}

export function borrarHechoPublico(clave: string): void {
  const perfil = leerPerfilPublico();
  delete perfil[clave];
  guardar(LLAVE_PERFIL, perfil);
}

export function getRegionPublica(): number | "" | null {
  const valor = leer<number | "" | null>(LLAVE_REGION, null);
  return valor === "" || typeof valor === "number" ? valor : null;
}

export function guardarRegionPublica(region: number | ""): void {
  guardar(LLAVE_REGION, region);
}

export function leerDocumentosBase(): Record<string, DocumentoBaseLocal> {
  return leer<Record<string, DocumentoBaseLocal>>(LLAVE_DOCUMENTOS_BASE, {});
}

export function guardarDocumentoBase(
  id: string,
  estado: DocumentoBaseLocal["estado"],
  nota?: string,
): DocumentoBaseLocal {
  const todos = leerDocumentosBase();
  const documento = { id, estado, nota, updatedAt: new Date().toISOString() };
  todos[id] = documento;
  guardar(LLAVE_DOCUMENTOS_BASE, todos);
  return documento;
}

/** Añade las claves que consumen las reglas estructurales sin duplicar preguntas. */
export function perfilPublicoConDerivados(): Record<string, string> {
  const perfil = leerPerfilPublico();
  const salida = { ...perfil };
  if (perfil.perfil === "particular") salida.tipo_actividad = "particular";
  else if (perfil.perfil === "autonomo") salida.tipo_actividad = "autonomo";
  else if (perfil.perfil === "empresa") salida.tipo_actividad = "pyme";

  if (perfil.al_corriente === "si") {
    salida.al_corriente_hacienda = "sí";
    salida.al_corriente_ss = "sí";
  } else if (perfil.al_corriente === "no") {
    salida.al_corriente_hacienda = "no";
    salida.al_corriente_ss = "no";
  }
  return salida;
}

function evaluaciones(): Record<string, EvaluacionPublica> {
  return leer<Record<string, EvaluacionPublica>>(LLAVE_EVALUACIONES, {});
}

export function getEvaluacionPublica(codigo: string): EvaluacionPublica | null {
  return evaluaciones()[codigo] ?? null;
}

export function guardarResultadoEncaje(
  codigo: string,
  resultado: {
    requisitos?: RequisitoUi[];
    dictamen?: VeredictoUi;
    motivos?: MotivoUi[];
  },
): void {
  const todas = evaluaciones();
  const previa = todas[codigo];
  todas[codigo] = {
    codigoBdns: codigo,
    requisitos: resultado.requisitos ?? previa?.requisitos ?? [],
    dictamen: resultado.dictamen ?? previa?.dictamen ?? null,
    motivos: resultado.motivos ?? previa?.motivos ?? [],
    updatedAt: new Date().toISOString(),
  };
  guardar(LLAVE_EVALUACIONES, todas);
}

export function getResumenPublico(codigo: string): ResumenIaUi | null {
  return leer<Record<string, ResumenIaUi>>(LLAVE_RESUMENES, {})[codigo] ?? null;
}

export function guardarResumenPublico(codigo: string, resumen: ResumenIaUi): void {
  const todos = leer<Record<string, ResumenIaUi>>(LLAVE_RESUMENES, {});
  todos[codigo] = resumen;
  guardar(LLAVE_RESUMENES, todos);
}

function urlFichaSegura(codigo: string): string {
  if (!/^\d{1,20}$/.test(codigo)) return "https://www.infosubvenciones.es/";
  return `https://www.infosubvenciones.es/bdnstrans/GE/es/convocatoria/${codigo}`;
}

function sanearExpediente(expediente: ExpedientePublico): ExpedientePublico {
  return {
    ...expediente,
    conv: {
      ...expediente.conv,
      urlBases: urlAbsoluta(expediente.conv.urlBases),
      sede: urlAbsoluta(expediente.conv.sede),
    },
    // La ficha BDNS es determinista: no se confía en un dominio guardado.
    urlFicha: urlFichaSegura(expediente.codigoBdns),
  };
}

function expedientes(): Record<string, ExpedientePublico> {
  const guardados = leer<Record<string, ExpedientePublico>>(LLAVE_EXPEDIENTES, {});
  const saneados = Object.fromEntries(
    Object.entries(guardados).map(([codigo, expediente]) => [codigo, sanearExpediente(expediente)]),
  );
  // Migra también los expedientes creados antes de endurecer el saneado.
  if (JSON.stringify(saneados) !== JSON.stringify(guardados)) {
    try {
      guardar(LLAVE_EXPEDIENTES, saneados);
    } catch {
      // Si localStorage está lleno, la vista segura sigue funcionando aunque
      // la migración tenga que volver a intentarse en la próxima lectura.
    }
  }
  return saneados;
}

export function getExpedientePublico(codigo: string): ExpedientePublico | null {
  return expedientes()[codigo] ?? null;
}

export function crearExpedientePublico(conv: ConvUi): ExpedientePublico {
  const todos = expedientes();
  const convSegura = {
    ...conv,
    urlBases: urlAbsoluta(conv.urlBases),
    sede: urlAbsoluta(conv.sede),
  };
  const fichaSegura = urlFichaSegura(conv.codigoBdns);
  const previo = todos[convSegura.codigoBdns];
  const requisitos = getEvaluacionPublica(convSegura.codigoBdns)?.requisitos ?? [];
  if (previo) {
    previo.conv = convSegura;
    previo.urlFicha = fichaSegura;
    for (const requisito of requisitos.filter((r) => r.tipo === "documento")) {
      if (!previo.checklist.some((i) => i.id === requisito.id)) {
        previo.checklist.push({ id: requisito.id, texto: requisito.literal, estado: "pendiente" });
      }
    }
    previo.updatedAt = new Date().toISOString();
    todos[convSegura.codigoBdns] = previo;
    guardar(LLAVE_EXPEDIENTES, todos);
    return previo;
  }
  const ahora = new Date().toISOString();
  const expediente: ExpedientePublico = {
    codigoBdns: convSegura.codigoBdns,
    estado: "interesa",
    checklist: requisitos
      .filter((r) => r.tipo === "documento")
      .map((r) => ({ id: r.id, texto: r.literal, estado: "pendiente" })),
    conv: convSegura,
    urlFicha: fichaSegura,
    creadoAt: ahora,
    updatedAt: ahora,
  };
  todos[convSegura.codigoBdns] = expediente;
  guardar(LLAVE_EXPEDIENTES, todos);
  return expediente;
}

export function listarExpedientesPublicos(): ExpedientePublico[] {
  return Object.values(expedientes()).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function actualizarExpedientePublico(
  codigo: string,
  cambios: {
    estado?: EstadoExpedientePublico;
    item?: { id: string; estado: ItemExpedientePublico["estado"]; nota?: string };
  },
): ExpedientePublico | null {
  const todos = expedientes();
  const expediente = todos[codigo];
  if (!expediente) return null;
  if (cambios.estado) expediente.estado = cambios.estado;
  if (cambios.item) {
    const item = expediente.checklist.find((i) => i.id === cambios.item!.id);
    if (item) {
      item.estado = cambios.item.estado;
      if (cambios.item.nota !== undefined) item.nota = cambios.item.nota;
    }
  }
  expediente.updatedAt = new Date().toISOString();
  todos[codigo] = expediente;
  guardar(LLAVE_EXPEDIENTES, todos);
  return expediente;
}

export function datosExpedientePublico(codigo: string) {
  const expediente = getExpedientePublico(codigo);
  if (!expediente) return null;
  const evaluacion = getEvaluacionPublica(codigo);
  const destinoSolicitud = expediente.conv.sede
    ? "sede"
    : expediente.conv.urlBases
      ? "bases"
      : "ficha";
  return {
    expediente: {
      codigoBdns: expediente.codigoBdns,
      estado: expediente.estado,
      carpeta: "Guardado de forma privada en este navegador",
      checklistJson: JSON.stringify(expediente.checklist),
    },
    conv: {
      ...expediente.conv,
      plazo: estadoPlazo(expediente.conv.fechaInicioSol, expediente.conv.fechaFinSol),
      rangoFechas: formatoRango(expediente.conv.fechaInicioSol, expediente.conv.fechaFinSol),
      urlFicha: expediente.urlFicha,
    },
    condiciones: (evaluacion?.requisitos ?? []).filter((r) => r.tipo !== "documento"),
    veredicto: evaluacion?.dictamen ?? null,
    dondeSolicitar:
      expediente.conv.sede ?? expediente.conv.urlBases ?? expediente.urlFicha,
    destinoSolicitud,
  };
}

function descargar(nombre: string, contenido: string, tipo: string): void {
  const url = URL.createObjectURL(new Blob([contenido], { type: tipo }));
  const enlace = document.createElement("a");
  enlace.href = url;
  enlace.download = nombre;
  enlace.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function descargarExpedientePublico(codigo: string): boolean {
  const expediente = getExpedientePublico(codigo);
  if (!expediente) return false;
  const evaluacion = getEvaluacionPublica(codigo);
  const pendientes = expediente.checklist.map(
    (i) => `- [${i.estado === "lo_tengo" ? "x" : " "}] ${i.texto} — ${i.estado}`,
  );
  const texto = [
    `# Expediente ${codigo}`,
    "",
    `## ${expediente.conv.titulo}`,
    "",
    `- Estado: ${expediente.estado}`,
    `- Organismo: ${expediente.conv.nivel3 ?? expediente.conv.nivel2}`,
    `- Plazo: ${expediente.conv.rangoFechas}`,
    `- Ficha oficial: ${expediente.urlFicha}`,
    expediente.conv.urlBases ? `- Bases: ${expediente.conv.urlBases}` : null,
    expediente.conv.sede ? `- Sede: ${expediente.conv.sede}` : null,
    "",
    "## Condiciones",
    ...(evaluacion?.requisitos.filter((r) => r.tipo !== "documento").map((r) => `- ${r.literal}`) ?? [
      "- Revisar las bases oficiales.",
    ]),
    "",
    "## Documentos",
    ...(pendientes.length ? pendientes : ["- Revisar la lista en las bases oficiales."]),
    "",
    "> Encaja prepara este expediente, pero la revisión, firma y presentación son tuyas.",
  ]
    .filter((linea): linea is string => linea !== null)
    .join("\n");
  descargar(`encaja-${codigo}.md`, texto, "text/markdown;charset=utf-8");
  return true;
}

export function exportarDatosPublicos(): void {
  descargar(
    `encaja-datos-${new Date().toISOString().slice(0, 10)}.json`,
    JSON.stringify(
      {
        version: 1,
        exportadoAt: new Date().toISOString(),
        perfil: leerPerfilPublico(),
        evaluaciones: evaluaciones(),
        expedientes: expedientes(),
        documentosBase: leerDocumentosBase(),
        actividad: leerMetricasLocales(),
      },
      null,
      2,
    ),
    "application/json;charset=utf-8",
  );
}

export async function borrarDatosPublicos(): Promise<boolean> {
  const metricasBorradas = await borrarMetricasLocales();
  localStorage.removeItem(LLAVE_PERFIL);
  localStorage.removeItem(LLAVE_EVALUACIONES);
  localStorage.removeItem(LLAVE_EXPEDIENTES);
  localStorage.removeItem(LLAVE_REGION);
  localStorage.removeItem(LLAVE_RESUMENES);
  localStorage.removeItem(LLAVE_DOCUMENTOS_BASE);
  localStorage.removeItem("encaja.accesibilidad.v1");
  localStorage.removeItem("encaja.entrada");
  localStorage.removeItem("encaja.aviso-legal.v2");
  localStorage.removeItem("encaja.consentimiento-metricas");
  return metricasBorradas;
}
