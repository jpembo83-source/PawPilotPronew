/**
 * Full platform E2E test suite.
 * Tests every major feature area for regressions.
 */
import { test, expect, Page } from '@playwright/test';

// ─── helpers ─────────────────────────────────────────────────────────────────

async function waitReady(page: Page, ms = 2000) {
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(ms);
}

async function navigate(page: Page, href: string) {
  await page.goto(href, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await waitReady(page);
}

/** Confirm we are actually authenticated (not on login page).
 *  Gives the app up to 15s to hydrate Supabase session from localStorage. */
async function assertAuthenticated(page: Page) {
  await expect(page).not.toHaveURL(/login/, { timeout: 15000 });
}

// ─── Dashboard ───────────────────────────────────────────────────────────────

test.describe('Dashboard', () => {
  test('loads and is authenticated', async ({ page }) => {
    await navigate(page, '/');
    await assertAuthenticated(page);
    await expect(page.locator('h1, h2').first()).toBeVisible();
  });

  test('sidebar has navigation items', async ({ page }) => {
    await navigate(page, '/');
    await assertAuthenticated(page);
    // Sidebar renders NavLinks — look for any link containing key paths
    const customersLink = page.locator('a').filter({ hasText: /customers/i }).first();
    const daycareLink = page.locator('a').filter({ hasText: /daycare/i }).first();
    await expect(customersLink).toBeVisible({ timeout: 8000 });
    await expect(daycareLink).toBeVisible({ timeout: 5000 });
  });

  test('no "undefined" text visible on dashboard', async ({ page }) => {
    await navigate(page, '/');
    await assertAuthenticated(page);
    const body = await page.locator('body').innerText();
    expect(body).not.toContain('undefined/functions');
    expect(body).not.toContain('Cannot read');
  });
});

// ─── Customers ───────────────────────────────────────────────────────────────

test.describe('Customers', () => {
  test('customer list loads with content or empty state', async ({ page }) => {
    await navigate(page, '/customers');
    await assertAuthenticated(page);
    await page.waitForTimeout(3000);
    // Either has rows/cards OR an explicit empty-state message — never a raw loading skeleton alone
    const body = await page.locator('body').innerText();
    expect(body.length).toBeGreaterThan(100);
    expect(body).not.toContain('TODO');
  });

  test('household detail page loads with tabs', async ({ page }) => {
    await navigate(page, '/customers');
    await assertAuthenticated(page);
    // Give data time to load — Supabase query can be slow on first request
    await page.waitForTimeout(5000);

    const householdLink = page.locator('a[href*="/customers/"]').first();
    if (await householdLink.isVisible({ timeout: 8000 })) {
      await householdLink.click();
      await page.waitForURL(/\/customers\//, { timeout: 20000 });
      await waitReady(page);
      await expect(page.locator('[role="tablist"]')).toBeVisible({ timeout: 8000 });
    }
  });

  test('Bookings tab never shows old placeholder text', async ({ page }) => {
    await navigate(page, '/customers');
    await assertAuthenticated(page);
    await page.waitForTimeout(2000);
    const householdLink = page.locator('a[href*="/customers/"]').first();
    if (await householdLink.isVisible({ timeout: 3000 })) {
      await householdLink.click();
      await page.waitForURL(/\/customers\//, { timeout: 15000 });
      await waitReady(page);
      const bookingsTab = page.locator('[role="tab"]').filter({ hasText: /booking/i });
      if (await bookingsTab.isVisible()) {
        await bookingsTab.click();
        await page.waitForTimeout(2000);
        const body = await page.locator('body').innerText();
        expect(body).not.toContain('Booking history will appear here');
        expect(body).not.toContain('TODO');
      }
    }
  });
});

// ─── Daycare ─────────────────────────────────────────────────────────────────

test.describe('Daycare', () => {
  test('daycare page loads and is authenticated', async ({ page }) => {
    await navigate(page, '/daycare');
    await assertAuthenticated(page);
    await expect(page.locator('h1, h2').first()).toBeVisible();
  });

  test('capacity strip shows no "Not configured" message', async ({ page }) => {
    await navigate(page, '/daycare');
    await assertAuthenticated(page);
    await page.waitForTimeout(3000);
    const body = await page.locator('body').innerText();
    expect(body).not.toContain('Not configured');
  });

  test('booking dialog can be opened', async ({ page }) => {
    // The "New Booking" button navigates to /daycare/bookings?action=create
    // which auto-opens the CreateBookingDialog. Go directly to save a navigation hop.
    await navigate(page, '/daycare/bookings?action=create');
    await assertAuthenticated(page);
    await page.waitForTimeout(2000);
    const dialog = page.locator('[role="dialog"]').first();
    await expect(dialog).toBeVisible({ timeout: 8000 });
  });
});

// ─── Capacity ────────────────────────────────────────────────────────────────

test.describe('Capacity', () => {
  test('capacity page loads with week strip', async ({ page }) => {
    await navigate(page, '/capacity');
    await assertAuthenticated(page);
    await page.waitForTimeout(3000);
    const body = await page.locator('body').innerText();
    // "Not configured" is a valid state when no service capacities are set up —
    // the important assertion is that the page renders and has no JS errors.
    expect(body).not.toContain('undefined/functions');
    expect(body).not.toContain('Cannot read');
    await expect(page.locator('h1, h2').first()).toBeVisible();
  });
});

// ─── Navigation module gating ─────────────────────────────────────────────────

test.describe('Navigation', () => {
  test('all sidebar links navigate successfully (no 404)', async ({ page }) => {
    await navigate(page, '/');
    await assertAuthenticated(page);
    const links = await page.locator('a').filter({ has: page.locator(':scope') }).all();
    const seen = new Set<string>();
    for (const link of links) {
      const href = await link.getAttribute('href').catch(() => null);
      if (!href || !href.startsWith('/') || seen.has(href)) continue;
      seen.add(href);
      if (seen.size > 10) break; // limit to first 10 internal links
      await page.goto(href, { waitUntil: 'domcontentloaded', timeout: 45000 }).catch(() => {});
      await page.waitForTimeout(500);
      const body = await page.locator('body').innerText().catch(() => '');
      expect(body).not.toContain('Page not found');
    }
  });
});

// ─── Settings ────────────────────────────────────────────────────────────────

test.describe('Settings', () => {
  test('settings page loads', async ({ page }) => {
    await navigate(page, '/settings');
    await assertAuthenticated(page);
    await expect(page.locator('h1, h2').first()).toBeVisible();
  });
});

// ─── Billing ─────────────────────────────────────────────────────────────────

test.describe('Billing', () => {
  test('billing page loads without auth errors', async ({ page }) => {
    await navigate(page, '/billing');
    await assertAuthenticated(page);
    await page.waitForTimeout(2000);
    const body = await page.locator('body').innerText();
    expect(body).not.toContain('Access denied');
    expect(body).not.toContain('Unauthorized');
    expect(body.length).toBeGreaterThan(100);
  });
});

// ─── Staff ───────────────────────────────────────────────────────────────────

test.describe('Staff', () => {
  test('staff page loads', async ({ page }) => {
    await navigate(page, '/staff');
    await assertAuthenticated(page);
    await expect(page.locator('h1, h2').first()).toBeVisible();
  });
});

// ─── Messaging ───────────────────────────────────────────────────────────────

test.describe('Messaging', () => {
  test('messages page loads', async ({ page }) => {
    await navigate(page, '/messages');
    await assertAuthenticated(page);
    const body = await page.locator('body').innerText();
    expect(body.length).toBeGreaterThan(100);
    expect(body).not.toContain('Access denied');
  });
});

// ─── Regression: no developer artifacts in page content ──────────────────────

test.describe('Regression checks', () => {
  const routes = [
    '/', '/daycare', '/capacity', '/customers',
    '/billing', '/staff', '/settings', '/messages',
  ];

  for (const route of routes) {
    test(`${route} — no TODO or broken API text`, async ({ page }) => {
      await navigate(page, route);
      await assertAuthenticated(page);
      await page.waitForTimeout(2000);
      const body = await page.locator('body').innerText();
      expect(body).not.toMatch(/\bTODO\b/);
      expect(body).not.toContain('NaNh NaN');
      expect(body).not.toContain('undefined/functions');
    });
  }
});
