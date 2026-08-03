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
const POR_TANDA = 60;

const ESTADOS = [
  { clave: "", texto: "Vigentes" },
  { clave: "urgentes", texto: "Cierran ya" },
  { clave: "abiertas", texto: "Abiertas" },
  { clave: "proximas", texto: "Abren pronto" },
  { clave: "todas", texto: "Todas" },
];

const TIPOS = [
  { clave: "", texto: "Todo tipo" },
  { clave: "SUBVENCIÓN", texto: "Fondo perdido" },
  { clave: "PRÉSTAMO", texto: "Préstamos" },
];

export default function PaginaRadar() {
  const [ccaas, setCcaas] = useState<Ccaa[]>([]);
  const [region, setRegion] = useState<number | "">(54);
  const [cp, setCp] = useState("");
  const [zona, setZona] = useState<{ municipio: string; provincia: string } | null>(null);
  const [texto, setTexto] = useState("");
  const [estadoFiltro, setEstadoFiltro] = useState("");
  const [instrumento, setInstrumento] = useState("");
  const [filas, setFilas] = useState<ConvUi[]>([]);
  const [visibles, setVisibles] = useState(POR_TANDA);
  const [cargando, setCargando] = useState(true);
  const [sync, setSync] = useState<EstadoSync | null>(null);
  const [sincronizando, setSincronizando] = useState(false);
  const [abierta, setAbierta] = useState<string | null>(null);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inicializado = useRef(false);
  const centinela = useRef<HTMLDivElement | null>(null);

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
    setVisibles(POR_TANDA);
    setCargando(false);
  }, [texto, estadoFiltro, instrumento, region, cp]);

  const refrescarSync = useCallback(async () => {
    const d = (await (await fetch("/api/sync")).json()) as Omit<EstadoSync, "horas">;
    const conHoras: EstadoSync = {
      ...d,
      horas: d.ultimo ? Math.floor((Date.now() - new Date(d.ultimo).getTime()) / 3_600_000) : null,
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

  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => void cargarLista(), 250);
    return () => {
      if (debounce.current) clearTimeout(debounce.current);
    };
  }, [cargarLista]);

  useEffect(() => {
    if (cp.length !== 5) return;
    fetch(`/api/territorio?cp=${cp}`)
      .then((r) => r.json())
      .then((d: { zona: { municipio: string; provincia: string } | null }) => setZona(d.zona));
  }, [cp]);

  // Scroll infinito: más tarjetas cuando el centinela entra en pantalla.
  useEffect(() => {
    const nodo = centinela.current;
    if (!nodo) return;
    const obs = new IntersectionObserver(
      (entradas) => {
        if (entradas[0].isIntersecting) setVisibles((v) => v + POR_TANDA);
      },
      { rootMargin: "600px" },
    );
    obs.observe(nodo);
    return () => obs.disconnect();
  }, [filas.length]);

  async function cambiarRegion(valor: string) {
    const nueva = valor === "" ? "" : Number(valor);
    setRegion(nueva);
    if (nueva !== "") {
      await fetch("/api/ajustes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ccaa: nueva }),
      });
      void sincronizar(nueva);
    }
  }

  const zonaVisible = cp.length === 5 ? zona : null;
  const desactualizado = sync?.horas != null && sync.horas > 168;
  const enPantalla = filas.slice(0, visibles);

  return (
    <div>
      {/* ——— buscador ——— */}
      <div className="busqueda">
        <input
          className="campo display w-full !border-b-0 !text-[28px] leading-tight"
          placeholder="Busca una ayuda…"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
        />
        <div className="h-px w-full bg-[var(--linea)]" />
      </div>

      {/* ——— territorio ——— */}
      <div className="mt-7 flex flex-wrap items-end gap-x-10 gap-y-5">
        <label className="block">
          <span className="rotulo mb-1.5 block">Comunidad</span>
          <select
            className="campo min-w-[220px]"
            value={region}
            onChange={(e) => void cambiarRegion(e.target.value)}
          >
            <option value="">Toda España</option>
            {ccaas.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="rotulo mb-1.5 block">Código postal</span>
          <span className="flex items-baseline gap-3">
            <input
              className="campo cifra w-[70px]"
              placeholder="—"
              maxLength={5}
              value={cp}
              onChange={(e) => setCp(e.target.value.replace(/\D/g, ""))}
            />
            <span className="text-[13px] text-[var(--grafito)] transition-opacity">
              {zonaVisible
                ? `${zonaVisible.municipio}, ${zonaVisible.provincia}`
                : cp.length === 5
                  ? "sin resultado"
                  : "para ver lo de tu pueblo"}
            </span>
          </span>
        </label>
      </div>

      {/* ——— filtros ——— */}
      <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-3">
        {ESTADOS.map((e) => (
          <button
            key={e.clave}
            className={`filtro ${estadoFiltro === e.clave ? "filtro-activo" : ""}`}
            onClick={() => setEstadoFiltro(e.clave)}
          >
            {e.texto}
          </button>
        ))}
        <span className="text-[var(--linea-fuerte)]">/</span>
        {TIPOS.map((t) => (
          <button
            key={t.clave}
            className={`filtro ${instrumento === t.clave ? "filtro-activo" : ""}`}
            onClick={() => setInstrumento(t.clave)}
          >
            {t.texto}
          </button>
        ))}
      </div>

      {/* ——— estado ——— */}
      <div className="mt-8 flex flex-wrap items-baseline justify-between gap-3">
        <p className="text-[12.5px] text-[var(--niebla)]">
          {cargando ? (
            <span className="inline-flex items-center gap-2">
              <span className="pulso" /> Consultando el archivo…
            </span>
          ) : (
            <>
              <span className="cifra text-[var(--grafito)]">{filas.length}</span> ayudas · las que
              antes cierran, primero
            </>
          )}
        </p>
        <p className="text-[12.5px]">
          {sincronizando ? (
            <span className="inline-flex items-center gap-2 text-[var(--niebla)]">
              <span className="pulso" /> Sincronizando con la BDNS…
            </span>
          ) : (
            <>
              <span className={desactualizado ? "text-[var(--senal)]" : "text-[var(--niebla)]"}>
                {sync?.ultimo
                  ? `${sync.total.toLocaleString("es-ES")} en el archivo · actualizado ${
                      sync.horas! < 1 ? "hace un momento" : `hace ${sync.horas} h`
                    }`
                  : "archivo vacío"}
              </span>{" "}
              <button
                className="btn-texto ml-2"
                onClick={() => void sincronizar(region === "" ? 54 : region)}
              >
                Actualizar
              </button>
            </>
          )}
        </p>
      </div>

      {/* ——— rejilla ——— */}
      {cargando ? (
        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            <Esqueleto key={i} indice={i} />
          ))}
        </div>
      ) : filas.length === 0 ? (
        <div className="filete mt-6 py-24 text-center">
          <p className="display text-[20px]">Nada con estos filtros.</p>
          <p className="nota mx-auto mt-2 max-w-sm">
            Prueba a vaciar el buscador, cambiar de comunidad o pulsar «Actualizar» para traer lo
            último de la BDNS.
          </p>
        </div>
      ) : (
        <>
          <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {enPantalla.map((c, i) => (
              <TarjetaAyuda
                key={c.codigoBdns}
                conv={c}
                indice={i % POR_TANDA}
                onAbrir={setAbierta}
              />
            ))}
          </div>
          <div ref={centinela} className="h-px" />
          {visibles < filas.length && (
            <p className="mt-8 text-center text-[12.5px] text-[var(--niebla)]">
              <span className="pulso mr-2" />
              {filas.length - visibles} más abajo
            </p>
          )}
        </>
      )}

      {abierta && (
        <DetalleAyuda key={abierta} codigo={abierta} onCerrar={() => setAbierta(null)} />
      )}
      <CargadorCcaas onCargar={setCcaas} />
    </div>
  );
}

function Esqueleto({ indice }: { indice: number }) {
  return (
    <div
      className="tarjeta entra !cursor-default"
      style={{ "--i": indice } as React.CSSProperties}
    >
      <div className="esqueleto h-9 w-16" />
      <div className="esqueleto mt-3 h-2.5 w-12" />
      <div className="esqueleto mt-6 h-3.5 w-full" />
      <div className="esqueleto mt-2 h-3.5 w-11/12" />
      <div className="esqueleto mt-2 h-3.5 w-2/3" />
      <div className="esqueleto mt-6 h-3 w-1/3" />
    </div>
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
