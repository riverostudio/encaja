// Las prestaciones que NO están en la BDNS.
//
// El paro, el Ingreso Mínimo Vital o las ayudas por hijo no son subvenciones:
// son prestaciones (contributivas y no contributivas) y no se publican en la
// Base de Datos Nacional de Subvenciones. Quien entra buscando "el paro" no
// las encontraría nunca, y es justo lo que más falta le hace a quien está sin
// trabajo o va justo de dinero.
//
// Este catálogo es CORTO y CURADO a propósito: prestaciones estatales y vías
// territoriales críticas que la BDNS no refleja bien, siempre con su enlace
// oficial. No lleva cuantías ni umbrales de renta porque cambian cada año y
// una cifra desactualizada es peor que ninguna: para eso está el enlace.

import { resolverCP } from "./territorio";

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
  /** Selectores que evitan enseñar una prestación local o familiar a quien no le corresponde. */
  perfiles?: ("particular" | "autonomo" | "empresa")[];
  circunstancias?: string[];
  excluyeCircunstancias?: string[];
  menores?: string[];
  objetivos?: string[];
  municipios?: string[];
  comunidades?: string[];
  /** Algunas vías de acceso no dependen de renta cuando concurre esta circunstancia. */
  admiteCircunstanciasSinRenta?: string[];
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
    admiteCircunstanciasSinRenta: ["familia_numerosa"],
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
    perfiles: ["autonomo"],
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
  {
    id: "deduccion-familia-numerosa",
    titular: "La deducción por familia numerosa",
    que: "Una deducción del IRPF que también puede solicitarse como abono anticipado. Puede aprovecharse aunque la declaración no salga a pagar.",
    quien: "Quien tenga el título de familia numerosa y trabaje, sea autónomo, cobre una prestación o subsidio por desempleo, o perciba una pensión.",
    organismo: "Agencia Tributaria",
    url: "https://sede.agenciatributaria.gob.es/Sede/ciudadanos-familias-personas-discapacidad/deducciones-relacionadas-hijos-descendientes/deduccion-familia-numerosa.html",
    busca: ["familia numerosa", "deducción familia numerosa", "modelo 143", "madre numerosa", "padre numeroso"],
    para: ["desempleado", "cuenta_ajena", "autonomo_activo", "estudiante", "jubilado"],
    pocosIngresos: false,
    circunstancias: ["familia_numerosa"],
  },
  {
    id: "deduccion-ascendiente-dos-hijos",
    titular: "La deducción para un progenitor con dos hijos",
    que: "Una deducción del IRPF que también puede pedirse como abono anticipado. Ojo: no corresponde a todas las familias monoparentales.",
    quien: "Para quien esté separado legalmente o sin vínculo matrimonial, tenga dos hijos sin anualidades por alimentos y derecho a todo el mínimo por descendientes; además debe trabajar, cobrar desempleo o percibir una pensión.",
    organismo: "Agencia Tributaria",
    url: "https://sede.agenciatributaria.gob.es/Sede/ciudadanos-familias-personas-discapacidad/deducciones-relacionadas-hijos-descendientes/deduccion-ascendiente-dos-hijos-separado-matrimonial.html",
    busca: ["familia monoparental", "madre soltera", "padre soltero", "dos hijos", "modelo 143", "ascendiente con dos hijos"],
    para: ["desempleado", "cuenta_ajena", "autonomo_activo", "estudiante", "jubilado"],
    pocosIngresos: false,
    circunstancias: ["monoparental"],
    excluyeCircunstancias: ["familia_numerosa"],
    menores: ["2"],
  },
  {
    id: "emergencia-alquiler-madrid",
    titular: "La ayuda económica de emergencia para vivienda en Madrid",
    que: "Una ayuda municipal para necesidades básicas de alojamiento, incluido el alquiler, cuando no hay ingresos suficientes. Servicios Sociales valora la urgencia y la situación familiar.",
    quien: "Personas o familias empadronadas en Madrid con carencia de medios y riesgo de exclusión. Se solicita en línea o con cita en el Centro de Servicios Sociales del distrito.",
    organismo: "Ayuntamiento de Madrid · Servicios Sociales",
    url: "https://sede.madrid.es/portal/site/tramites/menuitem.62876cb64654a55e2dbd7003a8a409a0/?target=enLinea&vgnextchannel=2cb9a38813180210VgnVCM100000c90da8c0RCRD&vgnextfmt=pd&vgnextoid=aa50ef82e1bed010VgnVCM1000000b205a0aRCRD",
    busca: ["alquiler", "no puedo pagar el alquiler", "impago alquiler", "emergencia vivienda", "alojamiento", "desahucio"],
    para: ["desempleado", "cuenta_ajena", "autonomo_activo", "estudiante", "jubilado"],
    pocosIngresos: true,
    perfiles: ["particular"],
    objetivos: ["apuro", "vivienda"],
    municipios: ["Madrid"],
  },
  {
    id: "vivienda-especial-necesidad-madrid",
    titular: "La vivienda social por especial necesidad o emergencia en Madrid",
    que: "Una vía de acceso a vivienda social para situaciones graves, como pérdida de vivienda, desahucio, violencia o alojamiento inadecuado. No es una convocatoria de ayuda al alquiler.",
    quien: "Hogares de la Comunidad de Madrid que cumplan los requisitos de especial necesidad; en emergencias sociales la propuesta parte de los servicios públicos que atienden el caso.",
    organismo: "Comunidad de Madrid · Agencia de Vivienda Social",
    url: "https://www.comunidad.madrid/vivienda/alquilar-vivienda-agencia-vivienda-social",
    busca: ["alquiler", "vivienda social", "emergencia vivienda", "desahucio", "no puedo pagar el alquiler", "alojamiento"],
    para: ["desempleado", "cuenta_ajena", "autonomo_activo", "estudiante", "jubilado"],
    pocosIngresos: true,
    perfiles: ["particular"],
    objetivos: ["apuro", "vivienda"],
    comunidades: ["Comunidad de Madrid"],
  },
];

