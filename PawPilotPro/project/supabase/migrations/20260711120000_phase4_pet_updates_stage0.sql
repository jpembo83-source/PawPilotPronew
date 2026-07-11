-- ============================================================================
-- Phase 4 stage 0 — pet_updates entity family ("Share a moment" feed, photo
-- moderation queue, and the client gallery).
--
-- WHY POSTGRES NOW (not another KV family): the photo pipeline adds two
-- workloads that are relational by nature — a tenant-wide moderation queue
-- filtered by status, and an all-time per-household gallery with keyset
-- pagination. Both would be full prefix scans in KV. Per the spec ("don't add
-- a new KV family for the moderation state — go straight to Postgres") this
-- table is the live store for photo/note moments from day one; the edge
-- function (service-role) is the sole writer.
--
-- SCOPE: photo/note moments only. checked_in / checked_out feed events remain
-- on the legacy `pet_update:{t}:{date}:{pet}:{id}` KV family — they are
-- daycare-ops exhaust and migrate with entity family #3 (daycare) later. Day
-- feeds merge both sources at read time (lib/pet_updates.ts).
--
-- Conventions (ratified, PHASE4_DATA_MIGRATION.md §7): TEXT PKs; tenant_id
-- TEXT NOT NULL; RLS ON from day one with edge functions (service-role) the
-- sole writer; legacy_kv_key retained for parity auditing of any backfilled
-- KV moments. Deviations, with reasons:
--   * pet_name / created_by_name / reviewed_by_name are DENORMALISED (the
--     ratified rule is "drop and join") because public.pets has no wired
--     writers yet — the live pets store is still KV, so a join has nothing to
--     join to. Drop these columns when the customers family goes live.
--   * No FKs to households/pets for the same reason: those tables exist but
--     are unpopulated, so even a NOT VALID FK would reject every new insert.
--
-- Depends on app.* JWT helpers created in 20260611201256_phase4_customers_stage0.
-- ============================================================================

create table if not exists public.pet_updates (
  id               text primary key,
  tenant_id        text not null,
  pet_id           text not null,
  pet_name         text,
  household_id     text,
  booking_id       text,
  -- YYYY-MM-DD, denormalised from created_at for cheap "this pet, this day"
  -- reads (mirrors the KV key shape).
  date             date not null,
  type             text not null
                     check (type in ('checked_in','checked_out','photo','note')),
  text             text,
  -- Manager-editable, owner-facing caption; distinct from the operator's text.
  caption          text,
  -- Private-bucket storage path (MOMENTS_BUCKET); signed URLs minted at read
  -- time, and ONLY for approved rows on owner-facing routes.
  photo_path       text,
  -- Moderation lifecycle. Photos are created 'pending' and only reach the
  -- owner once a manager approves; text-only notes auto-approve.
  status           text not null default 'pending'
                     check (status in ('pending','approved','rejected')),
  -- Internal-only; never serialised to the portal.
  rejected_reason  text,
  created_by_id    text not null,
  created_by_name  text,
  reviewed_by_id   text,
  reviewed_by_name text,
  reviewed_at      timestamptz,
  created_at       timestamptz not null default now(),
  legacy_kv_key    text
);

-- Manager review queue: all pending for a tenant, newest first.
create index if not exists pet_updates_review_queue_idx
  on public.pet_updates (tenant_id, status, created_at desc);

-- Client gallery: a household's approved moments across time, newest first.
create index if not exists pet_updates_gallery_idx
  on public.pet_updates (tenant_id, household_id, status, created_at desc);

-- Day feed: one pet's updates for one day (merged with the legacy KV family).
create index if not exists pet_updates_pet_day_idx
  on public.pet_updates (tenant_id, pet_id, date);

-- ---- RLS — tenant isolation + approved-only portal read --------------------
-- Service role (edge functions) bypasses everything; policies are defence in
-- depth. No client insert/update policies: the edge function is the sole
-- writer, so the moderation gate cannot be bypassed from a client session.

alter table public.pet_updates enable row level security;

drop policy if exists pet_updates_staff_read on public.pet_updates;
create policy pet_updates_staff_read on public.pet_updates
  for select to authenticated
  using (app.is_staff() and tenant_id = app.jwt_tenant_id());

-- Portal owners: ONLY approved rows for their own household. This is the
-- data-layer enforcement of the curation gate — pending/rejected rows are
-- structurally invisible to owner sessions even if a portal-direct read is
-- ever wired up.
drop policy if exists pet_updates_portal_read on public.pet_updates;
create policy pet_updates_portal_read on public.pet_updates
  for select to authenticated
  using (tenant_id = app.jwt_tenant_id()
         and household_id = app.jwt_household_id()
         and status = 'approved');
