-- Per-device record of the latest values the event detector has seen
-- and the timestamps of the most recent notifications it emitted.
--
-- The detector compares the live `device_status_summary` row against the
-- values stored here to decide what's a state TRANSITION worth notifying
-- vs. just the same condition continuing.  Without this dedupe layer
-- every detector tick would re-notify the same "battery low" until the
-- owner intervened.
--
-- One row per Invoxia device; deleted automatically if the device is
-- removed from invoxia.devices.
create table if not exists invoxia.notification_state (
  -- invoxia.devices.id is bigint; mirror that so the FK constraint compiles.
  device_id              bigint primary key references invoxia.devices(id) on delete cascade,

  -- Latest sampled values from device_status_summary the detector saw.
  last_battery_pct       numeric,
  last_charging          boolean,
  last_offline_alert     boolean,
  last_state             text,

  -- When each event was last emitted, used for rate-limiting (eg. don't
  -- re-fire battery_low more than once per 24h even if the tracker keeps
  -- bumping around the threshold).
  last_battery_low_at    timestamptz,
  last_battery_charged_at timestamptz,
  last_offline_at        timestamptz,
  last_online_at         timestamptz,
  last_zone_event_at     timestamptz,
  last_walk_event_at     timestamptz,
  last_transport_event_at timestamptz,
  last_zoomies_at        timestamptz,

  updated_at             timestamptz not null default now()
);

create index if not exists notification_state_updated_idx
  on invoxia.notification_state(updated_at desc);

alter table invoxia.notification_state enable row level security;

-- Only the service role writes here (the detector function uses it); no
-- authenticated reads — surfaced data is the notification record itself.
grant select, insert, update, delete on invoxia.notification_state to service_role;
