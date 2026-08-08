"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Cuestionario from "./Cuestionario";
import { APP_PUBLICA } from "./Sesion";
import {
  crearExpedientePublico,
  getEvaluacionPublica,
  getExpedientePublico,
  getResumenPublico,
  guardarResumenPublico,
} from "../lib/estado-publico";
import {
  colorPlazo,
  euros,
  fraseP1azo,
  nivelBonito,
  SELLO,
  type ConvUi,
  type ResumenIaUi,
  type VeredictoUi,
} from "./tipos-ui";
import { avisoResumenVigente } from "@/lib/requisitos";
import {
  registrarAyudaVistaLocal,
  registrarExpedienteCreado,
} from "../lib/metricas-cliente";

interface Detalle {
  conv: ConvUi;
  urlFicha: string;
  evaluacion: { dictamen: VeredictoUi } | null;
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
  const [resumen, setResumen] = useState<ResumenIaUi | null>(null);
  const [sinClave, setSinClave] = useState(false);
  const [falloResumen, setFalloResumen] = useState(false);
  const pedidoResumen = useRef(false);
  const [veredicto, setVeredicto] = useState<VeredictoUi | null>(null);
  const [cuestionario, setCuestionario] = useState(false);
  const [creandoExp, setCreandoExp] = useState(false);

  useEffect(() => {
    fetch(`/api/convocatorias/${codigo}`)
      .then((r) => r.json())
      .then((datos: Detalle) => {
        if (APP_PUBLICA) {
          const evaluacion = getEvaluacionPublica(codigo);
          datos.evaluacion = evaluacion?.dictamen ? { dictamen: evaluacion.dictamen } : null;
          datos.expediente = getExpedientePublico(codigo)
            ? { codigoBdns: codigo }
            : null;
        }
        setD(datos);
        if (datos.conv && !datos.error) {
          registrarAyudaVistaLocal({
            codigoBdns: datos.conv.codigoBdns,
            titulo: datos.conv.resumen?.titular ?? datos.conv.llano.que ?? datos.conv.titulo,
            organo: datos.conv.nivel3 ?? datos.conv.nivel2,
            fechaInicioSol: datos.conv.fechaInicioSol,
            fechaFinSol: datos.conv.fechaFinSol,
            rangoFechas: datos.conv.rangoFechas,
          });
        }
        setResumen(datos.conv?.resumen ?? (APP_PUBLICA ? getResumenPublico(codigo) : null));
        setVeredicto(datos.evaluacion?.dictamen ?? null);
      });
  }, [codigo]);

  // La traducción de la IA se pide una sola vez por convocatoria y queda guardada.
  useEffect(() => {
    if (!d || d.error || resumen || pedidoResumen.current) return;
    pedidoResumen.current = true;
    fetch(`/api/resumen/${codigo}`, { method: "POST" })
      .then((r) => r.json())
      .then((x: { resumen: ResumenIaUi | null; sinClave?: boolean }) => {
        if (x.resumen) {
          setResumen(x.resumen);
          if (APP_PUBLICA) guardarResumenPublico(codigo, x.resumen);
        }
        else if (x.sinClave) setSinClave(true);
        else setFalloResumen(true);
      })
      .catch(() => setFalloResumen(true));
  }, [d, codigo, resumen]);

