#!/usr/bin/env tsx
import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { abrirDb } from "../lib/db";

const privada = path.join(process.cwd(), "data", "radar.db");
const publica = path.join(process.cwd(), "data", "radar-publico.db");
if (!fs.existsSync(privada)) throw new Error(`No existe ${privada}`);

const origen = abrirDb(privada);
origen.pragma("wal_checkpoint(TRUNCATE)");
origen.close();
fs.copyFileSync(privada, publica);

const db = new Database(publica);
db.pragma("journal_mode = DELETE");
const tx = db.transaction(() => {
  for (const tabla of ["ajustes", "hechos", "evaluaciones", "expedientes"]) {
    db.prepare(`DELETE FROM ${tabla}`).run();
  }
});
tx();
// Los campos útiles y el id del PDF ya están normalizados en columnas. El JSON
// crudo multiplica el tamaño del despliegue y no aporta nada al visitante.
db.prepare("UPDATE convocatorias SET detalle_json=NULL").run();
db.exec("VACUUM");
const integridad = db.pragma("quick_check") as { quick_check: string }[];
const secretos = db.prepare("SELECT count(*) AS n FROM ajustes").get() as { n: number };
const total = db.prepare("SELECT count(*) AS n FROM convocatorias").get() as { n: number };
db.close();

if (integridad[0]?.quick_check !== "ok" || secretos.n !== 0) {
  throw new Error("La base pública no ha superado la comprobación de privacidad/integridad.");
}
console.log(`Base pública generada: ${total.n} convocatorias, sin datos personales ni claves.`);
