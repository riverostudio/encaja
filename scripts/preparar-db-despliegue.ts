#!/usr/bin/env tsx
import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";

const ruta = path.join(process.cwd(), "data", "radar-publico.db");
const buildPublico = process.env.ENCAJA_PUBLICO === "1" || process.env.VERCEL === "1";

if (!fs.existsSync(ruta)) {
  if (buildPublico) {
    throw new Error(`Falta la base pública necesaria para el despliegue: ${ruta}`);
  }
  console.log("Base pública ausente; se omite la preparación del build local.");
  process.exit(0);
}

const db = new Database(ruta);
try {
  db.pragma("wal_checkpoint(TRUNCATE)");
  const modo = db.pragma("journal_mode = DELETE", { simple: true });
  const integridad = db.pragma("quick_check", { simple: true });

  if (modo !== "delete" || integridad !== "ok") {
    throw new Error(`Base pública no desplegable: journal=${modo}, integridad=${integridad}`);
  }
} finally {
  db.close();
}

console.log("Base pública preparada: íntegra y sin archivos WAL auxiliares.");
