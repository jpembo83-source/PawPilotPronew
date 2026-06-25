-- Applied LIVE to prod (MDC, ruahrxkfgfyshuxykiay) as migration
-- 20260625085232_harden_function_search_path. Captured here from the prod
-- migration history so local history matches remote.
--
-- NOTE: targets invoxia.* and public functions that exist in PROD but not on
-- the active-schema staging project. PROD parity only.

-- Pin search_path on the remaining (SECURITY INVOKER) advisor-flagged
-- functions. Verified safe: every reference is schema-qualified or a public
-- table, and public is in each pinned path. invoxia.current_tenant_id() only
-- uses the qualified auth.jwt(), so invoxia RLS is unaffected.
alter function invoxia.current_tenant_id()                  set search_path = public, auth, pg_temp;
alter function invoxia.set_updated_at()                     set search_path = invoxia, public, pg_temp;
alter function invoxia.sync_entity_linkage()                set search_path = invoxia, public, pg_temp;
alter function public.cascade_entitlement_disable()         set search_path = public, pg_temp;
alter function public.current_user_is_super_admin()         set search_path = public, auth, pg_temp;
alter function public.current_user_org_ids()                set search_path = public, auth, pg_temp;
alter function public.migrate_tenant_modules(varchar)       set search_path = public, pg_temp;
alter function public.organization_id_for_tenant(text)      set search_path = public, pg_temp;
alter function public.set_updated_at()                      set search_path = public, pg_temp;
alter function public.update_automation_timestamp()         set search_path = public, pg_temp;
alter function public.update_incident_timestamp()           set search_path = public, pg_temp;
alter function public.update_payment_config_timestamp()     set search_path = public, pg_temp;
alter function public.validate_location_module_enablement() set search_path = public, pg_temp;
