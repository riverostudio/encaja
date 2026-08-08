import "server-only";

import { createHmac } from "node:crypto";
import { neon } from "@neondatabase/serverless";
import type { ResumenAdmin, TipoMetrica } from "./metricas-tipos";

export interface EntradaMetrica {
  visitanteId: string;
  sesionId: string;
  tipo: TipoMetrica;
  pagina: string;
  categoria?: string | null;
  codigoBdns?: string | null;
  valor?: number | null;
  duracionSegundos?: number;
  radarSegundos?: number;
}

interface EventoMemoria {
  visitante: string;
  sesion: string;
  tipo: TipoMetrica;
  pagina: string;
  categoria: string | null;
  codigoBdns: string | null;
  valor: number | null;
  creadoAt: Date;
}

interface SesionMemoria {
  visitante: string;
  inicio: Date;
  ultima: Date;
  pagina: string;
  duracion: number;
  radar: number;
  eventos: number;
}

const alcanceGlobal = globalThis as typeof globalThis & {
  __encajaMetricas?: {
    visitantes: Map<string, { primera: Date; ultima: Date }>;
    sesiones: Map<string, SesionMemoria>;
    eventos: EventoMemoria[];
  };
};
const memoria = alcanceGlobal.__encajaMetricas ?? {
  visitantes: new Map<string, { primera: Date; ultima: Date }>(),
  sesiones: new Map<string, SesionMemoria>(),
  eventos: [] as EventoMemoria[],
};
alcanceGlobal.__encajaMetricas = memoria;

let esquemaPreparado: Promise<void> | null = null;

function conexion() {
  const url = process.env.DATABASE_URL;
  return url ? neon(url) : null;
}

function secretoHash(): string {
  const configurado = process.env.ENCAJA_ANALYTICS_SALT ?? process.env.ENCAJA_ADMIN_SESSION_SECRET;
  if (configurado) return configurado;
  if (process.env.NODE_ENV !== "production") return "encaja-desarrollo-no-usar-en-produccion";
  throw new Error("Falta ENCAJA_ANALYTICS_SALT");
}

function hashId(id: string): string {
  return createHmac("sha256", secretoHash()).update(id).digest("hex");
}

async function prepararEsquema(): Promise<void> {
  const sql = conexion();
  if (!sql) return;
  await sql`
    CREATE TABLE IF NOT EXISTS visitantes_analitica (
      visitante_hash TEXT PRIMARY KEY,
      primera_visita TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      ultima_visita TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS sesiones_analitica (
      sesion_hash TEXT PRIMARY KEY,
      visitante_hash TEXT NOT NULL,
      inicio TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      ultima_actividad TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      pagina TEXT NOT NULL DEFAULT '/',
      duracion_segundos INTEGER NOT NULL DEFAULT 0,
      radar_segundos INTEGER NOT NULL DEFAULT 0,
      eventos INTEGER NOT NULL DEFAULT 0
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS eventos_analitica (
      id BIGSERIAL PRIMARY KEY,
      visitante_hash TEXT NOT NULL,
      sesion_hash TEXT NOT NULL,
      tipo TEXT NOT NULL,
      pagina TEXT NOT NULL,
      categoria TEXT,
      codigo_bdns TEXT,
      valor INTEGER,
      creado_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS limites_admin (
      cliente_hash TEXT PRIMARY KEY,
      ventana_inicio TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      intentos INTEGER NOT NULL DEFAULT 0,
      bloqueado_hasta TIMESTAMPTZ
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_eventos_analitica_fecha ON eventos_analitica (creado_at DESC)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_eventos_analitica_tipo ON eventos_analitica (tipo, creado_at DESC)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_sesiones_analitica_ultima ON sesiones_analitica (ultima_actividad DESC)`;
  // Retención limitada: conserva tendencias anuales sin acumular actividad indefinidamente.
  await sql`DELETE FROM eventos_analitica WHERE creado_at < NOW() - INTERVAL '365 days'`;
  await sql`DELETE FROM sesiones_analitica WHERE ultima_actividad < NOW() - INTERVAL '365 days'`;
  await sql`DELETE FROM visitantes_analitica WHERE ultima_visita < NOW() - INTERVAL '365 days'`;
  await sql`DELETE FROM limites_admin WHERE ventana_inicio < NOW() - INTERVAL '2 days'`;
}

