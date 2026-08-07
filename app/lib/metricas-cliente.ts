"use client";

import type { TipoMetrica } from "../../lib/metricas-tipos";

const PUBLICO = process.env.NEXT_PUBLIC_ENCAJA_PUBLICO === "1";
const LLAVE_METRICAS = "encaja.metricas.v1";
const LLAVE_VISITANTE = "encaja.sesion";
const LLAVE_SESION = "encaja.sesion-analitica";
const LLAVE_TIEMPO_SESION = "encaja.tiempo-sesion";
const LLAVE_RADAR_SESION = "encaja.tiempo-radar-sesion";
const LLAVE_CONSENTIMIENTO = "encaja.consentimiento-metricas";
export const EVENTO_METRICAS = "encaja:metricas-locales";

export type ConsentimientoMetricas = "si" | "no" | null;
export type CategoriaBusqueda =
  | "vivienda"
  | "empleo"
  | "estudios"
  | "familia"
  | "autonomos"
  | "ingresos"
  | "energia"
  | "discapacidad"
  | "transporte"
  | "otros";

export interface BusquedaLocal {
  texto: string;
  categoria: CategoriaBusqueda;
  resultados: number;
  fecha: string;
}

export interface AyudaVistaLocal {
  codigoBdns: string;
  titulo: string;
  organo: string;
  fechaInicioSol?: string | null;
  fechaFinSol?: string | null;
  rangoFechas: string;
  vistaAt: string;
  veces: number;
}

export interface MetricasLocales {
  version: 1;
  primeraVisitaAt: string;
  ultimaActividadAt: string;
  tiempoActivoSegundos: number;
  tiempoRadarSegundos: number;
  paginasVistas: number;
  usosAgente: number;
  busquedas: BusquedaLocal[];
  ayudasVistas: AyudaVistaLocal[];
}

function vacias(): MetricasLocales {
  const ahora = new Date().toISOString();
  return {
    version: 1,
    primeraVisitaAt: ahora,
    ultimaActividadAt: ahora,
    tiempoActivoSegundos: 0,
    tiempoRadarSegundos: 0,
    paginasVistas: 0,
    usosAgente: 0,
    busquedas: [],
    ayudasVistas: [],
  };
}

export function leerMetricasLocales(): MetricasLocales {
  if (typeof window === "undefined") return vacias();
  try {
    const crudo = localStorage.getItem(LLAVE_METRICAS);
    if (!crudo) return vacias();
    const datos = JSON.parse(crudo) as Partial<MetricasLocales>;
    const base = vacias();
    return {
      ...base,
      ...datos,
      version: 1,
      busquedas: Array.isArray(datos.busquedas) ? datos.busquedas.slice(0, 60) : [],
      ayudasVistas: Array.isArray(datos.ayudasVistas) ? datos.ayudasVistas.slice(0, 80) : [],
    };
  } catch {
    return vacias();
  }
}

function guardar(datos: MetricasLocales): void {
  try {
    localStorage.setItem(LLAVE_METRICAS, JSON.stringify(datos));
    window.dispatchEvent(new Event(EVENTO_METRICAS));
  } catch {
    // El panel sigue funcionando durante la visita aunque el navegador bloquee el guardado.
  }
}

export function leerConsentimientoMetricas(): ConsentimientoMetricas {
  if (typeof window === "undefined") return null;
  const valor = localStorage.getItem(LLAVE_CONSENTIMIENTO);
  return valor === "si" || valor === "no" ? valor : null;
}

export function guardarConsentimientoMetricas(valor: Exclude<ConsentimientoMetricas, null>): void {
  try {
    localStorage.setItem(LLAVE_CONSENTIMIENTO, valor);
    window.dispatchEvent(new Event("encaja:consentimiento-metricas"));
  } catch {
    // Sin almacenamiento, la opción más protectora es no enviar estadísticas.
  }
}

function uuid(llave: string, sesion: boolean): string {
  const almacen = sesion ? sessionStorage : localStorage;
  try {
    let valor = almacen.getItem(llave) ?? "";
    if (!/^[a-f0-9-]{36}$/i.test(valor)) {
      valor = crypto.randomUUID();
      almacen.setItem(llave, valor);
    }
    return valor;
  } catch {
    return crypto.randomUUID();
  }
}

function paginaActual(): string {
  return window.location.pathname.replace(/^\/expedientes\/\d+$/, "/expedientes/[ayuda]");
}

function enviar(
  tipo: TipoMetrica,
  datos: {
    categoria?: string;
    codigoBdns?: string;
    valor?: number;
    duracionSegundos?: number;
    radarSegundos?: number;
  } = {},
  beacon = false,
): void {
  if (!PUBLICO || leerConsentimientoMetricas() !== "si") return;
  const cuerpo = JSON.stringify({
    visitanteId: uuid(LLAVE_VISITANTE, false),
    sesionId: uuid(LLAVE_SESION, true),
    tipo,
    pagina: paginaActual(),
    ...datos,
  });
  if (beacon && navigator.sendBeacon) {
    navigator.sendBeacon("/api/metricas", new Blob([cuerpo], { type: "application/json" }));
    return;
  }
  void fetch("/api/metricas", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: cuerpo,
    keepalive: true,
  }).catch(() => undefined);
}

