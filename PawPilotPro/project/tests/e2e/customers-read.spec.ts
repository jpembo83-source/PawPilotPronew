// Customers read-path smoke: list, search, household detail, pet detail.
//
// Gate coverage for the Phase 4 stage-3 read cutover: these assertions hold
// identically whichever store serves reads (KV or Postgres behind
// read_from_pg:customers), so the suite is the flip/rollback safety net.
// API-level (same pattern as rbac-role-gates.spec.ts): sign in with the CI
// smoke credentials and hit the edge function directly. Assertions are
// data-independent — they derive expectations from the environment's own
// list response rather than assuming seeded records.

import { test, expect, APIRequestContext } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

const projectUrl = process.env.VITE_SUPABASE_URL
  || (process.env.VITE_SUPABASE_PROJECT_ID
        ? `https://${process.env.VITE_SUPABASE_PROJECT_ID}.supabase.co`
        : undefined);
const anonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
const TEST_EMAIL = process.env.TEST_EMAIL;
const TEST_PASSWORD = process.env.TEST_PASSWORD;

const FN_BASE = `${projectUrl}/functions/v1/make-server-fc003b23`;

let token: string | null = null;

async function signIn(): Promise<string> {
  if (token) return token;
  const supabase = createClient(projectUrl!, anonKey!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await supabase.auth.signInWithPassword({
    email: TEST_EMAIL!,
    password: TEST_PASSWORD!,
  });
  expect(error, `sign-in failed: ${error?.message}`).toBeNull();
  token = data.session?.access_token ?? null;
  expect(token, 'no access token').toBeTruthy();
  return token!;
}

function headers(t: string) {
  return { Authorization: `Bearer ${t}`, apikey: anonKey!, 'Content-Type': 'application/json' };
}

async function getJson(request: APIRequestContext, path: string): Promise<unknown> {
  const t = await signIn();
  const res = await request.get(`${FN_BASE}${path}`, { headers: headers(t), failOnStatusCode: false });
  expect(res.status(), `GET ${path}`).toBe(200);
  return res.json();
}

function skipUnlessConfigured() {
  test.skip(!projectUrl || !anonKey || !TEST_EMAIL || !TEST_PASSWORD,
    'requires VITE_SUPABASE_URL (or VITE_SUPABASE_PROJECT_ID), VITE_SUPABASE_ANON_KEY, TEST_EMAIL, TEST_PASSWORD');
}

type HouseholdRow = {
  id: string;
  name: string;
  contacts_count: number;
  pets_count: number;
  primary_contact: unknown;
};

test.describe('customers read path (list/search/detail) @smoke', () => {

  test('paginated household list returns the envelope contract', async ({ request }) => {
    skipUnlessConfigured();
    const body = await getJson(request, '/customers/households?limit=5&offset=0') as {
      households: HouseholdRow[]; total: number; limit: number; offset: number;
    };
    expect(Array.isArray(body.households)).toBe(true);
    expect(typeof body.total).toBe('number');
    expect(body.limit).toBe(5);
    expect(body.offset).toBe(0);
    expect(body.households.length).toBeLessThanOrEqual(5);
    expect(body.total).toBeGreaterThanOrEqual(body.households.length);
    for (const row of body.households) {
      expect(typeof row.id).toBe('string');
      expect(typeof row.name).toBe('string');
      expect(typeof row.contacts_count).toBe('number');
      expect(typeof row.pets_count).toBe('number');
      expect('primary_contact' in row).toBe(true);
    }
  });

  test('unpaginated household list returns the legacy array contract, name-sorted', async ({ request }) => {
    skipUnlessConfigured();
    const rows = await getJson(request, '/customers/households') as HouseholdRow[];
    expect(Array.isArray(rows)).toBe(true);
    const names = rows.map((r) => r.name ?? '');
    const sorted = [...names].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
    expect(names).toEqual(sorted);
  });

  test('search narrows the list and finds a known household', async ({ request }) => {
    skipUnlessConfigured();
    const all = await getJson(request, '/customers/households') as HouseholdRow[];
    test.skip(all.length === 0, 'no households in this environment');
    const target = all[0];
    const needle = target.name.slice(0, Math.min(4, target.name.length));
    const found = await getJson(
      request, `/customers/households?search=${encodeURIComponent(needle)}`) as HouseholdRow[];
    expect(Array.isArray(found)).toBe(true);
    expect(found.length).toBeLessThanOrEqual(all.length);
    expect(found.map((r) => r.id)).toContain(target.id);
  });

  test('household detail returns the household with contacts/pets/documents', async ({ request }) => {
    skipUnlessConfigured();
    const all = await getJson(request, '/customers/households?limit=1&offset=0') as { households: HouseholdRow[] };
    test.skip(all.households.length === 0, 'no households in this environment');
    const id = all.households[0].id;
    const detail = await getJson(request, `/customers/households/${id}`) as {
      id: string; name: string; contacts: unknown[]; pets: unknown[]; documents: unknown[];
    };
    expect(detail.id).toBe(id);
    expect(Array.isArray(detail.contacts)).toBe(true);
    expect(Array.isArray(detail.pets)).toBe(true);
    expect(Array.isArray(detail.documents)).toBe(true);
  });

  test('pet detail resolves a pet found via its household', async ({ request }) => {
    skipUnlessConfigured();
    const all = await getJson(request, '/customers/households') as HouseholdRow[];
    const withPets = all.find((r) => r.pets_count > 0);
    test.skip(!withPets, 'no household with pets in this environment');
    const detail = await getJson(request, `/customers/households/${withPets!.id}`) as {
      pets: Array<{ id: string; household_id: string; name: string }>;
    };
    expect(detail.pets.length).toBeGreaterThan(0);
    const pet = detail.pets[0];
    const petDetail = await getJson(request, `/customers/pets/${pet.id}`) as {
      id: string; household_id: string; name: string;
    };
    expect(petDetail.id).toBe(pet.id);
    expect(petDetail.household_id).toBe(withPets!.id);
    expect(petDetail.name).toBe(pet.name);
  });

  test('a missing household and a missing pet 404', async ({ request }) => {
    skipUnlessConfigured();
    const t = await signIn();
    for (const path of ['/customers/households/hh-does-not-exist', '/customers/pets/pet-does-not-exist']) {
      const res = await request.get(`${FN_BASE}${path}`, { headers: headers(t), failOnStatusCode: false });
      expect(res.status(), path).toBe(404);
    }
  });

  test('duplicate lookup returns its contract shape', async ({ request }) => {
    skipUnlessConfigured();
    const body = await getJson(request, '/customers/lookup?name=zz-no-such-household') as {
      contacts: unknown[]; households: unknown[];
    };
    expect(Array.isArray(body.contacts)).toBe(true);
    expect(Array.isArray(body.households)).toBe(true);
  });
});
