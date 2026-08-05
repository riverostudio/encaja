#!/usr/bin/env tsx
import fs from "node:fs";
import path from "node:path";
import { abrirDb } from "../lib/db";
import { crearRepo } from "../lib/repo";

const data = path.join(process.cwd(), "data");
fs.mkdirSync(data, { recursive: true });
const ruta = path.join(data, "radar-publico.db");
const db = abrirDb(ruta);
const repo = crearRepo(db);
repo.upsertLista(
  [
    {
      codigoBdns: "999999",
      titulo: "Ayuda pública de prueba",
      nivel1: "ESTADO",
      nivel2: "Administración General del Estado",
      fechaRegistro: "2026-08-05",
      mrr: false,
      fechaInicioSol: "2026-01-01",
      fechaFinSol: "2027-12-31",
      beneficiarios: ["PERSONAS FÍSICAS QUE NO DESARROLLAN ACTIVIDAD ECONÓMICA"],
      instrumentos: ["SUBVENCIÓN"],
      sectores: [],
      regiones: ["ES"],
      fondos: [],
    },
  ],
  54,
);
db.close();
console.log(`Base mínima de CI creada en ${ruta}`);

