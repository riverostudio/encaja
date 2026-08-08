import { expect, test } from "@playwright/test";

async function entrarSinClave(page: import("@playwright/test").Page) {
  await page.goto("/");
  const invitado = page.getByRole("button", { name: /Entrar sin clave/ });
  const radar = page.getByPlaceholder("Busca una ayuda…");
  // Shell resuelve el estado de IA de forma asíncrona: espera a que aparezca
  // la puerta o el radar si este navegador ya había entrado.
  await expect(invitado.or(radar)).toBeVisible({ timeout: 15_000 });
  const necesarias = page.getByRole("button", { name: "Solo necesarias" });
  if (await necesarias.isVisible()) await necesarias.click();
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

test("la lista de comunidades conserva contraste en el tema oscuro", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("tema", "oscuro"));
  await entrarSinClave(page);

  const selector = page.locator("select").first();
  const opcion = selector.locator("option").filter({ hasText: "Andalucía" });
  await expect(selector).toHaveCSS("background-color", "rgb(16, 15, 13)");
  await expect(selector).toHaveCSS("color", "rgb(242, 237, 228)");
  await expect(opcion).toHaveCSS("background-color", "rgb(16, 15, 13)");
  await expect(opcion).toHaveCSS("color", "rgb(242, 237, 228)");
  await selector.selectOption({ label: "Andalucía" });
  await expect(opcion).toHaveCSS("background-color", "rgb(47, 93, 69)");
  await expect(opcion).toHaveCSS("color", "rgb(255, 255, 255)");
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
  await expect(asistente.getByText("Orientador de Encaja · GUIADO")).toBeVisible();
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

test("el aviso de IA y estadísticas aparece una vez y permite rechazarlas", async ({ page }) => {
  await page.goto("/");
  const aviso = page.getByRole("dialog", { name: "Aviso inicial" });
  await expect(aviso).toBeVisible({ timeout: 15_000 });
  await expect(aviso).toContainText("Encaja usa contenido asistido por IA");
  await expect(aviso.getByRole("link", { name: "Leer aviso legal" })).toHaveAttribute(
    "href",
    "/privacidad",
  );
  await aviso.getByRole("button", { name: "Solo necesarias" }).click();
  await expect(aviso).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem("encaja.consentimiento-metricas"))).toBe("no");

  await page.reload();
  await expect(page.getByRole("dialog", { name: "Aviso inicial" })).toHaveCount(0);

  await page.goto("/privacidad");
  await expect(
    page.getByRole("heading", { name: "Aviso legal, privacidad e inteligencia artificial" }),
  ).toBeVisible();
  await expect(page.getByText(/no son asesoramiento jurídico, fiscal, laboral o administrativo/i)).toBeVisible();
  await expect(page.getByText(/Encaja se ha creado, documentado e investigado con ayuda/i)).toBeVisible();
});

test("las estadísticas solo se envían después del consentimiento", async ({ page }) => {
  const peticiones: string[] = [];
  page.on("request", (req) => {
    if (new URL(req.url()).pathname === "/api/metricas") peticiones.push(req.url());
  });
  await page.goto("/");
  const aviso = page.getByRole("dialog", { name: "Aviso inicial" });
  await expect(aviso).toBeVisible({ timeout: 15_000 });
  await page.waitForTimeout(300);
  expect(peticiones).toHaveLength(0);
  await aviso.getByRole("button", { name: "Aceptar estadísticas" }).click();
  const invitado = page.getByRole("button", { name: /Entrar sin clave/ });
  if (await invitado.isVisible()) await invitado.click();
  await page.getByRole("link", { name: "Mi perfil" }).click();
  await expect.poll(() => peticiones.length).toBeGreaterThan(0);
});

test("escribir despacio cuenta una sola búsqueda terminada", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("encaja.entrada", "1");
    localStorage.setItem("encaja.aviso-legal.v2", "1");
    localStorage.setItem("encaja.consentimiento-metricas", "si");
  });
  const eventos: { tipo?: string; categoria?: string }[] = [];
  page.on("request", (req) => {
    if (new URL(req.url()).pathname !== "/api/metricas" || req.method() !== "POST") return;
    try {
      const cuerpo = req.postDataJSON() as { tipo?: string; categoria?: string };
      if (cuerpo.tipo === "busqueda") eventos.push(cuerpo);
    } catch {
      // Los latidos enviados como beacon no forman parte de esta comprobación.
    }
  });
  await page.route(/\/api\/convocatorias(?:\?.*)?$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ filas: [], relajado: null, prestaciones: [] }),
    });
  });
  await page.goto("/");
  await page.getByPlaceholder("Busca una ayuda…").pressSequentially("alquiler", { delay: 350 });
  await expect.poll(() => eventos.length, { timeout: 5_000 }).toBe(1);
  expect(eventos[0]?.categoria).toBe("vivienda");
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
  await expect(page.getByRole("heading", { name: "Mi actividad" })).toBeVisible();
});

