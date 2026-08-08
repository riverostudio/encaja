import type { Prestacion } from "./prestaciones";

export type EstadoDocumentoBase = "pendiente" | "listo" | "pedir";

export interface DocumentoBase {
  id: string;
  titulo: string;
  motivo: string;
  sensible?: boolean;
}

const BASE: DocumentoBase[] = [
  { id: "identidad", titulo: "DNI, NIE o documento de identidad", motivo: "Suele identificar a la persona solicitante.", sensible: true },
  { id: "empadronamiento", titulo: "Volante o certificado de empadronamiento", motivo: "Muchas ayudas territoriales comprueban domicilio y convivencia.", sensible: true },
  { id: "ingresos", titulo: "Justificantes recientes de ingresos", motivo: "Nóminas, prestaciones o certificados pueden acreditar la situación económica.", sensible: true },
  { id: "renta", titulo: "Declaración de la renta o certificado tributario", motivo: "Solo cuando las bases lo pidan o no autorices la consulta.", sensible: true },
  { id: "banco", titulo: "Certificado de titularidad bancaria", motivo: "Puede pedirse para recibir un pago. Nunca compartas claves ni movimientos si no lo exigen.", sensible: true },
];

export function documentosParaPerfil(hechos: Map<string, string>): DocumentoBase[] {
  const docs = [...BASE];
  const situacion = hechos.get("situacion");
  const circunstancias = hechos.get("circunstancias") ?? "";
  if (situacion === "desempleado") {
    docs.push({ id: "desempleo", titulo: "DARDE y certificados del SEPE", motivo: "Pueden acreditar inscripción y prestaciones.", sensible: true });
  }
  if (situacion === "estudiante") {
    docs.push({ id: "matricula", titulo: "Matrícula o certificado del centro", motivo: "Acredita los estudios y el curso.", sensible: true });
  }
  if (situacion === "autonomo_activo" || hechos.get("perfil") === "autonomo") {
    docs.push({ id: "autonomo", titulo: "Alta y certificados de autónomo", motivo: "Acreditan actividad y situación con Hacienda o Seguridad Social.", sensible: true });
  }
  if ((hechos.get("menores_cargo") ?? "no") !== "no") {
    docs.push({ id: "familia", titulo: "Libro de familia o certificados del Registro Civil", motivo: "Acreditan la unidad familiar cuando las bases lo piden.", sensible: true });
  }
  if (/discapacidad/.test(circunstancias)) {
    docs.push({ id: "discapacidad", titulo: "Resolución del grado de discapacidad", motivo: "Acredita el grado reconocido; un informe médico no siempre la sustituye.", sensible: true });
  }
  if (/dependencia/.test(circunstancias)) {
    docs.push({ id: "dependencia", titulo: "Resolución de dependencia y PIA", motivo: "Acredita el grado y el programa individual de atención, si ya existen.", sensible: true });
  }
  return docs;
}

export interface CompatibilidadAyuda {
  id: string;
  titulo: string;
  estado: "incompatible" | "revisar";
  detalle: string;
}

export function compararPrestaciones(seleccionadas: Prestacion[]): CompatibilidadAyuda[] {
  const ids = new Set(seleccionadas.map((p) => p.id));
  const resultado: CompatibilidadAyuda[] = [];
  for (const p of seleccionadas) {
    for (const otra of p.incompatibleCon ?? []) {
      if (!ids.has(otra) || p.id.localeCompare(otra) > 0) continue;
      const tituloOtra = seleccionadas.find((x) => x.id === otra)?.titular ?? otra;
      resultado.push({
        id: `${p.id}:${otra}`,
        titulo: `${p.titular} + ${tituloOtra}`,
        estado: "incompatible",
        detalle: "El catálogo oficial indica una incompatibilidad expresa. Revisa la regla y el periodo exactos antes de elegir.",
      });
    }
  }
  if (seleccionadas.length >= 2 && resultado.length === 0) {
    resultado.push({
      id: "revision-general",
      titulo: "Compatibilidad todavía por comprobar",
      estado: "revisar",
      detalle:
        "Encaja no tiene registrada una incompatibilidad expresa entre estas vías, pero eso no garantiza que puedan cobrarse juntas. Revisa las bases, los límites de renta y la prohibición de doble financiación.",
    });
  }
  return resultado;
}
