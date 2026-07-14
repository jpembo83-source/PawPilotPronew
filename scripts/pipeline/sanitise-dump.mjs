#!/usr/bin/env node
// PawPilotPro — PII sanitiser for prod->staging data replicas.
//
// Reads a Postgres *data-only* dump on stdin (COPY text format, as produced by
// `supabase db dump --data-only`) and writes a PII-free copy to stdout. Raw
// prod PII MUST NEVER be committed or loaded into staging — this is the gate
// that guarantees it (see deploy-workflow/RUNBOOK.md).
//
// Design:
//   * Line-oriented. COPY text format escapes tabs/newlines (\t, \n) so every
//     row is exactly one physical line and columns split cleanly on real tabs —
//     no fragile SQL parsing.
//   * Explicit allow/deny FIELD LIST per table (TABLE_RULES below). Every column
//     is classified: `rules` = scrubbed, `safe` = reviewed non-PII pass-through.
//   * FAIL CLOSED: any column whose name looks like PII but is neither ruled nor
//     marked safe aborts the run (a new PII column can't leak silently).
//   * Tables not in the allow-list are DROPPED from the output (and logged), so
//     e.g. spatial_ref_sys or any future table never carries data into staging.
//   * kv_store JSONB values are deep-walked and PII keys scrubbed recursively.
//
// Usage:  node sanitise-dump.mjs < prod-data.raw.sql > prod-data.sanitised.sql
//         node sanitise-dump.mjs --in raw.sql --out clean.sql

