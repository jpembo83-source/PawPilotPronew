-- ============================================================================
-- Phase 4 / Customers stage-1 rehearsal — NEGATIVE fixture (abort path).
--
-- Adds one household with TWO is_primary contacts. Applying the backfill with
-- these keys present MUST abort with:
--   "phase4 customers backfill ABORTED: duplicate is_primary contacts …
--    hh_fix_dup (2 primary contacts)"
-- and roll back (stop condition in ops-customers-stage0.md: duplicates are
-- fixed in KV by the owner, never resolved silently by the migration).
--
-- Rehearsal sequence: seed main fixture + this file → apply migration →
-- expect abort → delete these 3 keys → re-apply → success.
-- ============================================================================

insert into public.kv_store_fc003b23 (key, value) values
('customer:demo-tenant-001:household:hh_fix_dup', jsonb_build_object(
  'id','hh_fix_dup','tenant_id','demo-tenant-001','name','Duplicate Primary Family',
  'created_at','2026-06-07T08:00:00.000Z','updated_at','2026-06-07T08:00:00.000Z')),
('customer:demo-tenant-001:contact:hh_fix_dup:con_dup_a', jsonb_build_object(
  'id','con_dup_a','household_id','hh_fix_dup',
  'first_name','First','last_name','Primary','is_primary',true,
  'created_at','2026-06-07T08:01:00.000Z','updated_at','2026-06-07T08:01:00.000Z')),
('customer:demo-tenant-001:contact:hh_fix_dup:con_dup_b', jsonb_build_object(
  'id','con_dup_b','household_id','hh_fix_dup',
  'first_name','Second','last_name','Primary','is_primary',true,
  'created_at','2026-06-07T08:02:00.000Z','updated_at','2026-06-07T08:02:00.000Z'))
on conflict (key) do update set value = excluded.value;

-- Cleanup (run after observing the abort, before the successful re-apply):
-- delete from public.kv_store_fc003b23
--  where key in ('customer:demo-tenant-001:household:hh_fix_dup',
--                'customer:demo-tenant-001:contact:hh_fix_dup:con_dup_a',
--                'customer:demo-tenant-001:contact:hh_fix_dup:con_dup_b');
