import { describe, it, expect } from "vitest";
import {
  atajosParaPerfil,
  beneficiarioDesdePerfil,
  hechosDerivados,
  preguntasAplicables,
  progresoPerfil,
  resumenPerfil,
  siguientePreguntaPerfil,
  textoRespuesta,
  PREGUNTAS_PERFIL,
} from "../lib/perfil";

const h = (o: Record<string, string>) => new Map(Object.entries(o));

describe("preguntasAplicables", () => {
  it("a un particular no se le pregunta por su sector", () => {
    const claves = preguntasAplicables(h({ perfil: "particular" })).map((p) => p.clave);
    expect(claves).not.toContain("cnae_letras");
    expect(claves).toContain("ingresos");
  });

  it("a un autónomo sí", () => {
    const claves = preguntasAplicables(h({ perfil: "autonomo" })).map((p) => p.clave);
    expect(claves).toContain("cnae_letras");
  });
});

describe("siguientePreguntaPerfil", () => {
  it("empieza por el perfil", () => {
    expect(siguientePreguntaPerfil(h({}))?.clave).toBe("perfil");
  });

  it("va saltando lo ya respondido", () => {
    expect(siguientePreguntaPerfil(h({ perfil: "particular" }))?.clave).toBe("situacion");
  });

  it("null cuando está todo respondido", () => {
    const todo: Record<string, string> = {};
    for (const p of preguntasAplicables(h({ perfil: "particular" }))) todo[p.clave] = "x";
    expect(siguientePreguntaPerfil(h(todo))).toBeNull();
  });
});

describe("progresoPerfil", () => {
  it("cuenta solo lo aplicable", () => {
    const p = progresoPerfil(h({ perfil: "particular", situacion: "desempleado" }));
    expect(p.respondidas).toBe(2);
    expect(p.total).toBe(PREGUNTAS_PERFIL.length - 1); // sin la del sector
    expect(p.completo).toBe(false);
  });
});

describe("beneficiarioDesdePerfil", () => {
  it("traduce el perfil al filtro oficial de la BDNS", () => {
    expect(beneficiarioDesdePerfil(h({ perfil: "particular" }))).toBe(
      "PERSONAS FÍSICAS QUE NO DESARROLLAN",
    );
    expect(beneficiarioDesdePerfil(h({ perfil: "autonomo" }))).toBe("PYME");
    expect(beneficiarioDesdePerfil(h({ perfil: "empresa" }))).toBe("PYME");
    expect(beneficiarioDesdePerfil(h({}))).toBeNull();
  });
});

describe("hechosDerivados", () => {
  it("rellena lo que la entrevista de cada ayuda necesita", () => {
    const d = hechosDerivados(h({ perfil: "autonomo", al_corriente: "si" }));
    expect(d.tipo_actividad).toBe("autonomo");
    expect(d.al_corriente_hacienda).toBe("sí");
    expect(d.al_corriente_ss).toBe("sí");
  });

  it("«no lo sé» no se convierte en un sí", () => {
    const d = hechosDerivados(h({ perfil: "particular", al_corriente: "no_lo_se" }));
    expect(d.tipo_actividad).toBe("particular");
    expect(d.al_corriente_hacienda).toBeUndefined();
  });
});

describe("resumenPerfil", () => {
  it("resume el perfil en una frase legible", () => {
    const r = resumenPerfil(h({ perfil: "particular", situacion: "desempleado", ingresos: "menos_12000" }));
    expect(r).toContain("como persona");
    expect(r).toContain("sin trabajo");
    expect(r).toContain("12.000");
  });

  it("sin datos lo dice", () => {
    expect(resumenPerfil(h({}))).toBe("Sin perfil todavía");
  });
});

describe("atajosParaPerfil", () => {
  it("a un parado sin recursos le ofrece lo suyo, no genéricos", () => {
    const a = atajosParaPerfil(
      h({ perfil: "particular", situacion: "desempleado", ingresos: "menos_12000" }),
    ).map((x) => x.busca);
    expect(a[0]).toBe("desempleo");
    expect(a).toContain("alquiler");
    expect(a).toContain("emergencia");
    expect(a).not.toContain("digitalización");
  });

  it("a un autónomo le ofrece cosas de negocio", () => {
    const a = atajosParaPerfil(h({ perfil: "autonomo", situacion: "autonomo_activo" })).map(
      (x) => x.busca,
    );
    expect(a).toContain("digitalización");
    expect(a).toContain("contratación");
    expect(a).not.toContain("comedor");
  });

  it("con hijos aparecen comedor y familia", () => {
    const a = atajosParaPerfil(
      h({ perfil: "particular", situacion: "cuenta_ajena", menores_cargo: "2" }),
    ).map((x) => x.busca);
    expect(a).toContain("comedor");
    expect(a).toContain("familia");
  });

  it("las circunstancias reconocidas se traducen en atajos", () => {
    const a = atajosParaPerfil(
      h({ perfil: "particular", circunstancias: "discapacidad,familia_numerosa" }),
    ).map((x) => x.busca);
    expect(a).toContain("discapacidad");
    expect(a).toContain("familia numerosa");
  });

  it("nunca se repiten ni se desbordan", () => {
    const a = atajosParaPerfil(
      h({
        perfil: "particular",
        situacion: "desempleado",
        ingresos: "menos_12000",
        menores_cargo: "3+",
        circunstancias: "discapacidad,familia_numerosa,menor_30,victima_violencia",
      }),
    );
    expect(a.length).toBeLessThanOrEqual(10);
    expect(new Set(a.map((x) => x.busca)).size).toBe(a.length);
  });
});

describe("textoRespuesta", () => {
  const circunstancias = PREGUNTAS_PERFIL.find((p) => p.clave === "circunstancias")!;

  it("traduce una multiselección", () => {
    expect(textoRespuesta(circunstancias, "discapacidad,familia_numerosa")).toBe(
      "Discapacidad reconocida, Familia numerosa",
    );
  });

  it("vacío es «Ninguna»", () => {
    expect(textoRespuesta(circunstancias, "")).toBe("Ninguna");
  });

  it("traduce una opción simple", () => {
    const perfil = PREGUNTAS_PERFIL.find((p) => p.clave === "perfil")!;
    expect(textoRespuesta(perfil, "autonomo")).toBe("Como autónomo");
  });
});
