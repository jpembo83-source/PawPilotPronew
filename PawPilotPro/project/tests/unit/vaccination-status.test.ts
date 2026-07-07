// vaccination_status lib: status derivation from vaccination:{t}:{petId}:*
// records, and the snapshot write onto the pet record. Regression cover for
// the JSON.parse-on-object bug: getByPrefix returns parsed JSONB objects and
// the calculator must consume them as-is.
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../supabase/functions/server/kv_store.tsx', () => ({
  set: vi.fn().mockResolvedValue(undefined),
  get: vi.fn().mockResolvedValue(null),
  getByPrefix: vi.fn().mockResolvedValue([]),
  del: vi.fn().mockResolvedValue(undefined),
}));

import {
  calculatePetVaccinationStatus,
  updatePetVaccinationStatus,
} from '../../supabase/functions/server/lib/vaccination_status.ts';
import * as kv from '../../supabase/functions/server/kv_store.tsx';

function iso(daysFromNow: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  return d.toISOString().split('T')[0];
}

beforeEach(() => {
  vi.mocked(kv.getByPrefix).mockReset().mockResolvedValue([]);
  vi.mocked(kv.set).mockClear();
});

describe('calculatePetVaccinationStatus', () => {
  it('returns unknown with no records', async () => {
    const r = await calculatePetVaccinationStatus('p1', 't1');
    expect(kv.getByPrefix).toHaveBeenCalledWith('vaccination:t1:p1:');
    expect(r.status).toBe('unknown');
  });

  it('returns unknown when no record carries a due date', async () => {
    vi.mocked(kv.getByPrefix).mockResolvedValueOnce([
      { id: 'v1', vaccination_type: 'dhpp', date_administered: iso(-10) },
    ]);
    const r = await calculatePetVaccinationStatus('p1', 't1');
    expect(r.status).toBe('unknown');
  });

  it('flags expired when the earliest due date is in the past', async () => {
    vi.mocked(kv.getByPrefix).mockResolvedValueOnce([
      { id: 'v1', next_due_date: iso(200) },
      { id: 'v2', next_due_date: iso(-1) },
    ]);
    const r = await calculatePetVaccinationStatus('p1', 't1');
    expect(r.status).toBe('expired');
    expect(r.expiry_date).toBe(iso(-1));
  });

  it('flags expiring_soon within 30 days, up_to_date beyond', async () => {
    vi.mocked(kv.getByPrefix).mockResolvedValueOnce([{ id: 'v1', next_due_date: iso(10) }]);
    expect((await calculatePetVaccinationStatus('p1', 't1')).status).toBe('expiring_soon');

    vi.mocked(kv.getByPrefix).mockResolvedValueOnce([{ id: 'v1', next_due_date: iso(90) }]);
    expect((await calculatePetVaccinationStatus('p1', 't1')).status).toBe('up_to_date');
  });

  it('consumes parsed objects from getByPrefix (JSON.parse regression)', async () => {
    // Objects, not strings — the old in-route logic JSON.parse()d these and
    // threw, 500ing the whole vaccinations API.
    vi.mocked(kv.getByPrefix).mockResolvedValueOnce([{ id: 'v1', next_due_date: iso(90) }]);
    await expect(calculatePetVaccinationStatus('p1', 't1')).resolves.toBeTruthy();
  });
});

describe('updatePetVaccinationStatus', () => {
  it('writes the snapshot onto the pet record under its household key', async () => {
    vi.mocked(kv.getByPrefix)
      // pet lookup (tenant-scoped prefix)
      .mockResolvedValueOnce([{ id: 'p1', household_id: 'hh1', name: 'Rex' }])
      // vaccination records
      .mockResolvedValueOnce([{ id: 'v1', next_due_date: iso(90) }]);

    await updatePetVaccinationStatus('p1', 't1');

    expect(kv.getByPrefix).toHaveBeenCalledWith('customer:t1:pet:');
    expect(kv.set).toHaveBeenCalledWith(
      'customer:t1:pet:hh1:p1',
      expect.objectContaining({
        id: 'p1',
        vaccination_status: 'up_to_date',
        vaccination_expiry_date: iso(90),
      }),
    );
  });

  it('is a no-op (no throw, no write) when the pet record is missing', async () => {
    vi.mocked(kv.getByPrefix).mockResolvedValueOnce([]);
    await expect(updatePetVaccinationStatus('ghost', 't1')).resolves.toBeUndefined();
    expect(kv.set).not.toHaveBeenCalled();
  });
});
