-- Revoke public RPC EXECUTE on the SECURITY DEFINER RBAC helper functions.
--
-- 20260623220200_harden_function_security stripped `anon` but left
-- `authenticated` EXECUTE on these, which exposes them at
-- /rest/v1/rpc/<fn> to any logged-in user. Nothing in the active app calls
-- them via supabase.rpc() (grep: zero .rpc() call sites in project/ or
-- portal/), and the edge functions run as service_role, so direct RPC
-- access is pure attack surface.
--
-- They ARE referenced by RLS policies, but only on legacy_jan2026 tables
-- (schema not exposed via PostgREST) and one storage.objects policy for the
-- unused 'employee-documents' bucket (zero references in the codebase).
-- Policy expressions evaluate with the querying role's privileges, so those
-- legacy policies would fail for `authenticated` after this revoke — which
-- is acceptable for dead surfaces and is exactly what the staging/prod
-- verification step checks. service_role keeps EXECUTE throughout.
--
-- Idempotent and existence-guarded: the staging (active-schema) project does
-- not have these functions at all — skip with a notice instead of failing.

do $$
declare
  fn text;
begin
  foreach fn in array array[
    'public.is_admin()',
    'public.is_admin_from_auth()',
    'public.is_manager_or_admin()',
    'public.has_location_access(uuid)',
    'public.can_access_document(uuid)'
  ] loop
    if to_regprocedure(fn) is not null then
      execute format('revoke execute on function %s from anon, authenticated', fn);
      raise notice 'revoked execute on % from anon, authenticated', fn;
    else
      raise notice 'skipping % — not present in this database', fn;
    end if;
  end loop;
end $$;
