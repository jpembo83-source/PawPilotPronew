// Screenshot harness: fakes a Supabase session in localStorage and mocks the
// backend so real screens render with fixture data. Usage:
//   node shots.mjs <outDir> [baseUrl]
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const outDir = process.argv[2] || 'shots';
const baseUrl = process.argv[3] || 'http://localhost:5173';
mkdirSync(outDir, { recursive: true });

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const now = Math.floor(Date.now() / 1000);
const userObj = {
  id: 'user-1',
  aud: 'authenticated',
  email: 'alex@example.com',
  app_metadata: { role: 'admin', tenant_id: 'tenant-1', locationIds: ['loc-1'] },
  user_metadata: { name: 'Alex Morgan' },
  created_at: '2024-01-01T00:00:00Z',
};
const jwt = `${b64({ alg: 'none', typ: 'JWT' })}.${b64({
  sub: 'user-1',
  aud: 'authenticated',
  role: 'authenticated',
  exp: now + 6 * 3600,
  email: userObj.email,
  app_metadata: userObj.app_metadata,
  user_metadata: userObj.user_metadata,
})}.fake`;
const session = {
  access_token: jwt,
  token_type: 'bearer',
  expires_in: 6 * 3600,
  expires_at: now + 6 * 3600,
  refresh_token: 'fake-refresh',
  user: userObj,
};

const today = new Date().toISOString().split('T')[0];
const mkBooking = (n, over = {}) => ({
  id: `bk-${n}`,
  household_id: 'hh-1',
  household_name: ['The Bennett Household', 'The Okafor Household', 'The Reyes Household'][n % 3],
  pet_id: `pet-${n}`,
  pet_name: ['Biscuit', 'Luna', 'Alfie', 'Poppy', 'Max'][n % 5],
  location_id: 'loc-1',
  location_name: 'Main Site',
  service_id: 'service-daycare-full',
  service_name: 'Daycare (Full Day)',
  service_type: 'full_day',
  booking_date: today,
  planned_start_time: n === 1 ? '07:00' : '09:30',
  planned_end_time: '18:00',
  booking_status: 'confirmed',
  check_in_status: 'not_checked_in',
  capacity_slot: n,
  has_behaviour_flag: n === 1,
  has_medical_flag: n === 2,
  behaviour_notes: n === 1 ? 'Resource-guards toys with new dogs.' : undefined,
  medical_notes: n === 2 ? 'Daily anti-seizure medication at 12:00.' : undefined,
  vaccination_status: 'valid',
  waiver_status: 'valid',
  has_booking_hold: false,
  has_payment_hold: false,
  base_price_locked: 38,
  tax_rate: 0.2,
  total_price: 45.6,
  currency: 'GBP',
  billing_line_item_ids: [],
  requires_transport: false,
  created_by_id: 'user-1',
  created_by_name: 'Alex Morgan',
  created_at: `${today}T07:00:00Z`,
  updated_at: `${today}T07:00:00Z`,
  ...over,
});
const arriving = [0, 1, 2].map((n) => mkBooking(n));
const onSite = [3, 4].map((n) =>
  mkBooking(n, {
    check_in_status: 'checked_in',
    actual_check_in_time: `${today}T08:1${n}:00Z`,
    has_medical_flag: n === 3,
    medical_notes: n === 3 ? 'Grass allergy — hives if he rolls in cut grass.' : undefined,
  })
);
const allBookings = [...arriving, ...onSite];

const stats = {
  location_id: 'loc-1', date: today,
  total_bookings: 12, confirmed_bookings: 9, checked_in_count: 5, checked_out_count: 2,
  no_shows: 0, cancellations: 1,
  max_capacity: 30, capacity_utilisation: 41.6, available_slots: 18,
  expected_arrivals_2h: 3, expected_pickups_2h: 1,
  waiver_alerts: 1, hold_alerts: 0, behaviour_flags: 2, medical_flags: 1, vaccination_alerts: 2,
};

