-- Phase 4 — make the stage-0 RLS policies actually evaluable.
--
-- The customer-table policies (20260611201256) call the app.* JWT claim
-- helpers, but policy expressions evaluate with the QUERYING role's
-- privileges and `authenticated` was never granted USAGE on schema app nor
-- EXECUTE on the helpers — so every policy check failed with "permission
-- denied for schema app" instead of filtering rows. Surfaced by the stage-2
-- dual-write exercise's PostgREST read-back (the first authenticated,
-- non-service-role reader these tables ever had).
--
-- Grants are the minimum for policy evaluation: the helpers only read the
-- caller's own JWT claims (auth.jwt()), so exposing EXECUTE to authenticated
-- discloses nothing that isn't already in the caller's token.

grant usage on schema app to authenticated;
grant execute on function app.jwt_tenant_id()   to authenticated;
grant execute on function app.jwt_household_id() to authenticated;
grant execute on function app.jwt_role()        to authenticated;
grant execute on function app.is_staff()        to authenticated;
