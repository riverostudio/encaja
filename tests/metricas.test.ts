import { describe, expect, it } from "vitest";
import { clasificarBusqueda } from "../app/lib/metricas-cliente";

describe("métricas privadas", () => {
  it("clasifica necesidades críticas sin enviar el texto libre", () => {
    expect(clasificarBusqueda("no puedo pagar el alquiler")).toBe("vivienda");
    expect(clasificarBusqueda("me he quedado sin empleo")).toBe("empleo");
    expect(clasificarBusqueda("soy madre soltera con dos hijos")).toBe("familia");
    expect(clasificarBusqueda("necesito una beca para la universidad")).toBe("estudios");
    expect(clasificarBusqueda("bono social para la luz")).toBe("energia");
  });
});
