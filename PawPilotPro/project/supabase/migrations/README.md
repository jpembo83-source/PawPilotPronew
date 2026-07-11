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
```

## Added in this change
| File | Purpose |
|---|---|
| `20260611201256_phase4_customers_stage0.sql` | SQL recorded in prod history for the Phase 4 stage-0 customers DDL (applied 2026-06-11), promoting `migrations_drafts/0002_customers.sql`. Idempotency guards added (`drop policy/constraint if exists`) so it is a safe no-op on baseline-provisioned DBs. |
| `20260623220200_harden_function_security.sql` | Exact SQL of the live prod migration. **Prod parity** — targets prod-only functions; do not expect it to apply to a fresh DB. |
| `20260625085232_harden_function_search_path.sql` | Exact SQL of the live prod migration. **Prod parity.** |
| `20260625120000_active_schema_baseline.sql` | The active app schema staging was provisioned from: `kv_store` + `app` helpers + customer tables + RLS. Idempotent; no-op on prod. |

## Pending (files here, NOT yet applied to prod or staging)
| File | Purpose |
|---|---|
| `20260711120000_phase4_pet_updates_stage0.sql` | Phase 4 stage 0 for the `pet_updates` family (photo moderation queue + client gallery). **Must be applied (staging → prod) before deploying the edge function that ships with it** — `POST /pet-updates/moment` writes to this table. Depends on the `app.*` helpers from the customers stage-0 migration. After applying to each env, assert RLS is live: `select relrowsecurity from pg_class where relname = 'pet_updates';` must return `true`. Then backfill legacy KV moments: `scripts/phase4/backfill-pet-updates-from-kv.ts` (idempotent; photo/note only). |

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
