import { test as setup, expect } from '@playwright/test';

const TEST_EMAIL = process.env.TEST_EMAIL || 'test@pawpilotpro.com';
const TEST_PASSWORD = process.env.TEST_PASSWORD || 'TestPassword123!';

setup('authenticate', async ({ page }) => {
  // Go to login page
  await page.goto('/login');
  
  // Fill in credentials
  await page.getByLabel(/email/i).fill(TEST_EMAIL);
  await page.getByLabel(/password/i).fill(TEST_PASSWORD);
  
  // Submit login
  await page.getByRole('button', { name: /sign in|log in/i }).click();
  
  // Wait for redirect to dashboard
  await expect(page).toHaveURL('/', { timeout: 10000 });
  
  // Verify we're logged in by checking for dashboard heading
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  
  // Save authentication state
  await page.context().storageState({ path: 'tests/e2e/.auth/user.json' });
});
