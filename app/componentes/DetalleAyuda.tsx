"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Entrevista from "./Entrevista";
import { clasePlazo, euros, textoPlazo, type ConvUi } from "./tipos-ui";

interface Detalle {
  conv: ConvUi;
  urlFicha: string;
  evaluacion: { dictamen: string } | null;
  expediente: { codigoBdns: string } | null;
  error?: string;
}

export default function DetalleAyuda({
  codigo,
  onCerrar,
}: {
  codigo: string;
  onCerrar: () => void;
}) {
  const router = useRouter();
  const [d, setD] = useState<Detalle | null>(null);
  const [entrevistando, setEntrevistando] = useState(false);
  const [creandoExp, setCreandoExp] = useState(false);

  useEffect(() => {
    setD(null);
    setEntrevistando(false);
    fetch(`/api/convocatorias/${codigo}`)
      .then((r) => r.json())
      .then(setD);
  }, [codigo]);

  async function alExpediente() {
    setCreandoExp(true);
    const r = await fetch("/api/expedientes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ codigo }),
    });
    if (r.ok) router.push(`/expedientes/${codigo}`);
    setCreandoExp(false);
  }

  return (
    <>
      <div className="telon" onClick={onCerrar} />
      <aside className="cajon p-6">
        <div className="flex items-start justify-between gap-3">
          <span className="chip">{codigo}</span>
          <button className="boton boton-fantasma" onClick={onCerrar}>
            ✕
          </button>
        </div>

        {!d ? (
          <div className="mt-8 flex items-center gap-3 text-[var(--tinta2)]">
            <div className="disco-radar girando" /> Cargando la ficha oficial…
          </div>
        ) : d.error ? (
          <div className="aviso-legal mt-6 p-3 text-[var(--rojo)]">{d.error}</div>
        ) : (
          <>
            <div className={`${clasePlazo(d.conv.plazo)} mt-4 text-2xl`}>
              {textoPlazo(d.conv.plazo)}
            </div>
            {(d.conv.fechaInicioSol || d.conv.fechaFinSol) && (
              <div className="mono mt-1 text-[12px] text-[var(--tinta2)]">
                Solicitudes: {d.conv.fechaInicioSol ?? "?"} → {d.conv.fechaFinSol ?? "?"}
              </div>
            )}

            <h2 className="mt-3 text-lg font-bold leading-snug">{d.conv.titulo}</h2>
            <div className="mt-1 text-[13px] text-[var(--tinta2)]">
              {d.conv.nivel3 ?? d.conv.nivel2} · {d.conv.nivel2}
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2 text-[13px]">
              {euros(d.conv.presupuesto) && (
                <Dato k="PRESUPUESTO" v={euros(d.conv.presupuesto)!} destacado />
              )}
              {d.conv.finalidad && <Dato k="FINALIDAD" v={d.conv.finalidad} />}
              {d.conv.beneficiarios.length > 0 && (
                <Dato k="BENEFICIARIOS" v={d.conv.beneficiarios.join(" · ")} ancho />
              )}
              {d.conv.instrumentos.length > 0 && (
                <Dato k="TIPO DE AYUDA" v={d.conv.instrumentos.join(" · ")} ancho />
              )}
              {d.conv.fondos.length > 0 && <Dato k="FONDOS" v={d.conv.fondos.join(" · ")} ancho />}
            </div>

            <div className="mt-4 flex flex-wrap gap-3 text-[13px]">
              <a className="enlace" href={d.urlFicha} target="_blank" rel="noreferrer">
                Ficha oficial BDNS ↗
              </a>
              {d.conv.urlBases && (
                <a className="enlace" href={d.conv.urlBases} target="_blank" rel="noreferrer">
                  Bases reguladoras ↗
                </a>
              )}
              {d.conv.sede && (
                <a className="enlace" href={d.conv.sede} target="_blank" rel="noreferrer">
                  Sede electrónica ↗
                </a>
              )}
            </div>

            <div className="mt-6 flex gap-2">
              {!entrevistando && (
                <button className="boton boton-lima flex-1" onClick={() => setEntrevistando(true)}>
                  🎯 ¿ENCAJO?
                </button>
              )}
              <button
                className="boton boton-cian flex-1"
                onClick={() => void alExpediente()}
                disabled={creandoExp}
              >
                {d.expediente ? "📁 VER EXPEDIENTE" : creandoExp ? "…" : "📁 AL EXPEDIENTE"}
              </button>
            </div>

            {entrevistando && (
              <div className="mt-5 border-t border-[var(--borde)] pt-5">
                <div className="titulo-seccion mb-3">¿ENCAJO EN ESTA AYUDA?</div>
                <Entrevista codigo={codigo} />
              </div>
            )}
          </>
        )}
      </aside>
    </>
  );
}

function Dato({
  k,
  v,
  ancho,
  destacado,
}: {
  k: string;
  v: string;
  ancho?: boolean;
  destacado?: boolean;
}) {
  return (
    <div
      className={`rounded-lg border border-[var(--borde)] p-2 ${ancho ? "col-span-2" : ""}`}
    >
      <div className="titulo-seccion text-[9px]">{k}</div>
      <div className={destacado ? "mono mt-1 text-lg font-bold text-[var(--lima)]" : "mt-1"}>
        {v}
      </div>
    </div>
  );
}
