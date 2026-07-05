// Repro for the shared-device stale-cache bug: user A (portal-linked) signs
// in, signs out; user B (not portal-linked, server 403s) signs in on the
// same SPA session. Asserts B never sees A's household. Usage:
//   node portal-repro.mjs <outDir> [baseUrl]
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const outDir = process.argv[2] || 'repro';
const baseUrl = process.argv[3] || 'http://localhost:5174';
mkdirSync(outDir, { recursive: true });

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const now = Math.floor(Date.now() / 1000);
const mkJwt = (sub) =>
  `${b64({ alg: 'none', typ: 'JWT' })}.${b64({ sub, aud: 'authenticated', role: 'authenticated', exp: now + 6 * 3600 })}.fake`;
const mkSession = (sub, email) => ({
  access_token: mkJwt(sub),
  token_type: 'bearer',
  expires_in: 6 * 3600,
  expires_at: now + 6 * 3600,
  refresh_token: `refresh-${sub}`,
  user: { id: sub, aud: 'authenticated', email, app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' },
});

const USERS = {
  'linked@example.com': { sub: 'user-a' },
  'unlinked@example.com': { sub: 'user-b' },
};

const homeData = {
  greeting: { firstName: 'Jason', tenantName: 'Maple Dog Co.' },
  upcoming: [],
  alerts: { vaxExpiring: [], documentsExpiring: [], pendingRequests: 0 },
};
const petsData = {
  pets: [
    { id: 'pet-1', name: 'Meg', breed: 'German Shepherd', photo_url: null },
    { id: 'pet-2', name: 'Askya', breed: 'Dachshund', photo_url: null },
  ],
};

const subFromUserToken = (req) => {
  const header = req.headers()['x-user-token'] ?? '';
  const jwt = header.replace('Bearer ', '');
  try {
    return JSON.parse(Buffer.from(jwt.split('.')[1], 'base64url').toString()).sub;
  } catch {
    return null;
  }
};

async function route(routeObj) {
  const req = routeObj.request();
  const url = req.url();
  const json = (body, status = 200) =>
    routeObj.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

  if (url.includes('/auth/v1/token')) {
    const body = JSON.parse(req.postData() ?? '{}');
    if (body.grant_type === 'refresh_token' || body.refresh_token) {
      const sub = (body.refresh_token ?? '').replace('refresh-', '') || 'user-a';
      const email = Object.keys(USERS).find((e) => USERS[e].sub === sub) ?? 'linked@example.com';
      return json(mkSession(sub, email));
    }
    const u = USERS[(body.email ?? '').toLowerCase()];
    if (!u) return json({ error: 'invalid_grant', error_description: 'Invalid login credentials' }, 400);
    return json(mkSession(u.sub, body.email));
  }
  if (url.includes('/auth/v1/logout')) return json({}, 204);
  if (url.includes('/auth/v1/')) return json({});

  if (url.includes('/make-server-fc003b23/portal/branding')) return json({ name: 'Maple Dog Co.' });
  if (url.includes('/make-server-fc003b23/portal/')) {
    const sub = subFromUserToken(req);
    if (sub !== 'user-a') return json({ error: 'Portal account not linked' }, 403);
    if (url.includes('/portal/me')) return json({ authUserId: 'user-a', householdId: 'hh-1', tenantId: 'tenant-1' });
    if (url.includes('/portal/home')) return json(homeData);
    // Sub-resources must match before the pets list/detail catch below
    if (url.includes('/timeline')) return json({ days: [] });
    if (url.includes('/insights')) return json({ insights: [] });
    if (url.includes('/whereabouts')) return json({});
    if (/\/portal\/pets\/[^/?]+$/.test(url.split('?')[0])) return json(petsData.pets[0]);
    if (url.includes('/portal/pets')) return json(petsData);
    if (url.includes('/portal/account')) return json({ profile: { name: 'Jason Pemberton', email: 'linked@example.com', phone: '' }, notificationPrefs: { booking: true, vax: true } });
    if (url.includes('/portal/household')) return json({ household: { id: 'hh-1', name: 'Pemberton' }, contacts: [] });
    if (url.includes('/portal/notifications')) return json({ notifications: [], unread: 0 });
    if (url.includes('/portal/bookings')) return json({ bookings: [] });
    return json({});
  }
  return json({});
}

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
});
await ctx.route('**/*.supabase.co/**', route);
const page = await ctx.newPage();
page.on('console', (m) => { if (m.type() === 'error') console.log('[console.error]', m.text().slice(0, 300)); });
page.on('pageerror', (e) => console.log('[pageerror]', String(e).slice(0, 300)));

const login = async (email) => {
  await page.locator('input[type="email"]').fill(email);
  await page.locator('#password').fill('correct-horse-battery');
  await page.locator('button[type="submit"]').click();
};

// 1. User A signs in and sees their household
await page.goto(`${baseUrl}/login`, { waitUntil: 'load', timeout: 60000 });
await page.waitForTimeout(1500);
await login('linked@example.com');
await page.waitForTimeout(2500);
const megVisibleForA = await page.getByText('Meg').first().isVisible().catch(() => false);
console.log(`user A sees their pets: ${megVisibleForA ? 'YES' : 'NO'}`);
await page.screenshot({ path: `${outDir}/1-user-a-home.png` });

// 2. Sign out in-app (SPA state survives — this is the crux)
await page.locator('a[href="/account"]').first().click().catch(async () => {
  await page.goto(`${baseUrl}/account`, { waitUntil: 'load' }); // fallback (full reload weakens repro)
});
await page.waitForTimeout(1200);
await page.getByRole('button', { name: /sign out/i }).click();
await page.waitForTimeout(1500);
await page.screenshot({ path: `${outDir}/2-signed-out.png` });

// 3. User B (not portal-linked) signs in on the same device
await login('unlinked@example.com');
await page.waitForTimeout(2500);
await page.screenshot({ path: `${outDir}/3-user-b-after-login.png` });

// B lands wherever the ?next= param pointed (the account page). Check for
// user A's identity there, then walk to Home and check A's pets.
const aName = await page.getByText('Jason Pemberton').first().isVisible().catch(() => false);
const aEmail = await page.getByText('linked@example.com').first().isVisible().catch(() => false);
await page.locator('a[href="/"]').first().click().catch(() => {});
await page.waitForTimeout(2000);
await page.screenshot({ path: `${outDir}/4-user-b-home.png` });
const megVisibleForB = await page.getByText('Meg').first().isVisible().catch(() => false);
const askyaVisibleForB = await page.getByText('Askya').first().isVisible().catch(() => false);
const blockedVisible = await page.getByText(/doesn.t have portal access/i).first().isVisible().catch(() => false);

const leaked = aName || aEmail || megVisibleForB || askyaVisibleForB;
console.log(`user B sees A's profile (name/email): ${aName || aEmail ? 'YES — BUG' : 'NO'}`);
console.log(`user B sees A's pets (Meg/Askya):     ${megVisibleForB || askyaVisibleForB ? 'YES — BUG' : 'NO'}`);
console.log(`user B sees the no-access screen:     ${blockedVisible ? 'YES' : 'NO'}`);

await browser.close();
console.log(leaked ? 'RESULT: FAIL — stale data leaked across accounts' : 'RESULT: PASS — no cross-account data shown');
process.exit(leaked ? 1 : 0);
