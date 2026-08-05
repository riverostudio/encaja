#!/usr/bin/env tsx
const base = (process.env.ENCAJA_URL ?? "https://usar-encaja.vercel.app").replace(/\/$/, "");

async function esperarDespliegue(): Promise<void> {
  for (let intento = 1; intento <= 12; intento++) {
    try {
      const r = await fetch(`${base}/api/estado`, { signal: AbortSignal.timeout(20_000) });
      if (r.ok) return;
    } catch {
      // El alias puede tardar unos segundos en propagarse.
    }
    await new Promise((resolve) => setTimeout(resolve, 5000));
  }
  throw new Error("El despliegue no ha respondido a tiempo.");
}

async function comprobar() {
  await esperarDespliegue();
  for (const ruta of ["/", "/ficha", "/expedientes", "/privacidad", "/api/estado", "/api/sync"]) {
    const r = await fetch(`${base}${ruta}`, { redirect: "manual" });
    if (r.status !== 200) throw new Error(`${ruta}: esperaba 200 y devuelve ${r.status}`);
    console.log(`OK ${r.status} ${ruta}`);
  }
  const expedientes = await fetch(`${base}/api/expedientes`);
  if (expedientes.status !== 405) {
    throw new Error(`/api/expedientes debe estar aislada (405), devuelve ${expedientes.status}`);
  }
  const mantenimiento = await fetch(`${base}/api/sync`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ todaEspana: true }),
  });
  if (mantenimiento.status !== 405) {
    throw new Error(`/api/sync POST debe estar desactivada (405), devuelve ${mantenimiento.status}`);
  }
  const raiz = await fetch(base);
  if (!raiz.headers.get("content-security-policy")?.includes("frame-ancestors 'none'")) {
    throw new Error("Falta la política CSP en producción.");
  }
  console.log("Producción verificada.");
}

comprobar().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});