import { readFileSync, writeFileSync, createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';

// ------------------------------ fake generators ------------------------------
// Deterministic within a run (counters advance in dump order). No randomness so
// output is reproducible and reviewable.
const counters = {};
const seq = (k) => (counters[k] = (counters[k] || 0) + 1);

const FAKE = {
  email: (id) => `user+${id ?? seq('email')}@example.test`,
  phone: () => '+10000000000',
  chip: () => '000000000000000',
  redact: () => 'REDACTED',
  firstName: () => 'Test',
  lastName: () => `User ${seq('lastName')}`,
  petName: () => `Pet ${seq('pet')}`,
  vetName: () => `Test Vet ${seq('vet')}`,
  staffName: () => `Test Staff ${seq('staff')}`,
  householdName: () => `Test Household ${seq('household')}`,
  contactName: () => `Contact ${seq('contact')}`,
  // A single-line address string and a structured address JSON both get faked.
  addressJson: () =>
    JSON.stringify({ line1: 'REDACTED', line2: null, city: 'REDACTED', postcode: 'RE0 0ACT', country: 'GB' }),
};

// Rule = (value, ctx) => newValue. NULL stays NULL unless the column is NOT NULL
// (those rules use `Not` variants that always return a value).
const R = {
  redact: (v) => (v === null ? null : FAKE.redact()),
  redactNotNull: () => FAKE.redact(),
  nullify: () => null,
  phone: (v) => (v === null ? null : FAKE.phone()),
  chip: (v) => (v === null ? null : FAKE.chip()),
  emailById: (v, ctx) => (v === null ? null : FAKE.email(ctx.vals[ctx.idx.id])),
  firstName: (v) => (v === null ? null : FAKE.firstName()),
  lastNameNotNull: () => FAKE.lastName(),
  petName: (v) => (v === null ? null : FAKE.petName()),
  petNameNotNull: () => FAKE.petName(),
  vetName: (v) => (v === null ? null : FAKE.vetName()),
  staffName: (v) => (v === null ? null : FAKE.staffName()),
  householdNameNotNull: () => FAKE.householdName(),
  contactLastNameNotNull: () => FAKE.contactName(),
  addressJson: (v) => (v === null ? null : FAKE.addressJson()),
};

// ------------------------------ allow/deny list ------------------------------
// `rules`: columns that MUST be scrubbed (the deny list — PII).
// `safe` : columns that match the PII name pattern but are reviewed non-PII.
// Any header column matching PII_PATTERN and in neither set aborts the run.
const TABLE_RULES = {
  'public.households': {
    rules: {
      name: R.householdNameNotNull,
      hold_reason: R.redact,
      hold_notes: R.redact,
      internal_notes: R.redact,
      address: R.addressJson,
    },
    safe: [],
  },
  'public.contacts': {
    rules: {
      first_name: R.firstName,
      last_name: R.contactLastNameNotNull,
      email: R.emailById,
      phone: R.phone,
    },
    safe: ['email_consent'], // boolean consent flag, not an address
  },
  'public.pets': {
    rules: {
      name: R.petNameNotNull,
      photo_url: R.nullify,
      microchip: R.chip,
      address: R.addressJson,
      behaviour_notes: R.redact,
      medical_notes: R.redact,
      feeding_instructions: R.redact,
      allergies: R.redact,
      vet_name: R.vetName,
      vet_phone: R.phone,
      vet_address: R.redact,
    },
    safe: [],
  },
  'public.customer_documents': {
    rules: {
      name: R.redact,
      file_name: R.redact,
      storage_path: R.redact,
      notes: R.redact,
    },
    safe: [],
  },
  'public.household_notes': {
    rules: {
      title: R.redact,
      content: R.redactNotNull, // NOT NULL
    },
    safe: [],
  },
  'public.note_pets': { rules: {}, safe: [] }, // ids only, no PII
  'public.household_flags': {
    rules: { reason: R.redact },
    safe: [],
  },
  'public.customer_activities': {
    rules: {
      title: R.redactNotNull, // NOT NULL
      description: R.redact,
      created_by_name: R.staffName,
    },
    safe: [],
  },
  'public.pet_updates': {
    rules: {
      pet_name: R.petName,
      text: R.redact,
      caption: R.redact,
      rejected_reason: R.redact,
      created_by_name: R.staffName,
      reviewed_by_name: R.staffName,
      photo_path: R.nullify,
    },
    safe: [],
  },
  // kv_store: `value` JSONB is deep-scrubbed (see KV_TABLE); key/created_at pass.
  'public.kv_store_fc003b23': { rules: {}, safe: [], kv: true },
};

const KV_TABLE = 'public.kv_store_fc003b23';

// Column-name pattern for the fail-closed guard. Matches anything that *looks*
// like it could hold personal data; the per-table lists then have to account
// for each hit (scrub it or mark it safe).
const PII_PATTERN =
  /(email|phone|mobile|_name$|^name$|first_name|last_name|surname|note|address|reason|content|description|caption|allerg|medical|behaviou?r|feeding|microchip|vet_|photo|storage_path|file_name|title)/i;

// ------------------------------ JSONB scrubbing ------------------------------
// Recursively scrub PII-bearing keys inside kv_store customer values.
function scrubJsonKey(key) {
  const k = key.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (/(^|_)?email/.test(k) || k.includes('email')) return 'email';
  if (k.includes('phone') || k.includes('mobile') || k === 'tel' || k.includes('fax')) return 'phone';
  if (k.includes('firstname') || k === 'fname') return 'firstName';
  if (k.includes('lastname') || k.includes('surname') || k === 'lname') return 'lastName';
  if (k.includes('microchip') || k === 'chip') return 'chip';
  if (
    k.includes('note') ||
    k.includes('comment') ||
    k.includes('description') ||
    k.includes('reason') ||
    k.includes('instruction') ||
    k.includes('allerg') ||
    k.includes('medical') ||
    k.includes('behaviour') ||
    k.includes('behavior')
  )
    return 'redact';
  if (
    k === 'address' ||
    k.includes('street') ||
    k.includes('postcode') ||
    k.includes('postalcode') ||
    k === 'zip' ||
    k === 'city' ||
    k.includes('addressline') ||
    k === 'line1' ||
    k === 'line2'
  )
    return 'address';
  // Generic name keys (ownerName, customerName, petName, vetName, fullName, ...)
  if (k === 'name' || k.endsWith('name') || k.includes('name')) return 'name';
  return null; // not a PII key -> recurse
}

function scrubJsonValue(category, value) {
  switch (category) {
    case 'email':
      return typeof value === 'string' ? FAKE.email(seq('kvemail')) : value;
    case 'phone':
      return typeof value === 'string' ? FAKE.phone() : value;
    case 'chip':
      return typeof value === 'string' ? FAKE.chip() : value;
    case 'firstName':
      return typeof value === 'string' ? FAKE.firstName() : value;
    case 'lastName':
      return typeof value === 'string' ? FAKE.lastName() : value;
    case 'redact':
      return typeof value === 'string' ? FAKE.redact() : value;
    case 'name':
      return typeof value === 'string' ? `Test ${seq('kvname')}` : value;
    case 'address':
      // structured address -> recurse so inner fields get scrubbed; string -> fake
      return typeof value === 'object' && value !== null ? scrubJson(value, true) : FAKE.redact();
    default:
      return value;
  }
}

function scrubJson(node, insideAddress = false) {
  if (Array.isArray(node)) return node.map((n) => scrubJson(n, insideAddress));
  if (node && typeof node === 'object') {
    const out = {};
    for (const [key, val] of Object.entries(node)) {
      const category = scrubJsonKey(key);
      if (category) out[key] = scrubJsonValue(category, val);
      else out[key] = scrubJson(val, insideAddress);
    }
    return out;
  }
  return node;
}

// ------------------------------ COPY codec -----------------------------------
function copyUnescape(field) {
  if (field === '\\N') return null;
  let out = '';
  for (let i = 0; i < field.length; i++) {
    const c = field[i];
    if (c === '\\') {
      const n = field[++i];
      out +=
        n === 'n' ? '\n' : n === 't' ? '\t' : n === 'r' ? '\r' : n === 'b' ? '\b' : n === 'f' ? '\f' : n === 'v' ? '\v' : n;
    } else out += c;
  }
  return out;
}

function copyEscape(val) {
  if (val === null || val === undefined) return '\\N';
  return String(val).replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/\t/g, '\\t');
}

