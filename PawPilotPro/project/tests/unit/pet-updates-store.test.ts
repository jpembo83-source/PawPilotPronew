// pet_updates_store: row mapping, gallery cursor, review transitions,
// notification batching — the moderation-gate mechanics.
import { describe, it, expect } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';

import {
  petUpdateToRow,
  rowToPetUpdate,
  encodeGalleryCursor,
  decodeGalleryCursor,
  groupApprovedForNotification,
  reviewPetUpdate,
  listApprovedGallery,
  type PetUpdateRow,
} from '../../supabase/functions/server/lib/pet_updates_store.ts';
import { buildPetUpdate, type PetUpdate } from '../../supabase/functions/server/lib/pet_updates.ts';

const AT = new Date('2026-07-11T09:30:00.000Z');

/** Minimal chainable stand-in for the supabase-js query builder: every
 *  filter/order method returns the builder; each awaited query (via then or
 *  maybeSingle) consumes the next scripted result. Records every call. */
interface ScriptedResult {
  data?: unknown;
  error?: unknown;
}

function fakeAdmin(results: ScriptedResult[]) {
  const calls: Array<{ method: string; args: unknown[] }> = [];
  const next = () => results.shift() ?? { data: null, error: null };
  const builder: Record<string, unknown> = {};
  const chain = (method: string) => (...args: unknown[]) => {
    calls.push({ method, args });
    return builder;
  };
  for (const m of ['from', 'select', 'insert', 'update', 'eq', 'neq', 'or', 'order', 'limit']) {
    builder[m] = chain(m);
  }
  builder.maybeSingle = (...args: unknown[]) => {
    calls.push({ method: 'maybeSingle', args });
    return Promise.resolve(next());
  };
  builder.then = (resolve: (r: ScriptedResult) => unknown) => Promise.resolve(next()).then(resolve);
  return { admin: builder as unknown as SupabaseClient, calls };
}

function mkRow(overrides: Partial<PetUpdateRow> = {}): PetUpdateRow {
  return {
    id: 'pupd_1', tenant_id: 't1', pet_id: 'p1', pet_name: 'Rex',
    household_id: 'hh1', booking_id: null, date: '2026-07-11', type: 'photo',
    text: null, caption: null, photo_path: 'tenant/t1/pets/p1/moments/x.jpg',
    status: 'pending', rejected_reason: null, created_by_id: 's1',
    created_by_name: 'Sam', reviewed_by_id: null, reviewed_by_name: null,
    reviewed_at: null, created_at: '2026-07-11T09:00:00.000Z', legacy_kv_key: null,
    ...overrides,
  };
}

