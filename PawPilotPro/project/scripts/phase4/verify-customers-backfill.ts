/**
 * Phase 4 / Customers — STAGE 1 parity verification.
 *
 * Proves the KV → Postgres backfill (20260702093000_phase4_customers_backfill.sql)
 * moved every `customer:*` key somewhere accountable, and that what it moved is
 * faithful to the source and valid against the frozen record contract
 * (shared/schemas/customers.ts).
 *
 * Checks, per entity family:
 *   1. RECONCILE   — KV key count === migrated rows (legacy_kv_key != null)
 *                    + quarantined keys. No key may vanish or double-count.
 *   2. CONTRACT    — every migrated row Zod-parses against its schema
 *                    (timestamps normalised to ISO-instant before parsing —
 *                    Postgres returns `+00:00`, the contract stores `Z`).
 *   3. FIDELITY    — field-level diff of every migrated row against its
 *                    source KV blob (via legacy_kv_key), on contract fields
 *                    only, honouring contract defaults, double-encoded
 *                    values, and repairs recorded in customers_backfill_fixups.
 *                    Also reported as a per-family checksum-match count.
 *   4. ORPHANS     — quarantine volume by reason. Reasons other than the
 *                    owner-sanctioned 'non_canonical_tenant' must stay under
 *                    --max-orphan-fraction (default 0.01) of the family's KV
 *                    keys — more suggests a mapping bug, not dirty data.
 *
 * Exits non-zero on any reconcile/contract/fidelity failure, or on orphan
 * excess (unless --expect pins exact per-family expectations, e.g. for the
 * branch-DB rehearsal fixture, where orphans are seeded deliberately).
 *
 * Usage (live — service role, ops only, never from a client):
 *   SUPABASE_URL=https://<ref>.supabase.co \
 *   SUPABASE_SERVICE_ROLE_KEY=eyJ… \
 *   npx ts-node scripts/phase4/verify-customers-backfill.ts
 *
 * Usage (offline — JSON dumps, e.g. exported from a branch DB):
 *   npx ts-node scripts/phase4/verify-customers-backfill.ts \
 *     --kv kv-dump.json --tables tables-dump.json \
 *     [--expect scripts/phase4/fixtures/customers-kv-fixture.expected.json]
 *
 *   kv-dump.json:     [{ "key": "customer:…", "value": … }, …]
 *   tables-dump.json: { "households": [row…], …, "households_orphaned": [row…], …,
 *                       "customers_backfill_fixups": [row…] }
 */

import { z } from "zod";
import {
  householdSchema,
  contactSchema,
  petSchema,
  customerDocumentSchema,
  householdNoteSchema,
  householdFlagSchema,
  customerActivitySchema,
} from "../../../shared/schemas/customers";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Json = string | number | boolean | null | Json[] | { [k: string]: Json };
type JsonObject = { [k: string]: Json };
type Row = Record<string, unknown>;

interface KvPair {
  key: string;
  value: Json;
}

/**
 * Structural stand-in for a Zod schema — zod v4's ZodObject generics don't
 * unify under a common ZodType<unknown> without widening, and all we need
 * here is safeParse.
 */
interface SchemaLike {
  safeParse(data: unknown): { success: boolean; error?: z.ZodError };
}

interface FamilySpec {
  /** entity family id, also used in reports */
  family: string;
  table: string;
  orphanTable: string;
  schema: SchemaLike | null; // null → link table (no record contract)
  /** classify: does this KV key belong to this family? */
  match: (segs: string[]) => boolean;
  /** contract fields whose value comes from the KEY, not the blob */
  keyFields: (segs: string[]) => Record<string, string>;
  /** contract defaults applied when the KV blob omits the field */
  defaults: Record<string, Json>;
  /** contract fields to compare (everything else in the blob is dropped) */
  fields: string[];
  /** fields compared as timestamps (instant equality) */
  tsFields: string[];
  /** fields compared as numbers */
  numFields: string[];
}

interface Failure {
  check: "reconcile" | "contract" | "fidelity" | "orphans" | "expect";
  family: string;
  detail: string;
}

// ---------------------------------------------------------------------------
// Family specs — MUST mirror the migration's classification and column maps.
// ---------------------------------------------------------------------------

const CANONICAL_TENANT = "demo-tenant-001";

