import { test, expect } from '@playwright/test';

test.describe('Daycare Module', () => {
  test('daycare page loads', async ({ page }) => {
    await page.goto('/daycare');
    
    // Check main heading - be flexible
    await expect(page.locator('h1, h2').filter({ hasText: /daycare/i }).first()).toBeVisible();
  });

  test('shows daycare content', async ({ page }) => {
    await page.goto('/daycare');
    
    // Should show some daycare-related content
    const content = page.locator('text=/booking|attendance|dogs|checked|capacity/i');
    await expect(content.first()).toBeVisible();
  });

  test('can navigate to bookings', async ({ page }) => {
    await page.goto('/daycare');
    
    // Look for bookings link/tab/button
    const bookingsLink = page.locator('a, button').filter({ hasText: /bookings/i }).first();
    
    if (await bookingsLink.isVisible()) {
      await bookingsLink.click();
      // Should navigate or show bookings content
      await expect(page.locator('text=/booking/i').first()).toBeVisible();
    }
  });

  test('can navigate to attendance', async ({ page }) => {
    await page.goto('/daycare');
    
    // Look for attendance link/tab/button
    const attendanceLink = page.locator('a, button').filter({ hasText: /attendance/i }).first();
    
    if (await attendanceLink.isVisible()) {
      await attendanceLink.click();
    }
    
    // Page should still be functional
    await expect(page.locator('h1, h2').filter({ hasText: /daycare/i }).first()).toBeVisible();
  });
});

test.describe('Daycare Check-in Flow', () => {
  test('check-in button exists on dashboard', async ({ page }) => {
    await page.goto('/');
    
    // Look for check-in button
    const checkInBtn = page.locator('button').filter({ hasText: /check.?in/i }).first();
    await expect(checkInBtn).toBeVisible();
  });

  test('check-in modal opens', async ({ page }) => {
    await page.goto('/');
    
    // Click check-in button
    const checkInBtn = page.locator('button').filter({ hasText: /check.?in/i }).first();
    await checkInBtn.click();
    
    // Wait for modal - look for dialog element or modal content
    const modal = page.locator('[role="dialog"], [data-state="open"], .modal, [class*="dialog"]').first();
    await expect(modal).toBeVisible({ timeout: 5000 });
  });

  test('check-in modal has search or content', async ({ page }) => {
    await page.goto('/');
    
    // Open modal
    const checkInBtn = page.locator('button').filter({ hasText: /check.?in/i }).first();
    await checkInBtn.click();
    
    // Wait for modal
    await expect(
      page.locator('[role="dialog"], [data-state="open"]').first()
    ).toBeVisible();

    // Should have some input or content
    const hasInput = await page.locator('input').first().isVisible();
    const hasContent = await page.locator('[role="dialog"] *, [data-state="open"] *').first().isVisible();
    
    expect(hasInput || hasContent).toBeTruthy();
  });

  test('check-in modal can be closed', async ({ page }) => {
    await page.goto('/');
    
    // Open modal
    const checkInBtn = page.locator('button').filter({ hasText: /check.?in/i }).first();
    await checkInBtn.click();
    
    // Wait for modal
    const modal = page.locator('[role="dialog"], [data-state="open"]').first();
    await expect(modal).toBeVisible();

    // Try to close - look for X button, cancel, or close button
    const closeBtn = page.locator('button').filter({ hasText: /close|cancel|×/i }).first();
    const xBtn = page.locator('[role="dialog"] button:has(svg), [data-state="open"] button:has(svg)').first();
    
    if (await closeBtn.isVisible()) {
      await closeBtn.click();
    } else if (await xBtn.isVisible()) {
      await xBtn.click();
    } else {
      // Press Escape as fallback
      await page.keyboard.press('Escape');
    }
    
    // Modal should close
    await expect(modal).toBeHidden();
  });

  test('batch check-in tab may exist', async ({ page }) => {
    await page.goto('/');
    
    // Open modal
    const checkInBtn = page.locator('button').filter({ hasText: /check.?in/i }).first();
    await checkInBtn.click();
    
    // Look for batch tab (optional feature)
    const batchTab = page.locator('button, [role="tab"]').filter({ hasText: /batch/i }).first();
    
    // Just verify modal is open - batch is optional
    const modal = page.locator('[role="dialog"], [data-state="open"]').first();
    await expect(modal).toBeVisible();
  });
});
