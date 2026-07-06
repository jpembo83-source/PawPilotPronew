// Nav snapshot: for each role, scrape desktop sidebar groups, mobile bottom
// bar, and mobile drawer sections. Usage: node nav-snapshot.mjs <out.json> [baseUrl]
import { chromium } from '@playwright/test';
import { writeFileSync } from 'node:fs';

const outFile = process.argv[2] || 'nav-snapshot.json';
const baseUrl = process.argv[3] || 'http://localhost:5175';

const ROLES = ['admin', 'manager', 'assistant_manager', 'staff'];

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const now = Math.floor(Date.now() / 1000);

function makeSession(role) {
  const userObj = {
    id: `user-${role}`,
    aud: 'authenticated',
    email: `${role}@example.com`,
    app_metadata: { role, tenant_id: 'tenant-1', locationIds: ['loc-1'] },
    user_metadata: { name: `Test ${role}` },
    created_at: '2024-01-01T00:00:00Z',
  };
  const jwt = `${b64({ alg: 'none', typ: 'JWT' })}.${b64({
    sub: userObj.id, aud: 'authenticated', role: 'authenticated',
    exp: now + 21600, email: userObj.email,
    app_metadata: userObj.app_metadata, user_metadata: userObj.user_metadata,
  })}.fake`;
  return {
    access_token: jwt, token_type: 'bearer', expires_in: 21600,
    expires_at: now + 21600, refresh_token: 'fake-refresh', user: userObj,
  };
}

function makeRoute(session) {
  return async (routeObj) => {
    const url = routeObj.request().url();
    const json = (b) => routeObj.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(b) });
    if (url.includes('/auth/v1/token')) return json(session);
    if (url.includes('/auth/v1/')) return json({});
    if (url.includes('/daycare/bookings')) return json([]);
    if (url.includes('/daycare/stats')) return json({});
    if (url.includes('/attendance/active')) return json([]);
    if (url.includes('/incidents')) return json([]);
    if (url.includes('/capacity/daily')) return json({ locations: [], date: '2026-07-06' });
    if (url.includes('/organisation')) return json({ id: 'org-1', name: 'Maple Dog Co.', tradingName: 'Maple Dog Co.' });
    // Boutique deliberately NOT globally enabled — exercises the gate.
    if (url.includes('/settings/global-modules')) return json({ globalEnabledModules: ['daycare', 'grooming', 'transport', 'overnights', 'packages'] });
    if (url.includes('/locations')) return json([{ id: 'loc-1', name: 'Main Site', isActive: true, enabledModules: ['daycare', 'grooming', 'transport', 'overnights', 'packages'] }]);
    return json({});
  };
}

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const snapshot = {};

for (const role of ROLES) {
  const session = makeSession(role);
  snapshot[role] = {};

  // ── Desktop ──
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    await ctx.route('**/*.supabase.co/**', makeRoute(session));
    const page = await ctx.newPage();
    await page.addInitScript(([key, value]) => {
      window.localStorage.setItem(key, value);
      window.sessionStorage.setItem('mdc-session-start', new Date().toISOString());
    }, ['mdc-operations-auth', JSON.stringify(session)]);
    await page.goto(`${baseUrl}/`, { waitUntil: 'load', timeout: 60000 });
    await page.waitForTimeout(3500);
    snapshot[role].desktop = await page.evaluate(() => {
      const nav = document.querySelector('nav');
      if (!nav) return null;
      const groups = [...nav.querySelectorAll('.space-y-px')];
      return groups.map((g) =>
        [...g.querySelectorAll('a')].map((a) => ({
          label: (a.textContent || '').trim(),
          path: a.getAttribute('href'),
        }))
      );
    });
    await ctx.close();
  }

  // ── Mobile ──
  {
    const ctx = await browser.newContext({
      viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true,
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    });
    await ctx.route('**/*.supabase.co/**', makeRoute(session));
    const page = await ctx.newPage();
    await page.addInitScript(([key, value]) => {
      window.localStorage.setItem(key, value);
      window.sessionStorage.setItem('mdc-session-start', new Date().toISOString());
    }, ['mdc-operations-auth', JSON.stringify(session)]);
    await page.goto(`${baseUrl}/`, { waitUntil: 'load', timeout: 60000 });
    await page.waitForTimeout(3500);

    snapshot[role].mobileBottomBar = await page.evaluate(() => {
      const nav = [...document.querySelectorAll('nav')].find((n) => n.querySelector('a span'));
      if (!nav) return null;
      return [...nav.querySelectorAll('a')].map((a) => ({
        label: (a.textContent || '').trim(),
        path: a.getAttribute('href'),
      }));
    });

    await page.getByLabel('Open menu').click();
    await page.waitForTimeout(700);
    snapshot[role].mobileDrawer = await page.evaluate(() => {
      const panels = [...document.querySelectorAll('.fixed.inset-0 .mb-3')];
      return panels.map((sec) => ({
        section: (sec.querySelector('p')?.textContent || '').trim(),
        items: [...sec.querySelectorAll('a')].map((a) => ({
          label: (a.textContent || '').trim(),
          path: a.getAttribute('href'),
        })),
      }));
    });
    await ctx.close();
  }
  console.log(`${role}: desktop groups=${snapshot[role].desktop?.length}, bottom=${snapshot[role].mobileBottomBar?.length}, drawer sections=${snapshot[role].mobileDrawer?.length}`);
}

await browser.close();
writeFileSync(outFile, JSON.stringify(snapshot, null, 2));
console.log('snapshot →', outFile);
