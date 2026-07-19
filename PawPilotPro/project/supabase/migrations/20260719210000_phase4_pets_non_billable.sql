-- ============================================================================
-- Phase 4 / Customers — pets.non_billable (house dogs).
--
-- The house-dog feature (feat/non-billable-house-dogs) added a per-pet
-- non_billable marker to the KV blob and the frozen contract (shared
-- petSchema, default false), but the stage-0 pets table had no column, so
-- the stage-2 dual-write RPC dropped the field and stage-3 PG-served reads
-- returned pets without it (toggle appears to never stick while the flag
-- read_from_pg:customers is ON). Three steps, all additive:
--   1. Column with a safe default (legacy rows = billable).
--   2. Re-create phase4_customers_apply with non_billable in the pet
--      branch's projection (insert + upsert), same strict-cast style.
--   3. Backfill from each row's authoritative KV blob via legacy_kv_key.
-- ============================================================================

alter table public.pets
  add column if not exists non_billable boolean not null default false;

create or replace function public.phase4_customers_apply(ops jsonb)
returns void
language plpgsql
set search_path = ''
as $$
declare
  op   jsonb;
  kind text;
  k    text;
  v    jsonb;
  segs text[];
  nseg int;
  fam  text;
begin
  if ops is null or jsonb_typeof(ops) <> 'array' then
    raise exception 'phase4_customers_apply: ops must be a jsonb array';
  end if;

  for op in select * from jsonb_array_elements(ops) loop
    kind := op->>'op';
    k    := op->>'key';
    if kind is null or kind not in ('set', 'del') or k is null then
      raise exception 'phase4_customers_apply: malformed op (need op set|del and key)';
    end if;

    segs := string_to_array(k, ':');
    nseg := array_length(segs, 1);
    fam := case
      when segs[1] is distinct from 'customer' then null
      when segs[3] = 'household' and nseg = 4 then 'household'
      when segs[3] = 'contact'   and nseg = 5 then 'contact'
      when segs[3] = 'pet'       and nseg = 5 then 'pet'
      when segs[3] = 'document'  and nseg = 5 then 'document'
      when segs[3] = 'household' and nseg = 6 and segs[5] = 'note' then 'note'
      when segs[3] = 'household' and nseg = 6 and segs[5] = 'flag' then 'flag'
      when segs[3] = 'note'      and nseg = 6 and segs[5] = 'pet'  then 'note_pet'
      when segs[3] = 'activity'  and nseg in (4, 5) then 'activity'
      else null
    end;
    if fam is null then
      raise exception 'phase4_customers_apply: unclassifiable customer key %', k;
    end if;

    if kind = 'del' then
      case fam
        when 'household' then delete from public.households          where legacy_kv_key = k;
        when 'contact'   then delete from public.contacts            where legacy_kv_key = k;
        when 'pet'       then delete from public.pets                where legacy_kv_key = k;
        when 'document'  then delete from public.customer_documents  where legacy_kv_key = k;
        when 'note'      then delete from public.household_notes     where legacy_kv_key = k;
        when 'flag'      then delete from public.household_flags     where legacy_kv_key = k;
        when 'activity'  then delete from public.customer_activities where legacy_kv_key = k;
        when 'note_pet'  then delete from public.note_pets
                               where note_id = segs[4] and pet_id = segs[6];
      end case;
      continue;
    end if;

    v := op->'value';
    if v is null or jsonb_typeof(v) <> 'object' then
      raise exception 'phase4_customers_apply: set op for % needs an object value', k;
    end if;

    case fam
      when 'household' then
        insert into public.households
          (id, tenant_id, external_id, name, status, vip, payment_hold, hold_reason,
           hold_notes, primary_location_id, primary_contact_id, address,
           internal_notes, created_by, created_at, updated_at, legacy_kv_key)
        values
          (segs[4], segs[2],
           nullif(v->>'external_id', ''),
           v->>'name',
           coalesce(nullif(v->>'status', ''), 'active'),
           coalesce((v->>'vip')::boolean, false),
           coalesce((v->>'payment_hold')::boolean, false),
           v->>'hold_reason', v->>'hold_notes',
           nullif(v->>'primary_location_id', ''),
           nullif(v->>'primary_contact_id', ''),
           v->'address',
           v->>'internal_notes', v->>'created_by',
           (v->>'created_at')::timestamptz, (v->>'updated_at')::timestamptz, k)
        on conflict (id) do update set
          tenant_id = excluded.tenant_id, external_id = excluded.external_id,
          name = excluded.name, status = excluded.status, vip = excluded.vip,
          payment_hold = excluded.payment_hold, hold_reason = excluded.hold_reason,
          hold_notes = excluded.hold_notes,
          primary_location_id = excluded.primary_location_id,
          primary_contact_id = excluded.primary_contact_id,
          address = excluded.address, internal_notes = excluded.internal_notes,
          created_by = excluded.created_by, created_at = excluded.created_at,
          updated_at = excluded.updated_at, legacy_kv_key = excluded.legacy_kv_key;

      when 'contact' then
        insert into public.contacts
          (id, tenant_id, household_id, first_name, last_name, email, phone,
           preferred_contact_method, is_primary, is_emergency_contact,
           emergency_contact_relationship, marketing_consent, sms_consent,
           email_consent, created_at, updated_at, legacy_kv_key)
        values
          (segs[5], segs[2], segs[4],
           v->>'first_name', v->>'last_name', v->>'email', v->>'phone',
           v->>'preferred_contact_method',
           coalesce((v->>'is_primary')::boolean, false),
           coalesce((v->>'is_emergency_contact')::boolean, false),
           v->>'emergency_contact_relationship',
           coalesce((v->>'marketing_consent')::boolean, false),
           coalesce((v->>'sms_consent')::boolean, false),
           coalesce((v->>'email_consent')::boolean, false),
           (v->>'created_at')::timestamptz, (v->>'updated_at')::timestamptz, k)
        on conflict (id) do update set
          tenant_id = excluded.tenant_id, household_id = excluded.household_id,
          first_name = excluded.first_name, last_name = excluded.last_name,
          email = excluded.email, phone = excluded.phone,
          preferred_contact_method = excluded.preferred_contact_method,
          is_primary = excluded.is_primary,
          is_emergency_contact = excluded.is_emergency_contact,
          emergency_contact_relationship = excluded.emergency_contact_relationship,
          marketing_consent = excluded.marketing_consent,
          sms_consent = excluded.sms_consent, email_consent = excluded.email_consent,
          created_at = excluded.created_at, updated_at = excluded.updated_at,
          legacy_kv_key = excluded.legacy_kv_key;

      when 'pet' then
        insert into public.pets
          (id, tenant_id, household_id, name, photo_url, photo_path, breed, sex,
           date_of_birth, age_years, microchip, weight_kg, colour, address,
           neutered_status, behaviour_notes, medical_notes, feeding_instructions,
           allergies, vet_name, vet_phone, vet_address, vaccination_status,
           vaccination_expiry_date, daycare_enrolled, grooming_enrolled,
           transport_enrolled, overnights_enrolled, active, owner_added,
           verification_status, non_billable, created_at, updated_at, legacy_kv_key)
        values
          (segs[5], segs[2], segs[4],
           v->>'name', nullif(v->>'photo_url', ''), nullif(v->>'photo_path', ''),
           v->>'breed', v->>'sex',
           (nullif(v->>'date_of_birth', ''))::date,
           (nullif(v->>'age_years', ''))::numeric,
           v->>'microchip',
           (nullif(v->>'weight_kg', ''))::numeric,
           v->>'colour', v->'address', v->>'neutered_status',
           v->>'behaviour_notes', v->>'medical_notes', v->>'feeding_instructions',
           v->>'allergies', v->>'vet_name', v->>'vet_phone', v->>'vet_address',
           coalesce(nullif(v->>'vaccination_status', ''), 'unknown'),
           (nullif(v->>'vaccination_expiry_date', ''))::date,
           coalesce((v->>'daycare_enrolled')::boolean, false),
           coalesce((v->>'grooming_enrolled')::boolean, false),
           coalesce((v->>'transport_enrolled')::boolean, false),
           coalesce((v->>'overnights_enrolled')::boolean, false),
           coalesce((v->>'active')::boolean, true),
           coalesce((v->>'owner_added')::boolean, false),
           coalesce(nullif(v->>'verification_status', ''), 'verified'),
           coalesce((v->>'non_billable')::boolean, false),
           (v->>'created_at')::timestamptz, (v->>'updated_at')::timestamptz, k)
        on conflict (id) do update set
          tenant_id = excluded.tenant_id, household_id = excluded.household_id,
          name = excluded.name, photo_url = excluded.photo_url,
          photo_path = excluded.photo_path, breed = excluded.breed,
          sex = excluded.sex, date_of_birth = excluded.date_of_birth,
          age_years = excluded.age_years, microchip = excluded.microchip,
          weight_kg = excluded.weight_kg, colour = excluded.colour,
          address = excluded.address, neutered_status = excluded.neutered_status,
          behaviour_notes = excluded.behaviour_notes,
          medical_notes = excluded.medical_notes,
          feeding_instructions = excluded.feeding_instructions,
          allergies = excluded.allergies, vet_name = excluded.vet_name,
          vet_phone = excluded.vet_phone, vet_address = excluded.vet_address,
          vaccination_status = excluded.vaccination_status,
          vaccination_expiry_date = excluded.vaccination_expiry_date,
          daycare_enrolled = excluded.daycare_enrolled,
          grooming_enrolled = excluded.grooming_enrolled,
          transport_enrolled = excluded.transport_enrolled,
          overnights_enrolled = excluded.overnights_enrolled,
          active = excluded.active, owner_added = excluded.owner_added,
          verification_status = excluded.verification_status,
          non_billable = excluded.non_billable,
          created_at = excluded.created_at, updated_at = excluded.updated_at,
          legacy_kv_key = excluded.legacy_kv_key;

      when 'document' then
        insert into public.customer_documents
          (id, tenant_id, household_id, pet_id, document_type, name, file_name,
           storage_path, file_size, mime_type, expiry_date, notes, uploaded_by,
           uploaded_at, legacy_kv_key)
        values
          (segs[5], segs[2], segs[4],
           nullif(v->>'pet_id', ''),
           coalesce(nullif(v->>'document_type', ''), 'other'),
           v->>'name', v->>'file_name', v->>'storage_path',
           coalesce(floor((nullif(v->>'file_size', ''))::numeric)::bigint, 0),
           coalesce(nullif(v->>'mime_type', ''), 'application/octet-stream'),
           (nullif(v->>'expiry_date', ''))::date,
           v->>'notes', v->>'uploaded_by',
           (v->>'uploaded_at')::timestamptz, k)
        on conflict (id) do update set
          tenant_id = excluded.tenant_id, household_id = excluded.household_id,
          pet_id = excluded.pet_id, document_type = excluded.document_type,
          name = excluded.name, file_name = excluded.file_name,
          storage_path = excluded.storage_path, file_size = excluded.file_size,
          mime_type = excluded.mime_type, expiry_date = excluded.expiry_date,
          notes = excluded.notes, uploaded_by = excluded.uploaded_by,
          uploaded_at = excluded.uploaded_at, legacy_kv_key = excluded.legacy_kv_key;

      when 'note' then
        insert into public.household_notes
          (id, tenant_id, household_id, title, content, category, visibility,
           is_pinned, created_by, created_at, updated_at, deleted_at, legacy_kv_key)
        values
          (segs[6], segs[2], segs[4],
           v->>'title', v->>'content', v->>'category',
           coalesce(nullif(v->>'visibility', ''), 'internal'),
           coalesce((v->>'is_pinned')::boolean, false),
           v->>'created_by',
           (v->>'created_at')::timestamptz, (v->>'updated_at')::timestamptz,
           (nullif(v->>'deleted_at', ''))::timestamptz, k)
        on conflict (id) do update set
          tenant_id = excluded.tenant_id, household_id = excluded.household_id,
          title = excluded.title, content = excluded.content,
          category = excluded.category, visibility = excluded.visibility,
          is_pinned = excluded.is_pinned, created_by = excluded.created_by,
          created_at = excluded.created_at, updated_at = excluded.updated_at,
          deleted_at = excluded.deleted_at, legacy_kv_key = excluded.legacy_kv_key;

      when 'flag' then
        insert into public.household_flags
          (id, tenant_id, household_id, pet_id, flag_key, severity, is_active,
           reason, created_by, created_at, updated_at, legacy_kv_key)
        values
          (segs[6], segs[2], segs[4],
           nullif(v->>'pet_id', ''),
           v->>'flag_key', v->>'severity',
           coalesce((v->>'is_active')::boolean, true),
           v->>'reason', v->>'created_by',
           (v->>'created_at')::timestamptz, (v->>'updated_at')::timestamptz, k)
        on conflict (id) do update set
          tenant_id = excluded.tenant_id, household_id = excluded.household_id,
          pet_id = excluded.pet_id, flag_key = excluded.flag_key,
          severity = excluded.severity, is_active = excluded.is_active,
          reason = excluded.reason, created_by = excluded.created_by,
          created_at = excluded.created_at, updated_at = excluded.updated_at,
          legacy_kv_key = excluded.legacy_kv_key;

      when 'note_pet' then
        insert into public.note_pets (note_id, pet_id)
        values (segs[4], segs[6])
        on conflict (note_id, pet_id) do nothing;

      when 'activity' then
        insert into public.customer_activities
          (id, tenant_id, household_id, pet_id, activity_type, title, description,
           occurred_at, created_by, created_by_name, legacy_kv_key)
        values
          (case when nseg = 5 then segs[5] else segs[4] end,
           segs[2],
           v->>'household_id',
           nullif(v->>'pet_id', ''),
           v->>'activity_type', v->>'title', v->>'description',
           (v->>'occurred_at')::timestamptz,
           v->>'created_by', v->>'created_by_name', k)
        on conflict (id) do update set
          tenant_id = excluded.tenant_id, household_id = excluded.household_id,
          pet_id = excluded.pet_id, activity_type = excluded.activity_type,
          title = excluded.title, description = excluded.description,
          occurred_at = excluded.occurred_at, created_by = excluded.created_by,
          created_by_name = excluded.created_by_name,
          legacy_kv_key = excluded.legacy_kv_key;
    end case;
  end loop;
end;
$$;

-- Not a client-facing RPC: edge function (service_role) only.
revoke execute on function public.phase4_customers_apply(jsonb) from public, anon, authenticated;

-- Backfill: KV is authoritative for stage 2 — copy the marker from each
-- row's source blob (absent field = false, matching the contract default).
update public.pets p
set non_billable = coalesce((k.value->>'non_billable')::boolean, false)
from public.kv_store_fc003b23 k
where k.key = p.legacy_kv_key
  and p.non_billable is distinct from coalesce((k.value->>'non_billable')::boolean, false);
