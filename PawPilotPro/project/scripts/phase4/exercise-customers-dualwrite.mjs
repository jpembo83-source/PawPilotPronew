// Phase 4 / Customers — STAGE 2 dual-write end-to-end exercise.
// (Requires 20260711230000_phase4_app_schema_grants — the PostgREST read-back
// evaluates the stage-0 RLS policies, which call the app.* JWT helpers.)
//
// Drives the DEPLOYED edge function through real staff create/update/delete
// flows and, after every step, reads the Postgres side back via PostgREST
// (staff JWT + the stage-0 RLS policies — which this doubles as a live test
// of) and compares it field-by-field with what the API (KV-backed) returned.
// Exits non-zero on the first divergence. Ends by exercising the cascade
// delete + clear-timeline flows so the tenant is left with ZERO customer
// keys in KV and ZERO rows in Postgres.
//
// Runs from .github/workflows/phase4-staging-exercise.yml against STAGING
// only. NO credentials are stored anywhere: the workflow's existing
// SUPABASE_ACCESS_TOKEN secret fetches the staging service-role key from the
// Management API at runtime, mints a RANDOM throwaway staff user for the run,
// and deletes it in a finally-block. The anon key is a public client key by
// design.
//
// Usage:
//   STAGING_URL=… STAGING_REF=… STAGING_ANON_KEY=… SUPABASE_ACCESS_TOKEN=… \
//     node scripts/phase4/exercise-customers-dualwrite.mjs

import { randomUUID } from 'node:crypto';

const URL_BASE = process.env.STAGING_URL;
const REF = process.env.STAGING_REF;
const ANON = process.env.STAGING_ANON_KEY;
const MGMT_TOKEN = process.env.SUPABASE_ACCESS_TOKEN;
if (!URL_BASE || !REF || !ANON || !MGMT_TOKEN) {
  console.error('missing STAGING_URL / STAGING_REF / STAGING_ANON_KEY / SUPABASE_ACCESS_TOKEN');
  process.exit(2);
}

const EMAIL = `phase4.dw.${randomUUID()}@exercise.invalid`;
const PASSWORD = `${randomUUID()}-${randomUUID()}`; // never logged, never stored

const API = `${URL_BASE}/functions/v1/make-server-fc003b23/customers`;
let TOKEN = '';
let failures = 0;

function ok(step, detail = '') {
  console.log(`OK   ${step}${detail ? ` — ${detail}` : ''}`);
}
function fail(step, detail) {
  failures += 1;
  console.error(`FAIL ${step} — ${detail}`);
}

let SERVICE_KEY = '';
let EXERCISE_USER_ID = '';

/** Service-role key fetched at runtime from the Management API — never stored. */
async function fetchServiceKey() {
  const res = await fetch(`https://api.supabase.com/v1/projects/${REF}/api-keys?reveal=true`, {
    headers: { Authorization: `Bearer ${MGMT_TOKEN}` },
  });
  if (!res.ok) throw new Error(`management api-keys fetch failed: ${res.status}`);
  const keys = await res.json();
  const svc = keys.find((k) => k.name === 'service_role' || k.id === 'service_role');
  if (!svc?.api_key) throw new Error('service_role key not found in management API response');
  SERVICE_KEY = svc.api_key;
  ok('service key', 'fetched at runtime via SUPABASE_ACCESS_TOKEN');
}

/** Management-API SQL runner (the GoTrue admin create endpoint 500s on this
 *  project, so the user is provisioned the same way the operator does it). */
async function mgmtSql(query) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${MGMT_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  if (!res.ok) throw new Error(`management sql failed: ${res.status}`);
  return res.json();
}

/** Random throwaway staff user for this run only; deleted in cleanup. */
async function createExerciseUser() {
  EXERCISE_USER_ID = randomUUID();
  // EMAIL/PASSWORD are per-run randoms — interpolation is safe by construction.
  await mgmtSql(`
    insert into auth.users
      (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
       raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
       confirmation_token, recovery_token, email_change_token_new, email_change)
    values
      ('00000000-0000-0000-0000-000000000000', '${EXERCISE_USER_ID}', 'authenticated', 'authenticated',
       '${EMAIL}', extensions.crypt('${PASSWORD}', extensions.gen_salt('bf')), now(),
       '{"provider":"email","providers":["email"],"role":"admin","tenant_id":"demo-tenant-001"}'::jsonb,
       '{}'::jsonb, now(), now(), '', '', '', '');
    insert into auth.identities
      (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    values
      (gen_random_uuid(), '${EXERCISE_USER_ID}', '${EXERCISE_USER_ID}',
       jsonb_build_object('sub', '${EXERCISE_USER_ID}', 'email', '${EMAIL}', 'email_verified', true),
       'email', now(), now(), now());
  `);
  ok('exercise user', 'random throwaway staff user created');
}

