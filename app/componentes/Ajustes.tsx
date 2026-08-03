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
  const [modelo, setModelo] = useState("");
  const [guardado, setGuardado] = useState(false);

  useEffect(() => {
    fetch("/api/ajustes")
      .then((r) => r.json())
      .then((d: Estado) => {
        setEstado(d);
        setCp(d.cp ?? "");
        setModelo(d.modelo);
      });
  }, []);

  async function guardar() {
    await fetch("/api/ajustes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        gemini_key: clave || undefined,
        cp,
        modelo: modelo || undefined,
      }),
    });
    setGuardado(true);
    setClave("");
    const d = (await (await fetch("/api/ajustes")).json()) as Estado;
    setEstado(d);
    setTimeout(() => setGuardado(false), 1500);
  }

  return (
    <>
      <div className="telon" onClick={onCerrar} />
      <div className="cajon p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold">Ajustes</h2>
          <button className="boton boton-fantasma" onClick={onCerrar}>
            ✕
          </button>
        </div>

        <div className="mt-6 space-y-6">
          <div>
            <div className="titulo-seccion mb-2">CLAVE DE GEMINI (IA)</div>
            <p className="mb-2 text-[13px] text-[var(--tinta2)]">
              Necesaria para leer las bases, entrevistarte y redactar borradores. Se guarda solo en
              tu Mac (base de datos local, fuera de git).{" "}
              {estado?.tieneClaveGemini ? (
                <span className="text-[var(--lima)]">✔ Ya hay una clave guardada.</span>
              ) : (
                <span className="text-[var(--ambar)]">Aún no hay clave.</span>
              )}
            </p>
            <input
              type="password"
              className="control w-full"
              placeholder="Pega aquí tu clave de Google AI Studio"
              value={clave}
              onChange={(e) => setClave(e.target.value)}
            />
          </div>

          <div>
            <div className="titulo-seccion mb-2">TU CÓDIGO POSTAL</div>
            <p className="mb-2 text-[13px] text-[var(--tinta2)]">
              Activa las ayudas de tu ayuntamiento y tu diputación.
            </p>
            <input
              className="control w-full"
              placeholder="46183"
              value={cp}
              maxLength={5}
              onChange={(e) => setCp(e.target.value.replace(/\D/g, ""))}
            />
            {estado?.zona && (
              <div className="mono mt-1 text-[11px] text-[var(--cian)]">
                {estado.zona.municipio} · {estado.zona.provincia}
              </div>
            )}
          </div>

          <div>
            <div className="titulo-seccion mb-2">MODELO DE IA</div>
            <input
              className="control w-full"
              value={modelo}
              onChange={(e) => setModelo(e.target.value)}
            />
          </div>

          <button className="boton boton-lima w-full" onClick={guardar}>
            {guardado ? "✔ GUARDADO" : "GUARDAR"}
          </button>

          <div className="aviso-legal p-3">
            La clave nunca se muestra ni viaja al navegador: solo se usa desde el servidor local.
            También puedes ponerla en <span className="mono">.env.local</span> como{" "}
            <span className="mono">GEMINI_API_KEY</span>.
          </div>
        </div>
      </div>
    </>
  );
}
