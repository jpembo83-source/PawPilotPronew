// Retention purge worker: dry-run reports candidates without deleting,
// a real run deletes/anonymises only in-window records, referential-integrity
// risks are skipped and reported, and every execution writes an audit entry.
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
  executeRetention,
  type RetentionJobConfig,
} from '../../supabase/functions/server/lib/compliance_retention';

const TENANT = 'demo-tenant-001';
const NOW = new Date('2026-07-19T12:00:00.000Z');
const ACTOR = { id: 'admin-1', name: 'Admin', role: 'admin' };

// 365-day window from NOW → cutoff 2025-07-19. "Old" = 2024, "recent" = 2026.
const JOB: RetentionJobConfig = {
  id: 'job1',
  job_name: 'Operational + financial cleanup',
  job_type: 'deletion',
  data_categories: ['operational', 'financial'],
  retention_period_days: 365,
};

function auditEntries(): Array<Record<string, unknown>> {
  return [...kvStore.entries()]
    .filter(([k]) => k.startsWith('compliance:audit:'))
    .map(([, v]) => v as Record<string, unknown>);
}

function seedOperationalAndFinancial() {
  // Old, safely deletable booking + its three index keys.
  kvStore.set('daycare:booking:old1', {
    id: 'old1', household_id: 'hh1', pet_id: 'p1', location_id: 'loc1',
    booking_date: '2024-02-01', status: 'checked_out',
  });
  kvStore.set('daycare:booking:date:loc1:2024-02-01:old1', 'old1');
  kvStore.set('daycare:booking:pet:p1:old1', 'old1');
  kvStore.set('daycare:booking:household:hh1:old1', 'old1');
  // Recent booking — in window, must survive.
  kvStore.set('daycare:booking:new1', {
    id: 'new1', household_id: 'hh1', pet_id: 'p1', location_id: 'loc1',
    booking_date: '2026-07-01', status: 'checked_out',
  });
  // Old but still marked active — must be skipped, not purged.
  kvStore.set(`overnight:${TENANT}:reservation:oldactive`, {
    id: 'oldactive', householdId: 'hh1', endDate: '2024-03-03', status: 'checked_in',
  });

  // Old settled invoice + line → purgeable.
  kvStore.set('invoice:oldpaid', {
    id: 'oldpaid', household_id: 'hh1', status: 'paid', balance: 0,
    created_at: '2024-05-10T00:00:00.000Z',
  });
  kvStore.set('invoice_line:oldpaid:l1', { id: 'l1', description: 'Daycare', amount: 30 });
  // Old invoice with outstanding balance → skip.
  kvStore.set('invoice:oldunpaid', {
    id: 'oldunpaid', household_id: 'hh1', status: 'sent', balance: 45,
    created_at: '2024-05-10T00:00:00.000Z',
  });
  // Old payment on the retained invoice → skip (would corrupt balances).
  kvStore.set('payment:payretained', {
    id: 'payretained', invoice_id: 'oldunpaid', amount: 10,
    created_at: '2024-05-11T00:00:00.000Z',
  });
  // Old payment on the purged invoice → deletable.
  kvStore.set('payment:paypurged', {
    id: 'paypurged', invoice_id: 'oldpaid', amount: 30,
    created_at: '2024-05-11T00:00:00.000Z',
  });
}

beforeEach(() => {
  kvStore.clear();
});

describe('executeRetention — dry run', () => {
  it('lists candidates and skips without deleting anything', async () => {
    seedOperationalAndFinancial();
    const before = new Map(kvStore);

    const result = await executeRetention({
      tenantId: TENANT, job: JOB, dryRun: true, actor: ACTOR, now: NOW,
    });

    expect(result.dry_run).toBe(true);
    expect(result.records_affected).toBe(0);
    const candidateIds = result.candidates.map((c) => c.entity_id).sort();
    expect(candidateIds).toEqual(['old1', 'oldpaid', 'paypurged']);
    const skipReasons = Object.fromEntries(
      result.skipped.map((s) => [s.entity_id, s.reason]),
    );
    expect(skipReasons.oldactive).toMatch(/still active/);
    expect(skipReasons.oldunpaid).toMatch(/balance 45/);
    expect(skipReasons.payretained).toMatch(/retained/);

    // Nothing changed except the audit entry.
    for (const [key, value] of before) {
      expect(kvStore.get(key), `key ${key} must be untouched`).toEqual(value);
    }
    const audits = auditEntries();
    expect(audits).toHaveLength(1);
    expect(audits[0].action_description).toContain('DRY RUN');
    expect(audits[0].action_description).toContain('3 record(s) would be affected');
  });
});

