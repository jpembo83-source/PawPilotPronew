// Paper-notepad booking ingest — staff photograph the owner's handwritten
// daycare page; a vision model turns it into DRAFT bookings in a confirm
// queue. Human-in-the-loop everywhere: nothing books without an explicit
// staff confirmation, and confirmed drafts go through the SAME booking core
// as the dialog (capacity, billing, membership, house-dog, events).
//
// Storage mirrors pet_updates_routes POST /upload: PRIVATE bucket,
// tenant-prefixed paths, image-only, 5MB cap, signed URLs on every read.
// Mounted at /make-server-fc003b23/daycare-notepad.

import { Hono } from 'npm:hono';
import { createClient } from 'npm:@supabase/supabase-js';
import * as kv from './kv_store.tsx';
import { requireAuth, type AuthenticatedUser } from './_shared/auth.ts';
import { internalError } from './_shared/log.ts';
import { MOMENTS_BUCKET, MOMENT_SIGNED_URL_TTL_SECONDS } from './lib/pet_updates.ts';
import { searchPetCandidates } from './lib/photo_candidates.ts';
import { signPetPhotoUrl } from './lib/pet_photos.ts';
import { createBookingCore } from './daycare_routes.tsx';
import { SESSION_DETAILS, isDaycareSession } from './lib/standing_bookings.ts';
import {
  draftReviewReasons,
  matchDogName,
  mondayOf,
  resolveRowDate,
  type NotepadDraft,
  type NotepadPage,
  type RosterPet,
} from './lib/notepad_ingest.ts';
import { extractNotepadRows, VisionNotConfiguredError } from './lib/notepad_vision.ts';

const app = new Hono();
app.use('*', requireAuth);

const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const MAX_UPLOAD_FILES = 10;

// Same role model as daycare bookings: anyone who can take a booking can
// photograph the pad and confirm drafts (each confirmation IS taking a
// booking, through the same core).
const CAN_INGEST_ROLES = ['admin', 'manager', 'assistant_manager', 'staff'];

const getAdmin = () => {
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) {
    throw new Error('[daycare_notepad] SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.');
  }
  return createClient(url, key);
};

let bucketEnsured = false;
async function ensureBucket(admin: {
  storage: {
    listBuckets(): Promise<{ data: Array<{ name: string }> | null }>;
    createBucket(name: string, opts: { public: boolean }): Promise<unknown>;
  };
}) {
  if (bucketEnsured) return;
  const { data: buckets } = await admin.storage.listBuckets();
  if (!buckets?.some((b: { name: string }) => b.name === MOMENTS_BUCKET)) {
    await admin.storage.createBucket(MOMENTS_BUCKET, { public: false });
  }
  bucketEnsured = true;
}

/** Operators may only ingest for a location they belong to (locationIds from
 *  app_metadata via requireAuth, never from the request). Admins are
 *  unrestricted, and accounts carry either an explicit location list, the
 *  'all' sentinel (see transport's driver matching), or an empty list —
 *  the latter two mean every location. */
const canUseLocation = (user: AuthenticatedUser, locationId: string): boolean =>
  user.role === 'admin' ||
  user.locationIds.length === 0 ||
  user.locationIds.includes('all') ||
  user.locationIds.includes(locationId);

function validatePhotoFile(file: File): string | null {
  if (!file.type.startsWith('image/')) return 'File must be an image';
  if (file.size > MAX_PHOTO_BYTES) return 'Photo must be under 5MB';
  return null;
}

const photoExt = (name: string) =>
  (name.split('.').pop() ?? 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';

const extToMediaType: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
};

const pageKey = (id: string) => `daycare:notepad:page:${id}`;
const draftKey = (pageId: string, draftId: string) => `daycare:notepad:draft:${pageId}:${draftId}`;

const todayISO = () => new Date().toISOString().split('T')[0];

// Structural storage type (same approach as pet_updates' withSignedPhotoUrls)
// so the helper accepts the admin client under both Deno and the unit tests'
// node typings.
interface SignedUrlStorage {
  storage: {
    from(bucket: string): {
      createSignedUrl(path: string, ttl: number): Promise<{ data: { signedUrl: string } | null }>;
    };
  };
}

async function signPagePhoto(
  admin: SignedUrlStorage,
  page: NotepadPage,
): Promise<NotepadPage & { photo_url?: string }> {
  const { data } = await admin.storage
    .from(MOMENTS_BUCKET)
    .createSignedUrl(page.photo_path, MOMENT_SIGNED_URL_TTL_SECONDS);
  return { ...page, photo_url: data?.signedUrl };
}

