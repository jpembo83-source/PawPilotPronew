# Paw Pilot Pro - Testing Guide

## Overview

This project uses **Playwright** for end-to-end (E2E) testing and includes seed data scripts for UAT.

## Quick Start

### 1. Install Playwright browsers (first time only)
```bash
npx playwright install
```

### 2. Set up test credentials
Create a `.env.test` file:
```bash
TEST_EMAIL=test@pawpilotpro.com
TEST_PASSWORD=YourTestPassword
```

Or export them:
```bash
export TEST_EMAIL=test@pawpilotpro.com
export TEST_PASSWORD=YourTestPassword
```

### 3. Run tests
```bash
# Run all tests (headless)
npm test

# Run with UI mode (interactive)
npm run test:ui

# Run with browser visible
npm run test:headed

# View test report
npm run test:report
```

## Test Structure

```
tests/
├── e2e/
│   ├── .auth/           # Saved authentication state
│   ├── auth.setup.ts    # Login setup (runs first)
│   ├── dashboard.spec.ts
│   ├── customers.spec.ts
│   ├── daycare.spec.ts
│   └── capacity.spec.ts
└── README.md
```

## Seed Data

To populate the system with test data:

### Option 1: Using auth token
```bash
# Get your auth token from browser DevTools
# (Application > Local Storage > find access_token)

AUTH_TOKEN="your_token_here" npm run seed:test
```

### Option 2: In-app (coming soon)
Use the "Seed Test Data" button in Settings > System

## Test Accounts Created by Seed Script

| Customer | Pets | Notes |
|----------|------|-------|
| Johnson Family | Buddy (Golden Retriever), Daisy (Cocker Spaniel) | Daisy is nervous |
| Chen Household | Luna (Husky) | DHPP expiring soon |
| Wilson Family | Max (German Shepherd) | Rabies EXPIRED, hip dysplasia |
| Smith Household | Bella (Lab), Rocky (Frenchie) | Bella excitable, Rocky brachycephalic |
| Garcia Family | Charlie (Beagle) | Bordetella expired, food guarder |

## Writing New Tests

```typescript
import { test, expect } from '@playwright/test';

test.describe('My Feature', () => {
  test('should do something', async ({ page }) => {
    await page.goto('/my-page');
    await expect(page.getByText('Expected')).toBeVisible();
  });
});
```

## CI/CD Integration

Tests run automatically on:
- Pull requests
- Pushes to main branch

Configure in `.github/workflows/test.yml`

## Troubleshooting

### Tests fail with auth errors
1. Ensure test user exists in Supabase Auth
2. Check credentials in environment variables
3. Delete `tests/e2e/.auth/user.json` and re-run

### Tests timeout
- Increase timeout in `playwright.config.ts`
- Check if dev server is starting properly

### Flaky tests
- Add explicit waits: `await page.waitForSelector()`
- Use `await expect().toBeVisible()` instead of immediate assertions
