"use client";

import { useEffect, useRef, useState } from "react";

interface Pendiente {
  sinTraducir: number;
  sinFechas: number;
  traducidas: number;
  total: number;
  configurada: boolean;
}

/**
 * Lo que ya está guardado y lo que queda. La traducción NO se lanza en masa:
 * el radar traduce lo que tienes delante y lo guarda para siempre, así que
 * el archivo se va llenando solo según lo usas. Aquí solo se ofrece adelantar
 * trabajo a quien quiera, y en tandas pequeñas.
 */
export default function Trabajos() {
  const [pend, setPend] = useState<Pendiente | null>(null);
  const [corriendo, setCorriendo] = useState(false);
  const [hechas, setHechas] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const parar = useRef(false);

  useEffect(() => {
    fetch("/api/lote")
      .then((r) => r.json())
      .then((d: Pendiente) => setPend(d))
      .catch(() => undefined);
  }, []);

  async function refrescar() {
    setPend((await (await fetch("/api/lote")).json()) as Pendiente);
  }

  async function buscarPlazos() {
    setCorriendo(true);
    setHechas(0);
    setError(null);
    parar.current = false;
    try {
      for (let i = 0; i < 40 && !parar.current; i++) {
        const r = await fetch("/api/lote", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tarea: "fechas", tanda: 6 }),
        });
        const d = (await r.json()) as { hechas: number; quedan: number; error?: string };
        if (!r.ok) {
          setError(d.error ?? "Ha fallado");
          break;
        }
        setHechas((n) => n + d.hechas);
        await refrescar();
        if (d.quedan <= 0) break;
      }
    } finally {
      setCorriendo(false);
      await refrescar();
    }
  }

  if (!pend?.configurada) return null;

  const guardadas = pend.traducidas;
  const porcentaje = pend.total > 0 ? Math.round((guardadas / pend.total) * 100) : 0;

  return (
    <div className="space-y-6">
      <div>
        <div className="rotulo mb-1.5">Lo que ya está guardado</div>
        <p className="text-[14px]">
          <span className="cifra">{guardadas.toLocaleString("es-ES")}</span> de{" "}
          <span className="cifra">{pend.total.toLocaleString("es-ES")}</span> convocatorias
          traducidas y guardadas en este ordenador.
        </p>
        <div className="mt-2 h-[3px] w-full overflow-hidden rounded bg-[var(--linea)]">
          <div
            className="h-full transition-[width] duration-700 ease-out"
            style={{ width: `${porcentaje}%`, background: "var(--bosque)" }}
          />
        </div>
        <p className="nota mt-2">
          Se traducen solas las que vas viendo en el radar, y no se vuelven a pedir nunca más.
          Cuanto más la uses, menos trabajo queda.
        </p>
      </div>

      <div className="dato">
        <div className="rotulo mb-1.5">Rescatar plazos de los PDF</div>
        <p className="nota mb-3">
          Hay <span className="cifra">{pend.sinFechas.toLocaleString("es-ES")}</span> convocatorias
          que no publican fechas en la BDNS aunque sí estén en sus bases. Esto sí conviene
          adelantarlo, porque el plazo es lo único que no se recupera.
        </p>
        {corriendo ? (
          <div className="flex flex-wrap items-center gap-3">
            <span className="flex items-center gap-2 text-[13px] text-[var(--niebla)]">
              <span className="pulso" /> {hechas} rescatados…
            </span>
            <button
              className="btn btn-linea"
              onClick={() => {
                parar.current = true;
              }}
            >
              Parar
            </button>
          </div>
        ) : pend.sinFechas === 0 ? (
          <p className="text-[13.5px]" style={{ color: "var(--bosque)" }}>
            No queda ninguno pendiente.
          </p>
        ) : (
          <button className="btn" onClick={() => void buscarPlazos()}>
            Buscar plazos
          </button>
        )}
      </div>

      {error && (
        <p className="nota" style={{ color: "var(--senal)" }}>
          {error}
        </p>
      )}
    </div>
  );
}
