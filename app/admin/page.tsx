"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { ResumenAdmin } from "@/lib/metricas-tipos";

type DatosAdmin = ResumenAdmin & { titulos: Record<string, string> };

const NOMBRES_EVENTO: Record<string, string> = {
  pagina: "Páginas vistas",
  busqueda: "Búsquedas",
  ayuda_abierta: "Ayudas abiertas",
  expediente_creado: "Expedientes creados",
  solicitud_abierta: "Salidas para solicitar",
  encaje_iniciado: "Comprobaciones iniciadas",
  encaje_terminado: "Comprobaciones terminadas",
  agente_abierto: "Aperturas del orientador",
  agente_usado: "Consultas al orientador",
  perfil: "Perfiles iniciados",
  accion: "Otras acciones",
};

function duracion(segundos: number): string {
  if (segundos < 60) return `${segundos} s`;
  const minutos = Math.round(segundos / 60);
  if (minutos < 60) return `${minutos} min`;
  return `${Math.floor(minutos / 60)} h ${minutos % 60} min`;
}

function hora(iso: string): string {
  return new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(iso));
}

export default function PaginaAdmin() {
  const [clave, setClave] = useState("");
  const [datos, setDatos] = useState<DatosAdmin | null>(null);
  const [dias, setDias] = useState(7);
  const [estado, setEstado] = useState<"cargando" | "login" | "listo" | "error">("cargando");
  const [mensaje, setMensaje] = useState("");
  const [entrando, setEntrando] = useState(false);

  const cargar = useCallback(async (periodo = dias) => {
    try {
      const respuesta = await fetch(`/api/admin/metricas?dias=${periodo}`, { cache: "no-store" });
      if (respuesta.status === 401) {
        setEstado("login");
        setDatos(null);
        return;
      }
      if (!respuesta.ok) throw new Error("No se han podido cargar las métricas.");
      setDatos((await respuesta.json()) as DatosAdmin);
      setEstado("listo");
      setMensaje("");
    } catch (error) {
      setMensaje(error instanceof Error ? error.message : "Error de conexión");
      setEstado("error");
    }
  }, [dias]);

  useEffect(() => {
    queueMicrotask(() => void cargar());
  }, [cargar]);

  useEffect(() => {
    if (estado !== "listo") return;
    const intervalo = window.setInterval(() => void cargar(), 15_000);
    return () => window.clearInterval(intervalo);
  }, [cargar, estado]);

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    setEntrando(true);
    setMensaje("");
    const respuesta = await fetch("/api/admin/sesion", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clave }),
    });
    if (!respuesta.ok) {
      const cuerpo = (await respuesta.json()) as { error?: string };
      setMensaje(cuerpo.error ?? "No se ha podido entrar.");
      setEntrando(false);
      return;
    }
    setClave("");
    await cargar();
    setEntrando(false);
  }

  async function salir() {
    await fetch("/api/admin/sesion", { method: "DELETE" });
    setDatos(null);
    setEstado("login");
  }

  if (estado === "cargando") {
    return (
      <p className="flex items-center gap-2 py-20 text-[13px] text-[var(--niebla)]">
        <span className="pulso" /> Abriendo el panel confidencial…
      </p>
    );
  }

  if (estado === "login") {
    return (
      <div className="mx-auto flex min-h-[75dvh] max-w-sm flex-col justify-center">
        <p className="rotulo">Encaja · acceso restringido</p>
        <h1 className="display mt-2 text-[34px]">Administración</h1>
        <p className="nota mt-3">
          Las métricas agregadas son confidenciales. La sesión se guarda en una cookie segura y
          caduca después de ocho horas.
        </p>
        <form className="mt-8" onSubmit={entrar}>
          <label>
            <span className="rotulo mb-2 block">Clave de administración</span>
            <input
              className="campo w-full !text-[22px]"
              type="password"
              inputMode="numeric"
              autoComplete="current-password"
              value={clave}
              onChange={(e) => setClave(e.target.value)}
              autoFocus
            />
          </label>
          {mensaje && <p className="mt-3 text-[13px] text-[var(--senal)]">{mensaje}</p>}
          <button className="btn mt-6 w-full" type="submit" disabled={entrando || !clave}>
            {entrando ? "Comprobando…" : "Entrar"}
          </button>
        </form>
        <Link href="/" className="enlace mt-7 text-[12px]">
          Volver a Encaja
        </Link>
      </div>
    );
  }

  if (!datos) {
    return (
      <div className="py-20">
        <p className="text-[var(--senal)]">{mensaje || "No hay datos disponibles."}</p>
        <button className="btn btn-linea mt-5" onClick={() => void cargar()}>
          Reintentar
        </button>
      </div>
    );
  }

  const maximoSerie = Math.max(1, ...datos.serie.map((fila) => fila.interacciones));
  return (
    <div>
      <header className="flex flex-wrap items-start justify-between gap-5">
        <div>
          <p className="rotulo">Encaja · información confidencial</p>
          <h1 className="display mt-1 text-[34px]">Métricas de administración</h1>
          <p className="nota mt-2">
            Actualización automática cada 15 segundos · {hora(datos.generadoAt)}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/" className="enlace text-[12px]">Ver la app</Link>
          <button className="btn-texto" onClick={() => void salir()}>Cerrar sesión</button>
        </div>
      </header>

      {!datos.persistente && (
        <p className="mt-6 rounded-lg border border-[var(--ocre)] p-4 text-[13px] text-[var(--ocre)]">
          Modo de prueba: el almacenamiento persistente todavía no está conectado.
        </p>
      )}

      <div className="mt-7 flex flex-wrap items-center gap-5">
        <span className="rotulo">Periodo</span>
        {[1, 7, 30, 90, 365].map((periodo) => (
          <button
            key={periodo}
            className={`filtro ${dias === periodo ? "filtro-activo" : ""}`}
            onClick={() => {
              setDias(periodo);
              void cargar(periodo);
            }}
          >
            {periodo === 1 ? "Hoy" : periodo === 365 ? "1 año" : `${periodo} días`}
          </button>
        ))}
      </div>

      <section className="mt-7 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5" aria-label="Resumen">
        {[
          [datos.resumen.activosAhora, "usando ahora", "var(--bosque)"],
          [datos.resumen.visitantes, "visitantes", "var(--tinta)"],
          [datos.resumen.visitantesTotal, "visitantes · 1 año", "var(--tinta)"],
          [datos.resumen.sesiones, "sesiones", "var(--tinta)"],
          [datos.resumen.interacciones, "interacciones", "var(--tinta)"],
          [datos.resumen.busquedas, "búsquedas", "var(--tinta)"],
          [datos.resumen.usosAgente, "usos del agente", "var(--ocre)"],
          [datos.resumen.expedientes, "expedientes", "var(--tinta)"],
          [datos.resumen.comprobaciones, "comprobaciones", "var(--bosque)"],
          [datos.resumen.solicitudes, "salidas a solicitar", "var(--senal)"],
          [datos.resumen.visitantesNuevos, "visitantes nuevos", "var(--tinta)"],
          [duracion(datos.resumen.tiempoMedioSegundos), "tiempo medio", "var(--tinta)"],
        ].map(([valor, etiqueta, color]) => (
          <div key={etiqueta} className="rounded-lg border border-[var(--linea)] bg-[var(--lienzo-alto)] p-4">
            <strong className="display cifra block text-[27px] font-normal" style={{ color: String(color) }}>
              {valor}
            </strong>
            <span className="rotulo mt-1 block">{etiqueta}</span>
          </div>
        ))}
      </section>

      <section className="mt-10">
        <h2 className="rotulo">Actividad diaria</h2>
        {datos.serie.length === 0 ? (
          <p className="nota mt-3">Todavía no hay actividad en este periodo.</p>
        ) : (
          <div className="mt-4 flex h-48 items-end gap-2 border-b border-[var(--linea)] px-1">
            {datos.serie.map((fila) => (
              <div key={fila.dia} className="group flex h-full min-w-0 flex-1 flex-col justify-end" title={`${fila.dia}: ${fila.interacciones} interacciones`}>
                <div
                  className="min-h-1 rounded-t bg-[var(--bosque)] opacity-75 transition-opacity group-hover:opacity-100"
                  style={{ height: `${Math.max(3, (fila.interacciones / maximoSerie) * 100)}%` }}
                />
                <span className="cifra mt-2 truncate text-center text-[9px] text-[var(--niebla)]">
                  {fila.dia.slice(5)}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="mt-12 grid gap-10 lg:grid-cols-3">
        <Lista titulo="Interacciones" filas={datos.eventosPorTipo.map((f) => ({ nombre: NOMBRES_EVENTO[f.nombre] ?? f.nombre, total: f.total }))} />
        <Lista titulo="Temas buscados" filas={datos.categorias} />
        <Lista titulo="Páginas" filas={datos.paginas} />
      </div>

      <div className="mt-12 grid gap-10 lg:grid-cols-2">
        <section>
          <h2 className="rotulo">Ayudas más consultadas</h2>
          <div className="mt-3">
            {datos.ayudas.map((ayuda) => (
              <div key={ayuda.codigo} className="fila !grid-cols-[1fr_auto]">
                <span>
                  <span className="display line-clamp-2 text-[14px]">{datos.titulos[ayuda.codigo]}</span>
                  <span className="rotulo mt-1 block">BDNS {ayuda.codigo}</span>
                </span>
                <span className="cifra">{ayuda.total}</span>
              </div>
            ))}
          </div>
        </section>
        <section>
          <h2 className="rotulo">Personas usando la app ahora</h2>
          <div className="mt-3">
            {datos.activos.length === 0 ? (
              <p className="nota">Nadie con estadísticas aceptadas en los últimos dos minutos.</p>
            ) : datos.activos.map((activo) => (
              <div key={activo.sesion} className="fila !grid-cols-[auto_1fr_auto]">
                <span className="h-2 w-2 rounded-full bg-[var(--bosque)]" />
                <span className="text-[13px]">{activo.pagina}</span>
                <span className="cifra text-[11px] text-[var(--niebla)]">{duracion(activo.segundos)}</span>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="mt-12">
        <h2 className="rotulo">Últimas interacciones anónimas</h2>
        <div className="mt-3 overflow-x-auto rounded-lg border border-[var(--linea)]">
          <table className="w-full min-w-[720px] text-left text-[12px]">
            <thead className="bg-[var(--lienzo-alto)] text-[var(--niebla)]">
              <tr><th className="p-3">Hora</th><th className="p-3">Evento</th><th className="p-3">Página</th><th className="p-3">Dato permitido</th><th className="p-3">Visitante</th></tr>
            </thead>
            <tbody>
              {datos.recientes.map((evento) => (
                <tr key={evento.id} className="border-t border-[var(--linea)]">
                  <td className="cifra whitespace-nowrap p-3 text-[var(--niebla)]">{hora(evento.fecha)}</td>
                  <td className="p-3">{NOMBRES_EVENTO[evento.tipo] ?? evento.tipo}</td>
                  <td className="p-3">{evento.pagina}</td>
                  <td className="p-3">{evento.codigo ? `BDNS ${evento.codigo}` : evento.categoria ?? "—"}</td>
                  <td className="cifra p-3 text-[var(--niebla)]">{evento.visitante}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <p className="nota mt-10 max-w-3xl border-t border-[var(--linea)] pt-6">
        Solo se cuentan visitantes que aceptaron estadísticas. No se almacenan claves de IA,
        perfiles, códigos postales, textos de búsqueda, mensajes del agente, documentos, IP ni
        datos bancarios. Los identificadores aleatorios se transforman mediante HMAC antes de
        guardarse y los eventos caducan después de 365 días.
      </p>
    </div>
  );
}

function Lista({ titulo, filas }: { titulo: string; filas: { nombre: string; total: number }[] }) {
  const maximo = Math.max(1, ...filas.map((fila) => fila.total));
  return (
    <section>
      <h2 className="rotulo">{titulo}</h2>
      <div className="mt-4 space-y-3">
        {filas.length === 0 ? <p className="nota">Sin datos todavía.</p> : filas.slice(0, 10).map((fila) => (
          <div key={fila.nombre}>
            <div className="flex items-baseline justify-between gap-3 text-[12px]">
              <span>{fila.nombre}</span><span className="cifra text-[var(--niebla)]">{fila.total}</span>
            </div>
            <div className="mt-1 h-1 overflow-hidden rounded bg-[var(--linea)]">
              <div className="h-full bg-[var(--bosque)]" style={{ width: `${(fila.total / maximo) * 100}%` }} />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
