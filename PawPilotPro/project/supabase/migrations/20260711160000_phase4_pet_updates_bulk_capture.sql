-- ============================================================================
-- Phase 4 — pet_updates: bulk capture with assign-at-approval.
--
-- Operators can now dump photos WITHOUT choosing a dog; the manager assigns
-- the dog in the review queue before (atomically with) approval. Model:
--   * "unassigned" photo == status = 'pending' AND pet_id IS NULL.
--     Deliberately NOT a new status value — the moderation lifecycle stays
--     pending/approved/rejected, and every approval still requires a pet
--     (enforced in the edge function: approve rejects unassigned rows).
--   * location_id — where the dump was taken; scopes the manager's candidate
--     roster to that location's checked-in dogs.
--   * upload_batch_id — groups one operator dump for review ergonomics.
--
-- Additive + backfill-safe: existing rows keep their pet_id; new columns
-- default NULL. Idempotent (IF NOT EXISTS / DROP NOT NULL is a no-op when
-- already nullable) so it is safe on staging and prod alike.
--
-- RLS is intentionally UNCHANGED: the portal policy already requires
-- household_id = jwt household AND status = 'approved'; unassigned rows have
-- household_id NULL and status 'pending', so they are structurally invisible
-- to owners twice over. Staff read policy is tenant-wide and unaffected.
--
-- Conventions per docs/PHASE4_DATA_MIGRATION.md §7 (TEXT columns, edge
-- function sole service-role writer). Apply BEFORE deploying the function
-- that writes location_id/upload_batch_id (same ordering rule as stage 0).
-- ============================================================================

alter table public.pet_updates
  alter column pet_id drop not null;

alter table public.pet_updates
  add column if not exists location_id text;

alter table public.pet_updates
  add column if not exists upload_batch_id text;

-- Manager review queue, now scoped/groupable by location.
create index if not exists pet_updates_queue_location_idx
  on public.pet_updates (tenant_id, status, location_id, created_at desc);

-- One operator dump = one batch; the queue groups by this.
create index if not exists pet_updates_batch_idx
  on public.pet_updates (tenant_id, upload_batch_id);
