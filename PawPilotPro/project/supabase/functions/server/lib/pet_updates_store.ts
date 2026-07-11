// Postgres store for photo/note moments — the pet_updates table
// (migrations/20260711120000_phase4_pet_updates_stage0.sql).
//
// Why Postgres and not another KV family: the moderation queue ("all pending
// for the tenant") and the gallery ("a household's approved photos across all
// time, paginated") are relational, filter-by-status/date workloads that would
// be full prefix scans in KV. Per Phase 4 conventions the edge function
// (service-role) is the sole writer; RLS is on as defence in depth.
//
// checked_in/checked_out feed events stay on the legacy KV family (they
// belong to the daycare entity migration). Day feeds merge both sources via
// mergeDayFeeds() in pet_updates.ts.

import type { SupabaseClient } from "npm:@supabase/supabase-js";
import type { PetUpdate, PetUpdateStatus, PetUpdateType } from "./pet_updates.ts";

export const PET_UPDATES_TABLE = "pet_updates";

/** Wire shape of a public.pet_updates row (nullable where the record is optional). */
export interface PetUpdateRow {
  id: string;
  tenant_id: string;
  /** NULL = unassigned bulk capture (pending, awaiting a manager's dog pick). */
  pet_id: string | null;
  pet_name: string | null;
  household_id: string | null;
  booking_id: string | null;
  location_id: string | null;
  upload_batch_id: string | null;
  date: string;
  type: PetUpdateType;
  text: string | null;
  caption: string | null;
  photo_path: string | null;
  status: PetUpdateStatus;
  rejected_reason: string | null;
  created_by_id: string;
  created_by_name: string | null;
  reviewed_by_id: string | null;
  reviewed_by_name: string | null;
  reviewed_at: string | null;
  created_at: string;
  legacy_kv_key: string | null;
}

export function petUpdateToRow(u: PetUpdate): PetUpdateRow {
  return {
    id: u.id,
    tenant_id: u.tenant_id,
    pet_id: u.pet_id ?? null,
    pet_name: u.pet_name ?? null,
    household_id: u.household_id ?? null,
    booking_id: u.booking_id ?? null,
    location_id: u.location_id ?? null,
    upload_batch_id: u.upload_batch_id ?? null,
    date: u.date,
    type: u.type,
    text: u.text ?? null,
    caption: u.caption ?? null,
    photo_path: u.photo_path ?? null,
    status: u.status ?? "approved",
    rejected_reason: u.rejected_reason ?? null,
    created_by_id: u.created_by_id,
    created_by_name: u.created_by_name ?? null,
    reviewed_by_id: u.reviewed_by_id ?? null,
    reviewed_by_name: u.reviewed_by_name ?? null,
    reviewed_at: u.reviewed_at ?? null,
    created_at: u.created_at,
    legacy_kv_key: null,
  };
}

export function rowToPetUpdate(row: PetUpdateRow): PetUpdate {
  const u: PetUpdate = {
    id: row.id,
    tenant_id: row.tenant_id,
    date: row.date,
    type: row.type,
    created_by_id: row.created_by_id,
    created_by_name: row.created_by_name ?? "",
    created_at: row.created_at,
    status: row.status,
  };
  if (row.pet_id) u.pet_id = row.pet_id;
  if (row.pet_name) u.pet_name = row.pet_name;
  if (row.location_id) u.location_id = row.location_id;
  if (row.upload_batch_id) u.upload_batch_id = row.upload_batch_id;
  if (row.text) u.text = row.text;
  if (row.caption) u.caption = row.caption;
  if (row.photo_path) u.photo_path = row.photo_path;
  if (row.booking_id) u.booking_id = row.booking_id;
  if (row.household_id) u.household_id = row.household_id;
  if (row.rejected_reason) u.rejected_reason = row.rejected_reason;
  if (row.reviewed_by_id) u.reviewed_by_id = row.reviewed_by_id;
  if (row.reviewed_by_name) u.reviewed_by_name = row.reviewed_by_name;
  if (row.reviewed_at) u.reviewed_at = row.reviewed_at;
  return u;
}

/** Insert a moment. Throws on failure — moment capture must surface errors,
 *  unlike the best-effort KV feed writes on the check-in/out hot path. */
