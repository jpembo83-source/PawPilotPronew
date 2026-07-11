// Bulk-capture + assign-at-approval smoke tests.
//
// Invariants under test:
//   1. Auth surface: tampered token → 401; staff-role token → 403 on the
//      manager-only candidates endpoint (curation stays admin/manager-only;
//      approve/review-queue are covered in photo-moderation.spec.ts).
//   2. Upload N files with no pet → N pending UNASSIGNED rows sharing the
//      upload_batch_id and location.
//   3. Approving an unassigned photo WITHOUT a pet_id is rejected.
//   4. Assign + approve sets pet fields and the photo reaches the gallery;
//      pending/unassigned photos never appear there (the gallery query is
//      approved-only — owner-side exclusion is additionally covered by the
//      portal-creds-gated test in photo-moderation.spec.ts and by RLS).
//
// The write-path tests CREATE real rows, so they only run when explicitly
// pointed at an environment: PHOTO_E2E=1 plus a manager-role login
// (TEST_MANAGER_EMAIL/TEST_MANAGER_PASSWORD), PHOTO_E2E_LOCATION_ID and
// PHOTO_E2E_PET_ID. They clean up after themselves by rejecting leftovers
// (rejected rows never reach owners).

import { test, expect, type APIRequestContext } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

const projectId = process.env.VITE_SUPABASE_PROJECT_ID || process.env.SUPABASE_PROJECT_ID;
const projectUrl = process.env.VITE_SUPABASE_URL
  || (projectId ? `https://${projectId}.supabase.co` : undefined);
const anonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

const staffEmail = process.env.TEST_EMAIL;
const staffPassword = process.env.TEST_PASSWORD;

const writeEnabled = process.env.PHOTO_E2E === '1';
const managerEmail = process.env.TEST_MANAGER_EMAIL;
const managerPassword = process.env.TEST_MANAGER_PASSWORD;
const e2eLocationId = process.env.PHOTO_E2E_LOCATION_ID;
const e2ePetId = process.env.PHOTO_E2E_PET_ID;

const FN_BASE = projectId
  ? `https://${projectId}.supabase.co/functions/v1/make-server-fc003b23`
  : '';

const TAMPERED_TOKEN =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.' +
  'eyJzdWIiOiIwMDAwMDAwMC0wMDAwLTAwMDAtMDAwMC0wMDAwMDAwMDAwMDAiLCJlbWFpbCI6InRhbXBlckBleGFtcGxlLnRlc3QiLCJleHAiOjk5OTk5OTk5OTl9.' +
  'this-signature-is-not-valid-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';

// 1x1 transparent PNG.
const PNG_1PX = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);

async function signIn(email: string, password: string): Promise<string> {
  const supabase = createClient(projectUrl!, anonKey!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.session) throw new Error(`sign-in failed: ${error?.message}`);
  return data.session.access_token;
}