const pet = {
  id: 'pet-1', household_id: 'hh-1', name: 'Biscuit', breed: 'Cocker Spaniel',
  sex: 'male', date_of_birth: '2021-03-14', active: true, photo_url: null,
  medical_notes: 'Daily anti-seizure medication at 12:00. If a seizure lasts more than two minutes call the vet immediately.',
  allergies: 'Chicken — strict. Reacts with hives within minutes.',
  behaviour_notes: 'Resource-guards toys with new dogs.',
  weight_kg: 13.5, neutered: true,
};

async function route(routeObj) {
  const url = routeObj.request().url();
  const json = (body) => routeObj.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  if (url.includes('/auth/v1/token')) return json(session);
  if (url.includes('/auth/v1/')) return json({});
  if (url.includes('/daycare/stats')) return json(stats);
  if (url.includes('/validate-checkin')) return json({ can_check_in: true, blockers: [], warnings: [{ type: 'warning', category: 'behaviour', message: 'Resource-guards toys with new dogs.' }] });
  if (url.includes('/daycare/bookings')) {
    const u = new URL(url);
    if (u.searchParams.get('check_in_status') === 'not_checked_in') return json(arriving);
    if (u.searchParams.get('check_in_status') === 'checked_in') return json(onSite);
    if (u.searchParams.get('pet_id')) return json([]);
    return json(allBookings);
  }
  if (url.includes('/daycare/')) return json({});
  if (/\/customers\/pets\/pet-1$/.test(url.split('?')[0])) return json(pet);
  if (url.includes('/customers/households/hh-1/documents')) return json({ documents: [] });
  if (url.includes('/customers/households/hh-1/flags')) return json([{ id: 'flag-1', household_id: 'hh-1', pet_id: 'pet-1', flag_key: 'medication_on_site', severity: 'warn', reason: 'Anti-seizure medication kept in the office fridge.', is_active: true }]);
  if (url.includes('/customers/households/hh-1')) return json({ id: 'hh-1', name: 'The Bennett Household', contacts: [], pets: [pet] });
  if (url.includes('/pets/pet-1/vaccinations')) return json({ vaccinations: [] });
  if (url.includes('/organisation')) return json({ id: 'org-1', name: 'Maple Dog Co.', tradingName: 'Maple Dog Co.' });
  if (url.includes('/settings/global-modules')) return json({ globalEnabledModules: ['grooming', 'transport', 'overnights'] });
  if (url.includes('/locations')) return json([{ id: 'loc-1', name: 'Main Site' }]);
  console.log('  [unmocked]', url.replace(/^https?:\/\/[^/]+/, ''));
  return json({});
}

const screens = [
  { path: '/', name: 'dashboard' },
  { path: '/daycare/check-in', name: 'check-in' },
  { path: '/customers/pets/pet-1', name: 'pet-profile' },
];
const viewports = [
  { label: 'mobile', width: 390, height: 844 },
  { label: 'desktop', width: 1280, height: 900 },
];

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
for (const vp of viewports) {
  const ctx = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    deviceScaleFactor: 2,
    isMobile: vp.label === 'mobile',
    hasTouch: vp.label === 'mobile',
  });
  await ctx.route('**/*.supabase.co/**', route);
  const page = await ctx.newPage();
  // Seed the fake session before the app boots
  await page.addInitScript(([key, value]) => {
    window.localStorage.setItem(key, value);
    window.sessionStorage.setItem('mdc-session-start', new Date().toISOString());
  }, ['mdc-operations-auth', JSON.stringify(session)]);

  for (const s of screens) {
    await page.goto(`${baseUrl}${s.path}`, { waitUntil: 'load', timeout: 60000 });
    await page.waitForTimeout(3500);
    await page.screenshot({ path: `${outDir}/${s.name}-${vp.label}.png`, fullPage: vp.label !== 'mobile' });
    console.log(`captured ${s.name}-${vp.label}.png`);
  }

  // Check-in validation dialog (portalled) — verifies the touch floor there
  if (vp.label === 'mobile') {
    await page.goto(`${baseUrl}/daycare/check-in`, { waitUntil: 'load', timeout: 60000 });
    await page.waitForTimeout(2500);
    await page.getByText('Biscuit').first().click();
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${outDir}/check-in-dialog-${vp.label}.png` });
    console.log(`captured check-in-dialog-${vp.label}.png`);
  }
  await ctx.close();
}
await browser.close();
console.log('done →', outDir);