const FAMILIES: FamilySpec[] = [
  {
    family: "household",
    table: "households",
    orphanTable: "households_orphaned",
    schema: householdSchema,
    match: (s) => s[2] === "household" && s.length === 4,
    keyFields: (s) => ({ id: s[3], tenant_id: s[1] }),
    defaults: { status: "active", vip: false, payment_hold: false },
    fields: [
      "id", "tenant_id", "external_id", "name", "status", "vip",
      "payment_hold", "hold_reason", "hold_notes", "primary_location_id",
      "primary_contact_id", "address", "internal_notes", "created_by",
      "created_at", "updated_at",
    ],
    tsFields: ["created_at", "updated_at"],
    numFields: [],
  },
  {
    family: "contact",
    table: "contacts",
    orphanTable: "contacts_orphaned",
    schema: contactSchema,
    match: (s) => s[2] === "contact" && s.length === 5,
    keyFields: (s) => ({ id: s[4], tenant_id: s[1], household_id: s[3] }),
    defaults: {
      is_primary: false, is_emergency_contact: false,
      marketing_consent: false, sms_consent: false, email_consent: false,
    },
    fields: [
      "id", "tenant_id", "household_id", "first_name", "last_name", "email",
      "phone", "preferred_contact_method", "is_primary",
      "is_emergency_contact", "emergency_contact_relationship",
      "marketing_consent", "sms_consent", "email_consent", "created_at",
      "updated_at",
    ],
    tsFields: ["created_at", "updated_at"],
    numFields: [],
  },
  {
    family: "pet",
    table: "pets",
    orphanTable: "pets_orphaned",
    schema: petSchema,
    match: (s) => s[2] === "pet" && s.length === 5,
    keyFields: (s) => ({ id: s[4], tenant_id: s[1], household_id: s[3] }),
    defaults: {
      vaccination_status: "unknown", daycare_enrolled: false,
      grooming_enrolled: false, transport_enrolled: false,
      overnights_enrolled: false, active: true, owner_added: false,
      verification_status: "verified",
    },
    fields: [
      "id", "tenant_id", "household_id", "name", "photo_url", "photo_path", "breed", "sex",
      "date_of_birth", "age_years", "microchip", "weight_kg", "colour",
      "address", "neutered_status", "behaviour_notes", "medical_notes",
      "feeding_instructions", "allergies", "vet_name", "vet_phone",
      "vet_address", "vaccination_status", "vaccination_expiry_date",
      "daycare_enrolled", "grooming_enrolled", "transport_enrolled",
      "overnights_enrolled", "active", "owner_added", "verification_status",
      "created_at", "updated_at",
    ],
    tsFields: ["created_at", "updated_at"],
    numFields: ["age_years", "weight_kg"],
  },
  {
    family: "document",
    table: "customer_documents",
    orphanTable: "customer_documents_orphaned",
    schema: customerDocumentSchema,
    match: (s) => s[2] === "document" && s.length === 5,
    keyFields: (s) => ({ id: s[4], tenant_id: s[1], household_id: s[3] }),
    defaults: {
      document_type: "other", file_size: 0,
      mime_type: "application/octet-stream",
    },
    fields: [
      "id", "tenant_id", "household_id", "pet_id", "document_type", "name",
      "file_name", "storage_path", "file_size", "mime_type", "expiry_date",
      "notes", "uploaded_by", "uploaded_at",
    ],
    tsFields: ["uploaded_at"],
    numFields: ["file_size"],
  },
  {
    family: "note",
    table: "household_notes",
    orphanTable: "household_notes_orphaned",
    schema: householdNoteSchema,
    match: (s) => s[2] === "household" && s.length === 6 && s[4] === "note",
    keyFields: (s) => ({ id: s[5], tenant_id: s[1], household_id: s[3] }),
    defaults: { visibility: "internal", is_pinned: false },
    fields: [
      "id", "tenant_id", "household_id", "title", "content", "category",
      "visibility", "is_pinned", "created_by", "created_at", "updated_at",
      "deleted_at",
    ],
    tsFields: ["created_at", "updated_at", "deleted_at"],
    numFields: [],
  },
  {
    family: "flag",
    table: "household_flags",
    orphanTable: "household_flags_orphaned",
    schema: householdFlagSchema,
    match: (s) => s[2] === "household" && s.length === 6 && s[4] === "flag",
    keyFields: (s) => ({ id: s[5], tenant_id: s[1], household_id: s[3] }),
    defaults: { is_active: true },
    fields: [
      "id", "tenant_id", "household_id", "pet_id", "flag_key", "severity",
      "is_active", "reason", "created_by", "created_at", "updated_at",
    ],
    tsFields: ["created_at", "updated_at"],
    numFields: [],
  },
  {
    family: "note_pet",
    table: "note_pets",
    orphanTable: "note_pets_orphaned",
    schema: null,
    match: (s) => s[2] === "note" && s.length === 6 && s[4] === "pet",
    keyFields: (s) => ({ note_id: s[3], pet_id: s[5] }),
    defaults: {},
    fields: ["note_id", "pet_id"],
    tsFields: [],
    numFields: [],
  },
  {
    family: "activity",
    table: "customer_activities",
    orphanTable: "customer_activities_orphaned",
    schema: customerActivitySchema,
    match: (s) => s[2] === "activity" && (s.length === 4 || s.length === 5),
    keyFields: (s) =>
      s.length === 5
        ? { id: s[4], tenant_id: s[1] }
        : { id: s[3], tenant_id: s[1] },
    defaults: {},
    fields: [
      "id", "tenant_id", "household_id", "pet_id", "activity_type", "title",
      "description", "occurred_at", "created_by", "created_by_name",
    ],
    tsFields: ["occurred_at"],
    numFields: [],
  },
];

