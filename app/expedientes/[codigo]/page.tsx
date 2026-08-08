"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";
import { colorPlazo, fraseP1azo, SELLO, type ConvUi, type VeredictoUi } from "../../componentes/tipos-ui";
import { APP_PUBLICA } from "../../componentes/Sesion";
import {
  actualizarExpedientePublico,
  datosExpedientePublico,
  descargarExpedientePublico,
} from "../../lib/estado-publico";
import { registrarSolicitudAbierta } from "../../lib/metricas-cliente";

interface ItemChecklist {
  id: string;
  texto: string;
  estado: "lo_tengo" | "pedirlo" | "redactarlo" | "pendiente";
  nota?: string;
}

interface Condicion {
  id: string;
  literal: string;
  pregunta?: string;
}

interface Datos {
  expediente: { codigoBdns: string; estado: string; carpeta: string; checklistJson: string };
  conv: (ConvUi & { urlFicha: string }) | null;
  condiciones: Condicion[];
  veredicto: VeredictoUi | null;
  dondeSolicitar: string;
  destinoSolicitud: "sede" | "bases" | "ficha";
  error?: string;
}

const ESTADOS = [
  { clave: "interesa", texto: "Me interesa" },
  { clave: "preparacion", texto: "En preparación" },
  { clave: "presentada", texto: "Presentada" },
  { clave: "concedida", texto: "Concedida" },
  { clave: "denegada", texto: "Denegada" },
];

const ESTADOS_ITEM: { clave: ItemChecklist["estado"]; texto: string }[] = [
  { clave: "pendiente", texto: "pendiente" },
  { clave: "lo_tengo", texto: "lo tengo" },
  { clave: "pedirlo", texto: "hay que pedirlo" },
  { clave: "redactarlo", texto: "hay que redactarlo" },
];

