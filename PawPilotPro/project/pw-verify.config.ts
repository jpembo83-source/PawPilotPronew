import { defineConfig } from '@playwright/test';

// API-only runner for the RBAC role-gate smoke spec. No browser, no
// auth.setup dependency, no storageState — the spec authenticates itself
// per role via supabase-js and uses only the request fixture. Exists on the
// verify/rbac-smoke scratch branch only; not part of the app's CI config.
export default defineConfig({
  testDir: './tests/e2e',
  testMatch: /rbac-role-gates\.spec\.ts/,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
});
