// Staff routes for the pet-updates feed ("Share a moment", the manager photo
// review queue, and the staff-side gallery).
//
// Photos live in a PRIVATE bucket under a tenant-prefixed path (same shape as
// the vax-uploads pattern in portal_routes) and are served exclusively via
// short-lived signed URLs — never public URLs.
//
// Moderation model: a photo is created `pending` and the household is NOT
// notified at post time. A manager (admin/manager role) approves or rejects
// it from the review queue; approval fires the `moment.shared` notification.
// Text-only notes auto-approve and notify immediately, as before — the gate
// exists for images. Rejected photos are kept in storage (hidden) for
// audit/dispute purposes rather than hard-deleted.

import { Hono } from "npm:hono";
import { z } from "npm:zod";
import { createClient } from "npm:@supabase/supabase-js";
import { requireAuth, type AuthenticatedUser } from "./_shared/auth.ts";
import { internalError } from "./_shared/log.ts";
import {
  buildPetUpdate,
  listPetUpdatesForDay,
  mergeDayFeeds,
  withSignedPhotoUrls,
  MOMENTS_BUCKET,
  type PetUpdate,
} from "./lib/pet_updates.ts";
import {
  decodeGalleryCursor,
  groupApprovedForNotification,
  insertPetUpdate,
  listApprovedGallery,
  listMomentsForDay,
  listReviewQueue,
  reviewPetUpdate,
  type ApprovalNotificationGroup,
  type PetAssignment,
} from "./lib/pet_updates_store.ts";
import {
  candidatesFromBookings,
  resolvePetById,
  searchPetCandidates,
  type CandidatePet,
} from "./lib/photo_candidates.ts";
import { signPetPhotoUrl } from "./lib/pet_photos.ts";
import * as kv from "./kv_store.tsx";
import { notify } from "./lib/notify.ts";

const app = new Hono();
app.use("*", requireAuth);

const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

// Mirrors daycare_routes' role model: anyone who can run check-in/out can
// share a moment.
const CAN_POST_ROLES = ["admin", "manager", "assistant_manager", "staff"];

// The curation gate is a management call — reuses the existing roles rather
// than a bespoke capability (spec §6.3).
const CAN_REVIEW_ROLES = ["admin", "manager"];

const getAdmin = () => {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) {
    throw new Error("[pet_updates] SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
  }
  return createClient(url, key);
};

let bucketEnsured = false;
async function ensureMomentsBucket(admin: ReturnType<typeof createClient>) {
  if (bucketEnsured) return;
  const { data: buckets } = await admin.storage.listBuckets();
  if (!buckets?.some((b: { name: string }) => b.name === MOMENTS_BUCKET)) {
    await admin.storage.createBucket(MOMENTS_BUCKET, { public: false });
  }
  bucketEnsured = true;
}

/** The tenant's pet records (customer:{t}:pet:{hh}:{id}) — the server-side
 *  source of truth for assignment and the search fallback. */
const loadTenantPets = (tenantId: string) => kv.getByPrefix(`customer:${tenantId}:pet:`);

/** Operators may only upload into a location they belong to. Users with no
 *  locationIds (typically admins) are unrestricted — matches the staff app's
 *  location-switcher semantics. locationIds comes from app_metadata via
 *  requireAuth, never from the request. */
function canUseLocation(user: AuthenticatedUser, locationId: string): boolean {
  return user.locationIds.length === 0 || user.locationIds.includes(locationId);
}

function validatePhotoFile(file: File): string | null {
  if (!file.type.startsWith("image/")) return "File must be an image";
  if (file.size > MAX_PHOTO_BYTES) return "Photo must be under 5MB";
  return null;
}

async function uploadMomentPhoto(
  admin: ReturnType<typeof createClient>,
  path: string,
  file: File,
): Promise<string | null> {
  const buffer = new Uint8Array(await file.arrayBuffer());
  const { error } = await admin.storage
    .from(MOMENTS_BUCKET)
    .upload(path, buffer, { contentType: file.type, upsert: false });
  return error ? error.message : null;
}