async function loadPage(id: string): Promise<NotepadPage | null> {
  const page = (await kv.get(pageKey(id))) as NotepadPage | null;
  return page && page.id ? page : null;
}

async function loadDrafts(pageId: string): Promise<NotepadDraft[]> {
  const drafts = ((await kv.getByPrefix(`daycare:notepad:draft:${pageId}:`)) as NotepadDraft[])
    .filter((d) => d && d.id);
  drafts.sort((a, b) => (a.y_top ?? 1) - (b.y_top ?? 1) || a.created_at.localeCompare(b.created_at));
  return drafts;
}

/** The tenant's pet roster as typed records for matching. */
async function loadRoster(tenantId: string): Promise<RosterPet[]> {
  const pets = (await kv.getByPrefix(`customer:${tenantId}:pet:`)) as Array<{
    id?: unknown;
    name?: unknown;
    household_id?: unknown;
    active?: unknown;
  }>;
  return pets
    .filter((p) => p && typeof p.id === 'string' && typeof p.name === 'string')
    .map((p) => ({
      id: p.id as string,
      name: p.name as string,
      household_id: typeof p.household_id === 'string' ? p.household_id : undefined,
      active: p.active === false ? false : undefined,
    }));
}

/** Confirmation audit record — who booked what from which page photo. */
async function logConfirmation(
  user: AuthenticatedUser,
  draft: NotepadDraft,
  action: 'confirmed' | 'discarded',
  bookingId?: string,
) {
  const id = crypto.randomUUID();
  await kv.set(`daycare:notepad:event:${draft.page_id}:${id}`, {
    id,
    tenant_id: draft.tenant_id,
    page_id: draft.page_id,
    draft_id: draft.id,
    action,
    booking_id: bookingId,
    pet_id: draft.matched_pet_id,
    date: draft.date,
    session: draft.session,
    actor_id: user.id,
    actor_name: user.name,
    at: new Date().toISOString(),
  });
}

/** Create the real booking for a resolved draft through the shared core.
 *  Returns the updated draft or a {status,error} failure. */
async function confirmDraft(
  user: AuthenticatedUser,
  draft: NotepadDraft,
): Promise<{ ok: true; draft: NotepadDraft } | { ok: false; status: number; error: string }> {
  if (draft.status === 'confirmed') {
    return { ok: false, status: 400, error: 'Draft is already confirmed' };
  }
  if (draft.status === 'discarded') {
    return { ok: false, status: 400, error: 'Draft was discarded' };
  }
  if (!draft.matched_pet_id || !draft.matched_household_id) {
    return { ok: false, status: 400, error: 'Pick the dog before confirming' };
  }
  if (!draft.date) {
    return { ok: false, status: 400, error: 'Set the date before confirming' };
  }

  const location = (await kv.get(`location:${draft.location_id}`)) as { name?: string } | null;
  const details = SESSION_DETAILS[draft.session];
  const result = await createBookingCore(
    user,
    {
      household_id: draft.matched_household_id,
      pet_id: draft.matched_pet_id,
      location_id: draft.location_id,
      location_name: location?.name ?? '',
      service_id: details.serviceId,
      service_name: details.serviceName,
      service_type: draft.session,
      booking_date: draft.date,
      planned_start_time: details.start,
      planned_end_time: details.end,
      customer_notes: `Imported from paper page (written as "${draft.dog_name_as_written}")`,
    },
    // Confirming a paper row must respect capacity like any booking — no
    // silent overbooking from the import queue.
    { allowCapacityOverride: false },
  );
  if (!result.ok) {
    return { ok: false, status: result.status, error: result.error };
  }

  const now = new Date().toISOString();
  const updated: NotepadDraft = {
    ...draft,
    status: 'confirmed',
    booking_id: result.booking.id,
    confirmed_by_id: user.id,
    confirmed_by_name: user.name,
    confirmed_at: now,
    updated_at: now,
  };
  await kv.set(draftKey(draft.page_id, draft.id), updated);
  await logConfirmation(user, updated, 'confirmed', result.booking.id);
  return { ok: true, draft: updated };
}

// ============================================================================
// ROUTES
// ============================================================================

