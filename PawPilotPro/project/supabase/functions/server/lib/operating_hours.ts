// Organisation operating hours — the "Default Operating Hours" field on
// Settings → Organisation ("07:30 - 18:30") enforced against booking times.
// Pure module (no Deno imports) so it is unit-testable under vitest,
// mirroring lib/my_account.ts and lib/location_header.ts.
//
// Enforcement policy: this is a BUSINESS rule, not an auth gate — when the
// organisation has no parseable hours configured, validation is skipped
// (fail open). When hours ARE configured, a provided booking time outside
// them is rejected with a message that names the window.

export interface OperatingHours {
  /** Minutes-of-day the org opens (inclusive). */
  start: number;
  /** Minutes-of-day the org closes (inclusive for end times). */
  end: number;
  /** Human-readable window for error messages, e.g. "07:30–18:30". */
  label: string;
}

const HHMM_RE = /^([01]?\d|2[0-3]):([0-5]\d)$/;

/** "07:30" / "7:30" → minutes-of-day, or null. */
export function parseTimeToMinutes(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const m = HHMM_RE.exec(value.trim());
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

const pad = (n: number) => String(n).padStart(2, "0");
const minutesToLabel = (mins: number) => `${pad(Math.floor(mins / 60))}:${pad(mins % 60)}`;

/**
 * Parse the free-text hours field: "07:30 - 18:30", "7:00-19:00",
 * "07:30 – 18:30", "07:30 to 18:30". Returns null for anything
 * unparseable or degenerate (end not after start) — callers skip
 * enforcement in that case rather than guessing.
 */
export function parseOperatingHours(raw: unknown): OperatingHours | null {
  if (typeof raw !== "string") return null;
  const parts = raw.trim().split(/\s*(?:-|–|—|to)\s*/i);
  if (parts.length !== 2) return null;
  const start = parseTimeToMinutes(parts[0]);
  const end = parseTimeToMinutes(parts[1]);
  if (start === null || end === null || end <= start) return null;
  return { start, end, label: `${minutesToLabel(start)}–${minutesToLabel(end)}` };
}

/** The org settings record (KV "settings:org") → enforceable hours, or null. */
export function operatingHoursFromOrg(org: unknown): OperatingHours | null {
  const o = org as Record<string, unknown> | null | undefined;
  return parseOperatingHours(o?.defaultOperatingHours);
}

/** Org timezone for interpreting ISO instants as local wall time. */
export function orgTimezone(org: unknown): string {
  const o = org as Record<string, unknown> | null | undefined;
  return typeof o?.timezone === "string" && o.timezone.trim() ? o.timezone.trim() : "Europe/London";
}

export type HoursCheck = { ok: true } | { ok: false; error: string };

/**
 * Validate one provided "HH:MM" against the window. Absent/empty values pass
 * (times are optional on daycare bookings); a provided-but-unparseable value
 * fails — every writer in this codebase sends HH:MM, so anything else is a
 * client bug, not a format to silently accept.
 */
export function checkTimeWithinHours(
  value: unknown,
  hours: OperatingHours,
  field = "time",
): HoursCheck {
  if (value === undefined || value === null || value === "") return { ok: true };
  const mins = parseTimeToMinutes(value);
  if (mins === null) {
    return { ok: false, error: `Invalid ${field} — use HH:MM (24h)` };
  }
  if (mins < hours.start || mins > hours.end) {
    return {
      ok: false,
      error: `The ${field} must be within operating hours (${hours.label})`,
    };
  }
  return { ok: true };
}

/** Validate a booking's start/end pair (either may be absent). */
export function checkWindowWithinHours(
  window: { start?: unknown; end?: unknown },
  hours: OperatingHours,
): HoursCheck {
  const start = checkTimeWithinHours(window.start, hours, "start time");
  if (!start.ok) return start;
  return checkTimeWithinHours(window.end, hours, "end time");
}

/**
 * Minutes-of-day of an ISO instant in the given IANA timezone (what the
 * clock on the wall at the org would read). Returns null when the instant
 * or timezone is unusable — callers skip enforcement rather than misjudge.
 */
export function minutesInTimeZone(iso: unknown, timeZone: string): number | null {
  if (typeof iso !== "string") return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  try {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone,
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(date);
    const hour = Number(parts.find((p) => p.type === "hour")?.value);
    const minute = Number(parts.find((p) => p.type === "minute")?.value);
    if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
    return hour * 60 + minute;
  } catch {
    return null; // unknown timezone — fail open
  }
}

/**
 * Validate an ISO start/end pair (portal requests) against the window,
 * interpreted in the org's timezone. Instants that can't be interpreted
 * pass — the zod schema upstream already guarantees valid datetimes, so
 * this only trips on genuinely out-of-hours requests.
 */
export function checkIsoWindowWithinHours(
  window: { startAt?: unknown; endAt?: unknown },
  hours: OperatingHours,
  timeZone: string,
): HoursCheck {
  for (const [field, iso] of [
    ["start time", window.startAt],
    ["end time", window.endAt],
  ] as const) {
    if (iso === undefined || iso === null || iso === "") continue;
    const mins = minutesInTimeZone(iso, timeZone);
    if (mins === null) continue;
    if (mins < hours.start || mins > hours.end) {
      return {
        ok: false,
        error: `The ${field} must be within operating hours (${hours.label})`,
      };
    }
  }
  return { ok: true };
}
