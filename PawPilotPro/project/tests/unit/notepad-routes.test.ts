// Route-level guarantees for the paper-notepad booking ingest:
//   - uploading a page yields page records in the PRIVATE bucket, drafts only
//     after an explicit parse — and NO bookings at any point pre-confirm,
//   - a confident dog+session+date row confirms into a REAL booking through
//     the shared core (priced, capacity-counted),
//   - an ambiguous name lands unresolved for manual pick and cannot confirm
//     until corrected,
//   - discard removes a row from play,
//   - bulk confirm takes only human-vetted 'ready' rows.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import './setup';

const kvStore = new Map<string, unknown>();
vi.mock('../../supabase/functions/server/kv_store.tsx', () => ({
  get: vi.fn((key: string) => Promise.resolve(kvStore.get(key) ?? null)),
  set: vi.fn((key: string, value: unknown) => Promise.resolve(void kvStore.set(key, value))),
  del: vi.fn((key: string) => Promise.resolve(void kvStore.delete(key))),
  mget: vi.fn((keys: string[]) => Promise.resolve(keys.map((k) => kvStore.get(k) ?? null))),
  mset: vi.fn(() => Promise.resolve()),
  mdel: vi.fn((keys: string[]) =>
    Promise.resolve(void keys.forEach((k) => kvStore.delete(k)))),
  getByPrefix: vi.fn((prefix: string) =>
    Promise.resolve(
      [...kvStore.entries()].filter(([k]) => k.startsWith(prefix)).map(([, v]) => v),
    ),
  ),
}));

// Stand-in auth: staff — the role the ingest workflow is for.
const currentUser = {
  id: 'user-1',
  role: 'staff',
  name: 'Front Desk',
  email: 'desk@example.com',
  tenantId: 'demo-tenant-001',
  locationIds: ['loc-1'],
};
vi.mock('../../supabase/functions/server/_shared/auth.ts', () => ({
  requireAuth: async (
    c: { set: (k: string, v: unknown) => void },
    next: () => Promise<void>,
  ) => {
    c.set('user', currentUser);
    await next();
  },
}));

// In-memory private-bucket double.
const storedFiles = new Map<string, Uint8Array>();
vi.mock('npm:@supabase/supabase-js', () => ({
  createClient: () => ({
    storage: {
      listBuckets: () => Promise.resolve({ data: [{ name: 'pet-moments' }] }),
      createBucket: () => Promise.resolve({}),
      from: () => ({
        upload: (path: string, bytes: Uint8Array) => {
          storedFiles.set(path, bytes);
          return Promise.resolve({ error: null });
        },
        download: (path: string) => {
          const bytes = storedFiles.get(path);
          return Promise.resolve(
            bytes
              ? { data: new Blob([bytes as BlobPart]), error: null }
              : { data: null, error: new Error('not found') },
          );
        },
        createSignedUrl: (path: string) =>
          Promise.resolve({ data: { signedUrl: `https://signed.example/${path}` } }),
      }),
    },
    auth: { admin: { listUsers: () => Promise.resolve({ data: { users: [] } }) } },
  }),
}));

vi.mock('../../supabase/functions/server/lib/pet_photos.ts', () => ({
  signPetPhotoUrl: vi.fn(() => Promise.resolve(null)),
  storedPetPhoto: vi.fn(() => undefined),
  withSignedPetPhotos: vi.fn((rows: unknown[]) => Promise.resolve(rows)),
}));

// Vision double — the extraction is configured per test.
const extractMock = vi.fn();
vi.mock('../../supabase/functions/server/lib/notepad_vision.ts', () => ({
  extractNotepadRows: (...args: unknown[]): Promise<unknown> =>
    extractMock(...args) as Promise<unknown>,
  VisionNotConfiguredError: class VisionNotConfiguredError extends Error {},
}));

import app from '../../supabase/functions/server/daycare_notepad_routes.tsx';

const TENANT = 'demo-tenant-001';

interface StoredBooking {
  id: string;
  pet_id: string;
  pet_name: string;
  booking_date: string;
  booking_status: string;
  service_id: string;
  total_price: number;
}

