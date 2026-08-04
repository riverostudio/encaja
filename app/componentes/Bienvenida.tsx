"use client";

import { useState } from "react";

export interface ModeloUi {
  id: string;
  nombre: string;
  nota: string;
  tipo: "potente" | "barato";
}

export interface ProveedorUi {
  id: string;
  nombre: string;
  quien: string;
  modeloDefecto: string;
  modelos: ModeloUi[];
  leePdf: boolean;
  dondeSacarla: string;
  pista: string;
}

/** Los cuatro modelos del proveedor, agrupados por para qué sirven. */
export function ElegirModelo({
  proveedor,
  elegido,
  onElegir,
}: {
  proveedor: ProveedorUi;
  elegido: string;
  onElegir: (id: string) => void;
}) {
  const grupos = [
    { tipo: "potente" as const, titulo: "Los que mejor lo hacen" },
    { tipo: "barato" as const, titulo: "Los que salen más baratos" },
  ];
  return (
    <div className="space-y-5">
      {grupos.map((g) => (
        <div key={g.tipo}>
          <p className="rotulo mb-2">{g.titulo}</p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {proveedor.modelos
              .filter((m) => m.tipo === g.tipo)
              .map((m) => {
                const activo = m.id === elegido;
                return (
                  <button
                    key={m.id}
                    className="opcion !w-full !py-3 !text-left !text-[15px]"
                    style={{
                      borderColor: activo ? "var(--tinta)" : undefined,
                      boxShadow: activo ? "inset 0 0 0 1px var(--tinta)" : undefined,
                    }}
                    onClick={() => onElegir(m.id)}
                  >
                    {m.nombre}
                    <span className="mt-0.5 block font-sans text-[12px] text-[var(--niebla)]">
                      {m.nota}
                    </span>
                  </button>
                );
              })}
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * La puerta: sin una clave de IA la app no puede leer las bases ni decirte
 * si encajas, así que se pide antes de entrar. Vale la de cualquiera de los
 * tres proveedores — el que ya tengas.
 */
export default function Bienvenida({
  proveedores,
  onListo,
}: {
  proveedores: ProveedorUi[];
  onListo: () => void;
}) {
  const [elegido, setElegido] = useState<ProveedorUi>(proveedores[0]);
  const [clave, setClave] = useState("");
  const [modelo, setModelo] = useState("");
  const [probando, setProbando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function entrar() {
    setProbando(true);
    setError(null);
    try {
      const r = await fetch("/api/ajustes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          proveedor: elegido.id,
          clave: clave.trim(),
          modelo: modelo.trim() || undefined,
        }),
      });
      const d = (await r.json()) as { error?: string };
      if (!r.ok) setError(d.error ?? "");
      else onListo();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setProbando(false);
    }
  }

  return (
    <div className="escenario">
      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center px-6 py-16">
        <div className="sube">
          <p className="rotulo">Encaja · ayudas públicas de España</p>
          <h1 className="display mt-3 text-[38px] leading-[1.1]">
            Todas las subvenciones públicas de España, explicadas en cristiano.
          </h1>
          <p className="mt-4 max-w-lg text-[15px] leading-relaxed text-[var(--grafito)]">
            Para traducirte el lenguaje del BOE, leer las bases de cada convocatoria y decirte si
            puedes pedirla, la app necesita una inteligencia artificial. Pon la clave de la que ya
            uses: no hace falta que sea ninguna en concreto.
          </p>
        </div>

        {/* ——— elegir proveedor ——— */}
        <div className="sube mt-10" style={{ "--i": 1 } as React.CSSProperties}>
          <p className="rotulo mb-3">¿Cuál usas?</p>
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
            {proveedores.map((p, i) => {
              const activo = p.id === elegido.id;
              return (
                <button
                  key={p.id}
                  className="opcion sube !w-full !py-4 !text-left"
                  style={
                    {
                      "--i": i + 2,
                      borderColor: activo ? "var(--tinta)" : undefined,
                      boxShadow: activo ? "inset 0 0 0 1px var(--tinta)" : undefined,
                    } as React.CSSProperties
                  }
                  onClick={() => {
                    setElegido(p);
                    setModelo("");
                    setError(null);
                  }}
                >
                  {p.nombre}
                  <span className="mt-0.5 block font-sans text-[12px] text-[var(--niebla)]">
                    {p.quien}
                  </span>
                </button>
              );
            })}
          </div>
          <p className="nota mt-3">{elegido.pista}</p>
        </div>

        {/* ——— la clave ——— */}
        <div className="sube mt-8" style={{ "--i": 3 } as React.CSSProperties}>
          <label className="block">
            <span className="rotulo mb-2 block">Tu clave de {elegido.nombre}</span>
            <input
              autoFocus
              type="password"
              className="campo w-full !text-[18px]"
              placeholder="Pégala aquí"
              value={clave}
              onChange={(e) => {
                setClave(e.target.value);
                setError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && clave.trim()) void entrar();
              }}
            />
          </label>
          <p className="nota mt-2">
            ¿No tienes?{" "}
            <a className="enlace" href={elegido.dondeSacarla} target="_blank" rel="noreferrer">
              Sácala aquí ↗
            </a>{" "}
            · Se guarda solo en este ordenador y nunca sale de él.
          </p>
        </div>

        <div className="sube mt-8" style={{ "--i": 4 } as React.CSSProperties}>
          <p className="rotulo mb-3">¿Qué modelo de {elegido.nombre}?</p>
          <ElegirModelo
            proveedor={elegido}
            elegido={modelo || elegido.modeloDefecto}
            onElegir={(id) => {
              setModelo(id);
              setError(null);
            }}
          />
          <p className="nota mt-3">
            Si tu cuenta no tiene alguno, te lo diré al comprobar la clave y eliges otro.
          </p>
        </div>

        {error && <Aviso bruto={error} proveedor={elegido} />}

        <div className="sube mt-9" style={{ "--i": 5 } as React.CSSProperties}>
          <button className="btn !px-8 !py-3.5 !text-[15px]" onClick={entrar} disabled={!clave.trim() || probando}>
            {probando ? "Comprobando la clave…" : "Entrar"}
          </button>
          {probando && (
            <p className="mt-3 flex items-center gap-2 text-[13px] text-[var(--niebla)]">
              <span className="pulso" /> Haciendo una llamada de prueba a {elegido.nombre}…
            </p>
          )}
        </div>

        <p className="nota mt-12 max-w-lg">
          Los datos de las ayudas vienen de la Base de Datos Nacional de Subvenciones y son
          gratuitos. La clave solo se usa para traducir y explicar; esta herramienta nunca firma ni
          presenta solicitudes en tu nombre.
        </p>
      </div>
    </div>
  );
}

/** El error, contado como se lo contarías a alguien por teléfono. */
export function Aviso({ bruto, proveedor }: { bruto: string; proveedor: ProveedorUi }) {
  const { titulo, detalle, arreglo } = traducirError(bruto, proveedor);
  return (
    <div
      className="sube mt-7 rounded-lg border p-5"
      style={{ borderColor: "var(--senal)", background: "var(--lienzo-alto)" }}
    >
      <div className="flex items-start gap-4">
        <span
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full border text-[16px]"
          style={{ borderColor: "var(--senal)", color: "var(--senal)" }}
          aria-hidden
        >
          !
        </span>
        <div className="min-w-0">
          <p className="display text-[19px] leading-snug" style={{ color: "var(--senal)" }}>
            {titulo}
          </p>
          <p className="mt-1.5 text-[14px] leading-relaxed">{detalle}</p>
          <p className="mt-2 text-[13.5px] leading-relaxed text-[var(--grafito)]">{arreglo}</p>
        </div>
      </div>
    </div>
  );
}

interface ErrorLegible {
  titulo: string;
  detalle: string;
  arreglo: string;
}

function traducirError(bruto: string, p: ProveedorUi): ErrorLegible {
  const nombre = `${p.nombre} (${p.quien})`;

  if (bruto.startsWith("CLAVE_INVALIDA")) {
    return {
      titulo: "Esa clave no es válida",
      detalle: `${nombre} no la reconoce como suya.`,
      arreglo:
        "Suele ser que falta un trozo al copiarla, que se ha colado un espacio, o que es la clave de otro proveedor. Cópiala entera desde su web y pégala otra vez.",
    };
  }
  if (bruto.startsWith("LIMITE")) {
    return {
      titulo: "La clave es buena, pero está sin cuota",
      detalle: `${nombre} dice que tu cuenta ha agotado su límite de uso.`,
      arreglo:
        "Espera un rato, revisa el saldo o el plan de tu cuenta, o entra con la clave de otro proveedor: aquí valen los tres.",
    };
  }
  if (bruto.startsWith("MODELO")) {
    return {
      titulo: "Ese modelo no existe en tu cuenta",
      detalle: `${nombre} no tiene un modelo con ese nombre, o tu cuenta no tiene acceso a él.`,
      arreglo: `Borra lo que has escrito en «Quiero elegir el modelo» para usar ${p.modeloDefecto}, que es el que va bien.`,
    };
  }
  if (bruto.includes("fetch") || bruto.includes("ENOTFOUND") || bruto.includes("network")) {
    return {
      titulo: "No he podido conectar",
      detalle: `No hay forma de llegar a ${nombre} desde este ordenador.`,
      arreglo: "Comprueba tu conexión a internet y vuelve a darle a Entrar.",
    };
  }
  return {
    titulo: "Algo ha fallado al comprobar la clave",
    detalle: bruto || "El proveedor no ha dicho por qué.",
    arreglo: "Inténtalo otra vez; si sigue igual, prueba con la clave de otro proveedor.",
  };
}
