"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { colorPlazo, fraseP1azo, type PlazoUi } from "../componentes/tipos-ui";
import { APP_PUBLICA } from "../componentes/Sesion";
import { listarExpedientesPublicos } from "../lib/estado-publico";

interface ExpedienteFila {
  codigoBdns: string;
  estado: "interesa" | "preparacion" | "presentada" | "concedida" | "denegada";
  titulo: string;
  organo: string;
  plazo: PlazoUi | null;
}

const COLUMNAS: { clave: ExpedienteFila["estado"]; titulo: string }[] = [
  { clave: "interesa", titulo: "Me interesa" },
  { clave: "preparacion", titulo: "En preparación" },
  { clave: "presentada", titulo: "Presentada" },
  { clave: "concedida", titulo: "Concedida" },
  { clave: "denegada", titulo: "Denegada" },
];

export default function PaginaExpedientes() {
  const [filas, setFilas] = useState<ExpedienteFila[]>([]);
  const [cargado, setCargado] = useState(false);

  useEffect(() => {
    if (APP_PUBLICA) {
      // El navegador ya tiene los datos: se leen en un microtask para no
      // encadenar un render dentro del efecto que acaba de pintar.
      queueMicrotask(() => {
        setFilas(
          listarExpedientesPublicos().map((e) => ({
            codigoBdns: e.codigoBdns,
            estado: e.estado,
            titulo: e.conv.resumen?.titular ?? e.conv.llano.que ?? e.conv.titulo,
            organo: e.conv.nivel3 ?? e.conv.nivel2,
            plazo: e.conv.plazo,
          })),
        );
        setCargado(true);
      });
      return;
    }
    fetch("/api/expedientes")
      .then((r) => r.json())
      .then((d: { filas: ExpedienteFila[] }) => {
        setFilas(d.filas);
        setCargado(true);
      });
  }, []);

  if (cargado && filas.length === 0) {
    return (
      <div className="py-24 text-center">
        <h1 className="display text-[26px]">Aún no hay expedientes</h1>
        <p className="nota mx-auto mt-2 max-w-sm">
          En el radar, abre una ayuda y pulsa «Abrir expediente». {APP_PUBLICA
            ? "Se guardará de forma privada en este navegador y podrás descargarla."
            : "Se creará una carpeta real en tu disco con los enlaces oficiales y las instrucciones."}
        </p>
        <Link href="/" className="btn mt-7 inline-block">
          Ir al radar
        </Link>
      </div>
    );
  }

  return (
    <div>
      <h1 className="display text-[32px] leading-tight">Expedientes</h1>

      <div className="mt-10 space-y-10">
        {COLUMNAS.map((col) => {
          const deCol = filas.filter((f) => f.estado === col.clave);
          if (deCol.length === 0) return null;
          return (
            <section key={col.clave}>
              <h2 className="rotulo">
                {col.titulo} · {deCol.length}
              </h2>
              <div className="mt-2">
                {deCol.map((f) => (
                  <Link
                    key={f.codigoBdns}
                    href={`/expedientes/${f.codigoBdns}`}
                    className="fila block !grid-cols-1 sm:!grid-cols-[1fr_auto]"
                  >
                    <span className="block min-w-0">
                      <span className="display line-clamp-2 text-[17px] leading-snug">
                        {f.titulo}
                      </span>
                      <span className="mt-1.5 block text-[12.5px] text-[var(--grafito)]">
                        {f.organo}
                      </span>
                    </span>
                    {f.plazo && (
                      <span
                        className="display mt-2 block text-[13.5px] italic sm:mt-0 sm:text-right"
                        style={{ color: colorPlazo(f.plazo) }}
                      >
                        {fraseP1azo(f.plazo)}
                      </span>
                    )}
                  </Link>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
