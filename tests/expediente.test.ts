import { describe, it, expect, beforeEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import {
  montarChecklist,
  crearCarpetaExpediente,
  escribirInstrucciones,
  generarBorradorDocx,
} from "../lib/expediente";
import type { Convocatoria, Requisito } from "../lib/tipos";

const conv: Convocatoria = {
  codigoBdns: "923287",
  titulo: "Premios EcoRiba 2026 para iniciativas medioambientales de pymes",
  nivel1: "LOCAL",
  nivel2: "RIBA-ROJA DE TÚRIA",
  nivel3: "AYUNTAMIENTO DE RIBA-ROJA DE TÚRIA",
  fechaRegistro: "2026-08-03",
  mrr: false,
  fechaInicioSol: "2026-09-01",
  fechaFinSol: "2026-09-30",
  urlBases: "https://www.ribarroja.es/bases",
  sede: null,
  beneficiarios: [],
  instrumentos: [],
  sectores: [],
  regiones: [],
  fondos: [],
};

const reqs: Requisito[] = [
  { id: "r1", literal: "Estar al corriente", tipo: "condicion", clave: "al_corriente_hacienda", pregunta: "¿?" },
  { id: "r2", literal: "Presentar memoria descriptiva del proyecto", tipo: "documento" },
  { id: "r3", literal: "Certificado de la Seguridad Social", tipo: "documento" },
];

let base: string;
beforeEach(() => {
  base = fs.mkdtempSync(path.join(os.tmpdir(), "radar-exp-"));
});

describe("montarChecklist", () => {
  it("solo los requisitos tipo documento, en estado pendiente", () => {
    const c = montarChecklist(reqs);
    expect(c).toHaveLength(2);
    expect(c[0]).toMatchObject({ texto: expect.stringContaining("memoria"), estado: "pendiente" });
  });
});

describe("crearCarpetaExpediente", () => {
  it("crea la carpeta con slug y FUENTE.md con los enlaces oficiales", () => {
    const dir = crearCarpetaExpediente(base, conv);
    expect(fs.existsSync(dir)).toBe(true);
    expect(path.basename(dir).startsWith("923287-")).toBe(true);
    const fuente = fs.readFileSync(path.join(dir, "FUENTE.md"), "utf8");
    expect(fuente).toContain("923287");
    expect(fuente).toContain("infosubvenciones.es");
    expect(fuente).toContain("ribarroja.es");
  });

  it("es idempotente", () => {
    const d1 = crearCarpetaExpediente(base, conv);
    const d2 = crearCarpetaExpediente(base, conv);
    expect(d1).toBe(d2);
  });
});

describe("escribirInstrucciones", () => {
  it("incluye plazo, checklist y el aviso de que firma él", () => {
    const dir = crearCarpetaExpediente(base, conv);
    escribirInstrucciones(dir, conv, reqs);
    const texto = fs.readFileSync(path.join(dir, "INSTRUCCIONES.md"), "utf8");
    expect(texto).toContain("2026-09-30");
    expect(texto).toContain("memoria");
    expect(texto.toLowerCase()).toContain("firma");
  });
});

describe("generarBorradorDocx", () => {
  it("genera un DOCX real con marca de borrador", async () => {
    const dir = crearCarpetaExpediente(base, conv);
    const ruta = await generarBorradorDocx(dir, "Memoria técnica", [
      { h: "Objeto", p: ["Descripción del proyecto para los premios EcoRiba."] },
      { h: "Presupuesto", p: ["Total: 1.000 €"] },
    ]);
    expect(ruta.endsWith(".docx")).toBe(true);
    expect(fs.statSync(ruta).size).toBeGreaterThan(1024);
  });
});
