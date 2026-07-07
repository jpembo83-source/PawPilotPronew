// Tampered-token smoke test (1B.2 + 1B.2-ext verification).
//
// Sends a request to a protected backend route with a tampered bearer token
// and asserts the server rejects it with 401. Catches regressions where the
// shared requireAuth middleware is weakened to accept un-validated tokens
// (e.g. by reintroducing the ANON_KEY validation, the Base64 decode fallback,
// or the dev-mode JWT-decode bypass).
//
// This test does NOT require an authenticated session — it is the inverse of
// the rest of the smoke suite. It runs against the same Edge Function URL
// the real client uses, with a JWT-shaped string whose signature cannot
// verify under the project's SERVICE_ROLE_KEY.

import { test, expect } from '@playwright/test';

const projectId = process.env.VITE_SUPABASE_PROJECT_ID || process.env.SUPABASE_PROJECT_ID;
const anonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

// A syntactically-valid JWT (three Base64URL segments) whose signature has
// been mangled. Any properly-validating server MUST reject this with 401.
// Header: {"alg":"HS256","typ":"JWT"}
// Payload: {"sub":"00000000-0000-0000-0000-000000000000","email":"tamper@example.test","exp":9999999999}
const TAMPERED_TOKEN =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.' +
  'eyJzdWIiOiIwMDAwMDAwMC0wMDAwLTAwMDAtMDAwMC0wMDAwMDAwMDAwMDAiLCJlbWFpbCI6InRhbXBlckBleGFtcGxlLnRlc3QiLCJleHAiOjk5OTk5OTk5OTl9.' +
  'this-signature-is-not-valid-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';

const PROTECTED_ROUTES = [
  // One representative route from each of the seven 1B.2 modules + the
  // three 1B.1 modules + the settings surface + the three 1B.2-ext modules
  // (reorder / billing / staff_routes_new — formerly unguarded or guarded by
  // the same ANON_KEY / dev-mode-decode pattern).
  '/make-server-fc003b23/customers/households',
  '/make-server-fc003b23/daycare/bookings',
  '/make-server-fc003b23/overnights/reservations',
  '/make-server-fc003b23/transport/jobs',
  '/make-server-fc003b23/grooming/appointments',
  '/make-server-fc003b23/incidents/',
  '/make-server-fc003b23/policies/',
  '/make-server-fc003b23/messaging/threads',
  '/make-server-fc003b23/system/overview',
  '/make-server-fc003b23/data-compliance/stats',
  '/make-server-fc003b23/settings/audit-logs',
  // 1B.2 extension — three modules missed by the original 1B.2 list.
  '/make-server-fc003b23/reorder/audit',
  '/make-server-fc003b23/billing/overview',
  '/make-server-fc003b23/staff/',
  // 1B.2 final-coverage pass — vaccinations had an atob JWT-decode helper;
  // calendar + reports had in-file middleware that set a non-AuthenticatedUser
  // shape into context (the TS2769 the augmentation surfaced).
  '/make-server-fc003b23/pets/test-pet/vaccinations',
  '/make-server-fc003b23/calendar/events',
  '/make-server-fc003b23/reports/pets',
  // Portal-admin staff queues (X-User-Token + staff role from app_metadata).
  '/make-server-fc003b23/portal-admin/pet-verifications',
];

test.describe('tampered token is rejected (1B.2) @smoke', () => {
  test.skip(!projectId || !anonKey,
    'requires VITE_SUPABASE_PROJECT_ID and VITE_SUPABASE_ANON_KEY in env');

  for (const path of PROTECTED_ROUTES) {
    test(`rejects tampered token on GET ${path}`, async ({ request }) => {
      const url = `https://${projectId}.supabase.co/functions/v1${path}`;
      const res = await request.get(url, {
        headers: {
          // The Supabase Edge Function gateway requires *some* bearer to even
          // reach the function — that's the platform anon key. The 1B.1
          // shared client puts the user JWT in Authorization, which becomes
          // the value the middleware actually validates. The tampered token
          // here exercises that validation step.
          'Authorization': `Bearer ${TAMPERED_TOKEN}`,
          'X-User-Token': `Bearer ${TAMPERED_TOKEN}`,
          'apikey': anonKey!,
        },
        failOnStatusCode: false,
      });
      expect(res.status(),
        `route ${path} accepted a tampered token (expected 401, got ${res.status()})`,
      ).toBe(401);
    });
  }
});
