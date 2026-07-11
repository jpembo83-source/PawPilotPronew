// Server-side RBAC smoke: role gates on mutating operational endpoints.
//
// Guards money and customer data: proves the server (not the UI) rejects a
// `staff` token on financial/destructive mutations, and that admin/manager
// remain able to perform them. "Allowed" is asserted as NOT-403 — probes use
// empty bodies / nonexistent IDs so an authorised role gets 400/404 and no
// data is ever created or destroyed by this suite.
//
// Requires one credential pair per role (skipped when absent, matching the
// repo's smoke-test convention):
//   TEST_STAFF_EMAIL / TEST_STAFF_PASSWORD                       (role: staff)
//   TEST_ADMIN_EMAIL / TEST_ADMIN_PASSWORD                       (role: admin)
//   TEST_MANAGER_EMAIL / TEST_MANAGER_PASSWORD                   (role: manager)
//   TEST_ASSISTANT_MANAGER_EMAIL / TEST_ASSISTANT_MANAGER_PASSWORD
// Roles must be set in each user's app_metadata (server-set) — that is the
// only role source the middleware reads.

import { test, expect, APIRequestContext } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

const projectUrl = process.env.VITE_SUPABASE_URL
  || (process.env.VITE_SUPABASE_PROJECT_ID
        ? `https://${process.env.VITE_SUPABASE_PROJECT_ID}.supabase.co`
        : undefined);
const anonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

const CREDS = {
  staff: { email: process.env.TEST_STAFF_EMAIL, password: process.env.TEST_STAFF_PASSWORD },
  admin: { email: process.env.TEST_ADMIN_EMAIL, password: process.env.TEST_ADMIN_PASSWORD },
  manager: { email: process.env.TEST_MANAGER_EMAIL, password: process.env.TEST_MANAGER_PASSWORD },
  assistant_manager: {
    email: process.env.TEST_ASSISTANT_MANAGER_EMAIL,
    password: process.env.TEST_ASSISTANT_MANAGER_PASSWORD,
  },
} as const;

type RoleName = keyof typeof CREDS;

const FN_BASE = `${projectUrl}/functions/v1/make-server-fc003b23`;
const FAKE_ID = '00000000-0000-4000-8000-000000000000';

// The guarded probes. Every one uses a nonexistent ID or an empty body so an
// ALLOWED role passes the gate and then fails validation/lookup (400/404) —
// nothing is mutated. A DENIED role must be stopped at the gate with 403.
const PROBES = [
  { name: 'POST /billing/refunds', method: 'post' as const, url: `${FN_BASE}/billing/refunds`, data: {} },
  { name: 'PATCH /billing/invoices/:id/void', method: 'patch' as const, url: `${FN_BASE}/billing/invoices/${FAKE_ID}/void`, data: {} },
  { name: 'DELETE /customers/households/:id', method: 'delete' as const, url: `${FN_BASE}/customers/households/${FAKE_ID}`, data: undefined },
  { name: 'DELETE /pricing/services/:id (pricing mutation)', method: 'delete' as const, url: `${FN_BASE}/pricing/services/${FAKE_ID}`, data: undefined },
];

async function signIn(role: RoleName): Promise<string> {
  const { email, password } = CREDS[role];
  const supabase = createClient(projectUrl!, anonKey!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email!,
    password: password!,
  });
  expect(error, `sign-in failed for ${role}: ${error?.message}`).toBeNull();
  const token = data.session?.access_token;
  expect(token, `no access token for ${role}`).toBeTruthy();
  return token!;
}

function headers(token: string) {
  return {
    'Authorization': `Bearer ${token}`,
    'apikey': anonKey!,
    'Content-Type': 'application/json',
  };
}

async function probe(
  request: APIRequestContext,
  token: string,
  p: (typeof PROBES)[number],
): Promise<number> {
  const res = await request[p.method](p.url, {
    headers: headers(token),
    data: p.data,
    failOnStatusCode: false,
  });
  return res.status();
}

function skipUnlessConfigured(...roles: RoleName[]) {
  const missing = roles.filter((r) => !CREDS[r].email || !CREDS[r].password);
  test.skip(!projectUrl || !anonKey || missing.length > 0,
    `requires VITE_SUPABASE_URL (or VITE_SUPABASE_PROJECT_ID), VITE_SUPABASE_ANON_KEY and ` +
    `credentials for: ${missing.map((r) => r.toUpperCase()).join(', ') || '(configured)'}`);
}

test.describe('server RBAC gates on mutating operational endpoints @smoke', () => {

  test('staff is 403 on financial and destructive mutations', async ({ request }) => {
    skipUnlessConfigured('staff');
    const token = await signIn('staff');
    for (const p of PROBES) {
      const status = await probe(request, token, p);
      expect(status, `staff must be forbidden on ${p.name}`).toBe(403);
    }
  });

  for (const role of ['admin', 'manager'] as const) {
    test(`${role} is allowed (not 403) on the same mutations`, async ({ request }) => {
      skipUnlessConfigured(role);
      const token = await signIn(role);
      for (const p of PROBES) {
        const status = await probe(request, token, p);
        expect(status, `${role} must not be role-blocked on ${p.name}`).not.toBe(403);
        expect(status, `${role} should reach validation/lookup on ${p.name}`).toBeLessThan(500);
      }
    });
  }

  test('assistant_manager can create/update a household but not delete one', async ({ request }) => {
    skipUnlessConfigured('assistant_manager');
    const token = await signIn('assistant_manager');

    // Allowed through the role gate: empty body stops at validation (400),
    // never 403, and never creates anything.
    const createStatus = (await request.post(`${FN_BASE}/customers/households`, {
      headers: headers(token), data: {}, failOnStatusCode: false,
    })).status();
    expect(createStatus, 'assistant_manager must pass the role gate on create').toBe(400);

    const updateStatus = (await request.put(`${FN_BASE}/customers/households/${FAKE_ID}`, {
      headers: headers(token), data: { name: 'rbac-smoke-noop' }, failOnStatusCode: false,
    })).status();
    expect(updateStatus, 'assistant_manager must pass the role gate on update').not.toBe(403);

    const deleteStatus = (await request.delete(`${FN_BASE}/customers/households/${FAKE_ID}`, {
      headers: headers(token), failOnStatusCode: false,
    })).status();
    expect(deleteStatus, 'assistant_manager must be forbidden on delete').toBe(403);
  });

  test('403 responses are generic: correlation ID, no role details leaked', async ({ request }) => {
    skipUnlessConfigured('staff');
    const token = await signIn('staff');
    const res = await request.post(`${FN_BASE}/billing/refunds`, {
      headers: headers(token), data: {}, failOnStatusCode: false,
    });
    expect(res.status()).toBe(403);
    const body = (await res.json()) as { error: string; correlationId: string };
    expect(body.error).toBe('forbidden');
    expect(body.correlationId).toBeTruthy();
    const raw = JSON.stringify(body);
    for (const leak of ['staff', 'admin', 'manager', 'role']) {
      expect(raw, `403 body must not mention "${leak}"`).not.toContain(leak);
    }
  });
});
