import { describe, it, expect } from 'vitest';
import './setup';
import { Hono } from 'hono';
import membershipsRoutes from '../../supabase/functions/server/memberships_routes.ts';

const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

/**
 * Mirrors the index.tsx composition that caused the prod 401 regression:
 * membershipsRoutes mounts at the bare function root (its /customer-packages
 * path shape is a fixed client contract) BEFORE the portal sub-app. A
 * `use('*', requireAuth)` inside membershipsRoutes therefore becomes
 * /make-server-fc003b23/* and intercepts the portal's internal
 * tracker-event route, whose service-to-service bearer is not a user token.
 * The stub below replicates that route's own bearer check verbatim from
 * portal_routes.tsx.
 */
function buildApp() {
  const app = new Hono();
  app.route('/make-server-fc003b23', membershipsRoutes);

  const portal = new Hono();
  portal.post('/internal/tracker-event', (c) => {
    const auth = c.req.header('Authorization') ?? '';
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
    if (!serviceKey || auth !== `Bearer ${serviceKey}`) {
      return c.json({ error: 'Unauthorized' }, 401);
    }
    return c.json({ ok: true });
  });
  app.route('/make-server-fc003b23/portal', portal);
  return app;
}

describe('memberships middleware scoping — must not leak onto later mounts', () => {
  it('lets the service-role bearer reach the internal tracker-event route', async () => {
    const app = buildApp();
    const res = await app.request('/make-server-fc003b23/portal/internal/tracker-event', {
      method: 'POST',
      headers: { Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' },
      body: '{}',
    });
    // Before the fix the leaked requireAuth answered 401 {"error":"unauthorized"}
    // here and the notification was dropped.
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it('still 401s a wrong bearer on the internal route (route-own check, not middleware)', async () => {
    const app = buildApp();
    const res = await app.request('/make-server-fc003b23/portal/internal/tracker-event', {
      method: 'POST',
      headers: { Authorization: 'Bearer not-the-service-key', 'Content-Type': 'application/json' },
      body: '{}',
    });
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'Unauthorized' });
  });

  it.each([
    ['GET', '/make-server-fc003b23/customer-packages'],
    ['POST', '/make-server-fc003b23/customer-packages'],
    ['POST', '/make-server-fc003b23/customer-packages/some-id/use'],
    ['POST', '/make-server-fc003b23/customer-packages/some-id/cancel'],
  ])('keeps every membership route behind requireAuth (%s %s)', async (method, path) => {
    const app = buildApp();
    const res = await app.request(path, { method });
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'unauthorized' });
  });
});
