import { describe, it, expect } from 'vitest';
import './setup';
import { Hono } from 'hono';
import { requireRole, type AuthenticatedUser, type Role } from '../../supabase/functions/server/_shared/auth.ts';

function fakeUser(role: Role): AuthenticatedUser {
  return {
    id: `user-${role}`,
    role,
    locationIds: [],
    email: `${role}@test.local`,
    name: role,
    tenantId: 'tenant-1',
  };
}

/** App with a route gated to `allowed`, authenticated as `role` (or nobody). */
function gatedApp(allowed: Role[], role?: Role) {
  const app = new Hono();
  if (role) {
    app.use('*', async (c, next) => {
      c.set('user', fakeUser(role));
      await next();
    });
  }
  app.post('/guarded', requireRole(...allowed), (c) => c.json({ ok: true }));
  return app;
}

describe('requireRole — role gate on mutating routes', () => {
  it('rejects a role outside the allowed list with a generic 403 + correlation ID', async () => {
    const app = gatedApp(['admin', 'manager'], 'staff');
    const res = await app.request('/guarded', { method: 'POST' });
    expect(res.status).toBe(403);
    const body = (await res.json()) as { error: string; correlationId: string };
    expect(body.error).toBe('forbidden');
    expect(body.correlationId).toMatch(/^[0-9a-f-]{36}$/);
    // Generic response only: neither the caller's role nor the required roles leak.
    const raw = JSON.stringify(body);
    expect(raw).not.toContain('staff');
    expect(raw).not.toContain('admin');
    expect(raw).not.toContain('manager');
  });

  it.each<Role>(['admin', 'manager'])('lets an allowed role (%s) through', async (role) => {
    const app = gatedApp(['admin', 'manager'], role);
    const res = await app.request('/guarded', { method: 'POST' });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it('matches assistant_manager exactly (no prefix-matching against manager)', async () => {
    const app = gatedApp(['assistant_manager'], 'manager');
    const res = await app.request('/guarded', { method: 'POST' });
    expect(res.status).toBe(403);
    const allowedApp = gatedApp(['assistant_manager'], 'assistant_manager');
    expect((await allowedApp.request('/guarded', { method: 'POST' })).status).toBe(200);
  });

  it('returns 401 (never fail-open) when no verified user is on context', async () => {
    const app = gatedApp(['admin', 'manager']);
    const res = await app.request('/guarded', { method: 'POST' });
    expect(res.status).toBe(401);
    expect(((await res.json()) as { error: string }).error).toBe('unauthorized');
  });
});