function valores(hechos: Map<string, string>, clave: string): string[] {
  return (hechos.get(clave) ?? "").split(",").filter(Boolean);
}

function coincideAlguno(actuales: string[], esperados: string[]): boolean {
  return esperados.some((valor) => actuales.includes(valor));
}

function cumplePerfil(
  p: Prestacion,
  hechos: Map<string, string>,
  opciones: { estricto: boolean; respetarObjetivos: boolean },
): boolean {
  const situacion = hechos.get("situacion");
  const ingresos = hechos.get("ingresos");
  const vaJusto = ingresos === "menos_12000" || ingresos === "12000_18000";
  const menores = hechos.get("menores_cargo");
  const tieneMenores = Boolean(menores) && menores !== "no";
  const perfil = hechos.get("perfil");
  const circunstancias = valores(hechos, "circunstancias");
  const objetivos = valores(hechos, "objetivo");

  if (situacion && !p.para.includes(situacion as Prestacion["para"][number])) return false;
  if (p.perfiles && (perfil ? !p.perfiles.includes(perfil as "particular" | "autonomo" | "empresa") : opciones.estricto)) return false;
  if (p.circunstancias && (!coincideAlguno(circunstancias, p.circunstancias))) {
    if (opciones.estricto || hechos.has("circunstancias")) return false;
  }
  if (p.excluyeCircunstancias && coincideAlguno(circunstancias, p.excluyeCircunstancias)) return false;
  if (p.menores && (menores ? !p.menores.includes(menores) : opciones.estricto)) return false;
  if (opciones.respetarObjetivos && p.objetivos && !coincideAlguno(objetivos, p.objetivos)) return false;

  if (p.municipios || p.comunidades) {
    const cp = hechos.get("cp");
    const zona = cp ? resolverCP(cp) : null;
    if (!zona) return false;
    if (p.municipios && !p.municipios.includes(zona.municipio)) return false;
    if (p.comunidades && !p.comunidades.includes(zona.ccaa)) return false;
  }

  const excepcionRenta = p.admiteCircunstanciasSinRenta
    ? coincideAlguno(circunstancias, p.admiteCircunstanciasSinRenta)
    : false;
  if (p.pocosIngresos && !vaJusto && !excepcionRenta && p.id !== "beca-mec") return false;
  if (p.id === "cuc" && !tieneMenores) return false;
  return true;
}

function prioridadParaPerfil(p: Prestacion, hechos: Map<string, string>): number {
  const objetivos = valores(hechos, "objetivo");
  const circunstancias = valores(hechos, "circunstancias");
  let prioridad = 0;
  if (p.objetivos && coincideAlguno(objetivos, p.objetivos)) prioridad += 100;
  if (p.circunstancias && coincideAlguno(circunstancias, p.circunstancias)) prioridad += 80;
  if (hechos.get("situacion") === "desempleado" && ["paro", "subsidio"].includes(p.id)) prioridad += 60;
  if (p.id === "imv" && p.pocosIngresos) prioridad += 40;
  return prioridad;
}

/** Las prestaciones que le pueden tocar a este perfil, por orden de utilidad. */
export function prestacionesParaPerfil(hechos: Map<string, string>): Prestacion[] {
  return PRESTACIONES.filter((p) =>
    cumplePerfil(p, hechos, { estricto: true, respetarObjetivos: true }),
  ).sort((a, b) => prioridadParaPerfil(b, hechos) - prioridadParaPerfil(a, hechos));
}

/** Búsqueda por texto, para que aparezcan al buscar "paro" o "renta". */
export function buscarPrestaciones(texto: string, hechos?: Map<string, string>): Prestacion[] {
  const q = texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
  if (q.length < 3) return [];
  return PRESTACIONES.filter((p) => {
    const coincide = [...p.busca, p.titular].some((t) => {
      const termino = t
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .toLowerCase()
        .trim();
      return termino.includes(q) || (termino.length >= 4 && q.includes(termino));
    });
    if (!coincide) return false;
    return hechos
      ? cumplePerfil(p, hechos, { estricto: false, respetarObjetivos: false })
      : !(p.municipios || p.comunidades);
  });
}
