-- ============================================================================
-- Phase 4 / Customers — STAGE 1: one-off KV → Postgres backfill.
-- (docs/PHASE4_DATA_MIGRATION.md §4 stage 1; ratified decisions §7)
--
-- Copies every `customer:*` key family out of kv_store_fc003b23 into the
-- stage-0 tables (20260611201256_phase4_customers_stage0.sql). KV remains
-- authoritative — nothing reads these tables yet, no route changes, no
-- dual-write. Reads stay on KV for this entire branch.
--
-- Properties:
--   * Idempotent / re-runnable: every insert is ON CONFLICT DO NOTHING and
--     re-runs converge (a key fixed in KV after being quarantined migrates on
--     the next run and is removed from its quarantine table).
--   * Nothing is force-inserted. A KV record that fails the frozen contract
--     (shared/schemas/customers.ts) or references a missing parent is
--     diverted, byte-for-byte, into a *_orphaned quarantine table with a
--     reason. Quarantine tables have RLS enabled and NO policies: only the
--     service role / owner can touch them.
--   * legacy_kv_key on every migrated row = the exact source KV key.
--   * tenant_id is stamped from the key's {t} segment. Production is
--     single-tenant (ratified §7.2): keys whose tenant segment is not
--     'demo-tenant-001' are quarantined with reason 'non_canonical_tenant'
--     (owner decision 2026-07-02 — one legacy household graph written under
--     stale tenant ids ee4c3a1d-… / demo-tenant; preserved for later triage).
--   * ~25% of prod customer keys are double-JSON-encoded (value is a jsonb
--     string containing the object — an older write path). These are decoded
--     transparently; values that do not decode to an object are quarantined.
--   * Denormalised name fields are dropped (drop-and-join, §7.7):
--     created_by_name on notes/flags, deleted_by on notes, activity metadata,
--     contact address_* extras, pet photoUrl/photo_updated_* extras are NOT
--     copied. customer_activities keeps created_by_name (its table retains
--     the column — append-only feed, names are point-in-time by design).
--   * ABORTS (raise exception) if any household would carry two is_primary
--     contacts — the partial unique index would reject them and the owner
--     wants duplicates fixed in KV, not silently resolved (stop condition).
--   * After the inserts, the one NOT VALID FK from stage 0
--     (households.primary_contact_id → contacts) is repaired (dangling
--     pointers nulled + recorded in customers_backfill_fixups) and VALIDATEd.
--
-- APPLYING TO PROD IS A MANUAL, PITR-GATED STEP (ops-customers-stage0.md):
-- rehearse on a Supabase branch DB first; never run here by CI.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 0. Quarantine + audit tables (permanent until stage 4 decommission).
--    Uniform shape: the untouched KV pair + why it was diverted.
-- ---------------------------------------------------------------------------

create table if not exists public.households_orphaned (
  legacy_kv_key  text primary key,
  value          jsonb not null,
  reason         text not null,
  quarantined_at timestamptz not null default now()
);
create table if not exists public.contacts_orphaned          (like public.households_orphaned including all);
create table if not exists public.pets_orphaned              (like public.households_orphaned including all);
create table if not exists public.customer_documents_orphaned(like public.households_orphaned including all);
create table if not exists public.household_notes_orphaned   (like public.households_orphaned including all);
create table if not exists public.note_pets_orphaned         (like public.households_orphaned including all);
create table if not exists public.household_flags_orphaned   (like public.households_orphaned including all);
create table if not exists public.customer_activities_orphaned(like public.households_orphaned including all);
-- Catch-all for customer:* keys that match no known family shape.
create table if not exists public.customer_keys_orphaned     (like public.households_orphaned including all);

-- Data repairs the backfill had to make on migrated rows (kept for parity
-- auditing; the parity script excludes these column/row pairs from diffing).
create table if not exists public.customers_backfill_fixups (
  legacy_kv_key text not null,
  table_name    text not null,
  column_name   text not null,
  old_value     text,
  reason        text not null,
  fixed_at      timestamptz not null default now(),
  primary key (legacy_kv_key, table_name, column_name)
);

alter table public.households_orphaned          enable row level security;
alter table public.contacts_orphaned            enable row level security;
alter table public.pets_orphaned                enable row level security;
alter table public.customer_documents_orphaned  enable row level security;
alter table public.household_notes_orphaned     enable row level security;
alter table public.note_pets_orphaned           enable row level security;
alter table public.household_flags_orphaned     enable row level security;
alter table public.customer_activities_orphaned enable row level security;
alter table public.customer_keys_orphaned       enable row level security;
alter table public.customers_backfill_fixups    enable row level security;
-- No policies on purpose: service-role / owner access only.

