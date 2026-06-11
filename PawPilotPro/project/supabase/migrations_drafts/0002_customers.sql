-- ============================================================================
-- DRAFT — NOT APPLIED. DO NOT RUN AGAINST ANY ENVIRONMENT.
-- Phase 4 design artefact only (see docs/PHASE4_DATA_MIGRATION.md).
-- This file lives in supabase/migrations_drafts/ (NOT supabase/migrations/)
-- so that no migration tooling can pick it up by accident.
-- ============================================================================
--
-- 0002_customers.sql — households, contacts, pets, documents, notes, flags,
--                      activity feed
--
-- Sources of truth for the shapes below (route code, not guesswork):
--   * customers_routes.tsx — customer:{t}:household:{id}        (lines 209-225)
--                            customer:{t}:contact:{hh}:{id}     (lines 429-446)
--                            customer:{t}:pet:{hh}:{id}         (lines 640-671)
--                            customer:{t}:document:{hh}:{id}
--                            customer:{t}:household:{hh}:note:{id} (lines 1508+)
--                            customer:{t}:household:{hh}:flag:{id}
--                            customer:{t}:note:{noteId}:pet:{petId} (note↔pet links)
--                            customer:{t}:activity:{hh}:{id} and
--                            customer:{t}:activity:{id} (two variants in code!)
--   * portal_routes.tsx    — owner-added pets carry owner_added +
--                            verification_status='pending_staff_review'
--                            (lines 2413-2431); booking eligibility filters on
--                            verification_status='verified'.
--
-- This family migrates FIRST: every other entity (bookings, invoices,
-- vaccinations, transport) keys off household_id / pet_id / contact_id.
-- Migration order within this file: households → contacts/pets → the rest.
--
-- Conventions identical to 0001 (TEXT ids — generateId() produces
-- "hh_…", "con_…", "pet_…" while portal uses UUIDs; NOT VALID FKs;
-- legacy_kv_key; RLS on, service-role writes).
-- Requires the app.* JWT helper functions created in 0001_bookings.sql.
-- ============================================================================

-- ===========================================================================
-- 1. households — customer:{tenantId}:household:{id}
-- ===========================================================================
create table if not exists public.households (
  id                  text primary key default gen_random_uuid()::text,
  tenant_id           text not null,
  external_id         text,
  name                text not null,
  status              text not null default 'active',  -- free text today; tighten after data audit
  vip                 boolean not null default false,
  payment_hold        boolean not null default false,
  hold_reason         text,
  hold_notes          text,
  primary_location_id text,
  primary_contact_id  text,            -- FK to contacts added below NOT VALID (circular)
  address             jsonb,           -- blob stores a structured/typed address object
  internal_notes      text,
  created_by          text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  legacy_kv_key       text
);

-- List view sorts/filters tenant-wide (customers_routes.tsx list endpoint
-- enriches every household with counts — that becomes a join/lateral).
create index if not exists households_tenant_idx
  on public.households (tenant_id, status, name);

-- ===========================================================================
-- 2. contacts — customer:{tenantId}:contact:{householdId}:{id}
--
-- Today "find contact by id" loads EVERY contact in the tenant
-- (customers_routes.tsx:490, 556) because the household is baked into the
-- key. A primary-key lookup replaces that. The "exactly one primary contact
-- per household" rule is currently enforced by a multi-record rewrite loop
-- (lines 515-538) — here it is a partial unique index + one transaction.
-- ===========================================================================
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

-- At most one primary contact per household — replaces the rewrite loop.
-- Deferred-checked via transaction: demote old primary + promote new one
-- in the same statement set. NOTE: backfill may violate this (two contacts
-- both flagged primary in KV); the backfill runbook must resolve duplicates
-- BEFORE this index is created, or create it afterwards. See stage-1 notes.
create unique index if not exists contacts_one_primary_per_household_uq
  on public.contacts (household_id)
  where is_primary;

-- Portal sign-in and invite flows look contacts up by email.
create index if not exists contacts_email_idx
  on public.contacts (tenant_id, lower(email))
  where email is not null;

