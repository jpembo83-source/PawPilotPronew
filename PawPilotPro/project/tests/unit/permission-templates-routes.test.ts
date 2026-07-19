// Permission templates are SERVER-backed: system templates seed once into KV,
// CRUD persists there (localStorage is never the source of truth), mutation
// is admin/manager-only via requirePermission('users', …), and every mutation
// lands in the settings audit trail that /settings/audit-logs serves.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import './setup';

const kvStore = new Map<string, unknown>();
vi.mock('../../supabase/functions/server/kv_store.tsx', () => ({
  get: vi.fn((key: string) => Promise.resolve(kvStore.get(key) ?? null)),
  set: vi.fn((key: string, value: unknown) => Promise.resolve(void kvStore.set(key, value))),
  del: vi.fn((key: string) => Promise.resolve(void kvStore.delete(key))),
  mget: vi.fn((keys: string[]) => Promise.resolve(keys.map((k) => kvStore.get(k) ?? null))),
  mset: vi.fn((keys: string[], values: unknown[]) =>
    Promise.resolve(void keys.forEach((k, i) => kvStore.set(k, values[i])))),
  mdel: vi.fn((keys: string[]) =>
    Promise.resolve(void keys.forEach((k) => kvStore.delete(k)))),
  getByPrefix: vi.fn((prefix: string) =>
    Promise.resolve(
      [...kvStore.entries()].filter(([k]) => k.startsWith(prefix)).map(([, v]) => v),
    ),
  ),
}));