const bookings = (): StoredBooking[] =>
  [...kvStore.entries()]
    .filter(([k]) => k.startsWith('daycare:booking:'))
    .map(([, v]) => v as StoredBooking)
    .filter((b) => b && typeof b === 'object' && b.id && b.pet_name);

const jsonRequest = (path: string, method: string, body?: unknown) =>
  app.request(path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });

function seed() {
  kvStore.set(`customer:${TENANT}:pet:hh-1:pet-rex`, {
    id: 'pet-rex', household_id: 'hh-1', name: 'Rex', vaccination_status: 'valid',
  });
  kvStore.set(`customer:${TENANT}:pet:hh-2:pet-bella-1`, {
    id: 'pet-bella-1', household_id: 'hh-2', name: 'Bella',
  });
  kvStore.set(`customer:${TENANT}:pet:hh-3:pet-bella-2`, {
    id: 'pet-bella-2', household_id: 'hh-3', name: 'Bella',
  });
  kvStore.set(`customer:${TENANT}:household:hh-1`, { id: 'hh-1', name: 'Muster' });
  kvStore.set(`customer:${TENANT}:household:hh-2`, { id: 'hh-2', name: 'Ambiguous One' });
  kvStore.set(`customer:${TENANT}:household:hh-3`, { id: 'hh-3', name: 'Ambiguous Two' });
  kvStore.set('location:loc-1', { id: 'loc-1', name: 'Main', capacity: { maxDogs: 10 } });
  kvStore.set('pricing:service:service-daycare-full', { base_price: 80, tax_rate: 0.077 });
}

async function uploadPage(): Promise<string> {
  const formData = new FormData();
  formData.append('location_id', 'loc-1');
  formData.append('week_start', '2026-07-20'); // a Monday
  formData.append('files', new File([new Uint8Array([1, 2, 3])], 'page.jpg', { type: 'image/jpeg' }));
  const res = await app.request('/upload', { method: 'POST', body: formData });
  expect(res.status).toBe(201);
  const { pages } = (await res.json()) as { pages: Array<{ id: string; photo_path: string }> };
  expect(pages).toHaveLength(1);
  return pages[0].id;
}

beforeEach(() => {
  kvStore.clear();
  storedFiles.clear();
  extractMock.mockReset();
  currentUser.role = 'staff';
  currentUser.locationIds = ['loc-1'];
  seed();
});

describe('upload', () => {
  it('stores the photo under a tenant-prefixed private path and records who/when/where', async () => {
    const pageId = await uploadPage();
    const page = kvStore.get(`daycare:notepad:page:${pageId}`) as {
      photo_path: string; uploaded_by_name: string; location_id: string; week_start: string; status: string;
    };
    expect(page.photo_path.startsWith(`tenant/${TENANT}/notepad/`)).toBe(true);
    expect(storedFiles.has(page.photo_path)).toBe(true);
    expect(page.uploaded_by_name).toBe('Front Desk');
    expect(page.location_id).toBe('loc-1');
    expect(page.week_start).toBe('2026-07-20');
    expect(page.status).toBe('uploaded');
    // Nothing has been booked by uploading.
    expect(bookings()).toHaveLength(0);
  });

  it("accepts uploads from accounts with the 'all' location sentinel and from admins", async () => {
    // Real accounts carry locationIds: ['all'] meaning every location — the
    // gate must not read that as "only a location literally named all".
    currentUser.locationIds = ['all'];
    await uploadPage();

    currentUser.locationIds = ['somewhere-else'];
    currentUser.role = 'admin';
    await uploadPage();

    currentUser.role = 'staff';
    currentUser.locationIds = ['loc-1'];
  });

  it('rejects non-images, oversized files, and foreign locations', async () => {
    // Cap is now 15MB (clients downscale before upload; this is the backstop).
    const tooBig = new File([new Uint8Array(15 * 1024 * 1024 + 1)], 'big.jpg', { type: 'image/jpeg' });
    const notImage = new File([new Uint8Array([1])], 'notes.pdf', { type: 'application/pdf' });
    const formData = new FormData();
    formData.append('location_id', 'loc-1');
    formData.append('files', tooBig);
    formData.append('files', notImage);
    const res = await app.request('/upload', { method: 'POST', body: formData });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { failed: Array<{ error: string }> };
    expect(body.failed).toHaveLength(2);

    const foreign = new FormData();
    foreign.append('location_id', 'loc-elsewhere');
    foreign.append('files', new File([new Uint8Array([1])], 'p.jpg', { type: 'image/jpeg' }));
    const res2 = await app.request('/upload', { method: 'POST', body: foreign });
    expect(res2.status).toBe(403);
  });
});

