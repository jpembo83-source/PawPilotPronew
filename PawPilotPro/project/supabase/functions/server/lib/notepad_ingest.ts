// Paper-notepad booking ingest — pure logic, no I/O, so the matching and
// date-resolution semantics unit-test without Deno or Supabase (same pattern
// as daycare_dedup.ts / standing_bookings.ts). The route file
// (daycare_notepad_routes.tsx) owns storage, KV, and the vision call.
//
// Human-in-the-loop by construction: everything here produces DRAFTS with a
// status; nothing in this module (or the routes) books a dog without an
// explicit staff confirmation.

import { isDaycareSession, type DaycareSession } from './standing_bookings.ts';

// ============================================================================
// TYPES
// ============================================================================

/** One uploaded photo of a handwritten page. Persisted at
 *  `daycare:notepad:page:{id}`; the photo itself lives in the PRIVATE
 *  moments bucket under a tenant-prefixed path, served via signed URLs. */
export interface NotepadPage {
  id: string;
  tenant_id: string;
  location_id: string;
  photo_path: string;
  /** Monday of the week the page describes — weekday-only rows resolve
   *  against it. */
  week_start: string; // YYYY-MM-DD
  status: 'uploaded' | 'parsing' | 'parsed' | 'parse_failed' | 'discarded';
  parse_error?: string;
  uploaded_by_id: string;
  uploaded_by_name: string;
  uploaded_at: string;
  parsed_at?: string;
}

/** What the vision model extracts for one handwritten line. */
export interface ExtractedRow {
  dog_name_as_written: string;
  /** Explicit date if the page shows one (YYYY-MM-DD). */
  date?: string;
  /** Weekday name if the page uses day columns/headings ("Wednesday", "Wed"). */
  weekday?: string;
  session: DaycareSession;
  /** Model's confidence in reading this row, 0..1. */
  confidence: number;
  /** Approximate vertical span of the row in the image, normalised 0..1 —
   *  lets the UI show a cropped snippet next to the draft. Optional. */
  y_top?: number;
  y_bottom?: number;
}

/** One draft booking awaiting human review. Persisted at
 *  `daycare:notepad:draft:{pageId}:{id}`. */
export interface NotepadDraft {
  id: string;
  page_id: string;
  tenant_id: string;
  location_id: string;
  dog_name_as_written: string;
  /** Resolved calendar date, if date/weekday resolution succeeded. */
  date?: string;
  session: DaycareSession;
  /** Vision model's read confidence for the row (0..1). */
  parse_confidence: number;
  /** Roster match confidence for the picked dog (0..1); 0 when unresolved. */
  match_confidence: number;
  matched_pet_id?: string;
  matched_pet_name?: string;
  matched_household_id?: string;
  /** Alternative dogs for the manual picker when the match is ambiguous. */
  candidates: Array<{ pet_id: string; pet_name: string; household_id?: string; score: number }>;
  status: 'ready' | 'needs_review' | 'confirmed' | 'discarded';
  /** Why the row needs attention (unmatched dog, ambiguous, no date, low read). */
  review_reasons: string[];
  booking_id?: string;
  y_top?: number;
  y_bottom?: number;
  confirmed_by_id?: string;
  confirmed_by_name?: string;
  confirmed_at?: string;
  created_at: string;
  updated_at: string;
}

/** Loose shape of a customer pet KV record (customer:{t}:pet:{hh}:{id}). */
export interface RosterPet {
  id: string;
  name: string;
  household_id?: string;
  active?: boolean;
}

// ============================================================================
// EXTRACTION VALIDATION
// ============================================================================

const clamp01 = (n: unknown, fallback: number): number =>
  typeof n === 'number' && Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : fallback;

/** Validates the vision model's JSON into typed rows; malformed rows are
 *  dropped rather than trusted. */
export function normalizeExtractedRows(value: unknown): ExtractedRow[] {
  const rows = Array.isArray(value)
    ? value
    : value && typeof value === 'object' && Array.isArray((value as { rows?: unknown[] }).rows)
      ? (value as { rows: unknown[] }).rows
      : [];
  const out: ExtractedRow[] = [];
  for (const raw of rows) {
    if (!raw || typeof raw !== 'object') continue;
    const row = raw as Record<string, unknown>;
    const name = typeof row.dog_name_as_written === 'string' ? row.dog_name_as_written.trim() : '';
    if (!name) continue;
    if (!isDaycareSession(row.session)) continue;
    out.push({
      dog_name_as_written: name,
      date: typeof row.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(row.date) ? row.date : undefined,
      weekday: typeof row.weekday === 'string' && row.weekday.trim() ? row.weekday.trim() : undefined,
      session: row.session,
      confidence: clamp01(row.confidence, 0.5),
      y_top: typeof row.y_top === 'number' ? clamp01(row.y_top, 0) : undefined,
      y_bottom: typeof row.y_bottom === 'number' ? clamp01(row.y_bottom, 0) : undefined,
    });
  }
  return out;
}

// ============================================================================
// DATE RESOLUTION
// ============================================================================

const WEEKDAY_NAMES: Record<string, number> = {
  sunday: 0, sun: 0,
  monday: 1, mon: 1,
  tuesday: 2, tue: 2, tues: 2,
  wednesday: 3, wed: 3, weds: 3,
  thursday: 4, thu: 4, thur: 4, thurs: 4,
  friday: 5, fri: 5,
  saturday: 6, sat: 6,
};

function parseISODate(iso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return null;
  const [, y, mo, d] = m;
  const date = new Date(Date.UTC(Number(y), Number(mo) - 1, Number(d)));
  if (
    date.getUTCFullYear() !== Number(y) ||
    date.getUTCMonth() !== Number(mo) - 1 ||
    date.getUTCDate() !== Number(d)
  ) {
    return null;
  }
  return date;
}

