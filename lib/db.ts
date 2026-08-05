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

-- Una convocatoria puede aparecer al sincronizar más de una comunidad. La
-- columna histórica region_sync se conserva para poder abrir copias antiguas,
-- pero el filtrado nuevo usa esta relación muchos-a-muchos.
CREATE TABLE IF NOT EXISTS convocatoria_regiones (
  codigo_bdns TEXT NOT NULL,
  region_id INTEGER NOT NULL,
  PRIMARY KEY (codigo_bdns, region_id)
);
CREATE INDEX IF NOT EXISTS idx_conv_regiones_region ON convocatoria_regiones(region_id);

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

// Columnas añadidas después de la primera versión. CREATE TABLE IF NOT EXISTS
// no las agrega a una base que ya existe, así que se comprueban una a una.
const COLUMNAS_NUEVAS: { tabla: string; columna: string; tipo: string }[] = [
  { tabla: "convocatorias", columna: "resumen_ia", tipo: "TEXT" },
  { tabla: "convocatorias", columna: "resumen_at", tipo: "TEXT" },
  // Plazos rescatados del PDF cuando la BDNS no los publica.
  { tabla: "convocatorias", columna: "fechas_del_pdf", tipo: "INTEGER" },
  { tabla: "convocatorias", columna: "sin_fechas_confirmado", tipo: "INTEGER" },
  { tabla: "convocatorias", columna: "plazo_relativo", tipo: "TEXT" },
];

function migrarColumnas(db: Database.Database): void {
  for (const c of COLUMNAS_NUEVAS) {
    const existentes = db.prepare(`PRAGMA table_info(${c.tabla})`).all() as { name: string }[];
    if (!existentes.some((e) => e.name === c.columna)) {
      db.exec(`ALTER TABLE ${c.tabla} ADD COLUMN ${c.columna} ${c.tipo}`);
    }
  }
}

/**
 * Dónde vive la base. En un servidor de los de ahora el disco del despliegue
 * es de solo lectura, así que en modo público la copiamos una vez a la carpeta
 * temporal y trabajamos ahí: las convocatorias siguen intactas y las
 * traducciones nuevas se aprovechan mientras la instancia viva.
 */
function rutaPorDefecto(): string {
  const empaquetada = path.join(process.cwd(), "data", "radar.db");
  if (process.env.ENCAJA_PUBLICO !== "1") return empaquetada;

  // La que se publica va limpia de datos personales; se genera aparte.
  const publica = path.join(process.cwd(), "data", "radar-publico.db");
  const origen = fs.existsSync(publica) ? publica : empaquetada;

  const trabajo = path.join("/tmp", "radar.db");
  if (!fs.existsSync(trabajo) && fs.existsSync(origen)) {
    fs.copyFileSync(origen, trabajo);
  }
  return trabajo;
}

/**
 * Abre (creando si hace falta) la base de datos y aplica el esquema.
 * La migración es idempotente: CREATE IF NOT EXISTS + columnas comprobadas.
 */
export function abrirDb(ruta?: string): Database.Database {
  const destino = ruta ?? rutaPorDefecto();
  if (destino !== ":memory:") {
    fs.mkdirSync(path.dirname(destino), { recursive: true });
  }
  const db = new Database(destino);
  db.pragma("journal_mode = WAL");
  db.exec(ESQUEMA);
  db.exec(`
    INSERT OR IGNORE INTO convocatoria_regiones (codigo_bdns, region_id)
    SELECT codigo_bdns, region_sync FROM convocatorias WHERE region_sync IS NOT NULL
  `);
  migrarColumnas(db);
  return db;
}
