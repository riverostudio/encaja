"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import TarjetaAyuda from "./componentes/TarjetaAyuda";
import DetalleAyuda from "./componentes/DetalleAyuda";
import Esperando, { MENSAJES_RADAR, MENSAJES_SYNC } from "./componentes/Esperando";
import type { ConvUi, ResumenIaUi } from "./componentes/tipos-ui";

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

interface PrestacionUi {
  id: string;
  titular: string;
  que: string;
  quien: string;
  organismo: string;
  url: string;
}

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
  { clave: "FISCAL", texto: "Desgravaciones" },
];

// El filtro que más cambia el radar: no es lo mismo buscar para tu negocio
// que buscar para ti como persona.
const PARA_QUIEN = [
  { clave: "", texto: "Para cualquiera" },
  { clave: "PERSONAS FÍSICAS QUE NO DESARROLLAN", texto: "Para mí, como persona" },
  { clave: "PYME", texto: "Para mi negocio" },
];

// Atajos a lo que de verdad busca la gente. Rellenan el buscador.
const ATAJOS = [
  { texto: "Alquiler y vivienda", busca: "alquiler" },
  { texto: "Becas y estudios", busca: "beca" },
  { texto: "Comedor y libros", busca: "comedor" },
  { texto: "Luz, agua y gas", busca: "suministros" },
  { texto: "Emergencia social", busca: "emergencia social" },
  { texto: "Discapacidad y dependencia", busca: "discapacidad" },
  { texto: "Familia e infancia", busca: "familia" },
  { texto: "Desempleo", busca: "desempleo" },
  { texto: "Transporte", busca: "transporte" },
  { texto: "Rehabilitar la casa", busca: "rehabilitación" },
];