const ORPHAN_TABLES = [
  ...FAMILIES.map((f) => f.orphanTable),
  "customer_keys_orphaned",
];

// ---------------------------------------------------------------------------
// CLI + data loading
// ---------------------------------------------------------------------------

function argValue(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function loadData(): Promise<{ kv: KvPair[]; tables: Record<string, Row[]> }> {
  const kvFile = argValue("--kv");
  const tablesFile = argValue("--tables");

  if (kvFile && tablesFile) {
    const { readFileSync } = await import("node:fs");
    const kv = JSON.parse(readFileSync(kvFile, "utf8")) as KvPair[];
    const tables = JSON.parse(readFileSync(tablesFile, "utf8")) as Record<string, Row[]>;
    return { kv, tables };
  }

  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    console.error(
      "[verify] Provide --kv/--tables dump files, or SUPABASE_URL and " +
        "SUPABASE_SERVICE_ROLE_KEY (service role required — this is an ops " +
        "script; there is no client-key fallback).",
    );
    process.exit(2);
  }

  const { createClient } = await import("@supabase/supabase-js");
  const supabase = createClient(url, serviceKey);

  const kv: KvPair[] = [];
  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from("kv_store_fc003b23")
      .select("key,value")
      .like("key", "customer:%")
      .order("key")
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`kv fetch failed: ${error.message}`);
    const page: KvPair[] = data ?? [];
    kv.push(...page);
    if (page.length < PAGE) break;
  }

  const tables: Record<string, Row[]> = {};
  const tableNames = [
    ...FAMILIES.map((f) => f.table),
    ...ORPHAN_TABLES,
    "customers_backfill_fixups",
  ];
  for (const t of tableNames) {
    const rows: Row[] = [];
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await supabase
        .from(t)
        .select("*")
        .range(from, from + PAGE - 1);
      if (error) throw new Error(`${t} fetch failed: ${error.message}`);
      const page: unknown[] = data ?? [];
      rows.push(...(page as Row[]));
      if (page.length < PAGE) break;
    }
    tables[t] = rows;
  }
  return { kv, tables };
}

// ---------------------------------------------------------------------------
// Normalisation helpers
// ---------------------------------------------------------------------------

/** Unwrap the legacy double-encoded shape (jsonb string containing JSON). */
function decodeKvValue(value: Json): JsonObject | null {
  let v: Json = value;
  if (typeof v === "string") {
    try {
      v = JSON.parse(v) as Json;
    } catch {
      return null;
    }
  }
  if (v === null || typeof v !== "object" || Array.isArray(v)) return null;
  return v;
}

/** ISO-instant normalisation: '…+00:00' (Postgres) ≡ '…Z' (contract). */
function toInstant(x: unknown): string | null {
  if (typeof x !== "string" || x === "") return null;
  const t = new Date(x).getTime();
  return Number.isNaN(t) ? null : new Date(t).toISOString();
}

function normalise(field: string, value: unknown, spec: FamilySpec): Json {
  if (value === undefined || value === null || value === "") return null;
  if (spec.tsFields.includes(field)) return toInstant(value);
  if (spec.numFields.includes(field)) {
    const n = Number(value);
    return Number.isNaN(n) ? null : n;
  }
  return value as Json;
}

/** Canonical JSON (sorted keys) → stable checksum input. */
function canonical(value: Json): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  const keys = Object.keys(value).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonical(value[k])}`).join(",")}}`;
}

// ---------------------------------------------------------------------------
// Verification
// ---------------------------------------------------------------------------

interface FamilyReport {
  family: string;
  kvKeys: number;
  migrated: number;
  quarantined: number;
  quarantineReasons: Record<string, number>;
  contractFailures: number;
  fidelityMismatches: number;
  checksumMatches: number;
}

