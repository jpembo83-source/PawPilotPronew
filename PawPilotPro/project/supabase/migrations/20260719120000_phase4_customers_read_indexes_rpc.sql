-- ============================================================================
-- Phase 4 / Customers — STAGE 3: read-cutover indexes + read RPCs.
--
-- Serves GET /customers/households (list/search/filter/sort/pagination) and
-- GET /customers/lookup from Postgres behind the read_from_pg:customers flag
-- (lib/customers_read_pg.ts). Detail reads (household bundle, contacts,
-- pets, pet by id) use plain PostgREST selects over existing FK indexes.
--
-- Parity notes (byte-level intent, see lib/customers_wire.ts):
--   * Search is the KV path's substring-contains, case-insensitive, applied
--     per field (household name; contact first/last/email/phone; pet name).
--     ILIKE with \-escaped user input reproduces String.includes exactly;
--     the trigram indexes below make it indexed instead of a scan.
--   * Sort uses an ICU level-1 collation (public.phase4_ci_base) matching
--     the KV path's localeCompare(…, { sensitivity: 'base' }) — case- and
--     accent-insensitive. Ties break on id: tie order was never specified on
--     the KV path (getByPrefix has no ORDER BY), so this only makes the PG
--     path deterministic, it cannot contradict a KV guarantee.
--   * total = filtered count before paging, same as listHouseholds().
--
-- Both RPCs are service-role-only (EXECUTE revoked below) — reads still flow
-- exclusively through the requireAuth-guarded edge function.
-- ============================================================================

create extension if not exists pg_trgm with schema extensions;

-- localeCompare(undefined, { sensitivity: 'base' }) equivalent (ICU root,
-- primary strength). Non-deterministic → usable for ORDER BY comparisons.
create collation if not exists public.phase4_ci_base
  (provider = icu, locale = 'und-u-ks-level1', deterministic = false);

-- ---- indexes for the real read filters ------------------------------------

-- Tenant list base: households_tenant_idx (tenant_id, status, name) exists
-- from stage 0. Location filter:
create index if not exists households_tenant_location_idx
  on public.households (tenant_id, primary_location_id)
  where primary_location_id is not null;

-- Search (substring ILIKE) — one trigram index per searched field.
create index if not exists households_name_trgm_idx
  on public.households using gin (name extensions.gin_trgm_ops);
create index if not exists contacts_first_name_trgm_idx
  on public.contacts using gin (first_name extensions.gin_trgm_ops);
create index if not exists contacts_last_name_trgm_idx
  on public.contacts using gin (last_name extensions.gin_trgm_ops);
create index if not exists contacts_email_trgm_idx
  on public.contacts using gin (email extensions.gin_trgm_ops);
create index if not exists contacts_phone_trgm_idx
  on public.contacts using gin (phone extensions.gin_trgm_ops);
create index if not exists pets_name_trgm_idx
  on public.pets using gin (name extensions.gin_trgm_ops);

-- Detail reads fetch ALL pets of a household (incl. inactive); the stage-0
-- pets_household_idx is partial on active, so give the full set an index.
create index if not exists pets_household_all_idx
  on public.pets (household_id);

-- ---- list RPC --------------------------------------------------------------

create or replace function public.phase4_customers_list(
  p_tenant text,
  p_search text default null,
  p_status text default null,
  p_vip boolean default false,
  p_payment_hold boolean default false,
  p_location_id text default null,
  p_sort text default 'name',
  p_dir text default 'asc',
  p_limit int default null,
  p_offset int default 0
) returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  pat text;
  result jsonb;