export async function insertPetUpdate(admin: SupabaseClient, update: PetUpdate): Promise<void> {
  const { error } = await admin.from(PET_UPDATES_TABLE).insert(petUpdateToRow(update));
  if (error) throw error;
}

/** A pet's Postgres moments for one day, oldest first (merged with the KV
 *  feed by callers via mergeDayFeeds). */
export async function listMomentsForDay(
  admin: SupabaseClient,
  tenantId: string,
  petId: string,
  date: string,
): Promise<PetUpdate[]> {
  const { data, error } = await admin
    .from(PET_UPDATES_TABLE)
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("pet_id", petId)
    .eq("date", date)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return ((data ?? []) as PetUpdateRow[]).map(rowToPetUpdate);
}

/** The moderation queue: every pending moment in the tenant, newest first. */
export async function listReviewQueue(
  admin: SupabaseClient,
  tenantId: string,
  limit = 200,
): Promise<PetUpdate[]> {
  const { data, error } = await admin
    .from(PET_UPDATES_TABLE)
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return ((data ?? []) as PetUpdateRow[]).map(rowToPetUpdate);
}

// ---- gallery (approved photos, keyset-paginated, newest first) -------------

export interface GalleryCursor {
  createdAt: string;
  id: string;
}

/** Opaque-to-clients cursor: base64(JSON([created_at, id])). */
export function encodeGalleryCursor(cursor: GalleryCursor): string {
  return btoa(JSON.stringify([cursor.createdAt, cursor.id]));
}

export function decodeGalleryCursor(raw: string): GalleryCursor | null {
  try {
    const parsed = JSON.parse(atob(raw)) as unknown;
    if (
      Array.isArray(parsed) && parsed.length === 2 &&
      typeof parsed[0] === "string" && typeof parsed[1] === "string"
    ) {
      return { createdAt: parsed[0], id: parsed[1] };
    }
  } catch {
    // fall through — a malformed cursor is a client error, not a crash
  }
  return null;
}

export interface GalleryQuery {
  householdId?: string;
  petId?: string;
  cursor?: GalleryCursor;
  limit?: number;
}

export interface GalleryPage {
  items: PetUpdate[];
  nextCursor: string | null;
}

/** Approved photo moments, newest first. The status filter here IS the
 *  curation gate at the data layer: no caller can mint an owner-facing signed
 *  URL for a photo this query refuses to return. */
export async function listApprovedGallery(
  admin: SupabaseClient,
  tenantId: string,
  query: GalleryQuery,
): Promise<GalleryPage> {
  const limit = Math.min(Math.max(query.limit ?? 40, 1), 100);
  let q = admin
    .from(PET_UPDATES_TABLE)
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("status", "approved")
    .eq("type", "photo");
  if (query.householdId) q = q.eq("household_id", query.householdId);
  if (query.petId) q = q.eq("pet_id", query.petId);
  if (query.cursor) {
    const { createdAt, id } = query.cursor;
    q = q.or(`created_at.lt.${createdAt},and(created_at.eq.${createdAt},id.lt.${id})`);
  }
  const { data, error } = await q
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(limit + 1);
  if (error) throw error;

  const rows = ((data ?? []) as PetUpdateRow[]).map(rowToPetUpdate);
  const items = rows.slice(0, limit);
  const last = items[items.length - 1];
  const nextCursor = rows.length > limit && last
    ? encodeGalleryCursor({ createdAt: last.created_at, id: last.id })
    : null;
  return { items, nextCursor };
}

// ---- review (approve / reject) ----------------------------------------------

/** Manager's dog pick, applied atomically with approval. All three fields
 *  are resolved server-side from the pet record — never trusted from the
 *  client beyond the pet_id lookup key. */
export interface PetAssignment {
  petId: string;
  petName: string;
  householdId?: string;
}

export interface ReviewArgs {
  action: "approve" | "reject";
  reviewerId: string;
  reviewerName: string;
  /** Owner-facing caption, set on approve. */
  caption?: string;
  /** Internal-only, set on reject. */
  rejectedReason?: string;
  /** Assign this dog atomically with approval (bulk-capture flow). */
  assign?: PetAssignment;
  /** Injectable for tests; defaults to now. */
  at?: Date;
}

