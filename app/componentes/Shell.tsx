"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import Ajustes from "./Ajustes";
import Tema from "./Tema";
import Bienvenida, { type ProveedorUi } from "./Bienvenida";
import { APP_PUBLICA } from "./Sesion";
import AsistenteAyudas from "./AsistenteAyudas";
import AvisoLegalInicial from "./AvisoLegalInicial";

const LLAVE_ENTRADA = "encaja.entrada";

const PESTANAS = [
  { href: "/", etiqueta: "Radar" },
  { href: "/ficha", etiqueta: "Mi perfil" },
  { href: "/expedientes", etiqueta: "Expedientes" },
];

interface EstadoIa {
  configurada: boolean;
  proveedores: ProveedorUi[];
}

export default function Shell({ children }: { children: ReactNode }) {
  const ruta = usePathname();
  const [ajustesAbierto, setAjustesAbierto] = useState(false);
  const [ia, setIa] = useState<EstadoIa | null>(null);

  useEffect(() => {
    fetch("/api/ajustes")
      .then((r) => r.json())
      .then((d: EstadoIa) => {
        const yaEntro = APP_PUBLICA && localStorage.getItem(LLAVE_ENTRADA) === "1";
        setIa(yaEntro ? { ...d, configurada: true } : d);
      })
      .catch(() => setIa({ configurada: true, proveedores: [] }));
  }, []);

  // Mientras no se sepa, nada: evita que la puerta parpadee al recargar.
  if (!ia) return null;

  // Sin clave no se entra: la app no podría hacer su trabajo.
  if (!ia.configurada && ia.proveedores.length > 0 && ruta !== "/privacidad") {
    return (
      <>
        <Bienvenida
          proveedores={ia.proveedores}
          onListo={() => {
            if (APP_PUBLICA) localStorage.setItem(LLAVE_ENTRADA, "1");
            setIa({ ...ia, configurada: true });
          }}
        />
        <AvisoLegalInicial />
      </>
    );
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <header
        className="sticky top-0 z-30 border-b border-[var(--linea)] backdrop-blur-md"
        style={{ background: "var(--fondo-velo)" }}
      >
        <div className="mx-auto flex max-w-6xl items-center gap-6 px-6 py-4">
          <Link href="/" className="group flex items-baseline gap-2.5">
            <span className="display text-[20px] leading-none">Encaja</span>
            <span className="rotulo hidden transition-colors group-hover:text-[var(--grafito)] sm:inline">
              Ayudas públicas · España
            </span>
          </Link>

          <nav className="ml-auto flex items-center gap-5">
            {PESTANAS.map((p) => {
              const activa = p.href === "/" ? ruta === "/" : ruta.startsWith(p.href);
              return (
                <Link
                  key={p.href}
                  href={p.href}
                  className={`filtro !text-[13.5px] ${activa ? "filtro-activo" : ""}`}
                >
                  {p.etiqueta}
                </Link>
              );
            })}
            <button className="filtro !text-[13.5px]" onClick={() => setAjustesAbierto(true)}>
              Ajustes
            </button>
            <Tema />
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-10">{children}</main>

      <footer className="mt-16 border-t border-[var(--linea)]">
        <div className="mx-auto max-w-6xl px-6 py-7">
          <p className="nota max-w-3xl">
            Datos del{" "}
            <a
              className="enlace"
              href="https://www.infosubvenciones.es"
              target="_blank"
              rel="noreferrer"
            >
              Sistema Nacional de Publicidad de Subvenciones
            </a>
            , de naturaleza dinámica. Esta herramienta no firma ni presenta solicitudes.
            {" · "}
            <Link className="enlace" href="/privacidad">
              Aviso legal, privacidad e IA
            </Link>
          </p>
        </div>
      </footer>

      {ajustesAbierto && <Ajustes onCerrar={() => setAjustesAbierto(false)} />}
      <AsistenteAyudas />
      {ruta !== "/privacidad" && <AvisoLegalInicial />}
    </div>
  );
}
