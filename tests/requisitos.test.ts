import { describe, it, expect } from "vitest";
import {
  parsearRequisitos,
  parsearVeredictos,
  preguntables,
  siguientePregunta,
} from "../lib/requisitos";
import type { Requisito } from "../lib/tipos";

describe("parsearRequisitos", () => {
  it("parsea JSON limpio", () => {
    const r = parsearRequisitos(
      JSON.stringify({
        requisitos: [
          {
            id: "r1",
            literal: "Estar al corriente de las obligaciones tributarias",
            tipo: "condicion",
            clave: "al_corriente_hacienda",
            pregunta: "¿Estás al corriente con Hacienda?",
            respuestas: ["sí", "no"],
          },
          { id: "r2", literal: "Presentar memoria descriptiva", tipo: "documento" },
        ],
      }),
    );
    expect(r).toHaveLength(2);
    expect(r[0].clave).toBe("al_corriente_hacienda");
  });

  it("tolera fences de markdown y basura alrededor", () => {
    const texto = 'Aquí tienes:\n```json\n{"requisitos":[{"id":"r1","literal":"X","tipo":"dato","clave":"k","pregunta":"¿?"}]}\n```\nEspero que sirva.';
    expect(parsearRequisitos(texto)).toHaveLength(1);
  });

  it("descarta ítems sin literal o con tipo inválido, sin lanzar", () => {
    const r = parsearRequisitos(
      JSON.stringify({
        requisitos: [
          { id: "r1", tipo: "dato", clave: "k" },
          { id: "r2", literal: "OK", tipo: "inventado" },
          { id: "r3", literal: "Válido", tipo: "condicion", clave: "x", pregunta: "¿?" },
        ],
      }),
    );
    expect(r).toHaveLength(1);
    expect(r[0].id).toBe("r3");
  });

  it("con JSON irrecuperable devuelve lista vacía", () => {
    expect(parsearRequisitos("esto no es json")).toEqual([]);
  });

  it("deduplica ids repetidos", () => {
    const r = parsearRequisitos(
      JSON.stringify({
        requisitos: [
          { id: "r1", literal: "A", tipo: "documento" },
          { id: "r1", literal: "B", tipo: "documento" },
        ],
      }),
    );
    expect(r).toHaveLength(1);
  });
});

describe("preguntables", () => {
  const muchos: Requisito[] = Array.from({ length: 20 }, (_, i) => ({
    id: `r${i}`,
    literal: `L${i}`,
    tipo: "condicion" as const,
    clave: `k${i}`,
    pregunta: `¿P${i}?`,
  }));

  it("nunca ofrece más de 8, por muchas que extraiga la IA", () => {
    expect(preguntables(muchos, new Map())).toHaveLength(8);
  });

  it("responder no destapa preguntas nuevas: la entrevista termina", () => {
    const hechos = new Map<string, string>();
    let vueltas = 0;
    while (preguntables(muchos, hechos).length > 0 && vueltas < 50) {
      hechos.set(preguntables(muchos, hechos)[0].clave!, "sí");
      vueltas++;
    }
    expect(vueltas).toBe(8);
  });
});

describe("siguientePregunta", () => {
  const reqs: Requisito[] = [
    { id: "r1", literal: "L1", tipo: "condicion", clave: "al_corriente_hacienda", pregunta: "¿Hacienda?" },
    { id: "r2", literal: "L2", tipo: "documento" },
    { id: "r3", literal: "L3", tipo: "dato", clave: "num_empleados", pregunta: "¿Empleados?" },
  ];

  it("devuelve la primera sin responder, saltando documentos", () => {
    const q = siguientePregunta(reqs, new Map());
    expect(q?.id).toBe("r1");
  });

  it("salta claves ya conocidas de la ficha", () => {
    const q = siguientePregunta(reqs, new Map([["al_corriente_hacienda", "sí"]]));
    expect(q?.id).toBe("r3");
  });

  it("null cuando no queda nada que preguntar", () => {
    const hechos = new Map([
      ["al_corriente_hacienda", "sí"],
      ["num_empleados", "0"],
    ]);
    expect(siguientePregunta(reqs, hechos)).toBeNull();
  });
});

describe("parsearVeredictos", () => {
  it("parsea y filtra veredictos inválidos", () => {
    const v = parsearVeredictos(
      JSON.stringify({
        veredictos: [
          { id: "r1", veredicto: "cumple", motivo: "Declarado al corriente" },
          { id: "r3", veredicto: "quizas", motivo: "?" },
        ],
      }),
    );
    expect(v).toHaveLength(1);
    expect(v[0].veredicto).toBe("cumple");
  });
});