// Upload one or more page photos — mirror of pet_updates POST /upload:
// multipart, image-only, 5MB cap, private bucket, tenant-prefixed path.
// Records who/when/location; parsing is a separate explicit step.
app.post('/upload', async (c) => {
  try {
    const user = c.get('user') as AuthenticatedUser;
    if (!CAN_INGEST_ROLES.includes(user.role)) {
      return c.json({ error: 'Access denied' }, 403);
    }

    const formData = await c.req.formData();
    const locationId = (formData.get('location_id') as string | null)?.trim();
    const weekStartRaw = (formData.get('week_start') as string | null)?.trim();
    const files = formData.getAll('files').filter((f): f is File => f instanceof File);

    if (!locationId) return c.json({ error: 'location_id is required' }, 400);
    if (!canUseLocation(user, locationId)) return c.json({ error: 'Access denied' }, 403);
    if (files.length === 0) return c.json({ error: 'Add at least one photo' }, 400);
    if (files.length > MAX_UPLOAD_FILES) {
      return c.json({ error: `Too many photos (max ${MAX_UPLOAD_FILES} per upload)` }, 400);
    }
    const weekStart = weekStartRaw ? mondayOf(weekStartRaw) : mondayOf(todayISO());
    if (!weekStart) return c.json({ error: 'Invalid week_start' }, 400);

    const admin = getAdmin();
    await ensureBucket(admin);

    const pages: Array<NotepadPage & { photo_url?: string }> = [];
    const failed: Array<{ name: string; error: string }> = [];
    for (const file of files) {
      const invalid = validatePhotoFile(file);
      if (invalid) {
        failed.push({ name: file.name, error: invalid });
        continue;
      }
      const id = crypto.randomUUID();
      // Tenant-prefixed path: isolation is structural, not advisory. The
      // page carries customer names — same privacy class as pet photos.
      const photoPath = `tenant/${user.tenantId}/notepad/${id}.${photoExt(file.name)}`;
      const buffer = new Uint8Array(await file.arrayBuffer());
      const { error: upErr } = await admin.storage
        .from(MOMENTS_BUCKET)
        .upload(photoPath, buffer, { contentType: file.type, upsert: false });
      if (upErr) {
        console.error('[daycare_notepad.upload] storage upload failed:', upErr.message);
        failed.push({ name: file.name, error: 'Upload failed' });
        continue;
      }
      const page: NotepadPage = {
        id,
        tenant_id: user.tenantId,
        location_id: locationId,
        photo_path: photoPath,
        week_start: weekStart,
        status: 'uploaded',
        uploaded_by_id: user.id,
        uploaded_by_name: user.name,
        uploaded_at: new Date().toISOString(),
      };
      await kv.set(pageKey(id), page);
      pages.push(await signPagePhoto(admin, page));
    }

    return c.json({ pages, failed }, pages.length > 0 ? 201 : 400);
  } catch (error) {
    return internalError(c, 'daycareNotepad.upload', error);
  }
});