export type ReviewResult =
  | { ok: true; update: PetUpdate; changed: boolean }
  | { ok: false; reason: "not_found" | "unassigned" };

/**
 * Transition a moment's status. Any state may be re-reviewed (a manager can
 * retract a mistaken approval, or rescue a mistaken rejection); the WHERE
 * clause excludes rows already in the target state so concurrent reviews of
 * the same moment resolve to exactly one `changed: true` — the caller only
 * notifies the household on that one.
 *
 * Approval requires a pet: an unassigned row (pet_id NULL) can only be
 * approved together with an `assign`; without one the WHERE clause refuses
 * the transition and the result is `{ ok: false, reason: "unassigned" }`.
 */
export async function reviewPetUpdate(
  admin: SupabaseClient,
  tenantId: string,
  id: string,
  args: ReviewArgs,
): Promise<ReviewResult> {
  const target: PetUpdateStatus = args.action === "approve" ? "approved" : "rejected";
  const patch: Partial<PetUpdateRow> = {
    status: target,
    reviewed_by_id: args.reviewerId,
    reviewed_by_name: args.reviewerName,
    reviewed_at: (args.at ?? new Date()).toISOString(),
  };
  if (args.action === "approve" && args.caption !== undefined) {
    patch.caption = args.caption.trim() || null;
  }
  if (args.action === "approve" && args.assign) {
    patch.pet_id = args.assign.petId;
    patch.pet_name = args.assign.petName;
    if (args.assign.householdId) patch.household_id = args.assign.householdId;
  }
  if (args.action === "reject" && args.rejectedReason !== undefined) {
    patch.rejected_reason = args.rejectedReason.trim() || null;
  }

  let query = admin
    .from(PET_UPDATES_TABLE)
    .update(patch)
    .eq("tenant_id", tenantId)
    .eq("id", id)
    .neq("status", target);
  if (args.action === "approve" && !args.assign) {
    // The gate's invariant: no approval without a pet. Enforced in the WHERE
    // clause so a concurrent assign can't be raced past.
    query = query.not("pet_id", "is", null);
  }
  const { data, error } = await query.select().maybeSingle();
  if (error) throw error;
  if (data) return { ok: true, update: rowToPetUpdate(data as PetUpdateRow), changed: true };

  // No row transitioned: already in the target state (idempotent success —
  // do not re-notify), refused because it is unassigned, or missing.
  const { data: existing, error: readError } = await admin
    .from(PET_UPDATES_TABLE)
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("id", id)
    .maybeSingle();
  if (readError) throw readError;
  if (!existing) return { ok: false, reason: "not_found" };
  const row = existing as PetUpdateRow;
  if (args.action === "approve" && !args.assign && !row.pet_id && row.status !== "approved") {
    return { ok: false, reason: "unassigned" };
  }
  return { ok: true, update: rowToPetUpdate(row), changed: false };
}

// ---- notification batching ---------------------------------------------------

export interface ApprovalNotificationGroup {
  householdId: string;
  petId: string;
  petName: string;
  photoCount: number;
  /** First owner-facing caption/note in the batch, if any. */
  note: string | null;
}

/** Group freshly-approved moments into one notification per household+pet
 *  ("3 new photos of Rex"), rather than one push per photo. Moments without a
 *  household are skipped — there is no one to notify. */
export function groupApprovedForNotification(updates: PetUpdate[]): ApprovalNotificationGroup[] {
  const groups = new Map<string, ApprovalNotificationGroup>();
  for (const u of updates) {
    if (!u.household_id) continue;
    const key = `${u.household_id}:${u.pet_id}`;
    const existing = groups.get(key);
    const note = u.caption ?? u.text ?? null;
    if (existing) {
      existing.photoCount += u.type === "photo" ? 1 : 0;
      if (!existing.note && note) existing.note = note;
    } else {
      groups.set(key, {
        householdId: u.household_id,
        // Approval requires assignment, so approved rows always carry a pet;
        // the fallback only guards the type.
        petId: u.pet_id ?? "",
        petName: u.pet_name ?? "your pet",
        photoCount: u.type === "photo" ? 1 : 0,
        note,
      });
    }
  }
  return [...groups.values()];
}
