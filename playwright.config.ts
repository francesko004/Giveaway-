import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;
const DATABASE_URL = process.env.E2E_DATABASE_URL ?? "postgresql://postgres@localhost:5432/giveaway_e2e";

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"]],
  timeout: 60_000,
  globalSetup: "./tests/e2e/global-setup.ts",
  use: { baseURL: `http://localhost:${PORT}`, trace: "off" },
  projects: [
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
  webServer: {
    // Requires a production build (npm run build). The e2e database is reset in globalSetup.
    command: `npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}/api/health`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      DATABASE_URL,
      APP_URL: `http://localhost:${PORT}`,
      SESSION_SECRET: "e2e-secret-e2e-secret-e2e-secret-0123456789",
      EMAIL_DISABLED: "1",
      DISABLE_SCHEDULER: "1",
      NODE_ENV: "production",
    },
  },
});