  useEffect(() => {
    const alPulsar = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !cuestionario) onCerrar();
    };
    window.addEventListener("keydown", alPulsar);
    return () => window.removeEventListener("keydown", alPulsar);
  }, [onCerrar, cuestionario]);

  const alExpediente = useCallback(async () => {
    setCreandoExp(true);
    const eraNuevo = !d?.expediente;
    if (APP_PUBLICA && d) {
      crearExpedientePublico({ ...d.conv, resumen: resumen ?? d.conv.resumen });
      if (eraNuevo) registrarExpedienteCreado(codigo);
      router.push(`/expedientes/${codigo}`);
      setCreandoExp(false);
      return;
    }
    const r = await fetch("/api/expedientes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ codigo }),
    });
    if (r.ok) {
      if (eraNuevo) registrarExpedienteCreado(codigo);
      router.push(`/expedientes/${codigo}`);
    }
    setCreandoExp(false);
  }, [codigo, d, resumen, router]);

  const ojo = avisoResumenVigente(resumen?.ojo, d?.conv.plazo.estado);

  if (cuestionario && d) {
    return (
      <Cuestionario
        codigo={codigo}
        titulo={resumen?.titular ?? d.conv.titulo}
        sobreLaAyuda={[
          resumen?.que ?? d.conv.llano.que,
          resumen?.aQuien ?? d.conv.llano.quien,
          `Plazo: ${d.conv.rangoFechas}. ${fraseP1azo(d.conv.plazo)}.`,
          d.conv.llano.consigues,
          `La convoca ${d.conv.nivel3 ?? d.conv.nivel2}.`,
          ...(ojo ? [`Ojo: ${ojo}`] : []),
        ]}
        onVeredicto={(v) => setVeredicto(v as VeredictoUi)}
        onCerrar={() => setCuestionario(false)}
      />
    );
  }

  const sello = veredicto ? SELLO[veredicto] : null;
  // Se está traduciendo mientras no haya resumen ni motivo para dejar de esperarlo.
  const resumiendo = Boolean(d) && !d?.error && !resumen && !sinClave && !falloResumen;

  return (
    <>
      <div className="telon" onClick={onCerrar} />
      <aside className="cajon" role="dialog" aria-modal="true" aria-label={`Ayuda BDNS ${codigo}`}>
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[var(--linea)] bg-[var(--lienzo)] px-8 py-4">
          <span className="rotulo cifra">BDNS {codigo}</span>
          <button
            className="text-[18px] leading-none text-[var(--niebla)] transition-colors hover:text-[var(--tinta)]"
            onClick={onCerrar}
            aria-label="Cerrar detalle"
          >
            ✕
          </button>
        </div>

        {!d ? (
          <div className="flex items-center gap-2 px-8 py-10 text-[13px] text-[var(--niebla)]">
            <span className="pulso" /> Cargando la ficha oficial…
          </div>
        ) : d.error ? (
          <p className="px-8 py-10 text-[13px]" style={{ color: "var(--senal)" }}>
            {d.error}
          </p>
        ) : (
          <div className="px-8 pb-16 pt-8">
            <p className="display sube text-[15px] italic" style={{ color: colorPlazo(d.conv.plazo) }}>
              {fraseP1azo(d.conv.plazo)}
            </p>

            {/* ——— EN CRISTIANO: lo primero que se lee ——— */}
            <div className="sube mt-3" style={{ "--i": 1 } as React.CSSProperties}>
              <h2 className="display text-[26px] leading-[1.2]">
                {resumen?.titular ?? d.conv.llano.que}
              </h2>
              {/* sin IA el titular ya es la frase, así que no se repite debajo */}
              {resumen?.que && (
                <p className="mt-3 text-[14.5px] leading-relaxed">{resumen.que}</p>
              )}
              <p className="mt-3 text-[14.5px] leading-relaxed text-[var(--grafito)]">
                {resumen?.consigues ?? d.conv.llano.consigues}
              </p>
              {resumen?.aQuien && (
                <p className="mt-2 text-[14.5px] leading-relaxed text-[var(--grafito)]">
                  <span className="rotulo">Para quién · </span>
                  {resumen.aQuien}
                </p>
              )}
              {ojo && (
                <p
                  className="mt-3 border-l-2 pl-3 text-[13.5px] leading-relaxed"
                  style={{ borderColor: "var(--ocre)", color: "var(--ocre)" }}
                >
                  <span className="rotulo" style={{ color: "var(--ocre)" }}>
                    Ojo ·{" "}
                  </span>
                  {ojo}
                </p>
              )}
              {resumiendo && !resumen && (
                <p className="mt-3 flex items-center gap-2 text-[12.5px] text-[var(--niebla)]">
                  <span className="pulso" /> traduciendo el texto oficial…
                </p>
              )}
              {sinClave && (
                <p className="nota mt-3">
                  Resumen calculado desde los datos oficiales. Pon tu clave de Gemini en Ajustes
                  para que además lo lea y te lo explique con sus palabras.
                </p>
              )}
            </div>

            {/* ——— ¿ENCAJO? ——— */}
            <div
              className="sube mt-8 rounded-lg border p-5"
              style={{
                "--i": 2,
                borderColor: sello ? sello.color : "var(--linea)",
                background: "var(--lienzo-alto)",
              } as React.CSSProperties}
            >
              {sello ? (
                <>
                  <p className="rotulo">Tu veredicto</p>
                  <p className="display mt-1 text-[26px] leading-none" style={{ color: sello.color }}>
                    {sello.texto}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-3">
                    <button className="btn btn-linea" onClick={() => setCuestionario(true)}>
                      Repasar el cuestionario
                    </button>
                    {veredicto === "encaja" && (
                      <button className="btn" onClick={() => void alExpediente()} disabled={creandoExp}>
                        {d.expediente ? "Ver expediente" : creandoExp ? "Creando…" : "Preparar el expediente"}
                      </button>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <p className="rotulo">Lo más importante</p>
                  <p className="display mt-1 text-[20px] leading-snug">¿Puedes pedirla tú?</p>
                  <p className="mt-2 text-[13.5px] leading-relaxed text-[var(--grafito)]">
                    Te hago las preguntas justas —solo las que aún no sé de ti— y te digo si
                    cumples, citando el texto de las bases.
                  </p>
                  <button className="btn mt-4" onClick={() => setCuestionario(true)}>
                    Empezar el cuestionario
                  </button>
                </>
              )}
            </div>

            {/* ——— toda la información ——— */}
            <div className="sube mt-8" style={{ "--i": 3 } as React.CSSProperties}>
              <p className="rotulo mb-1">Ficha completa</p>
              <h3 className="display text-[15px] leading-snug text-[var(--grafito)]">
                {d.conv.titulo}
              </h3>
              <p className="mt-2 text-[13px] text-[var(--grafito)]">
                {d.conv.nivel3 ?? d.conv.nivel2}
                <span className="text-[var(--niebla)]"> · {nivelBonito(d.conv.nivel1)}</span>
              </p>

              <div className="mt-4">
                {(d.conv.fechaInicioSol || d.conv.fechaFinSol) && (
                  <Dato etiqueta="Plazo de solicitud">
                    <span className="cifra">
                      {d.conv.fechaInicioSol ?? "?"} — {d.conv.fechaFinSol ?? "?"}
                    </span>
                  </Dato>
                )}
                {euros(d.conv.presupuesto) && (
                  <Dato etiqueta="Bolsa total del programa">
                    <span className="display cifra text-[22px]">{euros(d.conv.presupuesto)}</span>
                    <span className="nota mt-1 block">
                      Es el dinero de toda la convocatoria, que se reparte entre quienes la piden.
                    </span>
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
                {d.conv.fondos.length > 0 && <Dato etiqueta="Fondos">{d.conv.fondos.join(" · ")}</Dato>}
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

              {!sello && (
                <button
                  className="btn btn-linea mt-6"
                  onClick={() => void alExpediente()}
                  disabled={creandoExp}
                >
                  {d.expediente ? "Ver expediente" : creandoExp ? "Creando…" : "Abrir expediente igualmente"}
                </button>
              )}
            </div>
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
