// Pure derivation behind boolean "flag toggles" on the pet profile (e.g. the
// "Needs a diaper" tick-box): a checkbox is just a friendly control over the
// existing flag system — no parallel data model. Given the household's live
// flags, these helpers answer (a) is the box ticked, and (b) what single flag
// API call does flipping it require. Pure so it unit-tests without the store.
import type { FlagKey, HouseholdFlag } from './types';

/**
 * The flag record backing a pet-scoped toggle, if one exists. Strictly
 * pet-scoped: household-wide flags are managed in the flag editor, not
 * flipped from a pet's profile. Prefers an active record; falls back to the
 * most recently updated inactive one (the record a re-tick reactivates).
 */
export function findPetFlag(
  flags: HouseholdFlag[],
  petId: string,
  key: FlagKey,
): HouseholdFlag | undefined {
  const mine = flags.filter((f) => f.flag_key === key && f.pet_id === petId);
  return (
    mine.find((f) => f.is_active) ??
    mine.sort((a, b) => (b.updated_at ?? '').localeCompare(a.updated_at ?? ''))[0]
  );
}

/** Whether the toggle renders ticked: an ACTIVE pet-scoped flag exists. */
export function isPetFlagActive(flags: HouseholdFlag[], petId: string, key: FlagKey): boolean {
  return flags.some((f) => f.flag_key === key && f.pet_id === petId && f.is_active);
}

export type PetFlagToggleAction =
  | { type: 'none' }
  | { type: 'create' }
  | { type: 'activate'; flagId: string }
  | { type: 'deactivate'; flagId: string };

/**
 * The single flag-API call a tick/untick requires. Reactivates an existing
 * record instead of creating a duplicate; unticking with no record (or an
 * already-matching state) is a no-op.
 */
export function derivePetFlagToggle(
  flags: HouseholdFlag[],
  petId: string,
  key: FlagKey,
  checked: boolean,
): PetFlagToggleAction {
  const existing = findPetFlag(flags, petId, key);
  if (checked) {
    if (existing?.is_active) return { type: 'none' };
    if (existing) return { type: 'activate', flagId: existing.id };
    return { type: 'create' };
  }
  if (existing?.is_active) return { type: 'deactivate', flagId: existing.id };
  return { type: 'none' };
}
