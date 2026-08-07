import { expect, test } from "@playwright/test";

async function entrarSinClave(page: import("@playwright/test").Page) {
  await page.goto("/");
  const invitado = page.getByRole("button", { name: /Entrar sin clave/ });
  const radar = page.getByPlaceholder("Busca una ayuda…");
  // Shell resuelve el estado de IA de forma asíncrona: espera a que aparezca
  // la puerta o el radar si este navegador ya había entrado.
  await expect(invitado.or(radar)).toBeVisible({ timeout: 15_000 });
  const entendido = page.getByRole("button", { name: "Entendido" });
  if (await entendido.isVisible()) await entendido.click();
  if (await invitado.isVisible()) await invitado.click();
  await expect(radar).toBeVisible();
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
  await entrarSinClave(page);
  await expect(page.locator("select").first()).toHaveValue("26");
});

test("una respuesta antigua no pisa las ayudas de la comunidad detectada", async ({ page }) => {
  const convocatoria = (titulo: string, nivel2: string) => ({
    codigoBdns: titulo === "Ayuda de Madrid" ? "260001" : "540001",
    titulo,
    nivel1: "AUTONOMICA",
    nivel2,
    fechaRegistro: "2026-08-05",
    mrr: false,
    beneficiarios: ["PERSONAS FÍSICAS"],
    instrumentos: ["SUBVENCIÓN"],
    sectores: [],
    regiones: ["ES"],
    fondos: [],
    rangoFechas: "1 ago — 30 sep",
    plazo: { estado: "abierta", dias: 54 },
    llano: { que: titulo, quien: "personas", consigues: "apoyo" },
  });
  await page.route(/\/api\/convocatorias(?:\?.*)?$/, async (route) => {
    const region = new URL(route.request().url()).searchParams.get("region");
    if (region === "54") await new Promise((resolve) => setTimeout(resolve, 700));
    const fila = region === "26"
      ? convocatoria("Ayuda de Madrid", "COMUNIDAD DE MADRID")
      : convocatoria("Ayuda de Valencia", "COMUNITAT VALENCIANA");
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ filas: [fila], relajado: null, prestaciones: [] }),
    });
  });
  await page.goto("/");
  await page.evaluate(() => {
    localStorage.setItem(
      "encaja.perfil",
      JSON.stringify({ perfil: "particular", cp: "28013" }),
    );
  });
  await entrarSinClave(page);
  await expect(page.locator("select").first()).toHaveValue("26");
  await expect(page.getByText("Ayuda de Madrid", { exact: true }).first()).toBeVisible();
  await page.waitForTimeout(900);
  await expect(page.getByText("Ayuda de Valencia", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Ayuda de Madrid", { exact: true }).first()).toBeVisible();
});

test("una vía directa no se presenta como una búsqueda vacía", async ({ page }) => {
  await page.route(/\/api\/convocatorias(?:\?.*)?$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        filas: [],
        relajado: null,
        prestaciones: [
          {
            id: "emergencia-alquiler-madrid",
            titular: "Ayuda urgente para el alquiler",
            que: "Una vía oficial para una necesidad de vivienda.",
            quien: "Hogares en situación de necesidad.",
            organismo: "Ayuntamiento de Madrid",
            url: "https://sede.madrid.es/",
          },
        ],
      }),
    });
  });
  await entrarSinClave(page);
  await page.getByPlaceholder("Busca una ayuda…").fill("alquiler");
  await expect(page.getByText("Ayuda urgente para el alquiler", { exact: true })).toBeVisible();
  await expect(page.getByText("No hay una convocatoria directa en la BDNS.")).toBeVisible();
  await expect(page.getByText("Nada con estos filtros.")).toHaveCount(0);
});

test("el asistente conversa, muestra requisitos y lleva la búsqueda al radar", async ({ page }) => {
  let perfilRecibido = "";
  await page.route("**/api/chat", async (route) => {
    perfilRecibido = route.request().headers()["x-perfil"] ?? "";
    const cuerpo = route.request().postDataJSON() as {
      mensajes: Array<{ rol: string; texto: string }>;
    };
    const consulta = cuerpo.mensajes.at(-1)?.texto ?? "";
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        respuesta: `He buscado para: ${consulta}`,
        consulta: "beca|ayudas al estudio",
        modo: "guiado",
        recursos: [
          {
            id: "beca-mec",
            tipo: "via_directa",
            titulo: "Becas del Ministerio de Educación",
            organismo: "Ministerio de Educación",
            resumen: "Ayuda oficial para estudiar.",
            requisitos: [
              "Matricularse en estudios incluidos.",
              "Cumplir los requisitos académicos.",
              "Cumplir los umbrales de renta y patrimonio.",
            ],
            plazo: "Consulta la convocatoria vigente",
            urlInfo: "https://www.becaseducacion.gob.es/becas-y-ayudas.html",
            urlSolicitud: "https://www.becaseducacion.gob.es/becas-y-ayudas.html",
            accion: "Ver y solicitar la beca",
          },
        ],
      }),
    });
  });
  await page.route(/\/api\/convocatorias(?:\?.*)?$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ filas: [], relajado: null, prestaciones: [] }),
    });
  });

  await page.goto("/");
  await page.evaluate(() => {
    localStorage.setItem("encaja.perfil", JSON.stringify({ perfil: "particular", cp: "28013" }));
  });
  await entrarSinClave(page);
  await page.getByRole("button", { name: "Abrir asistente de ayudas" }).click();
  await page.getByRole("button", { name: "Soy estudiante" }).click();

  const asistente = page.getByRole("dialog", { name: "Asistente para buscar ayudas" });
  await expect(asistente.getByText("Orientador de Encaja · IA")).toBeVisible();
  await expect(asistente.getByRole("link", { name: "Privacidad y uso de IA" })).toHaveAttribute(
    "href",
    "/privacidad",
  );
  await expect(asistente.getByText("He buscado para: Soy estudiante")).toBeVisible();
  await expect(asistente.getByText("Becas del Ministerio de Educación", { exact: true })).toBeVisible();
  await expect(asistente.getByText("Cumplir los umbrales de renta y patrimonio.")).toBeVisible();
  await expect(asistente.getByRole("link", { name: /Ver y solicitar la beca/ })).toHaveAttribute(
    "href",
    "https://www.becaseducacion.gob.es/becas-y-ayudas.html",
  );
  expect(JSON.parse(decodeURIComponent(perfilRecibido)).cp).toBe("28013");

  await asistente.getByRole("button", { name: "Ver toda esta búsqueda en el radar" }).click();
  await expect(page.getByPlaceholder("Busca una ayuda…")).toHaveValue("beca · ayudas al estudio");
});

