# Phase 4 / Customers — Stage 0 OPS checklist

Owner-ratified prerequisites (`docs/PHASE4_DATA_MIGRATION.md` §7.5) and the
rehearsal procedure for the Customers entity family. Stage 0 is **schema +
setup only** — no data moves, no route changes. Nothing in this checklist is
ever run against production directly; the backfill (stage 1) may not start
until every box is ticked.

## State as of this branch

- Stage-0 DDL is **applied to prod** (MDC, `ruahrxkfgfyshuxykiay`) — recorded
  prod migration `20260611201256_phase4_customers_stage0`, applied 2026-06-11,
  now committed to the repo at
  `PawPilotPro/project/supabase/migrations/20260611201256_phase4_customers_stage0.sql`.
- Staging (MDC-staging, `ihdbnwlmqhsrslstbbqn`) carries the same schema via
  `20260625120000_active_schema_baseline.sql`.
- The frozen record contract lives in `PawPilotPro/shared/schemas/customers.ts`.
- `household_id`/`tenant_id` are stamped into portal users' `app_metadata` at
  accept-invite (`portal_routes.tsx`), pinned by
  `tests/unit/accept-invite-stamping.test.ts` — the JWT claims the RLS
  policies key on.

## Prerequisites before stage 1 (backfill) — tick in order

- [ ] **PITR enabled on prod** (ratified spend, §7.5). Supabase dashboard →
      MDC project → Database → Backups → enable Point-in-Time Recovery.
      Verify the PITR window covers at least 7 days. Do not start any
      backfill until PITR shows an available restore point AFTER enablement.
- [ ] **Existing users backfilled with claims.** Accept-invite stamps new
      portal users; any portal user created before the stamping change needs
      `tenant_id`/`household_id` backfilled into `app_metadata` from their
      `portal_users:{t}:{hh}` KV link (small admin script, service-role,
      count is tiny). RLS portal-read policies return nothing for them until
      this is done — harmless in Phase 4 (no client-direct reads) but must be
      complete before any future portal-direct read cutover.
- [ ] **Duplicate-primary audit clean.** The unique index
      `contacts_one_primary_per_household_uq` will reject KV households with
      two `is_primary` contacts. Run the audit (commented in
      `migrations_drafts/0002_customers.sql`) against rehearsal data and
      resolve duplicates in KV first.
- [ ] **Branch-DB rehearsal passed** (procedure below) with zero errors and
      parity counts recorded in the PR that starts stage 1.

## Branch-DB rehearsal procedure

Rehearse on a Supabase **branch database** of prod (paid add-on, ratified).
A branch replays prod's migration history onto a fresh database — it does
**not** copy production data, which is what we want for a repeatable,
non-destructive rehearsal. All steps run from `PawPilotPro/project/`.

1. Create the branch (CLI: `supabase branches create phase4-customers-rehearsal
   --project-ref ruahrxkfgfyshuxykiay`, or the dashboard/MCP equivalent).
   Wait for status `ACTIVE_HEALTHY` / `FUNCTIONS_DEPLOYED`.
2. Confirm the migration chain applied: `supabase migration list` against the
   branch ref must show `20260611201256` and `20260625120000` both applied.
3. Confirm RLS on every customers table (must return 8 rows, all `t`):

   ```sql
   select relname, relrowsecurity
   from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public'
     and relname in ('households','contacts','pets','customer_documents',
                     'household_notes','note_pets','household_flags',
                     'customer_activities')
   order by relname;
   ```

4. Seed the branch's `kv_store_fc003b23` with a representative KV export
   (staging export is fine; **never** prod PII onto a throwaway branch
   without owner sign-off).
5. Run the stage-1 backfill SQL (the commented blocks in
   `migrations_drafts/0002_customers.sql`) inside a transaction; record
   timings.
6. Run the parity checks (row count per table vs KV key count per prefix,
   spot-check `legacy_kv_key` joins). Record results.
7. Run the duplicate-primary audit; if rows return, fix the KV source data
   and re-rehearse — do not drop the unique index.
8. Tear the branch down (`supabase branches delete …`) — branches bill
   hourly; a rehearsal branch should live hours, not days.

Re-run the whole rehearsal after ANY change to the backfill SQL. The
rehearsal that counts is the one run against the final SQL.

## Rollback positions

- Stage 0 (this branch): tables are unreferenced by code — `DROP TABLE` is a
  complete rollback (already-applied prod DDL is inert; nothing reads it).
- Stage 1 rehearsal: branch DB is disposable; delete it.
- Stage 1 on prod (later): `TRUNCATE` the eight tables; KV remains
  authoritative throughout stages 1–3. PITR is the catastrophic fallback.