export default function PaginaExpediente({ params }: { params: Promise<{ codigo: string }> }) {
  const { codigo } = use(params);
  const [datos, setDatos] = useState<Datos | null>(null);
  const [generando, setGenerando] = useState<string | null>(null);
  const [rutaGenerada, setRutaGenerada] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmando, setConfirmando] = useState(false);

  useEffect(() => {
    if (APP_PUBLICA) {
      queueMicrotask(() => {
        const local = datosExpedientePublico(codigo);
        setDatos((local ?? { error: "No existe el expediente" }) as Datos);
      });
      return;
    }
    fetch(`/api/expedientes/${codigo}`)
      .then((r) => r.json())
      .then((d: Datos) => setDatos(d));
  }, [codigo]);

  async function recargar() {
    if (APP_PUBLICA) {
      const local = datosExpedientePublico(codigo);
      setDatos((local ?? { error: "No existe el expediente" }) as Datos);
      return;
    }
    const r = await fetch(`/api/expedientes/${codigo}`);
    setDatos((await r.json()) as Datos);
  }

  async function patch(cuerpo: object) {
    if (APP_PUBLICA) {
      actualizarExpedientePublico(codigo, cuerpo as Parameters<typeof actualizarExpedientePublico>[1]);
      await recargar();
      return;
    }
    await fetch(`/api/expedientes/${codigo}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(cuerpo),
    });
    await recargar();
  }

  async function accion(cuerpo: object, etiqueta: string) {
    setGenerando(etiqueta);
    setError(null);
    setRutaGenerada(null);
    try {
      if (APP_PUBLICA) {
        const peticion = cuerpo as { accion?: string; tipo?: "memoria" | "declaracion" };
        if (peticion.accion === "abrir_carpeta") {
          descargarExpedientePublico(codigo);
          setRutaGenerada("Descargas");
          return;
        }
        if (peticion.accion === "borrador") {
          const r = await fetch(`/api/borrador/${codigo}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ tipo: peticion.tipo }),
          });
          if (!r.ok) {
            const d = (await r.json()) as { error?: string };
            setError(d.error ?? "No se ha podido generar el borrador.");
            return;
          }
          const blob = await r.blob();
          const url = URL.createObjectURL(blob);
          const enlace = document.createElement("a");
          enlace.href = url;
          enlace.download = `encaja-${codigo}-${peticion.tipo ?? "borrador"}.docx`;
          enlace.click();
          setTimeout(() => URL.revokeObjectURL(url), 1000);
          setRutaGenerada("Descargas");
          return;
        }
      }
      const r = await fetch(`/api/expedientes/${codigo}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cuerpo),
      });
      const d = (await r.json()) as { ruta?: string; error?: string };
      if (!r.ok) {
        setError(
          d.error?.includes("SIN_CLAVE_GEMINI")
            ? "Falta una clave de IA: pégala en Ajustes para redactar borradores."
            : (d.error ?? "Error"),
        );
      } else if (d.ruta) setRutaGenerada(d.ruta);
    } finally {
      setGenerando(null);
    }
  }

  if (!datos) {
    return (
      <p className="flex items-center gap-2 py-10 text-[13px] text-[var(--niebla)]">
        <span className="pulso" /> Abriendo expediente…
      </p>
    );
  }

  if (datos.error) {
    return (
      <div className="py-20 text-center">
        <p className="display text-[20px]">{datos.error}</p>
        <Link href="/expedientes" className="btn btn-linea mt-6 inline-block">
          Volver
        </Link>
      </div>
    );
  }

  const checklist = JSON.parse(datos.expediente.checklistJson) as ItemChecklist[];
  const conv = datos.conv;
  const sello = datos.veredicto ? SELLO[datos.veredicto] : null;
  const pendientes = checklist.filter((i) => i.estado === "pendiente" || i.estado === "pedirlo");
  const cerrada = conv?.plazo.estado === "cerrada";

  return (
    <div className="max-w-2xl">
      <Link
        href="/expedientes"
        className="text-[12.5px] text-[var(--niebla)] transition-colors hover:text-[var(--tinta)]"
      >
        ← Expedientes
      </Link>

      {conv && (
        <p className="display mt-6 text-[15px] italic" style={{ color: colorPlazo(conv.plazo) }}>
          {fraseP1azo(conv.plazo)} · {conv.rangoFechas}
        </p>
      )}
      <h1 className="display mt-1.5 text-[28px] leading-[1.25]">
        {conv?.resumen?.titular ?? conv?.llano?.que ?? conv?.titulo ?? codigo}
      </h1>
      {conv && (
        <p className="mt-2 text-[13px] text-[var(--grafito)]">{conv.nivel3 ?? conv.nivel2}</p>
      )}

      {sello && (
        <p className="mt-4 inline-block rounded-full px-3 py-1 text-[12.5px]" style={{ color: sello.color, border: `1px solid ${sello.color}` }}>
          {sello.texto} · según tu perfil
        </p>
      )}

      <div className="mt-7 flex flex-wrap items-center gap-x-5 gap-y-2">
        <span className="rotulo">Estado</span>
        {ESTADOS.map((e) => (
          <button
            key={e.clave}
            onClick={() => void patch({ estado: e.clave })}
            className={`filtro ${datos.expediente.estado === e.clave ? "filtro-activo" : ""}`}
          >
            {e.texto}
          </button>
        ))}
      </div>

      {/* ——— 1 · QUÉ TE PIDEN ——— */}
      <section className="mt-10">
        <h2 className="rotulo">1 · Lo que tienes que cumplir</h2>
        {datos.condiciones.length === 0 ? (
          <p className="nota mt-3">
            Las bases no detallan condiciones legibles. Ábrelas en el enlace oficial de abajo antes
            de presentar nada.
          </p>
        ) : (
          <ul className="mt-3 space-y-2.5">
            {datos.condiciones.map((c, i) => (
              <li
                key={c.id}
                className="sube flex gap-3 text-[14px] leading-relaxed"
                style={{ "--i": Math.min(i, 8) } as React.CSSProperties}
              >
                <span className="text-[var(--niebla)]">·</span>
                <span>{c.pregunta ? c.pregunta.replace(/^¿|\?$/g, "") : c.literal}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ——— 2 · QUÉ TIENES QUE APORTAR ——— */}
      <section className="mt-10">
        <h2 className="rotulo">2 · Lo que tienes que aportar</h2>
        {checklist.length === 0 ? (
          <p className="nota mt-3">
            Las bases no publican una lista de documentos legible. Consúltala en el enlace oficial.
          </p>
        ) : (
          <div className="mt-2">
            {checklist.map((item) => (
              <div key={item.id} className="dato">
                <p className="display text-[15px] leading-snug">{item.texto}</p>
                <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1">
                  {ESTADOS_ITEM.map((e) => (
                    <button
                      key={e.clave}
                      onClick={() => void patch({ item: { id: item.id, estado: e.clave } })}
                      className={`filtro ${item.estado === e.clave ? "filtro-activo" : ""}`}
                    >
                      {e.texto}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ——— 3 · APLICAR ——— */}
      <section
        className="mt-10 rounded-lg border p-6"
        style={{
          borderColor: cerrada ? "var(--linea)" : "var(--tinta)",
          background: "var(--lienzo-alto)",
        }}
      >
        <h2 className="rotulo">3 · Presentar la solicitud</h2>

        {cerrada ? (
          <p className="mt-3 text-[14px] leading-relaxed" style={{ color: "var(--senal)" }}>
            El plazo ya se cerró. Esta convocatoria suele repetirse cada año: vigílala en el radar.
          </p>
        ) : !confirmando ? (
          <>
            <p className="display mt-2 text-[19px] leading-snug">
              {pendientes.length > 0
                ? `Te quedan ${pendientes.length} documento${pendientes.length === 1 ? "" : "s"} por conseguir.`
                : "Todo listo por tu parte."}
            </p>
            <p className="mt-2 text-[13.5px] leading-relaxed text-[var(--grafito)]">
              Cuando le des a aplicar te llevo a la página oficial donde se presenta. Ahí tendrás
              que identificarte tú.
            </p>
            <button className="btn mt-5" onClick={() => setConfirmando(true)}>
              Quiero aplicar
            </button>
          </>
        ) : (
          <div className="sube mt-3">
            <p className="display text-[19px] leading-snug">Antes de ir, ten esto a mano:</p>

            <ul className="mt-4 space-y-3 text-[14px] leading-relaxed">
              <li className="flex gap-3">
                <span className="text-[var(--niebla)]">1</span>
                <span>
                  <strong>Con qué te identificas.</strong> Necesitas <strong>DNI electrónico</strong>{" "}
                  con su lector, <strong>certificado digital</strong> (el de la FNMT) o{" "}
                  <strong>Cl@ve</strong>. Cada organismo admite unos u otros: la propia sede te lo
                  dirá al entrar.
                </span>
              </li>
              <li className="flex gap-3">
                <span className="text-[var(--niebla)]">2</span>
                <span>
                  <strong>Los documentos</strong> de la lista de arriba, en PDF y a mano en el
                  ordenador.
                </span>
              </li>
              <li className="flex gap-3">
                <span className="text-[var(--niebla)]">3</span>
                <span>
                  <strong>El justificante.</strong> Al terminar, descarga el resguardo de registro y
                  guárdalo en la carpeta del expediente. Sin él no puedes demostrar que presentaste.
                </span>
              </li>
            </ul>

            <p className="nota mt-5">
              {datos.destinoSolicitud === "sede"
                ? "Te llevo a la sede electrónica del organismo. Muchas sedes abren por su portada: si no aterrizas en el trámite, búscalo por el nombre de la convocatoria en su catálogo."
                : datos.destinoSolicitud === "bases"
                  ? "Esta convocatoria no publica enlace a su sede, así que te llevo a las bases oficiales: ahí viene dónde y cómo se presenta."
                  : "Esta convocatoria no publica un enlace web seguro a la sede o a las bases. Te llevo a su ficha oficial de la BDNS, con el organismo y los documentos publicados."}{" "}
              La solicitud la firmas y la envías tú; esta app no presenta nada en tu nombre.
            </p>

            <div className="mt-5 flex flex-wrap gap-3">
              <a
                className="btn"
                href={datos.dondeSolicitar}
                target="_blank"
                rel="noreferrer"
                onClick={() => {
                  registrarSolicitudAbierta(codigo);
                  void patch({ estado: "preparacion" });
                }}
              >
                {datos.destinoSolicitud === "sede"
                  ? "Ir a la sede electrónica ↗"
                  : datos.destinoSolicitud === "bases"
                    ? "Ir a las bases oficiales ↗"
                    : "Ir a la ficha oficial BDNS ↗"}
              </a>
              {conv && (
                <a className="btn btn-linea" href={conv.urlFicha} target="_blank" rel="noreferrer">
                  Ver la ficha oficial ↗
                </a>
              )}
              <button className="btn btn-linea" onClick={() => setConfirmando(false)}>
                Todavía no
              </button>
            </div>
            <p className="nota mt-3">
              Si el enlace no te lleva donde esperabas, la ficha oficial de la BDNS siempre tiene el
              organismo, el expediente y los documentos de la convocatoria.
            </p>

            <button
              className="btn-texto mt-5"
              onClick={() => void patch({ estado: "presentada" })}
            >
              Ya la he presentado
            </button>
          </div>
        )}
      </section>

      {/* ——— herramientas ——— */}
      <section className="mt-10">
        <h2 className="rotulo">Borradores y carpeta</h2>
        <div className="mt-3 flex flex-wrap gap-3">
          <button
            className="btn btn-linea"
            disabled={generando !== null}
            onClick={() => void accion({ accion: "borrador", tipo: "memoria" }, "memoria")}
          >
            {generando === "memoria" ? "Redactando…" : "Redactar memoria"}
          </button>
          <button
            className="btn btn-linea"
            disabled={generando !== null}
            onClick={() => void accion({ accion: "borrador", tipo: "declaracion" }, "declaracion")}
          >
            {generando === "declaracion" ? "Redactando…" : "Redactar declaración"}
          </button>
          <button
            className="btn btn-linea"
            onClick={() => void accion({ accion: "abrir_carpeta" }, "carpeta")}
          >
            {APP_PUBLICA ? "Descargar expediente" : "Abrir carpeta"}
          </button>
        </div>
        {rutaGenerada && (
          <p className="nota mt-3" style={{ color: "var(--bosque)" }}>
            Archivo generado en <span className="cifra break-all">{rutaGenerada}</span>. Revísalo
            antes de usarlo.
          </p>
        )}
        {error && (
          <p className="nota mt-3" style={{ color: "var(--senal)" }}>
            {error}
          </p>
        )}
        <p className="cifra mt-3 break-all text-[11.5px] text-[var(--niebla)]">
          {datos.expediente.carpeta}
        </p>
      </section>

      {conv && (
        <section className="filete mt-10 pt-6">
          <h2 className="rotulo">Fuentes oficiales</h2>
          <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-[13.5px]">
            <a className="enlace" href={conv.urlFicha} target="_blank" rel="noreferrer">
              Ficha BDNS
            </a>
            {conv.urlBases && (
              <a className="enlace" href={conv.urlBases} target="_blank" rel="noreferrer">
                Bases reguladoras
              </a>
            )}
            {conv.sede && (
              <a className="enlace" href={conv.sede} target="_blank" rel="noreferrer">
                Sede electrónica
              </a>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
