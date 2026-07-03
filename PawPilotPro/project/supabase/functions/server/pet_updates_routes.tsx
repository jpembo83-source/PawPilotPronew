// Staff routes for the pet-updates feed ("Share a moment" + day reads).
// Photos live in a PRIVATE bucket under a tenant-prefixed path (same shape as
// the vax-uploads pattern in portal_routes) and are served exclusively via
// short-lived signed URLs — never public URLs.

import { Hono } from "npm:hono";
import { createClient } from "npm:@supabase/supabase-js";
import { requireAuth, type AuthenticatedUser } from "./_shared/auth.ts";
import { internalError } from "./_shared/log.ts";
import {
  buildPetUpdate,
  listPetUpdatesForDay,
  recordPetUpdate,
  type PetUpdate,
} from "./lib/pet_updates.ts";

const app = new Hono();
app.use("*", requireAuth);

export const MOMENTS_BUCKET = "pet-moments";
const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const SIGNED_URL_TTL_SECONDS = 60 * 30; // 30 min — matches the docs pattern

// Mirrors daycare_routes' role model: anyone who can run check-in/out can
// share a moment.
const CAN_POST_ROLES = ["admin", "manager", "assistant_manager", "staff"];

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

/** Attach a fresh signed URL for any photo update. */
export async function withSignedPhotoUrls(
  admin: ReturnType<typeof createClient>,
  updates: PetUpdate[],
): Promise<Array<PetUpdate & { photo_url?: string }>> {
  return Promise.all(
    updates.map(async (u) => {
      if (!u.photo_path) return u;
      const { data } = await admin.storage
        .from(MOMENTS_BUCKET)
        .createSignedUrl(u.photo_path, SIGNED_URL_TTL_SECONDS);
      return { ...u, photo_url: data?.signedUrl };
    }),
  );
}

// Share a moment: photo and/or a one-line note for one pet.
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

    let photoPath: string | undefined;
    if (file) {
      if (!file.type.startsWith("image/")) return c.json({ error: "File must be an image" }, 400);
      if (file.size > MAX_PHOTO_BYTES) return c.json({ error: "Photo must be under 5MB" }, 400);

      const admin = getAdmin();
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
    await recordPetUpdate(update);

    const [withUrl] = photoPath
      ? await withSignedPhotoUrls(getAdmin(), [update])
      : [update];
    return c.json({ update: withUrl });
  } catch (error) {
    return internalError(c, "pet_updates.postMoment", error);
  }
});

// A pet's updates for one day (defaults to today). Staff read, tenant-scoped
// by construction: the prefix is built from the caller's own tenantId.
app.get("/", async (c) => {
  try {
    const user = c.get("user") as AuthenticatedUser;
    if (!CAN_POST_ROLES.includes(user.role)) {
      return c.json({ error: "Access denied" }, 403);
    }
    const petId = c.req.query("pet_id");
    if (!petId) return c.json({ error: "pet_id is required" }, 400);
    const date = c.req.query("date") || new Date().toISOString().split("T")[0];

    const updates = await listPetUpdatesForDay(user.tenantId, petId, date);
    const admin = updates.some((u) => u.photo_path) ? getAdmin() : null;
    const result = admin ? await withSignedPhotoUrls(admin, updates) : updates;
    return c.json({ updates: result });
  } catch (error) {
    return internalError(c, "pet_updates.list", error);
  }
});

export default app;
