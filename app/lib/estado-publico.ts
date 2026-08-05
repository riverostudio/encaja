"use client";

import type {
  ConvUi,
  MotivoUi,
  RequisitoUi,
  VeredictoUi,
} from "../componentes/tipos-ui";

const LLAVE_PERFIL = "encaja.perfil";
const LLAVE_EVALUACIONES = "encaja.evaluaciones";
const LLAVE_EXPEDIENTES = "encaja.expedientes";
const LLAVE_REGION = "encaja.region";

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

function expedientes(): Record<string, ExpedientePublico> {
  return leer<Record<string, ExpedientePublico>>(LLAVE_EXPEDIENTES, {});
}

export function getExpedientePublico(codigo: string): ExpedientePublico | null {
  return expedientes()[codigo] ?? null;
}

export function crearExpedientePublico(conv: ConvUi, urlFicha: string): ExpedientePublico {
  const todos = expedientes();
  const previo = todos[conv.codigoBdns];
  if (previo) return previo;
  const requisitos = getEvaluacionPublica(conv.codigoBdns)?.requisitos ?? [];
  const ahora = new Date().toISOString();
  const expediente: ExpedientePublico = {
    codigoBdns: conv.codigoBdns,
    estado: "interesa",
    checklist: requisitos
      .filter((r) => r.tipo === "documento")
      .map((r) => ({ id: r.id, texto: r.literal, estado: "pendiente" })),
    conv,
    urlFicha,
    creadoAt: ahora,
    updatedAt: ahora,
  };
  todos[conv.codigoBdns] = expediente;
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
  return {
    expediente: {
      codigoBdns: expediente.codigoBdns,
      estado: expediente.estado,
      carpeta: "Guardado de forma privada en este navegador",
      checklistJson: JSON.stringify(expediente.checklist),
    },
    conv: { ...expediente.conv, urlFicha: expediente.urlFicha },
    condiciones: (evaluacion?.requisitos ?? []).filter((r) => r.tipo !== "documento"),
    veredicto: evaluacion?.dictamen ?? null,
    dondeSolicitar:
      expediente.conv.sede ?? expediente.conv.urlBases ?? expediente.urlFicha,
    esSedeDirecta: Boolean(expediente.conv.sede),
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
      },
      null,
      2,
    ),
    "application/json;charset=utf-8",
  );
}

export function borrarDatosPublicos(): void {
  localStorage.removeItem(LLAVE_PERFIL);
  localStorage.removeItem(LLAVE_EVALUACIONES);
  localStorage.removeItem(LLAVE_EXPEDIENTES);
  localStorage.removeItem(LLAVE_REGION);
}