-- ---------------------------------------------------------------------------
-- 1. Scratch schema: safe-cast helpers + decoded/classified KV snapshot.
--    Dropped at the end; drop first so a previously aborted run can't leak in.
-- ---------------------------------------------------------------------------

drop schema if exists phase4_backfill cascade;
create schema phase4_backfill;

create function phase4_backfill.try_jsonb(t text) returns jsonb
language plpgsql immutable set search_path = '' as $$
begin return t::jsonb; exception when others then return null; end $$;

-- Timestamp/date parsing mirrors the FROZEN CONTRACT, not Postgres:
-- z.string().datetime() accepts only ISO-8601 UTC ("…T…Z"), z isoDate only
-- "YYYY-MM-DD". A bare ::timestamptz cast would also accept 'yesterday',
-- 'now', offsets, etc. (caught in rehearsal) — those must quarantine, exactly
-- as they would fail the Zod schema.
-- stable, not immutable: text→timestamptz/date casts read DateStyle/TimeZone.
create function phase4_backfill.iso_ts(t text) returns timestamptz
language plpgsql stable set search_path = '' as $$
begin
  if t !~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$' then
    return null;
  end if;
  return t::timestamptz;
exception when others then return null;
end $$;

create function phase4_backfill.iso_date(t text) returns date
language plpgsql stable set search_path = '' as $$
begin
  if t !~ '^\d{4}-\d{2}-\d{2}$' then
    return null;
  end if;
  return t::date;
exception when others then return null;
end $$;

create function phase4_backfill.try_num(t text) returns numeric
language plpgsql immutable set search_path = '' as $$
begin return t::numeric; exception when others then return null; end $$;

create function phase4_backfill.try_bool(t text) returns boolean
language plpgsql immutable set search_path = '' as $$
begin return t::boolean; exception when others then return null; end $$;

-- "Field present but not castable" — the quarantine trigger for typed
-- optionals (nulls and absent fields are fine; garbage is not force-inserted).
create function phase4_backfill.bad_bool(v jsonb, f text) returns boolean
language sql immutable set search_path = '' as
$$ select v->>f is not null and phase4_backfill.try_bool(v->>f) is null $$;

create function phase4_backfill.bad_ts(v jsonb, f text) returns boolean
language sql stable set search_path = '' as
$$ select v->>f is not null and phase4_backfill.iso_ts(v->>f) is null $$;

create function phase4_backfill.bad_date(v jsonb, f text) returns boolean
language sql stable set search_path = '' as
$$ select v->>f is not null and phase4_backfill.iso_date(v->>f) is null $$;

create function phase4_backfill.bad_num(v jsonb, f text) returns boolean
language sql immutable set search_path = '' as
$$ select v->>f is not null and phase4_backfill.try_num(v->>f) is null $$;

