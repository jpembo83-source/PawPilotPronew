/**
 * Document upload E2E test.
 *
 * Creates a household → uploads an "other" document (no expiry required) to its
 * Documents tab → verifies the document appears in the list → cleans up by
 * deleting the household.
 *
 * Independent of workflows.spec.ts so it can run in isolation.
 */
import { test, expect, Page } from '@playwright/test';

const RUN_ID = Date.now();
const HOUSEHOLD_NAME = `E2E-Docs-${RUN_ID}`;
const DOC_NAME = `E2E-TestDoc-${RUN_ID}.pdf`;

let householdId: string | null = null;

test.describe.configure({ mode: 'serial' });

test.describe('Document upload', () => {
  test('1. Create a household for the doc test', async ({ page }) => {
    await page.goto('/customers/new', { timeout: 45000 });
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('#name')).toBeVisible({ timeout: 15000 });
    await page.fill('#name', HOUSEHOLD_NAME);
    await page.getByRole('button', { name: /create household/i }).click();
    await page.waitForURL(url => /\/customers\/[^/]+$/.test(url.pathname) && !url.pathname.endsWith('/new'), { timeout: 20000 });
    const match = page.url().match(/\/customers\/([^/?#]+)/);
    expect(match).toBeTruthy();
    householdId = match![1];
    expect(householdId).not.toBe('new');
  });

  test('2. Upload a document to the household', async ({ page }) => {
    expect(householdId).toBeTruthy();
    await page.goto(`/customers/${householdId}`);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    // Documents tab
    await expect(page.locator('[role="tablist"]')).toBeVisible({ timeout: 10000 });
    await page.getByRole('tab', { name: /documents/i }).click();
    await page.waitForTimeout(1500);

    // Open upload modal — button label is "Upload Document" (fixed in this session;
    // accept either spelling in case prod hasn't rebuilt yet)
    const uploadOpenBtn = page.getByRole('button', { name: /upload\s*(simple)?\s*document/i }).first();
    await expect(uploadOpenBtn).toBeVisible({ timeout: 10000 });
    await uploadOpenBtn.click();

    const dialog = page.locator('[role="dialog"]').filter({ hasText: /upload\s*(simple)?\s*document/i });
    await expect(dialog).toBeVisible({ timeout: 5000 });

    // Document type: pick "other" — it has requiresExpiry=false so the form is simpler.
    // The select is a native <select id="document_type">.
    await dialog.locator('#document_type').selectOption('other');

    // File: upload a small in-memory PDF
    const fileInput = dialog.locator('input[type="file"]#file');
    await fileInput.setInputFiles({
      name: DOC_NAME,
      mimeType: 'application/pdf',
      buffer: Buffer.from('%PDF-1.4\n%E2E test document\n%%EOF'),
    });

    // Document name
    await dialog.locator('#name').fill(DOC_NAME);

    // Submit — button label "Upload Document" or "Uploading…" while in-flight
    const submitBtn = dialog.getByRole('button', { name: /upload\s*(simple)?\s*document/i });
    await submitBtn.click();

    // Wait for dialog to close or error
    const errorToast = page.locator('[data-sonner-toast]').filter({ hasText: /failed/i });
    await Promise.race([
      dialog.waitFor({ state: 'hidden', timeout: 30000 }),
      errorToast.waitFor({ state: 'visible', timeout: 30000 }).then(async () => {
        throw new Error(`Upload failed: ${await errorToast.innerText()}`);
      }),
    ]);

    // Verify the document appears in the docs tab
    await page.waitForTimeout(2000);
    const activePanel = page.locator('[role="tabpanel"][data-state="active"]');
    await expect(activePanel).toContainText(DOC_NAME, { timeout: 10000 });
  });

  // ── cleanup ──────────────────────────────────────────────────────────────
  test.afterAll(async ({ browser }) => {
    if (!householdId || householdId === 'new') return;
    const ctx = await browser.newContext({ storageState: 'tests/e2e/.auth/user.json' });
    const page = await ctx.newPage();
    try {
      await page.goto(`/customers/${householdId}`);
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(3000);
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(500);
      const deleteBtn = page.getByRole('button', { name: /^delete household$/i });
      if (await deleteBtn.isVisible({ timeout: 8000 }).catch(() => false)) {
        await deleteBtn.click();
        const confirm = page.getByRole('button', { name: /yes, delete permanently/i });
        await confirm.click();
        await page.waitForURL(/\/customers\/?$/, { timeout: 15000 }).catch(() => {});
        console.log('Doc-test cleanup: household', householdId, 'deleted');
      } else {
        console.warn('Doc-test cleanup: delete button not found for', householdId);
      }
    } catch (err) {
      console.error('Doc-test cleanup failed:', err);
    } finally {
      await ctx.close();
    }
  });
});
