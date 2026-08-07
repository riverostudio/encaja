"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { MensajeAsistente, RecursoAsistente } from "@/lib/asistente";

interface MensajeUi extends MensajeAsistente {
  id: string;
  recursos?: RecursoAsistente[];
  consulta?: string;
  modo?: "ia" | "guiado";
}

const INICIALES = [
  "Tengo pocos recursos",
  "Soy estudiante",
  "Soy autónomo",
  "Soy profesional",
  "Soy trabajador",
];

const BIENVENIDA: MensajeUi = {
  id: "bienvenida",
  rol: "asistente",
  texto:
    "Hola. Cuéntame qué te preocupa o cuál es tu situación. Buscaré solo en el catálogo real de Encaja y te enseñaré requisitos, plazo y acceso oficial.",
};

export default function AsistenteAyudas() {
  const router = useRouter();
  const ruta = usePathname();
  const [abierto, setAbierto] = useState(false);
  const [texto, setTexto] = useState("");
  const [pensando, setPensando] = useState(false);
  const [mensajes, setMensajes] = useState<MensajeUi[]>([BIENVENIDA]);
  const final = useRef<HTMLDivElement | null>(null);
  const campo = useRef<HTMLInputElement | null>(null);
  const secuencia = useRef(0);

  useEffect(() => {
    if (!abierto) return;
    final.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    if (mensajes.length === 1) campo.current?.focus();
  }, [abierto, mensajes, pensando]);

  useEffect(() => {
    const abrir = () => setAbierto(true);
    window.addEventListener("encaja:abrirChat", abrir);
    return () => window.removeEventListener("encaja:abrirChat", abrir);
  }, []);

  async function enviar(forzado?: string) {
    const contenido = (forzado ?? texto).trim();
    if (contenido.length < 2 || pensando) return;
    secuencia.current += 1;
    const usuario: MensajeUi = {
      id: `u-${secuencia.current}`,
      rol: "usuario",
      texto: contenido,
    };
    const siguientes = [...mensajes, usuario];
    setMensajes(siguientes);
    setTexto("");
    setPensando(true);
    try {
      const respuesta = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mensajes: siguientes.map(({ rol, texto: cuerpo }) => ({ rol, texto: cuerpo })),
        }),
      });
      const datos = (await respuesta.json()) as {
        error?: string;
        respuesta?: string;
        recursos?: RecursoAsistente[];
        consulta?: string;
        modo?: "ia" | "guiado";
      };
      setMensajes((antes) => [
        ...antes,
        {
          id: `a-${secuencia.current}`,
          rol: "asistente",
          texto: respuesta.ok
            ? datos.respuesta ?? "He terminado la búsqueda."
            : datos.error ?? "No he podido buscar ahora mismo. Prueba de nuevo.",
          recursos: datos.recursos,
          consulta: datos.consulta,
          modo: datos.modo,
        },
      ]);
    } catch {
      setMensajes((antes) => [
        ...antes,
        {
          id: `a-${secuencia.current}`,
          rol: "asistente",
          texto: "No he podido conectar con el buscador. Tu perfil y tu clave no se han perdido; inténtalo otra vez.",
        },
      ]);
    } finally {
      setPensando(false);
    }
  }

  function llevarAlRadar(consulta: string) {
    setAbierto(false);
    if (ruta === "/") {
      window.dispatchEvent(new CustomEvent("encaja:buscar", { detail: { consulta } }));
    } else {
      router.push(`/?buscar=${encodeURIComponent(consulta)}`);
    }
  }

  return (
    <>
      {abierto && (
        <section
          className="chat-panel"
          role="dialog"
          aria-modal="false"
          aria-label="Asistente para buscar ayudas"
        >
          <header className="chat-cabecera">
            <div>
              <p className="rotulo">Orientador de Encaja</p>
              <p className="display mt-0.5 text-[18px]">¿Qué ayuda necesitas?</p>
            </div>
            <button className="chat-cerrar" onClick={() => setAbierto(false)} aria-label="Cerrar asistente">
              ✕
            </button>
          </header>

          <div className="chat-mensajes" aria-live="polite">
            {mensajes.map((mensaje) => (
              <article key={mensaje.id} className={`chat-mensaje chat-${mensaje.rol}`}>
                <p className="whitespace-pre-line">{mensaje.texto}</p>
                {mensaje.recursos && mensaje.recursos.length > 0 && (
                  <div className="mt-3 grid gap-3">
                    {mensaje.recursos.map((recurso) => (
                      <div className="chat-recurso" key={recurso.id}>
                        <p className="rotulo">{recurso.organismo}</p>
                        <p className="display mt-1 text-[15px] leading-snug">{recurso.titulo}</p>
                        <p className="mt-1 text-[12px] leading-relaxed text-[var(--grafito)]">
                          {recurso.resumen}
                        </p>
                        <p className="mt-2 text-[11.5px] font-medium text-[var(--tinta)]">
                          Plazo: {recurso.plazo}
                        </p>
                        <div className="mt-2 border-t border-[var(--linea)] pt-2">
                          <p className="rotulo mb-1">Requisitos principales</p>
                          <ul className="chat-requisitos">
                            {recurso.requisitos.map((requisito) => (
                              <li key={requisito}>{requisito}</li>
                            ))}
                          </ul>
                        </div>
                        <div className="mt-3 flex flex-wrap items-center gap-3">
                          <a
                            className="btn !px-3 !py-2 !text-[11.5px]"
                            href={recurso.urlSolicitud}
                            target="_blank"
                            rel="noreferrer"
                          >
                            {recurso.accion} ↗
                          </a>
                          {recurso.codigo ? (
                            <a className="enlace text-[11.5px]" href={`/?ayuda=${recurso.codigo}`}>
                              Comprobar requisitos en Encaja
                            </a>
                          ) : recurso.urlInfo !== recurso.urlSolicitud ? (
                            <a
                              className="enlace text-[11.5px]"
                              href={recurso.urlInfo}
                              target="_blank"
                              rel="noreferrer"
                            >
                              Ver explicación oficial
                            </a>
                          ) : null}
                        </div>
                      </div>
                    ))}
                    {mensaje.consulta && (
                      <button className="btn btn-linea w-full" onClick={() => llevarAlRadar(mensaje.consulta!)}>
                        Ver toda esta búsqueda en el radar
                      </button>
                    )}
                  </div>
                )}
                {mensaje.modo && (
                  <p className="mt-2 text-[10.5px] text-[var(--niebla)]">
                    {mensaje.modo === "ia"
                      ? "Explicación conversacional con la IA que configuraste · resultados de Encaja"
                      : "Orientación guiada · funciona sin clave de IA"}
                  </p>
                )}
              </article>
            ))}
            {pensando && (
              <div className="chat-mensaje chat-asistente inline-flex items-center gap-2">
                <span className="pulso" /> Buscando ayudas y comprobando requisitos…
              </div>
            )}
            <div ref={final} />
          </div>

          {mensajes.length === 1 && (
            <div className="chat-inicios" aria-label="Situaciones frecuentes">
              {INICIALES.map((inicio) => (
                <button key={inicio} onClick={() => void enviar(inicio)} disabled={pensando}>
                  {inicio}
                </button>
              ))}
            </div>
          )}

          <form
            className="chat-formulario"
            onSubmit={(e) => {
              e.preventDefault();
              void enviar();
            }}
          >
            <label className="sr-only" htmlFor="mensaje-encaja">
              Cuéntame tu situación
            </label>
            <input
              ref={campo}
              id="mensaje-encaja"
              value={texto}
              maxLength={1_200}
              onChange={(e) => setTexto(e.target.value)}
              placeholder="Ej.: trabajo, pero no llego al alquiler…"
              disabled={pensando}
            />
            <button type="submit" disabled={pensando || texto.trim().length < 2} aria-label="Enviar mensaje">
              Enviar
            </button>
          </form>
          <p className="chat-aviso">No compartas DNI, cuenta bancaria ni contraseñas. La fuente oficial siempre manda.</p>
        </section>
      )}

      <button
        className="chat-burbuja"
        onClick={() => setAbierto((valor) => !valor)}
        aria-label={abierto ? "Cerrar asistente de ayudas" : "Abrir asistente de ayudas"}
        aria-expanded={abierto}
      >
        <span aria-hidden="true">{abierto ? "✕" : "?"}</span>
        <span>{abierto ? "Cerrar" : "Te ayudo"}</span>
      </button>
    </>
  );
}
