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

const VEREDICTO: Record<string, { titulo: string; pie: string; color: string; icono: string }> = {
  encaja: {
    titulo: "Sí, encajas",
    pie: "Cumples lo que piden las bases. Puedes preparar el expediente.",
    color: "var(--bosque)",
    icono: "✓",
  },
  no_encaja: {
    titulo: "No encajas",
    pie: "Hay un requisito que no cumples. Te lo señalo abajo con el texto de las bases.",
    color: "var(--senal)",
    icono: "✕",
  },
  duda: {
    titulo: "Depende",
    pie: "Falta algún dato para decidirlo. Mira abajo qué habría que confirmar y con quién.",
    color: "var(--ocre)",
    icono: "?",
  },
  pendiente: {
    titulo: "Sin terminar",
    pie: "Quedan preguntas por responder.",
    color: "var(--grafito)",
    icono: "·",
  },
};

/**
 * Cuestionario a pantalla completa: una pregunta cada vez, con el texto
 * literal de las bases debajo para que se vea de dónde sale. Termina en
 * un veredicto grande y razonado.
 */
export default function Cuestionario({
  codigo,
  titulo,
  onCerrar,
  onVeredicto,
}: {
  codigo: string;
  titulo: string;
  onCerrar: () => void;
  onVeredicto?: (v: string) => void;
}) {
  const [estado, setEstado] = useState<RespuestaEncaje | null>(null);
  const [cargando, setCargando] = useState(false);
  const [texto, setTexto] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [paso, setPaso] = useState(0); // fuerza la animación en cada pregunta

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
        else {
          setEstado(d);
          setPaso((p) => p + 1);
          if (d.fase === "dictamen" && d.dictamen) onVeredicto?.(d.dictamen);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setCargando(false);
        setTexto("");
      }
    },
    [codigo, onVeredicto],
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
        else {
          setEstado(d);
          if (d.fase === "dictamen" && d.dictamen) onVeredicto?.(d.dictamen);
        }
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, [codigo, onVeredicto]);

  useEffect(() => {
    const alPulsar = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCerrar();
    };
    window.addEventListener("keydown", alPulsar);
    return () => window.removeEventListener("keydown", alPulsar);
  }, [onCerrar]);

  const progreso = estado?.progreso;
  const porcentaje =
    progreso && progreso.total > 0
      ? Math.round((progreso.respondidas / progreso.total) * 100)
      : estado?.fase === "dictamen"
        ? 100
        : 0;

  return (
    <div className="escenario">
      {/* ——— barra superior ——— */}
      <div className="escenario-barra">
        <div className="mx-auto flex max-w-2xl items-center gap-4 px-6 py-4">
          <span className="rotulo truncate">¿Encajo? · {titulo.slice(0, 60)}…</span>
          <button
            className="ml-auto text-[18px] leading-none text-[var(--niebla)] transition-colors hover:text-[var(--tinta)]"
            onClick={onCerrar}
            aria-label="Cerrar el cuestionario"
          >
            ✕
          </button>
        </div>
        <div className="h-[2px] w-full bg-[var(--linea)]">
          <div
            className="h-full transition-[width] duration-700 ease-out"
            style={{ width: `${porcentaje}%`, background: "var(--tinta)" }}
          />
        </div>
      </div>

      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center px-6 py-14">
        {error ? (
          <p className="text-[15px]" style={{ color: "var(--senal)" }}>
            {error.includes("SIN_CLAVE_GEMINI")
              ? "Falta la clave de Gemini: pégala en Ajustes y vuelve a intentarlo."
              : error}
          </p>
        ) : !estado ? (
          <p className="flex items-center gap-2 text-[15px] text-[var(--niebla)]">
            <span className="pulso" /> Leyendo la convocatoria…
          </p>
        ) : estado.fase === "sin_ia" || estado.fase === "sin_bases" ? (
          <div className="sube">
            <Estructural estado={estado} />
            <p className="mt-6 text-[15px] leading-relaxed text-[var(--grafito)]">{estado.aviso}</p>
            <button className="btn mt-8" onClick={onCerrar}>
              Entendido
            </button>
          </div>
        ) : estado.fase === "dictamen" && estado.dictamen ? (
          <Dictamen estado={estado} onCerrar={onCerrar} />
        ) : (
          <div key={paso} className="sube">
            {progreso && progreso.total > 0 && (
              <p className="rotulo">
                Pregunta {Math.min(progreso.respondidas + 1, progreso.total)} de {progreso.total}
              </p>
            )}

            {cargando ? (
              <p className="mt-6 flex items-center gap-2 text-[15px] text-[var(--niebla)]">
                <span className="pulso" /> Un momento…
              </p>
            ) : estado.fase === "entrevista" && estado.pregunta ? (
              <Pregunta
                pregunta={estado.pregunta}
                texto={texto}
                setTexto={setTexto}
                onResponder={(clave, valor) => void llamar({ accion: "responder", clave, valor })}
              />
            ) : (
              <div className="mt-6">
                <p className="display text-[30px] leading-tight">
                  Ya está: no queda nada por preguntar.
                </p>
                <p className="mt-3 text-[15px] text-[var(--grafito)]">
                  Contrasto tus respuestas contra las bases y te digo si encajas.
                </p>
                <button
                  className="btn mt-8"
                  onClick={() => void llamar({ accion: "dictaminar" })}
                >
                  Ver el veredicto
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Pregunta({
  pregunta,
  texto,
  setTexto,
  onResponder,
}: {
  pregunta: RequisitoUi;
  texto: string;
  setTexto: (t: string) => void;
  onResponder: (clave: string, valor: string) => void;
}) {
  return (
    <div className="mt-5">
      <p className="display text-[30px] leading-tight">{pregunta.pregunta}</p>

      <p className="display mt-6 border-l-2 border-[var(--linea-fuerte)] pl-4 text-[14px] italic leading-relaxed text-[var(--grafito)]">
        {pregunta.literal}
      </p>
      <p className="rotulo mt-2">texto literal de las bases</p>

      <div className="mt-9">
        {pregunta.respuestas && pregunta.respuestas.length > 0 ? (
          <div className="flex flex-wrap gap-3">
            {pregunta.respuestas.map((r, i) => (
              <button
                key={r}
                className="opcion sube"
                style={{ "--i": i } as React.CSSProperties}
                onClick={() => onResponder(pregunta.clave!, r)}
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
              if (texto.trim()) onResponder(pregunta.clave!, texto.trim());
            }}
          >
            <input
              autoFocus
              className="campo flex-1 !text-[19px]"
              placeholder="Escribe tu respuesta…"
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
            />
            <button className="btn" type="submit">
              Siguiente
            </button>
          </form>
        )}
      </div>

      <p className="nota mt-8">
        Lo que respondas se guarda en tu ficha: la próxima ayuda ya no te lo preguntará.
      </p>
    </div>
  );
}

function Dictamen({ estado, onCerrar }: { estado: RespuestaEncaje; onCerrar: () => void }) {
  const v = VEREDICTO[estado.dictamen!];
  return (
    <div>
      <div className="sube flex items-center gap-5">
        <span
          className="sello-veredicto"
          style={{ color: v.color, borderColor: v.color }}
          aria-hidden
        >
          {v.icono}
        </span>
        <div>
          <p className="display text-[38px] leading-none" style={{ color: v.color }}>
            {v.titulo}
          </p>
          <p className="mt-2 max-w-md text-[14px] leading-relaxed text-[var(--grafito)]">{v.pie}</p>
        </div>
      </div>

      <div className="mt-10">
        {(estado.motivos ?? []).map((m, i) => (
          <div
            key={i}
            className="dato sube"
            style={{ "--i": i + 2 } as React.CSSProperties}
          >
            <p className="text-[14.5px] leading-relaxed">{m.detalle}</p>
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

      <button className="btn mt-10" onClick={onCerrar}>
        {estado.dictamen === "encaja" ? "Preparar el expediente" : "Volver al radar"}
      </button>
    </div>
  );
}

function Estructural({ estado }: { estado: RespuestaEncaje }) {
  const e = estado.estructural;
  if (!e) return null;
  return (
    <p className="text-[15px] leading-relaxed">
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
