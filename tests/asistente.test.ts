import { describe, expect, it } from "vitest";
import {
  consultaParaAsistente,
  detectarEscenario,
  hechosInferidosParaBuscar,
  preguntasQueFaltan,
  profesionalNecesitaAclaracion,
  respuestaGuiada,
  respuestaIaSegura,
} from "../lib/asistente";

const h = (datos: Record<string, string> = {}) => new Map(Object.entries(datos));

describe("orientación del asistente", () => {
  it.each([
    ["No tengo casi ingresos y no llego a fin de mes", "pocos_recursos", "ingreso mínimo"],
    ["Soy estudiante de FP", "estudiante", "beca"],
    ["Soy autónomo y necesito ayuda para mi negocio", "autonomo", "autoempleo"],
    ["Soy profesional y quiero saber qué puedo pedir", "profesional", "competencias profesionales"],
    ["Trabajo por cuenta ajena", "trabajador", "conciliación"],
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
    expect(inferido.get("ingresos")).toBe("menos_12000");
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

  it("aclara profesional cuando el perfil personal no distingue la forma de trabajo", () => {
    expect(profesionalNecesitaAclaracion(h({ perfil: "particular" }), "Soy profesional")).toBe(
      true,
    );
    expect(
      profesionalNecesitaAclaracion(h({ perfil: "particular" }), "Soy profesional por cuenta ajena"),
    ).toBe(false);
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

  it("descarta preguntas inventadas por la IA y solo añade las autorizadas", () => {
    const texto = respuestaIaSegura(
      "El IMV es una posible ayuda para hogares vulnerables. Para poder afinar, nos faltaría conocer tu provincia y si eres titular de la luz. ¿Tienes contrato?",
      ["¿Qué estudias: Bachillerato, FP, universidad u otra enseñanza?"],
    );
    expect(texto).toContain("El IMV es una posible ayuda");
    expect(texto).not.toContain("provincia");
    expect(texto).not.toContain("contrato");
    expect(texto).toContain("¿Qué estudias: Bachillerato, FP, universidad u otra enseñanza?");
  });

  it("no añade seguimiento cuando el perfil ya contiene lo necesario", () => {
    expect(respuestaIaSegura("Hay dos posibles ayudas. ¿Dónde vives?", [])).toBe(
      "Hay dos posibles ayudas.",
    );
  });
});
