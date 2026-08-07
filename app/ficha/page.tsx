"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { registrarPerfil } from "../lib/metricas-cliente";

interface OpcionUi {
  valor: string;
  texto: string;
  ayuda?: string;
}

interface PreguntaUi {
  clave: string;
  pregunta: string;
  ayuda?: string;
  tipo: "opcion" | "varias" | "cp" | "numero";
  opciones: OpcionUi[] | null;
}

interface EstadoPerfil {
  respuestas: Record<string, string>;
  siguiente: PreguntaUi | null;
  progreso: { respondidas: number; total: number; completo: boolean };
  resumen: string;
  zona: { municipio: string; provincia: string } | null;
  preguntas: PreguntaUi[];
}

export default function PaginaPerfil() {
  const [e, setE] = useState<EstadoPerfil | null>(null);
  const [texto, setTexto] = useState("");
  const [marcadas, setMarcadas] = useState<string[]>([]);
  const [repasando, setRepasando] = useState(false);
  const [paso, setPaso] = useState(0);

  useEffect(() => {
    fetch("/api/perfil")
      .then((r) => r.json())
      .then((d: EstadoPerfil) => setE(d));
  }, []);

  const responder = useCallback(async (clave: string, valor: string) => {
    const r = await fetch("/api/perfil", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clave, valor }),
    });
    const d = (await r.json()) as EstadoPerfil;
    if (clave === "perfil" && ["particular", "autonomo", "empresa"].includes(valor)) {
      registrarPerfil(valor as "particular" | "autonomo" | "empresa");
    }
    setE(d);
    setTexto("");
    setMarcadas([]);
    setPaso((p) => p + 1);
  }, []);

  const borrar = useCallback(async (clave: string) => {
    const r = await fetch(`/api/perfil?clave=${encodeURIComponent(clave)}`, { method: "DELETE" });
    setE((await r.json()) as EstadoPerfil);
    setRepasando(false);
    setPaso((p) => p + 1);
  }, []);

  if (!e) {
    return (
      <p className="flex items-center gap-2 py-16 text-[14px] text-[var(--niebla)]">
        <span className="pulso" /> Cargando tu perfil…
      </p>
    );
  }

  const p = e.siguiente;
  const porcentaje = Math.round((e.progreso.respondidas / Math.max(1, e.progreso.total)) * 100);

  // ——— perfil terminado: resumen y repaso ———
  if (!p || repasando) {
    return (
      <div className="max-w-2xl">
        <p className="rotulo">Tu perfil</p>
        <h1 className="display mt-1 text-[32px] leading-tight">{e.resumen}</h1>
        <p className="nota mt-3 max-w-lg">
          Con esto el radar prioriza y descarta lo que los datos oficiales permiten comprobar, y
          los cuestionarios no te vuelven a preguntar lo que ya saben. Toca una respuesta para cambiarla.
        </p>

        <div className="mt-9">
          {e.preguntas.map((pregunta, i) => {
            const valor = e.respuestas[pregunta.clave];
            return (
              <div
                key={pregunta.clave}
                className="dato sube flex items-baseline gap-6"
                style={{ "--i": Math.min(i, 8) } as React.CSSProperties}
              >
                <span className="w-[220px] shrink-0 text-[13px] text-[var(--grafito)]">
                  {pregunta.pregunta}
                </span>
                <span className="display flex-1 text-[17px]">
                  {valor === undefined || valor === "" ? (
                    <span className="text-[var(--niebla)]">sin responder</span>
                  ) : (
                    textoDe(pregunta, valor)
                  )}
                </span>
                <button
                  className="text-[12px] text-[var(--niebla)] transition-colors hover:text-[var(--tinta)]"
                  onClick={() => void borrar(pregunta.clave)}
                >
                  cambiar
                </button>
              </div>
            );
          })}
        </div>

        {e.zona && (
          <p className="nota mt-6">
            Tu zona: <strong>{e.zona.municipio}</strong>, {e.zona.provincia}. El radar tendrá en
            cuenta las convocatorias locales que consten en la fuente oficial.
          </p>
        )}

        <Link href="/" className="btn mt-9 inline-block">
          Ver mis ayudas
        </Link>
      </div>
    );
  }

  // ——— asistente, una pregunta cada vez ———
  return (
    <div className="mx-auto max-w-2xl">
      <div className="flex items-baseline justify-between gap-4">
        <p className="rotulo">
          Tu perfil · {e.progreso.respondidas + 1} de {e.progreso.total}
        </p>
        {e.progreso.respondidas > 0 && (
          <button className="btn-texto" onClick={() => setRepasando(true)}>
            Ver lo respondido
          </button>
        )}
      </div>
      <div className="mt-2 h-[2px] w-full bg-[var(--linea)]">
        <div
          className="h-full transition-[width] duration-700 ease-out"
          style={{ width: `${porcentaje}%`, background: "var(--tinta)" }}
        />
      </div>

      <div key={paso} className="sube mt-12">
        <h1 className="display text-[32px] leading-tight">{p.pregunta}</h1>
        {p.ayuda && <p className="mt-3 text-[14px] leading-relaxed text-[var(--grafito)]">{p.ayuda}</p>}

        <div className="mt-9">
          {p.tipo === "opcion" && p.opciones && (
            <div className="flex flex-col gap-2.5">
              {p.opciones.map((o, i) => (
                <button
                  key={o.valor}
                  className="opcion sube !w-full !text-left"
                  style={{ "--i": i } as React.CSSProperties}
                  onClick={() => void responder(p.clave, o.valor)}
                >
                  {o.texto}
                  {o.ayuda && (
                    <span className="mt-0.5 block font-sans text-[12.5px] text-[var(--niebla)]">
                      {o.ayuda}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}

          {p.tipo === "varias" && p.opciones && (
            <>
              <div className="flex flex-wrap gap-2.5">
                {p.opciones.map((o, i) => {
                  const activa = marcadas.includes(o.valor);
                  return (
                    <button
                      key={o.valor}
                      className="opcion sube !py-3 !text-[16px]"
                      style={
                        {
                          "--i": i,
                          borderColor: activa ? "var(--tinta)" : undefined,
                          background: activa ? "var(--tinta)" : undefined,
                          color: activa ? "var(--fondo)" : undefined,
                        } as React.CSSProperties
                      }
                      onClick={() =>
                        setMarcadas((m) =>
                          m.includes(o.valor) ? m.filter((x) => x !== o.valor) : [...m, o.valor],
                        )
                      }
                    >
                      {o.texto}
                    </button>
                  );
                })}
              </div>
              <button className="btn mt-7" onClick={() => void responder(p.clave, marcadas.join(","))}>
                {marcadas.length === 0 ? "Ninguna me aplica" : `Seguir con ${marcadas.length}`}
              </button>
            </>
          )}

          {(p.tipo === "cp" || p.tipo === "numero") && (
            <form
              className="flex items-end gap-3"
              onSubmit={(ev) => {
                ev.preventDefault();
                if (texto.trim()) void responder(p.clave, texto.trim());
              }}
            >
              <input
                autoFocus
                inputMode="numeric"
                maxLength={p.tipo === "cp" ? 5 : undefined}
                className="campo cifra w-[160px] !text-[26px]"
                placeholder={p.tipo === "cp" ? "46183" : "0"}
                value={texto}
                onChange={(ev) => setTexto(ev.target.value.replace(/\D/g, ""))}
              />
              <button className="btn" type="submit" disabled={!texto.trim()}>
                Seguir
              </button>
            </form>
          )}
        </div>

        <p className="nota mt-10">
          Se guarda en este navegador. Encaja lo procesa temporalmente para filtrar el radar y no
          lo conserva en una base de usuarios. Puedes cambiarlo cuando quieras.
        </p>
      </div>
    </div>
  );
}

function textoDe(pregunta: PreguntaUi, valor: string): string {
  if (pregunta.tipo === "varias") {
    const marcadas = valor.split(",").filter(Boolean);
    if (marcadas.length === 0) return "Ninguna";
    return marcadas
      .map((v) => pregunta.opciones?.find((o) => o.valor === v)?.texto ?? v)
      .join(", ");
  }
  return pregunta.opciones?.find((o) => o.valor === valor)?.texto ?? valor;
}
