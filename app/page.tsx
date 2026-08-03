"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import TarjetaAyuda from "./componentes/TarjetaAyuda";
import DetalleAyuda from "./componentes/DetalleAyuda";
import type { ConvUi } from "./componentes/tipos-ui";

interface EstadoSync {
  ultimo: string | null;
  total: number;
  pendientesDetalle: number;
  horas: number | null;
}

interface Ccaa {
  id: number;
  nombre: string;
}

const SEIS_HORAS = 6 * 60 * 60 * 1000;

export default function PaginaRadar() {
  const [ccaas, setCcaas] = useState<Ccaa[]>([]);
  const [region, setRegion] = useState<number | "">(54);
  const [cp, setCp] = useState("");
  const [zona, setZona] = useState<{ municipio: string; provincia: string } | null>(null);
  const [texto, setTexto] = useState("");
  const [estadoFiltro, setEstadoFiltro] = useState("");
  const [instrumento, setInstrumento] = useState("");
  const [filas, setFilas] = useState<ConvUi[]>([]);
  const [cargando, setCargando] = useState(true);
  const [sync, setSync] = useState<EstadoSync | null>(null);
  const [sincronizando, setSincronizando] = useState(false);
  const [abierta, setAbierta] = useState<string | null>(null);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inicializado = useRef(false);

  const cargarLista = useCallback(async () => {
    const q = new URLSearchParams();
    if (texto) q.set("texto", texto);
    if (estadoFiltro) q.set("estado", estadoFiltro);
    if (instrumento) q.set("instrumento", instrumento);
    if (region !== "") q.set("region", String(region));
    if (cp.length === 5) q.set("cp", cp);
    const r = await fetch(`/api/convocatorias?${q}`);
    const d = (await r.json()) as { filas: ConvUi[] };
    setFilas(d.filas ?? []);
    setCargando(false);
  }, [texto, estadoFiltro, instrumento, region, cp]);

  const refrescarSync = useCallback(async () => {
    const d = (await (await fetch("/api/sync")).json()) as Omit<EstadoSync, "horas">;
    const conHoras: EstadoSync = {
      ...d,
      horas: d.ultimo
        ? Math.floor((Date.now() - new Date(d.ultimo).getTime()) / 3_600_000)
        : null,
    };
    setSync(conHoras);
    return conHoras;
  }, []);

  const sincronizar = useCallback(
    async (regionId: number) => {
      setSincronizando(true);
      try {
        await fetch("/api/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ regionId }),
        });
      } finally {
        setSincronizando(false);
        await refrescarSync();
        await cargarLista();
      }
    },
    [refrescarSync, cargarLista],
  );

  // Arranque: ajustes guardados + auto-sync si hace >6h (elección de Victor:
  // sin cron — se actualiza al entrar o con el botón).
  useEffect(() => {
    if (inicializado.current) return;
    inicializado.current = true;
    (async () => {
      const aj = (await (await fetch("/api/ajustes")).json()) as {
        cp: string | null;
        ccaa: number;
      };
      if (aj.cp) setCp(aj.cp);
      if (aj.ccaa) setRegion(aj.ccaa);
      const s = await refrescarSync();
      const viejo = !s.ultimo || Date.now() - new Date(s.ultimo).getTime() > SEIS_HORAS;
      if (viejo) void sincronizar(aj.ccaa || 54);
    })();
  }, [refrescarSync, sincronizar]);

  // Recarga con debounce al cambiar filtros
  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => void cargarLista(), 250);
    return () => {
      if (debounce.current) clearTimeout(debounce.current);
    };
  }, [cargarLista]);

  // Resolver CP al vuelo (con CP incompleto no se enseña zona)
  useEffect(() => {
    if (cp.length !== 5) return;
    fetch(`/api/territorio?cp=${cp}`)
      .then((r) => r.json())
      .then((d: { zona: { municipio: string; provincia: string } | null }) => setZona(d.zona));
  }, [cp]);

  async function cambiarRegion(valor: string) {
    const nueva = valor === "" ? "" : Number(valor);
    setRegion(nueva);
    if (nueva !== "") {
      await fetch("/api/ajustes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ccaa: nueva }),
      });
      // Territorio recién elegido: sincroniza sus convocatorias si no las tenemos
      void sincronizar(nueva);
    }
  }

  const horasDesdeSync = sync?.horas ?? null;
  const zonaVisible = cp.length === 5 ? zona : null;

  return (
    <div>
      {/* ——— cabecera de mando ——— */}
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <div className="titulo-seccion mb-1">TERRITORIO</div>
          <select
            className="control"
            value={region}
            onChange={(e) => void cambiarRegion(e.target.value)}
          >
            <option value="">🇪🇸 Toda España (lo sincronizado)</option>
            {ccaas.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </select>
        </div>
        <div>
          <div className="titulo-seccion mb-1">TU CÓDIGO POSTAL</div>
          <input
            className="control w-32"
            placeholder="46183"
            maxLength={5}
            value={cp}
            onChange={(e) => setCp(e.target.value.replace(/\D/g, ""))}
          />
          {zonaVisible && (
            <span className="mono ml-2 text-[11px] text-[var(--cian)]">
              → {zonaVisible.municipio} · {zonaVisible.provincia}
            </span>
          )}
        </div>
        <div className="min-w-48 flex-1">
          <div className="titulo-seccion mb-1">BUSCAR</div>
          <input
            className="control w-full"
            placeholder="empleo, digitalización, eficiencia energética…"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
          />
        </div>
      </div>

      {/* ——— filtros rápidos ——— */}
      <div className="mt-3 flex flex-wrap gap-2">
        <Filtro activo={estadoFiltro === ""} onClick={() => setEstadoFiltro("")}>
          VIGENTES
        </Filtro>
        <Filtro activo={estadoFiltro === "urgentes"} onClick={() => setEstadoFiltro("urgentes")}>
          🔴 CIERRAN YA
        </Filtro>
        <Filtro activo={estadoFiltro === "abiertas"} onClick={() => setEstadoFiltro("abiertas")}>
          ABIERTAS
        </Filtro>
        <Filtro activo={estadoFiltro === "proximas"} onClick={() => setEstadoFiltro("proximas")}>
          ⏳ ABREN PRONTO
        </Filtro>
        <Filtro activo={estadoFiltro === "todas"} onClick={() => setEstadoFiltro("todas")}>
          TODAS
        </Filtro>
        <span className="mx-1 self-center text-[var(--borde)]">│</span>
        <Filtro activo={instrumento === ""} onClick={() => setInstrumento("")}>
          TODO TIPO
        </Filtro>
        <Filtro
          activo={instrumento === "SUBVENCIÓN"}
          onClick={() => setInstrumento("SUBVENCIÓN")}
        >
          € FONDO PERDIDO
        </Filtro>
        <Filtro activo={instrumento === "PRÉSTAMO"} onClick={() => setInstrumento("PRÉSTAMO")}>
          PRÉSTAMOS
        </Filtro>
      </div>

      {/* ——— banner de sincronización ——— */}
      <div className="tarjeta mt-4 flex flex-wrap items-center gap-3 px-4 py-3">
        {sincronizando ? (
          <>
            <div className="disco-radar girando" />
            <span className="mono text-[12px] tracking-widest text-[var(--cian)]">
              SINCRONIZANDO CON LA BDNS…
            </span>
          </>
        ) : (
          <>
            <span
              className={`mono text-[12px] ${
                horasDesdeSync != null && horasDesdeSync > 168
                  ? "text-[var(--rojo)]"
                  : "text-[var(--tinta2)]"
              }`}
            >
              {sync?.ultimo
                ? `Última actualización: hace ${
                    horasDesdeSync! < 1 ? "menos de 1 h" : `${horasDesdeSync} h`
                  } · ${sync.total.toLocaleString("es-ES")} convocatorias en tu radar`
                : "Aún sin datos: pulsa actualizar"}
              {sync && sync.pendientesDetalle > 0
                ? ` · ${sync.pendientesDetalle} detalles pendientes`
                : ""}
            </span>
            <button
              className="boton boton-fantasma mono ml-auto text-[11px] tracking-widest"
              onClick={() => void sincronizar(region === "" ? 54 : region)}
            >
              ⟳ ACTUALIZAR AHORA
            </button>
          </>
        )}
      </div>

      {/* ——— resultados ——— */}
      {cargando ? (
        <div className="mt-10 flex items-center justify-center gap-3 text-[var(--tinta2)]">
          <div className="disco-radar girando" /> Barriendo el radar…
        </div>
      ) : filas.length === 0 ? (
        <div className="mt-10 text-center text-[var(--tinta2)]">
          <div className="text-3xl">📡</div>
          <p className="mt-2">
            Nada en pantalla con estos filtros. Prueba a actualizar, cambiar de territorio o quitar
            filtros.
          </p>
        </div>
      ) : (
        <>
          <div className="mono mt-4 text-[11px] tracking-widest text-[var(--tinta2)]">
            {filas.length} AYUDAS EN PANTALLA · ORDENADAS POR CIERRE DE PLAZO
          </div>
          <div className="mt-2 grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
            {filas.map((c) => (
              <TarjetaAyuda key={c.codigoBdns} conv={c} onAbrir={setAbierta} />
            ))}
          </div>
        </>
      )}

      {abierta && (
        <DetalleAyuda key={abierta} codigo={abierta} onCerrar={() => setAbierta(null)} />
      )}
      <CargadorCcaas onCargar={setCcaas} />
    </div>
  );
}

function Filtro({
  activo,
  onClick,
  children,
}: {
  activo: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`chip cursor-pointer transition ${
        activo ? "border-[var(--lima)] text-[var(--lima)]" : "hover:text-[var(--tinta)]"
      }`}
    >
      {children}
    </button>
  );
}

function CargadorCcaas({ onCargar }: { onCargar: (c: Ccaa[]) => void }) {
  useEffect(() => {
    fetch("/api/territorio")
      .then((r) => r.json())
      .then((d: { ccaas: Ccaa[] }) => onCargar(d.ccaas));
  }, [onCargar]);
  return null;
}
