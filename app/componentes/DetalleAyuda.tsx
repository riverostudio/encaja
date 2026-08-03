"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Entrevista from "./Entrevista";
import { colorPlazo, euros, fraseP1azo, nivelBonito, type ConvUi } from "./tipos-ui";

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
    fetch(`/api/convocatorias/${codigo}`)
      .then((r) => r.json())
      .then(setD);
  }, [codigo]);

  useEffect(() => {
    const alPulsar = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCerrar();
    };
    window.addEventListener("keydown", alPulsar);
    return () => window.removeEventListener("keydown", alPulsar);
  }, [onCerrar]);

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
      <aside className="cajon">
        <div className="sticky top-0 flex items-center justify-between border-b border-[var(--linea)] bg-[var(--lienzo)] px-8 py-4">
          <span className="rotulo cifra">BDNS {codigo}</span>
          <button
            className="text-[18px] leading-none text-[var(--niebla)] transition-colors hover:text-[var(--tinta)]"
            onClick={onCerrar}
          >
            ✕
          </button>
        </div>

        {!d ? (
          <div className="flex items-center gap-2 px-8 py-10 text-[13px] text-[var(--niebla)]">
            <span className="pulso" /> Cargando la ficha oficial…
          </div>
        ) : d.error ? (
          <p className="px-8 py-10 text-[13px] text-[var(--senal)]">{d.error}</p>
        ) : (
          <div className="px-8 pb-16 pt-8">
            <p
              className="display text-[15px] italic"
              style={{ color: colorPlazo(d.conv.plazo) }}
            >
              {fraseP1azo(d.conv.plazo)}
            </p>

            <h2 className="display mt-2 text-[22px] leading-[1.3]">{d.conv.titulo}</h2>

            <p className="mt-3 text-[13px] text-[var(--grafito)]">
              {d.conv.nivel3 ?? d.conv.nivel2}
              <span className="text-[var(--niebla)]"> · {nivelBonito(d.conv.nivel1)}</span>
            </p>

            <div className="mt-8">
              {(d.conv.fechaInicioSol || d.conv.fechaFinSol) && (
                <Dato etiqueta="Plazo de solicitud">
                  <span className="cifra">
                    {d.conv.fechaInicioSol ?? "?"} — {d.conv.fechaFinSol ?? "?"}
                  </span>
                </Dato>
              )}
              {euros(d.conv.presupuesto) && (
                <Dato etiqueta="Presupuesto">
                  <span className="display cifra text-[22px]">{euros(d.conv.presupuesto)}</span>
                </Dato>
              )}
              {d.conv.finalidad && <Dato etiqueta="Finalidad">{d.conv.finalidad}</Dato>}
              {d.conv.beneficiarios.length > 0 && (
                <Dato etiqueta="Quién puede pedirla">
                  {d.conv.beneficiarios.join(" · ").toLowerCase()}
                </Dato>
              )}
              {d.conv.instrumentos.length > 0 && (
                <Dato etiqueta="Tipo de ayuda">
                  {d.conv.instrumentos.join(" · ").toLowerCase()}
                </Dato>
              )}
              {d.conv.fondos.length > 0 && (
                <Dato etiqueta="Fondos">{d.conv.fondos.join(" · ")}</Dato>
              )}
              <Dato etiqueta="Fuentes oficiales">
                <span className="flex flex-wrap gap-x-5 gap-y-1">
                  <a className="enlace" href={d.urlFicha} target="_blank" rel="noreferrer">
                    Ficha BDNS
                  </a>
                  {d.conv.urlBases && (
                    <a className="enlace" href={d.conv.urlBases} target="_blank" rel="noreferrer">
                      Bases reguladoras
                    </a>
                  )}
                  {d.conv.sede && (
                    <a className="enlace" href={d.conv.sede} target="_blank" rel="noreferrer">
                      Sede electrónica
                    </a>
                  )}
                </span>
              </Dato>
            </div>

            <div className="mt-8 flex flex-wrap gap-3">
              {!entrevistando && (
                <button className="btn" onClick={() => setEntrevistando(true)}>
                  ¿Encajo en esta ayuda?
                </button>
              )}
              <button
                className="btn btn-linea"
                onClick={() => void alExpediente()}
                disabled={creandoExp}
              >
                {d.expediente ? "Ver expediente" : creandoExp ? "Creando…" : "Abrir expediente"}
              </button>
            </div>

            {entrevistando && (
              <div className="filete mt-10 pt-8">
                <Entrevista codigo={codigo} />
              </div>
            )}
          </div>
        )}
      </aside>
    </>
  );
}

function Dato({ etiqueta, children }: { etiqueta: string; children: React.ReactNode }) {
  return (
    <div className="dato">
      <div className="rotulo mb-1.5">{etiqueta}</div>
      <div className="text-[14px] leading-relaxed">{children}</div>
    </div>
  );
}
