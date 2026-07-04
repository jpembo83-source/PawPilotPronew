import { test as setup, expect } from '@playwright/test';

// Credentials MUST come from the environment (CI: repo secrets TEST_EMAIL /
// TEST_PASSWORD; locally: export them before running playwright). No hardcoded
// fallback — the previous defaults leaked a real password into the repo.
const TEST_EMAIL = process.env.TEST_EMAIL;
const TEST_PASSWORD = process.env.TEST_PASSWORD;

setup('authenticate', async ({ page }) => {
  if (!TEST_EMAIL || !TEST_PASSWORD) {
    throw new Error(
      'TEST_EMAIL and TEST_PASSWORD environment variables are required for the e2e suite. ' +
        'In CI, add them as repository secrets (Settings -> Secrets and variables -> Actions); ' +
        'locally, export them before running playwright.'
    );
  }

  // Always do a fresh login to avoid token expiry issues
  await page.goto('/login');
  await page.waitForLoadState('networkidle');

  await page.getByLabel(/email/i).fill(TEST_EMAIL);
  await page.locator('input[type="password"]').fill(TEST_PASSWORD);
  // Check "Remember Me" so mdc-temp-login-flag is NOT set in localStorage.
  // Without this, AuthContext.checkTemporarySession() signs the user out
  // whenever sessionStorage is empty (i.e. every new Playwright browser context).
  const rememberMe = page.locator('#rememberMe');
  if (await rememberMe.isVisible()) await rememberMe.check();
  await page.getByRole('button', { name: /sign in|log in/i }).click();

  // Wait for redirect away from /login — up to 20s
  await page.waitForURL(url => !url.pathname.includes('/login'), { timeout: 20000 });

  // Wait for the app to fully hydrate (sidebar or main heading visible)
  await page.waitForSelector('h1, h2, nav, aside, [class*="sidebar"]', { timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(1000);

  // Save auth state
  await page.context().storageState({ path: 'tests/e2e/.auth/user.json' });
});
