// flag_gate: turns operational flags (the FlagKey taxonomy managed in
// customers_routes) into check-in blockers/warnings. Shared by daycare and
// grooming validate-checkin so both read the SAME semantics: an active
// warn-severity flag must be acknowledged at check-in, an active
// block-severity flag prevents check-in until cleared, info flags never gate.
//
// Callers pass the LIVE kv records (prefix
// `customer:{tenantId}:household:{householdId}:flag:`) rather than any
// snapshot stamped on the booking — a flag created seconds ago must gate the
// very next check-in tap.

export interface FlagCheckInIssue {
  type: 'blocker' | 'warning';
  category: 'flag';
  message: string;
}

interface OperationalFlagRecord {
  flag_key?: unknown;
  severity?: unknown;
  is_active?: unknown;
  pet_id?: unknown;
  reason?: unknown;
}

export function flagLabel(key: string): string {
  return key
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

export function flagCheckInIssues(
  records: unknown[],
  petId: string,
  opts: { skipPaymentHold?: boolean } = {},
): { blockers: FlagCheckInIssue[]; warnings: FlagCheckInIssue[] } {
  const blockers: FlagCheckInIssue[] = [];
  const warnings: FlagCheckInIssue[] = [];

  for (const record of records) {
    const flag = record as OperationalFlagRecord | null;
    // The kv prefix scan can only return flag records, but fail closed on
    // shape anyway: no key or inactive → no gate.
    if (!flag || typeof flag.flag_key !== 'string' || flag.is_active !== true) continue;
    // Pet-scoped flags gate only their pet; household-wide flags gate every pet.
    if (typeof flag.pet_id === 'string' && flag.pet_id !== '' && flag.pet_id !== petId) continue;
    // household.payment_hold is synced from payment_hold flags; when the
    // caller already reports an account-hold blocker, skip the duplicate.
    if (flag.flag_key === 'payment_hold' && opts.skipPaymentHold) continue;

    const label = flagLabel(flag.flag_key);
    const reason = typeof flag.reason === 'string' && flag.reason.trim() ? flag.reason.trim() : '';
    const message = reason ? `${label}: ${reason}` : label;

    if (flag.severity === 'block') {
      blockers.push({
        type: 'blocker',
        category: 'flag',
        message: `${message}. Clear this flag on the household profile to check in.`,
      });
    } else if (flag.severity === 'warn') {
      warnings.push({ type: 'warning', category: 'flag', message });
    }
    // 'info' (and anything unrecognised) is reference-only — never gates.
  }

  return { blockers, warnings };
}
