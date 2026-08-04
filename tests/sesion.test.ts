import { describe, it, expect, afterEach } from "vitest";
import {
  esPublico,
  credencialesDe,
  hechosDe,
  idDeSesion,
} from "../lib/sesion";

function pedir(cabeceras: Record<string, string>): Request {
  return new Request("http://x/api/perfil", { headers: cabeceras });
}

describe("esPublico", () => {
  const original = process.env.ENCAJA_PUBLICO;
  afterEach(() => {
    if (original === undefined) delete process.env.ENCAJA_PUBLICO;
    else process.env.ENCAJA_PUBLICO = original;
  });

  it("por defecto la app es la de tu ordenador, no la pública", () => {
    delete process.env.ENCAJA_PUBLICO;
    expect(esPublico()).toBe(false);
  });

  it("solo se abre al público con el interruptor explícito", () => {
    process.env.ENCAJA_PUBLICO = "1";
    expect(esPublico()).toBe(true);
    process.env.ENCAJA_PUBLICO = "0";
    expect(esPublico()).toBe(false);
  });
});

describe("credencialesDe", () => {
  it("lee la clave que trae el visitante en su petición", () => {
    const c = credencialesDe(
      pedir({
        "x-ia-proveedor": "gemini",
        "x-ia-modelo": "gemini-2.5-flash",
        "x-ia-clave": "AIzaSyLoQueSea",
      }),
    );
    expect(c).toEqual({
      proveedor: "gemini",
      modelo: "gemini-2.5-flash",
      clave: "AIzaSyLoQueSea",
    });
  });

  it("sin clave no hay credenciales: no vale a medias", () => {
    expect(credencialesDe(pedir({ "x-ia-proveedor": "gemini" }))).toBeNull();
    expect(credencialesDe(pedir({}))).toBeNull();
  });

  it("descarta un proveedor que no existe, venga como venga", () => {
    expect(
      credencialesDe(pedir({ "x-ia-proveedor": "pirata", "x-ia-clave": "x" })),
    ).toBeNull();
  });

  it("el modelo puede faltar: cada proveedor tiene el suyo por defecto", () => {
    const c = credencialesDe(pedir({ "x-ia-proveedor": "claude", "x-ia-clave": "sk-ant-x" }));
    expect(c?.proveedor).toBe("claude");
    expect(c?.modelo).toBeNull();
  });
});

describe("hechosDe", () => {
  it("lee el perfil que el visitante guarda en su navegador", () => {
    const h = hechosDe(
      pedir({ "x-perfil": JSON.stringify({ quien: "particular", situacion: "desempleado" }) }),
    );
    expect(h?.get("quien")).toBe("particular");
    expect(h?.get("situacion")).toBe("desempleado");
  });

  it("sin cabecera devuelve null, y quien llama usa la base local", () => {
    expect(hechosDe(pedir({}))).toBeNull();
  });

  it("una cabecera rota no tumba la petición: se ignora", () => {
    expect(hechosDe(pedir({ "x-perfil": "{esto no es json" }))).toBeNull();
    expect(hechosDe(pedir({ "x-perfil": "[1,2,3]" }))).toBeNull();
  });

  it("descarta valores que no son texto, para no colar objetos en la base", () => {
    const h = hechosDe(pedir({ "x-perfil": JSON.stringify({ cp: "46183", raro: { a: 1 } }) }));
    expect(h?.get("cp")).toBe("46183");
    expect(h?.has("raro")).toBe(false);
  });
});

describe("idDeSesion", () => {
  it("el mismo navegador cae siempre en el mismo cajón", () => {
    const a = idDeSesion(pedir({ "x-sesion": "abc-123" }));
    const b = idDeSesion(pedir({ "x-sesion": "abc-123" }));
    expect(a).toBe(b);
  });

  it("dos navegadores distintos no se pisan", () => {
    expect(idDeSesion(pedir({ "x-sesion": "abc-123" }))).not.toBe(
      idDeSesion(pedir({ "x-sesion": "xyz-789" })),
    );
  });

  it("sin sesión es el perfil 1: la app de tu ordenador", () => {
    expect(idDeSesion(pedir({}))).toBe(1);
  });

  it("nunca devuelve 1 por accidente para un visitante", () => {
    // El 1 está reservado al dueño del ordenador; los visitantes empiezan en 2.
    for (const s of ["a", "b", "c", "1", "", "0", "sesion-larguisima-de-prueba"]) {
      const id = idDeSesion(pedir({ "x-sesion": s }));
      if (s !== "") expect(id).toBeGreaterThan(1);
    }
  });
});