describe('executeRetention — confirmed run', () => {
  it('deletes only in-window records (with index keys) and audit-logs the purge', async () => {
    seedOperationalAndFinancial();

    const result = await executeRetention({
      tenantId: TENANT, job: JOB, dryRun: false, actor: ACTOR, now: NOW,
    });

    expect(result.dry_run).toBe(false);
    expect(result.records_affected).toBe(3);
    expect(result.records_failed).toBe(0);

    // Purged: old booking + its index keys, settled invoice + line, its payment.
    expect(kvStore.has('daycare:booking:old1')).toBe(false);
    expect(kvStore.has('daycare:booking:date:loc1:2024-02-01:old1')).toBe(false);
    expect(kvStore.has('daycare:booking:pet:p1:old1')).toBe(false);
    expect(kvStore.has('daycare:booking:household:hh1:old1')).toBe(false);
    expect(kvStore.has('invoice:oldpaid')).toBe(false);
    expect(kvStore.has('invoice_line:oldpaid:l1')).toBe(false);
    expect(kvStore.has('payment:paypurged')).toBe(false);

    // Retained: recent booking, active reservation, unpaid invoice + its payment.
    expect(kvStore.has('daycare:booking:new1')).toBe(true);
    expect(kvStore.has(`overnight:${TENANT}:reservation:oldactive`)).toBe(true);
    expect(kvStore.has('invoice:oldunpaid')).toBe(true);
    expect(kvStore.has('payment:payretained')).toBe(true);

    const audits = auditEntries();
    expect(audits).toHaveLength(1);
    expect(audits[0].action_description).toContain('3 record(s) deleted');
    expect(audits[0].user_id).toBe('admin-1');
  });
});

describe('executeRetention — personal data', () => {
  const seedHousehold = (
    hid: string,
    opts: { lastBookingDate: string; withInvoice?: boolean },
  ) => {
    kvStore.set(`customer:${TENANT}:household:${hid}`, {
      id: hid, name: `Family ${hid}`, email: `${hid}@example.com`,
      created_at: '2023-01-01T00:00:00.000Z',
    });
    kvStore.set(`customer:${TENANT}:contact:${hid}:c-${hid}`, {
      id: `c-${hid}`, household_id: hid, name: 'Pat Doe', email: 'pat@example.com',
    });
    kvStore.set(`customer:${TENANT}:pet:${hid}:p-${hid}`, {
      id: `p-${hid}`, household_id: hid, name: 'Fido',
    });
    kvStore.set(`daycare:booking:b-${hid}`, {
      id: `b-${hid}`, household_id: hid, booking_date: opts.lastBookingDate,
      status: 'checked_out',
    });
    if (opts.withInvoice) {
      kvStore.set(`invoice:i-${hid}`, {
        id: `i-${hid}`, household_id: hid, status: 'paid', balance: 0,
        created_at: '2023-06-01T00:00:00.000Z',
      });
    }
  };

  const personalJob = (jobType: RetentionJobConfig['job_type']): RetentionJobConfig => ({
    id: 'job-personal',
    job_name: 'Inactive customer cleanup',
    job_type: jobType,
    data_categories: ['personal'],
    retention_period_days: 365,
  });

  it('anonymises inactive households and skips ones with recent activity', async () => {
    seedHousehold('inactive', { lastBookingDate: '2024-01-01' });
    seedHousehold('active', { lastBookingDate: '2026-07-01' });

    const result = await executeRetention({
      tenantId: TENANT, job: personalJob('anonymisation'), dryRun: false,
      actor: ACTOR, now: NOW,
    });

    expect(result.candidates.map((c) => c.entity_id)).toEqual(['inactive']);
    expect(result.candidates[0].action).toBe('anonymise');

    const anonymised = kvStore.get(`customer:${TENANT}:household:inactive`) as Record<string, unknown>;
    expect(anonymised.name).toBe('[REDACTED]');
    expect(anonymised.email).toBe('[REDACTED]');
    expect(anonymised.anonymised_at).toBe(NOW.toISOString());
    const contact = kvStore.get(`customer:${TENANT}:contact:inactive:c-inactive`) as Record<string, unknown>;
    expect(contact.email).toBe('[REDACTED]');

    const untouched = kvStore.get(`customer:${TENANT}:household:active`) as Record<string, unknown>;
    expect(untouched.name).toBe('Family active');
    expect(result.skipped.some((s) => s.entity_id === 'active' && /activity after/.test(s.reason))).toBe(true);
  });

  it('refuses to erase a household whose financial records must be retained', async () => {
    seedHousehold('erasable', { lastBookingDate: '2024-01-01' });
    seedHousehold('withmoney', { lastBookingDate: '2024-01-01', withInvoice: true });

    const result = await executeRetention({
      tenantId: TENANT, job: personalJob('deletion'), dryRun: false,
      actor: ACTOR, now: NOW,
    });

    // The clean household is erased outright, bookings included…
    expect(kvStore.has(`customer:${TENANT}:household:erasable`)).toBe(false);
    expect(kvStore.has(`customer:${TENANT}:contact:erasable:c-erasable`)).toBe(false);
    expect(kvStore.has(`customer:${TENANT}:pet:erasable:p-erasable`)).toBe(false);
    expect(kvStore.has('daycare:booking:b-erasable')).toBe(false);
    // …the one with invoices is reported and left alone.
    expect(kvStore.has(`customer:${TENANT}:household:withmoney`)).toBe(true);
    expect(
      result.skipped.some((s) => s.entity_id === 'withmoney' && /retained/.test(s.reason)),
    ).toBe(true);
  });
});
