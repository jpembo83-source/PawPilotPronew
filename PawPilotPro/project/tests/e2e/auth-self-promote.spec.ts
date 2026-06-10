// Self-promotion smoke test (1B.3 verification).
//
// Proves that a logged-in user CANNOT escalate to admin by writing
// user_metadata.role = 'admin' via supabase.auth.updateUser — the server-side
// auth middleware reads role exclusively from app_metadata, which the
// client cannot mutate without the service-role key.
//
// Workflow:
//   1. Sign in as the regular test user (TEST_EMAIL / TEST_PASSWORD).
//   2. Call supabase.auth.updateUser({ data: { role: 'admin' } }) — this is
//      the attack: any client can mutate its own user_metadata.
//   3. Refresh the session so the JWT carries the new user_metadata.
//   4. Hit /test-auth (which echoes the validated app_metadata.role) and
//      assert the returned role is NOT 'admin'.
//   5. Hit a permission-gated admin route and assert 403/401 — the request
//      is rejected by requirePermission even though user_metadata says admin.
//
// If this test fails, a regression has reintroduced a user_metadata.role
// read somewhere in the role pipeline (server auth middleware, settings
// RBAC, or a per-route helper).

import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

const projectUrl = process.env.VITE_SUPABASE_URL
  || (process.env.VITE_SUPABASE_PROJECT_ID
        ? `https://${process.env.VITE_SUPABASE_PROJECT_ID}.supabase.co`
        : undefined);
const anonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
const email = process.env.TEST_EMAIL;
const password = process.env.TEST_PASSWORD;

test.describe('user_metadata.role=admin does NOT grant admin (1B.3) @smoke', () => {
  test.skip(!projectUrl || !anonKey || !email || !password,
    'requires VITE_SUPABASE_URL (or VITE_SUPABASE_PROJECT_ID), ' +
    'VITE_SUPABASE_ANON_KEY, TEST_EMAIL, TEST_PASSWORD');

  test('self-set user_metadata.role=admin is ignored by server', async ({ request }) => {
    const supabase = createClient(projectUrl!, anonKey!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // 1. Sign in as the regular test user.
    const { data: signIn, error: signInError } = await supabase.auth.signInWithPassword({
      email: email!,
      password: password!,
    });
    expect(signInError, signInError?.message).toBeNull();
    expect(signIn.session?.access_token).toBeTruthy();

    // 2. Self-promote: write role=admin into user_metadata.
    const { error: updateError } = await supabase.auth.updateUser({
      data: { role: 'admin' },
    });
    expect(updateError, updateError?.message).toBeNull();

    // 3. Refresh the session so the JWT carries the new user_metadata claim.
    const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();
    expect(refreshError, refreshError?.message).toBeNull();
    const tamperedAccessToken = refreshed.session?.access_token;
    expect(tamperedAccessToken).toBeTruthy();

    const authHeaders = {
      'Authorization': `Bearer ${tamperedAccessToken!}`,
      'X-User-Token': `Bearer ${tamperedAccessToken!}`,
      'apikey': anonKey!,
    };

    // 4. /test-auth echoes whatever role the server-side auth middleware sees.
    //    It MUST report a non-admin role (or null) — never 'admin' just because
    //    the client wrote that into user_metadata.
    const introspectionRes = await request.get(
      `${projectUrl}/functions/v1/make-server-fc003b23/test-auth`,
      { headers: authHeaders, failOnStatusCode: false },
    );
    expect(introspectionRes.status()).toBe(200);
    const introspection = await introspectionRes.json();
    expect(introspection.user?.role,
      'server returned role=admin from a self-promoted token — app_metadata enforcement is broken',
    ).not.toBe('admin');

    // 5. A permission-gated admin route must reject the request. The settings
    //    surface uses requirePermission which calls hasPermission(role, ...)
    //    against the validated role — so this returns 403 if the guard works.
    //    (200 means the role-based gate accepted the tampered user_metadata.)
    const adminRouteRes = await request.put(
      `${projectUrl}/functions/v1/make-server-fc003b23/organisation`,
      {
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        data: { name: 'tampered-self-promotion-attempt' },
        failOnStatusCode: false,
      },
    );
    expect([401, 403]).toContain(adminRouteRes.status());

    // Best-effort cleanup: revert user_metadata.role so subsequent tests
    // don't observe the tampered value.
    await supabase.auth.updateUser({ data: { role: null } }).catch(() => undefined);
  });
});
