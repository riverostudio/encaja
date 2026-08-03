// Dictamen final: combina el encaje estructural (BDNS) con los veredictos
// sobre los requisitos de las bases. Determinista y citando siempre fuentes.
import type { Requisito, ResultadoDictamen, Veredicto, Motivo } from "./tipos";
import type { ResultadoEstructural } from "./encaje";

export function dictaminar(
  estructural: ResultadoEstructural,
  requisitos: Requisito[],
  veredictos: Veredicto[],
): ResultadoDictamen {
  const motivos: Motivo[] = [];

  for (const m of estructural.motivos) {
    motivos.push({ origen: "estructural", detalle: m.detalle });
  }

  if (estructural.resultado === "no") {
    return { dictamen: "no_encaja", motivos };
  }

  const porId = new Map(requisitos.map((r) => [r.id, r]));
  const evaluables = requisitos.filter((r) => r.tipo !== "documento");

  let hayDuda = estructural.resultado === "duda";
  let hayNo = false;

  for (const v of veredictos) {
    const req = porId.get(v.id);
    motivos.push({
      origen: "bases",
      detalle: `${v.veredicto === "cumple" ? "✔" : v.veredicto === "no_cumple" ? "✘" : "?"} ${v.motivo}`,
      literal: req?.literal,
    });
    if (v.veredicto === "no_cumple") hayNo = true;
    if (v.veredicto === "duda") hayDuda = true;
  }

  if (hayNo) {
    // Los motivos de incumplimiento primero
    motivos.sort((a, b) => Number(b.detalle.startsWith("✘")) - Number(a.detalle.startsWith("✘")));
    return { dictamen: "no_encaja", motivos };
  }

  // ¿Faltan veredictos para requisitos evaluables? → entrevista sin terminar
  const evaluados = new Set(veredictos.map((v) => v.id));
  const faltan = evaluables.filter((r) => !evaluados.has(r.id));
  if (faltan.length > 0) {
    return { dictamen: "pendiente", motivos };
  }

  return { dictamen: hayDuda ? "duda" : "encaja", motivos };
}
