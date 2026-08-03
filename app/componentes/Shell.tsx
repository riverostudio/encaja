"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import Ajustes from "./Ajustes";

const PESTANAS = [
  { href: "/", etiqueta: "Radar" },
  { href: "/ficha", etiqueta: "Mi ficha" },
  { href: "/expedientes", etiqueta: "Expedientes" },
];

export default function Shell({ children }: { children: ReactNode }) {
  const ruta = usePathname();
  const [ajustesAbierto, setAjustesAbierto] = useState(false);

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-30 border-b border-[var(--linea)] bg-[var(--papel)]/92 backdrop-blur-sm">
        <div className="mx-auto flex max-w-5xl items-center gap-8 px-6 py-5">
          <Link href="/" className="flex items-baseline gap-2.5">
            <span className="display text-[20px] leading-none">Radar de Ayudas</span>
            <span className="rotulo hidden sm:inline">España</span>
          </Link>

          <nav className="ml-auto flex items-center gap-6">
            {PESTANAS.map((p) => (
              <Link
                key={p.href}
                href={p.href}
                className={`text-[13.5px] transition-colors ${
                  ruta === p.href || (p.href !== "/" && ruta.startsWith(p.href))
                    ? "text-[var(--tinta)]"
                    : "text-[var(--niebla)] hover:text-[var(--grafito)]"
                }`}
              >
                {p.etiqueta}
              </Link>
            ))}
            <button
              className="text-[13.5px] text-[var(--niebla)] transition-colors hover:text-[var(--grafito)]"
              onClick={() => setAjustesAbierto(true)}
            >
              Ajustes
            </button>
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-10">{children}</main>

      <footer className="mt-16 border-t border-[var(--linea)]">
        <div className="mx-auto max-w-5xl px-6 py-6">
          <p className="nota max-w-2xl">
            Datos del{" "}
            <a
              className="enlace"
              href="https://www.infosubvenciones.es"
              target="_blank"
              rel="noreferrer"
            >
              Sistema Nacional de Publicidad de Subvenciones
            </a>
            , de naturaleza dinámica: verifica siempre contra la convocatoria oficial antes de
            presentar. Esta herramienta no firma ni presenta solicitudes.
          </p>
        </div>
      </footer>

      {ajustesAbierto && <Ajustes onCerrar={() => setAjustesAbierto(false)} />}
    </div>
  );
}
