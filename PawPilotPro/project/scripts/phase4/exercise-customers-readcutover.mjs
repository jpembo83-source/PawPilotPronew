// Phase 4 / Customers — STAGE 3 read-cutover end-to-end exercise (STAGING).
//
// Proves the read_from_pg:customers flag flip is response-invisible on the
// DEPLOYED staging edge function:
//   1. flag OFF → captures every list/detail/search response (KV-served)
//   2. flag ON (shadow 1.0) → repeats the identical requests (PG-served)
//   3. deep-compares each pair under the documented equivalences
//      (lib/customers_shadow.ts): null≡absent, contract defaults, timestamp
//      instants, id-keyed array order, signed photo URLs, known legacy
//      blob-only fields
//   4. write→read→delete round trip under flag ON (dual-write feeds the PG
//      read path within one request cycle), leaving no data behind
//   5. leaves the flag ON with shadow_sample_rate 0.2 (set LEAVE_FLAG=off to
//      restore the KV path instead)
//
// Also prints per-endpoint timings for both paths — the latency evidence.
// Server-side shadow_ok/shadow_diff log lines land in the staging function
// logs for the same requests (phase B runs with shadow 1.0).
//
// Credentials: same model as exercise-customers-dualwrite.mjs — the
// SUPABASE_ACCESS_TOKEN secret runs Management-API SQL, a random throwaway
// admin user is minted for the run and deleted afterwards.
//
// Usage:
//   STAGING_URL=… STAGING_REF=… STAGING_ANON_KEY=… SUPABASE_ACCESS_TOKEN=… \
//     node scripts/phase4/exercise-customers-readcutover.mjs

import { randomUUID } from 'node:crypto';

const URL_BASE = process.env.STAGING_URL;
const REF = process.env.STAGING_REF;
const ANON = process.env.STAGING_ANON_KEY;
const MGMT_TOKEN = process.env.SUPABASE_ACCESS_TOKEN;
if (!URL_BASE || !REF || !ANON || !MGMT_TOKEN) {
  console.error('missing STAGING_URL / STAGING_REF / STAGING_ANON_KEY / SUPABASE_ACCESS_TOKEN');
  process.exit(2);
}
if (REF === 'ruahrxkfgfyshuxykiay') {
  console.error('refusing to run against PRODUCTION');
  process.exit(2);
}

const EMAIL = `phase4.rc.${randomUUID()}@exercise.invalid`;
const PASSWORD = `${randomUUID()}-${randomUUID()}`;
const API = `${URL_BASE}/functions/v1/make-server-fc003b23/customers`;
const FLAG_KEY = 'system:feature_flag:read_from_pg:customers';

let TOKEN = '';
let EXERCISE_USER_ID = '';
let failures = 0;

const ok = (step, detail = '') => console.log(`OK   ${step}${detail ? ` — ${detail}` : ''}`);
const fail = (step, detail) => { failures += 1; console.error(`FAIL ${step} — ${detail}`); };

async function mgmtSql(query) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${MGMT_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  if (!res.ok) throw new Error(`management sql failed: ${res.status}`);
  return res.json();
}

async function createExerciseUser() {
  EXERCISE_USER_ID = randomUUID();
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
  ok('exercise user', 'random throwaway admin user created');
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
  TOKEN = (await res.json()).access_token;
  ok('sign-in', 'staff JWT acquired');
}

async function api(method, path, body) {
  const t0 = Date.now();
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const ms = Date.now() - t0;
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* non-JSON */ }
  return { status: res.status, json, ms };
}

async function setFlag(enabled, sampleRate) {
  await mgmtSql(`
    insert into kv_store_fc003b23 (key, value) values (
      '${FLAG_KEY}',
      jsonb_build_object(
        'id', 'read_from_pg:customers',
        'flag_key', 'read_from_pg:customers',
        'display_name', 'Read customers from Postgres',
        'is_enabled', ${enabled ? 'true' : 'false'},
        'shadow_sample_rate', ${sampleRate},
        'updated_at', to_char(now(), 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))
    ) on conflict (key) do update set value = excluded.value;
  `);
  ok('flag', `read_from_pg:customers is_enabled=${enabled} shadow_sample_rate=${sampleRate}`);
}

