// Expedientes: carpeta real en disco por ayuda, checklist de documentos,
// instrucciones de presentación y borradores DOCX. La app NUNCA firma ni
// presenta: eso queda siempre en manos del usuario.
import fs from "node:fs";
import path from "node:path";
import { Document, HeadingLevel, Packer, Paragraph, TextRun } from "docx";
import type { Convocatoria, ItemChecklist, Requisito } from "./tipos";

export function urlFichaBdns(codigoBdns: string): string {
  return `https://www.infosubvenciones.es/bdnstrans/GE/es/convocatoria/${codigoBdns}`;
}

function slug(texto: string, max = 40): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, max)
    .replace(/-+$/, "");
}

/** Checklist a partir de los requisitos tipo "documento" de las bases. */
export function montarChecklist(requisitos: Requisito[]): ItemChecklist[] {
  return requisitos
    .filter((r) => r.tipo === "documento")
    .map((r) => ({ id: r.id, texto: r.literal, estado: "pendiente" as const }));
}

/** Crea (idempotente) la carpeta del expediente con su FUENTE.md. */
export function crearCarpetaExpediente(baseDir: string, conv: Convocatoria): string {
  const dir = path.join(baseDir, `${conv.codigoBdns}-${slug(conv.titulo)}`);
  fs.mkdirSync(dir, { recursive: true });
  const fuente = [
    `# Fuentes oficiales — convocatoria ${conv.codigoBdns}`,
    "",
    `**${conv.titulo}**`,
    "",
    `- Órgano: ${[conv.nivel3, conv.nivel2].filter(Boolean).join(" · ")} (${conv.nivel1})`,
    `- Ficha oficial BDNS: ${urlFichaBdns(conv.codigoBdns)}`,
    conv.urlBases ? `- Bases reguladoras: ${conv.urlBases}` : null,
    conv.sede ? `- Sede electrónica: ${conv.sede}` : null,
    `- Plazo de solicitud: ${conv.fechaInicioSol ?? "ver bases"} → ${conv.fechaFinSol ?? "ver bases"}`,
    "",
    "> Verifica siempre contra la fuente oficial: los datos de la BDNS son dinámicos.",
    "",
  ]
    .filter((l) => l !== null)
    .join("\n");
  fs.writeFileSync(path.join(dir, "FUENTE.md"), fuente);
  return dir;
}

/** INSTRUCCIONES.md: pasos de presentación. La firma y el envío son del usuario. */
export function escribirInstrucciones(
  dir: string,
  conv: Convocatoria,
  requisitos: Requisito[],
): string {
  const docs = montarChecklist(requisitos);
  const texto = [
    `# Cómo presentar la solicitud — ${conv.codigoBdns}`,
    "",
    `**Plazo:** ${conv.fechaInicioSol ?? "ver bases"} → **${conv.fechaFinSol ?? "ver bases"}** (el último día incluido).`,
    "",
    "## 1 · Reúne los documentos",
    "",
    ...(docs.length
      ? docs.map((d, i) => `${i + 1}. [ ] ${d.texto}`)
      : ["(Las bases no detallan documentos aún — revísalas en el enlace de FUENTE.md)"]),
    "",
    "## 2 · Dónde se presenta",
    "",
    conv.sede
      ? `Sede electrónica del órgano convocante: ${conv.sede}`
      : `Las bases indican el lugar de presentación (normalmente la sede electrónica de ${conv.nivel3 ?? conv.nivel2}). Enlace a las bases en FUENTE.md.`,
    "",
    "## 3 · Presenta y guarda el justificante",
    "",
    "- Entra con tu **certificado digital** (FNMT) o Cl@ve.",
    "- Sube los documentos, revisa el resumen y **firma tú** la solicitud.",
    "- Descarga el justificante de registro y guárdalo en esta carpeta.",
    "",
    "> ⚠️ Esta app prepara el expediente pero **la firma y la presentación son siempre tuyas**.",
    "> Los borradores generados con IA están marcados como BORRADOR: revísalos antes de usarlos.",
    "",
  ].join("\n");
  fs.writeFileSync(path.join(dir, "INSTRUCCIONES.md"), texto);
  return texto;
}

/** Genera un DOCX de borrador (memoria, declaración…) en la carpeta. */
export async function generarBorradorDocx(
  dir: string,
  titulo: string,
  secciones: { h: string; p: string[] }[],
): Promise<string> {
  const doc = new Document({
    sections: [
      {
        children: [
          new Paragraph({ text: titulo, heading: HeadingLevel.TITLE }),
          new Paragraph({
            children: [
              new TextRun({
                text: "BORRADOR generado con IA — revisar y completar antes de presentar",
                bold: true,
                color: "B00020",
              }),
            ],
          }),
          new Paragraph({ text: "" }),
          ...secciones.flatMap((s) => [
            new Paragraph({ text: s.h, heading: HeadingLevel.HEADING_1 }),
            ...s.p.map((t) => new Paragraph({ text: t })),
            new Paragraph({ text: "" }),
          ]),
        ],
      },
    ],
  });
  const ruta = path.join(dir, `${slug(titulo, 30) || "borrador"}.docx`);
  fs.writeFileSync(ruta, await Packer.toBuffer(doc));
  return ruta;
}
