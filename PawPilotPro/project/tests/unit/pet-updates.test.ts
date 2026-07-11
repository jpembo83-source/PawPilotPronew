// pet_updates lib: key family, record building, day-read ordering.
import { describe, it, expect, vi } from 'vitest';

vi.mock('../../supabase/functions/server/kv_store.tsx', () => ({
  set: vi.fn().mockResolvedValue(undefined),
  get: vi.fn().mockResolvedValue(null),
  getByPrefix: vi.fn().mockResolvedValue([]),
  del: vi.fn().mockResolvedValue(undefined),
}));

import {
  buildPetUpdate,
  petUpdateKey,
  petUpdateDayPrefix,
  listPetUpdatesForDay,
  effectiveStatus,
  isVisibleToOwner,
  ownerFacingText,
  mergeDayFeeds,
  type PetUpdate,
} from '../../supabase/functions/server/lib/pet_updates.ts';
import * as kv from '../../supabase/functions/server/kv_store.tsx';

const AT = new Date('2026-07-03T08:42:00.000Z');

describe('pet_updates', () => {
  it('builds a checked_in update with the tenant/date/pet key shape', () => {
    const u = buildPetUpdate({
      tenantId: 't1', petId: 'pet-1', petName: 'Rex', type: 'checked_in',
      bookingId: 'b1', householdId: 'hh-1',
      createdById: 's1', createdByName: 'Sam', at: AT,
    });
    expect(u.date).toBe('2026-07-03');
    expect(u.created_at).toBe('2026-07-03T08:42:00.000Z');
    expect(u.type).toBe('checked_in');
    expect(u.text).toBeUndefined();
    const keyed = { ...u, pet_id: 'pet-1' };
    expect(petUpdateKey(keyed)).toBe(`pet_update:t1:2026-07-03:pet-1:${u.id}`);
    expect(petUpdateKey(keyed).startsWith(petUpdateDayPrefix('t1', '2026-07-03', 'pet-1'))).toBe(true);
  });

  it('trims note text and drops empty text entirely', () => {
    const withText = buildPetUpdate({
      tenantId: 't1', petId: 'p', petName: 'Rex', type: 'photo',
      text: '  Loving the paddling pool!  ', photoPath: 'tenant/t1/pets/p/moments/x.jpg',
      createdById: 's1', createdByName: 'Sam', at: AT,
    });
    expect(withText.text).toBe('Loving the paddling pool!');
    expect(withText.photo_path).toBe('tenant/t1/pets/p/moments/x.jpg');

    const blank = buildPetUpdate({
      tenantId: 't1', petId: 'p', petName: 'Rex', type: 'checked_out',
      text: '   ', createdById: 's1', createdByName: 'Sam', at: AT,
    });
    expect(blank.text).toBeUndefined();
  });

  it('keys are unique across updates in the same second', () => {
    const a = buildPetUpdate({ tenantId: 't', petId: 'p', petName: 'R', type: 'note', text: 'a', createdById: 's', createdByName: 'S', at: AT });
    const b = buildPetUpdate({ tenantId: 't', petId: 'p', petName: 'R', type: 'note', text: 'b', createdById: 's', createdByName: 'S', at: AT });
    expect(a.id).not.toBe(b.id);
    expect(petUpdateKey({ ...a, pet_id: 'p' })).not.toBe(petUpdateKey({ ...b, pet_id: 'p' }));
  });

  it('lists a day oldest-first regardless of KV return order', async () => {
    const mk = (iso: string, type: 'checked_in' | 'photo') => ({
      id: `x-${iso}`, tenant_id: 't1', pet_id: 'p1', pet_name: 'Rex',
      date: '2026-07-03', type, created_by_id: 's', created_by_name: 'S', created_at: iso,
    });
    vi.mocked(kv.getByPrefix).mockResolvedValueOnce([
      mk('2026-07-03T12:00:00Z', 'photo'),
      mk('2026-07-03T08:42:00Z', 'checked_in'),
    ]);
    const rows = await listPetUpdatesForDay('t1', 'p1', '2026-07-03');
    expect(kv.getByPrefix).toHaveBeenCalledWith('pet_update:t1:2026-07-03:p1:');
    expect(rows.map(r => r.type)).toEqual(['checked_in', 'photo']);
  });

  it('bulk-captured photos build UNASSIGNED: no pet, pending, batch + location kept', () => {
    const u = buildPetUpdate({
      tenantId: 't1', type: 'photo', photoPath: 'tenant/t1/unassigned/b1/x.jpg',
      locationId: 'loc-1', uploadBatchId: 'b1',
      createdById: 's1', createdByName: 'Sam', at: AT,
    });
    expect(u.pet_id).toBeUndefined();
    expect(u.pet_name).toBeUndefined();
    expect(u.status).toBe('pending');
    expect(u.location_id).toBe('loc-1');
    expect(u.upload_batch_id).toBe('b1');
  });

  it('recordPetUpdate refuses unassigned rows — the KV feed is pet-scoped', async () => {
    const { recordPetUpdate } = await import('../../supabase/functions/server/lib/pet_updates.ts');
    vi.mocked(kv.set).mockClear();
    const u = buildPetUpdate({
      tenantId: 't1', type: 'photo', photoPath: 'x.jpg',
      createdById: 's1', createdByName: 'Sam', at: AT,
    });
    await expect(recordPetUpdate(u)).rejects.toThrow(/pet-scoped/);
    expect(kv.set).not.toHaveBeenCalled();
  });

  it('photos are born pending; notes and check-in/out events auto-approve', () => {
    const base = { tenantId: 't1', petId: 'p', petName: 'Rex', createdById: 's1', createdByName: 'Sam', at: AT };
    expect(buildPetUpdate({ ...base, type: 'photo', photoPath: 'x.jpg' }).status).toBe('pending');
    expect(buildPetUpdate({ ...base, type: 'note', text: 'hi' }).status).toBe('approved');
    expect(buildPetUpdate({ ...base, type: 'checked_in' }).status).toBe('approved');
    expect(buildPetUpdate({ ...base, type: 'checked_out' }).status).toBe('approved');
  });

  it('the owner-visibility gate: only approved (or legacy status-less) rows pass', () => {
    expect(effectiveStatus({})).toBe('approved'); // legacy KV row, pre-gate
    expect(isVisibleToOwner({})).toBe(true);
    expect(isVisibleToOwner({ status: 'approved' })).toBe(true);
    expect(isVisibleToOwner({ status: 'pending' })).toBe(false);
    expect(isVisibleToOwner({ status: 'rejected' })).toBe(false);
  });

  it("owner-facing text prefers the manager's caption over the operator's note", () => {
    expect(ownerFacingText({ text: 'op note', caption: 'manager caption' })).toBe('manager caption');
    expect(ownerFacingText({ text: 'op note' })).toBe('op note');
    expect(ownerFacingText({})).toBeNull();
  });

  it('mergeDayFeeds dedupes by id (Postgres wins) and sorts oldest first', () => {
    const mk = (id: string, iso: string, extra?: Partial<PetUpdate>): PetUpdate => ({
      id, tenant_id: 't1', pet_id: 'p1', pet_name: 'Rex', date: '2026-07-03',
      type: 'photo', created_by_id: 's', created_by_name: 'S', created_at: iso, ...extra,
    });
    const kvRows = [mk('a', '2026-07-03T12:00:00Z'), mk('b', '2026-07-03T08:00:00Z')];
    const pgRows = [mk('a', '2026-07-03T12:00:00Z', { status: 'pending' }), mk('c', '2026-07-03T10:00:00Z')];
    const merged = mergeDayFeeds(kvRows, pgRows);
    expect(merged.map(r => r.id)).toEqual(['b', 'c', 'a']);
    expect(merged.find(r => r.id === 'a')?.status).toBe('pending'); // pg row won
  });
});
