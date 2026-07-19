// DSAR export worker: for a given household the export must gather EVERY
// entity type holding their personal data, upload JSON + readable summary to
// a tenant-prefixed path in the private bucket, and report real metrics.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import './setup';

const kvStore = new Map<string, unknown>();
vi.mock('../../supabase/functions/server/kv_store.tsx', () => ({
  get: vi.fn((key: string) => Promise.resolve(kvStore.get(key) ?? null)),
  set: vi.fn((key: string, value: unknown) => Promise.resolve(void kvStore.set(key, value))),
  del: vi.fn((key: string) => Promise.resolve(void kvStore.delete(key))),
  mget: vi.fn((keys: string[]) => Promise.resolve(keys.map((k) => kvStore.get(k) ?? null))),
  mset: vi.fn(() => Promise.resolve()),
  mdel: vi.fn((keys: string[]) =>
    Promise.resolve(void keys.forEach((k) => kvStore.delete(k)))),
  getByPrefix: vi.fn((prefix: string) =>
    Promise.resolve(
      [...kvStore.entries()].filter(([k]) => k.startsWith(prefix)).map(([, v]) => v),
    ),
  ),
}));

import {
  runSubjectExport,
  collectSubjectData,
  type ExportStorage,
  type SubjectData,
} from '../../supabase/functions/server/lib/compliance_export';

const TENANT = 'demo-tenant-001';
const HH = 'household-001';

function fakeStorage() {
  const uploads = new Map<string, { bytes: Uint8Array; contentType: string }>();
  const storage: ExportStorage = {
    upload: (path, bytes, contentType) => {
      uploads.set(path, { bytes, contentType });
      return Promise.resolve();
    },
    createSignedUrl: (path, ttl) =>
      Promise.resolve(`https://storage.example/sign/${path}?ttl=${ttl}&token=t`),
  };
  return { uploads, storage };
}

function seedFullHousehold() {
  kvStore.set(`customer:${TENANT}:household:${HH}`, {
    id: HH,
    name: 'Smith Family',
    email: 'smith@example.com',
    created_at: '2024-01-01T00:00:00.000Z',
  });
  kvStore.set(`customer:${TENANT}:household:${HH}:flag:f1`, {
    id: 'f1', household_id: HH, flag_type: 'vip', created_at: '2024-01-02T00:00:00.000Z',
  });
  kvStore.set(`customer:${TENANT}:household:${HH}:note:n1`, {
    id: 'n1', household_id: HH, content: 'prefers mornings', created_at: '2024-01-03T00:00:00.000Z',
  });
  kvStore.set(`customer:${TENANT}:contact:${HH}:c1`, {
    id: 'c1', household_id: HH, name: 'Jo Smith', email: 'jo@example.com',
  });
  kvStore.set('contact_consent:c1', { sms: true, email: true });
  kvStore.set(`customer:${TENANT}:pet:${HH}:p1`, {
    id: 'p1', household_id: HH, name: 'Rex', breed: 'Lab',
  });
  kvStore.set(`vaccination:${TENANT}:p1:v1`, {
    id: 'v1', pet_id: 'p1', vaccine: 'rabies', expiry_date: '2025-01-01',
  });
  kvStore.set(`customer:${TENANT}:document:${HH}:d1`, {
    id: 'd1', household_id: HH, title: 'Signed waiver',
  });
  kvStore.set(`customer:${TENANT}:activity:${HH}:a1`, {
    id: 'a1', household_id: HH, description: 'Checked in', created_at: '2024-02-01T00:00:00.000Z',
  });
  kvStore.set('daycare:booking:db1', {
    id: 'db1', household_id: HH, pet_id: 'p1', booking_date: '2024-02-01', status: 'checked_out',
  });
  // Index entries under the same prefix hold plain id strings — must be ignored.
  kvStore.set(`daycare:booking:household:${HH}:db1`, 'db1');
  kvStore.set(`overnight:${TENANT}:reservation:ov1`, {
    id: 'ov1', householdId: HH, petId: 'p1', startDate: '2024-03-01', endDate: '2024-03-03',
  });
  kvStore.set(`grooming-apt:${TENANT}:g1`, {
    id: 'g1', household_id: HH, pet_id: 'p1', appointment_date: '2024-04-01',
  });
  kvStore.set(`transport_job:${TENANT}:t1`, {
    id: 't1', household_id: HH, date: '2024-04-02',
  });
  kvStore.set(`portal_booking:${TENANT}:pb1`, {
    id: 'pb1', householdId: HH, date: '2024-05-01',
  });
  kvStore.set('invoice:inv1', {
    id: 'inv1', household_id: HH, status: 'paid', balance: 0, created_at: '2024-05-10T00:00:00.000Z',
  });
  kvStore.set('invoice_line:inv1:l1', { id: 'l1', description: 'Daycare day', amount: 30 });
  kvStore.set('payment:pay1', {
    id: 'pay1', household_id: HH, invoice_id: 'inv1', amount: 30, created_at: '2024-05-11T00:00:00.000Z',
  });
  kvStore.set('credit:cr1', { id: 'cr1', household_id: HH, balance: 0, created_at: '2024-05-12T00:00:00.000Z' });
  kvStore.set(`household_threads:${HH}`, ['th1']);
  kvStore.set('message_thread:th1', { id: 'th1', householdId: HH, householdName: 'Smith Family' });
  kvStore.set('thread_messages:th1', ['m1']);
  kvStore.set('message:m1', { id: 'm1', threadId: 'th1', content: 'Rex had a great day!' });
}

