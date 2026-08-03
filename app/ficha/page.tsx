"use client";

import { useEffect, useState } from "react";

interface Hecho {
  clave: string;
  valor: string;
  fuente: string;
  updatedAt: string;
}

const SUGERENCIAS: { clave: string; ayuda: string }[] = [
  { clave: "tipo_actividad", ayuda: "autonomo · pyme · particular" },
  { clave: "cp", ayuda: "código postal" },
  { clave: "municipio", ayuda: "tu municipio" },
  { clave: "cnae_letras", ayuda: "letras CNAE, ej: R,S" },
  { clave: "num_empleados", ayuda: "empleados en plantilla" },
  { clave: "al_corriente_hacienda", ayuda: "sí / no" },
  { clave: "al_corriente_ss", ayuda: "sí / no" },
  { clave: "facturacion_anual", ayuda: "en euros" },
];

export default function PaginaFicha() {
  const [hechos, setHechos] = useState<Hecho[]>([]);
  const [clave, setClave] = useState("");
  const [valor, setValor] = useState("");

  useEffect(() => {
    fetch("/api/ficha")
      .then((r) => r.json())
      .then((d: { hechos: Hecho[] }) => setHechos(d.hechos));
  }, []);

  async function guardar(c: string, v: string) {
    const r = await fetch("/api/ficha", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clave: c, valor: v }),
    });
    const d = (await r.json()) as { hechos: Hecho[] };
    setHechos(d.hechos);
    setClave("");
    setValor("");
  }

  async function borrar(c: string) {
    const r = await fetch(`/api/ficha?clave=${encodeURIComponent(c)}`, { method: "DELETE" });
    const d = (await r.json()) as { hechos: Hecho[] };
    setHechos(d.hechos);
  }

  const usadas = new Set(hechos.map((h) => h.clave));

  return (
    <div className="max-w-2xl">
      <h1 className="display text-[32px] leading-tight">Mi ficha</h1>
      <p className="nota mt-2 max-w-lg">
        Todo lo que el radar ya sabe de ti. Cada entrevista añade datos aquí, y cuantos más haya
        menos te pregunta. Si borras uno, la próxima entrevista volverá a preguntarlo.
      </p>

      <form
        className="mt-10 flex flex-wrap items-end gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (clave.trim()) void guardar(clave.trim(), valor.trim());
        }}
      >
        <label className="block">
          <span className="rotulo mb-1.5 block">Dato</span>
          <input
            className="campo cifra w-[200px]"
            list="claves"
            placeholder="tipo_actividad"
            value={clave}
            onChange={(e) => setClave(e.target.value)}
          />
        </label>
        <datalist id="claves">
          {SUGERENCIAS.map((s) => (
            <option key={s.clave} value={s.clave}>
              {s.ayuda}
            </option>
          ))}
        </datalist>
        <label className="block flex-1">
          <span className="rotulo mb-1.5 block">Valor</span>
          <input
            className="campo w-full"
            placeholder="autonomo"
            value={valor}
            onChange={(e) => setValor(e.target.value)}
          />
        </label>
        <button className="btn" type="submit">
          Guardar
        </button>
      </form>

      {SUGERENCIAS.filter((s) => !usadas.has(s.clave)).length > 0 && (
        <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2">
          <span className="rotulo">Sugerencias</span>
          {SUGERENCIAS.filter((s) => !usadas.has(s.clave)).map((s) => (
            <button
              key={s.clave}
              className="filtro cifra"
              title={s.ayuda}
              onClick={() => setClave(s.clave)}
            >
              {s.clave}
            </button>
          ))}
        </div>
      )}

      {hechos.length === 0 ? (
        <p className="filete mt-10 py-16 text-center text-[14px] text-[var(--niebla)]">
          Ficha vacía. Se irá rellenando sola con las entrevistas.
        </p>
      ) : (
        <div className="mt-10">
          {hechos.map((h) => (
            <div key={h.clave} className="dato flex items-baseline gap-6">
              <span className="rotulo cifra w-[170px] shrink-0">{h.clave}</span>
              <span className="display flex-1 text-[17px]">{h.valor}</span>
              <span className="text-[11.5px] text-[var(--niebla)]">{h.fuente}</span>
              <button
                className="text-[12px] text-[var(--niebla)] transition-colors hover:text-[var(--senal)]"
                title="Borrar: volverá a preguntarse"
                onClick={() => void borrar(h.clave)}
              >
                borrar
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
