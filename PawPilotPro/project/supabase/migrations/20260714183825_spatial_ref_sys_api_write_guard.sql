-- Make public.spatial_ref_sys read-only for the Data API roles.
--
-- Context: the Supabase security advisor flags spatial_ref_sys with
-- rls_disabled_in_public (ERROR). The table is owned by supabase_admin (it
-- belongs to the postgis extension), so from the postgres role we can neither
-- `alter table ... enable row level security` (must be owner) nor revoke the
-- blanket anon/authenticated CRUD grants (granted by supabase_admin; postgres
-- holds no grant option — a revoke is a silent no-op). What postgres DOES hold
-- is the TRIGGER privilege, so this guard closes the real exposure: anonymous
-- writes. PostGIS only ever READS spatial_ref_sys at runtime, so blocking API
-- writes has no legitimate caller to break; reads stay open (it is the public
-- EPSG registry). Extension upgrades run as supabase_admin and are unaffected.
--
-- NOTE: the advisor lint itself will keep flagging this table until Supabase
-- support enables RLS on it (only they own it) or the finding is dismissed in
-- the dashboard. This migration removes the actual risk in the meantime.
--
-- Applied to prod (ruahrxkfgfyshuxykiay) on 2026-07-14 via MCP apply_migration.
-- Staging (ihdbnwlmqhsrslstbbqn) has no postgis, so this is written to no-op
-- gracefully where the table does not exist.

do $$
begin
  if not exists (
    select 1 from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'spatial_ref_sys'
  ) then
    raise notice 'spatial_ref_sys not present; skipping API write guard';
    return;
  end if;

  create or replace function public.spatial_ref_sys_block_api_writes()
  returns trigger
  language plpgsql
  set search_path = ''
  as $fn$
  begin
    if current_user in ('anon', 'authenticated') then
      raise exception 'spatial_ref_sys is read-only via the API'
        using errcode = 'insufficient_privilege';
    end if;
    if tg_op = 'DELETE' then
      return old;
    end if;
    return coalesce(new, old);
  end;
  $fn$;

  -- Trigger functions execute with the invoking statement's role, so the API
  -- roles need EXECUTE for the trigger to fire (and raise) for them.
  revoke all on function public.spatial_ref_sys_block_api_writes() from public;
  grant execute on function public.spatial_ref_sys_block_api_writes() to anon, authenticated;

  drop trigger if exists spatial_ref_sys_api_readonly on public.spatial_ref_sys;
  create trigger spatial_ref_sys_api_readonly
    before insert or update or delete on public.spatial_ref_sys
    for each row execute function public.spatial_ref_sys_block_api_writes();

  drop trigger if exists spatial_ref_sys_api_readonly_truncate on public.spatial_ref_sys;
  create trigger spatial_ref_sys_api_readonly_truncate
    before truncate on public.spatial_ref_sys
    for each statement execute function public.spatial_ref_sys_block_api_writes();
end $$;
