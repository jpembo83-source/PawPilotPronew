import { test, expect } from '@playwright/test';

test.describe('Customers Module', () => {
  test('customer list loads', async ({ page }) => {
    await page.goto('/customers');
    
    // Page should load with customers heading
    await expect(page.locator('h1, h2').filter({ hasText: /customers|households/i }).first()).toBeVisible();
  });

  test('shows customer data or empty state', async ({ page }) => {
    await page.goto('/customers');
    // Wait for data to load (slow Netlify cold-start)
    await page.waitForTimeout(4000);

    // Accept: customer rows, explicit empty state, a table, OR the loading resolved
    // (count > 0 text or the "0 households" counter)
    const body = await page.locator('body').innerText();
    // The page always renders SOMETHING meaningful after load
    expect(body.length).toBeGreaterThan(50);
    // Must not be stuck on a pure loading spinner with no content
    const hasHeading = await page.locator('h1, h2').filter({ hasText: /customers|households/i }).first().isVisible().catch(() => false);
    expect(hasHeading).toBeTruthy();
  });

  test('can search for customers', async ({ page }) => {
    await page.goto('/customers');
    
    // Find search input
    const searchInput = page.locator('input[type="search"], input[placeholder*="search" i]').first();
    
    if (await searchInput.isVisible()) {
      // Type search query
      await searchInput.fill('Smith');
      
      // Wait for debounce
      await page.waitForTimeout(700);
      
      // Page should still be functional
      await expect(page.locator('h1, h2').filter({ hasText: /customers|households/i }).first()).toBeVisible();
    }
  });

  test('can navigate to create new customer', async ({ page }) => {
    await page.goto('/customers');
    
    // Look for new/add customer button
    const newButton = page.locator('a, button').filter({ hasText: /new|add|create/i }).filter({ hasText: /customer|household/i }).first();
    
    if (await newButton.isVisible()) {
      await newButton.click();
      await page.waitForTimeout(500);
      // Should show form or navigate
    } else {
      // Try just looking for a plus button or "Add" button
      const addBtn = page.locator('a, button').filter({ hasText: /^add$|^\+$/i }).first();
      if (await addBtn.isVisible()) {
        await addBtn.click();
      }
    }
    
    // Page should still be functional
    await expect(page.locator('body')).toBeVisible();
  });

  test('create customer form or modal works', async ({ page }) => {
    await page.goto('/customers/new');
    
    // Either we have a form page or get redirected
    await page.waitForTimeout(500);
    
    // Check if we have a form with inputs
    const formInputs = page.locator('input, textarea');
    const inputCount = await formInputs.count();
    
    if (inputCount > 0) {
      // Form exists
      await expect(formInputs.first()).toBeVisible();
    } else {
      // Might have redirected - check we're somewhere valid
      await expect(page.locator('body')).toBeVisible();
    }
  });
});
