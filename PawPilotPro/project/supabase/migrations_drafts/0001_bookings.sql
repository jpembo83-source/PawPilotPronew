-- ============================================================================
-- DRAFT — NOT APPLIED. DO NOT RUN AGAINST ANY ENVIRONMENT.
-- Phase 4 design artefact only (see docs/PHASE4_DATA_MIGRATION.md).
-- This file lives in supabase/migrations_drafts/ (NOT supabase/migrations/)
-- so that no migration tooling can pick it up by accident.
-- ============================================================================
--
-- 0001_bookings.sql — bookings (portal request pipeline + daycare operations)
--
-- Sources of truth for the shapes below (route code, not guesswork):
--   * portal_bookings.ts        — portal_booking:{tenantId}:{id}
--                                 single bookings, bundle_parent, bundle_child
--   * daycare_routes.tsx        — daycare:booking:{id} (DaycareBooking interface),
--                                 daycare:attendance:{id} (AttendanceRecord),
--                                 daycare:event:{id} (DaycareEvent),
--                                 daycare:capacity:{loc}:{date} (derived counters)
--
-- Conventions (see design doc §3):
--   * id / tenant_id are TEXT — legacy IDs mix crypto.randomUUID() and
--     generateId() strings like "dc_1718000000000_ab12cd34e".
--   * FKs are created NOT VALID so a dirty backfill cannot block; validate
--     after orphan triage (OWNER DECISION #6).
--   * legacy_kv_key is kept during the dual-write window for parity audits.
--   * RLS is enabled from day one but edge functions write with the service
--     role (bypasses RLS). Policies are defence in depth + future option.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- JWT claim helpers (shared by all Phase 4 tables; created once here)
-- Role/tenant come from app_metadata ONLY — user_metadata is client-writable.
-- ---------------------------------------------------------------------------
create schema if not exists app;

create or replace function app.jwt_tenant_id() returns text
language sql stable as $$
  select nullif(((auth.jwt() -> 'app_metadata') ->> 'tenant_id'), '')
$$;

create or replace function app.jwt_household_id() returns text
language sql stable as $$
  select nullif(((auth.jwt() -> 'app_metadata') ->> 'household_id'), '')
$$;

create or replace function app.jwt_role() returns text
language sql stable as $$
  select nullif(((auth.jwt() -> 'app_metadata') ->> 'role'), '')
$$;

-- Staff = any authenticated non-portal role within the tenant.
create or replace function app.is_staff() returns boolean
language sql stable as $$
  select app.jwt_role() in ('admin','manager','assistant_manager','staff')
$$;

-- ===========================================================================
-- 1. bookings — portal booking requests (portal_booking:{tenantId}:{id})
--
-- Observed shape (portal_bookings.ts:298-352 bundle, 417-435 single):
--   id, tenantId, householdId, kind?, parentBookingId?, childIds[],
--   service, services[], petIds[], petNames[], startAt, endAt, locationId,
--   status('pending'|...|'confirmed'|'declined'|'cancelled'), notes,
--   ownerSubmitted, requestId, submittedBy, createdAt, updatedAt
-- Bundles become a self-reference (parent_booking_id) instead of childIds[];
-- petIds[] becomes the booking_pets join table; petNames[] is denormalised
-- cache and is dropped (OWNER DECISION #7).
-- ===========================================================================
create table if not exists public.bookings (
  id                 text primary key default gen_random_uuid()::text,
  tenant_id          text not null,
  household_id       text not null,
  -- 'single' for rows written without a kind field (pre-Phase-D back-compat)
  kind               text not null default 'single'
                       check (kind in ('single','bundle_parent','bundle_child')),
  parent_booking_id  text references public.bookings(id) on delete cascade,
  service            text not null,           -- 'daycare' | 'grooming' | 'transport' | ...
  start_at           timestamptz not null,
  end_at             timestamptz not null,
  location_id        text,
  status             text not null default 'pending'
                       check (status in ('pending','confirmed','declined','cancelled','completed')),
  notes              text,
  owner_submitted    boolean not null default false,
  request_id         text,                    -- client idempotency key
  submitted_by       text,                    -- auth user id
  decline_reason     text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  legacy_kv_key      text,                    -- dropped at stage 4

  constraint bookings_child_has_parent
    check (kind <> 'bundle_child' or parent_booking_id is not null),
  constraint bookings_window check (end_at >= start_at)
);

-- Idempotency: today this is a full prefix-scan for matching requestId
-- (portal_bookings.ts:223-225). A partial unique index makes the dedupe an
-- index lookup and closes the replay race for free.
create unique index if not exists bookings_request_id_uq
  on public.bookings (tenant_id, request_id)
  where request_id is not null and kind <> 'bundle_child';

-- Owner list view: tenant + household, children hidden, split upcoming/past
-- by end_at and sorted by start_at (portal_bookings.ts:180-189).
create index if not exists bookings_household_idx
  on public.bookings (tenant_id, household_id, start_at desc)
  where kind <> 'bundle_child';

-- Staff queue view: tenant-wide by status/date (portal_bookings.ts:790+, 933).
create index if not exists bookings_tenant_status_idx
  on public.bookings (tenant_id, status, start_at);

-- Bundle hydration: children by parent (portal_bookings.ts:202-206, 1015+).
create index if not exists bookings_parent_idx
  on public.bookings (parent_booking_id)
  where parent_booking_id is not null;

-- ---------------------------------------------------------------------------
-- booking_pets — replaces petIds[] (same-day-conflict check joins on this:
-- findSameDayConflict() does service+day+pet-overlap, portal_bookings.ts:150-166)
-- ---------------------------------------------------------------------------
create table if not exists public.booking_pets (
  booking_id  text not null references public.bookings(id) on delete cascade,
  pet_id      text not null,   -- FK to pets added NOT VALID in 0002
  primary key (booking_id, pet_id)
);

create index if not exists booking_pets_pet_idx on public.booking_pets (pet_id);

-- FK to pets is declared here NOT VALID; pets table ships in 0002_customers.sql.
-- (Kept as a comment until both drafts are approved together.)
-- alter table public.booking_pets
--   add constraint booking_pets_pet_fk
--   foreign key (pet_id) references public.pets(id) on delete restrict not valid;

-- ===========================================================================
-- 2. daycare_bookings — operational daycare bookings (daycare:booking:{id})
--
-- Shape from the DaycareBooking interface (daycare_routes.tsx:39-93).
-- The three hand-rolled index key families are replaced by real indexes:
--   daycare:booking:date:{loc}:{date}:{id}      -> daycare_bookings_date_idx
--   daycare:booking:pet:{petId}:{id}            -> daycare_bookings_pet_idx
--   daycare:booking:household:{hh}:{id}         -> daycare_bookings_household_idx
-- NOTE: tenant_id is OPTIONAL in the interface and absent from the key —
-- backfill must stamp the canonical tenant (OWNER DECISION #2).
-- Denormalised *_name fields are dropped per OWNER DECISION #7 (kept here as
-- comments so the mapping from the blob is explicit).
-- ===========================================================================
create table if not exists public.daycare_bookings (
  id                    text primary key default gen_random_uuid()::text,
  tenant_id             text not null,
  household_id          text not null,        -- household_name dropped (join)
  pet_id                text not null,        -- pet_name / pet_photo_url dropped (join)
  location_id           text not null,        -- location_name dropped (join)
  service_id            text not null,        -- service_name dropped (join)
  service_type          text not null
                          check (service_type in ('hourly','half_day','full_day','trial_day','membership')),
  booking_date          date not null,
  planned_start_time    time,
  planned_end_time      time,
  booking_status        text not null default 'requested'
                          check (booking_status in ('requested','confirmed','cancelled','no_show','completed')),
  check_in_status       text not null default 'not_checked_in'
                          check (check_in_status in ('not_checked_in','checked_in','checked_out')),
  actual_check_in_time  timestamptz,
  actual_check_out_time timestamptz,
  checked_in_by_id      text,
  checked_out_by_id     text,
  notes                 text,
  customer_notes        text,
  handover_notes        text,
  checkout_notes        text,
  capacity_slot         integer,
  has_behaviour_flag    boolean not null default false,
  has_medical_flag      boolean not null default false,
  behaviour_notes       text,
  medical_notes         text,
  vaccination_status    text not null default 'missing'
                          check (vaccination_status in ('valid','expiring_soon','expired','missing')),
  waiver_status         text not null default 'missing'
                          check (waiver_status in ('valid','expiring_soon','expired','missing')),
  has_booking_hold      boolean not null default false,
  has_payment_hold      boolean not null default false,
  hold_reason           text,
  base_price_locked     numeric(10,2) not null default 0,
  tax_rate              numeric(6,4)  not null default 0,
  total_price           numeric(10,2) not null default 0,
  currency              text not null default 'GBP',
  billing_line_item_ids jsonb not null default '[]'::jsonb, -- until billing migrates (0004+)
  requires_transport    boolean not null default false,
  transport_pickup_id   text,
  transport_dropoff_id  text,
  portal_booking_id     text references public.bookings(id), -- link to originating portal request (today: implicit/duplicated)
  created_by_id         text not null,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  cancelled_at          timestamptz,
  cancelled_by_id       text,
  cancellation_reason   text,
  legacy_kv_key         text
);

-- Replaces daycare:booking:date:{loc}:{date}:{id} — the register/day-sheet
-- query (daycare_routes.tsx:700+, 1473: getByPrefix then filter by date+loc).
create index if not exists daycare_bookings_date_idx
  on public.daycare_bookings (tenant_id, location_id, booking_date, booking_status);

-- Replaces daycare:booking:pet:{petId}:{id}.
create index if not exists daycare_bookings_pet_idx
  on public.daycare_bookings (pet_id, booking_date desc);

-- Replaces daycare:booking:household:{hh}:{id}.
create index if not exists daycare_bookings_household_idx
  on public.daycare_bookings (household_id, booking_date desc);

-- ===========================================================================
-- 3. daycare_attendance — live register (daycare:attendance:{id})
--
-- Shape from AttendanceRecord (daycare_routes.tsx:95-119). Replaces:
--   daycare:attendance:active:{loc}:{id}  -> partial index on status
--   daycare:attendance:booking:{bookingId} -> unique index on booking_id
-- ===========================================================================
create table if not exists public.daycare_attendance (
  id                  text primary key default gen_random_uuid()::text,
  tenant_id           text not null,
  booking_id          text not null references public.daycare_bookings(id) on delete cascade,
  pet_id              text not null,
  household_id        text not null,
  location_id         text not null,
  check_in_time       timestamptz not null,
  check_out_time      timestamptz,
  duration_minutes    integer,
  assigned_group      text,
  assigned_area       text,
  checked_in_by_id    text not null,
  checked_out_by_id   text,
  has_behaviour_flag  boolean not null default false,
  has_medical_flag    boolean not null default false,
  behaviour_notes     text,
  medical_notes       text,
  notes               jsonb not null default '[]'::jsonb,
  status              text not null default 'in_daycare'
                        check (status in ('in_daycare','checked_out')),
  legacy_kv_key       text
);

-- One live attendance row per booking (today enforced by hope).
create unique index if not exists daycare_attendance_booking_uq
  on public.daycare_attendance (booking_id);

-- "Who is in the building right now" (daycare_routes.tsx:1416-1442).
create index if not exists daycare_attendance_active_idx
  on public.daycare_attendance (tenant_id, location_id)
  where status = 'in_daycare';

-- ===========================================================================
-- 4. daycare_events — operational audit trail (daycare:event:{id})
--
-- Shape from DaycareEvent (daycare_routes.tsx:27-37). Replaces index keys
-- daycare:event:booking:{bookingId}:{id} and daycare:event:location:{loc}:{id}.
-- Candidate for later folding into the unified audit_events table
-- (OWNER DECISION #8); kept separate here because routes query it directly.
-- ===========================================================================
create table if not exists public.daycare_events (
  id            text primary key default gen_random_uuid()::text,
  tenant_id     text not null,
  booking_id    text references public.daycare_bookings(id) on delete set null,
  location_id   text not null,
  event_type    text not null
                  check (event_type in ('booking_created','booking_cancelled','checked_in',
                                        'checked_out','capacity_override','booking_updated')),
  actor_id      text not null,
  actor_name    text not null,   -- kept: audit records should freeze actor identity
  description   text not null,
  metadata      jsonb,
  occurred_at   timestamptz not null default now(),
  legacy_kv_key text
);

create index if not exists daycare_events_booking_idx
  on public.daycare_events (booking_id, occurred_at desc);
create index if not exists daycare_events_location_idx
  on public.daycare_events (tenant_id, location_id, occurred_at desc);

-- ===========================================================================
-- 5. Capacity — daycare:capacity:{loc}:{date} is DELETED as stored state.
--
-- Today it is a read-modify-write counter blob (daycare_routes.tsx:176-208,
-- 965-974, 1191-1201) with lost-update races. It becomes a derived view;
-- max capacity stays in settings (settings:location:{id} keeps living in KV).
-- If profiling shows this view is hot, promote to a materialised view or a
-- counter row updated atomically in the booking transaction.
-- ===========================================================================
create or replace view public.daycare_capacity_v as
select
  b.tenant_id,
  b.location_id,
  b.booking_date,
  count(*) filter (where b.booking_status in ('requested','confirmed'))  as current_bookings,
  count(*) filter (where b.check_in_status = 'checked_in')               as current_checked_in
from public.daycare_bookings b
group by b.tenant_id, b.location_id, b.booking_date;

-- ===========================================================================
-- RLS — tenant isolation + portal-household read.
-- Edge functions use the service role and BYPASS all of this (by design,
-- Phase 4 keeps them the sole writer). Policies exist as defence in depth
-- and to enable optional direct portal reads later (OWNER DECISION #1).
-- ===========================================================================
alter table public.bookings           enable row level security;
alter table public.booking_pets       enable row level security;
alter table public.daycare_bookings   enable row level security;
alter table public.daycare_attendance enable row level security;
alter table public.daycare_events     enable row level security;

-- Staff: full access within their tenant.
create policy bookings_staff_all on public.bookings
  for all to authenticated
  using  (app.is_staff() and tenant_id = app.jwt_tenant_id())
  with check (app.is_staff() and tenant_id = app.jwt_tenant_id());

-- Portal owners: read only their own household's bookings.
-- Requires household_id stamped into app_metadata (OWNER DECISION #1).
create policy bookings_portal_read on public.bookings
  for select to authenticated
  using (tenant_id = app.jwt_tenant_id()
         and household_id = app.jwt_household_id());

create policy booking_pets_staff_all on public.booking_pets
  for all to authenticated
  using (exists (select 1 from public.bookings b
                 where b.id = booking_id
                   and app.is_staff() and b.tenant_id = app.jwt_tenant_id()))
  with check (exists (select 1 from public.bookings b
                      where b.id = booking_id
                        and app.is_staff() and b.tenant_id = app.jwt_tenant_id()));

create policy booking_pets_portal_read on public.booking_pets
  for select to authenticated
  using (exists (select 1 from public.bookings b
                 where b.id = booking_id
                   and b.tenant_id = app.jwt_tenant_id()
                   and b.household_id = app.jwt_household_id()));

create policy daycare_bookings_staff_all on public.daycare_bookings
  for all to authenticated
  using  (app.is_staff() and tenant_id = app.jwt_tenant_id())
  with check (app.is_staff() and tenant_id = app.jwt_tenant_id());

create policy daycare_bookings_portal_read on public.daycare_bookings
  for select to authenticated
  using (tenant_id = app.jwt_tenant_id()
         and household_id = app.jwt_household_id());

create policy daycare_attendance_staff_all on public.daycare_attendance
  for all to authenticated
  using  (app.is_staff() and tenant_id = app.jwt_tenant_id())
  with check (app.is_staff() and tenant_id = app.jwt_tenant_id());

-- Attendance is operational data; portal owners do not read it directly
-- (the portal projects booking status instead). No portal policy on purpose.

create policy daycare_events_staff_read on public.daycare_events
  for select to authenticated
  using (app.is_staff() and tenant_id = app.jwt_tenant_id());
-- Events are append-only via the server; no insert/update/delete policies.

-- ===========================================================================
-- BACKFILL (stage 1) — commented out. Run only after OWNER DECISIONS #2/#6/#7
-- and only inside the rehearsed runbook. Shown here to prove the JSONB
-- mapping is complete.
-- ===========================================================================
--
-- -- 5a. Portal bookings: portal_booking:{tenantId}:{id}
-- --     Key gives tenant; blob gives everything else. Parents must be
-- --     inserted before children (self-FK), hence the two ordered passes.
-- insert into public.bookings
--   (id, tenant_id, household_id, kind, parent_booking_id, service,
--    start_at, end_at, location_id, status, notes, owner_submitted,
--    request_id, submitted_by, created_at, updated_at, legacy_kv_key)
-- select
--   value->>'id',
--   split_part(key, ':', 2),                       -- tenantId from key
--   value->>'householdId',
--   coalesce(value->>'kind', 'single'),
--   value->>'parentBookingId',
--   value->>'service',
--   (value->>'startAt')::timestamptz,
--   (value->>'endAt')::timestamptz,
--   value->>'locationId',
--   coalesce(value->>'status', 'pending'),
--   value->>'notes',
--   coalesce((value->>'ownerSubmitted')::boolean, false),
--   value->>'requestId',
--   value->>'submittedBy',
--   coalesce((value->>'createdAt')::timestamptz, now()),
--   coalesce((value->>'updatedAt')::timestamptz, now()),
--   key
-- from kv_store_fc003b23
-- where key like 'portal_booking:%'
--   and coalesce(value->>'kind', 'single') <> 'bundle_child'
-- on conflict (id) do nothing;
--
-- insert into public.bookings (...)                -- second pass: children
-- select ... from kv_store_fc003b23
-- where key like 'portal_booking:%'
--   and value->>'kind' = 'bundle_child'
-- on conflict (id) do nothing;
--
-- -- 5b. Booking pets from the petIds[] array.
-- insert into public.booking_pets (booking_id, pet_id)
-- select value->>'id', pet_id
-- from kv_store_fc003b23,
--      lateral jsonb_array_elements_text(value->'petIds') as pet_id
-- where key like 'portal_booking:%'
-- on conflict do nothing;
--
-- -- 5c. Daycare bookings: daycare:booking:{id}. The same prefix also holds
-- --     index entries (daycare:booking:date:..., :pet:..., :household:...)
-- --     whose values are bare id strings — exclude by requiring an object
-- --     with an id field (mirrors the route-side filter at
-- --     daycare_routes.tsx:705).
-- insert into public.daycare_bookings
--   (id, tenant_id, household_id, pet_id, location_id, service_id,
--    service_type, booking_date, planned_start_time, planned_end_time,
--    booking_status, check_in_status, actual_check_in_time,
--    actual_check_out_time, checked_in_by_id, checked_out_by_id,
--    notes, customer_notes, handover_notes, checkout_notes, capacity_slot,
--    has_behaviour_flag, has_medical_flag, behaviour_notes, medical_notes,
--    vaccination_status, waiver_status, has_booking_hold, has_payment_hold,
--    hold_reason, base_price_locked, tax_rate, total_price, currency,
--    billing_line_item_ids, requires_transport, transport_pickup_id,
--    transport_dropoff_id, created_by_id, created_at, updated_at,
--    cancelled_at, cancelled_by_id, cancellation_reason, legacy_kv_key)
-- select
--   value->>'id',
--   coalesce(value->>'tenant_id', :'canonical_tenant'), -- OWNER DECISION #2
--   value->>'household_id',
--   value->>'pet_id',
--   value->>'location_id',
--   value->>'service_id',
--   value->>'service_type',
--   (value->>'booking_date')::date,
--   nullif(value->>'planned_start_time','')::time,
--   nullif(value->>'planned_end_time','')::time,
--   coalesce(value->>'booking_status','requested'),
--   coalesce(value->>'check_in_status','not_checked_in'),
--   nullif(value->>'actual_check_in_time','')::timestamptz,
--   nullif(value->>'actual_check_out_time','')::timestamptz,
--   value->>'checked_in_by_id',
--   value->>'checked_out_by_id',
--   value->>'notes', value->>'customer_notes',
--   value->>'handover_notes', value->>'checkout_notes',
--   nullif(value->>'capacity_slot','')::integer,
--   coalesce((value->>'has_behaviour_flag')::boolean,false),
--   coalesce((value->>'has_medical_flag')::boolean,false),
--   value->>'behaviour_notes', value->>'medical_notes',
--   coalesce(value->>'vaccination_status','missing'),
--   coalesce(value->>'waiver_status','missing'),
--   coalesce((value->>'has_booking_hold')::boolean,false),
--   coalesce((value->>'has_payment_hold')::boolean,false),
--   value->>'hold_reason',
--   coalesce((value->>'base_price_locked')::numeric,0),
--   coalesce((value->>'tax_rate')::numeric,0),
--   coalesce((value->>'total_price')::numeric,0),
--   coalesce(value->>'currency','GBP'),
--   coalesce(value->'billing_line_item_ids','[]'::jsonb),
--   coalesce((value->>'requires_transport')::boolean,false),
--   value->>'transport_pickup_id', value->>'transport_dropoff_id',
--   value->>'created_by_id',
--   coalesce((value->>'created_at')::timestamptz, now()),
--   coalesce((value->>'updated_at')::timestamptz, now()),
--   nullif(value->>'cancelled_at','')::timestamptz,
--   value->>'cancelled_by_id', value->>'cancellation_reason',
--   key
-- from kv_store_fc003b23
-- where key like 'daycare:booking:%'
--   and jsonb_typeof(value) = 'object'
--   and value ? 'id'                               -- excludes bare-id index rows
-- on conflict (id) do nothing;
--
-- -- 5d. Attendance + events follow the same pattern from
-- --     'daycare:attendance:%' / 'daycare:event:%' (excluding index rows,
-- --     which are bare strings: jsonb_typeof(value) = 'object').
--
-- -- 5e. Parity check (stage 1 verification):
-- -- select (select count(*) from kv_store_fc003b23
-- --          where key like 'portal_booking:%') as kv,
-- --        (select count(*) from public.bookings) as pg;
-- ============================================================================
-- END DRAFT — NOT APPLIED
-- ============================================================================