/**
 * The concrete date a row means: an explicit valid date wins; otherwise a
 * weekday name resolves within the page's week (weekStart = Monday). Returns
 * null when neither works — the draft then needs manual review.
 */
export function resolveRowDate(
  row: Pick<ExtractedRow, 'date' | 'weekday'>,
  weekStart: string,
): string | null {
  if (row.date && parseISODate(row.date)) return row.date;
  if (!row.weekday) return null;
  const weekday = WEEKDAY_NAMES[row.weekday.toLowerCase()];
  if (weekday === undefined) return null;
  const start = parseISODate(weekStart);
  if (!start) return null;
  // weekStart is a Monday (1); offset within Mon..Sun.
  const offset = (weekday - 1 + 7) % 7;
  const d = new Date(start.getTime());
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().split('T')[0];
}

/** Monday of the week containing `date` (UTC calendar maths). */
export function mondayOf(date: string): string | null {
  const d = parseISODate(date);
  if (!d) return null;
  const day = d.getUTCDay();
  d.setUTCDate(d.getUTCDate() - ((day + 6) % 7));
  return d.toISOString().split('T')[0];
}

// ============================================================================
// DOG NAME MATCHING
// ============================================================================

const normalizeName = (name: string): string =>
  name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9 ]/g, '')
    .trim();

/** Levenshtein distance — names are short, so the O(n·m) matrix is fine. */
function editDistance(a: string, b: string): number {
  const rows = a.length + 1;
  const cols = b.length + 1;
  const dist = new Array<number>(cols).fill(0).map((_, j) => j);
  for (let i = 1; i < rows; i++) {
    let prevDiag = dist[0];
    dist[0] = i;
    for (let j = 1; j < cols; j++) {
      const tmp = dist[j];
      dist[j] = Math.min(
        dist[j] + 1,
        dist[j - 1] + 1,
        prevDiag + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
      prevDiag = tmp;
    }
  }
  return dist[cols - 1];
}

/** 0..1 similarity between a handwritten name and a roster name. */
export function nameSimilarity(written: string, rosterName: string): number {
  const a = normalizeName(written);
  const b = normalizeName(rosterName);
  if (!a || !b) return 0;
  if (a === b) return 1;
  // "Rosie B" vs "Rosie" — owners' pads often carry an initial for duplicates.
  if (a.startsWith(`${b} `) || b.startsWith(`${a} `)) return 0.92;
  const distance = editDistance(a, b);
  return Math.max(0, 1 - distance / Math.max(a.length, b.length));
}

/** A match this strong is auto-picked (still confirmed by a human). */
export const MATCH_THRESHOLD = 0.8;
/** The best match must lead the runner-up by this much, or it's ambiguous
 *  (two Bellas) and the human picks. */
export const MATCH_MARGIN = 0.1;

export interface NameMatchResult {
  pet_id?: string;
  pet_name?: string;
  household_id?: string;
  confidence: number;
  candidates: Array<{ pet_id: string; pet_name: string; household_id?: string; score: number }>;
}

/**
 * Fuzzy-match a handwritten dog name against the roster. `contextPetIds`
 * (dogs already booked around this week at this location) get a small boost,
 * narrowing "Bella" to the Bella who actually comes here. An ambiguous or
 * weak match resolves to NO pet — the human picks from `candidates`; a wrong
 * guess is worse than no guess.
 */
export function matchDogName(
  written: string,
  roster: RosterPet[],
  opts: { contextPetIds?: ReadonlySet<string> } = {},
): NameMatchResult {
  const scored = roster
    .filter((p) => p.id && p.name && p.active !== false)
    .map((p) => {
      const base = nameSimilarity(written, p.name);
      const boost = opts.contextPetIds?.has(p.id) ? 0.05 : 0;
      return { pet: p, score: Math.min(1, base + (base > 0 ? boost : 0)) };
    })
    .filter((s) => s.score >= 0.5)
    .sort((a, b) => b.score - a.score);

  const candidates = scored.slice(0, 5).map((s) => ({
    pet_id: s.pet.id,
    pet_name: s.pet.name,
    household_id: s.pet.household_id,
    score: Number(s.score.toFixed(3)),
  }));

  const best = scored[0];
  const runnerUp = scored[1];
  const unambiguous =
    best &&
    best.score >= MATCH_THRESHOLD &&
    (!runnerUp || best.score - runnerUp.score >= MATCH_MARGIN);

  if (!unambiguous) {
    return { confidence: best ? Number(best.score.toFixed(3)) : 0, candidates };
  }
  return {
    pet_id: best.pet.id,
    pet_name: best.pet.name,
    household_id: best.pet.household_id,
    confidence: Number(best.score.toFixed(3)),
    candidates,
  };
}

// ============================================================================
// DRAFT STATUS
// ============================================================================

/** Vision reads below this are flagged even when the dog matched. */
export const LOW_PARSE_CONFIDENCE = 0.6;

/**
 * Review reasons for a draft; empty means the row is 'ready' for one-tap
 * (or bulk) confirmation. Low-confidence rows are NEVER ready — they are
 * flagged for attention and can only be confirmed after a human corrects
 * or explicitly accepts them via an edit.
 */
export function draftReviewReasons(draft: {
  matched_pet_id?: string;
  date?: string;
  parse_confidence: number;
  match_confidence: number;
}): string[] {
  const reasons: string[] = [];
  if (!draft.matched_pet_id) reasons.push('unmatched_dog');
  if (!draft.date) reasons.push('unresolved_date');
  if (draft.parse_confidence < LOW_PARSE_CONFIDENCE) reasons.push('low_read_confidence');
  return reasons;
}
