// Phase 4 / Customers — STAGE 3: Postgres read path behind a feature flag.
//
// Flag: system:feature_flag:read_from_pg:customers (the KV feature-flag
// store, manageable through the existing /system/feature-flags endpoints).
//   { id: 'read_from_pg:customers', is_enabled: boolean,
//     shadow_sample_rate: number 0..1 }
// Flag absent / is_enabled !== true → KV path (today's behaviour, unchanged).
// shadow_sample_rate > 0 → that fraction of read requests ALSO runs the
// non-serving path and logs a response-level diff (lib/customers_shadow.ts)
// with a correlation id — the parity evidence for the cutover, in both flag
// states. Rollback is flipping is_enabled off: dual-write (stage 2) has kept
// KV authoritative the whole time.
//
// The PG path queries the stage-0 tables with real indexed WHERE/ORDER
// BY/LIMIT (RPC phase4_customers_list / phase4_customers_lookup — service
// role only, EXECUTE revoked from anon/authenticated) and serialises rows
// back to the KV wire shape (lib/customers_wire.ts). A PG failure while the
// flag is ON fails the request (fail fast, no silent KV fallback — the
// operator's rollback is the flag); a shadow failure only logs.
//
// NOT cut over in this stage (documented gaps, still KV):
//   * GET /households/:id/activity and /pets/:id/timeline — old activity
//     blobs carry metadata/source_id/source_module/created_at, which the
//     ratified contract dropped; PetTimelineTab renders metadata, so serving
//     rows would lose visible data. Needs a column-add decision first.
//   * notes/flags lists — created_by_name dropped by contract (§7.7).
//   * /export, /document-alerts, /import — out of list/detail/search scope.

import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js";
import * as kv from "../kv_store.tsx";
import { logError, logInfo, logWarn } from "../_shared/log.ts";
import { diffShadow } from "./customers_shadow.ts";
import {
  toWireContact,
  toWireDocument,
  toWireHousehold,
  toWirePet,
  type WireRecord,
} from "./customers_wire.ts";

export const CUSTOMERS_READ_FLAG_KEY = "system:feature_flag:read_from_pg:customers";

let admin: SupabaseClient | null = null;
function getAdmin(): SupabaseClient {
  if (admin) return admin;
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) {
    // Fail fast at first use — no anon-key fallback (repo auth rules).
    throw new Error("[customers_read_pg] SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
  }
  admin = createClient(url, key, { auth: { persistSession: false } });
  return admin;
}

export interface CustomersReadConfig {
  readFromPg: boolean;
  shadowSampleRate: number;
}

export async function getCustomersReadConfig(): Promise<CustomersReadConfig> {
  const record = (await kv.get(CUSTOMERS_READ_FLAG_KEY)) as Record<string, unknown> | undefined | null;
  const rate = Number(record?.shadow_sample_rate);
  return {
    readFromPg: record?.is_enabled === true,
    shadowSampleRate: Number.isFinite(rate) ? Math.min(Math.max(rate, 0), 1) : 0,
  };
}

/**
 * Serve a customers read from the flagged path; on sampled requests run the
 * other path too and log the response diff. Both builders MUST return the
 * pre-signing payload (photo URLs are minted after selection) so the diff
 * never trips on signed-URL tokens.
 */
export async function customersRead<T>(
  route: string,
  build: { kv: () => Promise<T>; pg: () => Promise<T> },
): Promise<T> {
  const config = await getCustomersReadConfig();
  const primary = config.readFromPg ? "pg" : "kv";
  const t0 = Date.now();
  const served = await build[primary]();
  const servedMs = Date.now() - t0;

  if (config.shadowSampleRate > 0 && Math.random() < config.shadowSampleRate) {
    const shadowLabel = primary === "pg" ? "kv" : "pg";
    const correlationId = crypto.randomUUID();
    try {
      const t1 = Date.now();
      const shadow = await build[shadowLabel]();
      const shadowMs = Date.now() - t1;
      const { diffs, legacyDiffs } = diffShadow(
        primary === "kv" ? served : shadow,
        primary === "kv" ? shadow : served,
      );
      // Paths + types only — never payload values (they carry customer data).
      const fields: Record<string, unknown> = {
        correlationId,
        route,
        served: primary,
        kvMs: primary === "kv" ? servedMs : shadowMs,
        pgMs: primary === "pg" ? servedMs : shadowMs,
        diffCount: diffs.length,
        legacyDiffCount: legacyDiffs.length,
      };
      if (legacyDiffs.length > 0) {
        fields.legacyPaths = legacyDiffs.slice(0, 10).map((d) => d.path);
      }
      if (diffs.length > 0) {
        logWarn("phase4.customers.shadow_diff", { ...fields, diffs: diffs.slice(0, 10) });
      } else {
        logInfo("phase4.customers.shadow_ok", fields);
      }
    } catch (err) {
      // The shadow path must never fail the request.
      logError("phase4.customers.shadow_error", err, { route, served: primary, correlationId });
    }
  }
  return served;
}