export function clasificarBusqueda(texto: string): CategoriaBusqueda {
  const t = texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  if (/alquiler|vivienda|desahuc|hipoteca|rehabilit|casa/.test(t)) return "vivienda";
  if (/desemple|paro|trabaj|empleo|subsidio/.test(t)) return "empleo";
  if (/beca|estudi|universidad|colegio|comedor|libros/.test(t)) return "estudios";
  if (/famil|madre|hijo|infancia|monoparent|numerosa|concili/.test(t)) return "familia";
  if (/autonom|negocio|emprend|pyme/.test(t)) return "autonomos";
  if (/renta|ingreso|minimo|pobreza|recurso/.test(t)) return "ingresos";
  if (/luz|agua|gas|energia|bono social|suministro/.test(t)) return "energia";
  if (/discapacidad|dependencia|cuidad/.test(t)) return "discapacidad";
  if (/transporte|abono|movilidad/.test(t)) return "transporte";
  return "otros";
}

export function sumarTiempoLocal(segundos: number, enRadar: boolean): MetricasLocales {
  const datos = leerMetricasLocales();
  const suma = Math.max(0, Math.min(30, Math.round(segundos)));
  datos.tiempoActivoSegundos += suma;
  if (enRadar) datos.tiempoRadarSegundos += suma;
  datos.ultimaActividadAt = new Date().toISOString();
  try {
    const activoSesion = Number(sessionStorage.getItem(LLAVE_TIEMPO_SESION) ?? 0) + suma;
    sessionStorage.setItem(LLAVE_TIEMPO_SESION, String(activoSesion));
    if (enRadar) {
      const radarSesion = Number(sessionStorage.getItem(LLAVE_RADAR_SESION) ?? 0) + suma;
      sessionStorage.setItem(LLAVE_RADAR_SESION, String(radarSesion));
    }
  } catch {
    // La duración total local sigue disponible aunque sessionStorage esté bloqueado.
  }
  guardar(datos);
  return datos;
}

export function registrarPaginaLocal(): void {
  const datos = leerMetricasLocales();
  datos.paginasVistas += 1;
  datos.ultimaActividadAt = new Date().toISOString();
  guardar(datos);
  enviar("pagina");
}

export function registrarBusquedaLocal(texto: string, resultados: number): void {
  const limpio = texto.replaceAll("|", " · ").trim().replace(/\s+/g, " ").slice(0, 120);
  if (limpio.length < 2) return;
  const datos = leerMetricasLocales();
  const ultima = datos.busquedas[0];
  const repetida =
    ultima?.texto.toLocaleLowerCase("es") === limpio.toLocaleLowerCase("es") &&
    Date.now() - new Date(ultima.fecha).getTime() < 2 * 60_000;
  if (repetida) return;
  const categoria = clasificarBusqueda(limpio);
  datos.busquedas.unshift({
    texto: limpio,
    categoria,
    resultados: Math.max(0, Math.round(resultados)),
    fecha: new Date().toISOString(),
  });
  datos.busquedas = datos.busquedas.slice(0, 60);
  guardar(datos);
  // El texto permanece solo en el navegador; el servidor recibe la categoría y el total.
  enviar("busqueda", { categoria, valor: resultados });
}

export function registrarAyudaVistaLocal(ayuda: Omit<AyudaVistaLocal, "vistaAt" | "veces">): void {
  const datos = leerMetricasLocales();
  const previa = datos.ayudasVistas.find((a) => a.codigoBdns === ayuda.codigoBdns);
  datos.ayudasVistas = datos.ayudasVistas.filter((a) => a.codigoBdns !== ayuda.codigoBdns);
  datos.ayudasVistas.unshift({
    ...ayuda,
    vistaAt: new Date().toISOString(),
    veces: (previa?.veces ?? 0) + 1,
  });
  datos.ayudasVistas = datos.ayudasVistas.slice(0, 80);
  guardar(datos);
  enviar("ayuda_abierta", { codigoBdns: ayuda.codigoBdns });
}

export function registrarExpedienteCreado(codigoBdns: string): void {
  enviar("expediente_creado", { codigoBdns });
}

export function registrarSolicitudAbierta(codigoBdns: string): void {
  enviar("solicitud_abierta", { codigoBdns });
}

export function registrarEncajeIniciado(codigoBdns: string): void {
  enviar("encaje_iniciado", { codigoBdns });
}

export function registrarEncajeTerminado(
  codigoBdns: string,
  resultado: "encaja" | "no_encaja" | "duda" | "pendiente",
): void {
  enviar("encaje_terminado", { codigoBdns, categoria: resultado });
}

export function registrarAgenteAbierto(): void {
  enviar("agente_abierto");
}

export function registrarUsoAgente(modo: "ia" | "guiado", resultados: number): void {
  const datos = leerMetricasLocales();
  datos.usosAgente += 1;
  guardar(datos);
  enviar("agente_usado", { categoria: modo, valor: resultados });
}

export function registrarPerfil(tipo: "particular" | "autonomo" | "empresa"): void {
  enviar("perfil", { categoria: tipo });
}

export function enviarLatido(datos: MetricasLocales, beacon = false): void {
  let duracion = datos.tiempoActivoSegundos;
  let radar = datos.tiempoRadarSegundos;
  try {
    duracion = Number(sessionStorage.getItem(LLAVE_TIEMPO_SESION) ?? 0);
    radar = Number(sessionStorage.getItem(LLAVE_RADAR_SESION) ?? 0);
  } catch {
    // Se usan los totales locales como respaldo cuando no hay sessionStorage.
  }
  enviar(
    "latido",
    {
      duracionSegundos: duracion,
      radarSegundos: radar,
    },
    beacon,
  );
}

export function borrarMetricasLocales(): void {
  localStorage.removeItem(LLAVE_METRICAS);
  sessionStorage.removeItem(LLAVE_SESION);
  sessionStorage.removeItem(LLAVE_TIEMPO_SESION);
  sessionStorage.removeItem(LLAVE_RADAR_SESION);
}