describe('pet_updates_store', () => {
  it('round-trips a built update through row mapping', () => {
    const update = buildPetUpdate({
      tenantId: 't1', petId: 'p1', petName: 'Rex', type: 'photo',
      text: 'Zoomies!', photoPath: 'tenant/t1/pets/p1/moments/x.jpg',
      bookingId: 'b1', householdId: 'hh1',
      createdById: 's1', createdByName: 'Sam', at: AT,
    });
    const row = petUpdateToRow(update);
    expect(row.status).toBe('pending');
    expect(row.caption).toBeNull();
    expect(rowToPetUpdate(row)).toEqual(update);
  });

  it('gallery cursor survives encode/decode and rejects garbage', () => {
    const cursor = { createdAt: '2026-07-11T09:00:00.000Z', id: 'pupd_9' };
    expect(decodeGalleryCursor(encodeGalleryCursor(cursor))).toEqual(cursor);
    expect(decodeGalleryCursor('not-base64!!')).toBeNull();
    expect(decodeGalleryCursor(btoa('{"nope":true}'))).toBeNull();
  });

  it('approve stamps the reviewer, sets caption, and reports changed', async () => {
    const approvedRow = mkRow({ status: 'approved', caption: 'Best boy', reviewed_by_id: 'm1' });
    const { admin, calls } = fakeAdmin([{ data: approvedRow, error: null }]);
    const result = await reviewPetUpdate(admin, 't1', 'pupd_1', {
      action: 'approve', reviewerId: 'm1', reviewerName: 'Mia', caption: 'Best boy', at: AT,
    });
    expect(result).toMatchObject({ ok: true, changed: true });
    if (result.ok) expect(result.update.caption).toBe('Best boy');

    const update = calls.find(c => c.method === 'update');
    expect(update?.args[0]).toMatchObject({
      status: 'approved', reviewed_by_id: 'm1', reviewed_by_name: 'Mia',
      reviewed_at: AT.toISOString(), caption: 'Best boy',
    });
    // Concurrency guard: rows already in the target state are excluded, so
    // exactly one of two racing approvals notifies.
    expect(calls.some(c => c.method === 'neq' && c.args[0] === 'status' && c.args[1] === 'approved')).toBe(true);
  });

  it('re-approving an already-approved moment is idempotent (changed: false)', async () => {
    const approvedRow = mkRow({ status: 'approved' });
    const { admin } = fakeAdmin([
      { data: null, error: null },        // update matched no rows
      { data: approvedRow, error: null }, // follow-up read finds it approved
    ]);
    const result = await reviewPetUpdate(admin, 't1', 'pupd_1', {
      action: 'approve', reviewerId: 'm1', reviewerName: 'Mia',
    });
    expect(result).toMatchObject({ ok: true, changed: false });
  });

  it('reviewing a moment that does not exist in the tenant is not_found', async () => {
    const { admin } = fakeAdmin([
      { data: null, error: null },
      { data: null, error: null },
    ]);
    const result = await reviewPetUpdate(admin, 't1', 'missing', {
      action: 'reject', reviewerId: 'm1', reviewerName: 'Mia',
    });
    expect(result).toEqual({ ok: false, reason: 'not_found' });
  });

  it('gallery pages by keyset: returns limit items and a cursor to the next page', async () => {
    const rows = [mkRow({ id: 'c', status: 'approved' }), mkRow({ id: 'b', status: 'approved' }), mkRow({ id: 'a', status: 'approved' })];
    const { admin, calls } = fakeAdmin([{ data: rows, error: null }]);
    const page = await listApprovedGallery(admin, 't1', { householdId: 'hh1', limit: 2 });
    expect(page.items.map(i => i.id)).toEqual(['c', 'b']);
    expect(page.nextCursor).toBe(encodeGalleryCursor({ createdAt: rows[1].created_at, id: 'b' }));
    // The gate lives in the query: approved photos only.
    expect(calls.some(c => c.method === 'eq' && c.args[0] === 'status' && c.args[1] === 'approved')).toBe(true);
    expect(calls.some(c => c.method === 'eq' && c.args[0] === 'type' && c.args[1] === 'photo')).toBe(true);
  });

  it('gallery final page has no nextCursor', async () => {
    const rows = [mkRow({ id: 'z', status: 'approved' })];
    const { admin } = fakeAdmin([{ data: rows, error: null }]);
    const page = await listApprovedGallery(admin, 't1', { petId: 'p1', limit: 2 });
    expect(page.items.map(i => i.id)).toEqual(['z']);
    expect(page.nextCursor).toBeNull();
  });

  it('groups approvals into one notification per household+pet', () => {
    const mk = (id: string, petId: string, householdId?: string, extra?: Partial<PetUpdate>): PetUpdate => ({
      id, tenant_id: 't1', pet_id: petId, pet_name: petId === 'p1' ? 'Rex' : 'Bella',
      date: '2026-07-11', type: 'photo', created_by_id: 's', created_by_name: 'S',
      created_at: '2026-07-11T09:00:00Z', status: 'approved', household_id: householdId, ...extra,
    });
    const groups = groupApprovedForNotification([
      mk('1', 'p1', 'hh1', { caption: 'Best boy' }),
      mk('2', 'p1', 'hh1'),
      mk('3', 'p1', 'hh1'),
      mk('4', 'p2', 'hh2'),
      mk('5', 'p3', undefined), // no household — nobody to notify
    ]);
    expect(groups).toHaveLength(2);
    expect(groups[0]).toEqual({ householdId: 'hh1', petId: 'p1', petName: 'Rex', photoCount: 3, note: 'Best boy' });
    expect(groups[1]).toMatchObject({ householdId: 'hh2', petId: 'p2', photoCount: 1 });
  });
});
