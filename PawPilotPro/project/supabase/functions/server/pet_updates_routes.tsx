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
} from "./lib/pet_updates_store.ts";
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

const approveBodySchema = z.object({
  caption: z.string().trim().max(280).optional(),
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

    const admin = getAdmin();
    const result = await reviewPetUpdate(admin, user.tenantId, c.req.param("id"), {
      action: "approve",
      reviewerId: user.id,
      reviewerName: user.name,
      caption: body.data.caption,
    });
    if (!result.ok) return c.json({ error: "Not found" }, 404);

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
  ids: z.array(z.string().trim().min(1)).min(1).max(100),
});

// Bulk approve ("approve all for Rex"): one notification per household+pet
// batch rather than one push per photo.
app.post("/moments/approve", async (c) => {
  try {
    const user = c.get("user") as AuthenticatedUser;
    if (!CAN_REVIEW_ROLES.includes(user.role)) {
      return c.json({ error: "Access denied" }, 403);
    }
    const body = bulkApproveBodySchema.safeParse(await c.req.json().catch(() => null));
    if (!body.success) return c.json({ error: "Invalid request" }, 400);

    const admin = getAdmin();
    const approved: import("./lib/pet_updates.ts").PetUpdate[] = [];
    let notFound = 0;
    for (const id of body.data.ids) {
      const result = await reviewPetUpdate(admin, user.tenantId, id, {
        action: "approve",
        reviewerId: user.id,
        reviewerName: user.name,
      });
      if (!result.ok) notFound += 1;
      else if (result.changed) approved.push(result.update);
    }
    await notifyApprovedGroups(user.tenantId, groupApprovedForNotification(approved));
    return c.json({ approved: approved.length, notFound });
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
