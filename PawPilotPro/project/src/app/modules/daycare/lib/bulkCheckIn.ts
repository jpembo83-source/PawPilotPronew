// Pure partition/count logic for the bulk check-in summary dialog.
// Kept free of React/store imports so the batch semantics are unit-testable:
// blockers exclude a dog from the batch, warnings gate it behind a PER-DOG
// acknowledgment (identical semantics to the single-dog flow — never a
// blanket "acknowledge all").
import type { DaycareBooking, CheckInValidation } from '../types';

export interface BatchEntry {
  booking: DaycareBooking;
  /** null when the validate call itself failed (network/server error). */
  validation: CheckInValidation | null;
  /** Failure message for a null validation. */
  error?: string;
}

export type BatchSection = 'clear' | 'warning' | 'blocked';

export function sectionOf(entry: BatchEntry): BatchSection {
  if (!entry.validation || !entry.validation.can_check_in) return 'blocked';
  return entry.validation.warnings.length > 0 ? 'warning' : 'clear';
}

/** Why a blocked entry is excluded — blocker messages, or the validate-call error. */
export function blockedReasons(entry: BatchEntry): string[] {
  if (!entry.validation) return [entry.error || 'Could not validate — try again'];
  const blockers = entry.validation.blockers.map(b => b.message);
  return blockers.length > 0 ? blockers : ['Check-in blocked'];
}

/**
 * Dogs that will be checked in right now: all clear dogs, plus warning dogs
 * whose warnings have been individually acknowledged. Blocked dogs are never
 * included.
 */
export function includedEntries(
  entries: BatchEntry[],
  acks: Record<string, boolean>,
): BatchEntry[] {
  return entries.filter(e => {
    const section = sectionOf(e);
    if (section === 'clear') return true;
    if (section === 'warning') return !!acks[e.booking.id];
    return false;
  });
}

/**
 * Confirm enables only when every warning dog has been acknowledged and at
 * least one dog would be checked in. (Blocked dogs never gate the batch —
 * they are excluded and reported, not silently skipped.)
 */
export function canConfirmBatch(
  entries: BatchEntry[],
  acks: Record<string, boolean>,
): boolean {
  const warningDogs = entries.filter(e => sectionOf(e) === 'warning');
  if (!warningDogs.every(e => !!acks[e.booking.id])) return false;
  return includedEntries(entries, acks).length > 0;
}
