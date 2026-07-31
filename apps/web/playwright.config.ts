import { defineConfig, devices } from "@playwright/test";

const port = Number(process.env.PLAYWRIGHT_PORT ?? 3000);
const baseURL = `http://localhost:${port}`;

export default defineConfig({
  testDir: "./tests",
  timeout: 120 * 1000,
  expect: { timeout: 10 * 1000 },
  use: {
    baseURL,
    trace: "on-first-retry",
    headless: true,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: `pnpm dev --port ${port}`,
    port,
    cwd: __dirname,
    reuseExistingServer: !process.env.CI,
    env: {
      NEXT_PUBLIC_API_BASE_URL: "http://localhost:4000/api/v1",
      NEXT_PUBLIC_USE_API_MOCKS: "true",
      NEXTAUTH_SECRET: "test-secret",
      NEXTAUTH_URL: baseURL,
    },
  },
});
