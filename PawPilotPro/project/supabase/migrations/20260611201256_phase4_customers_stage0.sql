-- ============================================================================
-- Phase 4 stage 0 — Customers entity family (households, contacts, pets,
-- documents, notes, note↔pet links, flags, activity feed).
--
-- PROD PARITY: this is the SQL recorded in prod (MDC) migration history as
-- version 20260611201256 (applied 2026-06-11), which promoted
-- migrations_drafts/0002_customers.sql per docs/PHASE4_DATA_MIGRATION.md §7.
-- The file was missing from this folder (the recorded SQL references a
-- "20260611194833_phase4_customers_stage0.sql" that was never committed);
-- this commits it. Two deltas from the recorded statement, both guards so the
-- file is safely re-runnable on databases provisioned from the
-- 20260625120000_active_schema_baseline (staging, branch DBs):
--   * `drop policy if exists` before each `create policy`
--   * `drop constraint if exists` before the households→contacts FK
--
-- Deltas from the draft DDL, as applied to prod (shapes corrected against
-- live route code — customers_routes.tsx, portal_routes.tsx):
--   * customer_documents: document_type/name/storage_path/file_size/
--     expiry_date/notes/uploaded_at (draft guessed doc_type/title/file_path/
--     size_bytes/expires_at/created_at/updated_at)
--   * household_flags: pet_id/flag_key/severity NOT NULL/is_active/reason
--     (draft guessed flag_type/label/notes); index is partial on is_active
--   * app.* JWT claim helpers are created HERE (draft placed them in
--     0001_bookings.sql, which migrates in a later entity branch)
--   * the draft's booking_pets→pets retro-fit FK is OMITTED — booking_pets
--     does not exist yet; it belongs to the bookings entity branch
--
-- Conventions (ratified, §7): TEXT PKs; tenant_id TEXT NOT NULL; RLS ON from
-- day one with edge functions (service-role) the sole writer; soft FKs added
-- NOT VALID; legacy_kv_key retained for parity auditing; denormalised name
-- fields dropped (join instead). No readers or writers are wired up here.
-- ============================================================================

create schema if not exists app;

-- ---- JWT claim helpers — app_metadata only (server-set, untamperable) -----

create or replace function app.jwt_tenant_id() returns text
language sql stable
set search_path = ''
as $$
  select nullif(((auth.jwt() -> 'app_metadata') ->> 'tenant_id'), '')
$$;

create or replace function app.jwt_household_id() returns text
language sql stable
set search_path = ''
as $$
  select nullif(((auth.jwt() -> 'app_metadata') ->> 'household_id'), '')
$$;

create or replace function app.jwt_role() returns text
language sql stable
set search_path = ''
as $$
  select nullif(((auth.jwt() -> 'app_metadata') ->> 'role'), '')
$$;

create or replace function app.is_staff() returns boolean
language sql stable
set search_path = ''
as $$
  select app.jwt_role() in ('admin','manager','assistant_manager','staff')
$$;

-- ---- 1. households — customer:{tenantId}:household:{id} -------------------

create table if not exists public.households (
  id                  text primary key default gen_random_uuid()::text,
  tenant_id           text not null,
  external_id         text,
  name                text not null,
  status              text not null default 'active',
  vip                 boolean not null default false,
  payment_hold        boolean not null default false,
  hold_reason         text,
  hold_notes          text,
  primary_location_id text,
  primary_contact_id  text,
  address             jsonb,
  internal_notes      text,
  created_by          text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  legacy_kv_key       text
);

create index if not exists households_tenant_idx
  on public.households (tenant_id, status, name);

-- ---- 2. contacts — customer:{tenantId}:contact:{householdId}:{id} ---------

create table if not exists public.contacts (
  id                              text primary key default gen_random_uuid()::text,
  tenant_id                       text not null,
  household_id                    text not null
                                    references public.households(id) on delete cascade,
  first_name                      text not null,
  last_name                       text not null,
  email                           text,
  phone                           text,
  preferred_contact_method        text,
  is_primary                      boolean not null default false,
  is_emergency_contact            boolean not null default false,
  emergency_contact_relationship  text,
  marketing_consent               boolean not null default false,
  sms_consent                     boolean not null default false,
  email_consent                   boolean not null default false,
  created_at                      timestamptz not null default now(),
  updated_at                      timestamptz not null default now(),
  legacy_kv_key                   text
);

create index if not exists contacts_household_idx
  on public.contacts (household_id);