// Parse one uploaded page: vision extraction → roster matching → draft rows.
// Idempotent-ish: re-parsing replaces this page's unconfirmed drafts
// (confirmed ones are kept — they document real bookings).
app.post('/pages/:id/parse', async (c) => {
  try {
    const user = c.get('user') as AuthenticatedUser;
    if (!CAN_INGEST_ROLES.includes(user.role)) {
      return c.json({ error: 'Access denied' }, 403);
    }
    const page = await loadPage(c.req.param('id'));
    if (!page || page.tenant_id !== user.tenantId) {
      return c.json({ error: 'Page not found' }, 404);
    }
    if (!canUseLocation(user, page.location_id)) return c.json({ error: 'Access denied' }, 403);
    if (page.status === 'discarded') return c.json({ error: 'Page was discarded' }, 400);

    const admin = getAdmin();
    const { data: fileData, error: downloadError } = await admin.storage
      .from(MOMENTS_BUCKET)
      .download(page.photo_path);
    if (downloadError || !fileData) {
      return internalError(c, 'daycareNotepad.parse.download', downloadError ?? new Error('missing file'));
    }
    const bytes = new Uint8Array(await fileData.arrayBuffer());
    let binary = '';
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
    }
    const imageBase64 = btoa(binary);
    const ext = page.photo_path.split('.').pop() ?? 'jpg';
    const mediaType = extToMediaType[ext] ?? 'image/jpeg';

    let rows;
    try {
      rows = await extractNotepadRows({ imageBase64, mediaType, weekStart: page.week_start });
    } catch (visionError) {
      if (visionError instanceof VisionNotConfiguredError) {
        return c.json({ error: 'Paper import is not configured on this server' }, 503);
      }
      const failedPage: NotepadPage = {
        ...page,
        status: 'parse_failed',
        parse_error: 'Could not read the page — retake the photo and try again',
      };
      await kv.set(pageKey(page.id), failedPage);
      console.error('[daycareNotepad.parse] vision extraction failed:', visionError);
      return c.json({ error: 'Could not read the page — retake the photo and try again' }, 502);
    }

    // Roster + context: dogs with bookings at this location around the
    // page's week narrow the fuzzy match ("Bella" → the Bella who comes here).
    const roster = await loadRoster(user.tenantId);
    const allBookings = (await kv.getByPrefix('daycare:booking:')) as Array<{
      pet_id?: string;
      location_id?: string;
      booking_date?: string;
      pet_name?: string;
      id?: string;
    }>;
    const contextPetIds = new Set<string>(
      allBookings
        .filter((b) => b && typeof b === 'object' && b.id && b.pet_name)
        .filter((b) => b.location_id === page.location_id)
        .filter((b) => typeof b.pet_id === 'string')
        .map((b) => b.pet_id as string),
    );

    // Replace unconfirmed drafts from any earlier parse of this page.
    const existing = await loadDrafts(page.id);
    for (const old of existing) {
      if (old.status !== 'confirmed') await kv.del(draftKey(page.id, old.id));
    }

    const now = new Date().toISOString();
    const drafts: NotepadDraft[] = [];
    for (const row of rows) {
      const match = matchDogName(row.dog_name_as_written, roster, { contextPetIds });
      const date = resolveRowDate(row, page.week_start) ?? undefined;
      const base = {
        matched_pet_id: match.pet_id,
        date,
        parse_confidence: row.confidence,
        match_confidence: match.confidence,
      };
      const reasons = draftReviewReasons(base);
      const draft: NotepadDraft = {
        id: crypto.randomUUID(),
        page_id: page.id,
        tenant_id: user.tenantId,
        location_id: page.location_id,
        dog_name_as_written: row.dog_name_as_written,
        date,
        session: row.session,
        parse_confidence: row.confidence,
        match_confidence: match.confidence,
        matched_pet_id: match.pet_id,
        matched_pet_name: match.pet_name,
        matched_household_id: match.household_id,
        candidates: match.candidates,
        status: reasons.length === 0 ? 'ready' : 'needs_review',
        review_reasons: reasons,
        y_top: row.y_top,
        y_bottom: row.y_bottom,
        created_at: now,
        updated_at: now,
      };
      await kv.set(draftKey(page.id, draft.id), draft);
      drafts.push(draft);
    }

    const parsedPage: NotepadPage = {
      ...page,
      status: 'parsed',
      parse_error: undefined,
      parsed_at: now,
    };
    await kv.set(pageKey(page.id), parsedPage);

    return c.json({ page: await signPagePhoto(admin, parsedPage), drafts });
  } catch (error) {
    return internalError(c, 'daycareNotepad.parse', error);
  }
});

// List pages (with draft counts) for the review screen, newest first.
app.get('/pages', async (c) => {
  try {
    const user = c.get('user') as AuthenticatedUser;
    if (!CAN_INGEST_ROLES.includes(user.role)) {
      return c.json({ error: 'Access denied' }, 403);
    }
    const admin = getAdmin();
    let pages = ((await kv.getByPrefix('daycare:notepad:page:')) as NotepadPage[])
      .filter((p) => p && p.id && p.tenant_id === user.tenantId)
      .filter((p) => p.status !== 'discarded')
      .filter((p) => canUseLocation(user, p.location_id));
    pages.sort((a, b) => b.uploaded_at.localeCompare(a.uploaded_at));
    pages = pages.slice(0, 30);

    const withCounts = await Promise.all(
      pages.map(async (page) => {
        const drafts = await loadDrafts(page.id);
        return {
          ...(await signPagePhoto(admin, page)),
          draft_counts: {
            ready: drafts.filter((d) => d.status === 'ready').length,
            needs_review: drafts.filter((d) => d.status === 'needs_review').length,
            confirmed: drafts.filter((d) => d.status === 'confirmed').length,
            discarded: drafts.filter((d) => d.status === 'discarded').length,
          },
        };
      }),
    );
    return c.json({ pages: withCounts });
  } catch (error) {
    return internalError(c, 'daycareNotepad.listPages', error);
  }
});

