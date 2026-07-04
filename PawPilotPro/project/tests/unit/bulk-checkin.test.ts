// Bulk check-in batch semantics: blockers exclude, warnings need per-dog acks.
import { describe, it, expect } from 'vitest';
import {
  sectionOf,
  blockedReasons,
  includedEntries,
  canConfirmBatch,
  type BatchEntry,
} from '../../src/app/modules/daycare/lib/bulkCheckIn';
import type { DaycareBooking, CheckInValidation } from '../../src/app/modules/daycare/types';

function makeBooking(id: string): DaycareBooking {
  return {
    id,
    household_id: `hh-${id}`,
    household_name: 'Test Household',
    pet_id: `pet-${id}`,
    pet_name: id,
    location_id: 'loc-1',
    location_name: 'Main',
    service_id: 'service-daycare-full',
    service_name: 'Daycare (Full Day)',
    service_type: 'full_day',
    booking_date: '2026-07-03',
    booking_status: 'confirmed',
    check_in_status: 'not_checked_in',
    capacity_slot: 1,
    has_behaviour_flag: false,
    has_medical_flag: false,
    waiver_status: 'valid',
    has_booking_hold: false,
    has_payment_hold: false,
    base_price_locked: 0,
    tax_rate: 0,
    total_price: 0,
    currency: 'GBP',
    billing_line_item_ids: [],
    requires_transport: false,
    created_by_id: 'staff-1',
    created_by_name: 'Staff',
    created_at: '2026-07-03T08:00:00Z',
    updated_at: '2026-07-03T08:00:00Z',
  };
}

function entry(id: string, opts: {
  canCheckIn?: boolean;
  warnings?: string[];
  blockers?: string[];
  validationFailed?: string;
} = {}): BatchEntry {
  if (opts.validationFailed) {
    return { booking: makeBooking(id), validation: null, error: opts.validationFailed };
  }
  const validation: CheckInValidation = {
    can_check_in: opts.canCheckIn ?? true,
    warnings: (opts.warnings ?? []).map(m => ({ type: 'warning' as const, category: 'other' as const, message: m })),
    blockers: (opts.blockers ?? []).map(m => ({ type: 'blocker' as const, category: 'waiver' as const, message: m })),
  };
  return { booking: makeBooking(id), validation };
}

describe('bulk check-in partition', () => {
  const clear = entry('rex');
  const warned = entry('milo', { warnings: ['Behaviour flag: reactive with large dogs'] });
  const blocked = entry('bella', { canCheckIn: false, blockers: ['Waiver expired'] });
  const failedValidation = entry('duke', { validationFailed: 'Network error' });

  it('sections dogs by validation outcome', () => {
    expect(sectionOf(clear)).toBe('clear');
    expect(sectionOf(warned)).toBe('warning');
    expect(sectionOf(blocked)).toBe('blocked');
    expect(sectionOf(failedValidation)).toBe('blocked'); // a failed validate call never slips into the batch
  });

  it('reports why blocked dogs are excluded', () => {
    expect(blockedReasons(blocked)).toEqual(['Waiver expired']);
    expect(blockedReasons(failedValidation)).toEqual(['Network error']);
  });

  it('acceptance shape: 6 dogs, 1 warning, 1 blocked → 5 included once the warning is acked', () => {
    const six = [clear, entry('a'), entry('b'), entry('c'), warned, blocked];

    // Warning not yet acknowledged: confirm disabled, N counts only clear dogs.
    expect(canConfirmBatch(six, {})).toBe(false);
    expect(includedEntries(six, {}).length).toBe(4);

    // Individually acknowledged: confirm enables at exactly 5; blocked stays out.
    const acks = { milo: true };
    expect(canConfirmBatch(six, acks)).toBe(true);
    const included = includedEntries(six, acks);
    expect(included.length).toBe(5);
    expect(included.some(e => e.booking.id === 'bella')).toBe(false);
  });

  it('acknowledgments are strictly per-dog — acking one warning does not cover another', () => {
    const entries = [warned, entry('luna', { warnings: ['Vaccination expiring soon'] })];
    expect(canConfirmBatch(entries, { milo: true })).toBe(false);
    expect(includedEntries(entries, { milo: true }).length).toBe(1);
    expect(canConfirmBatch(entries, { milo: true, luna: true })).toBe(true);
  });

  it('never enables confirm for an empty batch (all blocked)', () => {
    expect(canConfirmBatch([blocked, failedValidation], {})).toBe(false);
    expect(includedEntries([blocked, failedValidation], {}).length).toBe(0);
  });
});
