"use client";

import { chipInstrumento, clasePlazo, euros, textoPlazo, type ConvUi } from "./tipos-ui";

const NIVELES: Record<string, string> = {
  ESTADO: "ESTATAL",
  AUTONOMICA: "AUTONÓMICA",
  LOCAL: "LOCAL",
  OTROS: "OTROS",
};

export default function TarjetaAyuda({
  conv,
  onAbrir,
}: {
  conv: ConvUi;
  onAbrir: (codigo: string) => void;
}) {
  const chip = chipInstrumento(conv.instrumentos);
  const importe = euros(conv.presupuesto);
  return (
    <button
      onClick={() => onAbrir(conv.codigoBdns)}
      className={`tarjeta w-full p-4 text-left ${conv.plazo.estado === "urgente" ? "tarjeta-urgente" : ""}`}
    >
      <div className="flex items-start justify-between gap-3">
        <span className="chip">{NIVELES[conv.nivel1] ?? conv.nivel1}</span>
        <span className={`${clasePlazo(conv.plazo)} text-[12px]`}>{textoPlazo(conv.plazo)}</span>
      </div>
      <h3 className="mt-2 line-clamp-3 text-[15px] font-semibold leading-snug">{conv.titulo}</h3>
      <div className="mt-2 text-[12px] text-[var(--tinta2)]">
        {conv.nivel3 ?? conv.nivel2}
        {conv.nivel3 && conv.nivel2 !== conv.nivel3 ? ` · ${conv.nivel2}` : ""}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {chip && <span className="chip text-[var(--lima)]">{chip}</span>}
        {importe && <span className="chip">{importe}</span>}
        {conv.mrr && <span className="chip">FONDOS UE</span>}
        {!conv.detalleAt && <span className="chip latiendo">DETALLE PENDIENTE</span>}
      </div>
    </button>
  );
}
