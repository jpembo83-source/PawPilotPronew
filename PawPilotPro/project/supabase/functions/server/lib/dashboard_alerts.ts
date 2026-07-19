// Dashboard behaviour/medical alert counts — pure, so it unit-tests without
// Deno or Supabase.
//
// The daycare /stats endpoint used to count `booking.has_behaviour_flag`, a
// value stamped onto the booking at creation time from `pet.behaviour_notes`.
// That misses two live sources of truth the check-in screen already honours:
//   1. Operational flags (the FlagKey taxonomy — `behaviour_caution`,
//      `medical_caution`) created on the household/pet AFTER the booking, and
//   2. Pet behaviour/medical notes edited after the booking was made.
// A dog booked in with a behaviour flag therefore never reached the dashboard
// alert card. This recomputes the counts from the same LIVE data check-in uses
// so the card tells the truth.

/** The subset of a booking these counts need. */
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

/** The subset of an operational flag record these counts read. */
export interface FlagLite {
  flag_key?: unknown;
  is_active?: unknown;
  pet_id?: unknown;
}

/**
 * Does an active flag of `key` apply to `petId`? A pet-scoped flag gates only
 * its pet; a household-wide flag (pet_id null/empty) gates every pet. Mirrors
 * flag_gate.ts so the dashboard and check-in agree on who a flag covers.
 */
function flagApplies(flags: FlagLite[], petId: string | undefined, key: string): boolean {
  return flags.some((f) => {
    if (!f || f.flag_key !== key || f.is_active !== true) return false;
    if (typeof f.pet_id === 'string' && f.pet_id !== '' && f.pet_id !== petId) return false;
    return true;
  });
}

/**
 * Behaviour and medical alert counts over the given bookings, one per booking
 * that has a concern from ANY live source: pet notes (live if the pet record is
 * present, else the booking snapshot) or an active behaviour/medical flag.
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
  let behaviour = 0;
  let medical = 0;

  for (const b of bookings) {
    const live = b.pet_id ? petNotes.get(b.pet_id) : undefined;
    const hasBehaviourNote = live ? !!live.behaviour_notes : !!b.has_behaviour_flag;
    const hasMedicalNote = live ? !!live.medical_notes : !!b.has_medical_flag;

    const flags = b.household_id ? flagsByHousehold.get(b.household_id) ?? [] : [];
    const hasBehaviourFlag = flagApplies(flags, b.pet_id, 'behaviour_caution');
    const hasMedicalFlag = flagApplies(flags, b.pet_id, 'medical_caution');

    if (hasBehaviourNote || hasBehaviourFlag) behaviour++;
    if (hasMedicalNote || hasMedicalFlag) medical++;
  }

  return { behaviour_flags: behaviour, medical_flags: medical };
}