-- Circular FK households.primary_contact_id → contacts.id, added after both
-- tables exist; NOT VALID until orphan triage (OWNER DECISION #6).
alter table public.households
  add constraint households_primary_contact_fk
  foreign key (primary_contact_id) references public.contacts(id)
  on delete set null
  not valid;

-- ===========================================================================
-- 3. pets — customer:{tenantId}:pet:{householdId}:{id}
--
-- Staff-created shape: customers_routes.tsx:640-671.
-- Portal-created shape adds: owner_added, verification_status
-- (portal_routes.tsx:2413-2431). Booking creation REJECTS pets whose
-- verification_status <> 'verified' (portal_bookings.ts:247-255) — that
-- filter becomes an indexed predicate here.
-- ===========================================================================
create table if not exists public.pets (
  id                       text primary key default gen_random_uuid()::text,
  tenant_id                text not null,
  household_id             text not null
                             references public.households(id) on delete cascade,
  name                     text not null,
  photo_url                text,
  breed                    text,
  sex                      text,                  -- 'male'|'female'|'unknown' observed; tighten after audit
  date_of_birth            date,
  age_years                numeric(5,2),
  microchip                text,
  weight_kg                numeric(6,2),
  colour                   text,
  address                  jsonb,
  neutered_status          text,                  -- 'neutered'|'intact'|'unknown'
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

-- Staff verification queue (portal_pet_verification:* records collapse into
-- this predicate — that key family is absorbed, one fewer KV namespace).
create index if not exists pets_pending_verification_idx
  on public.pets (tenant_id, created_at)
  where verification_status = 'pending_staff_review';

-- ===========================================================================
-- 4. customer_documents — customer:{tenantId}:document:{householdId}:{id}
-- (file metadata; the binary lives in Supabase Storage, unchanged)
-- ===========================================================================
create table if not exists public.customer_documents (
  id             text primary key default gen_random_uuid()::text,
  tenant_id      text not null,
  household_id   text not null
                   references public.households(id) on delete cascade,
  pet_id         text references public.pets(id) on delete set null,
  doc_type       text,
  title          text,
  file_path      text,           -- storage object path
  file_name      text,
  mime_type      text,
  size_bytes     bigint,
  expires_at     date,
  uploaded_by    text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  legacy_kv_key  text
);

create index if not exists customer_documents_household_idx
  on public.customer_documents (household_id);

-- ===========================================================================
-- 5. household_notes + note↔pet links + household_flags
--    customer:{t}:household:{hh}:note:{id}   (customers_routes.tsx:1508+;
--      soft-deleted via deleted_at, pinned-first sort at 1459-1464)
--    customer:{t}:note:{noteId}:pet:{petId}  (link records carrying pet_id)
--    customer:{t}:household:{hh}:flag:{id}
-- ===========================================================================
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
  deleted_at     timestamptz,          -- soft delete preserved from blob shape
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
  flag_type      text not null,
  label          text,
  severity       text,
  notes          text,
  created_by     text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  legacy_kv_key  text
);

create index if not exists household_flags_household_idx
  on public.household_flags (household_id);

-- ===========================================================================
-- 6. customer_activities — the household activity feed.
--    TWO key variants exist in code: customer:{t}:activity:{hh}:{id} AND
--    customer:{t}:activity:{id} (compare customers_routes.tsx:239 vs 742) —
--    a latent KV bug this table quietly fixes by always carrying household_id.
--    Candidate for the unified audit_events table later (OWNER DECISION #8).
-- ===========================================================================
create table if not exists public.customer_activities (
  id               text primary key default gen_random_uuid()::text,
  tenant_id        text not null,
  household_id     text not null,     -- soft FK; activities may outlive household per retention policy
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

-- ===========================================================================
-- Retro-fit the cross-file FK from 0001 (booking_pets.pet_id → pets.id)
-- once both drafts are approved as a pair.
-- ===========================================================================
alter table public.booking_pets
  add constraint booking_pets_pet_fk
  foreign key (pet_id) references public.pets(id)
  on delete restrict
  not valid;

-- ===========================================================================
-- RLS — tenant isolation + portal-household read.
-- Service role (edge functions) bypasses everything; see 0001 preamble.
-- ===========================================================================
alter table public.households          enable row level security;
alter table public.contacts            enable row level security;
alter table public.pets                enable row level security;
alter table public.customer_documents  enable row level security;
alter table public.household_notes     enable row level security;
alter table public.note_pets           enable row level security;
alter table public.household_flags     enable row level security;
alter table public.customer_activities enable row level security;

-- Staff: full access within tenant.
create policy households_staff_all on public.households
  for all to authenticated
  using  (app.is_staff() and tenant_id = app.jwt_tenant_id())
  with check (app.is_staff() and tenant_id = app.jwt_tenant_id());

create policy contacts_staff_all on public.contacts
  for all to authenticated
  using  (app.is_staff() and tenant_id = app.jwt_tenant_id())
  with check (app.is_staff() and tenant_id = app.jwt_tenant_id());

create policy pets_staff_all on public.pets
  for all to authenticated
  using  (app.is_staff() and tenant_id = app.jwt_tenant_id())
  with check (app.is_staff() and tenant_id = app.jwt_tenant_id());

create policy customer_documents_staff_all on public.customer_documents
  for all to authenticated
  using  (app.is_staff() and tenant_id = app.jwt_tenant_id())
  with check (app.is_staff() and tenant_id = app.jwt_tenant_id());

create policy household_notes_staff_all on public.household_notes
  for all to authenticated
  using  (app.is_staff() and tenant_id = app.jwt_tenant_id())
  with check (app.is_staff() and tenant_id = app.jwt_tenant_id());

create policy note_pets_staff_all on public.note_pets
  for all to authenticated
  using (exists (select 1 from public.household_notes n
                 where n.id = note_id
                   and app.is_staff() and n.tenant_id = app.jwt_tenant_id()))
  with check (exists (select 1 from public.household_notes n
                      where n.id = note_id
                        and app.is_staff() and n.tenant_id = app.jwt_tenant_id()));

create policy household_flags_staff_all on public.household_flags
  for all to authenticated
  using  (app.is_staff() and tenant_id = app.jwt_tenant_id())
  with check (app.is_staff() and tenant_id = app.jwt_tenant_id());

create policy customer_activities_staff_read on public.customer_activities
  for select to authenticated
  using (app.is_staff() and tenant_id = app.jwt_tenant_id());
-- Activity feed is append-only via the server; no client write policies.

-- Portal owners: read their own household graph. Internal-only material
-- (notes, flags, internal_notes, activities) deliberately has NO portal
-- policy — the portal API projects a safe subset, as it does today.
create policy households_portal_read on public.households
  for select to authenticated
  using (tenant_id = app.jwt_tenant_id()
         and id = app.jwt_household_id());

create policy contacts_portal_read on public.contacts
  for select to authenticated
  using (tenant_id = app.jwt_tenant_id()
         and household_id = app.jwt_household_id());

create policy pets_portal_read on public.pets
  for select to authenticated
  using (tenant_id = app.jwt_tenant_id()
         and household_id = app.jwt_household_id());

create policy customer_documents_portal_read on public.customer_documents
  for select to authenticated
  using (tenant_id = app.jwt_tenant_id()
         and household_id = app.jwt_household_id());

-- ===========================================================================
-- BACKFILL (stage 1) — commented out. Run only inside the rehearsed runbook
-- after OWNER DECISIONS #2/#6/#7. Order matters: households first (FK target).
-- ===========================================================================
--
-- -- 6a. Households: customer:{t}:household:{id}
-- --     The same prefix also matches nested keys
-- --     (…:household:{hh}:note:{id}, …:flag:{id}) — exclude anything whose
-- --     key has more than 4 segments.
-- insert into public.households
--   (id, tenant_id, external_id, name, status, vip, payment_hold,
--    hold_reason, hold_notes, primary_location_id, primary_contact_id,
--    address, internal_notes, created_by, created_at, updated_at,
--    legacy_kv_key)
-- select
--   value->>'id',
--   split_part(key, ':', 2),
--   value->>'external_id',
--   value->>'name',
--   coalesce(value->>'status','active'),
--   coalesce((value->>'vip')::boolean, false),
--   coalesce((value->>'payment_hold')::boolean, false),
--   value->>'hold_reason',
--   value->>'hold_notes',
--   value->>'primary_location_id',
--   value->>'primary_contact_id',
--   case when jsonb_typeof(value->'address') in ('object','array')
--        then value->'address'
--        else jsonb_build_object('raw', value->>'address') end,
--   value->>'internal_notes',
--   value->>'created_by',
--   coalesce((value->>'created_at')::timestamptz, now()),
--   coalesce((value->>'updated_at')::timestamptz, now()),
--   key
-- from kv_store_fc003b23
-- where key like 'customer:%:household:%'
--   and array_length(string_to_array(key, ':'), 1) = 4
-- on conflict (id) do nothing;
--
-- -- 6b. Contacts: customer:{t}:contact:{hh}:{id}
-- insert into public.contacts
--   (id, tenant_id, household_id, first_name, last_name, email, phone,
--    preferred_contact_method, is_primary, is_emergency_contact,
--    emergency_contact_relationship, marketing_consent, sms_consent,
--    email_consent, created_at, updated_at, legacy_kv_key)
-- select
--   value->>'id',
--   split_part(key, ':', 2),
--   split_part(key, ':', 4),
--   value->>'first_name', value->>'last_name',
--   value->>'email', value->>'phone',
--   value->>'preferred_contact_method',
--   coalesce((value->>'is_primary')::boolean, false),
--   coalesce((value->>'is_emergency_contact')::boolean, false),
--   value->>'emergency_contact_relationship',
--   coalesce((value->>'marketing_consent')::boolean, false),
--   coalesce((value->>'sms_consent')::boolean, false),
--   coalesce((value->>'email_consent')::boolean, false),
--   coalesce((value->>'created_at')::timestamptz, now()),
--   coalesce((value->>'updated_at')::timestamptz, now()),
--   key
-- from kv_store_fc003b23
-- where key like 'customer:%:contact:%'
-- on conflict (id) do nothing;
--
-- -- Pre-index duplicate-primary audit (must return zero rows before
-- -- contacts_one_primary_per_household_uq is created):
-- -- select household_id, count(*) from public.contacts
-- -- where is_primary group by household_id having count(*) > 1;
--
-- -- 6c. Pets: customer:{t}:pet:{hh}:{id}
-- insert into public.pets
--   (id, tenant_id, household_id, name, photo_url, breed, sex,
--    date_of_birth, age_years, microchip, weight_kg, colour, address,
--    neutered_status, behaviour_notes, medical_notes, feeding_instructions,
--    allergies, vet_name, vet_phone, vet_address, vaccination_status,
--    vaccination_expiry_date, daycare_enrolled, grooming_enrolled,
--    transport_enrolled, overnights_enrolled, active, owner_added,
--    verification_status, created_at, updated_at, legacy_kv_key)
-- select
--   value->>'id',
--   split_part(key, ':', 2),
--   split_part(key, ':', 4),
--   value->>'name', value->>'photo_url', value->>'breed', value->>'sex',
--   nullif(value->>'date_of_birth','')::date,
--   nullif(value->>'age_years','')::numeric,
--   value->>'microchip',
--   nullif(value->>'weight_kg','')::numeric,
--   value->>'colour',
--   case when jsonb_typeof(value->'address') in ('object','array')
--        then value->'address'
--        else jsonb_build_object('raw', value->>'address') end,
--   coalesce(value->>'neutered_status','unknown'),
--   value->>'behaviour_notes', value->>'medical_notes',
--   value->>'feeding_instructions', value->>'allergies',
--   value->>'vet_name', value->>'vet_phone', value->>'vet_address',
--   coalesce(value->>'vaccination_status','unknown'),
--   nullif(value->>'vaccination_expiry_date','')::date,
--   coalesce((value->>'daycare_enrolled')::boolean,false),
--   coalesce((value->>'grooming_enrolled')::boolean,false),
--   coalesce((value->>'transport_enrolled')::boolean,false),
--   coalesce((value->>'overnights_enrolled')::boolean,false),
--   coalesce((value->>'active')::boolean,true),
--   coalesce((value->>'owner_added')::boolean,false),
--   coalesce(value->>'verification_status','verified'),
--   coalesce((value->>'created_at')::timestamptz, now()),
--   coalesce((value->>'updated_at')::timestamptz, now()),
--   key
-- from kv_store_fc003b23
-- where key like 'customer:%:pet:%'
-- on conflict (id) do nothing;
--
-- -- 6d. Documents / notes / flags / activities follow the same pattern from
-- --     'customer:%:document:%', 'customer:%:household:%:note:%' (6 segments),
-- --     'customer:%:household:%:flag:%', 'customer:%:note:%:pet:%' (links),
-- --     and both 'customer:%:activity:%' variants (4 AND 5 segments — see
-- --     table comment).
--
-- -- 6e. Parity check (stage 1 verification):
-- -- select 'households', (select count(*) from kv_store_fc003b23
-- --   where key like 'customer:%:household:%'
-- --     and array_length(string_to_array(key,':'),1)=4),
-- --   (select count(*) from public.households);
-- ============================================================================
-- END DRAFT — NOT APPLIED
-- ============================================================================
