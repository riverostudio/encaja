"use client";

import { euros, nivelBonito, plazoVisual, tipoAyuda, type ConvUi } from "./tipos-ui";

/**
 * Una ayuda como fila de un índice tipográfico: la cuenta atrás a la
 * izquierda en cifra grande, el título en serif, y el importe alineado
 * a la derecha. Sin cajas ni etiquetas de colores.
 */
export default function TarjetaAyuda({
  conv,
  onAbrir,
}: {
  conv: ConvUi;
  onAbrir: (codigo: string) => void;
}) {
  const p = plazoVisual(conv.plazo);
  const importe = euros(conv.presupuesto);
  const tipo = tipoAyuda(conv.instrumentos);

  return (
    <button className="fila" onClick={() => onAbrir(conv.codigoBdns)}>
      <span className="block">
        <span
          className={`display cifra block leading-none ${p.grande ? "text-[30px]" : "text-[19px]"}`}
          style={{ color: p.color }}
        >
          {p.cifra}
        </span>
        <span className="rotulo mt-1.5 block" style={{ color: p.color, opacity: 0.75 }}>
          {p.pie}
        </span>
      </span>

      <span className="block min-w-0">
        <span className="display line-clamp-2 block text-[17px] leading-snug">{conv.titulo}</span>
        <span className="mt-1.5 block text-[12.5px] text-[var(--grafito)]">
          {conv.nivel3 ?? conv.nivel2}
          <span className="text-[var(--niebla)]"> · {nivelBonito(conv.nivel1)}</span>
          {tipo && <span className="text-[var(--niebla)]"> · {tipo}</span>}
        </span>
      </span>

      <span className="hidden text-right sm:block">
        {importe && (
          <span className="cifra block text-[14px] font-medium tabular-nums">{importe}</span>
        )}
        {!conv.detalleAt && (
          <span className="rotulo mt-1 block">sin detalle</span>
        )}
      </span>
    </button>
  );
}
