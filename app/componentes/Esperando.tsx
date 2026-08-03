"use client";

import { useEffect, useState } from "react";

/**
 * La espera, contada. En vez de un spinner mudo, tarjetas fantasma con un
 * barrido encima y un mensaje que va cambiando para que se note que la
 * máquina está trabajando y no colgada.
 */
export default function Esperando({
  mensajes,
  tarjetas = 6,
}: {
  mensajes: string[];
  tarjetas?: number;
}) {
  const [i, setI] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setI((n) => (n + 1) % mensajes.length), 2200);
    return () => clearInterval(t);
  }, [mensajes.length]);

  return (
    <div>
      <p className="mt-8 flex items-center gap-2.5 text-[13.5px] text-[var(--grafito)]">
        <span className="puntos text-[var(--tinta)]">
          <span>·</span>
          <span>·</span>
          <span>·</span>
        </span>
        <span key={i} className="mensaje-espera">
          {mensajes[i]}
        </span>
      </p>

      <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: tarjetas }, (_, n) => (
          <div
            key={n}
            className="tarjeta escaner entra !cursor-default"
            style={{ "--i": n } as React.CSSProperties}
          >
            <div className="esqueleto h-6 w-32" />
            <div className="esqueleto mt-3 h-2.5 w-24" />
            <div className="esqueleto mt-6 h-3.5 w-full" />
            <div className="esqueleto mt-2 h-3.5 w-10/12" />
            <div className="esqueleto mt-5 h-3 w-full" />
            <div className="esqueleto mt-2 h-3 w-8/12" />
            <div className="esqueleto mt-6 h-3.5 w-24" />
          </div>
        ))}
      </div>
    </div>
  );
}

export const MENSAJES_RADAR = [
  "Rebuscando en el Boletín Oficial…",
  "Cruzando 646.000 convocatorias del Estado, tu comunidad y tu pueblo…",
  "Descartando las que ya cerraron…",
  "Traduciendo la jerga administrativa…",
  "Ordenando por las que antes se te escapan…",
];

export const MENSAJES_SYNC = [
  "Preguntando a la Base de Datos Nacional de Subvenciones…",
  "Trayendo solo lo publicado desde tu última visita…",
  "Leyendo las fichas nuevas una a una…",
  "Esto tarda un poco la primera vez; luego va sobre ruedas…",
];