const photoExt = (name: string) =>
  (name.split(".").pop() ?? "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";

const MAX_UPLOAD_FILES = 20;

// Bulk capture: MULTIPLE photos, dog optional — zero decisions in the yard.
// Each file becomes one `pending` row; without a pet_id the row is
// UNASSIGNED (pet_id NULL) and the manager picks the dog at approval. No
// owner notification fires here under any circumstances (photos only notify
// at approve time). Clients may pass back the returned upload_batch_id on
// subsequent requests so a sequential per-file uploader forms one batch.
app.post("/upload", async (c) => {
  try {
    const user = c.get("user") as AuthenticatedUser;
    if (!CAN_POST_ROLES.includes(user.role)) {
      return c.json({ error: "Access denied" }, 403);
    }

    const formData = await c.req.formData();
    const locationId = (formData.get("location_id") as string | null)?.trim();
    const petId = (formData.get("pet_id") as string | null)?.trim() || undefined;
    const clientBatchId = (formData.get("upload_batch_id") as string | null)?.trim() || undefined;
    const files = formData.getAll("files").filter((f): f is File => f instanceof File);

    if (!locationId) return c.json({ error: "location_id is required" }, 400);
    if (!canUseLocation(user, locationId)) return c.json({ error: "Access denied" }, 403);
    if (files.length === 0) return c.json({ error: "Add at least one photo" }, 400);
    if (files.length > MAX_UPLOAD_FILES) {
      return c.json({ error: `Too many photos (max ${MAX_UPLOAD_FILES} per upload)` }, 400);
    }
    if (clientBatchId && !/^[0-9a-f-]{36}$/i.test(clientBatchId)) {
      return c.json({ error: "Invalid upload_batch_id" }, 400);
    }

    // If the operator DID pick a dog, resolve name + household server-side —
    // the client only ever supplies the lookup key.
    let assign: PetAssignment | undefined;
    if (petId) {
      const resolved = resolvePetById(await loadTenantPets(user.tenantId), petId);
      if (!resolved) return c.json({ error: "Pet not found" }, 400);
      assign = resolved;
    }

    const admin = getAdmin();
    await ensureMomentsBucket(admin);
    const uploadBatchId = clientBatchId ?? crypto.randomUUID();

    let uploaded = 0;
    const failed: Array<{ name: string; error: string }> = [];
    for (const file of files) {
      const invalid = validatePhotoFile(file);
      if (invalid) {
        failed.push({ name: file.name, error: invalid });
        continue;
      }
      const id = crypto.randomUUID();
      // Tenant-prefixed path: isolation is structural, not advisory.
      const photoPath = assign
        ? `tenant/${user.tenantId}/pets/${assign.petId}/moments/${id}.${photoExt(file.name)}`
        : `tenant/${user.tenantId}/unassigned/${uploadBatchId}/${id}.${photoExt(file.name)}`;
      const upErr = await uploadMomentPhoto(admin, photoPath, file);
      if (upErr) {
        console.error("[pet_updates.upload] storage upload failed:", upErr);
        failed.push({ name: file.name, error: "Upload failed" });
        continue;
      }
      await insertPetUpdate(admin, buildPetUpdate({
        tenantId: user.tenantId,
        petId: assign?.petId,
        petName: assign?.petName,
        householdId: assign?.householdId,
        type: "photo",
        photoPath,
        locationId,
        uploadBatchId,
        createdById: user.id,
        createdByName: user.name,
      }));
      uploaded += 1;
    }

    return c.json({ upload_batch_id: uploadBatchId, uploaded, failed });
  } catch (error) {
    return internalError(c, "pet_updates.upload", error);
  }
});

/** One `moment.shared` per household+pet batch ("3 new photos of Rex"), fired
 *  at approve time. Best-effort — a notification failure never fails the
 *  review. */
async function notifyApprovedGroups(tenantId: string, groups: ApprovalNotificationGroup[]) {
  for (const group of groups) {
    try {
      await notify({
        tenantId,
        householdId: group.householdId,
        type: "moment.shared",
        payload: {
          petName: group.petName,
          hasPhoto: group.photoCount > 0,
          photoCount: group.photoCount,
          note: group.note,
        },
        link: "/gallery",
      });
    } catch (notifyError) {
      console.error("[pet_updates.notifyApproved] notify failed (non-fatal):", notifyError);
    }
  }
}

// Share a moment: photo and/or a one-line note for one pet. Photos enter the
// review queue as `pending`; text-only notes publish immediately.
app.post("/moment", async (c) => {
  try {
    const user = c.get("user") as AuthenticatedUser;
    if (!CAN_POST_ROLES.includes(user.role)) {
      return c.json({ error: "Access denied" }, 403);
    }

    const formData = await c.req.formData();
    const petId = (formData.get("pet_id") as string | null)?.trim();
    const petName = (formData.get("pet_name") as string | null)?.trim();
    const text = (formData.get("text") as string | null)?.trim() || undefined;
    const bookingId = (formData.get("booking_id") as string | null)?.trim() || undefined;
    const householdId = (formData.get("household_id") as string | null)?.trim() || undefined;
    const file = formData.get("file") as File | null;

    if (!petId || !petName) return c.json({ error: "Missing pet" }, 400);
    if (!file && !text) return c.json({ error: "Add a photo or a note" }, 400);
    if (text && text.length > 280) return c.json({ error: "Note too long (max 280 characters)" }, 400);

    const admin = getAdmin();
    let photoPath: string | undefined;
    if (file) {
      if (!file.type.startsWith("image/")) return c.json({ error: "File must be an image" }, 400);
      if (file.size > MAX_PHOTO_BYTES) return c.json({ error: "Photo must be under 5MB" }, 400);

      await ensureMomentsBucket(admin);
      const ext = (file.name.split(".").pop() ?? "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
      const id = crypto.randomUUID();
      // Tenant-prefixed path: isolation is structural, not advisory.
      photoPath = `tenant/${user.tenantId}/pets/${petId}/moments/${id}.${ext}`;
      const buffer = new Uint8Array(await file.arrayBuffer());
      const { error: upErr } = await admin.storage
        .from(MOMENTS_BUCKET)
        .upload(photoPath, buffer, { contentType: file.type, upsert: false });
      if (upErr) return internalError(c, "pet_updates.postMoment.upload", upErr);
    }

    const update = buildPetUpdate({
      tenantId: user.tenantId,
      petId,
      petName,
      type: photoPath ? "photo" : "note",
      text,
      photoPath,
      bookingId,
      householdId,
      createdById: user.id,
      createdByName: user.name,
    });
    await insertPetUpdate(admin, update);

    // Owner notification fires at APPROVE time for photos (the curation
    // gate); text-only notes auto-approve so they still notify here.
    if (householdId && update.status === "approved") {
      try {
        await notify({
          tenantId: user.tenantId,
          householdId,
          type: "moment.shared",
          payload: { petName, hasPhoto: false, photoCount: 0, note: text ?? null },
          link: "/",
        });
      } catch (notifyError) {
        console.error("[pet_updates.postMoment] notify failed (non-fatal):", notifyError);
      }
    }

    const [withUrl] = photoPath
      ? await withSignedPhotoUrls(admin, [update])
      : [update];
    return c.json({ update: withUrl });
  } catch (error) {
    return internalError(c, "pet_updates.postMoment", error);
  }
});

// A pet's updates for one day (defaults to today), merging the legacy KV feed
// (check-in/out events, pre-gate moments) with Postgres moments. Staff read,
// tenant-scoped by construction: every query is built from the caller's own
// tenantId. Staff see all statuses — the gate applies to owners, not staff.
app.get("/", async (c) => {
  try {
    const user = c.get("user") as AuthenticatedUser;
    if (!CAN_POST_ROLES.includes(user.role)) {
      return c.json({ error: "Access denied" }, 403);
    }
    const petId = c.req.query("pet_id");
    if (!petId) return c.json({ error: "pet_id is required" }, 400);
    const date = c.req.query("date") || new Date().toISOString().split("T")[0];

    const admin = getAdmin();
    const [kvRows, pgRows] = await Promise.all([
      listPetUpdatesForDay(user.tenantId, petId, date),
      listMomentsForDay(admin, user.tenantId, petId, date),
    ]);
    const updates = mergeDayFeeds(kvRows, pgRows);
    const result = updates.some((u) => u.photo_path)
      ? await withSignedPhotoUrls(admin, updates)
      : updates;
    return c.json({ updates: result });
  } catch (error) {
    return internalError(c, "pet_updates.list", error);
  }
});

// The moderation queue: every pending moment in the tenant, newest first,
// with signed thumbnail URLs. Manager-only.
app.get("/review-queue", async (c) => {
  try {
    const user = c.get("user") as AuthenticatedUser;
    if (!CAN_REVIEW_ROLES.includes(user.role)) {
      return c.json({ error: "Access denied" }, 403);
    }
    const admin = getAdmin();
    const pending = await listReviewQueue(admin, user.tenantId);
    const updates = await withSignedPhotoUrls(admin, pending);
    return c.json({ updates });
  } catch (error) {
    return internalError(c, "pet_updates.reviewQueue", error);
  }
});

// Candidate dogs for assigning an unassigned photo: the roster CHECKED IN at
// the photo's location on its date (same KV source as daycare
// /attendance/today), or — with ?q= — a name search across the tenant's pets
// as the fallback. Profile photos are served as short-lived signed URLs.
app.get("/review-queue/candidates", async (c) => {
  try {
    const user = c.get("user") as AuthenticatedUser;
    if (!CAN_REVIEW_ROLES.includes(user.role)) {
      return c.json({ error: "Access denied" }, 403);
    }
    const locationId = c.req.query("location_id") || undefined;
    const date = c.req.query("date") || new Date().toISOString().split("T")[0];
    const q = c.req.query("q")?.trim();

    let candidates: CandidatePet[];
    if (q) {
      candidates = searchPetCandidates(await loadTenantPets(user.tenantId), q);
    } else {
      const bookings = await kv.getByPrefix("daycare:booking:");
      candidates = candidatesFromBookings(bookings, { date, locationId });
    }

    const withPhotos = await Promise.all(candidates.map(async (candidate) => ({
      pet_id: candidate.pet_id,
      pet_name: candidate.pet_name,
      household_id: candidate.household_id ?? null,
      photo_url: candidate.pet_photo_stored
        ? await signPetPhotoUrl(candidate.pet_photo_stored)
        : null,
      source: candidate.source,
    })));
    return c.json({ candidates: withPhotos, date, locationId: locationId ?? null });
  } catch (error) {
    return internalError(c, "pet_updates.candidates", error);
  }
});

// Cheap pending-count for the staff notification bell — same role gate as
// the queue itself, counts only (no enrichment, no signed URLs); mirrors
// the /vax-queue/pending-count pattern in portal_invites.ts.
app.get("/review-queue/count", async (c) => {
  try {
    const user = c.get("user") as AuthenticatedUser;
    if (!CAN_REVIEW_ROLES.includes(user.role)) {
      return c.json({ error: "Access denied" }, 403);
    }
    const pending = await listReviewQueue(getAdmin(), user.tenantId);
    return c.json({ count: pending.length });
  } catch (error) {
    return internalError(c, "pet_updates.reviewQueueCount", error);
  }
});

const approveBodySchema = z.object({
  caption: z.string().trim().max(280).optional(),
  // Manager's dog pick for an unassigned photo — assignment and approval are
  // one atomic transition. Only the id is trusted; name/household resolve
  // server-side.
  pet_id: z.string().trim().min(1).optional(),
});

// Approve one moment: stamps the reviewer, optionally sets the owner-facing
// caption, and fires the moment.shared notification — the notification moved
// here from post time; this is the curation gate's exit.
app.post("/moment/:id/approve", async (c) => {
  try {
    const user = c.get("user") as AuthenticatedUser;
    if (!CAN_REVIEW_ROLES.includes(user.role)) {
      return c.json({ error: "Access denied" }, 403);
    }
    const body = approveBodySchema.safeParse(await c.req.json().catch(() => ({})));
    if (!body.success) return c.json({ error: "Invalid request" }, 400);

    let assign: PetAssignment | undefined;
    if (body.data.pet_id) {
      const resolved = resolvePetById(await loadTenantPets(user.tenantId), body.data.pet_id);
      if (!resolved) return c.json({ error: "Pet not found" }, 400);
      assign = resolved;
    }

    const admin = getAdmin();
    const result = await reviewPetUpdate(admin, user.tenantId, c.req.param("id"), {
      action: "approve",
      reviewerId: user.id,
      reviewerName: user.name,
      caption: body.data.caption,
      assign,
    });
    if (!result.ok) {
      if (result.reason === "unassigned") {
        return c.json({ error: "Assign a dog before approving" }, 400);
      }
      return c.json({ error: "Not found" }, 404);
    }

    if (result.changed) {
      await notifyApprovedGroups(user.tenantId, groupApprovedForNotification([result.update]));
    }
    const [withUrl] = await withSignedPhotoUrls(admin, [result.update]);
    return c.json({ update: withUrl });
  } catch (error) {
    return internalError(c, "pet_updates.approve", error);
  }
});

const bulkApproveBodySchema = z.object({
  // Legacy shape: approve already-assigned moments by id.
  ids: z.array(z.string().trim().min(1)).max(100).optional(),
  // Assign-and-approve shape: the manager's dog picks, applied atomically
  // with approval. pet_id optional per item (already-assigned rows).
  items: z.array(z.object({
    id: z.string().trim().min(1),
    pet_id: z.string().trim().min(1).optional(),
  })).max(100).optional(),
}).refine((b) => (b.ids?.length ?? 0) + (b.items?.length ?? 0) > 0, {
  message: "Nothing to approve",
});

// Bulk approve ("approve all for Rex" / "approve this dump"): one
// notification per household+pet batch rather than one push per photo.
app.post("/moments/approve", async (c) => {
  try {
    const user = c.get("user") as AuthenticatedUser;
    if (!CAN_REVIEW_ROLES.includes(user.role)) {
      return c.json({ error: "Access denied" }, 403);
    }
    const body = bulkApproveBodySchema.safeParse(await c.req.json().catch(() => null));
    if (!body.success) return c.json({ error: "Invalid request" }, 400);

    const work: Array<{ id: string; petId?: string }> = [
      ...(body.data.ids ?? []).map((id) => ({ id })),
      ...(body.data.items ?? []).map((item) => ({ id: item.id, petId: item.pet_id })),
    ];

    // One tenant pet scan for the whole batch — every assignment resolves
    // name + household server-side from the same snapshot.
    const needsPets = work.some((w) => w.petId);
    const tenantPets = needsPets ? await loadTenantPets(user.tenantId) : [];

    const admin = getAdmin();
    const approved: PetUpdate[] = [];
    let notFound = 0;
    let unassigned = 0;
    let petNotFound = 0;
    for (const { id, petId } of work) {
      let assign: PetAssignment | undefined;
      if (petId) {
        const resolved = resolvePetById(tenantPets, petId);
        if (!resolved) {
          petNotFound += 1;
          continue;
        }
        assign = resolved;
      }
      const result = await reviewPetUpdate(admin, user.tenantId, id, {
        action: "approve",
        reviewerId: user.id,
        reviewerName: user.name,
        assign,
      });
      if (!result.ok) {
        if (result.reason === "unassigned") unassigned += 1;
        else notFound += 1;
      } else if (result.changed) {
        approved.push(result.update);
      }
    }
    await notifyApprovedGroups(user.tenantId, groupApprovedForNotification(approved));
    return c.json({ approved: approved.length, notFound, unassigned, petNotFound });
  } catch (error) {
    return internalError(c, "pet_updates.bulkApprove", error);
  }
});

const rejectBodySchema = z.object({
  reason: z.string().trim().max(500).optional(),
});

// Reject one moment: it never reaches the owner. The storage object is
// retained (hidden behind the status gate) for audit/dispute purposes.
app.post("/moment/:id/reject", async (c) => {
  try {
    const user = c.get("user") as AuthenticatedUser;
    if (!CAN_REVIEW_ROLES.includes(user.role)) {
      return c.json({ error: "Access denied" }, 403);
    }
    const body = rejectBodySchema.safeParse(await c.req.json().catch(() => ({})));
    if (!body.success) return c.json({ error: "Invalid request" }, 400);

    const admin = getAdmin();
    const result = await reviewPetUpdate(admin, user.tenantId, c.req.param("id"), {
      action: "reject",
      reviewerId: user.id,
      reviewerName: user.name,
      rejectedReason: body.data.reason,
    });
    if (!result.ok) return c.json({ error: "Not found" }, 404);
    return c.json({ update: result.update });
  } catch (error) {
    return internalError(c, "pet_updates.reject", error);
  }
});

// Staff-side gallery: a household's (or pet's) approved photos across time,
// keyset-paginated, newest first. Only `approved` rows are ever returned —
// listApprovedGallery enforces the gate at the query layer.
app.get("/gallery", async (c) => {
  try {
    const user = c.get("user") as AuthenticatedUser;
    if (!CAN_POST_ROLES.includes(user.role)) {
      return c.json({ error: "Access denied" }, 403);
    }
    const householdId = c.req.query("household_id") || undefined;
    const petId = c.req.query("pet_id") || undefined;
    if (!householdId && !petId) {
      return c.json({ error: "household_id or pet_id is required" }, 400);
    }
    const rawCursor = c.req.query("cursor");
    const cursor = rawCursor ? decodeGalleryCursor(rawCursor) : undefined;
    if (rawCursor && !cursor) return c.json({ error: "Invalid cursor" }, 400);

    const admin = getAdmin();
    const page = await listApprovedGallery(admin, user.tenantId, {
      householdId,
      petId,
      cursor: cursor ?? undefined,
    });
    const items = await withSignedPhotoUrls(admin, page.items);
    return c.json({ items, nextCursor: page.nextCursor });
  } catch (error) {
    return internalError(c, "pet_updates.gallery", error);
  }
});

export default app;