// ------------------------------ driver ---------------------------------------
const COPY_RE = /^COPY\s+(?:"?public"?\.)?"?(\w+)"?\s*\(([^)]*)\)\s+FROM stdin;/;

function parseCols(raw) {
  return raw.split(',').map((c) => c.trim().replace(/^"|"$/g, ''));
}

function classifyTable(fqtn, cols) {
  const cfg = TABLE_RULES[fqtn];
  if (!cfg) return { drop: true };
  // Fail-closed guard: every PII-looking column must be ruled or marked safe.
  // Identifier columns (id / *_id) are opaque keys, never free-text PII, and are
  // exempt from the name-pattern guard (e.g. note_id matches /note/ but is an FK).
  const unclassified = cols.filter(
    (c) => PII_PATTERN.test(c) && !/(^id$|_id$)/.test(c) && !(c in cfg.rules) && !cfg.safe.includes(c),
  );
  if (unclassified.length) {
    throw new Error(
      `SANITISER ABORT: ${fqtn} has unclassified PII-looking column(s): ${unclassified.join(', ')}. ` +
        `Add a rule or add it to \`safe\` in scripts/pipeline/sanitise-dump.mjs before replicating.`,
    );
  }
  const idx = {};
  cols.forEach((c, i) => (idx[c] = i));
  return { drop: false, cfg, idx, cols };
}

