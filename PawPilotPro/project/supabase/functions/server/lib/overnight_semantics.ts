// Pure overnight-stay semantics — no kv/Deno imports so the vitest unit
// suite can pin the behaviour (tests/unit/overnight-semantics.test.ts).
// The kv-aware wrappers live in overnights_shared.ts.

/** Default nightly boarding rate when a location has none configured. */
export const DEFAULT_OVERNIGHT_RATE = 45;

/** Statuses that no longer hold a bed. Everything else counts as occupying. */
export const TERMINAL_OVERNIGHT_STATUSES = new Set(["cancelled", "no_show", "checked_out"]);

/**
 * A stay occupies the nights [startDate, endDate) — the check-out day is a
 * departure morning, not another night. This matches the capacity planner's
 * tested semantics (plannerFormat.ts / planner-overnights.test.ts); keep the
 * two in agreement or the same dog shows as occupying a bed on departure
 * morning in one screen and not the other.
 */
export function occupiesNight(startDate: string | undefined, endDate: string | undefined, date: string): boolean {
  return !!startDate && !!endDate && startDate <= date && date < endDate;
}

/** Every night (YYYY-MM-DD) a [startDate, endDate) stay occupies. */
export function nightsOf(startDate: string, endDate: string): string[] {
  const nights: string[] = [];
  const cursor = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);
  while (cursor < end) {
    nights.push(cursor.toISOString().split("T")[0]);
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return nights;
}

export interface StayLike {
  startDate?: string;
  endDate?: string;
  status?: string;
}

/**
 * The first night of [startDate, endDate) on which `reservations` already
 * fill `effectiveCapacity` beds, or null when every night fits. Terminal
 * (cancelled/no_show/checked_out) reservations never hold a bed; the caller
 * pre-filters by location and excludes the reservation being edited.
 */
export function firstFullNight(
  startDate: string,
  endDate: string,
  reservations: StayLike[],
  effectiveCapacity: number,
): string | null {
  const active = reservations.filter((r) => r && !TERMINAL_OVERNIGHT_STATUSES.has(r.status ?? ""));
  for (const night of nightsOf(startDate, endDate)) {
    const occupied = active.filter((r) => occupiesNight(r.startDate, r.endDate, night)).length;
    if (occupied >= effectiveCapacity) return night;
  }
  return null;
}
