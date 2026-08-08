import { describe, expect, it, vi } from "vitest";
import { descargarTextoWebSeguro, esIpPublica } from "../lib/web-segura";

describe("esIpPublica", () => {
  it("acepta IP globales y rechaza las privadas o reservadas", () => {
    expect(esIpPublica("8.8.8.8")).toBe(true);
    expect(esIpPublica("2606:4700:4700::1111")).toBe(true);
    for (const ip of [
      "127.0.0.1",
      "10.0.0.1",
      "169.254.1.1",
      "172.16.0.1",
      "192.168.1.1",
      "100.64.0.1",
      "192.0.2.1",
      "::1",
      "::127.0.0.1",
      "0:0:0:0:0:ffff:7f00:1",
      "64:ff9b::127.0.0.1",
      "fc00::1",
      "fe80::1",
      "fec0::1",
      "2002:7f00:1::",
      "2001:db8::1",
      "3ffe::1",
    ]) {
      expect(esIpPublica(ip), ip).toBe(false);
    }
  });
});

describe("descargarTextoWebSeguro", () => {
  const publica = async () => [{ address: "93.184.216.34", family: 4 }];

  it("rechaza un dominio que resuelve a la red interna antes de solicitarlo", async () => {
    const solicitar = vi.fn();
    await expect(
      descargarTextoWebSeguro("https://interno.example/", {
        resolver: async () => [{ address: "127.0.0.1", family: 4 }],
        solicitar,
      }),
    ).rejects.toThrow("no público");
    expect(solicitar).not.toHaveBeenCalled();
  });

  it("también limita el tiempo empleado en resolver DNS", async () => {
    await expect(
      descargarTextoWebSeguro("https://publico.example/", {
        resolver: () => new Promise(() => undefined),
        timeoutMs: 10,
      }),
    ).rejects.toThrow("DNS agotado");
  });

  it("vuelve a validar DNS después de cada redirección", async () => {
    const solicitar = vi.fn(async () => ({
      status: 302,
      location: "https://privado.example/bases",
      contentType: "text/html",
      texto: "",
    }));
    await expect(
      descargarTextoWebSeguro("https://publico.example/bases", {
        resolver: async (host) => [
          { address: host === "publico.example" ? "93.184.216.34" : "10.0.0.8", family: 4 },
        ],
        solicitar,
      }),
    ).rejects.toThrow("no público");
    expect(solicitar).toHaveBeenCalledTimes(1);
  });

  it("acepta HTML pequeño y limita cuerpo, puerto y tipo", async () => {
    await expect(
      descargarTextoWebSeguro("https://publico.example/bases", {
        resolver: publica,
        solicitar: async () => ({
          status: 200,
          contentType: "text/html; charset=utf-8",
          texto: "<html>bases oficiales</html>",
        }),
      }),
    ).resolves.toMatchObject({ texto: "<html>bases oficiales</html>" });

    await expect(
      descargarTextoWebSeguro("https://publico.example:8443/bases", { resolver: publica }),
    ).rejects.toThrow("Puerto externo no permitido");
    await expect(
      descargarTextoWebSeguro("https://publico.example/bases", {
        resolver: publica,
        maxBytes: 4,
        solicitar: async () => ({ status: 200, contentType: "text/html", texto: "demasiado" }),
      }),
    ).rejects.toThrow("demasiado grande");
    await expect(
      descargarTextoWebSeguro("https://publico.example/bases", {
        resolver: publica,
        solicitar: async () => ({ status: 200, contentType: "application/pdf", texto: "PDF" }),
      }),
    ).rejects.toThrow("no es texto");
  });
});
