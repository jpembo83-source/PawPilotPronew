-- Active application schema baseline.
--
-- This is the schema the PawPilotProNew frontend + make-server edge function
-- actually exercise: the kv_store (primary data store), the `app` JWT/RLS
-- helpers, and the phase-4 customer relational tables with RLS. It was applied
-- to the staging project (MDC-staging, ihdbnwlmqhsrslstbbqn) to stand it up.
--
-- It is a faithful reconstruction of the live prod objects (captured from prod
-- migration 20260611201256_phase4_customers_stage0 + the kv_store table and its
-- restrictive policy from 20260623183120). Written idempotently so it is safe to
-- re-apply. On prod every object already exists, so this is a no-op there.
--
-- NOT included (separate prod subsystems, not used by the daycare frontend):
--   * invoxia.*        — collar-tracking portal (devices, ble_packets, ...)
--   * legacy_jan2026.* — ~48 quarantined legacy tables
--   * postgis / spatial_ref_sys
-- See README.md in this folder for how to capture full prod parity.

-- ---- KV store: the edge function's primary data store --------------------
create table if not exists public.kv_store_fc003b23 (
  key   text not null primary key,
  value jsonb not null
);
alter table public.kv_store_fc003b23 enable row level security;
drop policy if exists "kv_store_fc003b23_no_anon_or_auth" on public.kv_store_fc003b23;
create policy "kv_store_fc003b23_no_anon_or_auth"
  on public.kv_store_fc003b23
  as restrictive for all
  to anon, authenticated
  using (false) with check (false);

-- ---- app schema: JWT claim + staff helpers (search_path pinned) ----------
create schema if not exists app;

create or replace function app.jwt_tenant_id() returns text
language sql stable set search_path = '' as $$
  select nullif(((auth.jwt() -> 'app_metadata') ->> 'tenant_id'), '')
$$;

create or replace function app.jwt_household_id() returns text
language sql stable set search_path = '' as $$
  select nullif(((auth.jwt() -> 'app_metadata') ->> 'household_id'), '')
$$;

create or replace function app.jwt_role() returns text
language sql stable set search_path = '' as $$
  select nullif(((auth.jwt() -> 'app_metadata') ->> 'role'), '')
$$;

create or replace function app.is_staff() returns boolean
language sql stable set search_path = '' as $$
  select app.jwt_role() in ('admin','manager','assistant_manager','staff')
$$;

-- ---- customer relational tables ------------------------------------------
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
create index if not exists households_tenant_idx on public.households (tenant_id, status, name);

create table if not exists public.contacts (
  id                              text primary key default gen_random_uuid()::text,
  tenant_id                       text not null,
  household_id                    text not null references public.households(id) on delete cascade,
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
create index if not exists contacts_household_idx on public.contacts (household_id);
create unique index if not exists contacts_one_primary_per_household_uq
  on public.contacts (household_id) where is_primary;
create index if not exists contacts_email_idx
  on public.contacts (tenant_id, lower(email)) where email is not null;

alter table public.households drop constraint if exists households_primary_contact_fk;
alter table public.households
  add constraint households_primary_contact_fk
  foreign key (primary_contact_id) references public.contacts(id)
  on delete set null not valid;

create table if not exists public.pets (
  id                       text primary key default gen_random_uuid()::text,
  tenant_id                text not null,
  household_id             text not null references public.households(id) on delete cascade,
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
                             check (verification_status in ('verified','pending_staff_review','rejected')),
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  legacy_kv_key            text
);
create index if not exists pets_household_idx on public.pets (household_id) where active;
create index if not exists pets_pending_verification_idx
  on public.pets (tenant_id, created_at) where verification_status = 'pending_staff_review';

create table if not exists public.customer_documents (
  id             text primary key default gen_random_uuid()::text,
  tenant_id      text not null,
  household_id   text not null references public.households(id) on delete cascade,
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
create index if not exists customer_documents_household_idx on public.customer_documents (household_id);

create table if not exists public.household_notes (
  id             text primary key default gen_random_uuid()::text,
  tenant_id      text not null,
  household_id   text not null references public.households(id) on delete cascade,
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
create index if not exists household_notes_list_idx
  on public.household_notes (household_id, is_pinned desc, created_at desc) where deleted_at is null;

create table if not exists public.note_pets (
  note_id  text not null references public.household_notes(id) on delete cascade,
  pet_id   text not null references public.pets(id) on delete cascade,
  primary key (note_id, pet_id)
);

create table if not exists public.household_flags (
  id             text primary key default gen_random_uuid()::text,
  tenant_id      text not null,
  household_id   text not null references public.households(id) on delete cascade,
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
create index if not exists household_flags_household_idx on public.household_flags (household_id) where is_active;

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
create index if not exists customer_activities_household_idx on public.customer_activities (household_id, occurred_at desc);

-- ---- RLS ------------------------------------------------------------------
alter table public.households          enable row level security;
alter table public.contacts            enable row level security;
alter table public.pets                enable row level security;
alter table public.customer_documents  enable row level security;
alter table public.household_notes     enable row level security;
alter table public.note_pets           enable row level security;
alter table public.household_flags     enable row level security;
alter table public.customer_activities enable row level security;

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
                 where n.id = note_id and app.is_staff() and n.tenant_id = app.jwt_tenant_id()))
  with check (exists (select 1 from public.household_notes n
                      where n.id = note_id and app.is_staff() and n.tenant_id = app.jwt_tenant_id()));

drop policy if exists household_flags_staff_all on public.household_flags;
create policy household_flags_staff_all on public.household_flags
  for all to authenticated
  using  (app.is_staff() and tenant_id = app.jwt_tenant_id())
  with check (app.is_staff() and tenant_id = app.jwt_tenant_id());

drop policy if exists customer_activities_staff_read on public.customer_activities;
create policy customer_activities_staff_read on public.customer_activities
  for select to authenticated
  using (app.is_staff() and tenant_id = app.jwt_tenant_id());

drop policy if exists households_portal_read on public.households;
create policy households_portal_read on public.households
  for select to authenticated
  using (tenant_id = app.jwt_tenant_id() and id = app.jwt_household_id());

drop policy if exists contacts_portal_read on public.contacts;
create policy contacts_portal_read on public.contacts
  for select to authenticated
  using (tenant_id = app.jwt_tenant_id() and household_id = app.jwt_household_id());

drop policy if exists pets_portal_read on public.pets;
create policy pets_portal_read on public.pets
  for select to authenticated
  using (tenant_id = app.jwt_tenant_id() and household_id = app.jwt_household_id());

drop policy if exists customer_documents_portal_read on public.customer_documents;
create policy customer_documents_portal_read on public.customer_documents
  for select to authenticated
  using (tenant_id = app.jwt_tenant_id() and household_id = app.jwt_household_id());
