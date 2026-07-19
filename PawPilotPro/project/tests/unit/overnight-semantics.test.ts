import { describe, it, expect } from 'vitest';
import {
  occupiesNight,
  nightsOf,
  firstFullNight,
  isTonightsBoarder,
  IN_STAY_STATUSES,
  TERMINAL_OVERNIGHT_STATUSES,
} from '../../supabase/functions/server/lib/overnight_semantics';
import { overnightStaysForDate, type PlannerOvernightStay } from '../../src/app/modules/capacity/components/plannerFormat';

// A 13→17 stay: check-in on the 13th, check-out morning of the 17th.
// Occupied nights: 13, 14, 15, 16 — NOT the 17th.
const stay = { startDate: '2026-07-13', endDate: '2026-07-17' };

describe('occupiesNight ([start, end) night semantics)', () => {
  it('counts the check-in night and the last night, but not the check-out day', () => {
    expect(occupiesNight(stay.startDate, stay.endDate, '2026-07-13')).toBe(true);
    expect(occupiesNight(stay.startDate, stay.endDate, '2026-07-15')).toBe(true);
    expect(occupiesNight(stay.startDate, stay.endDate, '2026-07-16')).toBe(true);
    expect(occupiesNight(stay.startDate, stay.endDate, '2026-07-17')).toBe(false);
  });

  it('excludes dates outside the span and handles missing dates', () => {
    expect(occupiesNight(stay.startDate, stay.endDate, '2026-07-12')).toBe(false);
    expect(occupiesNight(undefined, stay.endDate, '2026-07-14')).toBe(false);
    expect(occupiesNight(stay.startDate, undefined, '2026-07-14')).toBe(false);
  });

  it('agrees with the capacity planner (plannerFormat) for every night around a stay', () => {
    // The server and the week planner must give the same answer for the same
    // stay — a drift here means the same dog occupies a bed in one screen
    // and not the other.
    const plannerStay: PlannerOvernightStay = {
      id: 's1', petId: 'p1', petName: 'Mickey',
      startDate: stay.startDate, endDate: stay.endDate,
    };
    for (const date of ['2026-07-12', '2026-07-13', '2026-07-15', '2026-07-16', '2026-07-17', '2026-07-18']) {
      const plannerSays = overnightStaysForDate([plannerStay], date).length === 1;
      expect(occupiesNight(stay.startDate, stay.endDate, date)).toBe(plannerSays);
    }
  });
});

describe('nightsOf', () => {
  it('lists each occupied night of a multi-night stay', () => {
    expect(nightsOf('2026-07-13', '2026-07-17')).toEqual([
      '2026-07-13', '2026-07-14', '2026-07-15', '2026-07-16',
    ]);
  });

  it('single-night stay occupies exactly the check-in night', () => {
    expect(nightsOf('2026-07-13', '2026-07-14')).toEqual(['2026-07-13']);
  });

  it('is empty for an inverted or zero-length range', () => {
    expect(nightsOf('2026-07-13', '2026-07-13')).toEqual([]);
    expect(nightsOf('2026-07-14', '2026-07-13')).toEqual([]);
  });
});

describe('firstFullNight (capacity gate)', () => {
  const booked = (startDate: string, endDate: string, status = 'confirmed') => ({ startDate, endDate, status });

  it('admits a stay when every night has a free bed', () => {
    const existing = [booked('2026-07-13', '2026-07-15')];
    expect(firstFullNight('2026-07-13', '2026-07-15', existing, 2)).toBeNull();
  });

  it('reports the first night that is full', () => {
    const existing = [
      booked('2026-07-13', '2026-07-17'),
      booked('2026-07-14', '2026-07-16'), // nights 14+15 have 2 dogs
    ];
    expect(firstFullNight('2026-07-13', '2026-07-17', existing, 2)).toBe('2026-07-14');
  });

  it('allows back-to-back stays: a departure morning frees the bed for that night', () => {
    const existing = [booked('2026-07-10', '2026-07-13')]; // out on the 13th
    expect(firstFullNight('2026-07-13', '2026-07-14', existing, 1)).toBeNull();
  });

  it('ignores terminal reservations', () => {
    const existing = [
      booked('2026-07-13', '2026-07-15', 'cancelled'),
      booked('2026-07-13', '2026-07-15', 'no_show'),
      booked('2026-07-13', '2026-07-15', 'checked_out'),
    ];
    expect(firstFullNight('2026-07-13', '2026-07-15', existing, 1)).toBeNull();
  });

  it('treats checked_in / in_stay as occupying', () => {
    const existing = [booked('2026-07-13', '2026-07-15', 'checked_in')];
    expect(firstFullNight('2026-07-13', '2026-07-15', existing, 1)).toBe('2026-07-13');
  });

  it('zero effective capacity rejects the first night outright', () => {
    expect(firstFullNight('2026-07-13', '2026-07-14', [], 0)).toBe('2026-07-13');
  });
});

describe('TERMINAL_OVERNIGHT_STATUSES', () => {
  it('is exactly the bed-freeing set', () => {
    expect([...TERMINAL_OVERNIGHT_STATUSES].sort()).toEqual(['cancelled', 'checked_out', 'no_show']);
  });
});

describe("isTonightsBoarder (the dashboard's Tonight's Boarders set)", () => {
  // Stay spanning tonight: nights of the 13th–16th, out on the 17th.
  const tonight = '2026-07-14';
  const boarder = (status: string, startDate = '2026-07-13', endDate = '2026-07-17') => ({
    startDate,
    endDate,
    status,
  });

  it('every non-terminal status occupying tonight appears — including pre-check-in stays', () => {
    for (const status of ['booked', 'confirmed', 'checked_in', 'in_stay']) {
      expect(isTonightsBoarder(boarder(status), tonight)).toBe(true);
    }
  });

  it('terminal statuses are intentionally excluded even when the dates span tonight', () => {
    for (const status of ['cancelled', 'no_show', 'checked_out']) {
      expect(isTonightsBoarder(boarder(status), tonight)).toBe(false);
    }
  });

  it('a stay starting tonight appears; one starting tomorrow does not', () => {
    expect(isTonightsBoarder(boarder('confirmed', '2026-07-14', '2026-07-16'), tonight)).toBe(true);
    expect(isTonightsBoarder(boarder('confirmed', '2026-07-15', '2026-07-16'), tonight)).toBe(false);
  });

  it('a dog departing this morning is not one of tonight’s boarders', () => {
    expect(isTonightsBoarder(boarder('checked_in', '2026-07-10', '2026-07-14'), tonight)).toBe(false);
  });

  it('a stay that ended in the past does not appear', () => {
    expect(isTonightsBoarder(boarder('confirmed', '2026-07-01', '2026-07-05'), tonight)).toBe(false);
  });

  it('matches the capacity semantics: whatever holds a bed is visible', () => {
    // The exact regression: a confirmed stay counts against capacity
    // (firstFullNight) — it must therefore be visible on the dashboard.
    const confirmed = boarder('confirmed');
    expect(firstFullNight('2026-07-13', '2026-07-15', [confirmed], 1)).toBe('2026-07-13');
    expect(isTonightsBoarder(confirmed, tonight)).toBe(true);
  });

  it('null/undefined records never appear', () => {
    expect(isTonightsBoarder(null, tonight)).toBe(false);
    expect(isTonightsBoarder(undefined, tonight)).toBe(false);
  });
});

describe('IN_STAY_STATUSES (drives the "Not checked in" badge)', () => {
  it('is exactly the physically-on-site set', () => {
    expect([...IN_STAY_STATUSES].sort()).toEqual(['checked_in', 'in_stay']);
  });
});
