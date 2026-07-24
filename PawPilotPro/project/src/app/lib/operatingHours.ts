// Client-side mirror of supabase/functions/server/lib/operating_hours.ts —
// parses the organisation's "Default Operating Hours" free-text field
// ("07:30 - 18:30") so time pickers can hint the window before the server
// enforces it. Pure (no React) and unit-tested; the SERVER remains the
// authority — this only improves the error-before-submit experience.

export interface OperatingHours {
  start: number;
  end: number;
  /** "07:30" — usable directly as a time input's min attribute. */
  startLabel: string;
  /** "18:30" — usable directly as a time input's max attribute. */
  endLabel: string;
  /** "07:30–18:30" for messages. */
  label: string;
}

const HHMM_RE = /^([01]?\d|2[0-3]):([0-5]\d)$/;

export function parseTimeToMinutes(value: unknown): number | null {
  if (typeof value !== 'string') return null;
  const m = HHMM_RE.exec(value.trim());
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

const pad = (n: number) => String(n).padStart(2, '0');
const toLabel = (mins: number) => `${pad(Math.floor(mins / 60))}:${pad(mins % 60)}`;

export function parseOperatingHours(raw: unknown): OperatingHours | null {
  if (typeof raw !== 'string') return null;
  const parts = raw.trim().split(/\s*(?:-|–|—|to)\s*/i);
  if (parts.length !== 2) return null;
  const start = parseTimeToMinutes(parts[0]);
  const end = parseTimeToMinutes(parts[1]);
  if (start === null || end === null || end <= start) return null;
  const startLabel = toLabel(start);
  const endLabel = toLabel(end);
  return { start, end, startLabel, endLabel, label: `${startLabel}–${endLabel}` };
}

/** True when an "HH:MM" value sits inside the window (absent values pass —
 *  the server treats missing times as valid too). */
export function isTimeWithinHours(value: unknown, hours: OperatingHours | null): boolean {
  if (!hours) return true;
  if (value === undefined || value === null || value === '') return true;
  const mins = parseTimeToMinutes(value);
  if (mins === null) return false;
  return mins >= hours.start && mins <= hours.end;
}
