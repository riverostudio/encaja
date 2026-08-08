import { describe, expect, it } from "vitest";
import {
  consultaParaAsistente,
  convocatoriaRelevanteParaEscenario,
  detectarEscenario,
  detectarEscenarios,
  hechosInferidosParaBuscar,
  ordenarRecursosPorRanking,
  parsearRankingRecursos,
  preguntasQueFaltan,
  puntuarConvocatoriaParaEscenario,
  profesionalNecesitaAclaracion,
  respuestaGuiada,
} from "../lib/asistente";

const h = (datos: Record<string, string> = {}) => new Map(Object.entries(datos));

describe("orientación del asistente", () => {
  it.each([
    ["No tengo casi ingresos y no llego a fin de mes", "pocos_recursos", "ingreso mínimo"],
    ["Soy estudiante de FP", "estudiante", "beca"],
    ["Soy autónomo y necesito ayuda para mi negocio", "autonomo", "autoempleo"],
    ["Soy profesional y quiero saber qué puedo pedir", "profesional", "competencias profesionales"],
    ["Trabajo por cuenta ajena", "trabajador", "conciliación"],
    ["Necesito ayuda por dependencia para cuidar a mi padre", "dependencia", "dependencia"],
    ["Quiero pedir el grado de discapacidad", "discapacidad", "discapacidad"],
    ["Sufro violencia de género y necesito ayuda", "violencia_genero", "violencia de género"],
    ["No tengo dinero para comprar comida", "alimentacion", "alimentos"],
    ["Soy migrante y necesito orientación", "migracion", "integración"],
    ["Soy joven extutelado y necesito vivienda", "extutelado", "jóvenes extutelados"],
  ] as const)("clasifica %s", (mensaje, escenario, termino) => {
    expect(detectarEscenario(mensaje)).toBe(escenario);
    expect(consultaParaAsistente(mensaje)).toContain(termino);
  });

  it("las inferencias sirven para buscar pero no modifican el perfil original", () => {
    const original = h();
    const inferido = hechosInferidosParaBuscar(original, "autonomo");
    expect(inferido.get("perfil")).toBe("autonomo");
    expect(inferido.get("situacion")).toBe("autonomo_activo");
    expect(original.size).toBe(0);
  });

  it("una necesidad personal se filtra como persona aunque la ficha esté vacía", () => {
    const inferido = hechosInferidosParaBuscar(h(), "pocos_recursos");
    expect(inferido.get("perfil")).toBe("particular");
    expect(inferido.has("ingresos")).toBe(false);
  });

  it("conserva varias necesidades y da prioridad a la más concreta", () => {
    expect(detectarEscenarios("Soy universitario y tengo pocos recursos")).toEqual([
      "estudiante",
      "pocos_recursos",
    ]);
    expect(detectarEscenario("Trabajo, pero me han despedido")).toBe("desempleo");
  });

  it("solo extrae renta y circunstancias que la persona ha escrito", () => {
    const hechos = hechosInferidosParaBuscar(
      h(),
      "familia",
      "Somos familia numerosa, tenemos tres hijos e ingresamos 22.000 euros al año en el 28013",
    );
    expect(hechos.get("ingresos")).toBe("18000_25000");
    expect(hechos.get("menores_cargo")).toBe("3+");
    expect(hechos.get("circunstancias")).toBe("familia_numerosa");
    expect(hechos.get("cp")).toBe("28013");
  });

  it("la necesidad expresada ahora prevalece en la búsqueda sin reescribir el perfil", () => {
    const original = h({ perfil: "particular", situacion: "estudiante" });
    const inferido = hechosInferidosParaBuscar(original, "autonomo");
    expect(inferido.get("perfil")).toBe("autonomo");
    expect(inferido.get("situacion")).toBe("autonomo_activo");
    expect(original.get("perfil")).toBe("particular");
    expect(original.get("situacion")).toBe("estudiante");
  });

  it("usa en esa búsqueda un código postal escrito en el chat sin persistirlo", () => {
    const original = h();
    const inferido = hechosInferidosParaBuscar(original, "autonomo", "Tengo un taller en el 46001");
    expect(inferido.get("cp")).toBe("46001");
    expect(original.has("cp")).toBe(false);
  });

  it("a una persona con pocos recursos le pide solo los datos decisivos que faltan", () => {
    expect(preguntasQueFaltan(h(), "pocos_recursos")).toEqual([
      "¿Cuál es tu código postal?",
      "¿En qué tramo están aproximadamente los ingresos anuales de tu hogar?",
    ]);
  });

  it("no pregunta otra vez el tipo de estudios que el usuario acaba de decir", () => {
    expect(preguntasQueFaltan(h({ cp: "28013" }), "estudiante", "Soy universitario")).toEqual(
      [],
    );
  });

  it("no pregunta otra vez una actividad autónoma que el usuario acaba de describir", () => {
    expect(
      preguntasQueFaltan(h({ cp: "46001" }), "autonomo", "Soy autónomo de diseño gráfico"),
    ).toEqual([]);
  });

  it("aclara profesional cuando el perfil personal no distingue la forma de trabajo", () => {
    expect(profesionalNecesitaAclaracion(h({ perfil: "particular" }), "Soy profesional")).toBe(
      true,
    );
    expect(
      profesionalNecesitaAclaracion(h({ perfil: "particular" }), "Soy profesional por cuenta ajena"),
    ).toBe(false);
  });

  it("no mezcla becas o desempleo en los resultados de un trabajador", () => {
    expect(
      convocatoriaRelevanteParaEscenario("Becas para estudiantes universitarios", "trabajador"),
    ).toBe(false);
    expect(
      convocatoriaRelevanteParaEscenario("Cheque de formación para jóvenes desempleados", "trabajador"),
    ).toBe(false);
    expect(
      convocatoriaRelevanteParaEscenario("Ayuda de conciliación para personas trabajadoras", "trabajador"),
    ).toBe(true);
  });

  it("penaliza premios y subvenciones nominativas en búsquedas críticas", () => {
    expect(
      puntuarConvocatoriaParaEscenario(
        "Concesión directa a la Fundación Ejemplo para un proyecto empresarial",
        ["autonomo"],
      ),
    ).toBeLessThan(0);
    expect(
      puntuarConvocatoriaParaEscenario("Premio de creación joven para estudiantes", ["estudiante"]),
    ).toBeLessThan(0);
    expect(
      puntuarConvocatoriaParaEscenario(
        "Premio de creación joven para estudiantes",
        ["estudiante"],
        "Busco un premio de creación",
      ),
    ).toBeGreaterThan(0);
  });

  it("no presenta un resultado como concesión segura", () => {
    const texto = respuestaGuiada(
      "estudiante",
      [
        {
          id: "beca",
          tipo: "via_directa",
          titulo: "Beca",
          organismo: "Ministerio",
          resumen: "Ayuda para estudiar",
          requisitos: ["Estudiar"],
          plazo: "Consulta",
          urlInfo: "https://example.test",
          urlSolicitud: "https://example.test",
          accion: "Solicitar",
        },
      ],
      [],
    );
    expect(texto).toContain("posible ayuda");
    expect(texto).toContain("Revisa los requisitos");
  });

  it("la IA solo puede ordenar IDs que ya están en el catálogo", () => {
    const recursos = [
      {
        id: "imv",
        tipo: "via_directa" as const,
        titulo: "Ingreso Mínimo Vital",
        organismo: "Seguridad Social",
        resumen: "Renta para hogares vulnerables",
        requisitos: ["Comprobar renta"],
        plazo: "Abierto",
        urlInfo: "https://example.test/imv",
        urlSolicitud: "https://example.test/imv",
        accion: "Comprobar",
      },
      {
        id: "bono-social",
        tipo: "via_directa" as const,
        titulo: "Bono social",
        organismo: "MITECO",
        resumen: "Descuento eléctrico",
        requisitos: ["Comprobar vulnerabilidad"],
        plazo: "Abierto",
        urlInfo: "https://example.test/bono",
        urlSolicitud: "https://example.test/bono",
        accion: "Comprobar",
      },
    ];
    const ids = parsearRankingRecursos(
      '```json\n{"ids":["inventada","bono-social","bono-social","imv"]}\n```',
      recursos,
    );
    expect(ids).toEqual(["bono-social", "imv"]);
    expect(ordenarRecursosPorRanking(recursos, ids).map((r) => r.id)).toEqual([
      "bono-social",
      "imv",
    ]);
    expect(parsearRankingRecursos('{"ayuda":"inventada"}', recursos)).toEqual([]);
  });
});
