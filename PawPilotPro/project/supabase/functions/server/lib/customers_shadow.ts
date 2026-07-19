// Phase 4 / Customers — STAGE 3 shadow-read comparison.
//
// Proves KV↔Postgres parity at the RESPONSE level: for a sample of read
// requests both paths run and their payloads are diffed. The comparison is
// semantic, not byte-level, under exactly these documented equivalences —
// every one of which is invisible to a JSON consumer like our frontend:
//
//   1. null ≡ absent — KV blobs omit optional fields, Postgres columns are
//      null; JSON consumers cannot tell the two apart via `??`/truthiness.
//   2. Contract defaults ≡ absent — a handful of pre-contract blobs omit
//      required-with-default fields (e.g. one pet without daycare_enrolled);
//      the contract says readers apply the default.
//   3. Timestamps compare as instants ('…Z' ≡ '…+00:00').
//   4. Arrays compare order-insensitively keyed by `id` — both paths sort on
//      the same keys, but tie order was never specified on the KV path
//      (getByPrefix has no ORDER BY).
//   5. Key order is not compared (JSON objects are unordered).
//
// Out-of-contract legacy fields (below) surface separately as `legacyDiffs`:
// fields old blobs carry that the ratified contract dropped (frozen schema,
// docs/PHASE4_DATA_MIGRATION.md §7.7). They are reported, not failures —
// prod carries exactly 2 contacts (address_*) and 2 pets (photo_updated_*).
//
// Pure module (no imports) so tests/unit can exercise it without Deno.

export interface ShadowDiff {
  path: string;
  kind: "missing_kv" | "missing_pg" | "value" | "length";
  kvType: string;
  pgType: string;
}

export interface ShadowDiffResult {
  diffs: ShadowDiff[];
  legacyDiffs: ShadowDiff[];
}

/** Blob-only fields the frozen contract dropped (measured against prod). */
const KNOWN_LEGACY_FIELDS = new Set([
  // contacts — pre-contract address capture (2 records in prod)
  "address_line1",
  "address_line2",
  "address_city",
  "address_postcode",
  "address_country",
  // pets — pre-contract photo audit stamps (2 records in prod)
  "photo_updated_at",
  "photo_updated_by",
  "photoUrl",
  // seed-era household extras (none in prod; present in seeded environments)
  "primary_contact_name",
  "payment_method",
  "preferred_location_id",
  "tags",
]);

/** Required-with-default contract fields: absent in a blob ≡ the default. */
const CONTRACT_DEFAULTS: Record<string, unknown> = {
  status: "active",
  vip: false,
  payment_hold: false,
  is_primary: false,
  is_emergency_contact: false,
  marketing_consent: false,
  sms_consent: false,
  email_consent: false,
  vaccination_status: "unknown",
  daycare_enrolled: false,
  grooming_enrolled: false,
  transport_enrolled: false,
  overnights_enrolled: false,
  active: true,
  owner_added: false,
  verification_status: "verified",
  document_type: "other",
  file_size: 0,
  mime_type: "application/octet-stream",
};

const ISO_TS_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:?\d{2})$/;

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "undefined";
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(",")}}`;
}

/** Apply equivalences 1–4 so that deep-equal ⇒ observably identical. */
export function normalizeForShadow(value: unknown): unknown {
  if (typeof value === "string" && ISO_TS_RE.test(value)) {
    const t = new Date(value).getTime();
    return Number.isNaN(t) ? value : new Date(t).toISOString();
  }
  if (Array.isArray(value)) {
    const normalized = value.map(normalizeForShadow);
    return normalized
      .map((el) => {
        const id = el !== null && typeof el === "object" && !Array.isArray(el)
          ? (el as Record<string, unknown>).id
          : undefined;
        return { key: typeof id === "string" ? `id:${id}` : `v:${stableStringify(el)}`, el };
      })
      .sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0))
      .map((entry) => entry.el);
  }
  if (value !== null && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (v === null || v === undefined) continue;
      if (k in CONTRACT_DEFAULTS && CONTRACT_DEFAULTS[k] === v) continue;
      out[k] = normalizeForShadow(v);
    }
    return out;
  }
  return value;
}

function typeOf(v: unknown): string {
  if (v === undefined) return "absent";
  if (v === null) return "null";
  if (Array.isArray(v)) return "array";
  return typeof v;
}

/** Last object-field segment of a path (skips array indices). */
function leafField(path: string): string {
  const segs = path.split(".").filter((s) => !/^\d+$/.test(s));
  return segs[segs.length - 1] ?? path;
}

function walk(kv: unknown, pg: unknown, path: string, out: ShadowDiff[]): void {
  if (kv === pg) return;
  const kvIsObj = kv !== null && typeof kv === "object";
  const pgIsObj = pg !== null && typeof pg === "object";
  if (Array.isArray(kv) && Array.isArray(pg)) {
    if (kv.length !== pg.length) {
      out.push({ path, kind: "length", kvType: `array(${kv.length})`, pgType: `array(${pg.length})` });
      return;
    }
    kv.forEach((el, i) => walk(el, pg[i], `${path}.${i}`, out));
    return;
  }
  if (kvIsObj && pgIsObj && !Array.isArray(kv) && !Array.isArray(pg)) {
    const kvObj = kv as Record<string, unknown>;
    const pgObj = pg as Record<string, unknown>;
    for (const k of new Set([...Object.keys(kvObj), ...Object.keys(pgObj)])) {
      const p = path ? `${path}.${k}` : k;
      if (!(k in pgObj)) out.push({ path: p, kind: "missing_pg", kvType: typeOf(kvObj[k]), pgType: "absent" });
      else if (!(k in kvObj)) out.push({ path: p, kind: "missing_kv", kvType: "absent", pgType: typeOf(pgObj[k]) });
      else walk(kvObj[k], pgObj[k], p, out);
    }
    return;
  }
  out.push({ path, kind: "value", kvType: typeOf(kv), pgType: typeOf(pg) });
}

/**
 * Diff the KV-path payload against the PG-path payload for the same request.
 * `diffs` must be empty for the cutover to be considered parity-clean;
 * `legacyDiffs` (known out-of-contract blob fields) are reported separately.
 */
export function diffShadow(kvPayload: unknown, pgPayload: unknown): ShadowDiffResult {
  const all: ShadowDiff[] = [];
  walk(normalizeForShadow(kvPayload), normalizeForShadow(pgPayload), "", all);
  const diffs: ShadowDiff[] = [];
  const legacyDiffs: ShadowDiff[] = [];
  for (const d of all) {
    (KNOWN_LEGACY_FIELDS.has(leafField(d.path)) ? legacyDiffs : diffs).push(d);
  }
  return { diffs, legacyDiffs };
}
