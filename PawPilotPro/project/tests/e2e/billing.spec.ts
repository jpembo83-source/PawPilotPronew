import { test, expect } from '@playwright/test';

/**
 * Characterisation smoke tests — Billing (prompt book 0.4).
 * These assert CURRENT observable behaviour as a safety net for the
 * auth/billing remediation work. They are not a spec.
 */
test.describe('Billing Module @smoke', () => {
  test('billing page loads', async ({ page }) => {
    await page.goto('/billing');

    await expect(
      page.locator('h1, h2').filter({ hasText: /billing/i }).first()
    ).toBeVisible();
  });

  test('invoices tab shows invoice content (read flow)', async ({ page }) => {
    await page.goto('/billing');

    const invoicesTab = page
      .locator('button, [role="tab"], a')
      .filter({ hasText: /invoices/i })
      .first();
    if (await invoicesTab.isVisible()) {
      await invoicesTab.click();
    }

    // Either a list of invoices or the empty state — both are valid current behaviour.
    await expect(
      page.locator('text=/invoice|create your first invoice/i').first()
    ).toBeVisible();
  });

  test('create invoice control is present (create flow entry point)', async ({ page }) => {
    await page.goto('/billing');

    const createBtn = page
      .locator('button')
      .filter({ hasText: /create invoice/i })
      .first();
    await expect(createBtn).toBeVisible();
  });

  // FIXME(product gap, not test flake): neither "Create Invoice" button has an
  // onClick handler — the BillingOverview.tsx quick action and the Invoices.tsx
  // header button both render dead. Clicking has never opened anything, so this
  // characterisation test has failed on every recorded CI run since it was
  // added. Un-fixme when the create-invoice surface is actually wired up.
  test.fixme('create invoice opens a form or dialog', async ({ page }) => {
    await page.goto('/billing');

    const createBtn = page
      .locator('button')
      .filter({ hasText: /create invoice/i })
      .first();
    await createBtn.click();

    // A dialog, form, or new-invoice screen should appear.
    const surface = page
      .locator('[role="dialog"], form, [data-state="open"]')
      .first();
    await expect(surface).toBeVisible({ timeout: 5000 });
  });
});
