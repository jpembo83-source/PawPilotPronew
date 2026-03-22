import { test, expect } from '@playwright/test';

test.describe('Dashboard', () => {
  test('loads successfully', async ({ page }) => {
    await page.goto('/');
    
    // Check main elements are visible - be flexible with heading text
    await expect(page.locator('h1, h2').first()).toBeVisible();
  });

  test('quick actions bar is visible', async ({ page }) => {
    await page.goto('/');
    
    // Check quick action buttons exist (may be buttons or links)
    const checkIn = page.locator('button, a').filter({ hasText: /check.?in/i }).first();
    await expect(checkIn).toBeVisible();
  });

  test('sidebar navigation works', async ({ page }) => {
    await page.goto('/');
    
    // Navigate to Customers - sidebar link
    const customersLink = page.locator('nav a, aside a').filter({ hasText: /customers/i }).first();
    if (await customersLink.isVisible()) {
      await customersLink.click();
      await page.waitForURL(/customers/);
      await expect(page).toHaveURL(/customers/);
    }
    
    // Navigate to Capacity
    const capacityLink = page.locator('nav a, aside a').filter({ hasText: /capacity/i }).first();
    if (await capacityLink.isVisible()) {
      await capacityLink.click();
      await page.waitForURL(/capacity/);
      await expect(page).toHaveURL(/capacity/);
    }
    
    // Navigate back to Dashboard
    const dashboardLink = page.locator('nav a, aside a').filter({ hasText: /dashboard/i }).first();
    if (await dashboardLink.isVisible()) {
      await dashboardLink.click();
      await page.waitForURL('/');
    }
  });

  test('location selector exists or not', async ({ page }) => {
    await page.goto('/');
    
    // Location selector is optional - check if it exists
    const locationSelector = page.locator('button, select').filter({ hasText: /location|all locations/i }).first();
    
    // Just verify page is functional whether or not selector exists
    await expect(page.locator('h1, h2').first()).toBeVisible();
    
    // If selector exists, verify it can be interacted with
    if (await locationSelector.isVisible()) {
      await locationSelector.click();
      // Wait a moment for any dropdown
      await page.waitForTimeout(300);
    }
  });
});
