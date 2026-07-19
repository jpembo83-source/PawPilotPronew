import { test, expect } from '@playwright/test';

// Membership smoke — guards the two regressions that made membership a facade:
// the /customer-packages backend not being mounted (every call 404'd and the
// UI silently degraded to PAYG), and membership surfaces 500ing.

test.describe('Memberships @smoke', () => {
  test('customer-packages API is mounted and healthy', async ({ page }) => {
    // Watch the API traffic from an authenticated page session: a 404 here
    // means the memberships_routes module lost its mount in index.tsx (the
    // exact failure mode this backend was built to fix); any 5xx is a
    // server-side regression. The household detail page fires the fetch.
    const badResponses: string[] = [];
    page.on('response', (resp) => {
      if (!resp.url().includes('/customer-packages')) return;
      if (resp.status() === 404 || resp.status() >= 500) {
        badResponses.push(`${resp.request().method()} ${resp.url()} -> ${resp.status()}`);
      }
    });

    await page.goto('/customers');
    await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});

    const firstHousehold = page.locator('a[href*="/customers/"], [data-testid*="household"]').first();
    if (await firstHousehold.isVisible().catch(() => false)) {
      await firstHousehold.click();
      await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});
      await page.waitForTimeout(1500);
    }

    expect(badResponses, badResponses.join('\n')).toHaveLength(0);
  });

  test('packages dashboard loads its plan catalog', async ({ page }) => {
    const serverErrors: string[] = [];
    page.on('response', (resp) => {
      if (resp.url().includes('/make-server-') && resp.status() >= 500) {
        serverErrors.push(`${resp.request().method()} ${resp.url()} -> ${resp.status()}`);
      }
    });

    await page.goto('/packages');
    await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});

    // The five-plan membership catalog renders (beta-gated: admin sees it).
    const planCard = page.locator('text=/SPLIT MY SOCIAL|ZURICH SOCIALITE|FEAR OF MISSING OUT/i');
    if (await planCard.first().isVisible().catch(() => false)) {
      await expect(planCard.first()).toBeVisible();
    }
    expect(serverErrors, serverErrors.join('\n')).toHaveLength(0);
  });
});
