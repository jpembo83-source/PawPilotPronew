-- Raw BLE packets captured by the portal iOS app's collar bridge.
-- The bridge subscribes to all notify characteristics on Invoxia's BLE data
-- service (011B1500-…) and forwards every packet here. The bytes are
-- opaque until decoded — we land them raw, decode later when we know the
-- TLV / Apex schema.

create table if not exists invoxia.ble_packets (
  id              bigserial primary key,
  device_serial   text,                                        -- e.g. '115315' (parsed from LWT6_115315)
  pet_id          text,                                        -- PawPilotPro pet id (from /portal/pets/:id)
  tenant_id       text,
  household_id    text,
  char_uuid       text not null,                               -- BLE characteristic that emitted this
  hex             text not null,                               -- raw payload as lowercase hex
  byte_count      integer generated always as (length(hex)/2) stored,
  received_at     timestamptz not null,                        -- client-side capture time
  inserted_at     timestamptz not null default now()
);

create index if not exists ble_packets_pet_time_idx
  on invoxia.ble_packets(pet_id, received_at desc);
create index if not exists ble_packets_serial_time_idx
  on invoxia.ble_packets(device_serial, received_at desc);
create index if not exists ble_packets_char_idx
  on invoxia.ble_packets(char_uuid);

-- RLS — service role writes via portal; authenticated users can read their tenant's.
alter table invoxia.ble_packets enable row level security;

drop policy if exists "tenant can read own ble_packets" on invoxia.ble_packets;
create policy "tenant can read own ble_packets"
  on invoxia.ble_packets for select
  to authenticated
  using (tenant_id is not null and tenant_id = invoxia.current_tenant_id());

grant select on invoxia.ble_packets to authenticated;
grant select, insert, update, delete on invoxia.ble_packets to service_role;
grant usage on all sequences in schema invoxia to service_role;

-- Convenience view: per-pet capture status (count, latest seen, channel breakdown)
create or replace view invoxia.ble_capture_status
with (security_invoker = true)
as
select
  p.pet_id,
  p.device_serial,
  count(*) as packet_count,
  count(*) filter (where p.byte_count > 0) as non_empty_count,
  max(p.received_at) as latest_packet_at,
  jsonb_object_agg(
    coalesce(short.label, substr(p.char_uuid, 1, 8)),
    cnt.n
  ) as per_channel
from (
  select pet_id, device_serial, char_uuid, hex, byte_count, received_at
  from invoxia.ble_packets
) p
cross join lateral (
  select count(*) as n
  from invoxia.ble_packets q
  where q.pet_id = p.pet_id and q.char_uuid = p.char_uuid
) cnt
left join (
  values
    ('011B1508-2212-4DBF-9E2B-6722A4552380'::text, 'heartbeat'),
    ('011B1510-2212-4DBF-9E2B-6722A4552380'::text, 'status'),
    ('011B1511-2212-4DBF-9E2B-6722A4552380'::text, 'log'),
    ('011B1514-2212-4DBF-9E2B-6722A4552380'::text, 'ch14'),
    ('011B1520-2212-4DBF-9E2B-6722A4552380'::text, 'ch20')
) short(uuid, label) on upper(short.uuid) = upper(p.char_uuid)
group by p.pet_id, p.device_serial;

grant select on invoxia.ble_capture_status to authenticated, service_role;
