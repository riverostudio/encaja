"use client";

import { useEffect, useState } from "react";

interface Estado {
  tieneClaveGemini: boolean;
  modelo: string;
  cp: string | null;
  zona: { municipio: string; provincia: string } | null;
}

export default function Ajustes({ onCerrar }: { onCerrar: () => void }) {
  const [estado, setEstado] = useState<Estado | null>(null);
  const [clave, setClave] = useState("");
  const [cp, setCp] = useState("");
  const [guardado, setGuardado] = useState(false);

  useEffect(() => {
    fetch("/api/ajustes")
      .then((r) => r.json())
      .then((d: Estado) => {
        setEstado(d);
        setCp(d.cp ?? "");
      });
  }, []);

  useEffect(() => {
    const alPulsar = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCerrar();
    };
    window.addEventListener("keydown", alPulsar);
    return () => window.removeEventListener("keydown", alPulsar);
  }, [onCerrar]);

  async function guardar() {
    await fetch("/api/ajustes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ gemini_key: clave || undefined, cp }),
    });
    setGuardado(true);
    setClave("");
    const d = (await (await fetch("/api/ajustes")).json()) as Estado;
    setEstado(d);
    setTimeout(() => setGuardado(false), 1600);
  }

  return (
    <>
      <div className="telon" onClick={onCerrar} />
      <div className="cajon">
        <div className="sticky top-0 flex items-center justify-between border-b border-[var(--linea)] bg-[var(--lienzo)] px-8 py-4">
          <span className="rotulo">Ajustes</span>
          <button
            className="text-[18px] leading-none text-[var(--niebla)] transition-colors hover:text-[var(--tinta)]"
            onClick={onCerrar}
          >
            ✕
          </button>
        </div>

        <div className="px-8 pb-16 pt-8">
          <div className="dato border-t-0 pt-0">
            <div className="rotulo mb-1.5">Clave de Gemini</div>
            <p className="nota mb-3">
              Necesaria para leer las bases, entrevistarte y redactar borradores.{" "}
              {estado?.tieneClaveGemini ? (
                <span style={{ color: "var(--bosque)" }}>Ya hay una clave guardada.</span>
              ) : (
                <span style={{ color: "var(--ocre)" }}>Todavía no hay ninguna.</span>
              )}
            </p>
            <input
              type="password"
              className="campo w-full"
              placeholder="Pega aquí la clave de Google AI Studio"
              value={clave}
              onChange={(e) => setClave(e.target.value)}
            />
          </div>

          <div className="dato">
            <div className="rotulo mb-1.5">Tu código postal</div>
            <p className="nota mb-3">Activa las ayudas de tu ayuntamiento y tu diputación.</p>
            <input
              className="campo cifra w-[90px]"
              placeholder="46183"
              maxLength={5}
              value={cp}
              onChange={(e) => setCp(e.target.value.replace(/\D/g, ""))}
            />
            {estado?.zona && (
              <span className="ml-3 text-[13px] text-[var(--grafito)]">
                {estado.zona.municipio}, {estado.zona.provincia}
              </span>
            )}
          </div>

          <button className="btn mt-7 w-full" onClick={guardar}>
            {guardado ? "Guardado" : "Guardar"}
          </button>

          <p className="nota mt-6">
            La clave se guarda solo en este Mac y nunca viaja al navegador ni al repositorio.
            También puedes ponerla en <span className="cifra">.env.local</span> como{" "}
            <span className="cifra">GEMINI_API_KEY</span>.
          </p>
        </div>
      </div>
    </>
  );
}