export default function PaginaRadar() {
  const [ccaas, setCcaas] = useState<Ccaa[]>([]);
  const [region, setRegion] = useState<number | "">(54);
  const [cp, setCp] = useState("");
  const [zona, setZona] = useState<{ municipio: string; provincia: string } | null>(null);
  const [texto, setTexto] = useState("");
  // Lo que se manda a buscar: para los atajos lleva sinónimos ("a|b|c"), pero
  // en la caja se enseña su nombre bonito, no la tripa.
  const [consulta, setConsulta] = useState("");
  const [estadoFiltro, setEstadoFiltro] = useState("");
  const [instrumento, setInstrumento] = useState("");
  const [paraQuien, setParaQuien] = useState("");
  const [soloAplicables, setSoloAplicables] = useState(true);
  const [filtrosAbiertos, setFiltrosAbiertos] = useState(false);
  const [atajos, setAtajos] = useState(ATAJOS);
  const [perfil, setPerfil] = useState<{
    resumen: string;
    progreso: { completo: boolean; respondidas: number };
  } | null>(null);
  const [prestaciones, setPrestaciones] = useState<PrestacionUi[]>([]);
  const [relajado, setRelajado] = useState<string | null>(null);
  const [traduciendo, setTraduciendo] = useState(0);
  const pedidas = useRef<Set<string>>(new Set());
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
    if (consulta) q.set("texto", consulta);
    if (estadoFiltro) q.set("estado", estadoFiltro);
    if (instrumento) q.set("instrumento", instrumento);
    if (paraQuien) q.set("beneficiario", paraQuien);
    if (region !== "") q.set("region", String(region));
    if (cp.length === 5) q.set("cp", cp);
    if (soloAplicables) q.set("soloAplicables", "1");
    const r = await fetch(`/api/convocatorias?${q}`);
    const d = (await r.json()) as { filas: ConvUi[]; relajado: string | null };
    setFilas(d.filas ?? []);
    setRelajado(d.relajado ?? null);
    setVisibles(POR_TANDA);
    pedidas.current.clear();
    setCargando(false);
  }, [consulta, estadoFiltro, instrumento, paraQuien, region, cp, soloAplicables]);

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
      const [aj, datosPerfil] = await Promise.all([
        fetch("/api/ajustes").then((r) => r.json()) as Promise<{ cp: string | null; ccaa: number }>,
        fetch("/api/perfil").then((r) => r.json()) as Promise<{
          beneficiario: string | null;
          resumen: string;
          atajos: { texto: string; busca: string }[];
          prestaciones: PrestacionUi[];
          progreso: { completo: boolean; respondidas: number };
        }>,
      ]);
      if (aj.cp) setCp(aj.cp);
      if (aj.ccaa) setRegion(aj.ccaa);
      // El perfil manda: el radar arranca filtrado a lo que le sirve a esta persona.
      if (datosPerfil.beneficiario) setParaQuien(datosPerfil.beneficiario);
      setPerfil(datosPerfil);
      if (datosPerfil.atajos?.length) setAtajos(datosPerfil.atajos);
      if (datosPerfil.prestaciones?.length) setPrestaciones(datosPerfil.prestaciones);
      // Solo se sincroniza si el archivo está vacío. A partir de ahí, manda
      // el botón: nada de re-descargar (ni de gastar IA) sin pedirlo.
      const s = await refrescarSync();
      if (s.total === 0) void sincronizar(aj.ccaa || 54);
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

  // Se traduce SOLO lo que tienes delante. Lo traducido queda guardado en tu
  // ordenador, así que al volver a verlo no cuesta ni una llamada más.
  useEffect(() => {
    const aLaVista = filas.slice(0, visibles);
    const faltan = aLaVista
      .filter((c) => !c.resumen && !pedidas.current.has(c.codigoBdns))
      .map((c) => c.codigoBdns);
    if (faltan.length === 0) return;

    let cancelado = false;
    (async () => {
      // De ocho en ocho: se ve cómo van apareciendo y se puede irse de la página.
      for (let i = 0; i < faltan.length && !cancelado; i += 8) {
        const trozo = faltan.slice(i, i + 8);
        trozo.forEach((c) => pedidas.current.add(c));
        setTraduciendo((n) => n + trozo.length);
        try {
          const r = await fetch("/api/resumen/lote", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ codigos: trozo }),
          });
          const d = (await r.json()) as { resumenes: Record<string, ResumenIaUi> };
          if (cancelado) return;
          setFilas((antes) =>
            antes.map((c) => (d.resumenes[c.codigoBdns] ? { ...c, resumen: d.resumenes[c.codigoBdns] } : c)),
          );
        } catch {
          // Si falla, se reintenta la próxima vez que aparezca en pantalla.
          trozo.forEach((c) => pedidas.current.delete(c));
        } finally {
          setTraduciendo((n) => Math.max(0, n - trozo.length));
        }
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [filas, visibles]);

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

  async function sincronizarEspana() {
    setSincronizando(true);
    try {
      await fetch("/api/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ todaEspana: true }),
      });
    } finally {
      setSincronizando(false);
      await refrescarSync();
      await cargarLista();
    }
  }

  async function cambiarRegion(valor: string) {
    const nueva = valor === "" ? "" : Number(valor);
    setRegion(nueva);
    if (nueva === "") {
      // "Toda España" solo sirve si están las 19 comunidades traídas.
      void sincronizarEspana();
      return;
    }
    {
      await fetch("/api/ajustes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ccaa: nueva }),
      });
      void sincronizar(nueva);
    }
  }

  // Datos reales de tu radar para que la espera cuente algo útil.
  const sabias = (() => {
    const frases: string[] = [];
    const urgentes = filas.filter((f) => f.plazo.estado === "urgente").length;
    const locales = filas.filter((f) => f.nivel1 === "LOCAL").length;
    const proximas = filas.filter((f) => f.plazo.estado === "proxima").length;
    if (urgentes > 0) {
      frases.push(
        `${urgentes} de tus ayudas cierran esta semana. Son las primeras de la lista, en rojo.`,
      );
    }
    if (proximas > 0) frases.push(`${proximas} todavía no han abierto: puedes ir preparándolas.`);
    if (locales > 0 && zona) {
      frases.push(`${locales} las convoca tu propio ayuntamiento o tu diputación en ${zona.municipio}.`);
    }
    frases.push(
      "Por ley, toda ayuda pública de España pasa por la Base de Datos Nacional de Subvenciones antes de abrir plazo. Por eso no se escapa ninguna.",
      "El importe que ves es la bolsa de todo el programa, no lo que te llevarías tú.",
      "Cuando una te interese, pulsa «¿Encajo?»: leo las bases y te digo si cumples, citando el texto legal.",
      "Lo que respondas se guarda en tu perfil, así que cada ayuda nueva te pregunta menos que la anterior.",
    );
    return frases;
  })();

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
          onChange={(e) => {
            setTexto(e.target.value);
            setConsulta(e.target.value);
          }}
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

      {/* ——— aviso: sin perfil, esto es un cajón de sastre ——— */}
      {perfil && !perfil.progreso.completo && (
        <div
          className="sube mt-8 flex flex-wrap items-center gap-4 rounded-lg border p-4"
          style={{ borderColor: "var(--ocre)", background: "var(--lienzo-alto)" }}
        >
          <span className="flex-1 text-[13.5px] leading-relaxed">
            <strong className="display text-[16px]">
              {perfil.progreso.respondidas === 0
                ? "Aún no sé nada de ti"
                : "Te falta terminar tu perfil"}
            </strong>
            <span className="mt-1 block text-[var(--grafito)]">
              Contéstame ocho preguntas y el radar te enseña solo las ayudas que tú puedes pedir, y
              con los atajos que te sirven a ti.
            </span>
          </span>
          <Link href="/ficha" className="btn shrink-0">
            {perfil.progreso.respondidas === 0 ? "Empezar" : "Terminar"}
          </Link>
        </div>
      )}

      {perfil?.progreso.completo && (
        <p className="mt-7 text-[13px] text-[var(--grafito)]">
          {perfil.resumen}.{" "}
          <Link href="/ficha" className="enlace">
            Cambiar mi perfil
          </Link>
        </p>
      )}

      {/* ——— atajos: los del perfil si lo hay, los generales si no ——— */}
      <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2">
        <span className="rotulo">{perfil?.progreso.completo ? "Para ti" : "Atajos"}</span>
        {atajos.map((a) => (
          <button
            key={a.busca}
            className={`filtro ${consulta === a.busca ? "filtro-activo" : ""}`}
            onClick={() => {
              const quitar = consulta === a.busca;
              setTexto(quitar ? "" : a.texto);
              setConsulta(quitar ? "" : a.busca);
            }}
          >
            {a.texto}
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
              {traduciendo > 0 && (
                <span className="ml-3 inline-flex items-center gap-2">
                  <span className="pulso" /> traduciendo {traduciendo}…
                </span>
              )}
            </>
          )}
        </p>
        <p className="flex items-center gap-4 text-[12.5px]">
          <button className="filtro" onClick={() => setFiltrosAbiertos(!filtrosAbiertos)}>
            {filtrosAbiertos ? "Ocultar filtros" : "Filtros"}
          </button>
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

      {/* ——— lo que NO está en la BDNS pero te puede tocar ——— */}
      {prestaciones.length > 0 && !texto && (
        <div className="mt-6">
          <p className="rotulo mb-1">Además, esto te puede corresponder por derecho</p>
          <p className="nota mb-3 max-w-2xl">
            No son convocatorias con plazo, así que no salen en el radar: son prestaciones que se
            piden cuando cumples los requisitos, sin fecha límite.
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {prestaciones.map((p, i) => (
              <a
                key={p.id}
                href={p.url}
                target="_blank"
                rel="noreferrer"
                className="tarjeta entra !p-4"
                style={{ "--acento": "var(--bosque)", "--i": i } as React.CSSProperties}
              >
                <span className="rotulo">{p.organismo}</span>
                <span className="display mt-2 block text-[16px] leading-snug">{p.titular}</span>
                <span className="mt-1.5 line-clamp-3 block text-[12.5px] leading-relaxed text-[var(--grafito)]">
                  {p.que}
                </span>
                <span className="mt-auto flex items-baseline justify-between pt-3">
                  <span className="rotulo">sin plazo</span>
                  <span className="flecha text-[13px] text-[var(--grafito)]">ir ↗</span>
                </span>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* ——— filtros, plegados para no hacer ruido ——— */}
      {filtrosAbiertos && (
        <div
          className="sube mt-4 rounded-lg border p-4"
          style={{ borderColor: "var(--linea)", background: "var(--lienzo-alto)" }}
        >
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <span className="rotulo w-[70px]">Plazo</span>
            {ESTADOS.map((e) => (
              <button
                key={e.clave}
                className={`filtro ${estadoFiltro === e.clave ? "filtro-activo" : ""}`}
                onClick={() => setEstadoFiltro(e.clave)}
              >
                {e.texto}
              </button>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2">
            <span className="rotulo w-[70px]">Tipo</span>
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
          <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2">
            <span className="rotulo w-[70px]">Buscas</span>
            {PARA_QUIEN.map((q) => (
              <button
                key={q.clave}
                className={`filtro ${paraQuien === q.clave ? "filtro-activo" : ""}`}
                onClick={() => setParaQuien(q.clave)}
              >
                {q.texto}
              </button>
            ))}
            {perfil?.progreso.completo && (
              <button
                className={`filtro ${soloAplicables ? "filtro-activo" : ""}`}
                onClick={() => setSoloAplicables(!soloAplicables)}
              >
                {soloAplicables ? "Solo las que puedo pedir" : "Enseñándome todas"}
              </button>
            )}
          </div>
        </div>
      )}

      {/* ——— por qué estás viendo esto y no otra cosa ——— */}
      {relajado && filas.length > 0 && (
        <div
          className="sube mt-5 rounded-lg border p-4"
          style={{ borderColor: "var(--ocre)", background: "var(--lienzo-alto)" }}
        >
          <p className="text-[13.5px] leading-relaxed">
            <strong className="display text-[15px]">
              {relajado === "perfil" && "Con tu perfil exacto no encaja ninguna"}
              {relajado === "beneficiario" && "Ninguna de estas va dirigida a particulares"}
              {relajado === "plazo" && "Todas las de esta búsqueda han cerrado ya"}
            </strong>
            <span className="mt-1 block text-[var(--grafito)]">
              {relajado === "perfil" &&
                "Te enseño igualmente las que hay, por si alguna te sirve. Entra en cualquiera y pulsa «¿Encajo?» para saber por qué se descartaba."}
              {relajado === "beneficiario" &&
                "Suelen concederse a asociaciones o a autónomos, que después atienden a las personas. Te las enseño por si conoces alguna entidad, o por si te interesa como autónomo."}
              {relajado === "plazo" &&
                "Te las enseño marcadas como cerradas porque casi todas se repiten cada año: sirven para saber qué pedir y cuándo estar atento."}
            </span>
          </p>
        </div>
      )}

      {/* ——— rejilla ——— */}
      {cargando || sincronizando ? (
        <Esperando
          mensajes={sincronizando ? MENSAJES_SYNC : MENSAJES_RADAR}
          sabias={sabias}
        />
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


function CargadorCcaas({ onCargar }: { onCargar: (c: Ccaa[]) => void }) {
  useEffect(() => {
    fetch("/api/territorio")
      .then((r) => r.json())
      .then((d: { ccaas: Ccaa[] }) => onCargar(d.ccaas));
  }, [onCargar]);
  return null;
}
