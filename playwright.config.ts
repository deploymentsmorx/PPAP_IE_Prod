import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  // All tests share one dev server and one (Neon, connection-limited) dev
  // database — run serially rather than risk contention/flakiness from
  // parallel workers hitting both at once.
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: "list",
  // Neon's free-tier database auto-suspends when idle; the first query
  // after a wake can take several seconds, so allow more headroom than
  // Playwright's 5s default for assertions that round-trip to the DB.
  expect: { timeout: 20_000 },
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
