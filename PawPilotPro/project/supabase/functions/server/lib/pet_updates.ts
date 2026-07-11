// Pet updates — the "how is my dog right now" feed (portal spec §Home) plus
// the photo-moderation model.
//
// Storage is HYBRID during Phase 4:
//   * checked_in / checked_out feed events stay on the legacy KV family
//     (they are daycare-ops exhaust; they migrate with the daycare entity):
//       pet_update:{tenantId}:{date}:{petId}:{id}
//   * photo / note moments live in Postgres `pet_updates`
//     (migrations/20260711120000_phase4_pet_updates_stage0.sql) via
//     lib/pet_updates_store.ts — the moderation queue and the all-time
//     gallery are relational workloads that would be full prefix scans here.
// Day feeds merge both sources with mergeDayFeeds().

import * as kv from "../kv_store.tsx";

export type PetUpdateType = "checked_in" | "checked_out" | "photo" | "note";

/**
 * Moderation lifecycle. Photos are born `pending` and only reach the owner
 * once a manager approves them; text-only notes (and check-in/out events)
 * auto-approve — the curation gate exists for images, not operational facts.
 * Legacy KV rows written before the gate carry no status: treat as approved
 * (they were published immediately under the old model).
 */
export type PetUpdateStatus = "pending" | "approved" | "rejected";

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
  /** Moderation state. Absent on legacy KV rows — read via effectiveStatus(). */
  status?: PetUpdateStatus;
  /** Manager-editable owner-facing caption; distinct from the operator's text. */
  caption?: string;
  /** Internal-only — never serialised to the portal. */
  rejected_reason?: string;
  reviewed_by_id?: string;
  reviewed_by_name?: string;
  reviewed_at?: string; // ISO timestamp
}

/** Legacy rows pre-date the gate and were published immediately: approved. */
export function effectiveStatus(update: Pick<PetUpdate, "status">): PetUpdateStatus {
  return update.status ?? "approved";
}

/** The curation gate, in one place: owners only ever see approved updates. */
export function isVisibleToOwner(update: Pick<PetUpdate, "status">): boolean {
  return effectiveStatus(update) === "approved";
}

/** Owner-facing text: the manager's caption wins over the operator's note. */
export function ownerFacingText(update: Pick<PetUpdate, "text" | "caption">): string | null {
  return update.caption ?? update.text ?? null;
}

/** Merge the legacy KV day feed with Postgres moments: dedupe by id, oldest
 *  first. Both stores are authoritative for disjoint types (KV: check-in/out
 *  events + pre-gate moments; Postgres: gated moments), but a backfill could
 *  produce overlap — Postgres rows win. */
export function mergeDayFeeds(kvRows: PetUpdate[], pgRows: PetUpdate[]): PetUpdate[] {
  const byId = new Map<string, PetUpdate>();
  for (const row of kvRows) byId.set(row.id, row);
  for (const row of pgRows) byId.set(row.id, row);
  return [...byId.values()].sort((a, b) => a.created_at.localeCompare(b.created_at));
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
    // The moderation gate applies to images only: a photo must pass a manager
    // before the owner sees it. Notes and check-in/out events auto-approve.
    status: args.type === "photo" ? "pending" : "approved",
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
