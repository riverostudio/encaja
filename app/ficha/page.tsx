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
  { clave: "cp", ayuda: "código postal (activa lo local)" },
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
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold">Mi ficha</h1>
      <p className="mt-1 text-[14px] text-[var(--tinta2)]">
        Todo lo que la app ya sabe de ti. Cada entrevista añade datos aquí, y cuantos más haya,
        menos te pregunta. Si borras uno, la próxima entrevista volverá a preguntarlo.
      </p>

      <div className="tarjeta mt-5 p-4">
        <div className="titulo-seccion mb-3">AÑADIR / CORREGIR UN DATO</div>
        <form
          className="flex flex-wrap gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (clave.trim()) void guardar(clave.trim(), valor.trim());
          }}
        >
          <input
            className="control mono flex-1"
            list="claves"
            placeholder="clave (ej: tipo_actividad)"
            value={clave}
            onChange={(e) => setClave(e.target.value)}
          />
          <datalist id="claves">
            {SUGERENCIAS.map((s) => (
              <option key={s.clave} value={s.clave}>
                {s.ayuda}
              </option>
            ))}
          </datalist>
          <input
            className="control flex-1"
            placeholder="valor"
            value={valor}
            onChange={(e) => setValor(e.target.value)}
          />
          <button className="boton boton-lima" type="submit">
            GUARDAR
          </button>
        </form>
        <div className="mt-3 flex flex-wrap gap-2">
          {SUGERENCIAS.filter((s) => !usadas.has(s.clave)).map((s) => (
            <button
              key={s.clave}
              className="chip cursor-pointer hover:text-[var(--tinta)]"
              title={s.ayuda}
              onClick={() => setClave(s.clave)}
            >
              + {s.clave}
            </button>
          ))}
        </div>
      </div>

      {hechos.length === 0 ? (
        <div className="mt-8 text-center text-[var(--tinta2)]">
          <div className="text-3xl">🗂️</div>
          <p className="mt-2">
            Ficha vacía. Se irá rellenando sola con las entrevistas de «¿Encajo?».
          </p>
        </div>
      ) : (
        <div className="mt-5 space-y-2">
          {hechos.map((h) => (
            <div key={h.clave} className="tarjeta flex items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <div className="mono text-[12px] tracking-wider text-[var(--cian)]">{h.clave}</div>
                <div className="truncate text-[15px] font-semibold">{h.valor}</div>
                <div className="text-[11px] text-[var(--tinta2)]">
                  {h.fuente} · {h.updatedAt.slice(0, 10)}
                </div>
              </div>
              <button
                className="boton boton-fantasma"
                title="Borrar (volverá a preguntarse)"
                onClick={() => void borrar(h.clave)}
              >
                🗑
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