async function esquema(): Promise<void> {
  if (!esquemaPreparado) esquemaPreparado = prepararEsquema();
  try {
    await esquemaPreparado;
  } catch (error) {
    esquemaPreparado = null;
    throw error;
  }
}

export function almacenamientoMetricasConfigurado(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

export async function estadoLimiteAdmin(
  identificador: string,
): Promise<{ bloqueado: boolean; esperaSegundos: number }> {
  const sql = conexion();
  if (!sql) return { bloqueado: false, esperaSegundos: 0 };
  try {
    await esquema();
    const filas = await sql`
      SELECT bloqueado_hasta
      FROM limites_admin
      WHERE cliente_hash = ${hashId(`admin:${identificador}`)}
    `;
    const hasta = filas[0]?.bloqueado_hasta;
    if (!hasta) return { bloqueado: false, esperaSegundos: 0 };
    const espera = Math.ceil((new Date(String(hasta)).getTime() - Date.now()) / 1000);
    return { bloqueado: espera > 0, esperaSegundos: Math.max(0, espera) };
  } catch {
    return { bloqueado: false, esperaSegundos: 0 };
  }
}

export async function registrarFalloAdmin(
  identificador: string,
): Promise<{ bloqueado: boolean; esperaSegundos: number }> {
  const sql = conexion();
  if (!sql) return { bloqueado: false, esperaSegundos: 0 };
  try {
    await esquema();
    const filas = await sql`
      INSERT INTO limites_admin (cliente_hash, ventana_inicio, intentos, bloqueado_hasta)
      VALUES (${hashId(`admin:${identificador}`)}, NOW(), 1, NULL)
      ON CONFLICT (cliente_hash) DO UPDATE SET
        ventana_inicio = CASE
          WHEN limites_admin.ventana_inicio < NOW() - INTERVAL '15 minutes' THEN NOW()
          ELSE limites_admin.ventana_inicio
        END,
        intentos = CASE
          WHEN limites_admin.ventana_inicio < NOW() - INTERVAL '15 minutes' THEN 1
          ELSE limites_admin.intentos + 1
        END,
        bloqueado_hasta = CASE
          WHEN limites_admin.ventana_inicio < NOW() - INTERVAL '15 minutes' THEN NULL
          WHEN limites_admin.intentos + 1 >= 6 THEN NOW() + INTERVAL '15 minutes'
          ELSE limites_admin.bloqueado_hasta
        END
      RETURNING bloqueado_hasta
    `;
    const hasta = filas[0]?.bloqueado_hasta;
    if (!hasta) return { bloqueado: false, esperaSegundos: 0 };
    const espera = Math.ceil((new Date(String(hasta)).getTime() - Date.now()) / 1000);
    return { bloqueado: espera > 0, esperaSegundos: Math.max(0, espera) };
  } catch {
    return { bloqueado: false, esperaSegundos: 0 };
  }
}

export async function limpiarFallosAdmin(identificador: string): Promise<void> {
  const sql = conexion();
  if (!sql) return;
  try {
    await esquema();
    await sql`DELETE FROM limites_admin WHERE cliente_hash = ${hashId(`admin:${identificador}`)}`;
  } catch {
    // El límite local sigue activo si el almacenamiento no está disponible.
  }
}

export async function borrarMetricasVisitante(visitanteId: string): Promise<void> {
  const visitante = hashId(visitanteId);
  const sql = conexion();
  if (!sql) {
    memoria.visitantes.delete(visitante);
    for (const [id, sesion] of memoria.sesiones) {
      if (sesion.visitante === visitante) memoria.sesiones.delete(id);
    }
    memoria.eventos = memoria.eventos.filter((evento) => evento.visitante !== visitante);
    alcanceGlobal.__encajaMetricas = memoria;
    return;
  }
  await esquema();
  await sql.transaction([
    sql`DELETE FROM eventos_analitica WHERE visitante_hash = ${visitante}`,
    sql`DELETE FROM sesiones_analitica WHERE visitante_hash = ${visitante}`,
    sql`DELETE FROM visitantes_analitica WHERE visitante_hash = ${visitante}`,
  ]);
}

export async function registrarMetrica(entrada: EntradaMetrica): Promise<void> {
  const visitante = hashId(entrada.visitanteId);
  const sesion = hashId(entrada.sesionId);
  const ahora = new Date();
  const duracion = Math.max(0, Math.min(86_400, Math.round(entrada.duracionSegundos ?? 0)));
  const radar = Math.max(0, Math.min(duracion, Math.round(entrada.radarSegundos ?? 0)));

  const sql = conexion();
  if (!sql) {
    const v = memoria.visitantes.get(visitante);
    memoria.visitantes.set(visitante, { primera: v?.primera ?? ahora, ultima: ahora });
    const previa = memoria.sesiones.get(sesion);
    memoria.sesiones.set(sesion, {
      visitante,
      inicio: previa?.inicio ?? ahora,
      ultima: ahora,
      pagina: entrada.pagina,
      duracion: Math.max(previa?.duracion ?? 0, duracion),
      radar: Math.max(previa?.radar ?? 0, radar),
      eventos: (previa?.eventos ?? 0) + (entrada.tipo === "latido" ? 0 : 1),
    });
    if (entrada.tipo !== "latido") {
      memoria.eventos.push({
        visitante,
        sesion,
        tipo: entrada.tipo,
        pagina: entrada.pagina,
        categoria: entrada.categoria ?? null,
        codigoBdns: entrada.codigoBdns ?? null,
        valor: entrada.valor ?? null,
        creadoAt: ahora,
      });
      if (memoria.eventos.length > 10_000) memoria.eventos.splice(0, 1_000);
    }
    return;
  }

  await esquema();
  const consultas = [
    sql`
      INSERT INTO visitantes_analitica (visitante_hash, primera_visita, ultima_visita)
      VALUES (${visitante}, NOW(), NOW())
      ON CONFLICT (visitante_hash) DO UPDATE SET ultima_visita = NOW()
    `,
    sql`
      INSERT INTO sesiones_analitica (
        sesion_hash, visitante_hash, inicio, ultima_actividad, pagina,
        duracion_segundos, radar_segundos, eventos
      )
      VALUES (
        ${sesion}, ${visitante}, NOW(), NOW(), ${entrada.pagina},
        ${duracion}, ${radar}, ${entrada.tipo === "latido" ? 0 : 1}
      )
      ON CONFLICT (sesion_hash) DO UPDATE SET
        ultima_actividad = NOW(),
        pagina = EXCLUDED.pagina,
        duracion_segundos = GREATEST(sesiones_analitica.duracion_segundos, EXCLUDED.duracion_segundos),
        radar_segundos = GREATEST(sesiones_analitica.radar_segundos, EXCLUDED.radar_segundos),
        eventos = sesiones_analitica.eventos + EXCLUDED.eventos
    `,
  ];
  if (entrada.tipo !== "latido") {
    consultas.push(sql`
      INSERT INTO eventos_analitica (
        visitante_hash, sesion_hash, tipo, pagina, categoria, codigo_bdns, valor
      )
      VALUES (
        ${visitante}, ${sesion}, ${entrada.tipo}, ${entrada.pagina},
        ${entrada.categoria ?? null}, ${entrada.codigoBdns ?? null}, ${entrada.valor ?? null}
      )
    `);
  }
  await sql.transaction(consultas);
}

function numero(valor: unknown): number {
  const n = Number(valor ?? 0);
  return Number.isFinite(n) ? n : 0;
}

export async function obtenerResumenAdmin(periodoDias: number): Promise<ResumenAdmin> {
  const dias = Math.max(1, Math.min(365, Math.round(periodoDias)));
  const desde = Date.now() - dias * 86_400_000;
  const sql = conexion();

  if (!sql) {
    const eventos = memoria.eventos.filter((e) => e.creadoAt.getTime() >= desde);
    const sesiones = [...memoria.sesiones.entries()].filter(([, s]) => s.ultima.getTime() >= desde);
    const visitantes = new Set(sesiones.map(([, s]) => s.visitante));
    const nuevos = [...memoria.visitantes.entries()].filter(([, v]) => v.primera.getTime() >= desde).length;
    const agrupar = (valores: (string | null)[]) =>
      [...valores.reduce((m, valor) => {
        if (valor) m.set(valor, (m.get(valor) ?? 0) + 1);
        return m;
      }, new Map<string, number>())]
        .map(([nombre, total]) => ({ nombre, total }))
        .sort((a, b) => b.total - a.total);
    const porDia = new Map<string, { visitantes: Set<string>; sesiones: Set<string>; interacciones: number }>();
    for (const e of eventos) {
      const dia = e.creadoAt.toISOString().slice(0, 10);
      const fila = porDia.get(dia) ?? { visitantes: new Set(), sesiones: new Set(), interacciones: 0 };
      fila.visitantes.add(e.visitante);
      fila.sesiones.add(e.sesion);
      fila.interacciones += 1;
      porDia.set(dia, fila);
    }
    const ahora = Date.now();
    const activosPorVisitante = new Map<string, SesionMemoria>();
    for (const [, sesion] of sesiones) {
      if (ahora - sesion.ultima.getTime() >= 120_000) continue;
      const previa = activosPorVisitante.get(sesion.visitante);
      if (!previa || previa.ultima < sesion.ultima) activosPorVisitante.set(sesion.visitante, sesion);
    }
    return {
      generadoAt: new Date().toISOString(),
      persistente: false,
      periodoDias: dias,
      resumen: {
        activosAhora: activosPorVisitante.size,
        visitantes: visitantes.size,
        visitantesTotal: memoria.visitantes.size,
        visitantesNuevos: nuevos,
        sesiones: sesiones.length,
        interacciones: eventos.length,
        busquedas: eventos.filter((e) => e.tipo === "busqueda").length,
        usosAgente: eventos.filter((e) => e.tipo === "agente_usado").length,
        expedientes: eventos.filter((e) => e.tipo === "expediente_creado").length,
        solicitudes: eventos.filter((e) => e.tipo === "solicitud_abierta").length,
        comprobaciones: eventos.filter((e) => e.tipo === "encaje_terminado").length,
        tiempoMedioSegundos: sesiones.length
          ? Math.round(sesiones.reduce((suma, [, s]) => suma + s.duracion, 0) / sesiones.length)
          : 0,
      },
      eventosPorTipo: agrupar(eventos.map((e) => e.tipo)),
      paginas: agrupar(eventos.filter((e) => e.tipo === "pagina").map((e) => e.pagina)),
      categorias: agrupar(eventos.filter((e) => e.tipo === "busqueda").map((e) => e.categoria)),
      ayudas: agrupar(eventos.filter((e) => e.tipo === "ayuda_abierta").map((e) => e.codigoBdns))
        .slice(0, 12)
        .map(({ nombre, total }) => ({ codigo: nombre, total })),
      serie: [...porDia.entries()].sort().map(([dia, f]) => ({
        dia,
        visitantes: f.visitantes.size,
        sesiones: f.sesiones.size,
        interacciones: f.interacciones,
      })),
      activos: [...activosPorVisitante.entries()]
        .map(([visitante, s]) => ({
          visitante: visitante.slice(0, 8),
          pagina: s.pagina,
          segundos: s.duracion,
          ultima: s.ultima.toISOString(),
        })),
      recientes: eventos.slice(-80).reverse().map((e, i) => ({
        id: String(i),
        tipo: e.tipo,
        pagina: e.pagina,
        categoria: e.categoria,
        codigo: e.codigoBdns,
        fecha: e.creadoAt.toISOString(),
        visitante: e.visitante.slice(0, 8),
      })),
    };
  }

  await esquema();
  const [totales, tipos, paginas, categorias, ayudas, serie, activos, recientes] = await sql.transaction([
    sql`
      SELECT
        (SELECT COUNT(DISTINCT visitante_hash) FROM sesiones_analitica WHERE ultima_actividad >= NOW() - (${dias} * INTERVAL '1 day')) AS visitantes,
        (SELECT COUNT(*) FROM visitantes_analitica) AS visitantes_total,
        (SELECT COUNT(*) FROM visitantes_analitica WHERE primera_visita >= NOW() - (${dias} * INTERVAL '1 day')) AS nuevos,
        (SELECT COUNT(*) FROM sesiones_analitica WHERE ultima_actividad >= NOW() - (${dias} * INTERVAL '1 day')) AS sesiones,
        (SELECT COUNT(DISTINCT visitante_hash) FROM sesiones_analitica WHERE ultima_actividad >= NOW() - INTERVAL '2 minutes') AS activos,
        (SELECT COALESCE(AVG(duracion_segundos), 0) FROM sesiones_analitica WHERE ultima_actividad >= NOW() - (${dias} * INTERVAL '1 day')) AS tiempo_medio,
        (SELECT COUNT(*) FROM eventos_analitica WHERE creado_at >= NOW() - (${dias} * INTERVAL '1 day')) AS interacciones,
        (SELECT COUNT(*) FROM eventos_analitica WHERE tipo = 'busqueda' AND creado_at >= NOW() - (${dias} * INTERVAL '1 day')) AS busquedas,
        (SELECT COUNT(*) FROM eventos_analitica WHERE tipo = 'agente_usado' AND creado_at >= NOW() - (${dias} * INTERVAL '1 day')) AS agente,
        (SELECT COUNT(*) FROM eventos_analitica WHERE tipo = 'expediente_creado' AND creado_at >= NOW() - (${dias} * INTERVAL '1 day')) AS expedientes,
        (SELECT COUNT(*) FROM eventos_analitica WHERE tipo = 'solicitud_abierta' AND creado_at >= NOW() - (${dias} * INTERVAL '1 day')) AS solicitudes
        ,(SELECT COUNT(*) FROM eventos_analitica WHERE tipo = 'encaje_terminado' AND creado_at >= NOW() - (${dias} * INTERVAL '1 day')) AS comprobaciones
    `,
    sql`SELECT tipo AS nombre, COUNT(*) AS total FROM eventos_analitica WHERE creado_at >= NOW() - (${dias} * INTERVAL '1 day') GROUP BY tipo ORDER BY total DESC`,
    sql`SELECT pagina AS nombre, COUNT(*) AS total FROM eventos_analitica WHERE tipo = 'pagina' AND creado_at >= NOW() - (${dias} * INTERVAL '1 day') GROUP BY pagina ORDER BY total DESC LIMIT 20`,
    sql`SELECT categoria AS nombre, COUNT(*) AS total FROM eventos_analitica WHERE tipo = 'busqueda' AND categoria IS NOT NULL AND creado_at >= NOW() - (${dias} * INTERVAL '1 day') GROUP BY categoria ORDER BY total DESC LIMIT 20`,
    sql`SELECT codigo_bdns AS codigo, COUNT(*) AS total FROM eventos_analitica WHERE tipo = 'ayuda_abierta' AND codigo_bdns IS NOT NULL AND creado_at >= NOW() - (${dias} * INTERVAL '1 day') GROUP BY codigo_bdns ORDER BY total DESC LIMIT 12`,
    sql`
      SELECT TO_CHAR(DATE_TRUNC('day', creado_at), 'YYYY-MM-DD') AS dia,
        COUNT(DISTINCT visitante_hash) AS visitantes,
        COUNT(DISTINCT sesion_hash) AS sesiones,
        COUNT(*) AS interacciones
      FROM eventos_analitica
      WHERE creado_at >= NOW() - (${dias} * INTERVAL '1 day')
      GROUP BY DATE_TRUNC('day', creado_at)
      ORDER BY DATE_TRUNC('day', creado_at)
    `,
    sql`
      SELECT visitante, pagina, segundos, ultima
      FROM (
        SELECT DISTINCT ON (visitante_hash)
          LEFT(visitante_hash, 8) AS visitante,
          pagina,
          duracion_segundos AS segundos,
          ultima_actividad AS ultima
        FROM sesiones_analitica
        WHERE ultima_actividad >= NOW() - INTERVAL '2 minutes'
        ORDER BY visitante_hash, ultima_actividad DESC
      ) AS personas_activas
      ORDER BY ultima DESC
      LIMIT 100
    `,
    sql`SELECT id, tipo, pagina, categoria, codigo_bdns AS codigo, creado_at AS fecha, LEFT(visitante_hash, 8) AS visitante FROM eventos_analitica WHERE creado_at >= NOW() - (${dias} * INTERVAL '1 day') ORDER BY creado_at DESC LIMIT 80`,
  ]);
  const t = (totales[0] ?? {}) as Record<string, unknown>;
  return {
    generadoAt: new Date().toISOString(),
    persistente: true,
    periodoDias: dias,
    resumen: {
      activosAhora: numero(t.activos),
      visitantes: numero(t.visitantes),
      visitantesTotal: numero(t.visitantes_total),
      visitantesNuevos: numero(t.nuevos),
      sesiones: numero(t.sesiones),
      interacciones: numero(t.interacciones),
      busquedas: numero(t.busquedas),
      usosAgente: numero(t.agente),
      expedientes: numero(t.expedientes),
      solicitudes: numero(t.solicitudes),
      comprobaciones: numero(t.comprobaciones),
      tiempoMedioSegundos: Math.round(numero(t.tiempo_medio)),
    },
    eventosPorTipo: (tipos as Record<string, unknown>[]).map((r) => ({ nombre: String(r.nombre), total: numero(r.total) })),
    paginas: (paginas as Record<string, unknown>[]).map((r) => ({ nombre: String(r.nombre), total: numero(r.total) })),
    categorias: (categorias as Record<string, unknown>[]).map((r) => ({ nombre: String(r.nombre), total: numero(r.total) })),
    ayudas: (ayudas as Record<string, unknown>[]).map((r) => ({ codigo: String(r.codigo), total: numero(r.total) })),
    serie: (serie as Record<string, unknown>[]).map((r) => ({
      dia: String(r.dia),
      visitantes: numero(r.visitantes),
      sesiones: numero(r.sesiones),
      interacciones: numero(r.interacciones),
    })),
    activos: (activos as Record<string, unknown>[]).map((r) => ({
      visitante: String(r.visitante),
      pagina: String(r.pagina),
      segundos: numero(r.segundos),
      ultima: new Date(String(r.ultima)).toISOString(),
    })),
    recientes: (recientes as Record<string, unknown>[]).map((r) => ({
      id: String(r.id),
      tipo: String(r.tipo),
      pagina: String(r.pagina),
      categoria: r.categoria == null ? null : String(r.categoria),
      codigo: r.codigo == null ? null : String(r.codigo),
      fecha: new Date(String(r.fecha)).toISOString(),
      visitante: String(r.visitante),
    })),
  };
}
