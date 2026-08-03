"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import Ajustes from "./Ajustes";

const PESTANAS = [
  { href: "/", etiqueta: "RADAR" },
  { href: "/ficha", etiqueta: "MI FICHA" },
  { href: "/expedientes", etiqueta: "EXPEDIENTES" },
];

export default function Shell({ children }: { children: ReactNode }) {
  const ruta = usePathname();
  const [ajustesAbierto, setAjustesAbierto] = useState(false);

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-30 border-b border-[var(--borde)] bg-[rgba(5,10,20,0.85)] backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3">
          <div className="disco-radar" aria-hidden />
          <Link href="/" className="leading-tight">
            <div className="text-lg font-bold tracking-wide">RADAR DE AYUDAS</div>
            <div className="mono text-[10px] tracking-[0.25em] text-[var(--tinta2)]">
              SUBVENCIONES · ESPAÑA · FUENTE BDNS
            </div>
          </Link>
          <nav className="ml-auto flex items-center gap-1">
            {PESTANAS.map((p) => (
              <Link
                key={p.href}
                href={p.href}
                className={`mono rounded-lg px-3 py-2 text-[11px] tracking-[0.15em] transition ${
                  ruta === p.href
                    ? "bg-[var(--panel2)] text-[var(--lima)]"
                    : "text-[var(--tinta2)] hover:text-[var(--tinta)]"
                }`}
              >
                {p.etiqueta}
              </Link>
            ))}
            <button
              className="boton boton-fantasma mono text-[11px] tracking-[0.15em]"
              onClick={() => setAjustesAbierto(true)}
              title="Ajustes"
            >
              ⚙︎
            </button>
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">{children}</main>

      <footer className="border-t border-[var(--borde)] py-4">
        <div className="mx-auto max-w-6xl px-4 text-[11px] leading-relaxed text-[var(--tinta2)]">
          Datos del{" "}
          <a className="enlace" href="https://www.infosubvenciones.es" target="_blank" rel="noreferrer">
            Sistema Nacional de Publicidad de Subvenciones y Ayudas Públicas (BDNS)
          </a>
          , de naturaleza dinámica: verifica siempre contra la convocatoria oficial. Esta app no
          firma ni presenta solicitudes: eso es siempre tuyo.
        </div>
      </footer>

      {ajustesAbierto && <Ajustes onCerrar={() => setAjustesAbierto(false)} />}
    </div>
  );
}