async function main(): Promise<void> {
  const { kv, tables } = await loadData();
  const expectFile = argValue("--expect");
  const maxOrphanFraction = Number(argValue("--max-orphan-fraction") ?? "0.01");

  const failures: Failure[] = [];
  const reports: FamilyReport[] = [];

  // Repairs the migration recorded — excluded from fidelity diffing.
  const fixups = new Set(
    (tables["customers_backfill_fixups"] ?? []).map(
      (f) => `${String(f.legacy_kv_key)} ${String(f.column_name)}`,
    ),
  );

  const classified = new Map<string, KvPair[]>();
  let unclassified = 0;
  for (const pair of kv) {
    const segs = pair.key.split(":");
    const spec = FAMILIES.find((f) => f.match(segs));
    if (!spec) {
      unclassified += 1;
      continue;
    }
    const list = classified.get(spec.family) ?? [];
    list.push(pair);
    classified.set(spec.family, list);
  }

  for (const spec of FAMILIES) {
    const kvPairs = classified.get(spec.family) ?? [];
    const rows = tables[spec.table] ?? [];
    const orphans = tables[spec.orphanTable] ?? [];
    const migratedRows =
      spec.family === "note_pet"
        ? rows // link table has no legacy_kv_key; stage 1 rows are all backfill
        : rows.filter((r) => r.legacy_kv_key != null);

    const report: FamilyReport = {
      family: spec.family,
      kvKeys: kvPairs.length,
      migrated: migratedRows.length,
      quarantined: orphans.length,
      quarantineReasons: {},
      contractFailures: 0,
      fidelityMismatches: 0,
      checksumMatches: 0,
    };
    for (const o of orphans) {
      const reason = String(o.reason);
      report.quarantineReasons[reason] = (report.quarantineReasons[reason] ?? 0) + 1;
    }

    // 1. RECONCILE
    if (report.kvKeys !== report.migrated + report.quarantined) {
      failures.push({
        check: "reconcile",
        family: spec.family,
        detail:
          `KV keys ${report.kvKeys} !== migrated ${report.migrated} ` +
          `+ quarantined ${report.quarantined}`,
      });
    }

    // 2. CONTRACT — every migrated row parses against the frozen schema.
    if (spec.schema) {
      for (const row of migratedRows) {
        const candidate: Record<string, Json> = {};
        for (const f of spec.fields) {
          const v = spec.tsFields.includes(f) && row[f] != null
            ? toInstant(row[f])
            : (row[f] as Json);
          if (v !== null && v !== undefined) candidate[f] = v;
        }
        const parsed = spec.schema.safeParse(candidate);
        if (!parsed.success) {
          report.contractFailures += 1;
          const issues = parsed.error?.issues ?? [];
          failures.push({
            check: "contract",
            family: spec.family,
            detail: `row id=${String(row.id)}: ${issues
              .map((i) => `${i.path.join(".")}: ${i.message}`)
              .join("; ")}`,
          });
        }
      }
    }

    // 3. FIDELITY — migrated row vs source KV blob, contract fields only.
    const kvByKey = new Map(kvPairs.map((p) => [p.key, p]));
    for (const row of migratedRows) {
      const legacyKey =
        spec.family === "note_pet"
          ? `customer:${CANONICAL_TENANT}:note:${String(row.note_id)}:pet:${String(row.pet_id)}`
          : String(row.legacy_kv_key);
      const pair = kvByKey.get(legacyKey);
      if (!pair) {
        report.fidelityMismatches += 1;
        failures.push({
          check: "fidelity",
          family: spec.family,
          detail: `row id=${
            typeof row.id === "string" ? row.id : legacyKey
          } has legacy_kv_key not present in KV`,
        });
        continue;
      }
      const blob = decodeKvValue(pair.value);
      if (!blob) {
        report.fidelityMismatches += 1;
        failures.push({
          check: "fidelity",
          family: spec.family,
          detail: `${legacyKey}: KV value undecodable yet row was migrated`,
        });
        continue;
      }
      const keyFields = spec.keyFields(pair.key.split(":"));
      const diffs: string[] = [];
      const kvProjection: Record<string, Json> = {};
      const rowProjection: Record<string, Json> = {};
      for (const f of spec.fields) {
        if (fixups.has(`${legacyKey} ${f}`)) continue; // recorded repair
        const rowVal = normalise(f, row[f], spec);
        let kvVal: Json;
        if (f in keyFields) {
          kvVal = keyFields[f];
        } else {
          const raw = blob[f];
          kvVal =
            raw === undefined || raw === null || raw === ""
              ? spec.defaults[f] ?? null
              : normalise(f, raw, spec);
        }
        kvProjection[f] = kvVal;
        rowProjection[f] = rowVal;
        if (canonical(kvVal) !== canonical(rowVal)) {
          diffs.push(`${f}: kv=${canonical(kvVal)} row=${canonical(rowVal)}`);
        }
      }
      if (diffs.length > 0) {
        report.fidelityMismatches += 1;
        failures.push({
          check: "fidelity",
          family: spec.family,
          detail: `${legacyKey}: ${diffs.join(" | ")}`,
        });
      } else if (canonical(kvProjection) === canonical(rowProjection)) {
        report.checksumMatches += 1;
      }
    }

    // 4. ORPHANS — unsanctioned quarantine volume threshold (skipped under
    //    --expect: fixtures seed orphans deliberately and pin exact counts).
    if (!expectFile && report.kvKeys > 0) {
      const unsanctioned = orphans.filter(
        (o) => o.reason !== "non_canonical_tenant",
      ).length;
      if (unsanctioned / report.kvKeys > maxOrphanFraction) {
        failures.push({
          check: "orphans",
          family: spec.family,
          detail:
            `${unsanctioned}/${report.kvKeys} unsanctioned orphans exceeds ` +
            `${maxOrphanFraction * 100}% — suspect a mapping bug`,
        });
      }
    }

    reports.push(report);
  }

  // Unclassified keys reconcile against the catch-all quarantine.
  const unclassifiedQuarantined = (tables["customer_keys_orphaned"] ?? []).length;
  if (unclassified !== unclassifiedQuarantined) {
    failures.push({
      check: "reconcile",
      family: "unclassified",
      detail: `KV unclassified ${unclassified} !== customer_keys_orphaned ${unclassifiedQuarantined}`,
    });
  }

  // Optional exact expectations (rehearsal fixture pins these).
  if (expectFile) {
    const { readFileSync } = await import("node:fs");
    const expected = JSON.parse(readFileSync(expectFile, "utf8")) as Record<
      string,
      { migrated: number; quarantined: Record<string, number> }
    >;
    for (const [family, exp] of Object.entries(expected)) {
      if (family === "unclassified") {
        if (unclassifiedQuarantined !== Object.values(exp.quarantined).reduce((a, b) => a + b, 0)) {
          failures.push({
            check: "expect",
            family,
            detail: `expected ${JSON.stringify(exp.quarantined)}, got ${unclassifiedQuarantined}`,
          });
        }
        continue;
      }
      const rep = reports.find((r) => r.family === family);
      if (!rep) continue;
      if (rep.migrated !== exp.migrated) {
        failures.push({
          check: "expect",
          family,
          detail: `expected ${exp.migrated} migrated, got ${rep.migrated}`,
        });
      }
      const expQuarantine = Object.entries(exp.quarantined);
      const gotTotal = rep.quarantined;
      const expTotal = expQuarantine.reduce((a, [, n]) => a + n, 0);
      if (gotTotal !== expTotal) {
        failures.push({
          check: "expect",
          family,
          detail: `expected ${expTotal} quarantined, got ${gotTotal}`,
        });
      }
      for (const [reason, n] of expQuarantine) {
        if ((rep.quarantineReasons[reason] ?? 0) !== n) {
          failures.push({
            check: "expect",
            family,
            detail: `expected ${n} × '${reason}', got ${rep.quarantineReasons[reason] ?? 0}`,
          });
        }
      }
    }
  }

  // ---- report ----
  console.log("Phase 4 / Customers stage-1 backfill parity report");
  console.log("===================================================");
  for (const r of reports) {
    const reasons = Object.entries(r.quarantineReasons)
      .map(([k, n]) => `${k}×${n}`)
      .join(", ");
    console.log(
      `${r.family.padEnd(10)} kv=${String(r.kvKeys).padStart(4)}  ` +
        `migrated=${String(r.migrated).padStart(4)}  ` +
        `quarantined=${String(r.quarantined).padStart(3)}` +
        `${reasons ? `  [${reasons}]` : ""}  ` +
        `checksum-match=${r.checksumMatches}/${r.migrated}`,
    );
  }
  console.log(
    `unclassified kv=${unclassified}  quarantined=${unclassifiedQuarantined}`,
  );

  if (failures.length > 0) {
    console.error(`\n${failures.length} FAILURE(S):`);
    for (const f of failures) {
      console.error(`  [${f.check}] ${f.family}: ${f.detail}`);
    }
    process.exit(1);
  }
  console.log("\nAll checks passed: counts reconcile, rows are contract-valid and faithful.");
}

main().catch((err: unknown) => {
  console.error("[verify] fatal:", err instanceof Error ? err.message : err);
  process.exit(2);
});