begin
  if coalesce(p_search, '') <> '' then
    pat := '%' || replace(replace(replace(p_search, '\', '\\'), '%', '\%'), '_', '\_') || '%';
  end if;

  with base as (
    select h.*
    from public.households h
    where h.tenant_id = p_tenant
      and (coalesce(p_status, '') = '' or h.status = p_status)
      and (not coalesce(p_vip, false) or h.vip)
      and (not coalesce(p_payment_hold, false) or h.payment_hold)
      and (coalesce(p_location_id, '') = '' or h.primary_location_id = p_location_id)
      and (pat is null
        or h.name ilike pat
        or exists (
          select 1 from public.contacts c
          where c.household_id = h.id
            and (c.first_name ilike pat
              or c.last_name ilike pat
              or c.email ilike pat
              or c.phone ilike pat))
        or exists (
          select 1 from public.pets p
          where p.household_id = h.id and p.name ilike pat))
  ),
  keyed as (
    select b.*,
      case when p_sort = 'primary_contact' then
        coalesce((
          select btrim(coalesce(c.first_name, '') || ' ' || coalesce(c.last_name, ''))
          from public.contacts c
          where c.id = b.primary_contact_id and c.household_id = b.id), '')
      else coalesce(b.name, '') end as sort_key
    from base b
  ),
  numbered as (
    select k.*,
      row_number() over (order by
        (case when p_dir = 'desc' then null else k.sort_key end) collate public.phase4_ci_base asc,
        (case when p_dir = 'desc' then k.sort_key end) collate public.phase4_ci_base desc,
        (case when p_dir = 'desc' then null else k.id end) asc,
        (case when p_dir = 'desc' then k.id end) desc
      ) as rn
    from keyed k
  ),
  page as (
    select n.*
    from numbered n
    where n.rn > coalesce(p_offset, 0)
      and n.rn <= coalesce(p_offset, 0) + coalesce(p_limit, 2147483647)
  )
  select jsonb_build_object(
    'total', (select count(*) from keyed),
    'rows', coalesce(jsonb_agg(jsonb_build_object(
      'household', to_jsonb(page) - 'sort_key' - 'rn',
      'contacts_count', (select count(*) from public.contacts c where c.household_id = page.id),
      'pets_count', (select count(*) from public.pets p where p.household_id = page.id),
      'primary_contact', (
        select to_jsonb(c) from public.contacts c
        where c.id = page.primary_contact_id and c.household_id = page.id)
    ) order by page.rn), '[]'::jsonb))
  into result
  from page;

  return result;
end;
$$;

-- ---- duplicate-lookup RPC --------------------------------------------------
-- Mirrors GET /customers/lookup: caller pre-normalises (email trim+lower,
-- phone digits-only, name trim+lower). Matching reproduces the KV route:
-- email compared on lower(btrim(stored)); phone digits-only with dial-code
-- tolerance (equal, or both ≥10 digits sharing the trailing 10); household
-- names by escaped substring ILIKE. Caps at 5 like the KV path (which took
-- the first 5 in unspecified scan order; here ordered by id).

create or replace function public.phase4_customers_lookup(
  p_tenant text,
  p_email text default '',
  p_phone text default '',
  p_name text default ''
) returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  name_pat text;
  v_contacts jsonb := '[]'::jsonb;
  v_households jsonb := '[]'::jsonb;
begin
  if coalesce(p_email, '') <> '' or coalesce(p_phone, '') <> '' then
    select coalesce(jsonb_agg(jsonb_build_object(
        'id', m.id, 'first_name', m.first_name, 'last_name', m.last_name,
        'email', m.email, 'phone', m.phone, 'household_id', m.household_id,
        'household_name', m.household_name,
        'matched_email', m.matched_email, 'matched_phone', m.matched_phone
      ) order by m.id), '[]'::jsonb)
    into v_contacts
    from (
      select s.*
      from (
        select c.id, c.first_name, c.last_name, c.email, c.phone, c.household_id,
          coalesce(h.name, 'Unnamed Household') as household_name,
          (coalesce(p_email, '') <> ''
            and coalesce(c.email, '') <> ''
            and lower(btrim(c.email)) = p_email) as matched_email,
          (coalesce(p_phone, '') <> ''
            and regexp_replace(coalesce(c.phone, ''), '\D', '', 'g') <> ''
            and (regexp_replace(c.phone, '\D', '', 'g') = p_phone
              or (length(regexp_replace(c.phone, '\D', '', 'g')) >= 10
                and length(p_phone) >= 10
                and right(regexp_replace(c.phone, '\D', '', 'g'), 10) = right(p_phone, 10)))
          ) as matched_phone
        from public.contacts c
        left join public.households h
          on h.id = c.household_id and h.tenant_id = p_tenant
        where c.tenant_id = p_tenant
      ) s
      where s.matched_email or s.matched_phone
      order by s.id
      limit 5
    ) m;
  end if;

  if coalesce(p_name, '') <> '' then
    name_pat := '%' || replace(replace(replace(p_name, '\', '\\'), '%', '\%'), '_', '\_') || '%';
    select coalesce(jsonb_agg(jsonb_build_object('id', s.id, 'name', s.name) order by s.id), '[]'::jsonb)
    into v_households
    from (
      select h.id, h.name
      from public.households h
      where h.tenant_id = p_tenant and h.name ilike name_pat
      order by h.id
      limit 5
    ) s;
  end if;

  return jsonb_build_object('contacts', v_contacts, 'households', v_households);
end;
$$;

-- Not client-facing: edge function (service_role) only.
revoke execute on function public.phase4_customers_list(text, text, text, boolean, boolean, text, text, text, int, int)
  from public, anon, authenticated;
revoke execute on function public.phase4_customers_lookup(text, text, text, text)
  from public, anon, authenticated;