function authHeaders(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}`, apikey: anonKey! };
}

async function uploadOne(
  request: APIRequestContext,
  token: string,
  opts: { batchId?: string },
): Promise<{ upload_batch_id: string; uploaded: number }> {
  const res = await request.post(`${FN_BASE}/pet-updates/upload`, {
    headers: authHeaders(token),
    multipart: {
      location_id: e2eLocationId!,
      ...(opts.batchId ? { upload_batch_id: opts.batchId } : {}),
      files: { name: `smoke-${Date.now()}.png`, mimeType: 'image/png', buffer: PNG_1PX },
    },
    failOnStatusCode: false,
  });
  expect(res.status(), 'upload should succeed').toBe(200);
  return (await res.json()) as { upload_batch_id: string; uploaded: number };
}

test.describe('photo bulk capture + assign-at-approval @smoke', () => {
  test.skip(!projectId || !anonKey,
    'requires VITE_SUPABASE_PROJECT_ID and VITE_SUPABASE_ANON_KEY in env');

  for (const ep of [
    { method: 'POST' as const, path: '/pet-updates/upload' },
    { method: 'GET' as const, path: '/pet-updates/review-queue/candidates' },
  ]) {
    test(`rejects tampered token with 401 on ${ep.method} ${ep.path}`, async ({ request }) => {
      const res = await request.fetch(`${FN_BASE}${ep.path}`, {
        method: ep.method,
        headers: { ...authHeaders(TAMPERED_TOKEN), 'X-User-Token': `Bearer ${TAMPERED_TOKEN}` },
        failOnStatusCode: false,
      });
      expect(res.status()).toBe(401);
    });
  }

  test('staff-role token gets 403 on the candidates roster (manager-only)', async ({ request }) => {
    test.skip(!projectUrl || !staffEmail || !staffPassword, 'requires TEST_EMAIL / TEST_PASSWORD');
    const supabase = createClient(projectUrl!, anonKey!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await supabase.auth.signInWithPassword({
      email: staffEmail!, password: staffPassword!,
    });
    expect(error).toBeNull();
    const role = (data.user?.app_metadata as { role?: string } | undefined)?.role ?? 'staff';
    test.skip(['admin', 'manager'].includes(role),
      `TEST_EMAIL user has role "${role}" — needs a staff-tier user to prove the 403`);

    const res = await request.get(`${FN_BASE}/pet-updates/review-queue/candidates`, {
      headers: authHeaders(data.session!.access_token),
      failOnStatusCode: false,
    });
    expect(res.status()).toBe(403);
  });

  test('bulk upload → unassigned pending; approve requires assignment; assign+approve lands in gallery', async ({ request }) => {
    test.skip(!writeEnabled || !projectUrl || !managerEmail || !managerPassword || !e2eLocationId || !e2ePetId,
      'requires PHOTO_E2E=1, TEST_MANAGER_EMAIL/PASSWORD, PHOTO_E2E_LOCATION_ID, PHOTO_E2E_PET_ID (creates data)');

    const token = await signIn(managerEmail!, managerPassword!);
    const createdIds: string[] = [];
    try {
      // 2 files, no pet_id → 2 pending unassigned rows in ONE batch.
      const first = await uploadOne(request, token, {});
      expect(first.uploaded).toBe(1);
      const batchId = first.upload_batch_id;
      const second = await uploadOne(request, token, { batchId });
      expect(second.uploaded).toBe(1);
      expect(second.upload_batch_id).toBe(batchId);

      const queueRes = await request.get(`${FN_BASE}/pet-updates/review-queue`, {
        headers: authHeaders(token), failOnStatusCode: false,
      });
      expect(queueRes.status()).toBe(200);
      const queue = (await queueRes.json()) as {
        updates: Array<{ id: string; pet_id?: string | null; upload_batch_id?: string | null; location_id?: string | null }>;
      };
      const mine = queue.updates.filter(u => u.upload_batch_id === batchId);
      expect(mine, 'both files should be pending in the batch').toHaveLength(2);
      for (const row of mine) {
        expect(row.pet_id ?? null).toBeNull();
        expect(row.location_id).toBe(e2eLocationId);
        createdIds.push(row.id);
      }

      // Approve WITHOUT a pet → refused.
      const bare = await request.post(`${FN_BASE}/pet-updates/moment/${createdIds[0]}/approve`, {
        headers: authHeaders(token), data: {}, failOnStatusCode: false,
      });
      expect(bare.status()).toBe(400);

      // Assign + approve → approved with pet fields, visible in the gallery.
      const assigned = await request.post(`${FN_BASE}/pet-updates/moments/approve`, {
        headers: authHeaders(token),
        data: { items: [{ id: createdIds[0], pet_id: e2ePetId }] },
        failOnStatusCode: false,
      });
      expect(assigned.status()).toBe(200);
      expect(((await assigned.json()) as { approved: number }).approved).toBe(1);

      const galleryRes = await request.get(
        `${FN_BASE}/pet-updates/gallery?pet_id=${encodeURIComponent(e2ePetId!)}`,
        { headers: authHeaders(token), failOnStatusCode: false },
      );
      expect(galleryRes.status()).toBe(200);
      const gallery = (await galleryRes.json()) as {
        items: Array<{ id: string; pet_id?: string; status?: string }>;
      };
      expect(gallery.items.some(i => i.id === createdIds[0]), 'approved photo reaches the gallery').toBe(true);
      // The still-pending sibling must NOT be in the (approved-only) gallery.
      expect(gallery.items.some(i => i.id === createdIds[1])).toBe(false);
    } finally {
      // Cleanup: discard whatever is still pending (rejected rows never
      // reach owners; the approved one is real content for the test pet).
      for (const id of createdIds.slice(1)) {
        await request.post(`${FN_BASE}/pet-updates/moment/${id}/reject`, {
          headers: authHeaders(token),
          data: { reason: 'smoke-test cleanup' },
          failOnStatusCode: false,
        });
      }
    }
  });
});
