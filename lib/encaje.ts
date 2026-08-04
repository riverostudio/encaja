// Encaje ESTRUCTURAL: descarta o valida con los datos ya publicados en la
// BDNS, sin IA y sin preguntar. Regla: ante falta de datos, DUDA — nunca un
// "no" sin evidencia ni un "sí" inventado.
import type { Convocatoria } from "./tipos";
import { estadoPlazo } from "./plazos";
import { esOrganoDeMiZona, resolverCP } from "./territorio";
import { aQuienVa } from "./resumen";

export interface ResultadoEstructural {
  resultado: "pasa" | "no" | "duda";
  motivos: { regla: string; detalle: string }[];
}

const BENEF_ACTIVIDAD = ["PYME", "PERSONAS FÍSICAS QUE DESARROLLAN", "GRAN EMPRESA"];
// Ojo: "PERSONAS JURÍDICAS QUE NO DESARROLLAN" son asociaciones, NO particulares.
// Ambas comparten "QUE NO DESARROLLAN", así que hay que exigir "FÍSICAS".
const BENEF_PARTICULAR = ["PERSONAS FÍSICAS QUE NO DESARROLLAN"];

export function evaluarEstructural(
  conv: Convocatoria,
  hechos: Map<string, string>,
  hoy: Date = new Date(),
): ResultadoEstructural {
  const motivos: { regla: string; detalle: string }[] = [];
  let duda = false;

  // 1 · Plazo
  const plazo = estadoPlazo(conv.fechaInicioSol, conv.fechaFinSol, hoy);
  if (plazo.estado === "cerrada") {
    return {
      resultado: "no",
      motivos: [
        {
          regla: "plazo",
          detalle: `El plazo de solicitud terminó el ${conv.fechaFinSol}.`,
        },
      ],
    };
  }
  if (plazo.estado === "sin_fechas") {
    duda = true;
    motivos.push({
      regla: "plazo",
      detalle: "La BDNS no publica fechas de solicitud: hay que confirmarlas en las bases.",
    });
  }

  // 2 · Tipo de beneficiario
  const tipo = hechos.get("tipo_actividad"); // autonomo | pyme | particular
  if (!tipo) {
    duda = true;
    motivos.push({
      regla: "beneficiario",
      detalle: "Falta saber si actúas como autónomo/pyme o como particular (ficha).",
    });
  } else if (conv.beneficiarios.length === 0) {
    duda = true;
    motivos.push({
      regla: "beneficiario",
      detalle: "La BDNS no detalla los beneficiarios: confirmar en las bases.",
    });
  } else {
    const listaMayus = conv.beneficiarios.map((b) => b.toUpperCase());
    const admiteActividad = listaMayus.some((b) => BENEF_ACTIVIDAD.some((p) => b.includes(p)));
    const admiteParticular = listaMayus.some((b) => BENEF_PARTICULAR.some((p) => b.includes(p)));
    // El motivo se cuenta en cristiano, no con la jerga de la BDNS.
    const paraQuien = aQuienVa(conv.beneficiarios) ?? conv.beneficiarios.join("; ").toLowerCase();
    const soyActividad = tipo === "autonomo" || tipo === "pyme";
    if (soyActividad && !admiteActividad) {
      return {
        resultado: "no",
        motivos: [
          {
            regla: "beneficiario",
            detalle: `Esta ayuda es solo para ${paraQuien}. Tú la pedirías como ${tipo === "pyme" ? "empresa" : "autónomo"}, y ese perfil no entra.`,
          },
        ],
      };
    }
    if (tipo === "particular" && !admiteParticular) {
      return {
        resultado: "no",
        motivos: [
          {
            regla: "beneficiario",
            detalle: `Esta ayuda es solo para ${paraQuien}. Tú la pedirías como particular, y ese perfil no entra.`,
          },
        ],
      };
    }
  }

  // 3 · Territorio (solo para órganos LOCALES y si conocemos el CP)
  const cp = hechos.get("cp");
  if (conv.nivel1 === "LOCAL" && cp) {
    const zona = resolverCP(cp);
    if (zona && !esOrganoDeMiZona(conv.nivel2, conv.nivel3, zona)) {
      return {
        resultado: "no",
        motivos: [
          {
            regla: "territorio",
            detalle: `La convoca ${conv.nivel3 ?? conv.nivel2} y solo la pueden pedir los de allí. Tú estás en ${zona.municipio} (${zona.provincia}).`,
          },
        ],
      };
    }
  }

  // 4 · Sector (CNAE): sin dato no penaliza; discrepancia = duda
  const cnae = hechos.get("cnae_letras");
  if (conv.sectores.length > 0 && cnae) {
    const mias = cnae.split(",").map((s) => s.trim().toUpperCase()).filter(Boolean);
    const coincide = conv.sectores.some((s) => mias.includes(s.toUpperCase()));
    if (!coincide) {
      duda = true;
      motivos.push({
        regla: "sector",
        detalle: `Sectores de la convocatoria (CNAE ${conv.sectores.join(", ")}) no casan con los tuyos (${cnae}): confirmar en las bases.`,
      });
    }
  }

  return { resultado: duda ? "duda" : "pasa", motivos };
}
