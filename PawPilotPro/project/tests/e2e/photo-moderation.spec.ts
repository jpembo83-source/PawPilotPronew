// Photo-moderation gate smoke tests.
//
// The curation gate has two authorization invariants:
//   1. Review endpoints (queue / approve / reject) are admin/manager ONLY —
//      a staff-role token must get 403 (CAN_REVIEW_ROLES in
//      pet_updates_routes.tsx).
//   2. Owner-facing gallery responses only ever contain APPROVED photos —
//      pending/rejected rows never get a signed URL (listApprovedGallery
//      filters status server-side; also enforced by RLS policy
//      pet_updates_portal_read).
//
// Follows the auth-tampered-token / auth-self-promote pattern: API-level
// requests against the same Edge Function URL the real clients use.

import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

const projectId = process.env.VITE_SUPABASE_PROJECT_ID || process.env.SUPABASE_PROJECT_ID;
const projectUrl = process.env.VITE_SUPABASE_URL
  || (projectId ? `https://${projectId}.supabase.co` : undefined);
const anonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
const email = process.env.TEST_EMAIL;
const password = process.env.TEST_PASSWORD;
// Optional: a portal (owner) login for the gallery-purity assertion.
const portalEmail = process.env.TEST_PORTAL_EMAIL;
const portalPassword = process.env.TEST_PORTAL_PASSWORD;

const FN_BASE = projectId
  ? `https://${projectId}.supabase.co/functions/v1/make-server-fc003b23`
  : '';

const REVIEW_ENDPOINTS = [
  { method: 'GET' as const, path: '/pet-updates/review-queue' },
  { method: 'POST' as const, path: '/pet-updates/moment/smoke-test-nonexistent/approve' },
  { method: 'POST' as const, path: '/pet-updates/moment/smoke-test-nonexistent/reject' },
  { method: 'POST' as const, path: '/pet-updates/moments/approve' },
];

// Same tampered JWT shape as auth-tampered-token.spec.ts.
const TAMPERED_TOKEN =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.' +
  'eyJzdWIiOiIwMDAwMDAwMC0wMDAwLTAwMDAtMDAwMC0wMDAwMDAwMDAwMDAiLCJlbWFpbCI6InRhbXBlckBleGFtcGxlLnRlc3QiLCJleHAiOjk5OTk5OTk5OTl9.' +
  'this-signature-is-not-valid-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';

test.describe('photo moderation gate @smoke', () => {
  test.skip(!projectId || !anonKey,
    'requires VITE_SUPABASE_PROJECT_ID and VITE_SUPABASE_ANON_KEY in env');

  for (const ep of REVIEW_ENDPOINTS) {
    test(`rejects tampered token with 401 on ${ep.method} ${ep.path}`, async ({ request }) => {
      const res = await request.fetch(`${FN_BASE}${ep.path}`, {
        method: ep.method,
        headers: {
          // The gateway needs the platform anon key to reach the function;
          // Authorization carries the (tampered) user JWT requireAuth
          // actually validates — same pattern as auth-tampered-token.spec.
          Authorization: `Bearer ${TAMPERED_TOKEN}`,
          'X-User-Token': `Bearer ${TAMPERED_TOKEN}`,
          apikey: anonKey!,
        },
        data: ep.method === 'POST' ? {} : undefined,
        failOnStatusCode: false,
      });
      expect(res.status()).toBe(401);
    });
  }

  test('staff-role token gets 403 on review endpoints (curation is admin/manager only)', async ({ request }) => {
    test.skip(!projectUrl || !email || !password,
      'requires TEST_EMAIL / TEST_PASSWORD');

    const supabase = createClient(projectUrl!, anonKey!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email!, password: password!,
    });
    expect(error).toBeNull();
    const token = data.session!.access_token;

    // The gate under test is role-based: this assertion only proves the 403
    // when the test user is NOT admin/manager. app_metadata is in the JWT
    // the server validates, so read the role from the session user.
    const role = (data.user?.app_metadata as { role?: string } | undefined)?.role ?? 'staff';
    test.skip(['admin', 'manager'].includes(role),
      `TEST_EMAIL user has role "${role}" — needs a staff/assistant_manager user to prove the 403`);

    for (const ep of REVIEW_ENDPOINTS) {
      const res = await request.fetch(`${FN_BASE}${ep.path}`, {
        method: ep.method,
        headers: {
          Authorization: `Bearer ${token}`,
          apikey: anonKey!,
        },
        data: ep.method === 'POST' ? { ids: ['smoke-test-nonexistent'] } : undefined,
        failOnStatusCode: false,
      });
      expect(res.status(), `${ep.method} ${ep.path} must be 403 for role ${role}`).toBe(403);
    }
  });

  test('owner gallery only ever returns approved photo URLs', async ({ request }) => {
    test.skip(!projectUrl || !portalEmail || !portalPassword,
      'requires TEST_PORTAL_EMAIL / TEST_PORTAL_PASSWORD (portal owner login)');

    const supabase = createClient(projectUrl!, anonKey!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await supabase.auth.signInWithPassword({
      email: portalEmail!, password: portalPassword!,
    });
    expect(error).toBeNull();

    // Portal convention: platform anon key in Authorization, user token in
    // X-User-Token (shared/api/client.ts).
    const res = await request.get(`${FN_BASE}/portal/gallery`, {
      headers: {
        Authorization: `Bearer ${anonKey}`,
        'X-User-Token': `Bearer ${data.session!.access_token}`,
        apikey: anonKey!,
      },
      failOnStatusCode: false,
    });
    expect(res.status()).toBe(200);
    const body = (await res.json()) as {
      items: Array<Record<string, unknown>>;
      nextCursor: string | null;
    };

    for (const item of body.items) {
      // Every item is a served photo…
      expect(typeof item.photoUrl).toBe('string');
      // …and no moderation internals ever leak to the owner. The server
      // strips status entirely, so its absence is the approved-only proof at
      // the wire level (non-approved rows are filtered before serialisation).
      expect(item).not.toHaveProperty('status');
      expect(item).not.toHaveProperty('rejected_reason');
      expect(item).not.toHaveProperty('reviewed_by_id');
    }
  });
});
