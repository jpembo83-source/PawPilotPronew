// billing_exempt: house dogs (pet.non_billable) occupy capacity but never
// generate a charge.
import { describe, it, expect } from 'vitest';
import {
  chargeablePrice,
  isNonBillablePet,
} from '../../supabase/functions/server/lib/billing_exempt';
import { firstFullNight } from '../../supabase/functions/server/lib/overnight_semantics';

const houseDog = { id: 'pet-1', name: 'Office Dog', non_billable: true };
const normalDog = { id: 'pet-2', name: 'Rex', non_billable: false };

describe('isNonBillablePet', () => {
  it('true only for an explicit non_billable: true', () => {
    expect(isNonBillablePet(houseDog)).toBe(true);
  });

  it('fails closed to BILLABLE for everything else', () => {
    expect(isNonBillablePet(normalDog)).toBe(false);
    expect(isNonBillablePet({ id: 'pet-3', name: 'Legacy' })).toBe(false); // pre-existing pets
    expect(isNonBillablePet({ non_billable: 'true' })).toBe(false); // string junk
    expect(isNonBillablePet(null)).toBe(false);
    expect(isNonBillablePet(undefined)).toBe(false);
  });
});

describe('chargeablePrice (billing excludes house dogs)', () => {
  it('a house dog generates a zero charge for any service price', () => {
    expect(chargeablePrice(houseDog, 99)).toBe(0);
    expect(chargeablePrice(houseDog, 45)).toBe(0);
  });

  it('a normal pet is unaffected — price passes through unchanged', () => {
    expect(chargeablePrice(normalDog, 99)).toBe(99);
    expect(chargeablePrice({ id: 'pet-3' }, 69)).toBe(69);
  });
});

describe('capacity counts house dogs (guardrail)', () => {
  it('a zero-priced non_billable stay fills a bed exactly like a paid one', () => {
    // The overnight capacity gate looks at dates + status only — a house
    // dog's stay (price 0, non_billable true) blocks the last bed just as a
    // paid stay would. If capacity ever starts consulting billing fields,
    // this pins the regression.
    const houseStay = {
      startDate: '2026-07-13',
      endDate: '2026-07-15',
      status: 'confirmed',
      pricePerNight: 0,
      totalPrice: 0,
      non_billable: true,
    };
    const paidStay = { ...houseStay, pricePerNight: 45, totalPrice: 90, non_billable: false };

    expect(firstFullNight('2026-07-13', '2026-07-15', [houseStay], 1)).toBe('2026-07-13');
    expect(firstFullNight('2026-07-13', '2026-07-15', [paidStay], 1)).toBe('2026-07-13');
    // Identical answers: occupancy is blind to billing.
  });
});
