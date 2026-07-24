// My Account smoke: the /account routes are SELF-scoped and can never
// escalate. Proves (server-side, not UI): unauthenticated calls are 401;
// a signed-in user reads their own profile; a profile PATCH smuggling
// role/tenant/permissions changes NOTHING security-bearing; malformed pref
// values are rejected by normalization; and a password change with the
// wrong current password is refused.
//
// Uses the same credential convention as rbac-role-gates.spec.ts (skipped
// when absent): TEST_STAFF_EMAIL / TEST_STAFF_PASSWORD (role: staff).
// Probes only write reversible self-data (the user's own prefs, restored
// at the end) — no names, passwords, or other users are ever mutated.

import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

const projectUrl = process.env.VITE_SUPABASE_URL
  || (process.env.VITE_SUPABASE_PROJECT_ID
        ? `https://${process.env.VITE_SUPABASE_PROJECT_ID}.supabase.co`
        : undefined);
const anonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

const STAFF_EMAIL = process.env.TEST_STAFF_EMAIL;
const STAFF_PASSWORD = process.env.TEST_STAFF_PASSWORD;

const FN_BASE = `${projectUrl}/functions/v1/make-server-fc003b23`;

function skipUnlessConfigured() {
  test.skip(!projectUrl || !anonKey || !STAFF_EMAIL || !STAFF_PASSWORD,
    'requires VITE_SUPABASE_URL (or VITE_SUPABASE_PROJECT_ID), VITE_SUPABASE_ANON_KEY, ' +
    'TEST_STAFF_EMAIL and TEST_STAFF_PASSWORD');
}

async function signInStaff(): Promise<string> {
  const supabase = createClient(projectUrl!, anonKey!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await supabase.auth.signInWithPassword({
    email: STAFF_EMAIL!,
    password: STAFF_PASSWORD!,
  });
  expect(error, `staff sign-in failed: ${error?.message}`).toBeNull();
  const token = data.session?.access_token;
  expect(token, 'no access token for staff').toBeTruthy();
  return token!;
}

function headers(token: string) {
  return {
    'Authorization': `Bearer ${token}`,
    'apikey': anonKey!,
    'Content-Type': 'application/json',
  };
}

interface MeBody {
  profile: { id: string; name: string; email: string; phone: string; role: string };
  avatarUrl: string | null;
  prefs: {
    defaultLocationId: string | null;
    theme: string;
    notifications: Record<string, unknown>;
  };
}

test.describe('my account self-service routes @smoke', () => {

  test('unauthenticated and tampered tokens never reach /account', async ({ request }) => {
    skipUnlessConfigured();
    for (const auth of [undefined, 'Bearer not-a-real-token']) {
      const res = await request.get(`${FN_BASE}/account/me`, {
        headers: auth ? { 'Authorization': auth, 'apikey': anonKey! } : { 'apikey': anonKey! },
        failOnStatusCode: false,
      });
      expect(res.status(), `auth=${auth ?? '(none)'} must be rejected`).toBe(401);
    }
  });

  test('a user reads their OWN account and nothing else is addressable', async ({ request }) => {
    skipUnlessConfigured();
    const token = await signInStaff();
    const res = await request.get(`${FN_BASE}/account/me`, {
      headers: headers(token), failOnStatusCode: false,
    });
    expect(res.status()).toBe(200);
    const body = (await res.json()) as MeBody;
    expect(body.profile.email).toBe(STAFF_EMAIL);
    expect(body.profile.role).toBe('staff');
    // There is no per-user path to probe: /account/* has no :id params.
    const probe = await request.get(`${FN_BASE}/account/00000000-0000-4000-8000-000000000000`, {
      headers: headers(token), failOnStatusCode: false,
    });
    expect(probe.status()).toBe(404);
  });

  test('profile PATCH smuggling role/tenant/permissions changes nothing security-bearing', async ({ request }) => {
    skipUnlessConfigured();
    const token = await signInStaff();
    const before = (await (await request.get(`${FN_BASE}/account/me`, {
      headers: headers(token),
    })).json()) as MeBody;

    // Same name back (no visible change), plus every security field an
    // attacker would try. The allow-list must drop all of them.
    const res = await request.patch(`${FN_BASE}/account/profile`, {
      headers: headers(token),
      data: {
        name: before.profile.name,
        role: 'admin',
        permissions: [{ module: 'settings', action: 'update' }],
        tenant_id: 'some-other-tenant',
        tenantId: 'some-other-tenant',
        locationIds: ['all'],
        templateId: 'tpl-admin',
      },
      failOnStatusCode: false,
    });
    expect(res.status()).toBe(200);

    // Role must still be staff — both on the account endpoint and where it
    // counts: the RBAC gate on a privileged mutation still refuses.
    const after = (await (await request.get(`${FN_BASE}/account/me`, {
      headers: headers(token),
    })).json()) as MeBody;
    expect(after.profile.role).toBe('staff');

    const gate = await request.post(`${FN_BASE}/billing/refunds`, {
      headers: headers(token), data: {}, failOnStatusCode: false,
    });
    expect(gate.status(), 'staff must STILL be forbidden on privileged mutations').toBe(403);
  });

  test('prefs round-trip; malformed values are rejected by normalization', async ({ request }) => {
    skipUnlessConfigured();
    const token = await signInStaff();
    const original = ((await (await request.get(`${FN_BASE}/account/me`, {
      headers: headers(token),
    })).json()) as MeBody).prefs;

    try {
      // Path-shaped location id and junk theme must normalize away, never store.
      const res = await request.put(`${FN_BASE}/account/prefs`, {
        headers: headers(token),
        data: { defaultLocationId: '../../other-tenant', theme: 'hotdog-stand' },
        failOnStatusCode: false,
      });
      expect(res.status()).toBe(200);
      const body = (await res.json()) as { prefs: MeBody['prefs'] };
      expect(body.prefs.defaultLocationId).toBeNull();
      expect(body.prefs.theme).toBe('system');

      // A legitimate value round-trips.
      const res2 = await request.put(`${FN_BASE}/account/prefs`, {
        headers: headers(token),
        data: { theme: 'dark', notifications: { message: false } },
        failOnStatusCode: false,
      });
      expect(res2.status()).toBe(200);
      const body2 = (await res2.json()) as { prefs: MeBody['prefs'] };
      expect(body2.prefs.theme).toBe('dark');
      expect(body2.prefs.notifications.message).toBe(false);
      // Safety defaults survive a partial notifications patch.
      expect(body2.prefs.notifications.incident).toBe(true);
    } finally {
      // Leave the test account exactly as found.
      await request.put(`${FN_BASE}/account/prefs`, {
        headers: headers(token), data: original, failOnStatusCode: false,
      });
    }
  });

  test('password change with the wrong current password is refused', async ({ request }) => {
    skipUnlessConfigured();
    const token = await signInStaff();
    const res = await request.post(`${FN_BASE}/account/password`, {
      headers: headers(token),
      data: { currentPassword: 'definitely-not-the-password', newPassword: 'new-password-123' },
      failOnStatusCode: false,
    });
    expect(res.status()).toBe(403);
    // The credential must be untouched: the original password still signs in.
    await signInStaff();
  });
});
