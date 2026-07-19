-- ============================================================================
-- Phase 4 / Customers — KV tenant-alias canonicalisation (DATA migration).
--
-- PROD PARITY: applied to prod (MDC) 2026-07-19 via MCP as
-- `phase4_customers_kv_tenant_canonicalization` ahead of the stage-3 read
-- cutover. Completes the owner-ratified tenant-alias fold of 2026-07-11
-- (prod migration 20260711230224 canonicalised the Postgres ROWS; this
-- canonicalises the 25 matching KV KEYS + blob tenant_id so KV and Postgres
-- agree on tenancy before reads can be served from either store).
--
-- Aliases ee4c3a1d-d391-44e6-b9bd-5f1aab2351b5 (a pre-stamping user-id
-- tenant fallback) and demo-tenant fold into demo-tenant-001. The alias keys
-- were unreachable by app writes (staff tenants resolve to demo-tenant-001),
-- so there is no write race; the move also makes those records visible in
-- the app again, matching what the canonicalised Postgres rows already say.
-- Idempotent: with no alias keys left, every statement is a no-op.
-- Reversible by renaming the keys back.
-- ============================================================================

do $$
declare
  n_alias int;
  n_obj   int;
begin
  select count(*), count(*) filter (where jsonb_typeof(value) = 'object')
    into n_alias, n_obj
  from public.kv_store_fc003b23
  where key like 'customer:%'
    and split_part(key, ':', 2) in ('ee4c3a1d-d391-44e6-b9bd-5f1aab2351b5', 'demo-tenant');

  if n_alias <> n_obj then
    raise exception 'alias KV values not all jsonb objects (% of %) — aborting', n_obj, n_alias;
  end if;

  if exists (
    select 1 from public.kv_store_fc003b23 src
    where src.key like 'customer:%'
      and split_part(src.key, ':', 2) in ('ee4c3a1d-d391-44e6-b9bd-5f1aab2351b5', 'demo-tenant')
      and exists (
        select 1 from public.kv_store_fc003b23 dst
        where dst.key = regexp_replace(src.key, '^customer:[^:]+:', 'customer:demo-tenant-001:')
      )
  ) then
    raise exception 'canonical twin key already exists — aborting';
  end if;
end $$;

create temp table _alias_moves on commit drop as
select key as old_key,
       regexp_replace(key, '^customer:[^:]+:', 'customer:demo-tenant-001:') as new_key,
       case when value ? 'tenant_id'
            then jsonb_set(value, '{tenant_id}', to_jsonb('demo-tenant-001'::text))
            else value end as new_value
from public.kv_store_fc003b23
where key like 'customer:%'
  and split_part(key, ':', 2) in ('ee4c3a1d-d391-44e6-b9bd-5f1aab2351b5', 'demo-tenant');

insert into public.kv_store_fc003b23 (key, value)
select new_key, new_value from _alias_moves;

delete from public.kv_store_fc003b23 k using _alias_moves m where k.key = m.old_key;

update public.households          t set legacy_kv_key = m.new_key from _alias_moves m where t.legacy_kv_key = m.old_key;
update public.contacts            t set legacy_kv_key = m.new_key from _alias_moves m where t.legacy_kv_key = m.old_key;
update public.pets                t set legacy_kv_key = m.new_key from _alias_moves m where t.legacy_kv_key = m.old_key;
update public.customer_documents  t set legacy_kv_key = m.new_key from _alias_moves m where t.legacy_kv_key = m.old_key;
update public.household_notes     t set legacy_kv_key = m.new_key from _alias_moves m where t.legacy_kv_key = m.old_key;
update public.customer_activities t set legacy_kv_key = m.new_key from _alias_moves m where t.legacy_kv_key = m.old_key;
