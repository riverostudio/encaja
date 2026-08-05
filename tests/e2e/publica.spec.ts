import { expect, test } from "@playwright/test";

async function entrarSinClave(page: import("@playwright/test").Page) {
  await page.goto("/");
  const invitado = page.getByRole("button", { name: /Entrar sin clave/ });
  if (await invitado.isVisible()) await invitado.click();
  await expect(page.getByPlaceholder("Busca una ayuda…")).toBeVisible();
}

test("el perfil público persiste al recargar", async ({ page }) => {
  await entrarSinClave(page);
  await page.getByRole("link", { name: "Mi perfil" }).click();
  await page.getByRole("button", { name: /Como persona/ }).click();
  await page.reload();
  await expect(page.getByText("¿Qué te vendría bien ahora mismo?")).toBeVisible();
});

test("el código postal selecciona su comunidad", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => {
    localStorage.setItem(
      "encaja.perfil",
      JSON.stringify({ perfil: "particular", cp: "28013" }),
    );
  });
  await page.reload();
  const invitado = page.getByRole("button", { name: /Entrar sin clave/ });
  if (await invitado.isVisible()) await invitado.click();
  await expect(page.locator("select").first()).toHaveValue("26");
});

test("una respuesta de Encajo viaja en la siguiente petición", async ({ page }) => {
  let perfilSegunda = "";
  let llamadas = 0;
  await page.route("**/api/encaje/999999", async (route) => {
    llamadas++;
    if (llamadas === 2) perfilSegunda = route.request().headers()["x-perfil"] ?? "";
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ fase: "entrevista", requisitos: [] }),
    });
  });
  await entrarSinClave(page);
  await page.evaluate(async () => {
    await fetch("/api/encaje/999999", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accion: "responder", clave: "empadronado", valor: "sí" }),
    });
    await fetch("/api/encaje/999999", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accion: "iniciar" }),
    });
  });
  expect(JSON.parse(decodeURIComponent(perfilSegunda)).empadronado).toBe("sí");
});

test("los expedientes públicos se leen solo desde este navegador", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => {
    const conv = {
      codigoBdns: "999999",
      titulo: "Ayuda de prueba",
      nivel1: "ESTADO",
      nivel2: "Ministerio",
      fechaRegistro: "2026-08-05",
      mrr: false,
      beneficiarios: [],
      instrumentos: [],
      sectores: [],
      regiones: ["ES"],
      fondos: [],
      rangoFechas: "5 ago — 30 sep",
      plazo: { estado: "abierta", dias: 56 },
      llano: { que: "Ayuda de prueba", quien: "personas", consigues: "apoyo" },
    };
    localStorage.setItem(
      "encaja.expedientes",
      JSON.stringify({
        "999999": {
          codigoBdns: "999999",
          estado: "interesa",
          checklist: [],
          conv,
          urlFicha: "https://www.infosubvenciones.es/bdnstrans/GE/es/convocatoria/999999",
          creadoAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      }),
    );
  });
  await page.goto("/expedientes");
  const invitado = page.getByRole("button", { name: /Entrar sin clave/ });
  if (await invitado.isVisible()) await invitado.click();
  await expect(page.getByText("Ayuda de prueba")).toBeVisible();
});

test("mantenimiento público protegido y cabeceras activas", async ({ page }) => {
  await entrarSinClave(page);
  const estado = await page.evaluate(async () =>
    fetch("/api/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ todaEspana: true }),
    }).then((r) => r.status),
  );
  expect(estado).toBe(405);
  const respuesta = await page.request.get("/");
  expect(respuesta.headers()["x-content-type-options"]).toBe("nosniff");
  expect(respuesta.headers()["content-security-policy"]).toContain("frame-ancestors 'none'");
});
