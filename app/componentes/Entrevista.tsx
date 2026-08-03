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

const VEREDICTO: Record<string, { texto: string; color: string }> = {
  encaja: { texto: "Encajas", color: "var(--bosque)" },
  no_encaja: { texto: "No encajas", color: "var(--senal)" },
  duda: { texto: "Con dudas", color: "var(--ocre)" },
  pendiente: { texto: "Sin terminar", color: "var(--grafito)" },
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
    fetch(`/api/encaje/${codigo}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accion: "iniciar" }),
    })
      .then(async (r) => {
        const d = (await r.json()) as RespuestaEncaje;
        if (!r.ok) setError(d.error ?? "Error inesperado");
        else setEstado(d);
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, [codigo]);

  if (error) {
    return (
      <p className="text-[13px] text-[var(--senal)]">
        {error.includes("SIN_CLAVE_GEMINI")
          ? "Falta la clave de Gemini: pégala en Ajustes, arriba a la derecha."
          : error}
      </p>
    );
  }

  if (!estado) {
    return (
      <p className="flex items-center gap-2 text-[13px] text-[var(--niebla)]">
        <span className="pulso" /> Analizando la convocatoria…
      </p>
    );
  }

  if (estado.fase === "sin_ia" || estado.fase === "sin_bases") {
    return (
      <div>
        <Estructural estado={estado} />
        <p className="nota mt-4">{estado.aviso}</p>
      </div>
    );
  }

  if (estado.fase === "dictamen" && estado.dictamen) {
    const v = VEREDICTO[estado.dictamen];
    return (
      <div>
        <p className="rotulo">Dictamen</p>
        <p className="display mt-1 text-[30px] leading-none" style={{ color: v.color }}>
          {v.texto}
        </p>
        <div className="mt-6">
          {(estado.motivos ?? []).map((m, i) => (
            <div key={i} className="dato">
              <p className="text-[14px] leading-relaxed">{m.detalle}</p>
              {m.literal && (
                <p className="display mt-2 border-l-2 border-[var(--linea-fuerte)] pl-3 text-[13.5px] italic leading-relaxed text-[var(--grafito)]">
                  {m.literal}
                </p>
              )}
              <p className="rotulo mt-2">
                {m.origen === "bases" ? "según las bases" : "según los datos oficiales"}
              </p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const p = estado.pregunta;
  return (
    <div>
      <Estructural estado={estado} />

      {estado.progreso && estado.progreso.total > 0 && (
        <p className="rotulo mt-5">
          Pregunta {Math.min(estado.progreso.respondidas + 1, estado.progreso.total)} de{" "}
          {estado.progreso.total}
        </p>
      )}

      {cargando && (
        <p className="mt-4 flex items-center gap-2 text-[13px] text-[var(--niebla)]">
          <span className="pulso" /> Pensando…
        </p>
      )}

      {!cargando && estado.fase === "entrevista" && p && (
        <div className="mt-3">
          <p className="display text-[20px] leading-snug">{p.pregunta}</p>
          <p className="display mt-3 border-l-2 border-[var(--linea-fuerte)] pl-3 text-[13px] italic leading-relaxed text-[var(--grafito)]">
            {p.literal}
          </p>
          <div className="mt-5">
            {p.respuestas && p.respuestas.length > 0 ? (
              <div className="flex flex-wrap gap-3">
                {p.respuestas.map((r) => (
                  <button
                    key={r}
                    className="btn btn-linea"
                    onClick={() => void llamar({ accion: "responder", clave: p.clave!, valor: r })}
                  >
                    {r}
                  </button>
                ))}
              </div>
            ) : (
              <form
                className="flex items-end gap-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (texto.trim())
                    void llamar({ accion: "responder", clave: p.clave!, valor: texto.trim() });
                }}
              >
                <input
                  autoFocus
                  className="campo flex-1"
                  placeholder="Tu respuesta…"
                  value={texto}
                  onChange={(e) => setTexto(e.target.value)}
                />
                <button className="btn" type="submit">
                  Seguir
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {!cargando && estado.fase === "listo_para_dictamen" && (
        <button className="btn mt-4" onClick={() => void llamar({ accion: "dictaminar" })}>
          Dictaminar
        </button>
      )}

      {(estado.requisitos?.length ?? 0) > 0 && (
        <div className="mt-8">
          <button className="btn-texto" onClick={() => setVerRequisitos(!verRequisitos)}>
            {verRequisitos ? "Ocultar" : "Ver"} los {estado.requisitos!.length} requisitos de las
            bases
          </button>
          {verRequisitos && (
            <div className="mt-3">
              {estado.requisitos!.map((r) => (
                <div key={r.id} className="dato">
                  <p className="rotulo mb-1">{r.tipo}</p>
                  <p className="display text-[13.5px] italic leading-relaxed text-[var(--grafito)]">
                    {r.literal}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Estructural({ estado }: { estado: RespuestaEncaje }) {
  const e = estado.estructural;
  if (!e) return null;
  return (
    <p className="text-[13px] text-[var(--grafito)]">
      <span className="rotulo">Filtro oficial · </span>
      {e.resultado === "pasa" ? (
        <span style={{ color: "var(--bosque)" }}>
          beneficiario, territorio y plazo cuadran contigo
        </span>
      ) : (
        <span style={{ color: "var(--ocre)" }}>{e.motivos.map((m) => m.detalle).join(" · ")}</span>
      )}
    </p>
  );
}
