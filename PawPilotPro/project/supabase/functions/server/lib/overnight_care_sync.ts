// Overnight booking → pet care profile sync. Pure derivation, so it
// unit-tests without Deno or Supabase (same convention as flag_gate.ts /
// dashboard_alerts.ts); the kv-backed applier lives in overnights_routes.
//
// When a reservation is created carrying care notes, those notes are APPENDED
// to the pet's profile fields (never overwritten — the profile keeps its
// history) with a per-booking attribution line, and the care booleans raise
// pet-scoped operational flags. Both derivations are idempotent so a
// re-booking neither duplicates the note lines nor stacks duplicate flags.

/** The care inputs a reservation carries that feed the pet profile. */
export interface CareSyncReservation {
  startDate: string;
  feedingInstructions?: unknown;
  medicationInstructions?: unknown;
  behaviourNotes?: unknown;
  requiresMedication?: unknown;
  hasBehaviourConcerns?: unknown;
  hasAllergies?: unknown;
}

/** Reservation text field → pet profile field. */
export const CARE_NOTE_TARGETS = [
  { source: "feedingInstructions", target: "feeding_instructions" },
  { source: "medicationInstructions", target: "medical_notes" },
  { source: "behaviourNotes", target: "behaviour_notes" },
] as const;

export type CareNoteSource = (typeof CARE_NOTE_TARGETS)[number]["source"];
export type CareNoteTarget = (typeof CARE_NOTE_TARGETS)[number]["target"];

/** The attribution line appended to a pet field for one booking's note. */
export function careNoteLine(startDate: string, text: string): string {
  return `[from overnight booking ${startDate}] ${text}`;
}

function asText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * The pet-field appends a reservation's care notes produce. Returns only the
 * fields that change, each with its FULL new value (existing text + newline +
 * attributed line). Empty/whitespace notes produce nothing; a field whose
 * current value already contains this booking's exact attributed line is
 * skipped, so re-creating the same booking cannot duplicate history.
 */
export function derivePetCareAppends(
  reservation: CareSyncReservation,
  pet: Record<string, unknown>,
): Partial<Record<CareNoteTarget, string>> {
  const appends: Partial<Record<CareNoteTarget, string>> = {};
  for (const { source, target } of CARE_NOTE_TARGETS) {
    const note = asText(reservation[source]);
    if (!note) continue;
    const line = careNoteLine(reservation.startDate, note);
    const existing = asText(pet[target]);
    if (existing.includes(line)) continue; // already recorded for this booking
    appends[target] = existing ? `${existing}\n${line}` : line;
  }
  return appends;
}

/** The operational-flag taxonomy has no allergy key, so allergies raise
 * medical_caution alongside medication needs. */
export type CareFlagKey = "behaviour_caution" | "medical_caution";

export interface CareFlagToRaise {
  flag_key: CareFlagKey;
  severity: "warn";
  reason: string;
}

/** Shape of the live flag records scanned for dedupe (kv prefix
 * `customer:{tenantId}:household:{householdId}:flag:`). */
interface ExistingFlagRecord {
  flag_key?: unknown;
  is_active?: unknown;
  pet_id?: unknown;
}

/**
 * True when an active flag with this key already covers the pet — either
 * scoped to the same pet, or household-wide (no pet_id), which gates every
 * pet in the household (see flag_gate.ts).
 */
function alreadyFlagged(records: unknown[], key: CareFlagKey, petId: string): boolean {
  return records.some((record) => {
    const flag = record as ExistingFlagRecord | null;
    if (!flag || flag.flag_key !== key || flag.is_active !== true) return false;
    const scope = flag.pet_id;
    return scope === null || scope === undefined || scope === "" || scope === petId;
  });
}

/**
 * The flags a reservation's care booleans should raise for its pet, after
 * deduping against the household's live flags. Medication and allergies fold
 * into one medical_caution flag with a combined reason.
 */
export function deriveCareFlags(
  reservation: CareSyncReservation,
  existingFlags: unknown[],
  petId: string,
): CareFlagToRaise[] {
  const flags: CareFlagToRaise[] = [];
  const ref = `(from overnight booking ${reservation.startDate})`;

  if (reservation.hasBehaviourConcerns === true && !alreadyFlagged(existingFlags, "behaviour_caution", petId)) {
    const detail = asText(reservation.behaviourNotes) || "Behaviour concerns reported at booking";
    flags.push({ flag_key: "behaviour_caution", severity: "warn", reason: `${detail} ${ref}` });
  }

  const medicalNeeds = [
    reservation.requiresMedication === true ? "Requires medication" : "",
    reservation.hasAllergies === true ? "Has allergies" : "",
  ].filter(Boolean);
  if (medicalNeeds.length > 0 && !alreadyFlagged(existingFlags, "medical_caution", petId)) {
    flags.push({ flag_key: "medical_caution", severity: "warn", reason: `${medicalNeeds.join("; ")} ${ref}` });
  }

  return flags;
}
