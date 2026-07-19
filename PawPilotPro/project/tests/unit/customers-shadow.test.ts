// Phase 4 stage 3: shadow-read response differ (KV vs PG payloads).
import { describe, it, expect } from 'vitest';
import { diffShadow, normalizeForShadow } from '../../supabase/functions/server/lib/customers_shadow';

describe('normalizeForShadow', () => {
  it('treats null as absent', () => {
    expect(normalizeForShadow({ a: 1, b: null })).toEqual({ a: 1 });
  });

  it('canonicalises timestamps to instants', () => {
    expect(normalizeForShadow('2026-01-11T19:14:23.202+00:00')).toBe('2026-01-11T19:14:23.202Z');
    expect(normalizeForShadow('2026-01-11T19:14:23.202Z')).toBe('2026-01-11T19:14:23.202Z');
  });

  it('drops contract-default values so absent ≡ default', () => {
    expect(normalizeForShadow({ vip: false, active: true, name: 'x' })).toEqual({ name: 'x' });
    // Non-default values always survive.
    expect(normalizeForShadow({ vip: true, active: false })).toEqual({ vip: true, active: false });
  });

  it('sorts arrays of records by id (tie order was never specified in KV)', () => {
    const a = normalizeForShadow([{ id: 'b' }, { id: 'a' }]);
    const b = normalizeForShadow([{ id: 'a' }, { id: 'b' }]);
    expect(a).toEqual(b);
  });
});

describe('diffShadow', () => {
  it('reports no diffs for observably identical payloads', () => {
    const kvPayload = {
      id: 'hh-1',
      name: 'Pemberton',
      updated_at: '2026-01-11T20:10:16.485Z',
      contacts: [{ id: 'c2' }, { id: 'c1', email: 'x@y.z' }],
      // KV blob omits the field entirely…
    };
    const pgPayload = {
      id: 'hh-1',
      name: 'Pemberton',
      updated_at: '2026-01-11T20:10:16.485+00:00',
      contacts: [{ id: 'c1', email: 'x@y.z' }, { id: 'c2' }],
      // …PG serialises the default explicitly.
      vip: false,
      external_id: null,
    };
    const { diffs, legacyDiffs } = diffShadow(kvPayload, pgPayload);
    expect(diffs).toEqual([]);
    expect(legacyDiffs).toEqual([]);
  });

  it('flags real value mismatches with paths and types, never values', () => {
    const { diffs } = diffShadow({ name: 'Pemberton' }, { name: 'Smith' });
    expect(diffs).toEqual([{ path: 'name', kind: 'value', kvType: 'string', pgType: 'string' }]);
  });

  it('flags a record missing from one side as a length diff', () => {
    const { diffs } = diffShadow(
      { households: [{ id: 'a' }, { id: 'b' }] },
      { households: [{ id: 'a' }] },
    );
    expect(diffs).toEqual([
      { path: 'households', kind: 'length', kvType: 'array(2)', pgType: 'array(1)' },
    ]);
  });

  it('flags fields present on one side only', () => {
    const { diffs } = diffShadow({ id: 'p1', microchip: 'CHIP1' }, { id: 'p1' });
    expect(diffs).toEqual([
      { path: 'microchip', kind: 'missing_pg', kvType: 'string', pgType: 'absent' },
    ]);
  });

  it('classifies known out-of-contract blob fields as legacy, not failures', () => {
    const { diffs, legacyDiffs } = diffShadow(
      { contacts: [{ id: 'c1', address_line1: '1 High St', photo_updated_at: 'x' }] },
      { contacts: [{ id: 'c1' }] },
    );
    expect(diffs).toEqual([]);
    expect(legacyDiffs.map((d) => d.path).sort()).toEqual([
      'contacts.0.address_line1',
      'contacts.0.photo_updated_at',
    ]);
  });

  it('reports nested diffs with full paths', () => {
    const { diffs } = diffShadow(
      { rows: [{ id: 'hh-1', primary_contact: { id: 'c1', first_name: 'Jay' } }] },
      { rows: [{ id: 'hh-1', primary_contact: { id: 'c1', first_name: 'Kay' } }] },
    );
    expect(diffs).toEqual([
      { path: 'rows.0.primary_contact.first_name', kind: 'value', kvType: 'string', pgType: 'string' },
    ]);
  });
});
