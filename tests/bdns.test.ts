import { describe, it, expect, vi } from "vitest";
import { buscarPagina, detalle, descargarBases, urlAbsoluta } from "../lib/bdns";
import { PAGINA_BUSQUEDA, DETALLE_923287 } from "./fixtures/bdns";

function fetchMock(cuerpo: unknown, opts: { esBinario?: boolean } = {}) {
  return vi.fn(async () => ({
    ok: true,
    status: 200,
    json: async () => cuerpo,
    arrayBuffer: async () => new TextEncoder().encode("PDFDATA").buffer,
    headers: new Map([["content-type", opts.esBinario ? "application/pdf" : "application/json"]]),
  })) as unknown as typeof fetch;
}

describe("buscarPagina", () => {
  it("mapea filas y paginación, y serializa parámetros", async () => {
    const f = fetchMock(PAGINA_BUSQUEDA);
    const r = await buscarPagina(
      { regiones: [54], fechaDesde: "2025-08-03", fechaHasta: "2026-08-03", page: 0, pageSize: 2 },
      f,
    );
    expect(r.total).toBe(646363);
    expect(r.totalPaginas).toBe(215455);
    expect(r.filas).toHaveLength(2);
    expect(r.filas[0]).toMatchObject({
      codigoBdns: "923287",
      titulo: expect.stringContaining("EcoRiba"),
      nivel1: "LOCAL",
      nivel2: "RIBA-ROJA DE TÚRIA",
      fechaRegistro: "2026-08-03",
      mrr: false,
    });
    const url = (f as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(url).toContain("regiones=54");
    expect(url).toContain("fechaDesde=03%2F08%2F2025"); // dd/mm/yyyy urlencoded
    expect(url).toContain("pageSize=2");
  });
});

describe("detalle", () => {
  it("mapea el detalle completo a Convocatoria", async () => {
    const c = await detalle("923287", fetchMock(DETALLE_923287));
    expect(c.codigoBdns).toBe("923287");
    expect(c.nivel1).toBe("LOCAL");
    expect(c.fechaInicioSol).toBe("2026-09-01");
    expect(c.fechaFinSol).toBe("2026-09-30");
    expect(c.beneficiarios).toEqual([
      "PYME Y PERSONAS FÍSICAS QUE DESARROLLAN ACTIVIDAD ECONÓMICA",
    ]);
    expect(c.sectores).toEqual(["S", "Q"]);
    expect(c.instrumentos[0]).toContain("SUBVENCIÓN");
    expect(c.urlBases).toContain("ribarroja.es");
    expect(c.presupuesto).toBe(0);
    expect(c.detalleJson).toBeTruthy();
    expect(c.documentoId).toBe(1419175);
  });
});

describe("descargarBases", () => {
  it("prefiere el documento oficial de la BDNS", async () => {
    const c = await detalle("923287", fetchMock(DETALLE_923287));
    const f = fetchMock(null, { esBinario: true });
    const r = await descargarBases(c, f);
    expect(r?.tipo).toBe("pdf");
    const url = (f as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(url).toContain("idDocumento=1419175");
  });
});

describe("urlAbsoluta", () => {
  it("pone https a los enlaces sin protocolo", () => {
    // La BDNS publica 904 así; en un href serían rutas relativas rotas.
    expect(urlAbsoluta("ujiapps.uji.es/seu/info?pArId=1")).toBe(
      "https://ujiapps.uji.es/seu/info?pArId=1",
    );
    expect(urlAbsoluta("www.gva.es/ayudas")).toBe("https://www.gva.es/ayudas");
  });

  it("no toca los que ya lo llevan", () => {
    expect(urlAbsoluta("https://boe.es/x")).toBe("https://boe.es/x");
    expect(urlAbsoluta("http://sepe.es/y")).toBe("http://sepe.es/y");
  });

  it("respeta otros protocolos", () => {
    expect(urlAbsoluta("mailto:ayudas@gva.es")).toBe("mailto:ayudas@gva.es");
  });

  it("vacío es null, no «https://»", () => {
    expect(urlAbsoluta(null)).toBeNull();
    expect(urlAbsoluta("   ")).toBeNull();
    expect(urlAbsoluta(undefined)).toBeNull();
  });

  it("quita las barras sobrantes del principio", () => {
    expect(urlAbsoluta("//gva.es/x")).toBe("https://gva.es/x");
  });
});

describe("urlAbsoluta con la basura que publican los organismos", () => {
  it("descarta rutas del ordenador de quien lo subió", () => {
    expect(urlAbsoluta("C:\\Users\\Carme\\OneDrive\\bases.pdf")).toBeNull();
  });

  it("rescata la URL cuando le han pegado algo delante", () => {
    expect(urlAbsoluta("Inmahttps://cindi.gva.es/es/web/innovacion")).toBe(
      "https://cindi.gva.es/es/web/innovacion",
    );
  });

  it("no convierte en enlace lo que no es un dominio", () => {
    expect(urlAbsoluta("pendiente de publicar")).toBeNull();
    expect(urlAbsoluta("ver bases")).toBeNull();
  });

  it("un dominio de verdad sí", () => {
    expect(urlAbsoluta("sede.gva.es/ayudas")).toBe("https://sede.gva.es/ayudas");
  });
});

describe("protocolos mutilados", () => {
  it("repara «ttps://» al que le falta la hache", () => {
    expect(urlAbsoluta("ttps://www.boe.es/x.pdf")).toBe("https://www.boe.es/x.pdf");
    expect(urlAbsoluta("ttp://gva.es/y")).toBe("https://gva.es/y");
  });
});
