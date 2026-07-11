/**
 * One-off data migration: pet photo public URLs → storage paths (Part A4 of
 * the private-pet-photos security fix).
 *
 * Why this script exists:
 *   Pet records in the KV table historically stored the PUBLIC URL of the
 *   make-fc003b23-pet-photos bucket in `photo_url` (sometimes duplicated in
 *   camelCase `photoUrl`). The bucket is being flipped private: the server
 *   now stores the STORAGE OBJECT PATH in `photo_path` and mints short-lived
 *   signed URLs at read time (supabase/functions/server/lib/pet_photos.ts).
 *   This script rewrites the existing records into the new form.
 *
 * What it does, per pet record (key shape customer:{tenant}:pet:{hh}:{id}):
 *   - photo_url/photoUrl referencing the pet-photos bucket (public or signed
 *     form, with or without ?v= cache-buster) → photo_path = object path,
 *     photo_url = null, photoUrl removed.
 *   - photo_path already set → legacy fields are cleared if still present,
 *     otherwise the record is skipped (idempotent — safe to re-run).
 *   - external http(s) URLs (not this bucket) → left untouched, reported.
 *
 * Usage:
 *   SUPABASE_URL=https://<project>.supabase.co \
 *   SUPABASE_SERVICE_ROLE_KEY=eyJ... \
 *   npx ts-node scripts/phase-security/migrate-pet-photo-paths.ts [--dry-run]
 *
 * Safety:
 *   - Requires SUPABASE_SERVICE_ROLE_KEY. Never run from a client environment.
 *   - Rehearse on staging first; run against prod only at step C3c of the
 *     rollout (after the signed-URL read path is deployed, BEFORE the bucket
 *     flips private).
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DRY_RUN = process.argv.includes('--dry-run');

const KV_TABLE = 'kv_store_fc003b23';
const PET_PHOTOS_BUCKET = 'make-fc003b23-pet-photos';

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error(
    '[migrate-pet-photo-paths] SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required. ' +
    'Refusing to run without the service-role client — there is no client-key fallback.'
  );
  process.exit(1);
}

/** Mirrors petPhotoPathFromStored in
 *  supabase/functions/server/lib/pet_photos.ts (Deno lib — not importable
 *  from a Node script, so the logic is duplicated here; keep in sync). */
function petPhotoPathFromStored(stored: unknown): string | null {
  if (typeof stored !== 'string') return null;
  const value = stored.trim().split('?')[0];
  if (!value) return null;
  if (!/^https?:\/\//i.test(value)) return value; // already an object path
  for (const marker of [
    `/storage/v1/object/public/${PET_PHOTOS_BUCKET}/`,
    `/storage/v1/object/sign/${PET_PHOTOS_BUCKET}/`,
  ]) {
    const i = value.indexOf(marker);
    if (i !== -1) return decodeURIComponent(value.slice(i + marker.length));
  }
  return null; // http(s) URL that does not reference this bucket
}

const isPetRecordKey = (key: string): boolean => key.split(':')[2] === 'pet';

interface KvRow {
  key: string;
  value: Record<string, unknown>;
}

async function main() {
  const supabase = createClient(SUPABASE_URL!, SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });

  const counts = {
    scanned: 0,
    alreadyMigrated: 0,
    noPhoto: 0,
    rewritten: 0,
    externalUrlLeft: 0,
    failed: 0,
  };

  const PAGE = 1000;
  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await supabase
      .from(KV_TABLE)
      .select('key, value')
      .like('key', 'customer:%')
      .order('key')
      .range(offset, offset + PAGE - 1);
    if (error) {
      console.error('[migrate-pet-photo-paths] page read failed:', error.message);
      process.exit(1);
    }
    const rows = ((data ?? []) as KvRow[]).filter((r) => isPetRecordKey(r.key));

    for (const row of rows) {
      counts.scanned += 1;
      const pet = row.value;
      const legacy = pet.photo_url ?? pet.photoUrl;
      const hasLegacy = typeof legacy === 'string' && legacy.trim() !== '';

      if (!hasLegacy) {
        if (typeof pet.photo_path === 'string' && pet.photo_path) counts.alreadyMigrated += 1;
        else counts.noPhoto += 1;
        continue;
      }

      const path = typeof pet.photo_path === 'string' && pet.photo_path
        ? pet.photo_path // photo_path wins; just clear the legacy duplicates
        : petPhotoPathFromStored(legacy);

      if (!path) {
        // External URL (not our bucket) — leave the record alone.
        counts.externalUrlLeft += 1;
        console.log(`  [external] ${row.key} keeps photo_url (not a bucket reference)`);
        continue;
      }

      const next: Record<string, unknown> = {
        ...pet,
        photo_path: path,
        photo_url: null,
        updated_at: new Date().toISOString(),
      };
      delete next.photoUrl;

      console.log(`  [rewrite]  ${row.key}\n             -> photo_path: ${path}${DRY_RUN ? '  (dry-run, not written)' : ''}`);
      if (!DRY_RUN) {
        const { error: writeError } = await supabase
          .from(KV_TABLE)
          .upsert({ key: row.key, value: next });
        if (writeError) {
          counts.failed += 1;
          console.error(`  [FAILED]   ${row.key}: ${writeError.message}`);
          continue;
        }
      }
      counts.rewritten += 1;
    }

    if ((data ?? []).length < PAGE) break;
  }

  console.log(
    `\n[migrate-pet-photo-paths] done${DRY_RUN ? ' (dry-run)' : ''}: ` +
    `${counts.scanned} pet records scanned, ${counts.rewritten} rewritten, ` +
    `${counts.alreadyMigrated} already migrated, ${counts.noPhoto} without photo, ` +
    `${counts.externalUrlLeft} external URLs left untouched, ${counts.failed} failed.`
  );
  if (counts.failed > 0) process.exit(1);
}

main().catch((e) => {
  console.error('[migrate-pet-photo-paths] fatal:', e);
  process.exit(1);
});