// One page with its drafts (the review screen's detail view).
app.get('/pages/:id', async (c) => {
  try {
    const user = c.get('user') as AuthenticatedUser;
    if (!CAN_INGEST_ROLES.includes(user.role)) {
      return c.json({ error: 'Access denied' }, 403);
    }
    const page = await loadPage(c.req.param('id'));
    if (!page || page.tenant_id !== user.tenantId) {
      return c.json({ error: 'Page not found' }, 404);
    }
    if (!canUseLocation(user, page.location_id)) return c.json({ error: 'Access denied' }, 403);
    const admin = getAdmin();
    return c.json({ page: await signPagePhoto(admin, page), drafts: await loadDrafts(page.id) });
  } catch (error) {
    return internalError(c, 'daycareNotepad.getPage', error);
  }
});

// Correct a draft: pick/replace the dog (id resolved server-side against the
// roster — the client only supplies the lookup key), fix the session or date.
app.patch('/pages/:pageId/drafts/:draftId', async (c) => {
  try {
    const user = c.get('user') as AuthenticatedUser;
    if (!CAN_INGEST_ROLES.includes(user.role)) {
      return c.json({ error: 'Access denied' }, 403);
    }
    const page = await loadPage(c.req.param('pageId'));
    if (!page || page.tenant_id !== user.tenantId) {
      return c.json({ error: 'Page not found' }, 404);
    }
    if (!canUseLocation(user, page.location_id)) return c.json({ error: 'Access denied' }, 403);
    const draft = (await kv.get(draftKey(page.id, c.req.param('draftId')))) as NotepadDraft | null;
    if (!draft || !draft.id) return c.json({ error: 'Draft not found' }, 404);
    if (draft.status === 'confirmed') {
      return c.json({ error: 'Already booked — cancel the booking instead' }, 400);
    }

    const body = await c.req.json();
    if (body.pet_id !== undefined) {
      if (body.pet_id === null || body.pet_id === '') {
        draft.matched_pet_id = undefined;
        draft.matched_pet_name = undefined;
        draft.matched_household_id = undefined;
        draft.match_confidence = 0;
      } else {
        const roster = await loadRoster(user.tenantId);
        const pet = roster.find((p) => p.id === body.pet_id);
        if (!pet || !pet.household_id) return c.json({ error: 'Pet not found' }, 400);
        draft.matched_pet_id = pet.id;
        draft.matched_pet_name = pet.name;
        draft.matched_household_id = pet.household_id;
        // A human picked — that's as confident as it gets. The recorded
        // parse_confidence stays untouched: a low-read row remains flagged
        // (excluded from bulk confirm) but a human can still confirm it
        // individually after checking the snippet.
        draft.match_confidence = 1;
      }
    }
    if (body.session !== undefined) {
      if (!isDaycareSession(body.session)) return c.json({ error: 'Invalid session' }, 400);
      draft.session = body.session;
    }
    if (body.date !== undefined) {
      if (typeof body.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(body.date)) {
        return c.json({ error: 'Invalid date' }, 400);
      }
      draft.date = body.date;
    }
    if (body.status === 'discarded' || body.status === undefined) {
      // status transitions other than discard are recomputed, not client-set
    } else {
      return c.json({ error: 'Only discard is a valid status change here' }, 400);
    }

    const reasons = draftReviewReasons(draft);
    draft.review_reasons = reasons;
    draft.status = body.status === 'discarded' ? 'discarded' : reasons.length === 0 ? 'ready' : 'needs_review';
    draft.updated_at = new Date().toISOString();
    await kv.set(draftKey(page.id, draft.id), draft);
    if (draft.status === 'discarded') await logConfirmation(user, draft, 'discarded');
    return c.json({ draft });
  } catch (error) {
    return internalError(c, 'daycareNotepad.updateDraft', error);
  }
});

