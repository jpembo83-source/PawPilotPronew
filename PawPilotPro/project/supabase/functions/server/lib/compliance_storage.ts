// Production ExportStorage backed by the PRIVATE compliance-exports bucket.
// Mirrors lib/pet_photos.ts: service-role client only (no anon fallback),
// bucket created private on first use, and downloads are served exclusively
// through short-lived signed URLs minted at request time.

import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js";
import {
  COMPLIANCE_EXPORTS_BUCKET,
  type ExportStorage,
} from "./compliance_export.ts";

let admin: SupabaseClient | null = null;
function getAdmin(): SupabaseClient {
  if (admin) return admin;
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) {
    // Fail fast — no anon-key fallback for storage access.
    throw new Error(
      "[compliance_storage] SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.",
    );
  }
  admin = createClient(url, key, { auth: { persistSession: false } });
  return admin;
}

let bucketEnsured = false;
async function ensureBucket(client: SupabaseClient): Promise<void> {
  if (bucketEnsured) return;
  const { data: buckets } = await client.storage.listBuckets();
  if (!buckets?.some((b) => b.name === COMPLIANCE_EXPORTS_BUCKET)) {
    // Private: exports contain full personal data sets. Never public.
    await client.storage.createBucket(COMPLIANCE_EXPORTS_BUCKET, { public: false });
  }
  bucketEnsured = true;
}

export function makeExportStorage(): ExportStorage {
  return {
    async upload(path, bytes, contentType) {
      const client = getAdmin();
      await ensureBucket(client);
      const { error } = await client.storage
        .from(COMPLIANCE_EXPORTS_BUCKET)
        .upload(path, bytes, { contentType, upsert: true });
      if (error) {
        throw new Error(`[compliance_storage] upload failed for ${path}`);
      }
    },
    async createSignedUrl(path, ttlSeconds) {
      const client = getAdmin();
      await ensureBucket(client);
      const { data } = await client.storage
        .from(COMPLIANCE_EXPORTS_BUCKET)
        .createSignedUrl(path, ttlSeconds);
      return data?.signedUrl ?? null;
    },
  };
}