// Stand-in requireAuth injects `currentUser`; requirePermission stays REAL
// (from settings_rbac), so the users-section role rules are actually enforced.
const currentUser = {
  id: 'user-1',
  role: 'admin',
  name: 'Test Admin',
  email: 'admin@example.com',
  tenantId: 'demo-tenant-001',
  locationIds: [] as string[],
  app_metadata: {} as Record<string, unknown>,
};
vi.mock('../../supabase/functions/server/_shared/auth.ts', () => ({
  validateUserToken: vi.fn(() => Promise.resolve(currentUser)),
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

import app from '../../supabase/functions/server/app_routes';

const TENANT = 'demo-tenant-001';
const TPL_PREFIX = `settings:${TENANT}:permission_template:`;

interface TemplateBody {
  id: string;
  name: string;
  isSystem: boolean;
  permissions: Array<{ module: string; action: string }>;
}

const listTemplates = async (): Promise<TemplateBody[]> => {
  const res = await app.request('/settings/permission-templates');
  expect(res.status).toBe(200);
  return (await res.json()) as TemplateBody[];
};

const post = (path: string, body?: unknown, method = 'POST') =>
  app.request(path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });

beforeEach(() => {
  kvStore.clear();
  currentUser.role = 'admin';
  currentUser.app_metadata = {};
});

describe('GET /settings/permission-templates', () => {
  it('seeds the five system templates into KV exactly once', async () => {
    const templates = await listTemplates();
    expect(templates).toHaveLength(5);
    expect(templates.every((t) => t.isSystem)).toBe(true);
    expect([...kvStore.keys()].filter((k) => k.startsWith(TPL_PREFIX))).toHaveLength(5);

    // Second call returns the persisted set, not a re-seed.
    const again = await listTemplates();
    expect(again.map((t) => t.id).sort()).toEqual(templates.map((t) => t.id).sort());
  });
});

describe('POST /settings/permission-templates', () => {
  it('persists a new template server-side and returns it on subsequent reads', async () => {
    const res = await post('/settings/permission-templates', {
      name: 'Night Shift',
      description: 'Overnight care access',
      permissions: [
        { module: 'overnights', action: 'view' },
        { module: 'overnights', action: 'update' },
      ],
    });
    expect(res.status).toBe(201);
    const created = (await res.json()) as TemplateBody;
    expect(created.isSystem).toBe(false);

    // "Survives a reload": the KV record is the source of truth and the list
    // endpoint returns it — no client state involved.
    expect(kvStore.get(`${TPL_PREFIX}${created.id}`)).toMatchObject({ name: 'Night Shift' });
    const templates = await listTemplates();
    expect(templates.map((t) => t.name)).toContain('Night Shift');

    // The mutation is in the settings audit trail.
    const auditRes = await app.request('/settings/audit-logs?section=users');
    const audit = (await auditRes.json()) as Array<{ action: string; details: Record<string, unknown> }>;
    expect(audit.some((a) => a.action === 'create' && a.details.resource === 'permission_template')).toBe(true);
  });

  it('rejects malformed payloads', async () => {
    const noName = await post('/settings/permission-templates', {
      name: '', permissions: [],
    });
    expect(noName.status).toBe(400);
    const badAction = await post('/settings/permission-templates', {
      name: 'X', permissions: [{ module: 'daycare', action: 'own' }],
    });
    expect(badAction.status).toBe(400);
  });

  it('is forbidden for staff and assistant managers', async () => {
    currentUser.role = 'staff';
    expect((await post('/settings/permission-templates', { name: 'X', permissions: [] })).status).toBe(403);
    currentUser.role = 'assistant_manager';
    expect((await post('/settings/permission-templates', { name: 'X', permissions: [] })).status).toBe(403);
    // assistant managers can still VIEW the list…
    expect((await app.request('/settings/permission-templates')).status).toBe(200);
    // …but plain staff cannot.
    currentUser.role = 'staff';
    expect((await app.request('/settings/permission-templates')).status).toBe(403);
  });
});

describe('PUT /settings/permission-templates/:id', () => {
  it('updates editable fields but never lets a client flip isSystem or id', async () => {
    await listTemplates(); // seed
    const res = await post('/settings/permission-templates/tpl-handler', {
      id: 'tpl-evil',
      isSystem: false,
      name: 'Handler v2',
      description: 'Updated',
      permissions: [{ module: 'daycare', action: 'view' }],
    }, 'PUT');
    expect(res.status).toBe(200);
    const updated = (await res.json()) as TemplateBody;
    expect(updated.id).toBe('tpl-handler');
    expect(updated.isSystem).toBe(true);
    expect(updated.name).toBe('Handler v2');
  });

  it('404s for unknown templates', async () => {
    expect((await post('/settings/permission-templates/nope', {
      name: 'X', permissions: [],
    }, 'PUT')).status).toBe(404);
  });
});

describe('DELETE /settings/permission-templates/:id', () => {
  it('refuses system templates and templates still assigned to users', async () => {
    await listTemplates(); // seed
    expect((await post('/settings/permission-templates/tpl-handler', undefined, 'DELETE')).status).toBe(403);

    const created = (await (await post('/settings/permission-templates', {
      name: 'Assigned', permissions: [],
    })).json()) as TemplateBody;
    kvStore.set(`user:${TENANT}:profile:u9`, { id: 'u9', templateId: created.id });
    const inUse = await post(`/settings/permission-templates/${created.id}`, undefined, 'DELETE');
    expect(inUse.status).toBe(409);

    // Unassign, then deletion succeeds and the KV record is gone.
    kvStore.set(`user:${TENANT}:profile:u9`, { id: 'u9', templateId: null });
    expect((await post(`/settings/permission-templates/${created.id}`, undefined, 'DELETE')).status).toBe(200);
    expect(kvStore.has(`${TPL_PREFIX}${created.id}`)).toBe(false);
  });
});

describe('GET /settings/my-permission-template', () => {
  it('lets a staff user resolve their OWN assigned template only', async () => {
    await listTemplates(); // seed
    currentUser.role = 'staff';
    currentUser.app_metadata = { templateId: 'tpl-driver' };
    const res = await app.request('/settings/my-permission-template');
    expect(res.status).toBe(200);
    const tpl = (await res.json()) as TemplateBody | null;
    expect(tpl?.id).toBe('tpl-driver');

    currentUser.app_metadata = {};
    const none = await app.request('/settings/my-permission-template');
    expect(none.status).toBe(200);
    expect(await none.json()).toBeNull();
  });
});

describe('GET /settings/audit-logs', () => {
  it('serves server-recorded entries with a working section filter', async () => {
    kvStore.set('audit:settings:2026-07-19T10:00:00.000Z:a1', {
      id: 'a1', timestamp: '2026-07-19T10:00:00.000Z', section: 'users',
      action: 'update', userId: 'u1', userName: 'Admin', userRole: 'admin', details: {},
    });
    kvStore.set('audit:settings:2026-07-19T11:00:00.000Z:a2', {
      id: 'a2', timestamp: '2026-07-19T11:00:00.000Z', section: 'organisation',
      action: 'update', userId: 'u1', userName: 'Admin', userRole: 'admin', details: {},
    });

    const all = (await (await app.request('/settings/audit-logs')).json()) as Array<{ id: string }>;
    expect(all.map((e) => e.id)).toEqual(['a2', 'a1']); // newest first

    const users = (await (
      await app.request('/settings/audit-logs?section=users')
    ).json()) as Array<{ id: string }>;
    expect(users.map((e) => e.id)).toEqual(['a1']);
  });
});
