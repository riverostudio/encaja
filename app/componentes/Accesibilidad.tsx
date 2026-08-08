"use client";

import { useEffect, useState } from "react";

const LLAVE = "encaja.accesibilidad.v1";

export interface PreferenciasAccesibilidad {
  textoGrande: boolean;
  contrasteAlto: boolean;
  reducirMovimiento: boolean;
  lecturaFacil: boolean;
}

const INICIALES: PreferenciasAccesibilidad = {
  textoGrande: false,
  contrasteAlto: false,
  reducirMovimiento: false,
  lecturaFacil: false,
};

function aplicar(p: PreferenciasAccesibilidad): void {
  const raiz = document.documentElement;
  raiz.toggleAttribute("data-texto-grande", p.textoGrande);
  raiz.toggleAttribute("data-contraste-alto", p.contrasteAlto);
  raiz.toggleAttribute("data-reducir-movimiento", p.reducirMovimiento);
  raiz.toggleAttribute("data-lectura-facil", p.lecturaFacil);
}

function leer(): PreferenciasAccesibilidad {
  try {
    return { ...INICIALES, ...(JSON.parse(localStorage.getItem(LLAVE) ?? "{}") as Partial<PreferenciasAccesibilidad>) };
  } catch {
    return INICIALES;
  }
}

export default function Accesibilidad() {
  const [abierto, setAbierto] = useState(false);
  const [preferencias, setPreferencias] = useState(INICIALES);

  useEffect(() => {
    queueMicrotask(() => {
      const guardadas = leer();
      setPreferencias(guardadas);
      aplicar(guardadas);
    });
  }, []);

  useEffect(() => {
    if (!abierto) return;
    const cerrar = (e: KeyboardEvent) => e.key === "Escape" && setAbierto(false);
    window.addEventListener("keydown", cerrar);
    return () => window.removeEventListener("keydown", cerrar);
  }, [abierto]);

  function cambiar(clave: keyof PreferenciasAccesibilidad) {
    const nuevas = { ...preferencias, [clave]: !preferencias[clave] };
    setPreferencias(nuevas);
    aplicar(nuevas);
    localStorage.setItem(LLAVE, JSON.stringify(nuevas));
  }

  return (
    <>
      <button
        type="button"
        className="interruptor"
        aria-label="Abrir opciones de accesibilidad"
        aria-expanded={abierto}
        onClick={() => setAbierto(true)}
      >
        Aa
      </button>
      {abierto && (
        <>
          <div className="telon" onClick={() => setAbierto(false)} />
          <section className="cajon" role="dialog" aria-modal="true" aria-labelledby="titulo-accesibilidad">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[var(--linea)] bg-[var(--lienzo)] px-8 py-4">
              <h2 id="titulo-accesibilidad" className="rotulo">Accesibilidad y lectura</h2>
              <button className="chat-cerrar" onClick={() => setAbierto(false)} aria-label="Cerrar accesibilidad">✕</button>
            </div>
            <div className="px-8 py-8">
              <p className="nota max-w-lg">
                Estas opciones solo se guardan en este navegador. Puedes usar también el zoom y el lector de pantalla de tu dispositivo.
              </p>
              <div className="mt-6 divide-y divide-[var(--linea)]">
                {[
                  ["textoGrande", "Texto más grande", "Aumenta el tamaño general sin ocultar contenido."],
                  ["contrasteAlto", "Contraste alto", "Refuerza colores, bordes y el indicador de foco."],
                  ["reducirMovimiento", "Reducir movimiento", "Quita animaciones y desplazamientos decorativos."],
                  ["lecturaFacil", "Lectura más cómoda", "Añade espacio entre líneas y limita el ancho de los textos largos."],
                ].map(([clave, titulo, ayuda]) => {
                  const k = clave as keyof PreferenciasAccesibilidad;
                  return (
                    <label key={clave} className="flex cursor-pointer items-start gap-4 py-5">
                      <input
                        type="checkbox"
                        className="mt-1 h-5 w-5 accent-[var(--bosque)]"
                        checked={preferencias[k]}
                        onChange={() => cambiar(k)}
                      />
                      <span>
                        <strong className="display block text-[18px] font-normal">{titulo}</strong>
                        <span className="nota mt-1 block">{ayuda}</span>
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          </section>
        </>
      )}
    </>
  );
}