async function main() {
  const args = process.argv.slice(2);
  const inArg = args.includes('--in') ? args[args.indexOf('--in') + 1] : null;
  const outArg = args.includes('--out') ? args[args.indexOf('--out') + 1] : null;

  const input = inArg ? createReadStream(inArg, 'utf8') : process.stdin;
  const rl = createInterface({ input, crlfDelay: Infinity });

  const outLines = [];
  const emit = (l) => outLines.push(l);

  const stats = { tables: {}, dropped: [] };
  let mode = 'pass'; // pass | copy | skip
  let cur = null; // { fqtn, cfg, idx, cols }

  for await (const line of rl) {
    if (mode === 'pass') {
      // This scrubber only understands COPY (text) format. An INSERT-format dump
      // would slip PII straight through — refuse it rather than leak.
      if (/^INSERT INTO\s+(?:"?public"?\.)?/i.test(line)) {
        throw new Error(
          'SANITISER ABORT: dump is INSERT format, only COPY (text) is supported. ' +
            'Dump with `supabase db dump --data-only` (COPY is pg_dump default; do not pass --inserts).',
        );
      }
      const m = COPY_RE.exec(line);
      if (m) {
        const fqtn = `public.${m[1]}`;
        const cols = parseCols(m[2]);
        const info = classifyTable(fqtn, cols);
        if (info.drop) {
          mode = 'skip';
          stats.dropped.push(fqtn);
          continue; // do not emit the COPY header for dropped tables
        }
        cur = { fqtn, ...info };
        stats.tables[fqtn] = 0;
        mode = 'copy';
        emit(line);
      } else {
        emit(line);
      }
      continue;
    }

    if (mode === 'skip') {
      if (line === '\\.') mode = 'pass';
      continue; // swallow rows of a dropped table
    }

    // mode === 'copy'
    if (line === '\\.') {
      emit(line);
      mode = 'pass';
      cur = null;
      continue;
    }
    const vals = line.split('\t').map(copyUnescape);
    if (cur.cfg.kv) {
      // scrub JSONB `value`; also strip any email-looking substrings from key
      const vIdx = cur.idx.value;
      if (vIdx != null && vals[vIdx] != null) {
        try {
          vals[vIdx] = JSON.stringify(scrubJson(JSON.parse(vals[vIdx])));
        } catch {
          // non-JSON value — redact defensively rather than risk leaking PII
          vals[vIdx] = '"REDACTED"';
        }
      }
      const kIdx = cur.idx.key;
      if (kIdx != null && typeof vals[kIdx] === 'string') {
        vals[kIdx] = vals[kIdx].replace(/[\w.+-]+@[\w.-]+\.\w+/g, `user+${seq('kvkey')}@example.test`);
      }
    } else {
      for (const [col, rule] of Object.entries(cur.cfg.rules)) {
        const i = cur.idx[col];
        if (i == null) continue; // column absent in this dump's header
        vals[i] = rule(vals[i], { vals, idx: cur.idx });
      }
    }
    stats.tables[cur.fqtn]++;
    emit(vals.map(copyEscape).join('\t'));
  }

  if (mode !== 'pass') throw new Error(`SANITISER ABORT: dump ended mid-COPY (mode=${mode}). Truncated dump?`);

  // ---- post-scrub verification: no un-faked emails survive in the output ----
  const text = outLines.join('\n') + '\n';
  const leaks = (text.match(/[\w.+-]+@[\w.-]+\.\w+/g) || []).filter((e) => !e.endsWith('@example.test'));
  if (leaks.length) {
    throw new Error(
      `SANITISER ABORT: ${leaks.length} email address(es) not rewritten to @example.test (e.g. ${leaks[0]}). Refusing to emit.`,
    );
  }

  if (outArg) writeFileSync(outArg, text);
  else process.stdout.write(text);

  // report to stderr so stdout stays a clean dump
  const report = ['Sanitiser report:'];
  for (const [t, n] of Object.entries(stats.tables)) report.push(`  kept ${t}: ${n} rows`);
  if (stats.dropped.length) report.push(`  DROPPED (not in allow-list): ${stats.dropped.join(', ')}`);
  process.stderr.write(report.join('\n') + '\n');
}

main().catch((e) => {
  process.stderr.write(String(e.message || e) + '\n');
  process.exit(1);
});
