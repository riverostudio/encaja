"use client";

import { useSyncExternalStore } from "react";

type Piel = "claro" | "oscuro";

const oyentes = new Set<() => void>();

function suscribir(alCambiar: () => void) {
  oyentes.add(alCambiar);
  return () => oyentes.delete(alCambiar);
}

/** La piel vive en el atributo del <html>, que el guion del layout ya fijó. */
function leerPiel(): Piel {
  return (document.documentElement.getAttribute("data-tema") as Piel) ?? "claro";
}

export default function Tema() {
  // En servidor no hay piel conocida: se pinta el glifo neutro y el cliente lo resuelve.
  const piel = useSyncExternalStore<Piel | null>(suscribir, leerPiel, () => null);

  function alternar() {
    const nueva: Piel = leerPiel() === "oscuro" ? "claro" : "oscuro";
    document.documentElement.setAttribute("data-tema", nueva);
    try {
      localStorage.setItem("tema", nueva);
    } catch {
      // navegación privada: la elección vive solo en esta pestaña
    }
    oyentes.forEach((avisar) => avisar());
  }

  return (
    <button
      className="interruptor"
      onClick={alternar}
      aria-label={piel === "oscuro" ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
      title={piel === "oscuro" ? "Modo claro" : "Modo oscuro"}
    >
      {piel === "oscuro" ? "☀" : piel === "claro" ? "☾" : "◐"}
    </button>
  );
}
