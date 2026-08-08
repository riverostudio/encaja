"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { Prestacion } from "@/lib/prestaciones";
import type { DerivacionOficial } from "@/lib/derivaciones";
import type { DocumentoBase } from "@/lib/acompanamiento";
import { compararPrestaciones } from "@/lib/acompanamiento";
import { alertasParaExpedientes, progresoSolicitud, siguientePasoSolicitud, type ExpedientePlan } from "@/lib/plan";
import { estadoPlazo } from "@/lib/plazos";
import { APP_PUBLICA } from "../componentes/Sesion";
import {
  guardarDocumentoBase,
  leerDocumentosBase,
  listarExpedientesPublicos,
  type DocumentoBaseLocal,
} from "../lib/estado-publico";

interface RespuestaPlan {
  prestaciones: Prestacion[];
  documentos: DocumentoBase[];
  derivaciones: DerivacionOficial[];
  privacidad: string;
}

const LLAVE_SELECCION = "encaja.plan.seleccion";

function seleccionGuardada(): string[] {
  try {
    const dato = JSON.parse(localStorage.getItem(LLAVE_SELECCION) ?? "[]") as unknown;
    return Array.isArray(dato) ? dato.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function colorAlerta(prioridad: number): string {
  return prioridad === 1 ? "var(--senal)" : prioridad === 2 ? "var(--ocre)" : "var(--niebla)";
}

export default function PaginaPlan() {
  const [datos, setDatos] = useState<RespuestaPlan | null>(null);
  const [expedientes, setExpedientes] = useState<ExpedientePlan[]>([]);
  const [documentos, setDocumentos] = useState<Record<string, DocumentoBaseLocal>>({});
  const [seleccion, setSeleccion] = useState<string[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    queueMicrotask(() => {
      setDocumentos(leerDocumentosBase());
      setSeleccion(seleccionGuardada());
    });
    fetch("/api/acompanamiento", { cache: "no-store" })
      .then(async (r) => {
        if (!r.ok) throw new Error("No se ha podido preparar tu plan.");
        setDatos((await r.json()) as RespuestaPlan);
      })
      .catch((e: Error) => setError(e.message));

    if (APP_PUBLICA) {
      queueMicrotask(() => {
        setExpedientes(
          listarExpedientesPublicos().map((e) => {
            const plazo = estadoPlazo(e.conv.fechaInicioSol, e.conv.fechaFinSol);
            return {
              codigo: e.codigoBdns,
              titulo: e.conv.resumen?.titular ?? e.conv.llano.que ?? e.conv.titulo,
              estado: e.estado,
              plazo: plazo.estado,
              dias: plazo.dias,
              tareas: e.checklist,
            };
          }),
        );
      });
    } else {
      fetch("/api/expedientes")
        .then((r) => r.json())
        .then((d: { filas?: Array<{ codigoBdns: string; titulo: string; estado: ExpedientePlan["estado"]; plazo: { estado: ExpedientePlan["plazo"]; dias: number | null } | null; checklistJson?: string }> }) => {
          setExpedientes((d.filas ?? []).map((e) => ({
            codigo: e.codigoBdns,
            titulo: e.titulo,
            estado: e.estado,
            plazo: e.plazo?.estado ?? "sin_fechas",
            dias: e.plazo?.dias ?? null,
            tareas: e.checklistJson ? JSON.parse(e.checklistJson) as ExpedientePlan["tareas"] : [],
          })));
        })
        .catch(() => undefined);
    }
  }, []);

  const alertas = useMemo(() => alertasParaExpedientes(expedientes), [expedientes]);
  const elegidas = useMemo(
    () => (datos?.prestaciones ?? []).filter((p) => seleccion.includes(p.id)),
    [datos, seleccion],
  );
  const compatibilidades = useMemo(() => compararPrestaciones(elegidas), [elegidas]);

  function alternarPrestacion(id: string) {
    const nuevas = seleccion.includes(id) ? seleccion.filter((x) => x !== id) : [...seleccion, id];
    setSeleccion(nuevas);
    localStorage.setItem(LLAVE_SELECCION, JSON.stringify(nuevas));
  }

  function estadoDocumento(id: string): DocumentoBaseLocal["estado"] {
    return documentos[id]?.estado ?? "pendiente";
  }

  function cambiarDocumento(id: string, estado: DocumentoBaseLocal["estado"]) {
    const guardado = guardarDocumentoBase(id, estado);
    setDocumentos((antes) => ({ ...antes, [id]: guardado }));
  }

  return (
    <div className="max-w-4xl">
      <p className="rotulo">Acompañamiento privado</p>
      <h1 className="display mt-2 text-[34px] leading-tight">Mi plan</h1>
      <p className="mt-3 max-w-2xl text-[14px] leading-relaxed text-[var(--grafito)]">
        Aquí ves qué hacer ahora, qué documentos preparar y qué solicitudes vigilar. El estado se guarda en este navegador.
      </p>

      {error && <p role="alert" className="mt-6 rounded-lg border border-[var(--senal)] p-4 text-[13px] text-[var(--senal)]">{error}</p>}

      <section className="mt-10" aria-labelledby="avisos-plan">
        <div className="flex items-baseline justify-between gap-4">
          <h2 id="avisos-plan" className="rotulo">Avisos personalizados</h2>
          <span className="cifra text-[12px] text-[var(--niebla)]">{alertas.length}</span>
        </div>
        {alertas.length ? (
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {alertas.map((alerta) => (
              <Link key={alerta.id} href={alerta.codigo ? `/expedientes/${alerta.codigo}` : "/expedientes"} className="rounded-lg border border-[var(--linea)] bg-[var(--lienzo)] p-4">
                <span className="rotulo" style={{ color: colorAlerta(alerta.prioridad) }}>{alerta.titulo}</span>
                <span className="display mt-1 block text-[17px] leading-snug">{alerta.detalle}</span>
              </Link>
            ))}
          </div>
        ) : (
          <p className="nota mt-3 rounded-lg border border-[var(--linea)] p-5">
            No hay plazos urgentes en tus expedientes. Añade una ayuda desde el radar para recibir aquí sus avisos.
          </p>
        )}
      </section>

      <section className="mt-12" aria-labelledby="ruta-solicitudes">
        <h2 id="ruta-solicitudes" className="rotulo">Ruta de tus solicitudes</h2>
        {expedientes.length ? (
          <div className="mt-3 space-y-3">
            {expedientes.map((e) => {
              const progreso = progresoSolicitud(e);
              return (
                <Link key={e.codigo} href={`/expedientes/${e.codigo}`} className="block rounded-lg border border-[var(--linea)] bg-[var(--lienzo)] p-5">
                  <div className="flex items-start justify-between gap-5">
                    <span className="display text-[18px] leading-snug">{e.titulo}</span>
                    <span className="cifra text-[13px]">{progreso}%</span>
                  </div>
                  <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[var(--linea)]" aria-label={`Progreso ${progreso}%`}>
                    <div className="h-full bg-[var(--bosque)]" style={{ width: `${progreso}%` }} />
                  </div>
                  <p className="nota mt-3"><strong>Siguiente paso:</strong> {siguientePasoSolicitud(e)}</p>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="mt-3 rounded-lg border border-[var(--linea)] p-6">
            <p className="display text-[19px]">Todavía no hay solicitudes en tu plan.</p>
            <Link className="btn mt-5 inline-block" href="/">Buscar ayudas</Link>
          </div>
        )}
      </section>

      <section className="mt-12" aria-labelledby="documentos-base">
        <h2 id="documentos-base" className="rotulo">Preparar documentos — sin subir archivos</h2>
        <p className="nota mt-3 max-w-2xl">{datos?.privacidad ?? "La lista se guarda localmente. Encaja no recibe el contenido de tus documentos."}</p>
        <div className="mt-3">
          {(datos?.documentos ?? []).map((doc) => (
            <div key={doc.id} className="dato">
              <p className="display text-[16px]">{doc.titulo}</p>
              <p className="nota mt-1">{doc.motivo}</p>
              <div className="mt-3 flex flex-wrap gap-4" role="group" aria-label={`Estado de ${doc.titulo}`}>
                {([
                  ["pendiente", "Pendiente"],
                  ["pedir", "Tengo que pedirlo"],
                  ["listo", "Lo tengo"],
                ] as const).map(([valor, etiqueta]) => (
                  <button key={valor} className={`filtro ${estadoDocumento(doc.id) === valor ? "filtro-activo" : ""}`} onClick={() => cambiarDocumento(doc.id, valor)}>{etiqueta}</button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-12" aria-labelledby="comparar-ayudas">
        <h2 id="comparar-ayudas" className="rotulo">Comparar ayudas posibles</h2>
        <p className="nota mt-3 max-w-2xl">
          Selecciona dos o más. “No registrada” nunca significa “compatible”: las bases oficiales deciden y pueden prohibir la doble financiación.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {(datos?.prestaciones ?? []).map((p) => (
            <label key={p.id} className="flex cursor-pointer gap-3 rounded-lg border border-[var(--linea)] bg-[var(--lienzo)] p-4">
              <input className="mt-1 h-4 w-4 accent-[var(--bosque)]" type="checkbox" checked={seleccion.includes(p.id)} onChange={() => alternarPrestacion(p.id)} />
              <span>
                <span className="display block text-[16px] leading-snug">{p.titular}</span>
                <span className="nota mt-1 block">Posible según tu perfil; falta comprobar requisitos oficiales.</span>
              </span>
            </label>
          ))}
        </div>
        {elegidas.length >= 2 && (
          <div className="mt-5 rounded-lg border border-[var(--linea-fuerte)] bg-[var(--lienzo-alto)] p-5" aria-live="polite">
            {compatibilidades.map((c) => (
              <div key={c.id} className="mb-4 last:mb-0">
                <p className="display text-[17px]" style={{ color: c.estado === "incompatible" ? "var(--senal)" : "var(--ocre)" }}>{c.titulo}</p>
                <p className="nota mt-1">{c.detalle}</p>
              </div>
            ))}
          </div>
        )}
        {elegidas.length > 0 && (
          <div className="mt-5 flex flex-wrap gap-3">
            {elegidas.map((p) => <a key={p.id} className="btn btn-linea" href={p.urlSolicitud} target="_blank" rel="noreferrer">{p.accion} ↗</a>)}
          </div>
        )}
      </section>

      <section className="mt-12" aria-labelledby="ayuda-humana">
        <h2 id="ayuda-humana" className="rotulo">Hablar con una persona</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {(datos?.derivaciones ?? []).map((d) => (
            <article key={d.id} className="rounded-lg border border-[var(--linea)] bg-[var(--lienzo)] p-5">
              <p className="rotulo">{d.organismo}</p>
              <h3 className="display mt-2 text-[19px] leading-snug">{d.titulo}</h3>
              <p className="nota mt-2">{d.resumen}</p>
              <a className="enlace mt-4 inline-block text-[13px]" href={d.url} target="_blank" rel="noreferrer">{d.accion} ↗</a>
            </article>
          ))}
        </div>
        {!datos?.derivaciones.length && <p className="nota mt-3">Completa tu perfil o cuéntale tu situación al orientador para recibir una derivación más concreta.</p>}
      </section>
    </div>
  );
}
