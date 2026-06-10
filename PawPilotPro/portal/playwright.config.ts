import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright config for the PawPilotPro portal.
 *
 * Scope today: smoke + public-route checks. The full E2E suite
 * (accept-invite, book → approve, vax roundtrip) needs a dedicated
 * test tenant — see docs/superpowers/plans/2026-05-25-client-portal-app.md
 * Phase 8 for the data-seeding strategy.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: process.env.PORTAL_URL ?? "http://localhost:5175",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "iphone-se",         use: { ...devices["iPhone SE (3rd generation)"] } },
    { name: "iphone-11-pro-max", use: { ...devices["iPhone 11 Pro Max"] } },
  ],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:5175",
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
