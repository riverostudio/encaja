// Las prestaciones que NO están en la BDNS.
//
// El paro, el Ingreso Mínimo Vital o las ayudas por hijo no son subvenciones:
// son prestaciones (contributivas y no contributivas) y no se publican en la
// Base de Datos Nacional de Subvenciones. Quien entra buscando "el paro" no
// las encontraría nunca, y es justo lo que más falta le hace a quien está sin
// trabajo o va justo de dinero.
//
// Este catálogo es CORTO y CURADO a propósito: solo las estatales que
// cualquiera puede necesitar, cada una con su enlace oficial. No lleva
// cuantías ni umbrales de renta porque cambian cada año y una cifra
// desactualizada es peor que ninguna: para eso está el enlace.

export interface Prestacion {
  id: string;
  titular: string;
  que: string;
  quien: string;
  organismo: string;
  url: string;
  /** Palabras con las que la gente la busca. */
  busca: string[];
  /** A qué perfil le puede tocar. */
  para: ("desempleado" | "cuenta_ajena" | "autonomo_activo" | "estudiante" | "jubilado")[];
  pocosIngresos: boolean;
}

export const PRESTACIONES: Prestacion[] = [
  {
    id: "paro",
    titular: "La prestación por desempleo (el paro)",
    que: "Un pago mensual mientras buscas trabajo, si has cotizado al menos 360 días en los últimos 6 años. Dura entre 4 meses y 2 años según lo cotizado.",
    quien: "Quien se queda sin trabajo por causa ajena a su voluntad y tiene cotización suficiente.",
    organismo: "SEPE · Servicio Público de Empleo Estatal",
    url: "https://www.sepe.es/HomeSepe/es/Personas/distributiva-prestaciones.html",
    busca: ["paro", "desempleo", "prestación"],
    para: ["desempleado"],
    pocosIngresos: false,
  },
  {
    id: "subsidio",
    titular: "El subsidio por desempleo",
    que: "Una ayuda mensual cuando ya no te queda paro o no cotizaste lo suficiente. Hay modalidades para mayores de 52, con cargas familiares y tras agotar la prestación.",
    quien: "Quien ha agotado el paro o no llega a los 360 días cotizados, con rentas por debajo del límite que fija el SEPE.",
    organismo: "SEPE · Servicio Público de Empleo Estatal",
    url: "https://www.sepe.es/HomeSepe/es/Personas/distributiva-prestaciones.html",
    busca: ["subsidio", "paro", "desempleo"],
    para: ["desempleado"],
    pocosIngresos: true,
  },
  {
    id: "imv",
    titular: "El Ingreso Mínimo Vital",
    que: "Una renta mensual para hogares sin ingresos suficientes. Se cobra de forma indefinida mientras se sigan cumpliendo los requisitos, y se revisa cada año.",
    quien: "Hogares cuyos ingresos quedan por debajo del umbral, según cuántos sois y las circunstancias de cada uno.",
    organismo: "Seguridad Social",
    url: "https://www.seg-social.es/wps/portal/wss/internet/Trabajadores/PrestacionesPensionesTrabajadores/65850d68-8d06-4645-bde7-05374ee42ac7",
    busca: ["ingreso mínimo vital", "imv", "renta", "ingresos"],
    para: ["desempleado", "cuenta_ajena", "autonomo_activo", "estudiante", "jubilado"],
    pocosIngresos: true,
  },
  {
    id: "cuc",
    titular: "El complemento de ayuda para la infancia",
    que: "Un pago mensual añadido al Ingreso Mínimo Vital por cada menor a cargo. Se cobra automáticamente si ya tienes IMV.",
    quien: "Hogares con menores a cargo que cumplen los requisitos de renta del IMV.",
    organismo: "Seguridad Social",
    url: "https://www.seg-social.es/wps/portal/wss/internet/Trabajadores/PrestacionesPensionesTrabajadores/65850d68-8d06-4645-bde7-05374ee42ac7",
    busca: ["hijo", "infancia", "menores", "familia"],
    para: ["desempleado", "cuenta_ajena", "autonomo_activo"],
    pocosIngresos: true,
  },
  {
    id: "bono-social",
    titular: "El bono social eléctrico",
    que: "Un descuento en la factura de la luz, y protección frente al corte de suministro. También existe el bono social térmico para calefacción.",
    quien: "Hogares vulnerables por renta, familias numerosas, y perceptores de pensiones mínimas o del IMV.",
    organismo: "Ministerio para la Transición Ecológica",
    url: "https://www.bonosocial.gob.es/",
    busca: ["luz", "suministros", "electricidad", "bono social"],
    para: ["desempleado", "cuenta_ajena", "autonomo_activo", "estudiante", "jubilado"],
    pocosIngresos: true,
  },
  {
    id: "cese-actividad",
    titular: "El paro de los autónomos (cese de actividad)",
    que: "Un pago mensual si tienes que cerrar tu actividad, siempre que hayas cotizado por cese de actividad al menos 12 meses.",
    quien: "Autónomos que cesan por motivos económicos, técnicos, de fuerza mayor o pérdida de licencia.",
    organismo: "Seguridad Social",
    url: "https://www.seg-social.es/wps/portal/wss/internet/Trabajadores/PrestacionesPensionesTrabajadores/10964",
    busca: ["cese", "autónomo", "paro", "desempleo"],
    para: ["autonomo_activo", "desempleado"],
    pocosIngresos: false,
  },
  {
    id: "no-contributiva",
    titular: "Las pensiones no contributivas",
    que: "Una pensión mensual de jubilación o invalidez para quien no ha cotizado lo suficiente, o nada.",
    quien: "Mayores de 65 años o personas con discapacidad reconocida, sin rentas suficientes.",
    organismo: "Seguridad Social e IMSERSO",
    url: "https://www.seg-social.es/wps/portal/wss/internet/Pensionistas/Pensiones/31351/31358",
    busca: ["pensión", "jubilación", "invalidez", "discapacidad", "mayores"],
    para: ["jubilado", "desempleado"],
    pocosIngresos: true,
  },
  {
    id: "beca-mec",
    titular: "Las becas del Ministerio de Educación",
    que: "Ayuda para estudiar bachillerato, FP o universidad: cubre matrícula y añade cuantías por renta y por distancia al centro.",
    quien: "Estudiantes cuya familia no supera los umbrales de renta y patrimonio que fija cada curso.",
    organismo: "Ministerio de Educación",
    url: "https://www.becaseducacion.gob.es/becas-y-ayudas.html",
    busca: ["beca", "estudios", "universidad", "fp"],
    para: ["estudiante", "desempleado", "cuenta_ajena"],
    pocosIngresos: true,
  },
];

/** Las prestaciones que le pueden tocar a este perfil, por orden de utilidad. */
export function prestacionesParaPerfil(hechos: Map<string, string>): Prestacion[] {
  const situacion = hechos.get("situacion");
  const ingresos = hechos.get("ingresos");
  const vaJusto = ingresos === "menos_12000" || ingresos === "12000_18000";
  const tieneMenores = Boolean(hechos.get("menores_cargo")) && hechos.get("menores_cargo") !== "no";

  return PRESTACIONES.filter((p) => {
    if (situacion && !p.para.includes(situacion as Prestacion["para"][number])) return false;
    if (p.pocosIngresos && !vaJusto && p.id !== "beca-mec") return false;
    if (p.id === "cuc" && !tieneMenores) return false;
    return true;
  });
}

/** Búsqueda por texto, para que aparezcan al buscar "paro" o "renta". */
export function buscarPrestaciones(texto: string): Prestacion[] {
  const q = texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
  if (q.length < 3) return [];
  return PRESTACIONES.filter((p) =>
    [...p.busca, p.titular].some((t) =>
      t
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .toLowerCase()
        .includes(q),
    ),
  );
}