// ---- normalisation (mirror of lib/customers_shadow.ts equivalences) --------

const KNOWN_LEGACY = new Set([
  'address_line1', 'address_line2', 'address_city', 'address_postcode', 'address_country',
  'photo_updated_at', 'photo_updated_by', 'photoUrl',
  'primary_contact_name', 'payment_method', 'preferred_location_id', 'tags',
]);
const DEFAULTS = {
  status: 'active', vip: false, payment_hold: false,
  is_primary: false, is_emergency_contact: false,
  marketing_consent: false, sms_consent: false, email_consent: false,
  vaccination_status: 'unknown', daycare_enrolled: false, grooming_enrolled: false,
  transport_enrolled: false, overnights_enrolled: false, active: true,
  owner_added: false, verification_status: 'verified',
  document_type: 'other', file_size: 0, mime_type: 'application/octet-stream',
};
const ISO_TS = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:?\d{2})$/;

function stableStr(v) {
  if (v === null || typeof v !== 'object') return JSON.stringify(v) ?? 'undefined';
  if (Array.isArray(v)) return `[${v.map(stableStr).join(',')}]`;
  return `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${stableStr(v[k])}`).join(',')}}`;
}

function normalize(v) {
  if (typeof v === 'string') {
    if (ISO_TS.test(v)) return new Date(v).toISOString();
    if (v.includes('/storage/v1/object/sign/')) return '[signed-url]';
    return v;
  }
  if (Array.isArray(v)) {
    return v.map(normalize)
      .map((el) => ({ key: el && typeof el === 'object' && typeof el.id === 'string' ? `id:${el.id}` : `v:${stableStr(el)}`, el }))
      .sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0))
      .map((e) => e.el);
  }
  if (v && typeof v === 'object') {
    const out = {};
    for (const [k, val] of Object.entries(v)) {
      if (val === null || val === undefined) continue;
      if (KNOWN_LEGACY.has(k)) continue;
      if (k in DEFAULTS && DEFAULTS[k] === val) continue;
      out[k] = normalize(val);
    }
    return out;
  }
  return v;
}

function diffPaths(a, b, path = '', out = []) {
  if (out.length >= 12) return out;
  const na = a, nb = b;
  if (Array.isArray(na) && Array.isArray(nb)) {
    if (na.length !== nb.length) { out.push(`${path}: array(${na.length})≠array(${nb.length})`); return out; }
    na.forEach((el, i) => diffPaths(el, nb[i], `${path}.${i}`, out));
    return out;
  }
  const aObj = na && typeof na === 'object' && !Array.isArray(na);
  const bObj = nb && typeof nb === 'object' && !Array.isArray(nb);
  if (aObj && bObj) {
    for (const k of new Set([...Object.keys(na), ...Object.keys(nb)])) {
      diffPaths(na[k], nb[k], path ? `${path}.${k}` : k, out);
    }
    return out;
  }
  if (JSON.stringify(na) !== JSON.stringify(nb)) out.push(`${path}: ${typeof na}≠${typeof nb}`);
  return out;
}

// ---- the request matrix ----------------------------------------------------

const REQUESTS = [
  ['list.unpaginated', '/households'],
  ['list.page1', '/households?limit=10&offset=0'],
  ['list.page2', '/households?limit=10&offset=10'],
  ['list.lastpage', '/households?limit=50&offset=290'],
  ['list.search.pct', `/households?search=${encodeURIComponent('100%')}`],
  ['list.search.underscore', `/households?search=${encodeURIComponent('_score')}`],
  ['list.search.name', '/households?search=anders'],
  ['list.search.contact', '/households?search=foster'],
  ['list.search.pet', '/households?search=ziggy'],
  ['list.filter.status', '/households?status=inactive'],
  ['list.filter.vip', '/households?vip=true'],
  ['list.filter.hold', '/households?payment_hold=true'],
  ['list.filter.location', '/households?location_id=loc-main'],
  ['list.sort.pc.desc', '/households?sort=primary_contact&dir=desc&limit=20&offset=0'],
  ['list.combined', '/households?search=family&status=active&sort=name&dir=desc&limit=15&offset=5'],
  ['lookup.name', '/lookup?name=pemberton'],
  ['lookup.email', `/lookup?email=${encodeURIComponent('carla.foster2@example.com')}`],
  ['lookup.phone', `/lookup?phone=${encodeURIComponent('07100001834')}`],
];

async function captureMatrix(label) {
  const out = new Map();
  // Detail endpoints need ids — derive from the list itself so the matrix is
  // self-contained and identical in both phases (same ids both times).
  const list = await api('GET', '/households?limit=5&offset=0');
  if (list.status !== 200) throw new Error(`${label}: seed list failed ${list.status}`);
  const first = list.json.households[0];
  const withPets = list.json.households.find((h) => h.pets_count > 0) ?? first;
  const detail = await api('GET', `/households/${withPets.id}`);
  const petId = detail.json?.pets?.[0]?.id;

  const matrix = [
    ...REQUESTS,
    ['detail.household', `/households/${withPets.id}`],
    ['detail.contacts', `/households/${withPets.id}/contacts`],
    ['detail.pets', `/households/${withPets.id}/pets`],
    ...(petId ? [['detail.pet', `/pets/${petId}`]] : []),
    ['detail.404', '/households/hh-does-not-exist'],
  ];

  for (const [name, path] of matrix) {
    const res = await api('GET', path);
    out.set(name, { path, status: res.status, body: res.json, ms: res.ms });
  }
  return out;
}

async function main() {
  await createExerciseUser();
  await signIn();

  // ---- phase A: flag OFF (KV-served baseline) ------------------------------
  await setFlag(false, 0);
  const kvRuns = await captureMatrix('phase A');

  // ---- phase B: flag ON, shadow 1.0 (PG-served + server-side shadow) -------
  await setFlag(true, 1.0);
  const pgRuns = await captureMatrix('phase B');

  // ---- compare -------------------------------------------------------------
  console.log('\n== KV-served vs PG-served response parity ==');
  for (const [name, kvRun] of kvRuns) {
    const pgRun = pgRuns.get(name);
    if (!pgRun) { fail(name, 'missing PG run'); continue; }
    if (kvRun.status !== pgRun.status) {
      fail(name, `status kv=${kvRun.status} pg=${pgRun.status}`);
      continue;
    }
    const diffs = diffPaths(normalize(kvRun.body), normalize(pgRun.body));
    if (diffs.length > 0) fail(name, diffs.join(' | '));
    else ok(name.padEnd(24), `status=${kvRun.status} kv=${String(kvRun.ms).padStart(4)}ms pg=${String(pgRun.ms).padStart(4)}ms`);
  }

  // ---- write→read→delete round trip under flag ON --------------------------
  console.log('\n== write→read round trip with PG reads ON ==');
  const created = await api('POST', '/households', { name: `RC Exercise ${randomUUID().slice(0, 8)}` });
  if (created.status !== 200) fail('roundtrip.create', `status ${created.status}`);
  else {
    const readBack = await api('GET', `/households/${created.json.id}`);
    if (readBack.status === 200 && readBack.json.name === created.json.name) {
      ok('roundtrip', 'household created (dual-write) is immediately readable from PG');
    } else {
      fail('roundtrip.read', `status ${readBack.status}`);
    }
    const del = await api('DELETE', `/households/${created.json.id}`);
    if (del.status !== 200) fail('roundtrip.delete', `status ${del.status}`);
    else {
      const gone = await api('GET', `/households/${created.json.id}`);
      if (gone.status === 404) ok('roundtrip.cleanup', 'deleted household 404s on the PG path');
      else fail('roundtrip.cleanup', `expected 404, got ${gone.status}`);
    }
  }

  // ---- leave the flag in the requested end state ---------------------------
  if ((process.env.LEAVE_FLAG ?? 'on') === 'off') {
    await setFlag(false, 0.2);
  } else {
    await setFlag(true, 0.2);
  }

  console.log(failures === 0
    ? '\nALL CHECKS PASSED — read cutover is response-identical on staging.'
    : `\n${failures} FAILURE(S)`);
  process.exitCode = failures === 0 ? 0 : 1;
}

main()
  .catch((err) => {
    console.error('fatal:', err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(deleteExerciseUser);
