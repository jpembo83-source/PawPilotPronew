// Pet profile photos — private-bucket handling for make-fc003b23-pet-photos.
// Mirrors the moments pattern (lib/pet_updates.ts withSignedPhotoUrls): the
// record stores the STORAGE OBJECT PATH, never a URL, and every read path
// mints a short-lived signed URL at response time.
//
// Canonical field on the pet KV record: `photo_path` (e.g.
// "pet-photos/{tenantId}/{petId}.jpg"). Legacy records — and denormalised
// copies on daycare bookings / attendance and grooming appointments
// (`pet_photo_url`) — may still hold full public URLs. The resolvers below
// accept every historical form (raw path, public URL, previously-signed URL)
// so nothing breaks while the one-off migration runs and the bucket flips
// private.

import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js";

export const PET_PHOTOS_BUCKET = "make-fc003b23-pet-photos";
/** Same TTL as moment photos (lib/pet_updates.ts). */
export const PET_PHOTO_SIGNED_URL_TTL_SECONDS = 60 * 30;

let admin: SupabaseClient | null = null;
function getAdmin(): SupabaseClient {
  if (admin) return admin;
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) {
    // Fail fast — no anon-key fallback for storage signing.
    throw new Error("[pet_photos] SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
  }
  admin = createClient(url, key, { auth: { persistSession: false } });
  return admin;
}

const isHttpUrl = (v: string) => /^https?:\/\//i.test(v);

/** The stored photo reference on a pet record — `photo_path` is canonical,
 *  `photo_url`/`photoUrl` are legacy forms still present on old records. */
export function storedPetPhoto(rec: unknown): string | null {
  const r = rec as Record<string, unknown> | null | undefined;
  const v = r?.photo_path ?? r?.photo_url ?? r?.photoUrl;
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

/** Object path from any stored form: raw path, public URL, or signed URL of
 *  the pet-photos bucket. Returns null for external URLs and empty values. */
export function petPhotoPathFromStored(stored: unknown): string | null {
  if (typeof stored !== "string") return null;
  // Drop ?v= cache-busters / sign tokens before matching.
  const value = stored.trim().split("?")[0];
  if (!value) return null;
  if (!isHttpUrl(value)) return value; // already an object path
  for (const marker of [
    `/storage/v1/object/public/${PET_PHOTOS_BUCKET}/`,
    `/storage/v1/object/sign/${PET_PHOTOS_BUCKET}/`,
  ]) {
    const i = value.indexOf(marker);
    if (i !== -1) return decodeURIComponent(value.slice(i + marker.length));
  }
  return null; // http(s) URL that does not reference this bucket
}

/** Resolve one stored value to a renderable URL: bucket references become
 *  short-lived signed URLs; external http(s) URLs pass through unchanged;
 *  anything unresolvable becomes null. */
export async function signPetPhotoUrl(stored: unknown): Promise<string | null> {
  if (typeof stored !== "string" || !stored.trim()) return null;
  const path = petPhotoPathFromStored(stored);
  if (!path) return isHttpUrl(stored.trim()) ? stored.trim() : null;
  const { data } = await getAdmin().storage
    .from(PET_PHOTOS_BUCKET)
    .createSignedUrl(path, PET_PHOTO_SIGNED_URL_TTL_SECONDS);
  return data?.signedUrl ?? null;
}

/** Batch resolver for list endpoints — one storage round-trip for all rows.
 *  Returns a map from each ORIGINAL stored value to its renderable URL. */
export async function signPetPhotoUrls(
  storedValues: Iterable<unknown>,
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const byPath = new Map<string, string[]>();
  for (const raw of storedValues) {
    if (typeof raw !== "string") continue;
    const stored = raw.trim();
    if (!stored || out.has(stored) || byPath.has(stored)) continue;
    const path = petPhotoPathFromStored(stored);
    if (!path) {
      if (isHttpUrl(stored)) out.set(stored, stored);
      continue;
    }
    const list = byPath.get(path) ?? [];
    list.push(stored);
    byPath.set(path, list);
  }
  const paths = [...byPath.keys()];
  if (paths.length === 0) return out;
  const { data } = await getAdmin().storage
    .from(PET_PHOTOS_BUCKET)
    .createSignedUrls(paths, PET_PHOTO_SIGNED_URL_TTL_SECONDS);
  for (const row of data ?? []) {
    if (!row.signedUrl || !row.path) continue;
    for (const stored of byPath.get(row.path) ?? []) out.set(stored, row.signedUrl);
  }
  return out;
}

/** Overwrite the photo field on each row with a renderable (signed) URL.
 *  - No `field` argument → pet records: reads photo_path/photo_url/photoUrl,
 *    writes `photo_url`, and drops the legacy `photoUrl` duplicate.
 *  - With `field` (e.g. "pet_photo_url") → denormalised copies on bookings,
 *    attendance records, and grooming appointments. */
export async function withSignedPetPhotos<T extends Record<string, unknown>>(
  rows: T[],
  field?: string,
): Promise<T[]> {
  const stored = (r: T): string | null => {
    if (field) {
      const v = r?.[field];
      return typeof v === "string" && v.trim() ? v.trim() : null;
    }
    return storedPetPhoto(r);
  };
  const map = await signPetPhotoUrls(rows.map((r) => stored(r)));
  return rows.map((r) => {
    if (!r || typeof r !== "object") return r;
    const key = stored(r);
    const url = key ? map.get(key) ?? null : null;
    if (field) return { ...r, [field]: url };
    const copy = { ...r, photo_url: url } as Record<string, unknown>;
    delete copy.photoUrl;
    return copy as T;
  });
}

/** Normalise a photo WRITE onto a record: bucket references (path, public
 *  URL, or signed URL) are persisted as `photo_path`; external URLs stay in
 *  `photo_url`; the client-facing `photoUrl` duplicate is always dropped.
 *  Mutates and returns the record. */
export function applyPetPhotoWrite<T extends Record<string, unknown>>(
  record: T,
  incoming: unknown,
): T {
  const value = typeof incoming === "string" && incoming.trim() ? incoming.trim() : null;
  const path = value ? petPhotoPathFromStored(value) : null;
  const r = record as Record<string, unknown>;
  r.photo_path = path;
  r.photo_url = !path && value && isHttpUrl(value) ? value : null;
  delete r.photoUrl;
  return record;
}
