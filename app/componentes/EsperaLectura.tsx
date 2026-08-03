"use client";

import { useEffect, useState } from "react";

/**
 * La espera mientras la IA lee las bases. Un documento que se lee solo,
 * el paso en el que va, y datos de ESTA convocatoria para que el rato
 * sirva de algo.
 */
export default function EsperaLectura({
  pasos,
  sobreLaAyuda,
}: {
  pasos: string[];
  sobreLaAyuda: string[];
}) {
  const [paso, setPaso] = useState(0);
  const [dato, setDato] = useState(0);

  useEffect(() => {
    // Avanza sin llegar nunca al final: el final lo marca la respuesta real.
    const t = setInterval(() => setPaso((n) => Math.min(n + 1, pasos.length - 1)), 2600);
    return () => clearInterval(t);
  }, [pasos.length]);

  useEffect(() => {
    if (sobreLaAyuda.length < 2) return;
    const t = setInterval(() => setDato((n) => (n + 1) % sobreLaAyuda.length), 4200);
    return () => clearInterval(t);
  }, [sobreLaAyuda.length]);

  return (
    <div className="flex flex-col items-center py-6 text-center">
      <div className="hoja-leyendo" aria-hidden>
        <i />
        <i />
        <i />
        <i />
        <i />
        <i />
      </div>

      <p key={paso} className="display mensaje-espera mt-7 text-[22px] leading-snug">
        {pasos[paso]}
        <span className="puntos ml-0.5">
          <span>.</span>
          <span>.</span>
          <span>.</span>
        </span>
      </p>

      <div className="mt-2 h-[2px] w-[180px] overflow-hidden rounded bg-[var(--linea)]">
        <div
          className="h-full transition-[width] duration-[2600ms] ease-out"
          style={{
            width: `${((paso + 1) / (pasos.length + 1)) * 100}%`,
            background: "var(--tinta)",
          }}
        />
      </div>

      {sobreLaAyuda.length > 0 && (
        <p
          key={`d${dato}`}
          className="mensaje-espera mt-8 max-w-md text-[14px] leading-relaxed text-[var(--grafito)]"
        >
          {sobreLaAyuda[dato]}
        </p>
      )}
    </div>
  );
}

export const PASOS_ENCAJE = [
  "Abriendo la convocatoria",
  "Descargando las bases oficiales",
  "Leyendo la letra pequeña",
  "Sacando los requisitos uno a uno",
  "Comparando con lo que ya sé de ti",
  "Preparando solo las preguntas que faltan",
];