describe('parse → drafts', () => {
  it('turns extracted rows into drafts (ready when confident, unresolved when ambiguous) and books NOTHING', async () => {
    const pageId = await uploadPage();
    extractMock.mockResolvedValue([
      { dog_name_as_written: 'Rex', weekday: 'Wednesday', session: 'full_day', confidence: 0.95, y_top: 0.1, y_bottom: 0.15 },
      { dog_name_as_written: 'Bella', weekday: 'Thu', session: 'half_day_am', confidence: 0.9 },
      { dog_name_as_written: 'Scrawl', weekday: 'Fri', session: 'full_day', confidence: 0.3 },
    ]);

    const res = await jsonRequest(`/pages/${pageId}/parse`, 'POST', {});
    expect(res.status).toBe(200);
    const { drafts } = (await res.json()) as { drafts: Array<Record<string, unknown>> };
    expect(drafts).toHaveLength(3);

    const rex = drafts.find((d) => d.dog_name_as_written === 'Rex')!;
    expect(rex.matched_pet_id).toBe('pet-rex');
    expect(rex.date).toBe('2026-07-22');
    expect(rex.status).toBe('ready');

    // Two Bellas → unresolved, candidates offered, needs manual pick.
    const bella = drafts.find((d) => d.dog_name_as_written === 'Bella')!;
    expect(bella.matched_pet_id).toBeUndefined();
    expect(bella.status).toBe('needs_review');
    expect((bella.candidates as Array<{ pet_id: string }>).length).toBeGreaterThanOrEqual(2);

    // Low-confidence read → flagged, never auto-booked.
    const scrawl = drafts.find((d) => d.dog_name_as_written === 'Scrawl')!;
    expect(scrawl.status).toBe('needs_review');
    expect(scrawl.review_reasons).toContain('low_read_confidence');

    // The whole parse created ZERO bookings.
    expect(bookings()).toHaveLength(0);
  });

  it('answers 503 when the vision key is not configured', async () => {
    const pageId = await uploadPage();
    const { VisionNotConfiguredError } = await import(
      '../../supabase/functions/server/lib/notepad_vision.ts'
    );
    extractMock.mockRejectedValue(new VisionNotConfiguredError());
    const res = await jsonRequest(`/pages/${pageId}/parse`, 'POST', {});
    expect(res.status).toBe(503);
  });
});

