import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

const ESQUEMA = `
CREATE TABLE IF NOT EXISTS convocatorias (
  codigo_bdns TEXT PRIMARY KEY,
  titulo TEXT NOT NULL,
  titulo_coof TEXT,
  nivel1 TEXT NOT NULL DEFAULT '',
  nivel2 TEXT NOT NULL DEFAULT '',
  nivel3 TEXT,
  fecha_registro TEXT,
  mrr INTEGER NOT NULL DEFAULT 0,
  fecha_inicio_sol TEXT,
  fecha_fin_sol TEXT,
  abierta_flag INTEGER,
  presupuesto REAL,
  url_bases TEXT,
  sede TEXT,
  finalidad TEXT,
  beneficiarios TEXT NOT NULL DEFAULT '[]',
  instrumentos TEXT NOT NULL DEFAULT '[]',
  sectores TEXT NOT NULL DEFAULT '[]',
  regiones TEXT NOT NULL DEFAULT '[]',
  fondos TEXT NOT NULL DEFAULT '[]',
  detalle_json TEXT,
  detalle_at TEXT,
  region_sync INTEGER
);
CREATE INDEX IF NOT EXISTS idx_conv_fin ON convocatorias(fecha_fin_sol);
CREATE INDEX IF NOT EXISTS idx_conv_registro ON convocatorias(fecha_registro);
CREATE INDEX IF NOT EXISTS idx_conv_nivel1 ON convocatorias(nivel1);

CREATE TABLE IF NOT EXISTS sync_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  territorio INTEGER NOT NULL,
  desde TEXT,
  hasta TEXT,
  nuevas INTEGER NOT NULL DEFAULT 0,
  ts TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS perfiles (
  id INTEGER PRIMARY KEY,
  nombre TEXT NOT NULL
);
INSERT OR IGNORE INTO perfiles (id, nombre) VALUES (1, 'Victor');

CREATE TABLE IF NOT EXISTS hechos (
  perfil_id INTEGER NOT NULL,
  clave TEXT NOT NULL,
  valor TEXT NOT NULL,
  fuente TEXT NOT NULL DEFAULT 'manual',
  updated_at TEXT NOT NULL,
  PRIMARY KEY (perfil_id, clave)
);

CREATE TABLE IF NOT EXISTS evaluaciones (
  codigo_bdns TEXT NOT NULL,
  perfil_id INTEGER NOT NULL,
  dictamen TEXT NOT NULL DEFAULT 'pendiente',
  requisitos_json TEXT,
  veredictos_json TEXT,
  motivos_json TEXT,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (codigo_bdns, perfil_id)
);

CREATE TABLE IF NOT EXISTS expedientes (
  codigo_bdns TEXT PRIMARY KEY,
  perfil_id INTEGER NOT NULL DEFAULT 1,
  estado TEXT NOT NULL DEFAULT 'interesa',
  carpeta TEXT NOT NULL,
  checklist_json TEXT NOT NULL DEFAULT '[]',
  creado_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS ajustes (
  clave TEXT PRIMARY KEY,
  valor TEXT NOT NULL
);
`;

/**
 * Abre (creando si hace falta) la base de datos y aplica el esquema.
 * La migración es idempotente: solo CREATE IF NOT EXISTS.
 */
export function abrirDb(ruta?: string): Database.Database {
  const destino = ruta ?? path.join(process.cwd(), "data", "radar.db");
  if (destino !== ":memory:") {
    fs.mkdirSync(path.dirname(destino), { recursive: true });
  }
  const db = new Database(destino);
  db.pragma("journal_mode = WAL");
  db.exec(ESQUEMA);
  return db;
}
