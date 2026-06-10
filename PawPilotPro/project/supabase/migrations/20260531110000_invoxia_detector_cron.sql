-- Schedule the invoxia-event-detector edge function to run every 5 minutes.
--
-- The function compares each device's latest `device_status_summary` row
-- against the per-device `notification_state` it stored on its last run,
-- emits POSTs to /portal/internal/tracker-event for transitions, then
-- upserts notification_state.  It's idempotent: running it more or less
-- often only changes detection latency, not correctness.
--
-- The function was deployed with --no-verify-jwt because it reads no
-- request input and writes nothing the caller can influence; the cron
-- call therefore needs no Authorization header.
--
-- We enable pg_cron + pg_net here defensively (they ship preloaded on
-- Supabase but a stripped project might not have them yet) and use
-- `create extension if not exists` so this is safe to re-run.
create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net  with schema extensions;

-- Remove any previous schedule under the same name so this migration is
-- idempotent across re-runs (cron.unschedule errors if not found, hence
-- the guard).
do $$
begin
  if exists (select 1 from cron.job where jobname = 'invoxia-event-detector') then
    perform cron.unschedule('invoxia-event-detector');
  end if;
end $$;

select cron.schedule(
  'invoxia-event-detector',
  '*/5 * * * *',
  $$
    select net.http_post(
      url     := 'https://ruahrxkfgfyshuxykiay.supabase.co/functions/v1/invoxia-event-detector',
      body    := '{}'::jsonb,
      headers := '{"Content-Type":"application/json"}'::jsonb,
      timeout_milliseconds := 60000
    );
  $$
);
