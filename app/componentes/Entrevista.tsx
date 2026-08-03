"use client";

import { useCallback, useEffect, useState } from "react";
import type { MotivoUi, RequisitoUi } from "./tipos-ui";

interface RespuestaEncaje {
  fase: "entrevista" | "listo_para_dictamen" | "dictamen" | "sin_ia" | "sin_bases";
  pregunta?: RequisitoUi | null;
  progreso?: { respondidas: number; total: number };
  requisitos?: RequisitoUi[];
  dictamen?: "encaja" | "no_encaja" | "duda" | "pendiente";
  motivos?: MotivoUi[];
  aviso?: string;
  estructural?: { resultado: string; motivos: { regla: string; detalle: string }[] };
  error?: string;
}

const CARA: Record<string, string> = { encaja: "✅", no_encaja: "❌", duda: "🤔", pendiente: "⏳" };
const TITULO: Record<string, string> = {
  encaja: "ENCAJAS",
  no_encaja: "NO ENCAJAS",
  duda: "HAY DUDAS",
  pendiente: "SIN TERMINAR",
};

export default function Entrevista({ codigo }: { codigo: string }) {
  const [estado, setEstado] = useState<RespuestaEncaje | null>(null);
  const [cargando, setCargando] = useState(false);
  const [texto, setTexto] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [verRequisitos, setVerRequisitos] = useState(false);

  const llamar = useCallback(
    async (cuerpo: Record<string, string>) => {
      setCargando(true);
      setError(null);
      try {
        const r = await fetch(`/api/encaje/${codigo}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(cuerpo),
        });
        const d = (await r.json()) as RespuestaEncaje;
        if (!r.ok) setError(d.error ?? "Error inesperado");
        else setEstado(d);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setCargando(false);
        setTexto("");
      }
    },
    [codigo],
  );

  useEffect(() => {
    void llamar({ accion: "iniciar" });
  }, [llamar]);

  if (error) {
    return (
      <div className="aviso-legal p-3 text-[var(--rojo)]">
        {error.includes("SIN_CLAVE_GEMINI")
          ? "Falta la clave de Gemini: pégala en Ajustes (⚙︎ arriba a la derecha)."
          : error}
      </div>
    );
  }

  if (!estado) {
    return (
      <div className="flex items-center gap-3 p-2 text-[var(--tinta2)]">
        <div className="disco-radar girando" /> Analizando la convocatoria…
      </div>
    );
  }

  if (estado.fase === "sin_ia" || estado.fase === "sin_bases") {
    return (
      <div className="space-y-3">
        <EstructuralResumen estado={estado} />
        <div className="aviso-legal p-3">{estado.aviso}</div>
      </div>
    );
  }

  if (estado.fase === "dictamen" && estado.dictamen) {
    return (
      <div className="space-y-3">
        <div
          className={`rounded-xl border p-4 text-center ${
            estado.dictamen === "encaja"
              ? "border-[var(--lima)] bg-[rgba(184,255,41,0.06)]"
              : estado.dictamen === "no_encaja"
                ? "border-[var(--rojo)] bg-[rgba(255,77,94,0.06)]"
                : "border-[var(--ambar)] bg-[rgba(255,176,32,0.06)]"
          }`}
        >
          <div className="text-3xl">{CARA[estado.dictamen]}</div>
          <div className="mono mt-1 text-lg font-bold tracking-[0.15em]">
            {TITULO[estado.dictamen]}
          </div>
        </div>
        <ul className="space-y-2">
          {(estado.motivos ?? []).map((m, i) => (
            <li key={i} className="rounded-lg border border-[var(--borde)] p-3 text-[13px]">
              <div>{m.detalle}</div>
              {m.literal && (
                <div className="mt-1 border-l-2 border-[var(--borde)] pl-2 text-[12px] italic text-[var(--tinta2)]">
                  «{m.literal}»
                </div>
              )}
              <div className="mono mt-1 text-[10px] uppercase tracking-widest text-[var(--tinta2)]">
                {m.origen === "bases" ? "según las bases" : "según los datos BDNS"}
              </div>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  const p = estado.pregunta;
  return (
    <div className="space-y-3">
      <EstructuralResumen estado={estado} />

      {estado.progreso && estado.progreso.total > 0 && (
        <div>
          <div className="mono mb-1 text-[11px] text-[var(--tinta2)]">
            ENTREVISTA · {estado.progreso.respondidas}/{estado.progreso.total}
          </div>
          <div className="h-1.5 overflow-hidden rounded bg-[var(--panel2)]">
            <div
              className="h-full bg-[var(--cian)] transition-all"
              style={{
                width: `${(estado.progreso.respondidas / Math.max(1, estado.progreso.total)) * 100}%`,
              }}
            />
          </div>
        </div>
      )}

      {cargando && (
        <div className="flex items-center gap-3 p-2 text-[var(--tinta2)]">
          <div className="disco-radar girando" /> Pensando…
        </div>
      )}

      {!cargando && estado.fase === "entrevista" && p && (
        <div className="rounded-xl border border-[var(--borde)] p-4">
          <div className="text-[15px] font-semibold">{p.pregunta}</div>
          <div className="mt-2 border-l-2 border-[var(--borde)] pl-2 text-[12px] italic text-[var(--tinta2)]">
            «{p.literal}»
          </div>
          <div className="mt-3">
            {p.respuestas && p.respuestas.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {p.respuestas.map((r) => (
                  <button
                    key={r}
                    className="boton boton-cian"
                    onClick={() => void llamar({ accion: "responder", clave: p.clave!, valor: r })}
                  >
                    {r.toUpperCase()}
                  </button>
                ))}
              </div>
            ) : (
              <form
                className="flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (texto.trim())
                    void llamar({ accion: "responder", clave: p.clave!, valor: texto.trim() });
                }}
              >
                <input
                  autoFocus
                  className="control flex-1"
                  placeholder="Tu respuesta…"
                  value={texto}
                  onChange={(e) => setTexto(e.target.value)}
                />
                <button className="boton boton-cian" type="submit">
                  →
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {!cargando && estado.fase === "listo_para_dictamen" && (
        <button className="boton boton-lima w-full" onClick={() => void llamar({ accion: "dictaminar" })}>
          ⚖️ DICTAMINAR CON TODO LO RESPONDIDO
        </button>
      )}

      {(estado.requisitos?.length ?? 0) > 0 && (
        <div>
          <button
            className="mono text-[11px] tracking-widest text-[var(--tinta2)] underline underline-offset-4"
            onClick={() => setVerRequisitos(!verRequisitos)}
          >
            {verRequisitos ? "OCULTAR" : "VER"} LOS {estado.requisitos!.length} REQUISITOS DE LAS BASES
          </button>
          {verRequisitos && (
            <ul className="mt-2 space-y-1 text-[12px] text-[var(--tinta2)]">
              {estado.requisitos!.map((r) => (
                <li key={r.id} className="rounded border border-[var(--borde)] p-2">
                  <span className="chip mr-2">{r.tipo.toUpperCase()}</span>
                  {r.literal}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function EstructuralResumen({ estado }: { estado: RespuestaEncaje }) {
  const e = estado.estructural;
  if (!e) return null;
  return (
    <div className="rounded-lg border border-[var(--borde)] p-3 text-[12px]">
      <span className="mono mr-2 tracking-widest text-[var(--tinta2)]">FILTRO BDNS:</span>
      {e.resultado === "pasa" ? (
        <span className="text-[var(--lima)]">pasa (beneficiario, territorio y plazo cuadran)</span>
      ) : (
        <span className="text-[var(--ambar)]">
          {e.motivos.map((m) => m.detalle).join(" · ")}
        </span>
      )}
    </div>
  );
}
