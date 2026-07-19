/**
 * Transport module E2E test.
 *
 * Flow:
 *   1. Create a test household + pet (standalone setup — no dependency on workflows.spec.ts)
 *   2. Navigate to /transport — verify dashboard loads
 *   3. Open "New Transport Job" dialog
 *   4. Search for the test household → select it
 *   5. Select the pet
 *   6. Fill transport details (pickup address, date, time window)
 *   7. Submit → verify success toast
 *   8. Navigate to /transport/jobs — verify job appears in list
 *   9. Open job detail — verify status and controls
 *  10. Cleanup: delete the test household
 */
import { test, expect } from '@playwright/test';

const RUN_ID = Date.now();
const HOUSEHOLD_NAME = `E2E-Transport-${RUN_ID}`;
const PET_NAME = `TransportDog-${RUN_ID}`;

let householdId: string | null = null;

test.describe.configure({ mode: 'serial' });

test.describe('Transport module', () => {

  // ── setup ──────────────────────────────────────────────────────────────────

  test('0. Setup: create household + pet for transport test', async ({ page }) => {
    test.setTimeout(90000); // setup does many steps; 30s default is too tight on cold start
    // Create household
    await page.goto('/customers/new', { timeout: 45000 });
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('#name')).toBeVisible({ timeout: 15000 });
    await page.fill('#name', HOUSEHOLD_NAME);
    await page.getByRole('button', { name: /create household/i }).click();
    await page.waitForURL(
      url => /\/customers\/[^/]+$/.test(url.pathname) && !url.pathname.endsWith('/new'),
      { timeout: 25000 }
    );
    const match = page.url().match(/\/customers\/([^/?#]+)/);
    expect(match).toBeTruthy();
    householdId = match![1];
    expect(householdId).not.toBe('new');

    // Add a pet via the Pets tab
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);
    await expect(page.locator('[role="tablist"]')).toBeVisible({ timeout: 10000 });
    await page.getByRole('tab', { name: /pets/i }).click();
    await page.waitForTimeout(1000);

    const addPetBtn = page.getByRole('button', { name: /add pet/i }).first();
    await expect(addPetBtn).toBeVisible({ timeout: 8000 });
    await addPetBtn.click();

    // Fill pet name in the modal
    const dialog = page.locator('[role="dialog"]').first();
    await expect(dialog).toBeVisible({ timeout: 5000 });
    await dialog.locator('input#name, input[placeholder*="name" i]').first().fill(PET_NAME);

    // Submit
    await dialog.getByRole('button', { name: /add pet|save|create/i }).first().click();
    await dialog.waitFor({ state: 'hidden', timeout: 15000 });

    // Verify pet appears
    await page.waitForTimeout(1500);
    const activePanel = page.locator('[role="tabpanel"][data-state="active"]');
    await expect(activePanel).toContainText(PET_NAME, { timeout: 10000 });
  });

  // ── 1. Transport dashboard ─────────────────────────────────────────────────

  test('1. Transport dashboard loads', async ({ page }) => {
    await page.goto('/transport', { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    // Heading and module tabs should be visible
    await expect(page.locator('h1, h2').filter({ hasText: /transport/i }).first()).toBeVisible({ timeout: 10000 });

    // Key nav tabs
    await expect(page.locator('a, [role="tab"]').filter({ hasText: /dashboard/i }).first()).toBeVisible();
    await expect(page.locator('a, [role="tab"]').filter({ hasText: /jobs/i }).first()).toBeVisible();
  });

  // ── 2. Jobs list ───────────────────────────────────────────────────────────

  test('2. Jobs list page loads', async ({ page }) => {
    await page.goto('/transport/jobs', { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    // Page should render without crashing
    const body = await page.locator('body').innerText();
    expect(body).not.toContain('undefined/functions');
    expect(body).not.toContain('Cannot read');

    // Should have transport heading context
    await expect(page.locator('h2').filter({ hasText: /transport jobs/i }).first()).toBeVisible({ timeout: 8000 });

    // Core controls of the jobs list must be present — proves the page
    // actually rendered its UI, not just an error boundary with "transport"
    // in the text.
    await expect(page.getByPlaceholder(/search by pet/i)).toBeVisible({ timeout: 8000 });
    await expect(page.getByRole('button', { name: /new job/i })).toBeVisible();
    await expect(page.locator('body')).toContainText(/job(s)? found/i, { timeout: 8000 });

    // Opening Filters must reveal the status filter, including the new
    // 'Failed' option (distinct from 'Cancelled').
    await page.getByRole('button', { name: /filters/i }).click();
    await expect(page.locator('option', { hasText: /^Failed$/ })).toHaveCount(1);
  });

  // ── 3. Create a transport job via the 4-step dialog ────────────────────────

  test('3. Create transport job via New Transport Job dialog', async ({ page }) => {
    expect(householdId).toBeTruthy();

    await page.goto('/transport', { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2500);

    // Open the dialog
    const newJobBtn = page.getByRole('button', { name: /new transport job/i });
    await expect(newJobBtn).toBeVisible({ timeout: 10000 });
    await newJobBtn.click();

    const dialog = page.locator('[role="dialog"]').filter({ hasText: /new transport job/i });
    await expect(dialog).toBeVisible({ timeout: 8000 });

    // ── Step 1: Search for household ──────────────────────────────────────────
    const searchInput = dialog.locator('input').first();
    await expect(searchInput).toBeVisible({ timeout: 5000 });
    await searchInput.fill(HOUSEHOLD_NAME);
    await page.waitForTimeout(1500); // debounce + API call

    // Click the household result
    const householdResult = page.locator('button').filter({ hasText: HOUSEHOLD_NAME }).first();
    await expect(householdResult).toBeVisible({ timeout: 10000 });
    await householdResult.click();

    // ── Step 2: Select pet ────────────────────────────────────────────────────
    await page.waitForTimeout(500);
    const petCard = dialog.locator('button').filter({ hasText: PET_NAME }).first();
    await expect(petCard).toBeVisible({ timeout: 8000 });
    await petCard.click();

    // ── Step 3: Transport details ─────────────────────────────────────────────
    await page.waitForTimeout(500);

    // Set date to tomorrow to avoid "past date" issues
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dateStr = tomorrow.toISOString().split('T')[0];
    const dateInput = dialog.locator('input[type="date"]').first();
    await dateInput.fill(dateStr);

    // Pickup address: default pickup_type is 'other', which renders a <textarea>
    // (not an <input>) — must target textarea, not input[placeholder*="address"]
    const pickupTextarea = dialog.locator('textarea[placeholder*="pick-up" i], textarea[placeholder*="address" i]').first();
    if (await pickupTextarea.isVisible({ timeout: 3000 }).catch(() => false)) {
      await pickupTextarea.fill('123 Test Street, London, SW1A 1AA');
    } else {
      // Fallback: ensure "Other" is selected, then fill the first textarea
      const otherBtn = dialog.locator('button').filter({ hasText: /^other$/i }).first();
      if (await otherBtn.isVisible().catch(() => false)) {
        await otherBtn.click();
        await page.waitForTimeout(300);
      }
      await dialog.locator('textarea').first().fill('123 Test Street, London, SW1A 1AA');
    }

    // Time window (optional fields)
    const timeStartInput = dialog.locator('input#timeStart, input[type="time"]').first();
    if (await timeStartInput.isVisible().catch(() => false)) {
      await timeStartInput.fill('08:00');
    }
    const timeEndInput = dialog.locator('input#timeEnd, input[type="time"]').nth(1);
    if (await timeEndInput.isVisible().catch(() => false)) {
      await timeEndInput.fill('09:00');
    }

    // Proceed to step 4 — button says "Review" and is enabled once an address is filled
    const reviewBtn = dialog.getByRole('button', { name: /review/i }).first();
    await expect(reviewBtn).toBeEnabled({ timeout: 5000 });
    await reviewBtn.click();
    await page.waitForTimeout(500);

    // ── Step 4: Submit ────────────────────────────────────────────────────────
    // Button text is "Create Transport Job" (full label, not just "Create Job")
    const createBtn = dialog.getByRole('button', { name: /create transport job/i }).first();
    await expect(createBtn).toBeVisible({ timeout: 8000 });
    await createBtn.click();

    // Wait for success or error
    const successToast = page.locator('[data-sonner-toast]').filter({ hasText: /created|success/i });
    const errorToast = page.locator('[data-sonner-toast]').filter({ hasText: /failed|error/i });

    await Promise.race([
      successToast.waitFor({ state: 'visible', timeout: 20000 }),
      errorToast.waitFor({ state: 'visible', timeout: 20000 }).then(async () => {
        const msg = await errorToast.innerText().catch(() => 'unknown error');
        throw new Error(`Transport job creation failed: ${msg}`);
      }),
      dialog.waitFor({ state: 'hidden', timeout: 20000 }),
    ]);
  });

  // ── 4. Verify job appears in jobs list ────────────────────────────────────

  test('4. Created job appears in transport jobs list', async ({ page }) => {
    await page.goto('/transport/jobs', { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(3000);

    // Search for the pet we created the job for and assert its row shows up —
    // this proves the created job round-tripped through the API into the
    // list, not merely that the page rendered some transport text.
    const search = page.getByPlaceholder(/search by pet/i);
    await expect(search).toBeVisible({ timeout: 8000 });
    await search.fill(PET_NAME);
    await page.waitForTimeout(1000);

    await expect(page.locator('body')).toContainText(PET_NAME, { timeout: 10000 });
    await expect(page.locator('body')).toContainText(HOUSEHOLD_NAME);
    // The row renders the pickup address we entered in test 3.
    await expect(page.locator('body')).toContainText(/123 Test Street/i);

    // Clicking the row opens the detail page for this job.
    await page.locator('text=' + PET_NAME).first().click();
    await expect(page.locator('h1').filter({ hasText: /transport job details/i })).toBeVisible({ timeout: 10000 });
  });

  // ── 5. Vehicle manager loads ──────────────────────────────────────────────

  test('5. Vehicle manager page loads', async ({ page }) => {
    test.setTimeout(90000); // navigation timeout 45s > default test timeout 30s
    await page.goto('/transport/vehicles', { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    // Should render a heading or empty state without crashing
    const body = await page.locator('body').innerText();
    expect(body).not.toContain('Cannot read');

    await expect(page.locator('h2').filter({ hasText: /fleet management/i })).toBeVisible({ timeout: 8000 });
    // The Add Vehicle affordance must be present (button in header, or in the
    // empty state) — proves the manager UI mounted, not just a shell.
    await expect(page.getByRole('button', { name: /add vehicle/i }).first()).toBeVisible({ timeout: 8000 });

    // Opening the dialog shows the vehicle form fields.
    await page.getByRole('button', { name: /add vehicle/i }).first().click();
    const dialog = page.locator('[role="dialog"]').first();
    await expect(dialog).toBeVisible({ timeout: 5000 });
    await expect(dialog.getByText(/licence plate/i)).toBeVisible();
    await expect(dialog.getByText(/capacity/i)).toBeVisible();
  });

  // ── 6. Driver view loads ──────────────────────────────────────────────────

  test('6. Driver dashboard loads and fetches a route', async ({ page }) => {
    // Regression guard: the desktop driver dashboard used to destructure a
    // nonexistent `session` from useAuth and gate its fetch on it, so it hung
    // on "Loading your route..." forever. Assert it resolves to a real state
    // (route content OR the no-jobs empty state), never the perpetual spinner.
    await page.goto('/transport/driver', { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(3000);

    const body = await page.locator('body').innerText();
    expect(body).not.toContain('Cannot read');

    await expect
      .poll(async () => (await page.locator('body').innerText()).toLowerCase(), { timeout: 15000 })
      .not.toContain('loading your route');

    // Resolved to either an active route (Start Route / Today's Route) or the
    // explicit empty state — both are valid, a stuck spinner is not.
    const resolved = /no active route|today's route|start route|route overview/i.test(
      await page.locator('body').innerText()
    );
    expect(resolved).toBeTruthy();
  });

  // ── cleanup ──────────────────────────────────────────────────────────────

  test.afterAll(async ({ browser }) => {
    if (!householdId || householdId === 'new') return;
    const ctx = await browser.newContext({ storageState: 'tests/e2e/.auth/user.json' });
    const page = await ctx.newPage();
    try {
      await page.goto(`/customers/${householdId}`, { waitUntil: 'domcontentloaded', timeout: 45000 });
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
        console.log('Transport test cleanup: household', householdId, 'deleted');
      } else {
        console.warn('Transport test cleanup: delete button not found for', householdId);
      }
    } catch (err) {
      console.error('Transport test cleanup failed:', err);
    } finally {
      await ctx.close();
    }
  });
});
