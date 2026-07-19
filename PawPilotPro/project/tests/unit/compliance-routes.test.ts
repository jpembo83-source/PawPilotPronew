// Route-level guardrails for the Data & Compliance workers:
//   - export + purge routes are admin/manager only,
//   - a purge defaults to dry-run and a real run demands confirm: true,
//   - the export route returns real file metrics and never a stored URL.
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

// Stand-in auth: requireAuth injects `currentUser`; requireRole keeps the real
// allow-list semantics so the admin/manager gates are actually exercised.
const currentUser = {
  id: 'user-1',
  role: 'admin',
  name: 'Test Admin',
  email: 'admin@example.com',
  tenantId: 'demo-tenant-001',
  locationIds: [] as string[],
};
vi.mock('../../supabase/functions/server/_shared/auth.ts', () => ({
  requireAuth: async (
    c: { set: (k: string, v: unknown) => void },
    next: () => Promise<void>,
  ) => {
    c.set('user', currentUser);
    await next();
  },
  requireRole:
    (...allowed: string[]) =>
    async (
      c: { json: (b: unknown, s: number) => Response },
      next: () => Promise<void>,
    ) => {
      if (!allowed.includes(currentUser.role)) {
        return c.json({ error: 'forbidden' }, 403);
      }
      await next();
    },
}));

// Private-bucket storage double — records uploads, mints deterministic URLs.
const uploads = new Map<string, { bytes: Uint8Array; contentType: string }>();
vi.mock('../../supabase/functions/server/lib/compliance_storage.ts', () => ({
  makeExportStorage: () => ({
    upload: (path: string, bytes: Uint8Array, contentType: string) => {
      uploads.set(path, { bytes, contentType });
      return Promise.resolve();
    },
    createSignedUrl: (path: string, ttl: number) =>
      Promise.resolve(`https://storage.example/sign/${path}?ttl=${ttl}`),
  }),
}));

import app from '../../supabase/functions/server/data_compliance';

const TENANT = 'demo-tenant-001';
const HH = 'household-001';

const post = (path: string, body?: unknown) =>
  app.request(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });

interface ExportRecordBody {
  id: string;
  status: string;
  file_path: string;
  summary_path: string;
  file_size_bytes: number;
  total_records: number;
  file_url: string | null;
}

interface DownloadUrlBody {
  url: string;
  summary_url: string | null;
  expires_in_seconds: number;
}

interface ExecutionBody {
  dry_run: boolean;
  records_affected: number;
  would_affect: number;
}

beforeEach(() => {
  kvStore.clear();
  uploads.clear();
  currentUser.role = 'admin';
  kvStore.set(`customer:${TENANT}:household:${HH}`, {
    id: HH,
    name: 'Smith Family',
    created_at: '2024-01-01T00:00:00.000Z',
  });
  kvStore.set('compliance:job:job1', {
    id: 'job1',
    job_name: 'Old bookings cleanup',
    job_type: 'deletion',
    data_categories: ['operational'],
    retention_period_days: 365,
    is_active: true,
  });
  kvStore.set('daycare:booking:old1', {
    id: 'old1', household_id: HH, booking_date: '2020-02-01', status: 'checked_out',
  });
});

describe('POST /exports', () => {
  it('generates the export file and returns real metrics + object paths (no URL)', async () => {
    const res = await post('/exports', {
      export_type: 'customer',
      scope: 'household',
      scope_id: HH,
      format: 'json',
      data_categories: ['personal'],
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as ExportRecordBody;
    expect(body.status).toBe('ready');
    expect(body.file_path).toBe(`${TENANT}/${body.id}/export.json`);
    expect(body.file_size_bytes).toBeGreaterThan(0);
    expect(body.total_records).toBeGreaterThan(0);
    expect(body.file_url).toBeNull();
    expect(uploads.has(body.file_path)).toBe(true);
    expect(uploads.has(body.summary_path)).toBe(true);
  });

  it('rejects non-household scopes and unknown households', async () => {
    const orgScope = await post('/exports', { scope: 'organisation', export_type: 'customer' });
    expect(orgScope.status).toBe(400);
    const missing = await post('/exports', {
      scope: 'household', scope_id: 'nope', export_type: 'customer',
    });
    expect(missing.status).toBe(404);
  });

  it('is admin/manager only', async () => {
    currentUser.role = 'staff';
    const res = await post('/exports', { scope: 'household', scope_id: HH });
    expect(res.status).toBe(403);
  });
});

describe('GET /exports/:id/download-url', () => {
  it('mints short-lived signed URLs and audit-logs the access', async () => {
    const created = (await (await post('/exports', {
      export_type: 'customer', scope: 'household', scope_id: HH, format: 'json',
    })).json()) as ExportRecordBody;

    const res = await app.request(`/exports/${created.id}/download-url`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as DownloadUrlBody;
    expect(body.url).toContain(`sign/${TENANT}/${created.id}/export.json`);
    expect(body.summary_url).toContain('summary.txt');
    expect(body.expires_in_seconds).toBe(600);

    const audits = [...kvStore.entries()]
      .filter(([k]) => k.startsWith('compliance:audit:'))
      .map(([, v]) => v as Record<string, unknown>);
    expect(
      audits.some((a) =>
        String(a.action_description).includes('signed download URL')),
    ).toBe(true);
  });
});

describe('POST /retention-jobs/:id/execute', () => {
  it('defaults to a dry run — nothing deleted, candidates reported', async () => {
    const res = await post('/retention-jobs/job1/execute');
    expect(res.status).toBe(201);
    const body = (await res.json()) as ExecutionBody;
    expect(body.dry_run).toBe(true);
    expect(body.records_affected).toBe(0);
    expect(body.would_affect).toBe(1);
    expect(kvStore.has('daycare:booking:old1')).toBe(true);
    // A dry run must not move the job's last-run metrics.
    const job = kvStore.get('compliance:job:job1') as Record<string, unknown>;
    expect(job.last_run_at).toBeUndefined();
  });

  it('refuses a real run without an explicit confirm', async () => {
    const res = await post('/retention-jobs/job1/execute', { dry_run: false });
    expect(res.status).toBe(400);
    expect(kvStore.has('daycare:booking:old1')).toBe(true);
  });

  it('purges on dry_run: false + confirm: true and updates job metrics', async () => {
    const res = await post('/retention-jobs/job1/execute', {
      dry_run: false,
      confirm: true,
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as ExecutionBody;
    expect(body.dry_run).toBe(false);
    expect(body.records_affected).toBe(1);
    expect(kvStore.has('daycare:booking:old1')).toBe(false);
    const job = kvStore.get('compliance:job:job1') as Record<string, unknown>;
    expect(job.last_run_status).toBe('completed');
    expect(job.last_run_records_affected).toBe(1);
  });

  it('is admin/manager only', async () => {
    currentUser.role = 'staff';
    const res = await post('/retention-jobs/job1/execute');
    expect(res.status).toBe(403);
  });
});