-- At most one primary contact per household — replaces the KV rewrite loop.
create unique index if not exists contacts_one_primary_per_household_uq
  on public.contacts (household_id)
  where is_primary;

-- Portal sign-in and invite flows look contacts up by email.
create index if not exists contacts_email_idx
  on public.contacts (tenant_id, lower(email))
  where email is not null;

-- Circular FK; NOT VALID until orphan triage (ratified decision #6).
alter table public.households
  drop constraint if exists households_primary_contact_fk;
alter table public.households
  add constraint households_primary_contact_fk
  foreign key (primary_contact_id) references public.contacts(id)
  on delete set null
  not valid;

-- ---- 3. pets — customer:{tenantId}:pet:{householdId}:{id} -----------------

create table if not exists public.pets (
  id                       text primary key default gen_random_uuid()::text,
  tenant_id                text not null,
  household_id             text not null
                             references public.households(id) on delete cascade,
  name                     text not null,
  photo_url                text,
  breed                    text,
  sex                      text,
  date_of_birth            date,
  age_years                numeric(5,2),
  microchip                text,
  weight_kg                numeric(6,2),
  colour                   text,
  address                  jsonb,
  neutered_status          text,
  behaviour_notes          text,
  medical_notes            text,
  feeding_instructions     text,
  allergies                text,
  vet_name                 text,
  vet_phone                text,
  vet_address              text,
  vaccination_status       text not null default 'unknown',
  vaccination_expiry_date  date,
  daycare_enrolled         boolean not null default false,
  grooming_enrolled        boolean not null default false,
  transport_enrolled       boolean not null default false,
  overnights_enrolled      boolean not null default false,
  active                   boolean not null default true,
  owner_added              boolean not null default false,
  verification_status      text not null default 'verified'
                             check (verification_status in
                               ('verified','pending_staff_review','rejected')),
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  legacy_kv_key            text
);

create index if not exists pets_household_idx
  on public.pets (household_id) where active;

-- Staff verification queue (absorbs the portal_pet_verification:* key family).
create index if not exists pets_pending_verification_idx
  on public.pets (tenant_id, created_at)
  where verification_status = 'pending_staff_review';

-- ---- 4. customer_documents — customer:{tenantId}:document:{hh}:{id} -------
-- (file metadata; the binary lives in Supabase Storage, unchanged)

create table if not exists public.customer_documents (
  id             text primary key default gen_random_uuid()::text,
  tenant_id      text not null,
  household_id   text not null
                   references public.households(id) on delete cascade,
  pet_id         text references public.pets(id) on delete set null,
  document_type  text not null default 'other',
  name           text,
  file_name      text,
  storage_path   text,
  file_size      bigint not null default 0,
  mime_type      text not null default 'application/octet-stream',
  expiry_date    date,
  notes          text,
  uploaded_by    text,
  uploaded_at    timestamptz not null default now(),
  legacy_kv_key  text
);

create index if not exists customer_documents_household_idx
  on public.customer_documents (household_id);

-- ---- 5. household_notes + note↔pet links + household_flags ----------------

create table if not exists public.household_notes (
  id             text primary key default gen_random_uuid()::text,
  tenant_id      text not null,
  household_id   text not null
                   references public.households(id) on delete cascade,
  title          text,
  content        text not null,
  category       text,
  visibility     text,
  is_pinned      boolean not null default false,
  created_by     text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  deleted_at     timestamptz,
  legacy_kv_key  text
);

-- Pinned-first, newest-first list per household.
create index if not exists household_notes_list_idx
  on public.household_notes (household_id, is_pinned desc, created_at desc)
  where deleted_at is null;

create table if not exists public.note_pets (
  note_id  text not null references public.household_notes(id) on delete cascade,
  pet_id   text not null references public.pets(id) on delete cascade,
  primary key (note_id, pet_id)
);

create table if not exists public.household_flags (
  id             text primary key default gen_random_uuid()::text,
  tenant_id      text not null,
  household_id   text not null
                   references public.households(id) on delete cascade,
  pet_id         text references public.pets(id) on delete set null,
  flag_key       text not null,
  severity       text not null,
  is_active      boolean not null default true,
  reason         text,
  created_by     text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  legacy_kv_key  text
);

create index if not exists household_flags_household_idx
  on public.household_flags (household_id) where is_active;

-- ---- 6. customer_activities — the household activity feed -----------------
-- Two KV key variants exist in code (customer:{t}:activity:{hh}:{id} AND
-- customer:{t}:activity:{id}); the table fixes that by always carrying
-- household_id. Candidate for the unified audit_events table later (§7.8).

create table if not exists public.customer_activities (
  id               text primary key default gen_random_uuid()::text,
  tenant_id        text not null,
  household_id     text not null,
  pet_id           text,
  activity_type    text not null,
  title            text not null,
  description      text,
  occurred_at      timestamptz not null default now(),
  created_by       text,
  created_by_name  text,
  legacy_kv_key    text
);

create index if not exists customer_activities_household_idx
  on public.customer_activities (household_id, occurred_at desc);

-- ---- RLS — tenant isolation + portal-household read ------------------------
-- Service role (edge functions) bypasses everything; policies are defence in
-- depth + the option for future portal-direct reads, not a dependency.

alter table public.households          enable row level security;
alter table public.contacts            enable row level security;
alter table public.pets                enable row level security;
alter table public.customer_documents  enable row level security;
alter table public.household_notes     enable row level security;
alter table public.note_pets           enable row level security;
alter table public.household_flags     enable row level security;
alter table public.customer_activities enable row level security;

-- Staff: full access within tenant.
drop policy if exists households_staff_all on public.households;
create policy households_staff_all on public.households
  for all to authenticated
  using  (app.is_staff() and tenant_id = app.jwt_tenant_id())
  with check (app.is_staff() and tenant_id = app.jwt_tenant_id());

drop policy if exists contacts_staff_all on public.contacts;
create policy contacts_staff_all on public.contacts
  for all to authenticated
  using  (app.is_staff() and tenant_id = app.jwt_tenant_id())
  with check (app.is_staff() and tenant_id = app.jwt_tenant_id());

drop policy if exists pets_staff_all on public.pets;
create policy pets_staff_all on public.pets
  for all to authenticated
  using  (app.is_staff() and tenant_id = app.jwt_tenant_id())
  with check (app.is_staff() and tenant_id = app.jwt_tenant_id());

drop policy if exists customer_documents_staff_all on public.customer_documents;
create policy customer_documents_staff_all on public.customer_documents
  for all to authenticated
  using  (app.is_staff() and tenant_id = app.jwt_tenant_id())
  with check (app.is_staff() and tenant_id = app.jwt_tenant_id());

drop policy if exists household_notes_staff_all on public.household_notes;
create policy household_notes_staff_all on public.household_notes
  for all to authenticated
  using  (app.is_staff() and tenant_id = app.jwt_tenant_id())
  with check (app.is_staff() and tenant_id = app.jwt_tenant_id());

drop policy if exists note_pets_staff_all on public.note_pets;
create policy note_pets_staff_all on public.note_pets
  for all to authenticated
  using (exists (select 1 from public.household_notes n
                 where n.id = note_id
                   and app.is_staff() and n.tenant_id = app.jwt_tenant_id()))
  with check (exists (select 1 from public.household_notes n
                      where n.id = note_id
                        and app.is_staff() and n.tenant_id = app.jwt_tenant_id()));

drop policy if exists household_flags_staff_all on public.household_flags;
create policy household_flags_staff_all on public.household_flags
  for all to authenticated
  using  (app.is_staff() and tenant_id = app.jwt_tenant_id())
  with check (app.is_staff() and tenant_id = app.jwt_tenant_id());

-- Activity feed is append-only via the server; no client write policies.
drop policy if exists customer_activities_staff_read on public.customer_activities;
create policy customer_activities_staff_read on public.customer_activities
  for select to authenticated
  using (app.is_staff() and tenant_id = app.jwt_tenant_id());

-- Portal owners: read their own household graph. Internal-only material
-- (notes, flags, internal_notes, activities) deliberately has NO portal
-- policy — the portal API projects a safe subset, as it does today.
drop policy if exists households_portal_read on public.households;
create policy households_portal_read on public.households
  for select to authenticated
  using (tenant_id = app.jwt_tenant_id()
         and id = app.jwt_household_id());

drop policy if exists contacts_portal_read on public.contacts;
create policy contacts_portal_read on public.contacts
  for select to authenticated
  using (tenant_id = app.jwt_tenant_id()
         and household_id = app.jwt_household_id());

drop policy if exists pets_portal_read on public.pets;
create policy pets_portal_read on public.pets
  for select to authenticated
  using (tenant_id = app.jwt_tenant_id()
         and household_id = app.jwt_household_id());

drop policy if exists customer_documents_portal_read on public.customer_documents;
create policy customer_documents_portal_read on public.customer_documents
  for select to authenticated
  using (tenant_id = app.jwt_tenant_id()
         and household_id = app.jwt_household_id());
