"use client";

import {
  importeCortoUi,
  nivelBonito,
  plazoVisual,
  SELLO,
  tipoAyuda,
  type ConvUi,
} from "./tipos-ui";

/**
 * Tarjeta de ayuda en dos idiomas: arriba el título oficial tal cual lo
 * publica el BOE, y debajo lo que significa de verdad. El plazo manda,
 * y se enseña con fechas de calendario, no con un número suelto.
 */
export default function TarjetaAyuda({
  conv,
  indice,
  onAbrir,
}: {
  conv: ConvUi;
  indice: number;
  onAbrir: (codigo: string) => void;
}) {
  const p = plazoVisual(conv.plazo);
  const bolsa = importeCortoUi(conv.presupuesto);
  const tipo = tipoAyuda(conv.instrumentos);
  const sello = conv.veredicto ? SELLO[conv.veredicto] : null;

  const titular = conv.resumen?.titular;

  return (
    <button
      className="tarjeta entra"
      style={{ "--acento": p.color, "--i": Math.min(indice, 14) } as React.CSSProperties}
      onClick={() => onAbrir(conv.codigoBdns)}
    >
      <span className="flex items-start justify-between gap-4">
        <span className="block">
          <span
            className="display cifra block text-[19px] leading-tight"
            style={{ color: p.color }}
          >
            {conv.rangoFechas}
          </span>
          <span className="rotulo mt-1.5 block" style={{ color: p.color, opacity: 0.85 }}>
            {p.pie}
            {conv.fechasDelPdf ? " · fecha leída de las bases" : ""}
          </span>
        </span>
        <span className="flex shrink-0 flex-col items-end gap-1.5 pt-0.5">
          <span className="rotulo">{nivelBonito(conv.nivel1)}</span>
          {(conv.hermanas ?? 1) > 1 && (
            <span className="rotulo">{conv.hermanas} convocatorias iguales</span>
          )}
          {sello && (
            <span
              className="rotulo rounded-full px-2 py-0.5"
              style={{ color: sello.color, border: `1px solid ${sello.color}` }}
            >
              {sello.texto}
            </span>
          )}
        </span>
      </span>

      {/* ——— el título oficial, tal cual lo publican ——— */}
      {/* line-clamp impone display:-webkit-box; añadir `block` lo anularía */}
      <span className="display mt-5 line-clamp-2 text-[15.5px] leading-snug text-[var(--grafito)]">
        {conv.titulo}
      </span>

      {/* ——— para qué es y quién puede pedirla ——— */}
      <span className="mt-3 border-t border-[var(--linea)] pt-3">
        <span className="display line-clamp-2 text-[16.5px] leading-snug text-[var(--tinta)]">
          {titular ?? conv.llano.que}
        </span>
        <span className="mt-1.5 line-clamp-2 text-[13px] leading-relaxed text-[var(--grafito)]">
          {conv.resumen?.aQuien || conv.llano.quien}
        </span>
      </span>

      <span className="mt-auto flex items-end justify-between gap-3 pt-4">
        <span className="block">
          {bolsa ? (
            <>
              <span className="cifra block text-[14px] font-medium">{bolsa}</span>
              <span className="rotulo mt-0.5 block">bolsa de todo el programa</span>
            </>
          ) : (
            <span className="text-[13px] text-[var(--niebla)]">importe sin publicar</span>
          )}
        </span>
        <span className="flex items-baseline gap-2">
          {tipo && <span className="rotulo">{tipo}</span>}
          <span className="flecha text-[14px] text-[var(--grafito)]">→</span>
        </span>
      </span>
    </button>
  );
}
