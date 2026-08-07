"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { estadoPlazo } from "@/lib/plazos";
import { colorPlazo, fraseP1azo } from "./tipos-ui";
import {
  EVENTO_METRICAS,
  leerMetricasLocales,
  type MetricasLocales,
} from "../lib/metricas-cliente";

function duracion(segundos: number): string {
  if (segundos < 60) return `${segundos} s`;
  const minutos = Math.round(segundos / 60);
  if (minutos < 60) return `${minutos} min`;
  const horas = Math.floor(minutos / 60);
  const resto = minutos % 60;
  return resto ? `${horas} h ${resto} min` : `${horas} h`;
}

function fecha(iso: string): string {
  return new Intl.DateTimeFormat("es-ES", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

export default function MetricasUsuario() {
  const [metricas, setMetricas] = useState<MetricasLocales | null>(null);

  useEffect(() => {
    const actualizar = () => setMetricas(leerMetricasLocales());
    queueMicrotask(actualizar);
    window.addEventListener(EVENTO_METRICAS, actualizar);
    const intervalo = window.setInterval(actualizar, 15_000);
    return () => {
      window.removeEventListener(EVENTO_METRICAS, actualizar);
      window.clearInterval(intervalo);
    };
  }, []);

  if (!metricas) return null;
  const ayudas = metricas.ayudasVistas.slice(0, 12);
  const busquedas = metricas.busquedas.slice(0, 8);

  return (
    <section className="mt-8" aria-labelledby="titulo-mi-actividad">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="rotulo">Panel privado de este navegador</p>
          <h2 id="titulo-mi-actividad" className="display mt-1 text-[24px]">
            Mi actividad
          </h2>
        </div>
        <p className="nota max-w-sm">
          Tu tiempo, búsquedas e historial detallado no salen de este navegador.
        </p>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          [duracion(metricas.tiempoActivoSegundos), "dentro de Encaja"],
          [duracion(metricas.tiempoRadarSegundos), "buscando ayudas"],
          [String(metricas.busquedas.length), "búsquedas guardadas"],
          [String(metricas.ayudasVistas.length), "ayudas consultadas"],
        ].map(([valor, etiqueta]) => (
          <div key={etiqueta} className="rounded-lg border border-[var(--linea)] bg-[var(--lienzo-alto)] p-4">
            <strong className="display cifra block text-[25px] font-normal">{valor}</strong>
            <span className="rotulo mt-1 block">{etiqueta}</span>
          </div>
        ))}
      </div>

      <div className="mt-7 grid gap-7 lg:grid-cols-2">
        <div>
          <h3 className="rotulo">Historial de ayudas seleccionadas</h3>
          {ayudas.length === 0 ? (
            <p className="nota mt-3">Cuando abras una ayuda en el radar aparecerá aquí.</p>
          ) : (
            <div className="mt-2">
              {ayudas.map((ayuda) => {
                const plazo = estadoPlazo(ayuda.fechaInicioSol, ayuda.fechaFinSol);
                return (
                  <Link
                    key={ayuda.codigoBdns}
                    href={`/?ayuda=${ayuda.codigoBdns}`}
                    className="fila block !grid-cols-[1fr_auto]"
                  >
                    <span className="min-w-0 pr-3">
                      <span className="display line-clamp-2 text-[15px] leading-snug">
                        {ayuda.titulo}
                      </span>
                      <span className="mt-1 block text-[11.5px] text-[var(--niebla)]">
                        {fecha(ayuda.vistaAt)} · vista {ayuda.veces} {ayuda.veces === 1 ? "vez" : "veces"}
                      </span>
                    </span>
                    <span className="text-right text-[11.5px]" style={{ color: colorPlazo(plazo) }}>
                      {fraseP1azo(plazo)}
                    </span>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        <div>
          <h3 className="rotulo">Búsquedas recientes</h3>
          {busquedas.length === 0 ? (
            <p className="nota mt-3">Todavía no has hecho búsquedas con texto.</p>
          ) : (
            <div className="mt-2">
              {busquedas.map((busqueda) => (
                <Link
                  key={`${busqueda.fecha}-${busqueda.texto}`}
                  href={`/?buscar=${encodeURIComponent(busqueda.texto)}`}
                  className="fila block !grid-cols-[1fr_auto]"
                >
                  <span>
                    <span className="display block text-[15px]">{busqueda.texto}</span>
                    <span className="rotulo mt-1 block">{busqueda.categoria}</span>
                  </span>
                  <span className="cifra text-[12px] text-[var(--grafito)]">
                    {busqueda.resultados} resultados
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
