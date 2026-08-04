"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface Pendiente {
  sinTraducir: number;
  sinFechas: number;
  configurada: boolean;
}

type Tarea = "traducir" | "fechas";

const TEXTOS: Record<Tarea, { titulo: string; hace: string; boton: string }> = {
  traducir: {
    titulo: "Traducir las ayudas a lenguaje llano",
    hace: "La IA lee cada convocatoria y escribe qué es y qué te llevas, para que no tengas que abrirlas una a una.",
    boton: "Traducir",
  },
  fechas: {
    titulo: "Rescatar los plazos que no publican",
    hace: "Muchas convocatorias no registran las fechas en la BDNS aunque sí estén en el PDF de las bases. La IA las busca ahí.",
    boton: "Buscar plazos",
  },
};

/**
 * El trabajo pesado, hecho de una vez y por tandas: así el radar no depende
 * de que abras cada ficha para hablar en cristiano.
 */
export default function Trabajos({ onTerminar }: { onTerminar?: () => void }) {
  const [pend, setPend] = useState<Pendiente | null>(null);
  const [corriendo, setCorriendo] = useState<Tarea | null>(null);
  const [hechas, setHechas] = useState(0);
  const [fallos, setFallos] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const parar = useRef(false);

  const refrescar = useCallback(async () => {
    setPend((await (await fetch("/api/lote")).json()) as Pendiente);
  }, []);

  useEffect(() => {
    fetch("/api/lote")
      .then((r) => r.json())
      .then((d: Pendiente) => setPend(d))
      .catch(() => undefined);
  }, []);

  async function lanzar(tarea: Tarea) {
    setCorriendo(tarea);
    setHechas(0);
    setFallos(0);
    setError(null);
    parar.current = false;
    try {
      // Por tandas: se ve el avance y se puede parar en cualquier momento.
      for (let i = 0; i < 200 && !parar.current; i++) {
        const r = await fetch("/api/lote", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tarea, tanda: 10 }),
        });
        const d = (await r.json()) as {
          hechas: number;
          fallos: number;
          quedan: number;
          error?: string;
        };
        if (!r.ok) {
          setError(d.error ?? "Ha fallado");
          break;
        }
        setHechas((n) => n + d.hechas);
        setFallos((n) => n + d.fallos);
        await refrescar();
        if (d.quedan <= 0 || d.hechas + d.fallos === 0) break;
      }
    } finally {
      setCorriendo(null);
      await refrescar();
      onTerminar?.();
    }
  }

  if (!pend?.configurada) return null;

  const tareas: { id: Tarea; quedan: number }[] = [
    { id: "traducir", quedan: pend.sinTraducir },
    { id: "fechas", quedan: pend.sinFechas },
  ];

  return (
    <div className="space-y-5">
      {tareas.map((t) => {
        const txt = TEXTOS[t.id];
        const activa = corriendo === t.id;
        return (
          <div key={t.id} className="dato">
            <div className="rotulo mb-1.5">{txt.titulo}</div>
            <p className="nota mb-3">{txt.hace}</p>

            {t.quedan === 0 && !activa ? (
              <p className="text-[13.5px]" style={{ color: "var(--bosque)" }}>
                Todo hecho, no queda ninguna pendiente.
              </p>
            ) : (
              <>
                <p className="text-[13.5px]">
                  <span className="cifra">{t.quedan}</span> pendientes
                  {activa && (
                    <>
                      {" · "}
                      <span className="cifra" style={{ color: "var(--bosque)" }}>
                        {hechas} hechas
                      </span>
                      {fallos > 0 && (
                        <>
                          {" · "}
                          <span className="cifra text-[var(--niebla)]">{fallos} sin poder</span>
                        </>
                      )}
                    </>
                  )}
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  {activa ? (
                    <>
                      <span className="flex items-center gap-2 text-[13px] text-[var(--niebla)]">
                        <span className="pulso" /> Trabajando…
                      </span>
                      <button
                        className="btn btn-linea"
                        onClick={() => {
                          parar.current = true;
                        }}
                      >
                        Parar
                      </button>
                    </>
                  ) : (
                    <button
                      className="btn"
                      disabled={corriendo !== null}
                      onClick={() => void lanzar(t.id)}
                    >
                      {txt.boton}
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        );
      })}

      {error && (
        <p className="nota" style={{ color: "var(--senal)" }}>
          {error}
        </p>
      )}

      <p className="nota">
        Puedes cerrar esta ventana: el trabajo se guarda a medida que avanza y lo retomas cuando
        quieras. Cada convocatoria se procesa una sola vez.
      </p>
    </div>
  );
}
