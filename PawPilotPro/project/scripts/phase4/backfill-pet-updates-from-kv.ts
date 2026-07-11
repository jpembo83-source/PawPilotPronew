/**
 * Phase 4 backfill — legacy KV photo/note moments → public.pet_updates.
 *
 * Why this script exists:
 *   The photo pipeline moved photo/note moments to the Postgres pet_updates
 *   table (migrations/20260711120000_phase4_pet_updates_stage0.sql). Moments
 *   shared BEFORE that change live only in the KV family
 *   `pet_update:{tenantId}:{date}:{petId}:{id}` — the merged day feed still
 *   reads them (mergeDayFeeds), but the all-time gallery queries Postgres
 *   only. This backfill copies the legacy moments across so the gallery is
 *   complete from day one.
 *
 * Scope:
 *   - ONLY `photo` and `note` moments are copied. checked_in / checked_out
 *     KV events are deliberately left alone — they belong to the daycare
 *     entity migration and the day feed reads them from KV by design.
 *   - Rows insert with status = 'approved': they pre-date the moderation
 *     gate and were already visible to owners (effectiveStatus() treats
 *     status-less legacy rows as approved for exactly this reason).
 *   - legacy_kv_key records the source KV key for parity auditing, and is
 *     the handle for undo (delete where legacy_kv_key is not null — the KV
 *     rows are never modified or deleted).
 *
 * Idempotency:
 *   Inserts use ON CONFLICT (id) DO NOTHING (upsert with ignoreDuplicates),
 *   so re-runs are safe and never double-insert.
 *
 * Usage:
 *   SUPABASE_URL=https://<project>.supabase.co \
 *   SUPABASE_SERVICE_ROLE_KEY=eyJ... \
 *   npx ts-node scripts/phase4/backfill-pet-updates-from-kv.ts [--dry-run] [--tenant <tenantId>]
 *
 * Safety:
 *   - Requires SUPABASE_SERVICE_ROLE_KEY. Never run from a client environment.
 *   - Read-only on KV; additive-only on pet_updates.
 *   - Exits non-zero on any error or if any row fails to map.
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DRY_RUN = process.argv.includes('--dry-run');
const tenantFlag = process.argv.indexOf('--tenant');
const TENANT_FILTER = tenantFlag !== -1 ? process.argv[tenantFlag + 1] : undefined;

const KV_TABLE = 'kv_store_fc003b23';
const PET_UPDATES_TABLE = 'pet_updates';
const MOMENT_TYPES = new Set(['photo', 'note']);
const PAGE_SIZE = 500;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error(
    '[backfill-pet-updates] SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required. ' +
    'Refusing to run without the service-role client — there is no client-key fallback.'
  );
  process.exit(1);
}

/** Legacy KV moment record (see server/lib/pet_updates.ts PetUpdate). */
interface KvMoment {
  id?: string;
  tenant_id?: string;
  pet_id?: string;
  pet_name?: string;
  date?: string;
  type?: string;
  text?: string;
  photo_path?: string;
  booking_id?: string;
  household_id?: string;
  created_by_id?: string;
  created_by_name?: string;
  created_at?: string;
  status?: string;
}

interface PetUpdateInsert {
  id: string;
  tenant_id: string;
  pet_id: string;
  pet_name: string | null;
  household_id: string | null;
  booking_id: string | null;
  date: string;
  type: string;
  text: string | null;
  caption: null;
  photo_path: string | null;
  status: string;
  rejected_reason: null;
  created_by_id: string;
  created_by_name: string | null;
  reviewed_by_id: null;
  reviewed_by_name: null;
  reviewed_at: null;
  created_at: string;
  legacy_kv_key: string;
}

function toRow(key: string, value: KvMoment): PetUpdateInsert | null {
  if (!value.id || !value.tenant_id || !value.pet_id || !value.date || !value.type || !value.created_at) {
    return null;
  }
  return {
    id: value.id,
    tenant_id: value.tenant_id,
    pet_id: value.pet_id,
    pet_name: value.pet_name ?? null,
    household_id: value.household_id ?? null,
    booking_id: value.booking_id ?? null,
    date: value.date,
    type: value.type,
    text: value.text ?? null,
    caption: null,
    photo_path: value.photo_path ?? null,
    // Pre-gate moments were published immediately: approved. A status is
    // preserved if one somehow exists (it should not, in the KV family).
    status: value.status ?? 'approved',
    rejected_reason: null,
    created_by_id: value.created_by_id ?? 'legacy-kv-backfill',
    created_by_name: value.created_by_name ?? null,
    reviewed_by_id: null,
    reviewed_by_name: null,
    reviewed_at: null,
    created_at: value.created_at,
    legacy_kv_key: key,
  };
}

async function main(): Promise<void> {
  const admin = createClient(SUPABASE_URL!, SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const prefix = TENANT_FILTER ? `pet_update:${TENANT_FILTER}:` : 'pet_update:';
  console.log(`[backfill-pet-updates] scanning KV prefix "${prefix}"${DRY_RUN ? ' (dry run)' : ''}`);

  // Page through the KV family (ordered by key so pagination is stable).
  const rows: PetUpdateInsert[] = [];
  let kvScanned = 0;
  let malformed = 0;
  let from = 0;
  for (;;) {
    const { data, error } = await admin
      .from(KV_TABLE)
      .select('key,value')
      .like('key', `${prefix}%`)
      .order('key', { ascending: true })
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(`KV scan failed: ${error.message}`);
    const page = (data ?? []) as Array<{ key: string; value: KvMoment }>;
    kvScanned += page.length;

    for (const entry of page) {
      const type = entry.value?.type;
      if (!type || !MOMENT_TYPES.has(type)) continue; // checked_in/out stay in KV
      const row = toRow(entry.key, entry.value);
      if (!row) {
        malformed += 1;
        console.error(`[backfill-pet-updates] MALFORMED KV moment at key ${entry.key} — skipping`);
        continue;
      }
      rows.push(row);
    }

    if (page.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  console.log(`[backfill-pet-updates] KV rows scanned: ${kvScanned}`);
  console.log(`[backfill-pet-updates] KV moments found (photo/note): ${rows.length}`);

  if (DRY_RUN) {
    for (const row of rows) {
      console.log(`  would insert ${row.id} (${row.type}, ${row.date}, pet ${row.pet_id})`);
    }
    console.log('[backfill-pet-updates] dry run — nothing written.');
    if (malformed > 0) process.exit(1);
    return;
  }

  let inserted = 0;
  if (rows.length > 0) {
    // ON CONFLICT (id) DO NOTHING: ignoreDuplicates on the id PK. Returned
    // rows are the ones actually inserted, so re-runs report inserted: 0.
    const { data, error } = await admin
      .from(PET_UPDATES_TABLE)
      .upsert(rows, { onConflict: 'id', ignoreDuplicates: true })
      .select('id');
    if (error) throw new Error(`pet_updates insert failed: ${error.message}`);
    inserted = (data ?? []).length;
  }

  console.log(`[backfill-pet-updates] inserted: ${inserted}`);
  console.log(`[backfill-pet-updates] skipped (already present): ${rows.length - inserted}`);
  if (malformed > 0) {
    console.error(`[backfill-pet-updates] malformed rows skipped: ${malformed}`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('[backfill-pet-updates] FAILED:', err instanceof Error ? err.message : err);
  process.exit(1);
});