-- Decoded + classified snapshot of every customer:* key.
-- v is the usable object (double-encoded strings unwrapped); v may be NULL
-- when the value is a string that does not parse back to JSON.
create table phase4_backfill.kv as
select
  key,
  value as raw_value,
  segs,
  array_length(segs, 1) as nseg,
  case
    when jsonb_typeof(value) = 'string' then phase4_backfill.try_jsonb(value #>> '{}')
    else value
  end as v,
  case
    when segs[3] = 'household' and array_length(segs,1) = 4 then 'household'
    when segs[3] = 'contact'   and array_length(segs,1) = 5 then 'contact'
    when segs[3] = 'pet'       and array_length(segs,1) = 5 then 'pet'
    when segs[3] = 'document'  and array_length(segs,1) = 5 then 'document'
    when segs[3] = 'household' and array_length(segs,1) = 6 and segs[5] = 'note' then 'note'
    when segs[3] = 'household' and array_length(segs,1) = 6 and segs[5] = 'flag' then 'flag'
    when segs[3] = 'note'      and array_length(segs,1) = 6 and segs[5] = 'pet'  then 'note_pet'
    when segs[3] = 'activity'  and array_length(segs,1) in (4, 5) then 'activity'
    else 'unclassified'
  end as family
from public.kv_store_fc003b23,
     lateral (select string_to_array(key, ':') as segs) s
where key like 'customer:%';

-- Shared first-gate checks, identical for every family.
create function phase4_backfill.base_reject(v jsonb, tenant text) returns text
language sql immutable set search_path = '' as $$
  select case
    when v is null or jsonb_typeof(v) <> 'object' then 'undecodable_value'
    when tenant <> 'demo-tenant-001' then 'non_canonical_tenant'
  end
$$;

-- ---------------------------------------------------------------------------
-- 2. Keys matching no family: straight to quarantine.
-- ---------------------------------------------------------------------------

insert into public.customer_keys_orphaned (legacy_kv_key, value, reason)
select key, raw_value, 'unclassified_key'
from phase4_backfill.kv
where family = 'unclassified'
on conflict (legacy_kv_key) do nothing;

-- ---------------------------------------------------------------------------
-- 3. households — customer:{t}:household:{id}
-- ---------------------------------------------------------------------------

create table phase4_backfill.hh as
select key, raw_value, segs, v,
  coalesce(
    phase4_backfill.base_reject(v, segs[2]),
    case
      when row_number() over (partition by segs[4] order by key) > 1 then 'duplicate_id'
      when coalesce(v->>'id', '') = '' then 'missing_id'
      when v->>'id' <> segs[4] then 'id_key_mismatch'
      when v->>'tenant_id' is not null and v->>'tenant_id' <> segs[2] then 'tenant_key_mismatch'
      when coalesce(v->>'name', '') = '' then 'missing_name'
      when phase4_backfill.iso_ts(v->>'created_at') is null then 'invalid_created_at'
      when phase4_backfill.iso_ts(v->>'updated_at') is null then 'invalid_updated_at'
      when phase4_backfill.bad_bool(v, 'vip')
        or phase4_backfill.bad_bool(v, 'payment_hold') then 'invalid_boolean'
    end
  ) as reject_reason
from phase4_backfill.kv
where family = 'household';

insert into public.households_orphaned (legacy_kv_key, value, reason)
select key, raw_value, reject_reason
from phase4_backfill.hh
where reject_reason is not null
on conflict (legacy_kv_key) do nothing;

-- primary_contact_id inserts as NULL: the households→contacts FK is NOT VALID
-- but NOT VALID only exempts pre-existing rows — new inserts are still
-- enforced, and contacts cannot exist before their households. The pointer is
-- restored in step 4b once contacts are in; dangling pointers become fixups.
insert into public.households
  (id, tenant_id, external_id, name, status, vip, payment_hold, hold_reason,
   hold_notes, primary_location_id, primary_contact_id, address,
   internal_notes, created_by, created_at, updated_at, legacy_kv_key)
select
  segs[4],
  segs[2],
  v->>'external_id',
  v->>'name',
  coalesce(v->>'status', 'active'),
  coalesce(phase4_backfill.try_bool(v->>'vip'), false),
  coalesce(phase4_backfill.try_bool(v->>'payment_hold'), false),
  v->>'hold_reason',
  v->>'hold_notes',
  v->>'primary_location_id',
  null,                            -- restored in step 4b (see comment above)
  v->'address',                    -- jsonb as-found (object, array or string)
  v->>'internal_notes',
  v->>'created_by',
  phase4_backfill.iso_ts(v->>'created_at'),
  phase4_backfill.iso_ts(v->>'updated_at'),
  key
from phase4_backfill.hh
where reject_reason is null
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- 4. contacts — customer:{t}:contact:{hh}:{id}
-- ---------------------------------------------------------------------------

create table phase4_backfill.con as
select key, raw_value, segs, v,
  coalesce(
    phase4_backfill.base_reject(v, segs[2]),
    case
      when row_number() over (partition by segs[5] order by key) > 1 then 'duplicate_id'
      when coalesce(v->>'id', '') = '' then 'missing_id'
      when v->>'id' <> segs[5] then 'id_key_mismatch'
      when v->>'tenant_id' is not null and v->>'tenant_id' <> segs[2] then 'tenant_key_mismatch'
      when v->>'household_id' is not null and v->>'household_id' <> segs[4] then 'household_key_mismatch'
      when not exists (select 1 from public.households h where h.id = segs[4]) then 'missing_household'
      when coalesce(v->>'first_name', '') = '' then 'missing_first_name'
      when coalesce(v->>'last_name', '') = '' then 'missing_last_name'
      when phase4_backfill.iso_ts(v->>'created_at') is null then 'invalid_created_at'
      when phase4_backfill.iso_ts(v->>'updated_at') is null then 'invalid_updated_at'
      when phase4_backfill.bad_bool(v, 'is_primary')
        or phase4_backfill.bad_bool(v, 'is_emergency_contact')
        or phase4_backfill.bad_bool(v, 'marketing_consent')
        or phase4_backfill.bad_bool(v, 'sms_consent')
        or phase4_backfill.bad_bool(v, 'email_consent') then 'invalid_boolean'
    end
  ) as reject_reason
from phase4_backfill.kv
where family = 'contact';

-- STOP CONDITION (ops-customers-stage0.md): two is_primary contacts in one
-- household would violate contacts_one_primary_per_household_uq. Abort with
-- the offending households listed — fix KV, do not pick a winner here.
do $$
declare offenders text;
begin
  select string_agg(hh || ' (' || n || ' primary contacts)', ', ')
    into offenders
  from (
    select segs[4] as hh, count(*) as n
    from phase4_backfill.con
    where reject_reason is null
      and coalesce(phase4_backfill.try_bool(v->>'is_primary'), false)
    group by segs[4]
    having count(*) > 1
  ) dup;
  if offenders is not null then
    raise exception
      'phase4 customers backfill ABORTED: duplicate is_primary contacts — resolve in KV first: %',
      offenders;
  end if;
end $$;

insert into public.contacts_orphaned (legacy_kv_key, value, reason)
select key, raw_value, reject_reason
from phase4_backfill.con
where reject_reason is not null
on conflict (legacy_kv_key) do nothing;

insert into public.contacts
  (id, tenant_id, household_id, first_name, last_name, email, phone,
   preferred_contact_method, is_primary, is_emergency_contact,
   emergency_contact_relationship, marketing_consent, sms_consent,
   email_consent, created_at, updated_at, legacy_kv_key)
select
  segs[5],
  segs[2],
  segs[4],
  v->>'first_name',
  v->>'last_name',
  v->>'email',
  v->>'phone',
  v->>'preferred_contact_method',
  coalesce(phase4_backfill.try_bool(v->>'is_primary'), false),
  coalesce(phase4_backfill.try_bool(v->>'is_emergency_contact'), false),
  v->>'emergency_contact_relationship',
  coalesce(phase4_backfill.try_bool(v->>'marketing_consent'), false),
  coalesce(phase4_backfill.try_bool(v->>'sms_consent'), false),
  coalesce(phase4_backfill.try_bool(v->>'email_consent'), false),
  phase4_backfill.iso_ts(v->>'created_at'),
  phase4_backfill.iso_ts(v->>'updated_at'),
  key
from phase4_backfill.con
where reject_reason is null
on conflict (id) do nothing;

-- ---- 4b. Restore households.primary_contact_id now that contacts exist ----
update public.households h
set primary_contact_id = s.pcid
from (
  select segs[4] as hh_id, v->>'primary_contact_id' as pcid
  from phase4_backfill.hh
  where reject_reason is null
) s
where h.id = s.hh_id
  and h.legacy_kv_key is not null
  and h.primary_contact_id is distinct from s.pcid
  and s.pcid is not null
  and exists (select 1 from public.contacts c where c.id = s.pcid);

-- ---------------------------------------------------------------------------
-- 5. pets — customer:{t}:pet:{hh}:{id}
--    numeric(5,2)/numeric(6,2) range guards prevent insert-time overflow;
--    out-of-range values are data errors → quarantine, not truncation.
--
--    photo_path was added to the KV record AFTER stage 0 shipped (private
--    pet-photo bucket work: bucket references persist as a storage path,
--    never a URL, and legacy photo_url/photoUrl are cleared on write — see
--    lib/pet_photos.ts). The column is added here so the canonical photo
--    reference is not dropped; photo_url still carries external URLs only.
-- ---------------------------------------------------------------------------

alter table public.pets add column if not exists photo_path text;

create table phase4_backfill.pet as
select key, raw_value, segs, v,
  coalesce(
    phase4_backfill.base_reject(v, segs[2]),
    case
      when row_number() over (partition by segs[5] order by key) > 1 then 'duplicate_id'
      when coalesce(v->>'id', '') = '' then 'missing_id'
      when v->>'id' <> segs[5] then 'id_key_mismatch'
      when v->>'tenant_id' is not null and v->>'tenant_id' <> segs[2] then 'tenant_key_mismatch'
      when v->>'household_id' is not null and v->>'household_id' <> segs[4] then 'household_key_mismatch'
      when not exists (select 1 from public.households h where h.id = segs[4]) then 'missing_household'
      when coalesce(v->>'name', '') = '' then 'missing_name'
      when v->>'verification_status' is not null
        and v->>'verification_status' not in ('verified', 'pending_staff_review', 'rejected')
        then 'invalid_verification_status'
      when phase4_backfill.iso_ts(v->>'created_at') is null then 'invalid_created_at'
      when phase4_backfill.iso_ts(v->>'updated_at') is null then 'invalid_updated_at'
      when phase4_backfill.bad_date(v, 'date_of_birth')
        or phase4_backfill.bad_date(v, 'vaccination_expiry_date') then 'invalid_date'
      when phase4_backfill.bad_num(v, 'age_years')
        or abs(coalesce(phase4_backfill.try_num(v->>'age_years'), 0)) >= 1000
        then 'invalid_numeric'
      when phase4_backfill.bad_num(v, 'weight_kg')
        or abs(coalesce(phase4_backfill.try_num(v->>'weight_kg'), 0)) >= 10000
        then 'invalid_numeric'
      when phase4_backfill.bad_bool(v, 'daycare_enrolled')
        or phase4_backfill.bad_bool(v, 'grooming_enrolled')
        or phase4_backfill.bad_bool(v, 'transport_enrolled')
        or phase4_backfill.bad_bool(v, 'overnights_enrolled')
        or phase4_backfill.bad_bool(v, 'active')
        or phase4_backfill.bad_bool(v, 'owner_added') then 'invalid_boolean'
    end
  ) as reject_reason
from phase4_backfill.kv
where family = 'pet';

insert into public.pets_orphaned (legacy_kv_key, value, reason)
select key, raw_value, reject_reason
from phase4_backfill.pet
where reject_reason is not null
on conflict (legacy_kv_key) do nothing;

insert into public.pets
  (id, tenant_id, household_id, name, photo_url, photo_path, breed, sex, date_of_birth,
   age_years, microchip, weight_kg, colour, address, neutered_status,
   behaviour_notes, medical_notes, feeding_instructions, allergies, vet_name,
   vet_phone, vet_address, vaccination_status, vaccination_expiry_date,
   daycare_enrolled, grooming_enrolled, transport_enrolled,
   overnights_enrolled, active, owner_added, verification_status, created_at,
   updated_at, legacy_kv_key)
select
  segs[5],
  segs[2],
  segs[4],
  v->>'name',
  v->>'photo_url',
  v->>'photo_path',
  v->>'breed',
  v->>'sex',
  phase4_backfill.iso_date(v->>'date_of_birth'),
  phase4_backfill.try_num(v->>'age_years'),
  v->>'microchip',
  phase4_backfill.try_num(v->>'weight_kg'),
  v->>'colour',
  v->'address',                    -- jsonb as-found (object or legacy string)
  v->>'neutered_status',
  v->>'behaviour_notes',
  v->>'medical_notes',
  v->>'feeding_instructions',
  v->>'allergies',
  v->>'vet_name',
  v->>'vet_phone',
  v->>'vet_address',
  coalesce(v->>'vaccination_status', 'unknown'),
  phase4_backfill.iso_date(v->>'vaccination_expiry_date'),
  coalesce(phase4_backfill.try_bool(v->>'daycare_enrolled'), false),
  coalesce(phase4_backfill.try_bool(v->>'grooming_enrolled'), false),
  coalesce(phase4_backfill.try_bool(v->>'transport_enrolled'), false),
  coalesce(phase4_backfill.try_bool(v->>'overnights_enrolled'), false),
  coalesce(phase4_backfill.try_bool(v->>'active'), true),
  coalesce(phase4_backfill.try_bool(v->>'owner_added'), false),
  coalesce(v->>'verification_status', 'verified'),
  phase4_backfill.iso_ts(v->>'created_at'),
  phase4_backfill.iso_ts(v->>'updated_at'),
  key
from phase4_backfill.pet
where reject_reason is null
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- 6. customer_documents — customer:{t}:document:{hh}:{id}
--    pet_id has a VALID FK (on delete set null) — a document pointing at an
--    unmigrated pet is quarantined, not inserted with a broken reference.
-- ---------------------------------------------------------------------------

create table phase4_backfill.doc as
select key, raw_value, segs, v,
  coalesce(
    phase4_backfill.base_reject(v, segs[2]),
    case
      when row_number() over (partition by segs[5] order by key) > 1 then 'duplicate_id'
      when coalesce(v->>'id', '') = '' then 'missing_id'
      when v->>'id' <> segs[5] then 'id_key_mismatch'
      when v->>'tenant_id' is not null and v->>'tenant_id' <> segs[2] then 'tenant_key_mismatch'
      when v->>'household_id' is not null and v->>'household_id' <> segs[4] then 'household_key_mismatch'
      when not exists (select 1 from public.households h where h.id = segs[4]) then 'missing_household'
      when coalesce(v->>'pet_id', '') <> ''
        and not exists (select 1 from public.pets p where p.id = v->>'pet_id') then 'missing_pet'
      when phase4_backfill.iso_ts(v->>'uploaded_at') is null then 'invalid_uploaded_at'
      when phase4_backfill.bad_date(v, 'expiry_date') then 'invalid_date'
      when v->>'file_size' is not null
        and coalesce(phase4_backfill.try_num(v->>'file_size'), -1) < 0 then 'invalid_file_size'
    end
  ) as reject_reason
from phase4_backfill.kv
where family = 'document';

insert into public.customer_documents_orphaned (legacy_kv_key, value, reason)
select key, raw_value, reject_reason
from phase4_backfill.doc
where reject_reason is not null
on conflict (legacy_kv_key) do nothing;

insert into public.customer_documents
  (id, tenant_id, household_id, pet_id, document_type, name, file_name,
   storage_path, file_size, mime_type, expiry_date, notes, uploaded_by,
   uploaded_at, legacy_kv_key)
select
  segs[5],
  segs[2],
  segs[4],
  nullif(v->>'pet_id', ''),
  coalesce(v->>'document_type', 'other'),
  v->>'name',
  v->>'file_name',
  v->>'storage_path',
  coalesce(floor(phase4_backfill.try_num(v->>'file_size'))::bigint, 0),
  coalesce(v->>'mime_type', 'application/octet-stream'),
  phase4_backfill.iso_date(v->>'expiry_date'),
  v->>'notes',
  v->>'uploaded_by',
  phase4_backfill.iso_ts(v->>'uploaded_at'),
  key
from phase4_backfill.doc
where reject_reason is null
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- 7. household_notes — customer:{t}:household:{hh}:note:{id}
--    created_by_name / deleted_by are dropped per the frozen contract.
-- ---------------------------------------------------------------------------

create table phase4_backfill.note as
select key, raw_value, segs, v,
  coalesce(
    phase4_backfill.base_reject(v, segs[2]),
    case
      when row_number() over (partition by segs[6] order by key) > 1 then 'duplicate_id'
      when coalesce(v->>'id', '') = '' then 'missing_id'
      when v->>'id' <> segs[6] then 'id_key_mismatch'
      when v->>'tenant_id' is not null and v->>'tenant_id' <> segs[2] then 'tenant_key_mismatch'
      when v->>'household_id' is not null and v->>'household_id' <> segs[4] then 'household_key_mismatch'
      when not exists (select 1 from public.households h where h.id = segs[4]) then 'missing_household'
      when coalesce(v->>'content', '') = '' then 'missing_content'
      when coalesce(v->>'category', '') not in
        ('general','behaviour','medical','billing','transport','grooming','overnight')
        then 'invalid_category'
      when v->>'visibility' is not null
        and v->>'visibility' not in ('internal', 'customer') then 'invalid_visibility'
      when phase4_backfill.iso_ts(v->>'created_at') is null then 'invalid_created_at'
      when phase4_backfill.iso_ts(v->>'updated_at') is null then 'invalid_updated_at'
      when phase4_backfill.bad_ts(v, 'deleted_at') then 'invalid_deleted_at'
      when phase4_backfill.bad_bool(v, 'is_pinned') then 'invalid_boolean'
    end
  ) as reject_reason
from phase4_backfill.kv
where family = 'note';

insert into public.household_notes_orphaned (legacy_kv_key, value, reason)
select key, raw_value, reject_reason
from phase4_backfill.note
where reject_reason is not null
on conflict (legacy_kv_key) do nothing;

insert into public.household_notes
  (id, tenant_id, household_id, title, content, category, visibility,
   is_pinned, created_by, created_at, updated_at, deleted_at, legacy_kv_key)
select
  segs[6],
  segs[2],
  segs[4],
  v->>'title',
  v->>'content',
  v->>'category',
  coalesce(v->>'visibility', 'internal'),
  coalesce(phase4_backfill.try_bool(v->>'is_pinned'), false),
  v->>'created_by',
  phase4_backfill.iso_ts(v->>'created_at'),
  phase4_backfill.iso_ts(v->>'updated_at'),
  phase4_backfill.iso_ts(v->>'deleted_at'),
  key
from phase4_backfill.note
where reject_reason is null
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- 8. household_flags — customer:{t}:household:{hh}:flag:{id}
-- ---------------------------------------------------------------------------

create table phase4_backfill.flag as
select key, raw_value, segs, v,
  coalesce(
    phase4_backfill.base_reject(v, segs[2]),
    case
      when row_number() over (partition by segs[6] order by key) > 1 then 'duplicate_id'
      when coalesce(v->>'id', '') = '' then 'missing_id'
      when v->>'id' <> segs[6] then 'id_key_mismatch'
      when v->>'tenant_id' is not null and v->>'tenant_id' <> segs[2] then 'tenant_key_mismatch'
      when v->>'household_id' is not null and v->>'household_id' <> segs[4] then 'household_key_mismatch'
      when not exists (select 1 from public.households h where h.id = segs[4]) then 'missing_household'
      when coalesce(v->>'pet_id', '') <> ''
        and not exists (select 1 from public.pets p where p.id = v->>'pet_id') then 'missing_pet'
      when coalesce(v->>'flag_key', '') not in
        ('vip','behaviour_caution','medical_caution','payment_hold',
         'transport_instructions','grooming_restrictions','overnight_restrictions')
        then 'invalid_flag_key'
      when coalesce(v->>'severity', '') not in ('info', 'warn', 'block') then 'invalid_severity'
      when phase4_backfill.iso_ts(v->>'created_at') is null then 'invalid_created_at'
      when phase4_backfill.iso_ts(v->>'updated_at') is null then 'invalid_updated_at'
      when phase4_backfill.bad_bool(v, 'is_active') then 'invalid_boolean'
    end
  ) as reject_reason
from phase4_backfill.kv
where family = 'flag';

insert into public.household_flags_orphaned (legacy_kv_key, value, reason)
select key, raw_value, reject_reason
from phase4_backfill.flag
where reject_reason is not null
on conflict (legacy_kv_key) do nothing;

insert into public.household_flags
  (id, tenant_id, household_id, pet_id, flag_key, severity, is_active,
   reason, created_by, created_at, updated_at, legacy_kv_key)
select
  segs[6],
  segs[2],
  segs[4],
  nullif(v->>'pet_id', ''),
  v->>'flag_key',
  v->>'severity',
  coalesce(phase4_backfill.try_bool(v->>'is_active'), true),
  v->>'reason',
  v->>'created_by',
  phase4_backfill.iso_ts(v->>'created_at'),
  phase4_backfill.iso_ts(v->>'updated_at'),
  key
from phase4_backfill.flag
where reject_reason is null
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- 9. note_pets — customer:{t}:note:{noteId}:pet:{petId}
--    Pure link table: a link migrates only when BOTH ends migrated.
-- ---------------------------------------------------------------------------

create table phase4_backfill.link as
select key, raw_value, segs, v,
  coalesce(
    phase4_backfill.base_reject(v, segs[2]),
    case
      when v->>'note_id' is not null and v->>'note_id' <> segs[4] then 'note_key_mismatch'
      when v->>'pet_id' is not null and v->>'pet_id' <> segs[6] then 'pet_key_mismatch'
      when not exists (select 1 from public.household_notes n where n.id = segs[4]) then 'missing_note'
      when not exists (select 1 from public.pets p where p.id = segs[6]) then 'missing_pet'
    end
  ) as reject_reason
from phase4_backfill.kv
where family = 'note_pet';

insert into public.note_pets_orphaned (legacy_kv_key, value, reason)
select key, raw_value, reject_reason
from phase4_backfill.link
where reject_reason is not null
on conflict (legacy_kv_key) do nothing;

insert into public.note_pets (note_id, pet_id)
select segs[4], segs[6]
from phase4_backfill.link
where reject_reason is null
on conflict (note_id, pet_id) do nothing;

-- ---------------------------------------------------------------------------
-- 10. customer_activities — BOTH legacy key variants:
--     customer:{t}:activity:{hh}:{id}  (5 segments, no tenant_id in blob)
--     customer:{t}:activity:{id}       (4 segments, blob carries tenant_id)
--     household_id always comes from the blob (NOT NULL column; soft FK —
--     activities may outlive their household, so no existence check).
--     The contract keeps created_by_name here and drops metadata/created_at.
-- ---------------------------------------------------------------------------

create table phase4_backfill.act as
select key, raw_value, segs, nseg, v,
  case when nseg = 5 then segs[5] else segs[4] end as act_id,
  coalesce(
    phase4_backfill.base_reject(v, segs[2]),
    case
      when row_number() over
        (partition by case when nseg = 5 then segs[5] else segs[4] end order by key) > 1
        then 'duplicate_id'
      when coalesce(v->>'id', '') = '' then 'missing_id'
      when v->>'id' <> (case when nseg = 5 then segs[5] else segs[4] end) then 'id_key_mismatch'
      when v->>'tenant_id' is not null and v->>'tenant_id' <> segs[2] then 'tenant_key_mismatch'
      when coalesce(v->>'household_id', '') = '' then 'missing_household_id'
      when nseg = 5 and v->>'household_id' <> segs[4] then 'household_key_mismatch'
      when coalesce(v->>'activity_type', '') = '' then 'missing_activity_type'
      when coalesce(v->>'title', '') = '' then 'missing_title'
      when phase4_backfill.iso_ts(v->>'occurred_at') is null then 'invalid_occurred_at'
    end
  ) as reject_reason
from phase4_backfill.kv
where family = 'activity';

insert into public.customer_activities_orphaned (legacy_kv_key, value, reason)
select key, raw_value, reject_reason
from phase4_backfill.act
where reject_reason is not null
on conflict (legacy_kv_key) do nothing;

insert into public.customer_activities
  (id, tenant_id, household_id, pet_id, activity_type, title, description,
   occurred_at, created_by, created_by_name, legacy_kv_key)
select
  act_id,
  segs[2],
  v->>'household_id',
  nullif(v->>'pet_id', ''),
  v->>'activity_type',
  v->>'title',
  v->>'description',
  phase4_backfill.iso_ts(v->>'occurred_at'),
  v->>'created_by',
  v->>'created_by_name',
  key
from phase4_backfill.act
where reject_reason is null
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- 11. Record dangling primary_contact_id pointers + VALIDATE the one
--     NOT VALID FK from stage 0 (households.primary_contact_id → contacts).
--     A migrated household may point at a contact that was deleted from KV
--     (today's cascade is best-effort) or quarantined. Step 3 inserted the
--     pointer as NULL and step 4b restored only resolvable ones, so here the
--     unresolvable pointers are recorded for the parity audit, then the
--     constraint is validated (nothing can violate it any more).
-- ---------------------------------------------------------------------------

insert into public.customers_backfill_fixups
  (legacy_kv_key, table_name, column_name, old_value, reason)
select s.key, 'households', 'primary_contact_id', s.pcid,
       'dangling reference: contact not migrated — left null'
from (
  select key, v->>'primary_contact_id' as pcid
  from phase4_backfill.hh
  where reject_reason is null
) s
where s.pcid is not null
  and not exists (select 1 from public.contacts c where c.id = s.pcid)
on conflict (legacy_kv_key, table_name, column_name) do nothing;

alter table public.households validate constraint households_primary_contact_fk;

-- ---------------------------------------------------------------------------
-- 12. Re-run convergence: a key quarantined on an earlier run that has since
--     migrated (KV data fixed) leaves quarantine, keeping the parity equation
--     exact: KV keys = migrated rows + quarantined keys, per family.
-- ---------------------------------------------------------------------------

delete from public.households_orphaned q
  where exists (select 1 from public.households t where t.legacy_kv_key = q.legacy_kv_key);
delete from public.contacts_orphaned q
  where exists (select 1 from public.contacts t where t.legacy_kv_key = q.legacy_kv_key);
delete from public.pets_orphaned q
  where exists (select 1 from public.pets t where t.legacy_kv_key = q.legacy_kv_key);
delete from public.customer_documents_orphaned q
  where exists (select 1 from public.customer_documents t where t.legacy_kv_key = q.legacy_kv_key);
delete from public.household_notes_orphaned q
  where exists (select 1 from public.household_notes t where t.legacy_kv_key = q.legacy_kv_key);
delete from public.household_flags_orphaned q
  where exists (select 1 from public.household_flags t where t.legacy_kv_key = q.legacy_kv_key);
delete from public.customer_activities_orphaned q
  where exists (select 1 from public.customer_activities t where t.legacy_kv_key = q.legacy_kv_key);
delete from public.note_pets_orphaned q
  where exists (select 1 from public.note_pets np
                where np.note_id = split_part(q.legacy_kv_key, ':', 4)
                  and np.pet_id  = split_part(q.legacy_kv_key, ':', 6));

-- ---------------------------------------------------------------------------
-- 13. Summary (shows up in the migration/apply logs) + scratch teardown.
-- ---------------------------------------------------------------------------

do $$
declare r record;
begin
  for r in
    select 'households' as t,
           (select count(*) from public.households where legacy_kv_key is not null) as migrated,
           (select count(*) from public.households_orphaned) as quarantined
    union all select 'contacts',
           (select count(*) from public.contacts where legacy_kv_key is not null),
           (select count(*) from public.contacts_orphaned)
    union all select 'pets',
           (select count(*) from public.pets where legacy_kv_key is not null),
           (select count(*) from public.pets_orphaned)
    union all select 'customer_documents',
           (select count(*) from public.customer_documents where legacy_kv_key is not null),
           (select count(*) from public.customer_documents_orphaned)
    union all select 'household_notes',
           (select count(*) from public.household_notes where legacy_kv_key is not null),
           (select count(*) from public.household_notes_orphaned)
    union all select 'note_pets',
           (select count(*) from public.note_pets),
           (select count(*) from public.note_pets_orphaned)
    union all select 'household_flags',
           (select count(*) from public.household_flags where legacy_kv_key is not null),
           (select count(*) from public.household_flags_orphaned)
    union all select 'customer_activities',
           (select count(*) from public.customer_activities where legacy_kv_key is not null),
           (select count(*) from public.customer_activities_orphaned)
    union all select 'unclassified_keys', 0,
           (select count(*) from public.customer_keys_orphaned)
  loop
    raise notice 'phase4 customers backfill: % — migrated %, quarantined %',
      r.t, r.migrated, r.quarantined;
  end loop;
end $$;

drop schema phase4_backfill cascade;
