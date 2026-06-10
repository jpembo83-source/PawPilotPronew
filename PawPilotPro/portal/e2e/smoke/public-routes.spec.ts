import { test, expect } from "@playwright/test";

/**
 * Smoke tests for routes that don't need auth.
 * Full authed E2E suite lives in e2e/critical/ — seeded against a test tenant.
 */

test.describe("Public routes render", () => {
  test("/login shows the Forest Teal welcome screen", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByText(/PawPilotPro/i)).toBeVisible();
    await expect(page.getByRole("heading", { name: /welcome back/i })).toBeVisible();
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByLabel(/password/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /sign in/i })).toBeVisible();
  });

  test("/accept-invite without a token shows the friendly fallback", async ({ page }) => {
    await page.goto("/accept-invite");
    await expect(page.getByRole("heading", { name: /invite link looks off/i })).toBeVisible();
  });

  test("/accept-invite with a token shows the password-set screen", async ({ page }) => {
    await page.goto("/accept-invite?token=" + "0".repeat(60));
    await expect(page.getByRole("heading", { name: /set your password/i })).toBeVisible();
    await expect(page.getByLabel(/password/i)).toBeVisible();
  });

  test("an authed route redirects unauthenticated visitors to /login", async ({ page }) => {
    await page.goto("/");
    await page.waitForURL(/\/login/);
    expect(page.url()).toContain("/login");
  });
});
