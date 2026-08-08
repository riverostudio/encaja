"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { guardarConsentimientoMetricas } from "../lib/metricas-cliente";

const LLAVE_AVISO = "encaja.aviso-legal.v2";
const EVENTO_AVISO = "encaja:cambio-aviso-legal";
let cerradoEnEstaPagina = false;

function suscribir(actualizar: () => void) {
  window.addEventListener("storage", actualizar);
  window.addEventListener(EVENTO_AVISO, actualizar);
  return () => {
    window.removeEventListener("storage", actualizar);
    window.removeEventListener(EVENTO_AVISO, actualizar);
  };
}

function estaVisible() {
  if (cerradoEnEstaPagina) return false;
  try {
    return localStorage.getItem(LLAVE_AVISO) !== "1";
  } catch {
    return true;
  }
}

export default function AvisoLegalInicial() {
  const visible = useSyncExternalStore(suscribir, estaVisible, () => false);

  function cerrar(consentimiento: "si" | "no") {
    cerradoEnEstaPagina = true;
    guardarConsentimientoMetricas(consentimiento);
    try {
      localStorage.setItem(LLAVE_AVISO, "1");
    } catch {
      // El aviso se puede cerrar igualmente aunque el navegador bloquee localStorage.
    }
    window.dispatchEvent(new Event(EVENTO_AVISO));
  }

  if (!visible) return null;

  return (
    <aside
      className="fixed bottom-4 left-1/2 z-[60] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 rounded-xl border border-[var(--linea-fuerte)] bg-[var(--fondo)] p-4 shadow-2xl"
      role="dialog"
      aria-modal="false"
      aria-labelledby="titulo-aviso-inicial"
    >
      <button
        type="button"
        className="absolute right-3 top-3 rounded p-1 text-[var(--niebla)] hover:text-[var(--tinta)]"
        onClick={() => cerrar("no")}
        aria-label="Cerrar aviso"
      >
        ✕
      </button>
      <p id="titulo-aviso-inicial" className="rotulo pr-8">
        Aviso inicial
      </p>
      <p className="mt-2 pr-5 text-[13px] leading-relaxed text-[var(--grafito)]">
        Encaja usa contenido asistido por IA y puede equivocarse. El panel privado guarda tu
        actividad solo en este navegador. Si aceptas, además enviará estadísticas sin nombre y
        seudonimizadas, nunca tu perfil, mensajes ni claves de IA.
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-4">
        <button type="button" className="btn btn-linea !px-4 !py-2 !text-[12px]" onClick={() => cerrar("si")}>
          Aceptar estadísticas
        </button>
        <button type="button" className="btn btn-linea !px-4 !py-2 !text-[12px]" onClick={() => cerrar("no")}>
          Solo necesarias
        </button>
        <Link href="/privacidad" className="enlace text-[12px]">
          Leer aviso legal
        </Link>
      </div>
    </aside>
  );
}