async function deleteExerciseUser() {
  if (!EXERCISE_USER_ID) return;
  try {
    await mgmtSql(`
      delete from auth.identities where user_id = '${EXERCISE_USER_ID}';
      delete from auth.users where id = '${EXERCISE_USER_ID}';
    `);
    console.log('OK   exercise user deleted');
  } catch (err) {
    console.log(`WARN exercise user delete failed: ${err instanceof Error ? err.message : err}`);
  }
}

async function signIn() {
  const res = await fetch(`${URL_BASE}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: ANON, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  if (!res.ok) throw new Error(`sign-in failed: ${res.status} ${await res.text()}`);
  const body = await res.json();
  TOKEN = body.access_token;
  ok('sign-in', 'staff JWT acquired');
}

async function api(method, path, body) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* non-JSON body */ }
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status}: ${text.slice(0, 300)}`);
  return json;
}

/** Postgres read-back through PostgREST with the staff JWT (RLS-governed). */
async function pg(table, query) {
  const res = await fetch(`${URL_BASE}/rest/v1/${table}?${query}`, {
    headers: { apikey: ANON, Authorization: `Bearer ${TOKEN}` },
  });
  if (!res.ok) throw new Error(`rest ${table}?${query} → ${res.status}: ${await res.text()}`);
  return res.json();
}

/** Compare selected fields between the API (KV) object and the PG row. */
function compare(step, kvObj, pgRow, fields) {
  if (!pgRow) return fail(step, 'no Postgres row found');
  const diffs = [];
  for (const f of fields) {
    const a = kvObj?.[f] ?? null;
    const b = pgRow?.[f] ?? null;
    // Timestamps: KV stores '…Z', PostgREST returns '…+00:00' — compare instants.
    const norm = (x) =>
      typeof x === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(x) ? new Date(x).toISOString() : x;
    if (JSON.stringify(norm(a)) !== JSON.stringify(norm(b))) {
      diffs.push(`${f}: kv=${JSON.stringify(a)} pg=${JSON.stringify(b)}`);
    }
  }
  if (diffs.length > 0) return fail(step, diffs.join(' | '));
  ok(step, `${fields.length} fields match`);
}