// ---------------------------------------------------------------------------
// PG readers — each returns the exact (pre-signing) wire payload of its route.
// ---------------------------------------------------------------------------

function rpcError(fn: string, error: { code?: string; message: string }): Error {
  return new Error(`${fn}: ${error.code ?? "rpc_error"}: ${error.message}`);
}

export interface PgHouseholdListQuery {
  search?: string;
  status?: string;
  vip?: boolean;
  payment_hold?: boolean;
  location_id?: string;
  sort: "name" | "primary_contact";
  dir: "asc" | "desc";
  /** Omit for the legacy full-array response. */
  limit?: number;
  offset?: number;
}

interface PgListRow {
  household: Record<string, unknown>;
  contacts_count: number;
  pets_count: number;
  primary_contact: Record<string, unknown> | null;
}

export async function pgListHouseholds(
  tenantId: string,
  query: PgHouseholdListQuery,
): Promise<{ rows: WireRecord[]; total: number }> {
  const { data, error } = await getAdmin().rpc("phase4_customers_list", {
    p_tenant: tenantId,
    p_search: query.search || null,
    p_status: query.status || null,
    p_vip: query.vip === true,
    p_payment_hold: query.payment_hold === true,
    p_location_id: query.location_id || null,
    p_sort: query.sort,
    p_dir: query.dir,
    p_limit: query.limit ?? null,
    p_offset: query.offset ?? 0,
  });
  if (error) throw rpcError("phase4_customers_list", error);
  const payload = data as { total: number; rows: PgListRow[] | null };
  return {
    total: payload.total,
    rows: (payload.rows ?? []).map((r) => ({
      ...toWireHousehold(r.household),
      contacts_count: r.contacts_count,
      pets_count: r.pets_count,
      primary_contact: r.primary_contact ? toWireContact(r.primary_contact) : null,
    })),
  };
}

interface PgLookupContactRow {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  household_id: string | null;
  household_name: string;
  matched_email: boolean;
  matched_phone: boolean;
}

export interface LookupResult {
  contacts: WireRecord[];
  households: Array<{ id: string; name: string }>;
}

export async function pgLookup(
  tenantId: string,
  query: { email: string; phone: string; name: string },
): Promise<LookupResult> {
  const { data, error } = await getAdmin().rpc("phase4_customers_lookup", {
    p_tenant: tenantId,
    p_email: query.email,
    p_phone: query.phone,
    p_name: query.name,
  });
  if (error) throw rpcError("phase4_customers_lookup", error);
  const payload = data as {
    contacts: PgLookupContactRow[] | null;
    households: Array<{ id: string; name: string }> | null;
  };
  return {
    contacts: (payload.contacts ?? []).map((c) => ({
      id: c.id,
      first_name: c.first_name,
      last_name: c.last_name,
      email: c.email,
      phone: c.phone,
      household_id: c.household_id,
      household_name: c.household_name,
      matched: [
        ...(c.matched_email ? ["email" as const] : []),
        ...(c.matched_phone ? ["phone" as const] : []),
      ],
    })),
    households: payload.households ?? [],
  };
}

/** Ordered like KV insertion order (created_at, id) for stable responses. */
async function tableRows(
  table: string,
  tenantId: string,
  householdId: string,
  createdColumn = "created_at",
): Promise<Record<string, unknown>[]> {
  const { data, error } = await getAdmin()
    .from(table)
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("household_id", householdId)
    .order(createdColumn, { ascending: true })
    .order("id", { ascending: true });
  if (error) throw rpcError(table, error);
  return (data ?? []) as Record<string, unknown>[];
}

export interface HouseholdBundle {
  household: WireRecord;
  contacts: WireRecord[];
  pets: WireRecord[];
  documents: WireRecord[];
}

export async function pgGetHouseholdBundle(
  tenantId: string,
  householdId: string,
): Promise<HouseholdBundle | null> {
  const { data: household, error } = await getAdmin()
    .from("households")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("id", householdId)
    .maybeSingle();
  if (error) throw rpcError("households", error);
  if (!household) return null;
  const [contacts, pets, documents] = await Promise.all([
    tableRows("contacts", tenantId, householdId),
    tableRows("pets", tenantId, householdId),
    tableRows("customer_documents", tenantId, householdId, "uploaded_at"),
  ]);
  return {
    household: toWireHousehold(household as Record<string, unknown>),
    contacts: contacts.map(toWireContact),
    pets: pets.map(toWirePet),
    documents: documents.map(toWireDocument),
  };
}

export async function pgListContacts(tenantId: string, householdId: string): Promise<WireRecord[]> {
  return (await tableRows("contacts", tenantId, householdId)).map(toWireContact);
}

export async function pgListPets(tenantId: string, householdId: string): Promise<WireRecord[]> {
  return (await tableRows("pets", tenantId, householdId)).map(toWirePet);
}

export async function pgGetPet(tenantId: string, petId: string): Promise<WireRecord | null> {
  const { data, error } = await getAdmin()
    .from("pets")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("id", petId)
    .maybeSingle();
  if (error) throw rpcError("pets", error);
  return data ? toWirePet(data as Record<string, unknown>) : null;
}