// Confirm ONE draft into a real daycare booking (the human-in-the-loop gate).
app.post('/pages/:pageId/drafts/:draftId/confirm', async (c) => {
  try {
    const user = c.get('user') as AuthenticatedUser;
    if (!CAN_INGEST_ROLES.includes(user.role)) {
      return c.json({ error: 'Access denied' }, 403);
    }
    const page = await loadPage(c.req.param('pageId'));
    if (!page || page.tenant_id !== user.tenantId) {
      return c.json({ error: 'Page not found' }, 404);
    }
    if (!canUseLocation(user, page.location_id)) return c.json({ error: 'Access denied' }, 403);
    const draft = (await kv.get(draftKey(page.id, c.req.param('draftId')))) as NotepadDraft | null;
    if (!draft || !draft.id) return c.json({ error: 'Draft not found' }, 404);

    const result = await confirmDraft(user, draft);
    if (!result.ok) return c.json({ error: result.error }, result.status as 400);
    return c.json({ draft: result.draft });
  } catch (error) {
    return internalError(c, 'daycareNotepad.confirm', error);
  }
});

// Bulk confirm: books every draft the humans have already vetted as 'ready'.
// Low-confidence (needs_review) and discarded rows are NEVER touched — they
// stay for individual attention. Per-row failures (capacity, duplicates)
// don't fail the batch; they're reported.
app.post('/pages/:id/confirm-all', async (c) => {
  try {
    const user = c.get('user') as AuthenticatedUser;
    if (!CAN_INGEST_ROLES.includes(user.role)) {
      return c.json({ error: 'Access denied' }, 403);
    }
    const page = await loadPage(c.req.param('id'));
    if (!page || page.tenant_id !== user.tenantId) {
      return c.json({ error: 'Page not found' }, 404);
    }
    if (!canUseLocation(user, page.location_id)) return c.json({ error: 'Access denied' }, 403);

    const drafts = await loadDrafts(page.id);
    let confirmed = 0;
    const failures: Array<{ draft_id: string; dog_name_as_written: string; error: string }> = [];
    for (const draft of drafts) {
      if (draft.status !== 'ready') continue;
      const result = await confirmDraft(user, draft);
      if (result.ok) confirmed += 1;
      else failures.push({ draft_id: draft.id, dog_name_as_written: draft.dog_name_as_written, error: result.error });
    }
    return c.json({ confirmed, failures, drafts: await loadDrafts(page.id) });
  } catch (error) {
    return internalError(c, 'daycareNotepad.confirmAll', error);
  }
});

// Discard a whole page (photo stays in the private bucket for audit).
app.post('/pages/:id/discard', async (c) => {
  try {
    const user = c.get('user') as AuthenticatedUser;
    if (!CAN_INGEST_ROLES.includes(user.role)) {
      return c.json({ error: 'Access denied' }, 403);
    }
    const page = await loadPage(c.req.param('id'));
    if (!page || page.tenant_id !== user.tenantId) {
      return c.json({ error: 'Page not found' }, 404);
    }
    if (!canUseLocation(user, page.location_id)) return c.json({ error: 'Access denied' }, 403);

    const drafts = await loadDrafts(page.id);
    for (const draft of drafts) {
      if (draft.status === 'ready' || draft.status === 'needs_review') {
        const updated: NotepadDraft = { ...draft, status: 'discarded', updated_at: new Date().toISOString() };
        await kv.set(draftKey(page.id, draft.id), updated);
      }
    }
    const updatedPage: NotepadPage = { ...page, status: 'discarded' };
    await kv.set(pageKey(page.id), updatedPage);
    return c.json({ page: updatedPage });
  } catch (error) {
    return internalError(c, 'daycareNotepad.discardPage', error);
  }
});

// Roster search for the manual dog picker (same shape as the pet-updates
// candidates endpoint, but open to booking-capable roles).
app.get('/candidates', async (c) => {
  try {
    const user = c.get('user') as AuthenticatedUser;
    if (!CAN_INGEST_ROLES.includes(user.role)) {
      return c.json({ error: 'Access denied' }, 403);
    }
    const q = c.req.query('q')?.trim();
    if (!q) return c.json({ candidates: [] });
    const pets = await kv.getByPrefix(`customer:${user.tenantId}:pet:`);
    const candidates = searchPetCandidates(pets, q);
    const withPhotos = await Promise.all(
      candidates.map(async (candidate) => ({
        pet_id: candidate.pet_id,
        pet_name: candidate.pet_name,
        household_id: candidate.household_id ?? null,
        photo_url: candidate.pet_photo_stored
          ? await signPetPhotoUrl(candidate.pet_photo_stored)
          : null,
      })),
    );
    return c.json({ candidates: withPhotos });
  } catch (error) {
    return internalError(c, 'daycareNotepad.candidates', error);
  }
});

export default app;
