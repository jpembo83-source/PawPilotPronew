# Supabase migrations — state & parity

## Reality of the live schema
Prod (**MDC**, `ruahrxkfgfyshuxykiay`) was **not** built entirely through this
folder. Its real schema spans 4 schemas — `public`, `app`, `invoxia`,
`legacy_jan2026` — much of it created out-of-band (Figma Make bootstrap,
dashboard) and recorded only as *placeholder* rows in the early migration
history. So these files alone do not reproduce prod exactly.

## Recorded prod migration history (from `supabase_migrations.schema_migrations`)
```
20260126–20260130  *_remote_placeholder      (6, placeholders — real DDL predates history)
20260530200000     invoxia_ble_packets
20260531100000     invoxia_notification_state
20260531110000     invoxia_detector_cron
20260611201216     legacy_jan2026_quarantine   (not yet a file here; see migrations_drafts/)
20260611201256     phase4_customers_stage0      ← added here (Phase 4 stage 0, customers)
20260623183120     fix_security_lints
20260623220200     harden_function_security     ← added here
20260625085232     harden_function_search_path  ← added here
20260704223126     fix_double_stringified_kv_values
20260711101218     phase4_pet_updates_stage0    (repo file: 20260711120000_…; applied 2026-07-11 to staging + prod, RLS asserted, KV moments backfilled)
```

## Added in this change
| File | Purpose |
|---|---|
| `20260611201256_phase4_customers_stage0.sql` | SQL recorded in prod history for the Phase 4 stage-0 customers DDL (applied 2026-06-11), promoting `migrations_drafts/0002_customers.sql`. Idempotency guards added (`drop policy/constraint if exists`) so it is a safe no-op on baseline-provisioned DBs. |
| `20260623220200_harden_function_security.sql` | Exact SQL of the live prod migration. **Prod parity** — targets prod-only functions; do not expect it to apply to a fresh DB. |
| `20260625085232_harden_function_search_path.sql` | Exact SQL of the live prod migration. **Prod parity.** |
| `20260625120000_active_schema_baseline.sql` | The active app schema staging was provisioned from: `kv_store` + `app` helpers + customer tables + RLS. Idempotent; no-op on prod. |

## Phase 4 customers stage 3 (2026-07-19)
| File | State |
|---|---|
| `20260719110000_phase4_customers_kv_tenant_canonicalization.sql` | **Applied to prod** 2026-07-19 (recorded as `phase4_customers_kv_tenant_canonicalization`). Data migration: folds the 25 alias-tenant KV keys (`ee4c3a1d-…`/`demo-tenant` → `demo-tenant-001`) to match the row canonicalisation prod applied 2026-07-11 (`20260711230224_phase4_customers_backfill_tenant_canonicalization`, recorded in prod history, not yet captured as a file here — it is a canonical_tenant re-run of `20260702093000_phase4_customers_backfill`). Idempotent; no-op on staging (no alias keys). |
| `20260719120000_phase4_customers_read_indexes_rpc.sql` | **Applied to staging** 2026-07-19. Stage-3 read cutover: trigram search indexes, `phase4_ci_base` ICU collation, location/full-pets indexes, service-role-only `phase4_customers_list` / `phase4_customers_lookup` RPCs. Apply to prod at merge (additive + inert while `read_from_pg:customers` is off). |

Also recorded in prod (2026-07-17, not yet captured as files here):
`phase4_customers_dualwrite_deferrable_fks` — makes the customer FKs
deferrable and re-creates `phase4_customers_apply` with
`set constraints all deferred` (supersedes the body in
`20260711220000_phase4_customers_dualwrite_rpc.sql`).

## Pending (files here, NOT yet applied to prod or staging)
| File | Purpose |
|---|---|
| `20260711160000_phase4_pet_updates_bulk_capture.sql` | Bulk capture with assign-at-approval: `pet_id` becomes NULLABLE (unassigned = pending + no pet), adds `location_id` + `upload_batch_id` + queue/batch indexes. Additive + idempotent. **Apply (staging → prod) before deploying the function that writes the new columns.** After applying, re-assert RLS: `select relrowsecurity from pg_class where relname = 'pet_updates';` → `true`. |

## Staging
**MDC-staging** (`ihdbnwlmqhsrslstbbqn`) was provisioned from
`20260625120000_active_schema_baseline.sql` only — the schema the daycare
frontend + `make-server` edge function use. It intentionally omits the
`invoxia` (collar portal) and `legacy_jan2026` (quarantine) subsystems and
PostGIS.

## Full prod parity (when needed)
The recorded history is incomplete (placeholders + out-of-band base), so use the
CLI to capture the real schema (needs the prod DB password):
```bash
cd PawPilotPro/project
supabase link --project-ref ruahrxkfgfyshuxykiay   # prompts for prod DB password
supabase db pull                                    # writes a full <ts>_remote_schema.sql
supabase link --project-ref ihdbnwlmqhsrslstbbqn && supabase db push   # replicate to staging
```
From then on every schema change is a new file here (never ad-hoc dashboard SQL).
