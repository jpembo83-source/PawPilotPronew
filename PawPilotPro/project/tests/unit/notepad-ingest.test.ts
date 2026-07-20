import { describe, it, expect } from 'vitest';
import {
  draftReviewReasons,
  matchDogName,
  mondayOf,
  nameSimilarity,
  normalizeExtractedRows,
  resolveRowDate,
  MATCH_THRESHOLD,
  type RosterPet,
} from '../../supabase/functions/server/lib/notepad_ingest.ts';

const roster: RosterPet[] = [
  { id: 'pet-rex', name: 'Rex', household_id: 'hh-1' },
  { id: 'pet-bella-1', name: 'Bella', household_id: 'hh-2' },
  { id: 'pet-bella-2', name: 'Bella', household_id: 'hh-3' },
  { id: 'pet-rosie', name: 'Rosie', household_id: 'hh-4' },
  { id: 'pet-max', name: 'Maximilian', household_id: 'hh-5' },
  { id: 'pet-old', name: 'Rexford', household_id: 'hh-6', active: false },
];

describe('nameSimilarity', () => {
  it('is 1 for exact (case/diacritic-insensitive) matches', () => {
    expect(nameSimilarity('rex', 'Rex')).toBe(1);
    expect(nameSimilarity('Chloé', 'Chloe')).toBe(1);
  });
  it('is high for close handwriting misreads', () => {
    expect(nameSimilarity('Rosle', 'Rosie')).toBeGreaterThanOrEqual(MATCH_THRESHOLD);
  });
  it('handles the surname-initial pattern', () => {
    expect(nameSimilarity('Rosie B', 'Rosie')).toBeGreaterThanOrEqual(MATCH_THRESHOLD);
  });
  it('is low for unrelated names', () => {
    expect(nameSimilarity('Rex', 'Bella')).toBeLessThan(0.5);
  });
});

describe('matchDogName', () => {
  it('confidently matches a unique close name', () => {
    const match = matchDogName('rex', roster);
    expect(match.pet_id).toBe('pet-rex');
    expect(match.household_id).toBe('hh-1');
    expect(match.confidence).toBe(1);
  });

  it('leaves an ambiguous name (two Bellas) unresolved with candidates', () => {
    const match = matchDogName('Bella', roster);
    expect(match.pet_id).toBeUndefined();
    expect(match.candidates.map((c) => c.pet_id)).toEqual(
      expect.arrayContaining(['pet-bella-1', 'pet-bella-2']),
    );
  });

  it('context (dogs who come to this location) can break a tie', () => {
    const match = matchDogName('Bella', roster, { contextPetIds: new Set(['pet-bella-1']) });
    // Context boost alone (0.05) is below the ambiguity margin (0.1): still
    // unresolved — a human picks. Guessing between two real Bellas is the
    // failure mode this exists to prevent.
    expect(match.pet_id).toBeUndefined();
  });

  it('never matches weak names or inactive pets', () => {
    expect(matchDogName('Zeus', roster).pet_id).toBeUndefined();
    // 'Rexford' is inactive; 'Rex' still wins cleanly for "rex".
    expect(matchDogName('Rexford', roster).pet_id).toBeUndefined();
  });
});

describe('resolveRowDate', () => {
  const weekStart = '2026-07-20'; // a Monday
  it('explicit dates win', () => {
    expect(resolveRowDate({ date: '2026-07-23' }, weekStart)).toBe('2026-07-23');
  });
  it('weekday names resolve within the page week', () => {
    expect(resolveRowDate({ weekday: 'Wednesday' }, weekStart)).toBe('2026-07-22');
    expect(resolveRowDate({ weekday: 'wed' }, weekStart)).toBe('2026-07-22');
    expect(resolveRowDate({ weekday: 'Sun' }, weekStart)).toBe('2026-07-26');
  });
  it('returns null when nothing resolves', () => {
    expect(resolveRowDate({}, weekStart)).toBeNull();
    expect(resolveRowDate({ weekday: 'Wodinsday' }, weekStart)).toBeNull();
    expect(resolveRowDate({ weekday: 'Mon' }, 'not-a-date')).toBeNull();
  });
});

describe('mondayOf', () => {
  it('snaps any day to its Monday', () => {
    expect(mondayOf('2026-07-20')).toBe('2026-07-20');
    expect(mondayOf('2026-07-23')).toBe('2026-07-20');
    expect(mondayOf('2026-07-26')).toBe('2026-07-20'); // Sunday belongs to the preceding Monday
    expect(mondayOf('bogus')).toBeNull();
  });
});

describe('normalizeExtractedRows', () => {
  it('accepts valid rows and drops malformed ones', () => {
    const rows = normalizeExtractedRows({
      rows: [
        { dog_name_as_written: 'Rex', weekday: 'Mon', session: 'full_day', confidence: 0.9 },
        { dog_name_as_written: '', weekday: 'Mon', session: 'full_day', confidence: 0.9 },
        { dog_name_as_written: 'Meg', weekday: 'Tue', session: 'overnight', confidence: 0.9 },
        { dog_name_as_written: 'Blu', date: '2026-07-21', weekday: null, session: 'half_day_am', confidence: 2 },
      ],
    });
    expect(rows).toHaveLength(2);
    expect(rows[0].dog_name_as_written).toBe('Rex');
    expect(rows[1].session).toBe('half_day_am');
    expect(rows[1].confidence).toBe(1); // clamped
  });
  it('tolerates a bare array and garbage input', () => {
    expect(normalizeExtractedRows([{ dog_name_as_written: 'Rex', session: 'full_day', confidence: 0.5 }])).toHaveLength(1);
    expect(normalizeExtractedRows('nope')).toEqual([]);
    expect(normalizeExtractedRows(null)).toEqual([]);
  });
});

describe('draftReviewReasons', () => {
  it('is empty for a resolved, confidently read row', () => {
    expect(
      draftReviewReasons({ matched_pet_id: 'p', date: '2026-07-20', parse_confidence: 0.9, match_confidence: 0.95 }),
    ).toEqual([]);
  });
  it('flags unmatched dogs, unresolved dates, and low reads', () => {
    expect(
      draftReviewReasons({ date: '2026-07-20', parse_confidence: 0.9, match_confidence: 0 }),
    ).toEqual(['unmatched_dog']);
    expect(
      draftReviewReasons({ matched_pet_id: 'p', parse_confidence: 0.9, match_confidence: 1 }),
    ).toEqual(['unresolved_date']);
    expect(
      draftReviewReasons({ matched_pet_id: 'p', date: '2026-07-20', parse_confidence: 0.4, match_confidence: 1 }),
    ).toEqual(['low_read_confidence']);
  });
});
