"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Aviso, ElegirModelo, type ProveedorUi } from "./Bienvenida";
import Trabajos from "./Trabajos";
import { APP_PUBLICA, guardarIaLocal, olvidarIaLocal } from "./Sesion";
import {
  borrarDatosPublicos,
  exportarDatosPublicos,
  guardarHechoPublico,
  leerPerfilPublico,
} from "../lib/estado-publico";

interface Estado {
  configurada: boolean;
  proveedor: string;
  proveedorNombre: string;
  modelo: string;
  proveedores: ProveedorUi[];
  cp: string | null;
  zona: { municipio: string; provincia: string } | null;
}

export default function Ajustes({ onCerrar }: { onCerrar: () => void }) {
  const router = useRouter();
  const [estado, setEstado] = useState<Estado | null>(null);
  const [proveedor, setProveedor] = useState("");
  const [clave, setClave] = useState("");
  const [modelo, setModelo] = useState("");
  const [cp, setCp] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [guardado, setGuardado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/ajustes")
      .then((r) => r.json())
      .then((d: Estado) => {
        setEstado(d);
        setCp(APP_PUBLICA ? (leerPerfilPublico().cp ?? "") : (d.cp ?? ""));
        setProveedor(d.proveedor);
        setModelo(d.modelo);
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
    setGuardando(true);
    setError(null);
    try {
      const r = await fetch("/api/ajustes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          proveedor,
          clave: clave.trim() || undefined,
          modelo: modelo.trim() || undefined,
          cp,
        }),
      });
      const d = (await r.json()) as {
        error?: string;
        guardarEnNavegador?: { proveedor: string; modelo: string; clave: string };
      };
      if (!r.ok) {
        setError(d.error ?? "No se ha podido guardar.");
        return;
      }
      // En la app pública el servidor comprueba la clave pero no se la queda:
      // la devuelve para que viva solo en este navegador.
      if (d.guardarEnNavegador) {
        const { proveedor: p, modelo: m, clave: c } = d.guardarEnNavegador;
        guardarIaLocal(p, m, c);
      }
      if (APP_PUBLICA && cp) guardarHechoPublico("cp", cp);
      setGuardado(true);
      setClave("");
      setEstado((await (await fetch("/api/ajustes")).json()) as Estado);
      setTimeout(() => setGuardado(false), 1800);
    } finally {
      setGuardando(false);
    }
  }

  const fichaElegida = estado?.proveedores.find((p) => p.id === proveedor);

  return (
    <>
      <div className="telon" onClick={onCerrar} />
      <div className="cajon" role="dialog" aria-modal="true" aria-label="Ajustes de Encaja">
        <div className="sticky top-0 flex items-center justify-between border-b border-[var(--linea)] bg-[var(--lienzo)] px-8 py-4">
          <span className="rotulo">Ajustes</span>
          <button
            className="text-[18px] leading-none text-[var(--niebla)] transition-colors hover:text-[var(--tinta)]"
            onClick={onCerrar}
            aria-label="Cerrar ajustes"
          >
            ✕
          </button>
        </div>

        <div className="px-8 pb-16 pt-8">
          <div className="dato border-t-0 pt-0">
            <div className="rotulo mb-2">Inteligencia artificial</div>
            <div className="flex flex-wrap gap-2">
              {(estado?.proveedores ?? []).map((p) => (
                <button
                  key={p.id}
                  className={`filtro ${proveedor === p.id ? "filtro-activo" : ""}`}
                  onClick={() => {
                    setProveedor(p.id);
                    setModelo(p.modeloDefecto);
                    setClave("");
                    setError(null);
                  }}
                >
                  {p.nombre}
                </button>
              ))}
            </div>
            <p className="nota mt-3">
              {estado?.configurada ? (
                <span style={{ color: "var(--bosque)" }}>
                  Hay una clave guardada y funcionando para {estado.proveedorNombre}.
                </span>
              ) : (
                <span style={{ color: "var(--ocre)" }}>Todavía no hay ninguna clave.</span>
              )}{" "}
              {fichaElegida?.pista}
            </p>
            <input
              type="password"
              className="campo mt-3 w-full"
              placeholder={`Nueva clave de ${fichaElegida?.nombre ?? "IA"} (déjalo vacío para no cambiarla)`}
              value={clave}
              onChange={(e) => {
                setClave(e.target.value);
                setError(null);
              }}
            />
            {fichaElegida && (
              <p className="nota mt-2">
                <a className="enlace" href={fichaElegida.dondeSacarla} target="_blank" rel="noreferrer">
                  Sacar una clave de {fichaElegida.nombre} ↗
                </a>
              </p>
            )}
          </div>

          {fichaElegida && (
            <div className="dato">
              <div className="rotulo mb-3">Modelo de {fichaElegida.nombre}</div>
              <ElegirModelo
                proveedor={fichaElegida}
                elegido={modelo || fichaElegida.modeloDefecto}
                onElegir={(id) => {
                  setModelo(id);
                  setError(null);
                }}
              />
            </div>
          )}

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

          {error && fichaElegida && <Aviso bruto={error} proveedor={fichaElegida} />}

          <button className="btn mt-7 w-full" onClick={guardar} disabled={guardando}>
            {guardando ? "Comprobando…" : guardado ? "Guardado" : "Guardar"}
          </button>

          {!APP_PUBLICA && (
            <div className="filete mt-10 pt-6">
              <p className="rotulo mb-4">Trabajo en lote</p>
              <Trabajos />
            </div>
          )}

          {APP_PUBLICA && (
            <div className="filete mt-10 pt-6">
              <p className="rotulo mb-3">Tus datos en este navegador</p>
              <p className="nota mb-4">
                Puedes descargar una copia de tu perfil y expedientes o borrarlos de este
                navegador cuando quieras.
              </p>
              <div className="flex flex-wrap gap-3">
                <button className="btn btn-linea" onClick={exportarDatosPublicos}>
                  Descargar mis datos
                </button>
                <button
                  className="btn btn-linea"
                  onClick={() => {
                    if (!window.confirm("¿Borrar perfil, entrevistas, expedientes y clave de este navegador?")) return;
                    borrarDatosPublicos();
                    olvidarIaLocal();
                    router.push("/");
                    router.refresh();
                  }}
                >
                  Borrar mis datos
                </button>
              </div>
            </div>
          )}

          <p className="nota mt-8">
            {APP_PUBLICA
              ? "La clave se guarda en este navegador y se transmite cifrada solo cuando pides una operación de IA. Encaja no la conserva en su servidor."
              : "La clave se guarda en el Llavero de este Mac, no en el código ni en las copias de seguridad."}{" "}
            Antes de guardarla se prueba con una llamada real.
          </p>
        </div>
      </div>
    </>
  );
}
