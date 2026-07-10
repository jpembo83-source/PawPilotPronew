import { describe, it, expect } from 'vitest';
import './setup';
import {
  listHouseholds,
  type HouseholdRecord,
  type ContactRecord,
  type PetRecord,
} from '../../supabase/functions/server/lib/household_list.ts';

// Pins the GET /customers/households pipeline: filters must compose with
// sort and pagination server-side (total = filtered count, page = slice of
// the filtered+sorted set), and omitting limit must return the full set for
// the legacy array consumers (export, grooming search, picker modals).

const mkHousehold = (i: number, over: Partial<HouseholdRecord> = {}): HouseholdRecord => ({
  id: `hh-${String(i).padStart(4, '0')}`,
  name: `Household ${String(i).padStart(4, '0')}`,
  status: i % 4 === 0 ? 'inactive' : 'active',
  vip: i % 10 === 0,
  payment_hold: i % 25 === 0,
  primary_location_id: i % 2 === 0 ? 'loc-1' : 'loc-2',
  primary_contact_id: `ct-${i}-a`,
  ...over,
});

const mkContacts = (i: number): ContactRecord[] => [
  {
    id: `ct-${i}-a`,
    household_id: `hh-${String(i).padStart(4, '0')}`,
    first_name: `First${i}`,
    last_name: `Last${i}`,
    email: `person${i}@example.com`,
    phone: `07700 900${String(i).padStart(3, '0')}`,
  },
  { id: `ct-${i}-b`, household_id: `hh-${String(i).padStart(4, '0')}`, first_name: 'Other', last_name: 'Contact' },
];

const mkPets = (i: number): PetRecord[] => [
  { household_id: `hh-${String(i).padStart(4, '0')}`, name: `Rex${i}` },
];

function fixture(count: number) {
  const households: HouseholdRecord[] = [];
  const contacts: ContactRecord[] = [];
  const pets: PetRecord[] = [];
  for (let i = 1; i <= count; i++) {
    households.push(mkHousehold(i));
    contacts.push(...mkContacts(i));
    pets.push(...mkPets(i));
  }
  // Shuffle deterministically so tests prove sorting, not insertion order.
  households.reverse();
  return { households, contacts, pets };
}

describe('listHouseholds', () => {
  it('returns the full filtered set when limit is omitted (legacy consumers)', () => {
    const { households, contacts, pets } = fixture(20);
    const { rows, total } = listHouseholds(households, contacts, pets, {});
    expect(rows).toHaveLength(20);
    expect(total).toBe(20);
    expect(rows[0].contacts_count).toBe(2);
    expect(rows[0].pets_count).toBe(1);
    expect(rows[0].primary_contact?.id).toMatch(/^ct-\d+-a$/);
  });

  it('sorts by household name ascending by default', () => {
    const { households, contacts, pets } = fixture(20);
    const { rows } = listHouseholds(households, contacts, pets, {});
    const names = rows.map((r) => r.name);
    expect(names).toEqual([...names].sort((a, b) => (a ?? '').localeCompare(b ?? '')));
  });

  it('sorts by primary contact name, descending when dir=desc', () => {
    const { households, contacts, pets } = fixture(12);
    const { rows } = listHouseholds(households, contacts, pets, { sort: 'primary_contact', dir: 'desc' });
    const contactNames = rows.map((r) =>
      r.primary_contact ? `${r.primary_contact.first_name} ${r.primary_contact.last_name}` : '',
    );
    const resorted = [...contactNames].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' })).reverse();
    expect(contactNames).toEqual(resorted);
  });

  it('pages the filtered+sorted set: total is the filtered count, not the page size', () => {
    const { households, contacts, pets } = fixture(120);
    const page1 = listHouseholds(households, contacts, pets, { limit: 50, offset: 0 });
    const page2 = listHouseholds(households, contacts, pets, { limit: 50, offset: 50 });
    const page3 = listHouseholds(households, contacts, pets, { limit: 50, offset: 100 });

    expect(page1.total).toBe(120);
    expect(page1.rows).toHaveLength(50);
    expect(page2.rows).toHaveLength(50);
    expect(page3.rows).toHaveLength(20);

    // Pages are disjoint and in one global order
    const ids = [...page1.rows, ...page2.rows, ...page3.rows].map((r) => r.id);
    expect(new Set(ids).size).toBe(120);
    expect(ids[0] < ids[1]).toBe(true);
  });

  it('composes filters with pagination server-side', () => {
    const { households, contacts, pets } = fixture(200);
    // status=active drops every 4th household (50), vip keeps every 10th
    const { rows, total } = listHouseholds(households, contacts, pets, {
      status: 'active',
      vip: true,
      limit: 10,
      offset: 0,
    });
    const expected = households.filter((h) => h.status === 'active' && h.vip).length;
    expect(total).toBe(expected);
    expect(rows.length).toBeLessThanOrEqual(10);
    expect(rows.every((r) => r.status === 'active' && r.vip)).toBe(true);
  });

  it('search matches household name, contact email/phone, and pet name', () => {
    const { households, contacts, pets } = fixture(30);
    expect(listHouseholds(households, contacts, pets, { search: 'household 0007' }).total).toBe(1);
    expect(listHouseholds(households, contacts, pets, { search: 'person12@example.com' }).total).toBe(1);
    expect(listHouseholds(households, contacts, pets, { search: 'rex25' }).total).toBe(1);
    expect(listHouseholds(households, contacts, pets, { search: 'no-such-thing' }).total).toBe(0);
  });

  // Characterisation at target scale: the acceptance scenario is a
  // 500-household tenant. The in-memory pipeline must be a rounding error
  // next to network/KV time — this pins that it stays that way.
  it('handles a 500-household tenant with combined search+filter+sort+page quickly', () => {
    const { households, contacts, pets } = fixture(500);
    const started = performance.now();
    const { rows, total } = listHouseholds(households, contacts, pets, {
      search: 'example.com',
      status: 'active',
      sort: 'primary_contact',
      dir: 'asc',
      limit: 50,
      offset: 100,
    });
    const elapsed = performance.now() - started;

    expect(total).toBe(households.filter((h) => h.status === 'active').length);
    expect(rows).toHaveLength(50);
    expect(elapsed).toBeLessThan(250);
  });
});
