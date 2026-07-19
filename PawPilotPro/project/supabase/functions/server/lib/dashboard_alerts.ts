// Dashboard behaviour/medical alert state — pure, so it unit-tests without
// Deno or Supabase.
//
// Bookings carry `has_behaviour_flag` / `has_medical_flag` stamped at creation
// time from `pet.behaviour_notes`. That misses two live sources of truth the
// check-in screen already honours:
//   1. Operational flags (the FlagKey taxonomy — `behaviour_caution`,
//      `medical_caution`) created on the household/pet AFTER the booking, and
//   2. Pet behaviour/medical notes edited after the booking was made.
// A dog booked in with a behaviour flag therefore never reached the dashboard
// alert card, and the flag-filtered bookings list came back empty even when
// the card showed a non-zero count. Everything here derives the LIVE state per
// booking, and both the counter (/stats) and the list annotator (GET
// /bookings) use the SAME derivation so the card count and the click-through
// list can never disagree.

/** The subset of a booking the live derivation needs. */
export interface AlertBooking {
  pet_id?: string;
  household_id?: string;
  // Snapshot stamped at booking creation — used only as a fallback when the
  // live pet record is gone, so an alert fails towards showing not vanishing.
  behaviour_notes?: string | null;
  medical_notes?: string | null;
  has_behaviour_flag?: boolean;
  has_medical_flag?: boolean;
}

/** Live pet notes, keyed by pet id in the lookup passed to the counter. */
export interface LivePetNotes {
  behaviour_notes?: string | null;
  medical_notes?: string | null;
}

/** The subset of an operational flag record the derivation reads. */
export interface FlagLite {
  flag_key?: unknown;
  is_active?: unknown;
  pet_id?: unknown;
  reason?: unknown;
}

/**
 * The first active flag of `key` that applies to `petId`. A pet-scoped flag
 * gates only its pet; a household-wide flag (pet_id null/empty) gates every
 * pet. Mirrors flag_gate.ts so the dashboard and check-in agree on coverage.
 */
function activeFlag(flags: FlagLite[], petId: string | undefined, key: string): FlagLite | undefined {
  return flags.find((f) => {
    if (!f || f.flag_key !== key || f.is_active !== true) return false;
    if (typeof f.pet_id === 'string' && f.pet_id !== '' && f.pet_id !== petId) return false;
    return true;
  });
}

interface LiveAlertState {
  has_behaviour_flag: boolean;
  has_medical_flag: boolean;
  behaviour_notes?: string | null;
  medical_notes?: string | null;
}

/**
 * Live behaviour/medical state for one booking: pet notes (live when the pet
 * record is present, else the booking snapshot) OR an active caution flag.
 * Notes text prefers the live pet notes; when the alert comes only from a
 * flag, the flag's reason becomes the note so downstream warnings (check-out
 * dialog, booking cards) show WHY rather than a bare icon.
 */
function liveAlertState(
  b: AlertBooking,
  live: LivePetNotes | undefined,
  flags: FlagLite[],
): LiveAlertState {
  const behaviourNotes = live ? live.behaviour_notes : b.behaviour_notes;
  const medicalNotes = live ? live.medical_notes : b.medical_notes;
  const hasBehaviourNote = live ? !!live.behaviour_notes : !!b.has_behaviour_flag;
  const hasMedicalNote = live ? !!live.medical_notes : !!b.has_medical_flag;

  const behaviourFlag = activeFlag(flags, b.pet_id, 'behaviour_caution');
  const medicalFlag = activeFlag(flags, b.pet_id, 'medical_caution');
  // Physical-care flags count as medical/care alerts: a dog needing a diaper
  // must reach the dashboard alert card, not just the profile.
  const diaperFlag = activeFlag(flags, b.pet_id, 'needs_diaper');

  const flagReason = (f: FlagLite | undefined): string | null =>
    f && typeof f.reason === 'string' && f.reason.trim() ? f.reason.trim() : null;

  return {
    has_behaviour_flag: hasBehaviourNote || !!behaviourFlag,
    has_medical_flag: hasMedicalNote || !!medicalFlag || !!diaperFlag,
    behaviour_notes: behaviourNotes || flagReason(behaviourFlag) || b.behaviour_notes || null,
    medical_notes:
      medicalNotes ||
      flagReason(medicalFlag) ||
      (diaperFlag ? 'Needs a diaper' : null) ||
      b.medical_notes ||
      null,
  };
}

/**
 * Return the bookings with `has_behaviour_flag` / `has_medical_flag` (and the
 * corresponding notes) replaced by their LIVE values. Used by GET /bookings so
 * the flag-filtered list, card badges, and check-out warnings reflect flags
 * created after the booking, exactly like the dashboard count.
 */
export function annotateLiveAlertFlags<T extends AlertBooking>(
  bookings: T[],
  petNotes: Map<string, LivePetNotes | undefined>,
  flagsByHousehold: Map<string, FlagLite[]>,
): T[] {
  return bookings.map((b) => {
    const live = b.pet_id ? petNotes.get(b.pet_id) : undefined;
    const flags = b.household_id ? flagsByHousehold.get(b.household_id) ?? [] : [];
    return { ...b, ...liveAlertState(b, live, flags) };
  });
}

/**
 * Behaviour and medical alert counts over the given bookings, one per booking
 * whose LIVE state has a concern. Same derivation as annotateLiveAlertFlags,
 * so the /stats card count always matches the annotated list.
 *
 * @param bookings          the bookings to count over (already filtered to the day/scope)
 * @param petNotes          pet id -> live notes; a pet absent here falls back to the booking snapshot
 * @param flagsByHousehold  household id -> that household's operational flag records
 */
export function countBehaviourMedicalAlerts(
  bookings: AlertBooking[],
  petNotes: Map<string, LivePetNotes | undefined>,
  flagsByHousehold: Map<string, FlagLite[]>,
): { behaviour_flags: number; medical_flags: number } {
  const annotated = annotateLiveAlertFlags(bookings, petNotes, flagsByHousehold);
  return {
    behaviour_flags: annotated.filter((b) => b.has_behaviour_flag).length,
    medical_flags: annotated.filter((b) => b.has_medical_flag).length,
  };
}

/**
 * Group raw kv records into household id -> operational flag records, keeping
 * only records that look like flags. The kv prefix
 * `customer:{tenant}:household:` returns household records AND their nested
 * `...:flag:{id}` records in one scan; this picks out the flags so callers can
 * reuse a scan they already paid for.
 */
export function groupFlagsByHousehold(records: unknown[]): Map<string, FlagLite[]> {
  const byHousehold = new Map<string, FlagLite[]>();
  for (const record of records) {
    const f = record as (FlagLite & { household_id?: unknown }) | null;
    if (!f || typeof f.flag_key !== 'string' || typeof f.household_id !== 'string') continue;
    const list = byHousehold.get(f.household_id) ?? [];
    list.push(f);
    byHousehold.set(f.household_id, list);
  }
  return byHousehold;
}

/** Build the pet id -> live notes lookup from raw pet records. */
export function buildPetNotesMap(records: unknown[]): Map<string, LivePetNotes> {
  const map = new Map<string, LivePetNotes>();
  for (const record of records) {
    const p = record as { id?: unknown; behaviour_notes?: string | null; medical_notes?: string | null } | null;
    if (p && typeof p.id === 'string') {
      map.set(p.id, { behaviour_notes: p.behaviour_notes, medical_notes: p.medical_notes });
    }
  }
  return map;
}
