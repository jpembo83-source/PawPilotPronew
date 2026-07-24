import { describe, it, expect } from 'vitest';
import {
  deriveHomeAddress,
  effectiveSavedAddresses,
  formatSavedAddress,
  validateSavedAddress,
} from '../../src/app/modules/customers/savedAddresses';
import type { HouseholdContact, SavedAddress } from '../../src/app/modules/customers/types';

const contact = (overrides: Partial<HouseholdContact>): HouseholdContact => ({
  id: 'con-1',
  tenant_id: 'demo-tenant-001',
  household_id: 'hh-1',
  first_name: 'Jo',
  last_name: 'Bloggs',
  is_primary: false,
  is_emergency_contact: false,
  marketing_consent: false,
  sms_consent: false,
  email_consent: false,
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
  ...overrides,
});

const office: SavedAddress = {
  id: 'addr-office',
  label: 'Office',
  line1: '3 Works Road',
  city: 'Leeds',
  postcode: 'LS1 4AB',
};

describe('formatSavedAddress', () => {
  it('joins the populated parts with commas', () => {
    expect(formatSavedAddress(office)).toBe('3 Works Road, Leeds, LS1 4AB');
  });

  it('skips empty parts', () => {
    expect(formatSavedAddress({ id: 'a', label: 'Vet', line1: '1 High St' })).toBe('1 High St');
  });
});

describe('deriveHomeAddress', () => {
  it('prefers the primary contact address', () => {
    const contacts = [
      contact({ id: 'c1', address_line1: '9 Second St' }),
      contact({ id: 'c2', is_primary: true, address_line1: '12 Meadow Lane', address_postcode: 'S1 2AB' }),
    ];
    const home = deriveHomeAddress({ address: { line1: '99 Household Rd' } }, contacts);
    expect(home?.label).toBe('Home');
    expect(home?.line1).toBe('12 Meadow Lane');
    expect(home?.postcode).toBe('S1 2AB');
  });

  it('falls back to the household address when no contact has one', () => {
    const home = deriveHomeAddress({ address: { line1: '99 Household Rd', city: 'York' } }, [contact({})]);
    expect(home?.line1).toBe('99 Household Rd');
    expect(home?.city).toBe('York');
  });

  it('returns null when nothing is on file', () => {
    expect(deriveHomeAddress({ address: undefined }, [contact({})])).toBeNull();
    expect(deriveHomeAddress(null, null)).toBeNull();
  });
});

describe('effectiveSavedAddresses', () => {
  const primaryWithAddress = [contact({ is_primary: true, address_line1: '12 Meadow Lane' })];

  it('returns the persisted list when one exists', () => {
    const list = effectiveSavedAddresses(
      { saved_addresses: [office], address: { line1: '99 Household Rd' } },
      primaryWithAddress
    );
    expect(list).toEqual([office]);
  });

  it('derives a Home seed when no record exists (null)', () => {
    const list = effectiveSavedAddresses({ saved_addresses: null }, primaryWithAddress);
    expect(list).toHaveLength(1);
    expect(list[0].label).toBe('Home');
    expect(list[0].line1).toBe('12 Meadow Lane');
  });

  it('keeps a deliberately cleared list empty (no re-derived Home)', () => {
    expect(effectiveSavedAddresses({ saved_addresses: [] }, primaryWithAddress)).toEqual([]);
  });
});

describe('validateSavedAddress', () => {
  it('accepts a labelled address with a first line', () => {
    expect(validateSavedAddress(office)).toBeNull();
  });

  it('rejects a missing label or line1', () => {
    expect(validateSavedAddress({ ...office, label: '  ' })).toMatch(/label/i);
    expect(validateSavedAddress({ ...office, line1: '' })).toMatch(/first line/i);
  });
});