const NON_EMPTY_SECTIONS: (keyof SubjectData)[] = [
  'household_flags', 'household_notes', 'contacts', 'contact_consents', 'pets',
  'vaccinations', 'documents', 'activities', 'daycare_bookings',
  'overnight_reservations', 'grooming_appointments', 'transport_jobs',
  'portal_bookings', 'invoices', 'invoice_lines', 'payments', 'credits',
  'message_threads', 'messages',
];

beforeEach(() => {
  kvStore.clear();
});

describe('collectSubjectData', () => {
  it('gathers every entity type held for the household', async () => {
    seedFullHousehold();
    const data = await collectSubjectData(TENANT, HH);
    expect(data.household).toMatchObject({ id: HH, name: 'Smith Family' });
    for (const section of NON_EMPTY_SECTIONS) {
      expect(data[section], `section ${section} should not be empty`).toHaveLength(1);
    }
  });

  it('excludes other households and ignores index entries', async () => {
    seedFullHousehold();
    kvStore.set('daycare:booking:other1', {
      id: 'other1', household_id: 'household-999', booking_date: '2024-02-01',
    });
    kvStore.set('invoice:other-inv', { id: 'other-inv', household_id: 'household-999', status: 'paid' });
    const data = await collectSubjectData(TENANT, HH);
    expect(data.daycare_bookings.map((b) => b.id)).toEqual(['db1']);
    expect(data.invoices.map((i) => i.id)).toEqual(['inv1']);
  });
});

describe('runSubjectExport', () => {
  it('uploads JSON + summary to a tenant-prefixed private path and reports real metrics', async () => {
    seedFullHousehold();
    const { uploads, storage } = fakeStorage();

    const result = await runSubjectExport({
      tenantId: TENANT,
      householdId: HH,
      exportId: 'exp1',
      requestedBy: 'Admin',
      storage,
      now: new Date('2026-07-19T12:00:00.000Z'),
    });

    // Tenant-prefixed object paths, real byte size.
    expect(result.file_path).toBe(`${TENANT}/exp1/export.json`);
    expect(result.summary_path).toBe(`${TENANT}/exp1/summary.txt`);
    expect(result.file_size_bytes).toBeGreaterThan(0);
    expect(result.total_records).toBe(NON_EMPTY_SECTIONS.length + 1); // + household itself

    // The uploaded JSON contains the subject's data across all entity types.
    const uploaded = uploads.get(result.file_path);
    expect(uploaded?.contentType).toBe('application/json');
    const parsed = JSON.parse(new TextDecoder().decode(uploaded?.bytes)) as {
      subject: { household_id: string; household_name: string };
      record_counts: Record<string, number>;
      data: Record<string, Array<Record<string, unknown>>>;
    };
    expect(parsed.subject).toEqual({ household_id: HH, household_name: 'Smith Family' });
    expect(parsed.data.pets[0]).toMatchObject({ name: 'Rex' });
    expect(parsed.data.messages[0]).toMatchObject({ content: 'Rex had a great day!' });
    for (const section of NON_EMPTY_SECTIONS) {
      expect(parsed.record_counts[section], `count for ${section}`).toBe(1);
    }

    // Human-readable summary names the subject and counts.
    const summary = new TextDecoder().decode(uploads.get(result.summary_path)?.bytes);
    expect(summary).toContain('Smith Family');
    expect(summary).toContain('Pets: 1');
    expect(summary).toContain(`Total records: ${result.total_records}`);

    // Downloads are only ever signed URLs minted from the object path.
    const url = await storage.createSignedUrl(result.file_path, 600);
    expect(url).toContain(`sign/${TENANT}/exp1/export.json`);
  });

  it('refuses to export a household that does not exist', async () => {
    const { storage } = fakeStorage();
    await expect(
      runSubjectExport({
        tenantId: TENANT,
        householdId: 'household-missing',
        exportId: 'exp2',
        requestedBy: 'Admin',
        storage,
      }),
    ).rejects.toThrow('household not found');
  });
});
