"use client";

import { euros, nivelBonito, plazoVisual, tipoAyuda, type ConvUi } from "./tipos-ui";

/**
 * Tarjeta de ayuda. La cuenta atrás manda: cifra grande en serif,
 * teñida por urgencia, y ese mismo color despliega el filete superior
 * al pasar por encima.
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
  const importe = euros(conv.presupuesto);
  const tipo = tipoAyuda(conv.instrumentos);

  return (
    <button
      className="tarjeta entra"
      style={
        {
          "--acento": p.color,
          "--i": Math.min(indice, 14),
        } as React.CSSProperties
      }
      onClick={() => onAbrir(conv.codigoBdns)}
    >
      <span className="flex items-start justify-between gap-4">
        <span className="block">
          <span
            className={`display cifra block leading-[0.9] ${p.grande ? "text-[38px]" : "text-[24px]"}`}
            style={{ color: p.color }}
          >
            {p.cifra}
          </span>
          <span className="rotulo mt-2 block" style={{ color: p.color, opacity: 0.8 }}>
            {p.pie}
          </span>
        </span>
        <span className="rotulo shrink-0 pt-1">{nivelBonito(conv.nivel1)}</span>
      </span>

      {/* line-clamp impone display:-webkit-box; añadir `block` lo anularía */}
      <span className="display mt-5 line-clamp-3 text-[17px] leading-snug">{conv.titulo}</span>

      <span className="mt-2 line-clamp-1 text-[12.5px] text-[var(--grafito)]">
        {conv.nivel3 ?? conv.nivel2}
      </span>

      <span className="mt-auto flex items-baseline justify-between gap-3 pt-5">
        <span className="cifra text-[14px] font-medium">
          {importe ?? <span className="text-[var(--niebla)]">importe sin publicar</span>}
        </span>
        <span className="flex items-baseline gap-2">
          {tipo && <span className="rotulo">{tipo}</span>}
          <span className="flecha text-[14px] text-[var(--grafito)]">→</span>
        </span>
      </span>
    </button>
  );
}
