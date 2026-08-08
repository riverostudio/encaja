import { describe, expect, it } from "vitest";
import {
  clasificarBusqueda,
  normalizarMetricasLocales,
} from "../app/lib/metricas-cliente";

describe("métricas privadas", () => {
  it("clasifica necesidades críticas sin enviar el texto libre", () => {
    expect(clasificarBusqueda("no puedo pagar el alquiler")).toBe("vivienda");
    expect(clasificarBusqueda("me he quedado sin empleo")).toBe("empleo");
    expect(clasificarBusqueda("soy madre soltera con dos hijos")).toBe("familia");
    expect(clasificarBusqueda("necesito una beca para la universidad")).toBe("estudios");
    expect(clasificarBusqueda("bono social para la luz")).toBe("energia");
  });

  it("migra el historial anterior sin perder las aperturas repetidas", () => {
    const metricas = normalizarMetricasLocales({
      version: 1,
      busquedas: [
        { texto: "alquiler", categoria: "vivienda", resultados: 4, fecha: "2026-08-08" },
      ],
      ayudasVistas: [
        {
          codigoBdns: "123456",
          titulo: "Ayuda",
          organo: "Organismo",
          rangoFechas: "Abierta",
          vistaAt: "2026-08-08",
          veces: 3,
        },
      ],
    });
    expect(metricas.version).toBe(2);
    expect(metricas.busquedasTotal).toBe(1);
    expect(metricas.ayudasConsultadasTotal).toBe(3);
  });

  it("conserva acumuladores mayores que el historial visible", () => {
    const metricas = normalizarMetricasLocales({
      version: 2,
      busquedasTotal: 61,
      ayudasConsultadasTotal: 104,
      busquedas: [],
      ayudasVistas: [],
    });
    expect(metricas.busquedasTotal).toBe(61);
    expect(metricas.ayudasConsultadasTotal).toBe(104);
  });
});