test("el aviso de IA aparece una vez, se puede quitar y remite a la página legal", async ({ page }) => {
  await page.goto("/");
  const aviso = page.getByRole("dialog", { name: "Aviso inicial" });
  await expect(aviso).toBeVisible({ timeout: 15_000 });
  await expect(aviso).toContainText("Encaja usa contenido asistido por IA");
  await expect(aviso.getByRole("link", { name: "Leer aviso legal" })).toHaveAttribute(
    "href",
    "/privacidad",
  );
  await aviso.getByRole("button", { name: "Entendido" }).click();
  await expect(aviso).toHaveCount(0);

  await page.reload();
  await expect(page.getByRole("dialog", { name: "Aviso inicial" })).toHaveCount(0);

  await page.goto("/privacidad");
  await expect(
    page.getByRole("heading", { name: "Aviso legal, privacidad e inteligencia artificial" }),
  ).toBeVisible();
  await expect(page.getByText(/no son asesoramiento jurídico, fiscal, laboral o administrativo/i)).toBeVisible();
  await expect(page.getByText(/Encaja se ha creado, documentado e investigado con ayuda/i)).toBeVisible();
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
  await entrarSinClave(page);
  await page.goto("/expedientes");
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

test("el veredicto permanece visible tras actualizar la ficha", async ({ page }) => {
  let inicios = 0;
  const convocatoria = {
    codigoBdns: "999999",
    titulo: "Ayuda pública de prueba",
    nivel1: "ESTADO",
    nivel2: "Administración General del Estado",
    fechaRegistro: "2026-08-05",
    mrr: false,
    beneficiarios: ["PERSONAS FÍSICAS"],
    instrumentos: ["SUBVENCIÓN"],
    sectores: [],
    regiones: ["ES"],
    fondos: [],
    rangoFechas: "1 ene 2026 — 31 dic 2027",
    plazo: { estado: "abierta", dias: 512 },
    llano: { que: "Ayuda pública de prueba", quien: "personas", consigues: "apoyo" },
  };
  await page.route(/\/api\/convocatorias(?:\?.*)?$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ filas: [convocatoria], relajado: null, prestaciones: [] }),
    });
  });
  await page.route("**/api/convocatorias/999999", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        conv: convocatoria,
        urlFicha: "https://www.infosubvenciones.es/bdnstrans/GE/es/convocatoria/999999",
        evaluacion: null,
        expediente: null,
      }),
    });
  });
  await page.route("**/api/resumen/999999", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        resumen: {
          titular: "Premio explicado en cristiano",
          que: "Una ayuda pública de prueba.",
          consigues: "Apoyo económico.",
          aQuien: "Personas físicas.",
          ojo: "La convocatoria no se abre hasta el 1 de enero de 2026; guarda la fecha.",
        },
      }),
    });
  });
  await page.route("**/api/encaje/999999", async (route) => {
    const cuerpo = route.request().postDataJSON() as { accion: string };
    if (cuerpo.accion === "iniciar") inicios++;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(
        cuerpo.accion === "dictaminar"
          ? { fase: "dictamen", dictamen: "encaja", motivos: [], requisitos: [] }
          : { fase: "listo_para_dictamen", progreso: { respondidas: 1, total: 1 }, requisitos: [] },
      ),
    });
  });

  await entrarSinClave(page);
  await page.getByRole("button").filter({ hasText: "Ayuda pública de prueba" }).click();
  await expect(page.getByRole("heading", { name: "Premio explicado en cristiano" })).toBeVisible();
  await expect(page.getByText(/La convocatoria no se abre/)).toHaveCount(0);
  await page.getByRole("button", { name: "Empezar el cuestionario" }).click();
  await page.getByRole("button", { name: "Ver el veredicto" }).click();

  await expect(page.getByText("Sí, encajas", { exact: true })).toBeVisible();
  await page.waitForTimeout(300);
  await expect(page.getByText("Sí, encajas", { exact: true })).toBeVisible();
  expect(inicios).toBe(1);

  await page.getByRole("button", { name: "Preparar el expediente" }).click();
  await page.getByRole("button", { name: "Preparar el expediente" }).click();
  await expect(page).toHaveURL(/\/expedientes\/999999$/);
  await expect(page.getByRole("heading", { name: "Premio explicado en cristiano" })).toBeVisible();
});
