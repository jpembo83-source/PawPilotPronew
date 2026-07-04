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
    expect(petUpdateKey(u)).toBe(`pet_update:t1:2026-07-03:pet-1:${u.id}`);
    expect(petUpdateKey(u).startsWith(petUpdateDayPrefix('t1', '2026-07-03', 'pet-1'))).toBe(true);
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
    expect(petUpdateKey(a)).not.toBe(petUpdateKey(b));
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
});
