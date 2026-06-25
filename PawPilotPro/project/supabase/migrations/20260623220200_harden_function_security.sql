-- Applied LIVE to prod (MDC, ruahrxkfgfyshuxykiay) as migration
-- 20260623220200_harden_function_security. Captured here from the prod
-- migration history so local history matches remote.
--
-- NOTE: targets functions that exist in PROD (public schema, created before the
-- recorded migration history). They do NOT all exist on the active-schema
-- staging project, so this migration is for PROD parity only — do not expect it
-- to apply cleanly to a fresh/active-schema-only database.

-- Pin search_path on flagged SECURITY DEFINER functions (bodies are fully
-- schema-qualified, so resolution is unchanged; closes search_path injection).
alter function public.is_admin()                       set search_path = public, auth, pg_temp;
alter function public.is_manager_or_admin()            set search_path = public, auth, pg_temp;
alter function public.has_location_access(uuid)        set search_path = public, auth, pg_temp;
alter function public.can_access_document(uuid)        set search_path = public, auth, pg_temp;
alter function public.log_payment_config_access(uuid, text, text, text, jsonb)
                                                       set search_path = public, auth, pg_temp;
alter function public.handle_new_user()                set search_path = public, auth, pg_temp;
alter function public.log_permission_change()          set search_path = public, auth, pg_temp;

-- Trigger functions: fired by triggers as the table owner, never via RPC.
revoke execute on function public.handle_new_user()        from public, anon, authenticated;
revoke execute on function public.log_permission_change()  from public, anon, authenticated;
revoke execute on function public.notify_new_message()     from public, anon, authenticated;

-- Audit writer: server-side only.
revoke execute on function public.log_payment_config_access(uuid, text, text, text, jsonb)
  from public, anon, authenticated;
grant  execute on function public.log_payment_config_access(uuid, text, text, text, jsonb)
  to service_role;

-- Permission helpers: remove anonymous RPC access, keep authenticated (may be
-- called via supabase.rpc()); not used in any RLS policy.
revoke execute on function public.is_admin()                from public, anon;
grant  execute on function public.is_admin()                to authenticated, service_role;
revoke execute on function public.is_admin_from_auth()      from public, anon;
grant  execute on function public.is_admin_from_auth()      to authenticated, service_role;
revoke execute on function public.is_manager_or_admin()     from public, anon;
grant  execute on function public.is_manager_or_admin()     to authenticated, service_role;
revoke execute on function public.has_location_access(uuid) from public, anon;
grant  execute on function public.has_location_access(uuid) to authenticated, service_role;
revoke execute on function public.can_access_document(uuid) from public, anon;
grant  execute on function public.can_access_document(uuid) to authenticated, service_role;
