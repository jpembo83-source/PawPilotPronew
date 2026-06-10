/**
 * Incident logging E2E test.
 *
 * Logs an incident from /incidents and verifies it appears in the list.
 * Uses LOW severity so only the required fields are: location + summary.
 *
 * No fixture data needed — runs standalone.
 */
import { test, expect } from '@playwright/test';

const RUN_ID = Date.now();
const INCIDENT_SUMMARY = `E2E-Incident-${RUN_ID}`;

test.describe.configure({ mode: 'serial' });

test.describe('Incident logging', () => {
  test('create a low-severity incident and verify it appears in the list', async ({ page }) => {
    await page.goto('/incidents');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    // Open the create modal
    const reportBtn = page.getByRole('button', { name: /report incident/i });
    await expect(reportBtn).toBeVisible({ timeout: 10000 });
    await reportBtn.click();

    const dialog = page.locator('[role="dialog"]').filter({ hasText: /report incident/i });
    await expect(dialog).toBeVisible({ timeout: 5000 });

    // Location: pick the first non-empty option from the Radix Select.
    // Radix Select renders as a button with role=combobox; clicking it opens a
    // listbox of options with role=option.
    const locationLabel = dialog.locator('label', { hasText: /^location/i }).first();
    const locationTrigger = locationLabel.locator('xpath=following::*[@role="combobox"][1]');
    await locationTrigger.click();
    // Wait for the listbox to render and click the first option
    const firstLocationOption = page.locator('[role="option"]').first();
    await expect(firstLocationOption).toBeVisible({ timeout: 5000 });
    await firstLocationOption.click();

    // Severity, module, category all have sensible defaults (low / daycare / other) —
    // skip changing them.

    // Summary (required, max 200 chars)
    const summaryInput = dialog.locator('input[placeholder*="Brief description" i]');
    await expect(summaryInput).toBeVisible({ timeout: 5000 });
    await summaryInput.fill(INCIDENT_SUMMARY);

    // Submit
    const submitBtn = dialog.getByRole('button', { name: /^report incident$/i });
    await expect(submitBtn).toBeEnabled({ timeout: 5000 });
    await submitBtn.click();

    // Wait for either the success toast or an error toast
    const successToast = page.locator('[data-sonner-toast]').filter({ hasText: /incident reported successfully|incident created/i });
    const errorToast = page.locator('[data-sonner-toast]').filter({ hasText: /please|failed|required/i });

    await Promise.race([
      successToast.waitFor({ state: 'visible', timeout: 15000 }),
      errorToast.waitFor({ state: 'visible', timeout: 15000 }).then(async () => {
        throw new Error(`Incident creation failed: ${await errorToast.innerText()}`);
      }),
      dialog.waitFor({ state: 'hidden', timeout: 15000 }),
    ]);

    // The dialog should close on success
    await expect(dialog).toBeHidden({ timeout: 5000 });

    // The incident should appear in the table on /incidents
    await page.waitForTimeout(2000);
    const bodyText = await page.locator('body').innerText();
    expect(bodyText, `Expected to find "${INCIDENT_SUMMARY}" on /incidents after creation`).toContain(INCIDENT_SUMMARY);
  });
});
