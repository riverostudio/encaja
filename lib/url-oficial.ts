/**
 * Convierte los enlaces publicados por la BDNS en URLs web seguras.
 *
 * Los organismos mezclan URLs válidas con correos, rutas locales, textos de
 * marcador y protocolos mal escritos. Ante la duda se devuelve null: toda la
 * interfaz tiene como alternativa la ficha oficial de la convocatoria.
 */

const DOMINIO_PUBLICO =
  /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+(?:[a-z]{2,63}|xn--[a-z0-9-]{2,59})$/i;
const PROTOCOLOS_ERRONEOS =
  /^(ttps|ttp|htpps|httos|hps|hhtp|htpp|htts|htttps|htps|hhtps|httpps):\s*\/{0,2}\s*(.+)$/i;
const CANDIDATOS_WEB =
  /(?=((?:https?|ttps|ttp|htpps|httos|hps|hhtp|htpp|htts|htttps|htps|hhtps|httpps):\s*\/{0,2}\s*[^\s<>"']+))/gi;
const MAX_URL = 4_096;

function validarWeb(candidata: string): string | null {
  if (
    !candidata ||
    candidata.length > MAX_URL ||
    /[\s\u0000-\u001f\u007f\\]/.test(candidata)
  ) {
    return null;
  }
  try {
    const url = new URL(candidata);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    if (url.username || url.password) return null;
    // No se aceptan localhost, nombres internos, marcadores ni IP disfrazadas
    // (por ejemplo, la BDNS contiene "https://01", que URL convierte en 0.0.0.1).
    const teniaPuntoFinal = url.hostname.endsWith(".");
    const hostname = teniaPuntoFinal ? url.hostname.slice(0, -1) : url.hostname;
    if (!DOMINIO_PUBLICO.test(hostname)) return null;
    if (/(?:^|\.)(?:nip\.io|sslip\.io|localtest\.me)$/i.test(hostname)) return null;
    if (teniaPuntoFinal) url.hostname = hostname;
    return url.toString();
  } catch {
    return null;
  }
}

function sinPuntuacionDeProsa(valor: string): string {
  let salida = valor.replace(/[.,;]+$/g, "");
  for (const [abre, cierra] of [["(", ")"], ["[", "]"], ["{", "}"]] as const) {
    const abiertos = () => [...salida].filter((caracter) => caracter === abre).length;
    const cerrados = () => [...salida].filter((caracter) => caracter === cierra).length;
    while (salida.endsWith(cierra) && cerrados() > abiertos()) salida = salida.slice(0, -1);
  }
  return salida;
}

function normalizarProtocolo(valor: string, vieneDeProsa = false): string | null {
  const correcto = valor.match(/^(https?):\s*\/{0,2}\s*(.+)$/i);
  if (correcto) {
    const destino = vieneDeProsa ? sinPuntuacionDeProsa(correcto[2]) : correcto[2];
    return validarWeb(`${correcto[1].toLowerCase()}://${destino}`);
  }
  const erroneo = valor.match(PROTOCOLOS_ERRONEOS);
  if (erroneo) {
    const destino = vieneDeProsa ? sinPuntuacionDeProsa(erroneo[2]) : erroneo[2];
    return validarWeb(`https://${destino}`);
  }
  return null;
}

export function urlAbsoluta(u: string | null | undefined): string | null {
  const limpio = u?.trim();
  if (
    !limpio ||
    limpio.length > MAX_URL ||
    /[\u0000-\u001f\u007f\\]/.test(limpio)
  ) {
    return null;
  }

  // Error confirmado en la fuente: el dominio real y operativo usa un punto.
  const sedeCalahorra = limpio.match(/^(https?):\/\/sede@calahorra\.es([/?#].*)?$/i);
  if (sedeCalahorra) {
    return validarWeb(
      `${sedeCalahorra[1]}://sede.calahorra.es${sedeCalahorra[2] ?? ""}`,
    );
  }

  // Primero se intenta la cadena completa. Esto conserva sin ambigüedad URLs
  // con queries que a su vez contienen otra URL.
  const completa = normalizarProtocolo(limpio);
  if (completa) return completa;

  // Si hay prosa alrededor, se acepta únicamente un candidato válido. Con dos
  // o más enlaces no se adivina cuál es el de solicitud: se usa la ficha BDNS.
  const candidatos = [
    ...new Set(
      [...limpio.matchAll(CANDIDATOS_WEB)]
        .map((coincidencia) => normalizarProtocolo(coincidencia[1], true))
        .filter((valor): valor is string => Boolean(valor)),
    ),
  ];
  if (candidatos.length === 1) return candidatos[0];
  if (candidatos.length > 1) return null;

  // Rutas de ordenadores y protocolos no web nunca deben acabar en un href.
  if (/^[a-z][a-z0-9+.-]*:/i.test(limpio)) return null;

  const sinBarras = limpio.replace(/^\/+/, "");
  return validarWeb(`https://${sinBarras}`);
}
