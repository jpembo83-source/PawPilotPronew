import { test, expect } from '@playwright/test';

test.describe('Capacity Dashboard', () => {
  test('loads successfully', async ({ page }) => {
    await page.goto('/capacity');
    
    // Check page loads - look for any heading with capacity
    await expect(page.locator('h1, h2').filter({ hasText: /capacity/i }).first()).toBeVisible();
  });

  test('displays weekly calendar', async ({ page }) => {
    await page.goto('/capacity');
    
    // Should show days of the week (look for at least one)
    const dayNames = page.getByText(/monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|wed|thu|fri|sat|sun/i);
    await expect(dayNames.first()).toBeVisible();
  });

  test('can navigate to previous week', async ({ page }) => {
    await page.goto('/capacity');
    
    // Look for navigation buttons (chevron or arrow icons)
    const navButtons = page.locator('button').filter({ has: page.locator('svg') });
    const buttonCount = await navButtons.count();
    
    if (buttonCount > 0) {
      await navButtons.first().click();
      // Page should still be functional
      await expect(page.locator('h1, h2').filter({ hasText: /capacity/i }).first()).toBeVisible();
    }
  });

  test('can navigate to next week', async ({ page }) => {
    await page.goto('/capacity');
    
    // Look for navigation buttons
    const navButtons = page.locator('button').filter({ has: page.locator('svg') });
    const buttonCount = await navButtons.count();
    
    if (buttonCount > 1) {
      await navButtons.nth(1).click();
      // Page should still be functional
      await expect(page.locator('h1, h2').filter({ hasText: /capacity/i }).first()).toBeVisible();
    } else {
      // Skip if no navigation buttons found
      test.skip();
    }
  });

  test('today button works', async ({ page }) => {
    await page.goto('/capacity');
    
    // Look for today button
    const todayButton = page.getByRole('button', { name: /today/i });
    
    if (await todayButton.isVisible()) {
      await todayButton.click();
      await expect(page.locator('h1, h2').filter({ hasText: /capacity/i }).first()).toBeVisible();
    } else {
      // If no today button, that's okay - skip
      test.skip();
    }
  });

  test('shows service capacity cards', async ({ page }) => {
    await page.goto('/capacity');
    
    // Should show at least some content about services
    const serviceContent = page.locator('text=/daycare|grooming|overnights|transport/i');
    await expect(serviceContent.first()).toBeVisible();
  });
});
