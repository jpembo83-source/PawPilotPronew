// overnight_care_sync: booking care notes → pet profile appends + flags.
import { describe, it, expect } from 'vitest';
import {
  careNoteLine,
  deriveCareFlags,
  derivePetCareAppends,
} from '../../supabase/functions/server/lib/overnight_care_sync';

const reservation = (overrides: Record<string, unknown> = {}) => ({
  startDate: '2026-08-01',
  ...overrides,
});

const activeFlag = (overrides: Record<string, unknown> = {}) => ({
  id: 'flag-1',
  flag_key: 'medical_caution',
  severity: 'warn',
  is_active: true,
  pet_id: 'pet-1',
  ...overrides,
});

describe('derivePetCareAppends', () => {
  it('maps each booking note onto its pet profile field with attribution', () => {
    const appends = derivePetCareAppends(
      reservation({
        feedingInstructions: 'Two meals, kibble only',
        medicationInstructions: 'Apoquel 16mg with breakfast',
        behaviourNotes: 'Nervous around new dogs',
      }),
      {},
    );
    expect(appends).toEqual({
      feeding_instructions: '[from overnight booking 2026-08-01] Two meals, kibble only',
      medical_notes: '[from overnight booking 2026-08-01] Apoquel 16mg with breakfast',
      behaviour_notes: '[from overnight booking 2026-08-01] Nervous around new dogs',
    });
  });

  it('appends below existing text instead of overwriting it', () => {
    const appends = derivePetCareAppends(
      reservation({ feedingInstructions: 'No treats after 6pm' }),
      { feeding_instructions: 'Grain-free diet' },
    );
    expect(appends.feeding_instructions).toBe(
      'Grain-free diet\n[from overnight booking 2026-08-01] No treats after 6pm',
    );
  });

  it('produces nothing for absent, empty, or whitespace-only notes', () => {
    expect(derivePetCareAppends(reservation(), { feeding_instructions: 'keep' })).toEqual({});
    expect(
      derivePetCareAppends(
        reservation({ feedingInstructions: '', medicationInstructions: '   ', behaviourNotes: undefined }),
        {},
      ),
    ).toEqual({});
  });

  it('only touches the fields whose notes are set', () => {
    const appends = derivePetCareAppends(
      reservation({ behaviourNotes: 'Pulls on lead' }),
      { medical_notes: 'existing medical' },
    );
    expect(Object.keys(appends)).toEqual(['behaviour_notes']);
  });

  it('is idempotent: re-booking with the same note does not duplicate the line', () => {
    const first = derivePetCareAppends(reservation({ feedingInstructions: 'Two meals' }), {});
    const again = derivePetCareAppends(
      reservation({ feedingInstructions: 'Two meals' }),
      { feeding_instructions: first.feeding_instructions },
    );
    expect(again).toEqual({});
  });

  it('a different booking date still appends (history accumulates)', () => {
    const existing = careNoteLine('2026-08-01', 'Two meals');
    const appends = derivePetCareAppends(
      reservation({ startDate: '2026-09-10', feedingInstructions: 'Two meals' }),
      { feeding_instructions: existing },
    );
    expect(appends.feeding_instructions).toBe(`${existing}\n${careNoteLine('2026-09-10', 'Two meals')}`);
  });

  it('tolerates non-string junk in existing pet fields', () => {
    const appends = derivePetCareAppends(
      reservation({ feedingInstructions: 'Two meals' }),
      { feeding_instructions: 42 },
    );
    expect(appends.feeding_instructions).toBe(careNoteLine('2026-08-01', 'Two meals'));
  });
});

describe('deriveCareFlags', () => {
  it('behaviour concerns raise a pet-scoped behaviour_caution warn flag', () => {
    const flags = deriveCareFlags(
      reservation({ hasBehaviourConcerns: true, behaviourNotes: 'Nervous around new dogs' }),
      [],
      'pet-1',
    );
    expect(flags).toEqual([
      {
        flag_key: 'behaviour_caution',
        severity: 'warn',
        reason: 'Nervous around new dogs (from overnight booking 2026-08-01)',
      },
    ]);
  });

  it('medication and allergies fold into one medical_caution flag', () => {
    const flags = deriveCareFlags(
      reservation({ requiresMedication: true, hasAllergies: true }),
      [],
      'pet-1',
    );
    expect(flags).toEqual([
      {
        flag_key: 'medical_caution',
        severity: 'warn',
        reason: 'Requires medication; Has allergies (from overnight booking 2026-08-01)',
      },
    ]);
  });

  it('each medical boolean alone raises medical_caution', () => {
    expect(deriveCareFlags(reservation({ requiresMedication: true }), [], 'pet-1')[0].reason).toContain(
      'Requires medication',
    );
    expect(deriveCareFlags(reservation({ hasAllergies: true }), [], 'pet-1')[0].reason).toContain(
      'Has allergies',
    );
  });

  it('no booleans set → no flags', () => {
    expect(deriveCareFlags(reservation(), [], 'pet-1')).toEqual([]);
    expect(
      deriveCareFlags(reservation({ requiresMedication: false, hasBehaviourConcerns: false, hasAllergies: false }), [], 'pet-1'),
    ).toEqual([]);
  });

  it('re-booking does not duplicate an active flag for the same pet+key', () => {
    const flags = deriveCareFlags(
      reservation({ requiresMedication: true }),
      [activeFlag()],
      'pet-1',
    );
    expect(flags).toEqual([]);
  });

  it('an active household-wide flag (no pet_id) also covers the pet', () => {
    for (const scope of [null, undefined, '']) {
      expect(
        deriveCareFlags(reservation({ hasAllergies: true }), [activeFlag({ pet_id: scope })], 'pet-1'),
      ).toEqual([]);
    }
  });

  it("another pet's flag does not block this pet", () => {
    const flags = deriveCareFlags(
      reservation({ requiresMedication: true }),
      [activeFlag({ pet_id: 'pet-2' })],
      'pet-1',
    );
    expect(flags).toHaveLength(1);
  });

  it('an inactive flag does not block re-raising', () => {
    const flags = deriveCareFlags(
      reservation({ requiresMedication: true }),
      [activeFlag({ is_active: false })],
      'pet-1',
    );
    expect(flags).toHaveLength(1);
  });

  it('a different key does not block', () => {
    const flags = deriveCareFlags(
      reservation({ hasBehaviourConcerns: true }),
      [activeFlag()], // medical_caution
      'pet-1',
    );
    expect(flags).toHaveLength(1);
    expect(flags[0].flag_key).toBe('behaviour_caution');
  });

  it('behaviour flag falls back to a generic reason when no notes given', () => {
    const flags = deriveCareFlags(reservation({ hasBehaviourConcerns: true }), [], 'pet-1');
    expect(flags[0].reason).toBe('Behaviour concerns reported at booking (from overnight booking 2026-08-01)');
  });
});
