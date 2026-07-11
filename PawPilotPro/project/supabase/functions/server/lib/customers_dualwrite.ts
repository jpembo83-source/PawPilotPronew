// Phase 4 / Customers — STAGE 2 dual-write (docs/PHASE4_DATA_MIGRATION.md §4).
//
// Every customer:* KV mutation is mirrored onto the stage-0 Postgres tables
// via the phase4_customers_apply RPC (20260711220000). One dualWriteCustomers()
// call = one RPC call = ONE transaction, so a multi-key flow (primary-contact
// flip, cascade delete) batches its ops and can never partially apply.
//
// KV remains the source of truth for this entire stage: reads are untouched,
// and a Postgres failure is NON-FATAL to the request — it is logged loudly
// through the structured logger with a correlation ID, and shows up in the
// nightly drift check (scripts/phase4/verify-customers-backfill.ts). Never
// throw from here into a route handler.
//
// Ops mirror KV verbs exactly (set → full-row upsert stamped with
// legacy_kv_key; del → delete WHERE legacy_kv_key = key). Field projection
// happens inside the RPC with the same rules as the stage-1 backfill, so
// route code passes the KV blob through unmodified.

import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js";
import { logError } from "../_shared/log.ts";

export type CustomerDualWriteOp =
  | { op: "set"; key: string; value: Record<string, unknown> }
  | { op: "del"; key: string };

/** Op builder: mirror of kv.set(key, value). */
export const dwSet = (
  key: string,
  value: Record<string, unknown>,
): CustomerDualWriteOp => ({ op: "set", key, value });

/** Op builder: mirror of kv.del(key). */
export const dwDel = (key: string): CustomerDualWriteOp => ({ op: "del", key });

let admin: SupabaseClient | null = null;
function getAdmin(): SupabaseClient {
  if (admin) return admin;
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) {
    // Fail fast at first use — no anon-key fallback (repo auth rules).
    throw new Error(
      "[customers_dualwrite] SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.",
    );
  }
  admin = createClient(url, key, { auth: { persistSession: false } });
  return admin;
}

/**
 * Apply a batch of mirrored KV mutations to Postgres in one transaction.
 * Non-fatal by contract: any failure is logged (correlationId in the log
 * line) and swallowed — the caller's KV write has already succeeded and KV
 * is authoritative until stage 3.
 */
export async function dualWriteCustomers(
  ops: CustomerDualWriteOp[],
): Promise<void> {
  if (ops.length === 0) return;
  try {
    const { error } = await getAdmin().rpc("phase4_customers_apply", { ops });
    if (error) {
      throw new Error(`${error.code ?? "rpc_error"}: ${error.message}`);
    }
  } catch (err) {
    // KV keys carry only tenant/record ids — safe to log for drift triage.
    logError("phase4.customers.dualwrite.failed", err, {
      opCount: ops.length,
      opKeys: ops.map((o) => `${o.op} ${o.key}`),
    });
  }
}