test("el panel del usuario muestra tiempo, búsquedas e historial con vigencia", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => {
    localStorage.setItem("encaja.entrada", "1");
    localStorage.setItem("encaja.aviso-legal.v2", "1");
    localStorage.setItem(
      "encaja.metricas.v1",
      JSON.stringify({
        version: 1,
        primeraVisitaAt: "2026-08-01T10:00:00.000Z",
        ultimaActividadAt: "2026-08-07T10:00:00.000Z",
        tiempoActivoSegundos: 3900,
        tiempoRadarSegundos: 1200,
        paginasVistas: 12,
        usosAgente: 2,
        busquedasTotal: 17,
        ayudasConsultadasTotal: 23,
        busquedas: [{ texto: "ayuda para alquiler", categoria: "vivienda", resultados: 4, fecha: "2026-08-07T10:00:00.000Z" }],
        ayudasVistas: [{
          codigoBdns: "123456",
          titulo: "Ayuda antigua para el alquiler",
          organo: "Ayuntamiento",
          fechaInicioSol: "2025-01-01",
          fechaFinSol: "2025-12-31",
          rangoFechas: "1 ene — 31 dic 2025",
          vistaAt: "2026-08-07T10:00:00.000Z",
          veces: 3,
        }],
      }),
    );
  });
  await page.goto("/expedientes");
  await expect(page.getByText("1 h 5 min")).toBeVisible();
  await expect(page.getByText("20 min")).toBeVisible();
  await expect(page.getByText("17", { exact: true })).toBeVisible();
  await expect(page.getByText("23", { exact: true })).toBeVisible();
  await expect(page.getByText("ayuda para alquiler")).toBeVisible();
  await expect(page.getByText("Ayuda antigua para el alquiler")).toBeVisible();
  await expect(page.getByText("Plazo cerrado")).toBeVisible();
});

test("el panel admin exige clave y nunca devuelve secretos del cliente", async ({ page }, testInfo) => {
  const movil = testInfo.project.name === "mobile";
  const visitanteId = movil
    ? "11111111-1111-4111-8111-111111111112"
    : "11111111-1111-4111-8111-111111111111";
  const codigoBdns = movil ? "900002" : "900001";
  const sinOrigen = await page.request.post("/api/metricas", {
    data: {
      visitanteId,
      sesionId: "22222222-2222-4222-8222-222222222222",
      tipo: "pagina",
      pagina: "/",
    },
  });
  expect(sinOrigen.status()).toBe(403);

  const demasiadoGrande = await page.request.post("/api/metricas", {
    headers: { Origin: "http://127.0.0.1:3102" },
    data: {
      visitanteId: "11111111-1111-4111-8111-111111111111",
      sesionId: "22222222-2222-4222-8222-222222222222",
      tipo: "pagina",
      pagina: "/",
      relleno: "x".repeat(5_000),
    },
  });
  expect(demasiadoGrande.status()).toBe(413);

  const duracionInvalida = await page.request.post("/api/metricas", {
    headers: { Origin: "http://127.0.0.1:3102" },
    data: {
      visitanteId,
      sesionId: "22222222-2222-4222-8222-222222222222",
      tipo: "latido",
      pagina: "/",
      duracionSegundos: "mucho",
    },
  });
  expect(duracionInvalida.status()).toBe(400);

  const jsonRoto = await page.request.post("/api/metricas", {
    headers: {
      "Content-Type": "application/json",
      Origin: "http://127.0.0.1:3102",
    },
    data: "{",
  });
  expect(jsonRoto.status()).toBe(400);

  const metrica = await page.request.post("/api/metricas", {
    headers: { Origin: "http://127.0.0.1:3102" },
    data: {
      visitanteId,
      sesionId: "22222222-2222-4222-8222-222222222222",
      tipo: "agente_usado",
      pagina: "/",
      categoria: "guiado",
      valor: 2,
      claveIa: "sk-no-debe-guardarse",
      mensaje: "dato privado que no debe guardarse",
    },
  });
  expect(metrica.status()).toBe(202);
  const ayuda = await page.request.post("/api/metricas", {
    headers: { Origin: "http://127.0.0.1:3102" },
    data: {
      visitanteId,
      sesionId: "22222222-2222-4222-8222-222222222222",
      tipo: "ayuda_abierta",
      pagina: "/",
      codigoBdns,
    },
  });
  expect(ayuda.status()).toBe(202);

  await page.goto("/admin");
  await expect(page.getByRole("heading", { name: "Administración" })).toBeVisible();
  await page.getByLabel("Clave de administración").fill("incorrecta");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page.getByText("Clave incorrecta")).toBeVisible();
  await page.getByLabel("Clave de administración").fill("clave-e2e");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page.getByRole("heading", { name: "Métricas de administración" })).toBeVisible();
  await expect(page.getByText("Consultas al orientador").first()).toBeVisible();

  const respuesta = await page.request.get("/api/admin/metricas?dias=7");
  expect(respuesta.status()).toBe(200);
  const texto = await respuesta.text();
  expect(texto).not.toContain("sk-no-debe-guardarse");
  expect(texto).not.toContain("dato privado");

  const borrado = await page.request.delete("/api/metricas", {
    headers: { Origin: "http://127.0.0.1:3102" },
    data: { visitanteId },
  });
  expect(borrado.status()).toBe(200);
  const despues = await page.request.get("/api/admin/metricas?dias=7");
  expect(((await despues.json()) as { ayudas: { codigo: string }[] }).ayudas).not.toContainEqual(
    expect.objectContaining({ codigo: codigoBdns }),
  );
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
