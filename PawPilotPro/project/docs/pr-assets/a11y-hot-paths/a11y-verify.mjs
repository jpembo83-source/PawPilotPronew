// Semantic spot-checks for the a11y branch: accessible names on check-in
// cards (incl. flag state), dialog naming, sidebar tooltips, live regions.
import { chromium } from '@playwright/test';

const baseUrl = process.argv[2] || 'http://localhost:5175';

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const now = Math.floor(Date.now() / 1000);
const userObj = {
  id: 'user-1', aud: 'authenticated', email: 'alex@example.com',
  app_metadata: { role: 'admin', tenant_id: 'tenant-1', locationIds: ['loc-1'] },
  user_metadata: { name: 'Alex Morgan' }, created_at: '2024-01-01T00:00:00Z',
};
const jwt = `${b64({ alg: 'none', typ: 'JWT' })}.${b64({
  sub: 'user-1', aud: 'authenticated', role: 'authenticated',
  exp: now + 21600, email: userObj.email,
  app_metadata: userObj.app_metadata, user_metadata: userObj.user_metadata,
})}.fake`;
const session = {
  access_token: jwt, token_type: 'bearer', expires_in: 21600,
  expires_at: now + 21600, refresh_token: 'fake-refresh', user: userObj,
};
const today = new Date().toISOString().split('T')[0];
const mkBooking = (n, over = {}) => ({
  id: `bk-${n}`, household_id: 'hh-1',
  household_name: ['The Bennett Household', 'The Okafor Household', 'The Reyes Household'][n % 3],
  pet_id: `pet-${n}`, pet_name: ['Biscuit', 'Luna', 'Alfie', 'Poppy', 'Max'][n % 5],
  location_id: 'loc-1', location_name: 'Main Site',
  service_id: 'service-daycare-full', service_name: 'Daycare (Full Day)', service_type: 'full_day',
  booking_date: today, planned_start_time: n === 1 ? '07:00' : '09:30', planned_end_time: '18:00',
  booking_status: 'confirmed', check_in_status: 'not_checked_in', capacity_slot: n,
  has_behaviour_flag: n === 1, has_medical_flag: n === 2,
  behaviour_notes: n === 1 ? 'Resource-guards toys.' : undefined,
  medical_notes: n === 2 ? 'Daily medication at 12:00.' : undefined,
  vaccination_status: 'valid', waiver_status: 'valid',
  has_booking_hold: false, has_payment_hold: false,
  base_price_locked: 38, tax_rate: 0.2, total_price: 45.6, currency: 'GBP',
  billing_line_item_ids: [], requires_transport: false,
  created_by_id: 'user-1', created_by_name: 'Alex Morgan',
  created_at: `${today}T07:00:00Z`, updated_at: `${today}T07:00:00Z`, ...over,
});
const arriving = [0, 1, 2].map((n) => mkBooking(n));

async function route(routeObj) {
  const url = routeObj.request().url();
  const json = (b) => routeObj.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(b) });
  if (url.includes('/auth/v1/token')) return json(session);
  if (url.includes('/auth/v1/')) return json({});
  if (url.includes('/validate-checkin')) return json({ can_check_in: true, blockers: [], warnings: [{ type: 'warning', category: 'behaviour', message: 'Resource-guards toys with new dogs.' }] });
  if (url.includes('/daycare/bookings')) return json(arriving);
  if (url.includes('/daycare/stats')) return json({});
  if (url.includes('/daycare/')) return json({});
  if (url.includes('/organisation')) return json({ id: 'org-1', name: 'Maple Dog Co.', tradingName: 'Maple Dog Co.' });
  if (url.includes('/settings/global-modules')) return json({ globalEnabledModules: [] });
  if (url.includes('/locations')) return json([{ id: 'loc-1', name: 'Main Site' }]);
  return json({});
}

let failures = 0;
const check = (name, ok) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`); if (!ok) failures++; };

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
await ctx.route('**/*.supabase.co/**', route);
const page = await ctx.newPage();
await page.addInitScript(([key, value]) => {
  window.localStorage.setItem(key, value);
  window.sessionStorage.setItem('mdc-session-start', new Date().toISOString());
}, ['mdc-operations-auth', JSON.stringify(session)]);

// 1. Check-in cards expose name + household + flag state
await page.goto(`${baseUrl}/daycare/check-in`, { waitUntil: 'load', timeout: 60000 });
await page.waitForTimeout(3000);
check('card: plain pet (name + household + time)',
  await page.getByRole('button', { name: 'Check in Biscuit, The Bennett Household, booked for 09:30' }).count() === 1);
check('card: behaviour flag announced',
  await page.getByRole('button', { name: /Check in Luna, The Okafor Household, has behaviour alert/ }).count() === 1);
check('card: medical flag announced',
  await page.getByRole('button', { name: /Check in Alfie, The Reyes Household, has medical alert/ }).count() === 1);
check('back button named', await page.getByRole('button', { name: 'Back to daycare' }).count() === 1);
check('search input labelled', await page.getByRole('textbox', { name: 'Search by pet or owner name' }).count() === 1);

// 2. Dialog gets a name + warning section in aria-describedby
await page.getByRole('button', { name: /Check in Luna/ }).click();
await page.waitForTimeout(1200);
const dialog = page.getByRole('dialog');
check('dialog has accessible name "Check in Luna"',
  (await dialog.getAttribute('aria-labelledby')) !== null &&
  (await page.getByRole('dialog', { name: /Check in Luna/ }).count()) === 1);
const describedBy = await dialog.getAttribute('aria-describedby');
check('dialog aria-describedby includes warning section',
  !!describedBy && describedBy.includes('checkin-dialog-warnings'));
check('warning group labelled', await page.getByRole('group', { name: 'Check-in warnings' }).count() === 1);
await page.keyboard.press('Escape');

// 3. Sonner live region present after a toast-triggering screen loads
const toasterRegion = await page.locator('[aria-live="polite"]').count();
check('polite live region(s) present on page', toasterRegion > 0);

// 4. Collapsed sidebar: tooltip on focus + aria-label on icon links
await page.goto(`${baseUrl}/`, { waitUntil: 'load', timeout: 60000 });
await page.waitForTimeout(2500);
await page.getByRole('button', { name: 'Collapse sidebar' }).click();
await page.waitForTimeout(500);
const dashLink = page.getByRole('link', { name: 'Dashboard' });
check('collapsed nav item keeps accessible name', await dashLink.count() === 1);
await dashLink.focus();
await page.waitForTimeout(400);
check('tooltip appears on keyboard focus', await page.getByRole('tooltip', { name: 'Dashboard' }).count() >= 1);

await browser.close();
console.log(failures === 0 ? '\nALL CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
