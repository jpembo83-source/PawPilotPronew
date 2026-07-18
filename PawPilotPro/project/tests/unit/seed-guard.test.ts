import { describe, it, expect, beforeEach } from 'vitest';
import './setup';
import { Hono } from 'hono';
import { requireSeedEnabled } from '../../supabase/functions/server/_shared/seed_guard.ts';

function seedApp() {
  const app = new Hono();
  app.post('/seed', requireSeedEnabled, (c) => c.json({ seeded: true }));
  return app;
}

describe('requireSeedEnabled — seed routes unreachable in production', () => {
  beforeEach(() => {
    delete process.env.SEED_ENABLED;
  });

  it('answers 404 when SEED_ENABLED is unset (indistinguishable from no route)', async () => {
    const res = await seedApp().request('/seed', { method: 'POST' });
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'not_found' });
  });

  it.each(['false', 'TRUE', '1', 'yes'])(
    'answers 404 for any value other than the exact string "true" (%s)',
    async (value) => {
      process.env.SEED_ENABLED = value;
      const res = await seedApp().request('/seed', { method: 'POST' });
      expect(res.status).toBe(404);
    },
  );

  it('lets the request through only when SEED_ENABLED=true', async () => {
    process.env.SEED_ENABLED = 'true';
    const res = await seedApp().request('/seed', { method: 'POST' });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ seeded: true });
  });
});