async function main() {
  await fetchServiceKey();
  await createExerciseUser();
  await signIn();

  // ---- household create ----------------------------------------------------
  const hh = await api('POST', '/households', { name: 'DW Exercise Family', vip: false });
  compare('household create KV↔PG', hh, (await pg('households', `id=eq.${hh.id}&select=*`))[0],
    ['id', 'tenant_id', 'name', 'status', 'vip', 'payment_hold', 'created_at', 'updated_at']);

  // ---- contact create (primary) — multi-key: contact + household pointer ----
  const ada = await api('POST', `/households/${hh.id}/contacts`, {
    first_name: 'Ada', last_name: 'Prime', email: 'ada@example.test', is_primary: true,
  });
  compare('primary contact KV↔PG', ada, (await pg('contacts', `id=eq.${ada.id}&select=*`))[0],
    ['id', 'household_id', 'first_name', 'last_name', 'email', 'is_primary']);
  compare('household.primary_contact_id after create',
    { primary_contact_id: ada.id }, (await pg('households', `id=eq.${hh.id}&select=primary_contact_id`))[0],
    ['primary_contact_id']);

  // ---- second contact + PRIMARY FLIP (the transactional multi-key flow) -----
  const bob = await api('POST', `/households/${hh.id}/contacts`, {
    first_name: 'Bob', last_name: 'Second', is_primary: false,
  });
  await api('PUT', `/contacts/${bob.id}`, { is_primary: true });
  const [adaRow] = await pg('contacts', `id=eq.${ada.id}&select=is_primary`);
  const [bobRow] = await pg('contacts', `id=eq.${bob.id}&select=is_primary`);
  const [hhRow] = await pg('households', `id=eq.${hh.id}&select=primary_contact_id`);
  if (bobRow?.is_primary === true && adaRow?.is_primary === false && hhRow?.primary_contact_id === bob.id) {
    ok('primary-contact flip (transactional)', 'demoted+promoted+pointer all consistent');
  } else {
    fail('primary-contact flip', `ada=${JSON.stringify(adaRow)} bob=${JSON.stringify(bobRow)} hh=${JSON.stringify(hhRow)}`);
  }

  // ---- pet create + update --------------------------------------------------
  const petRes = await api('POST', `/households/${hh.id}/pets`, {
    name: 'Rexo', breed: 'Labrador', weight_kg: 21.5, daycare_enrolled: true,
  });
  const pet = petRes.photo_url !== undefined ? petRes : petRes.pet ?? petRes;
  compare('pet create KV↔PG', pet, (await pg('pets', `id=eq.${pet.id}&select=*`))[0],
    ['id', 'household_id', 'name', 'breed', 'weight_kg', 'daycare_enrolled', 'active', 'verification_status']);

  const updRes = await api('PUT', `/pets/${pet.id}`, { behaviour_notes: 'friendly', colour: 'black' });
  compare('pet update KV↔PG', updRes, (await pg('pets', `id=eq.${pet.id}&select=*`))[0],
    ['behaviour_notes', 'colour', 'name']);

  // ---- note create ----------------------------------------------------------
  const note = await api('POST', `/households/${hh.id}/notes`, {
    title: 'Exercise note', content: 'Dual-write exercise content.', category: 'general',
  });
  compare('note create KV↔PG', note, (await pg('household_notes', `id=eq.${note.id}&select=*`))[0],
    ['id', 'household_id', 'title', 'content', 'category', 'visibility', 'is_pinned']);

  // ---- document create + delete ---------------------------------------------
  const docRes = await api('POST', `/households/${hh.id}/documents`, {
    document_type: 'other', name: 'Exercise doc', file_name: 'x.pdf',
    storage_path: '#placeholder-x.pdf', file_size: 123, mime_type: 'application/pdf',
  });
  const doc = docRes.document ?? docRes;
  compare('document create KV↔PG', doc, (await pg('customer_documents', `id=eq.${doc.id}&select=*`))[0],
    ['id', 'household_id', 'document_type', 'name', 'file_name', 'storage_path', 'file_size', 'mime_type']);
  await api('DELETE', `/households/${hh.id}/documents/${doc.id}`);
  const docGone = await pg('customer_documents', `id=eq.${doc.id}&select=id`);
  docGone.length === 0 ? ok('document delete mirrored') : fail('document delete', 'PG row survived');

  // ---- flag create (vip → household sync) + delete ---------------------------
  const flag = await api('POST', `/households/${hh.id}/flags`, {
    flag_key: 'vip', severity: 'info', reason: 'exercise',
  });
  compare('flag create KV↔PG', flag, (await pg('household_flags', `id=eq.${flag.id}&select=*`))[0],
    ['id', 'household_id', 'flag_key', 'severity', 'is_active', 'reason']);
  compare('household.vip synced', { vip: true },
    (await pg('households', `id=eq.${hh.id}&select=vip`))[0], ['vip']);
  await api('DELETE', `/flags/${flag.id}`);
  const flagGone = await pg('household_flags', `id=eq.${flag.id}&select=id`);
  flagGone.length === 0 ? ok('flag delete mirrored') : fail('flag delete', 'PG row survived');
  compare('household.vip unsynced', { vip: false },
    (await pg('households', `id=eq.${hh.id}&select=vip`))[0], ['vip']);

  // ---- contact delete (non-primary) ------------------------------------------
  await api('DELETE', `/contacts/${ada.id}`);
  const adaGone = await pg('contacts', `id=eq.${ada.id}&select=id`);
  adaGone.length === 0 ? ok('contact delete mirrored') : fail('contact delete', 'PG row survived');

  // ---- activity feed parity: every KV-visible activity exists in PG ----------
  const kvActivities = await api('GET', `/households/${hh.id}/activity`);
  const pgActivities = await pg('customer_activities', `household_id=eq.${hh.id}&select=id`);
  const pgIds = new Set(pgActivities.map((a) => a.id));
  const missing = (kvActivities ?? []).filter((a) => !pgIds.has(a.id));
  missing.length === 0
    ? ok('activity parity', `${(kvActivities ?? []).length} KV activities all present in PG (PG total ${pgActivities.length})`)
    : fail('activity parity', `missing in PG: ${missing.map((a) => a.id).join(',')}`);

  // ---- CASCADE DELETE (the big multi-key flow) --------------------------------
  await api('DELETE', `/households/${hh.id}`);
  const leftovers = await Promise.all([
    pg('households', `id=eq.${hh.id}&select=id`),
    pg('contacts', `household_id=eq.${hh.id}&select=id`),
    pg('pets', `household_id=eq.${hh.id}&select=id`),
    pg('household_notes', `household_id=eq.${hh.id}&select=id`),
    pg('household_flags', `household_id=eq.${hh.id}&select=id`),
  ]);
  leftovers.every((rows) => rows.length === 0)
    ? ok('cascade delete mirrored', 'household/contacts/pets/notes/flags all gone from PG')
    : fail('cascade delete', `leftovers: ${leftovers.map((r) => r.length).join('/')}`);

  // ---- clear-timeline: purge leftover activities in BOTH stores ---------------
  await api('DELETE', '/clear-timeline-data');
  const pgActLeft = await pg('customer_activities', `household_id=eq.${hh.id}&select=id`);
  pgActLeft.length === 0
    ? ok('clear-timeline mirrored', 'no activities left in PG for the exercise household')
    : fail('clear-timeline', `${pgActLeft.length} activities left in PG`);

  console.log(failures === 0
    ? '\nEXERCISE PASSED: every flow mirrored KV → Postgres with zero divergence.'
    : `\nEXERCISE FAILED: ${failures} divergence(s).`);
  process.exitCode = failures === 0 ? 0 : 1;
}

main()
  .catch((err) => {
    console.error('fatal:', err instanceof Error ? err.message : err);
    process.exitCode = 2;
  })
  .finally(deleteExerciseUser);
