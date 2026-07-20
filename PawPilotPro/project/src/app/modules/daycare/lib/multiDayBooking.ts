// Multi-day booking date maths — pure, so it unit-tests without a browser or
// any Supabase import. The dialog uses expandDateRange to turn a start/end +
// selected weekdays into the concrete list of day-visit dates to create.

/** 0 = Sunday … 6 = Saturday, matching Date.getUTCDay(). */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

/** Parse a YYYY-MM-DD string as a UTC calendar date (no timezone drift). */
function parseISODate(iso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return null;
  const [, y, mo, d] = m;
  const date = new Date(Date.UTC(Number(y), Number(mo) - 1, Number(d)));
  // Reject impossible dates (e.g. 2026-02-31 rolls over).
  if (
    date.getUTCFullYear() !== Number(y) ||
    date.getUTCMonth() !== Number(mo) - 1 ||
    date.getUTCDate() !== Number(d)
  ) {
    return null;
  }
  return date;
}

function toISODate(date: Date): string {
  return date.toISOString().split('T')[0];
}

/**
 * Every calendar date from `start` to `end` inclusive whose weekday is in
 * `weekdays`. Returns [] if either date is malformed or end < start. Capped at
 * `maxDays` (default 366) so a fat-fingered range can't fan out unbounded.
 */
export function expandDateRange(
  start: string,
  end: string,
  weekdays: ReadonlySet<Weekday> | ReadonlyArray<Weekday>,
  maxDays = 366,
): string[] {
  const startDate = parseISODate(start);
  const endDate = parseISODate(end);
  if (!startDate || !endDate) return [];
  if (endDate.getTime() < startDate.getTime()) return [];

  const allowed: ReadonlySet<number> = weekdays instanceof Set ? weekdays : new Set(weekdays);
  const out: string[] = [];
  const cursor = new Date(startDate.getTime());
  let guard = 0;
  while (cursor.getTime() <= endDate.getTime() && guard < maxDays) {
    if (allowed.has(cursor.getUTCDay())) {
      out.push(toISODate(cursor));
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    guard += 1;
  }
  return out;
}

/** Inclusive night count between two dates (overnight stays bill per night). */
export function nightsBetween(start: string, end: string): number {
  const startDate = parseISODate(start);
  const endDate = parseISODate(end);
  if (!startDate || !endDate) return 0;
  const ms = endDate.getTime() - startDate.getTime();
  if (ms <= 0) return 0;
  return Math.round(ms / (1000 * 60 * 60 * 24));
}

/** Mon–Fri, the sensible default for a daycare day-visit range. */
export const WEEKDAYS_MON_FRI: ReadonlyArray<Weekday> = [1, 2, 3, 4, 5];
/** All seven days. */
export const WEEKDAYS_ALL: ReadonlyArray<Weekday> = [0, 1, 2, 3, 4, 5, 6];

// ── Daycare sessions ─────────────────────────────────────────────────────────
// The one client-side source of truth for what a daycare day can be. The
// booking dialog and the standing-schedule editor both render from this map;
// the server mirrors it in lib/standing_bookings.ts (keep in sync — servers
// can't import Vite-world modules).

/** A bookable daycare day: full day or one of the two half-day windows. */
export type DaycareSession = 'full_day' | 'half_day_am' | 'half_day_pm';

export interface DaycareSessionDetails {
  label: string;
  /** Compact register shorthand ("Full", "½ AM"). */
  shortLabel: string;
  start: string; // HH:mm
  end: string; // HH:mm
  serviceId: string;
  serviceName: string;
}

export const SESSION_DETAILS: Record<DaycareSession, DaycareSessionDetails> = {
  full_day: {
    label: 'Full Day',
    shortLabel: 'Full',
    start: '07:00',
    end: '18:00',
    serviceId: 'service-daycare-full',
    serviceName: 'Daycare (Full Day)',
  },
  half_day_am: {
    label: 'Half Day (AM)',
    shortLabel: '½ AM',
    start: '07:00',
    end: '13:00',
    serviceId: 'service-daycare-half-am',
    serviceName: 'Daycare (Half Day AM)',
  },
  half_day_pm: {
    label: 'Half Day (PM)',
    shortLabel: '½ PM',
    start: '13:00',
    end: '18:00',
    serviceId: 'service-daycare-half-pm',
    serviceName: 'Daycare (Half Day PM)',
  },
};

export const ALL_SESSIONS: ReadonlyArray<DaycareSession> = [
  'full_day',
  'half_day_am',
  'half_day_pm',
];
