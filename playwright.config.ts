import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "line",
  use: {
    baseURL: "http://127.0.0.1:3102",
    trace: "retain-on-failure",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
  webServer: {
    command: "npm run start:e2e",
    env: {
      ...process.env,
      ENCAJA_ADMIN_PASSWORD: "clave-e2e",
      ENCAJA_ADMIN_SESSION_SECRET: "secreto-de-pruebas-e2e-no-usar-en-produccion",
      // Las pruebas nunca deben escribir en la base Neon aunque exista un .env local.
      DATABASE_URL: "",
      VERCEL: "",
    },
    url: "http://127.0.0.1:3102",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