describe('confirm', () => {
  async function parsedPage(): Promise<{ pageId: string; drafts: Array<{ id: string; dog_name_as_written: string; status: string }> }> {
    const pageId = await uploadPage();
    extractMock.mockResolvedValue([
      { dog_name_as_written: 'Rex', weekday: 'Wednesday', session: 'full_day', confidence: 0.95 },
      { dog_name_as_written: 'Bella', weekday: 'Thu', session: 'half_day_am', confidence: 0.9 },
    ]);
    const res = await jsonRequest(`/pages/${pageId}/parse`, 'POST', {});
    const { drafts } = (await res.json()) as { drafts: Array<{ id: string; dog_name_as_written: string; status: string }> };
    return { pageId, drafts };
  }

  it('a confident row confirms into a real, priced booking with an audit trail', async () => {
    const { pageId, drafts } = await parsedPage();
    const rex = drafts.find((d) => d.dog_name_as_written === 'Rex')!;

    const res = await jsonRequest(`/pages/${pageId}/drafts/${rex.id}/confirm`, 'POST', {});
    expect(res.status).toBe(200);
    const { draft } = (await res.json()) as { draft: { status: string; booking_id: string } };
    expect(draft.status).toBe('confirmed');

    const created = bookings();
    expect(created).toHaveLength(1);
    expect(created[0].pet_id).toBe('pet-rex');
    expect(created[0].booking_date).toBe('2026-07-22');
    expect(created[0].service_id).toBe('service-daycare-full');
    expect(created[0].total_price).toBeCloseTo(80 * 1.077, 5);
    expect(created[0].id).toBe(draft.booking_id);

    // Confirmation is audit-logged.
    const events = [...kvStore.entries()]
      .filter(([k]) => k.startsWith(`daycare:notepad:event:${pageId}:`))
      .map(([, v]) => v as { action: string; booking_id: string; actor_id: string });
    expect(events).toHaveLength(1);
    expect(events[0].action).toBe('confirmed');
    expect(events[0].booking_id).toBe(draft.booking_id);
    expect(events[0].actor_id).toBe('user-1');
  });

  it('an unresolved row cannot confirm until a human picks the dog', async () => {
    const { pageId, drafts } = await parsedPage();
    const bella = drafts.find((d) => d.dog_name_as_written === 'Bella')!;

    const blocked = await jsonRequest(`/pages/${pageId}/drafts/${bella.id}/confirm`, 'POST', {});
    expect(blocked.status).toBe(400);
    expect(bookings()).toHaveLength(0);

    // Human picks one of the Bellas, then confirms.
    const picked = await jsonRequest(`/pages/${pageId}/drafts/${bella.id}`, 'PATCH', { pet_id: 'pet-bella-2' });
    expect(picked.status).toBe(200);
    const confirmed = await jsonRequest(`/pages/${pageId}/drafts/${bella.id}/confirm`, 'POST', {});
    expect(confirmed.status).toBe(200);
    expect(bookings().map((b) => b.pet_id)).toEqual(['pet-bella-2']);
  });

  it('discard removes the row from play and blocks confirmation', async () => {
    const { pageId, drafts } = await parsedPage();
    const rex = drafts.find((d) => d.dog_name_as_written === 'Rex')!;

    const res = await jsonRequest(`/pages/${pageId}/drafts/${rex.id}`, 'PATCH', { status: 'discarded' });
    expect(res.status).toBe(200);
    const blocked = await jsonRequest(`/pages/${pageId}/drafts/${rex.id}/confirm`, 'POST', {});
    expect(blocked.status).toBe(400);
    expect(bookings()).toHaveLength(0);
  });

  it('confirm-all books ready rows only, never the flagged ones', async () => {
    const { pageId } = await parsedPage();

    const res = await jsonRequest(`/pages/${pageId}/confirm-all`, 'POST', {});
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      confirmed: number;
      failures: unknown[];
      drafts: Array<{ dog_name_as_written: string; status: string }>;
    };
    expect(body.confirmed).toBe(1); // Rex only — Bella is needs_review
    expect(body.failures).toEqual([]);
    expect(bookings().map((b) => b.pet_id)).toEqual(['pet-rex']);
    expect(body.drafts.find((d) => d.dog_name_as_written === 'Bella')?.status).toBe('needs_review');
  });

  it('a duplicate booking surfaces as a per-row failure, not a double-book', async () => {
    const { pageId, drafts } = await parsedPage();
    const rex = drafts.find((d) => d.dog_name_as_written === 'Rex')!;
    await jsonRequest(`/pages/${pageId}/drafts/${rex.id}/confirm`, 'POST', {});
    expect(bookings()).toHaveLength(1);

    // Re-parse the same page (drafts regenerate) and bulk-confirm again.
    const reparse = await jsonRequest(`/pages/${pageId}/parse`, 'POST', {});
    expect(reparse.status).toBe(200);
    const res = await jsonRequest(`/pages/${pageId}/confirm-all`, 'POST', {});
    const body = (await res.json()) as { confirmed: number; failures: Array<{ error: string }> };
    expect(body.confirmed).toBe(0);
    expect(body.failures).toHaveLength(1);
    expect(bookings()).toHaveLength(1); // still exactly one Rex booking
  });
});
