import { describe, it, expect } from "vitest";
import { normalizar, resolverCP, esOrganoDeMiZona, transcurreEnEspana, CCAAS } from "../lib/territorio";

describe("normalizar", () => {
  it("mayúsculas, sin acentos, sin artículos, guiones a espacio", () => {
    expect(normalizar("L'Eliana")).toBe("ELIANA");
    expect(normalizar("l'Eliana")).toBe("ELIANA");
    expect(normalizar("Riba-roja de Túria")).toBe("RIBA ROJA DE TURIA");
    expect(normalizar("La Pobla de Vallbona")).toBe("POBLA DE VALLBONA");
    expect(normalizar("  València  ")).toBe("VALENCIA");
  });
});

describe("resolverCP", () => {
  it("46183 es l'Eliana (Valencia, Comunitat Valenciana, ids 54 y 57)", () => {
    const r = resolverCP("46183");
    expect(r).not.toBeNull();
    expect(normalizar(r!.municipio)).toBe("ELIANA");
    expect(r!.provincia).toBe("Valencia");
    expect(r!.ccaa).toBe("Comunitat Valenciana");
    expect(r!.regionIds).toEqual([54, 57]);
  });

  it("28013 es Madrid", () => {
    const r = resolverCP("28013");
    expect(r!.municipio).toBe("Madrid");
    expect(r!.regionIds).toEqual([26, 27]);
  });

  it("CP desconocido devuelve null", () => {
    expect(resolverCP("99999")).toBeNull();
    expect(resolverCP("abc")).toBeNull();
  });
});

describe("esOrganoDeMiZona", () => {
  const zona = { municipio: "l'Eliana", provincia: "Valencia" };

  it("ayuntamiento del municipio: sí", () => {
    expect(esOrganoDeMiZona("ELIANA (L')", "AYUNTAMIENTO DE L'ELIANA", zona)).toBe(true);
  });

  it("diputación de mi provincia: sí", () => {
    expect(esOrganoDeMiZona("VALENCIA", "DIPUTACIÓN PROVINCIAL DE VALENCIA", zona)).toBe(true);
  });

  it("otro municipio: no (incluida la trampa Meliana≠Eliana)", () => {
    expect(esOrganoDeMiZona("PAIPORTA", "AYUNTAMIENTO DE PAIPORTA", zona)).toBe(false);
    expect(esOrganoDeMiZona("MELIANA", "AYUNTAMIENTO DE MELIANA", zona)).toBe(false);
    expect(esOrganoDeMiZona("VILOBÍ D'ONYAR", "AYUNTAMIENTO DE VILOBÍ D'ONYAR", zona)).toBe(false);
  });

  it("Paiporta para quien vive en Paiporta: sí", () => {
    expect(
      esOrganoDeMiZona("PAIPORTA", "AYUNTAMIENTO DE PAIPORTA", {
        municipio: "Paiporta",
        provincia: "Valencia",
      }),
    ).toBe(true);
  });
});

describe("CCAAS", () => {
  it("hay 19 y la Comunitat Valenciana es la 54", () => {
    expect(CCAAS).toHaveLength(19);
    expect(CCAAS.find((c) => c.id === 54)?.nombre).toBe("Comunitat Valenciana");
  });
});

describe("transcurreEnEspana", () => {
  it("acepta las regiones españolas, sea el país entero o una provincia", () => {
    expect(transcurreEnEspana(["ES - ESPAÑA"])).toBe(true);
    expect(transcurreEnEspana(["ES52 - COMUNIDAD VALENCIANA"])).toBe(true);
    expect(transcurreEnEspana(["ES511 - Barcelona"])).toBe(true);
  });

  it("descarta la cooperación al desarrollo, que es lo que la BDNS marca como mundo", () => {
    // Contribuciones de la AECID a la OMS, a UNRWA, a escuelas taller en Bolivia:
    // las convoca España, pero nadie que viva aquí puede pedirlas.
    expect(transcurreEnEspana(["XXXX - TODO EL MUNDO"])).toBe(false);
    expect(transcurreEnEspana(["XXX - Regiones o países no europeos, no contemplados en NUTS"])).toBe(false);
  });

  it("descarta las que solo ocurren en otros países europeos", () => {
    expect(transcurreEnEspana(["FR1 - ÎLE DE FRANCE"])).toBe(false);
    expect(transcurreEnEspana(["UKI - LONDON"])).toBe(false);
    // Ojo: SE (Suecia) y EE (Estonia) empiezan por letras que no son ES.
    expect(transcurreEnEspana(["SE - SVERIGE"])).toBe(false);
    expect(transcurreEnEspana(["EE - EESTI"])).toBe(false);
  });

  it("basta con que una de las regiones sea española", () => {
    expect(transcurreEnEspana(["PT1 - CONTINENTE", "ES43 - EXTREMADURA"])).toBe(true);
  });

  it("sin dato no descarta: preferimos enseñar de más a esconder una ayuda real", () => {
    expect(transcurreEnEspana([])).toBe(true);
    expect(transcurreEnEspana(null as unknown as string[])).toBe(true);
  });
});
