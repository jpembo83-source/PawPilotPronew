// Pet updates — the "how is my dog right now" feed (portal spec §Home).
//
// Storage: KV, per Phase 4 direction (the Postgres migration is a DRAFT and
// nothing has been applied — docs/PHASE4_DATA_MIGRATION.md). The key family
// follows the tenant-prefixed convention the Phase 4 doc identifies as the
// correct one, and is date-scoped so "today for this pet" is a single narrow
// prefix scan rather than a load-everything list:
//
//   pet_update:{tenantId}:{date}:{petId}:{id}
//
// This maps 1:1 onto a future `pet_updates` table
// (tenant_id, date, pet_id, id) without reshaping records.

import * as kv from "../kv_store.tsx";

export type PetUpdateType = "checked_in" | "checked_out" | "photo" | "note";

/** Private bucket for moment photos. Reads are signed-URL only. */
export const MOMENTS_BUCKET = "pet-moments";
export const MOMENT_SIGNED_URL_TTL_SECONDS = 60 * 30; // matches docs-download TTL

export interface PetUpdate {
  id: string;
  tenant_id: string;
  pet_id: string;
  pet_name: string;
  /** YYYY-MM-DD — denormalised into the key for cheap daily reads. */
  date: string;
  type: PetUpdateType;
  /** Short staff text: photo caption, note body, or check-out notes/mood. */
  text?: string;
  /** Private-bucket storage path; signed URL is minted at read time. */
  photo_path?: string;
  booking_id?: string;
  /** Household the pet belongs to — lets consumers notify the owner. */
  household_id?: string;
  created_by_id: string;
  created_by_name: string;
  created_at: string; // ISO timestamp
}

export function petUpdateKey(update: Pick<PetUpdate, "tenant_id" | "date" | "pet_id" | "id">): string {
  return `pet_update:${update.tenant_id}:${update.date}:${update.pet_id}:${update.id}`;
}

export function petUpdateDayPrefix(tenantId: string, date: string, petId: string): string {
  return `pet_update:${tenantId}:${date}:${petId}:`;
}

interface BuildArgs {
  tenantId: string;
  petId: string;
  petName: string;
  type: PetUpdateType;
  createdById: string;
  createdByName: string;
  text?: string;
  photoPath?: string;
  bookingId?: string;
  householdId?: string;
  /** Injectable for tests; defaults to now. */
  at?: Date;
}

export function buildPetUpdate(args: BuildArgs): PetUpdate {
  const at = args.at ?? new Date();
  const createdAt = at.toISOString();
  const update: PetUpdate = {
    id: `pupd_${at.getTime()}_${crypto.randomUUID().slice(0, 8)}`,
    tenant_id: args.tenantId,
    pet_id: args.petId,
    pet_name: args.petName,
    date: createdAt.split("T")[0],
    type: args.type,
    created_by_id: args.createdById,
    created_by_name: args.createdByName,
    created_at: createdAt,
  };
  const text = args.text?.trim();
  if (text) update.text = text;
  if (args.photoPath) update.photo_path = args.photoPath;
  if (args.bookingId) update.booking_id = args.bookingId;
  if (args.householdId) update.household_id = args.householdId;
  return update;
}

/** Persist an update. Callers on hot paths (check-in/out) must treat failures
 *  as non-fatal — the feed is best-effort and must never block operations. */
export async function recordPetUpdate(update: PetUpdate): Promise<void> {
  await kv.set(petUpdateKey(update), update);
}

/** All of a pet's updates for one day, oldest first. */
export async function listPetUpdatesForDay(
  tenantId: string,
  petId: string,
  date: string,
): Promise<PetUpdate[]> {
  const rows = (await kv.getByPrefix(petUpdateDayPrefix(tenantId, date, petId))) as PetUpdate[];
  return (Array.isArray(rows) ? rows : []).sort((a, b) =>
    a.created_at.localeCompare(b.created_at),
  );
}

/** Attach a fresh signed URL for any photo update. `admin` must be a
 *  service-role storage client. */
export async function withSignedPhotoUrls(
  // deno-lint-ignore no-explicit-any
  admin: { storage: { from(bucket: string): { createSignedUrl(path: string, ttl: number): Promise<{ data: { signedUrl: string } | null }> } } },
  updates: PetUpdate[],
): Promise<Array<PetUpdate & { photo_url?: string }>> {
  return Promise.all(
    updates.map(async (u) => {
      if (!u.photo_path) return u;
      const { data } = await admin.storage
        .from(MOMENTS_BUCKET)
        .createSignedUrl(u.photo_path, MOMENT_SIGNED_URL_TTL_SECONDS);
      return { ...u, photo_url: data?.signedUrl };
    }),
  );
}
