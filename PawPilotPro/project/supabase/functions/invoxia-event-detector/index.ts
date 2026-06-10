/**
 * invoxia-event-detector
 *
 * Cron-driven (every 5 min via pg_cron) tracker-event detector.  Reads
 * invoxia.devices + invoxia.device_status_summary, compares against the
 * last-seen values it stored in invoxia.notification_state, and POSTs
 * detected state transitions to /portal/internal/tracker-event so they
 * surface in the owner's bell + drawer.
 *
 * What it detects today (cheap, deterministic, no motion classifier):
 *
 *   - tracker.battery_low      — pct dropped below 15 while not charging
 *   - tracker.battery_charged  — was low (or notified low), now >= 95
 *                                while not charging (i.e. you took it off)
 *   - tracker.offline          — offline_alert flipped true
 *   - tracker.online           — offline_alert flipped false
 *
 * Out of scope until the motion classifier ships (separate phase):
 *
 *   - tracker.walk_started / walk_ended
 *   - tracker.transport_started / transport_ended
 *   - tracker.zoomies
 *   - tracker.zone_left / zone_entered  (needs geofence configuration)
 *
 * Those event types are already plumbed end-to-end (types + drawer + ingest
 * endpoint) so when the classifier lands all it has to do is POST to the
 * same endpoint.  In the meantime ops can also seed any of them by hand
 * via the same endpoint:
 *
 *   curl -X POST $SUPABASE_URL/functions/v1/make-server-fc003b23/portal/internal/tracker-event \
 *     -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
 *     -d '{ "tenantId":"...","householdId":"...","petId":"...",
 *           "petName":"Meg","type":"tracker.zoomies" }'
 *
 * Rate limiting: each event type has its own column in notification_state
 * and a min-cooldown so a flapping tracker doesn't spam the drawer.
 */
import { createClient } from "jsr:@supabase/supabase-js@2.49.8";

const SUPABASE_URL  = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY   = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// How often each event type is allowed to fire per device.
const COOLDOWN_HOURS = {
  battery_low:     24,
  battery_charged:  6,
  offline:          1,
  online:           1,
};
const HOUR_MS = 3_600_000;

interface DeviceRow {
  id: string;
  name: string | null;
  pet_id: string | null;
}

interface StatusRow {
  battery_pct: number | null;
  charging: boolean | null;
  state: string | null;
  offline_alert: boolean | null;
  low_battery_alert: boolean | null;
  last_synced_at: string | null;
}

interface StateRow {
  device_id: string;
  last_battery_pct: number | null;
  last_charging: boolean | null;
  last_offline_alert: boolean | null;
  last_state: string | null;
  last_battery_low_at: string | null;
  last_battery_charged_at: string | null;
  last_offline_at: string | null;
  last_online_at: string | null;
}

interface PetLink {
  petId: string;
  petName: string;
  tenantId: string;
  householdId: string;
}

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false },
});

/* --------------------------------------------------------------------- */
/* Pet lookup                                                             */
/* --------------------------------------------------------------------- */
/**
 * Resolve a pet id → (tenantId, householdId, petName) by querying the KV
 * table via JSONB ops.  One SQL round-trip per pet.  Cheaper than scanning
 * customer:* with getByPrefix.
 */
async function resolvePet(petId: string): Promise<PetLink | null> {
  const { data, error } = await admin
    .from("kv_store_fc003b23")
    .select("key, value")
    .like("key", `customer:%:pet:%:${petId}`)
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  const v = data.value as any;
  // Key shape: customer:{tenantId}:pet:{householdId}:{petId}
  const parts = (data.key as string).split(":");
  if (parts.length !== 5 || parts[0] !== "customer" || parts[2] !== "pet") return null;
  return {
    petId,
    petName: v?.name ?? "Your pet",
    tenantId: parts[1],
    householdId: parts[3],
  };
}

/* --------------------------------------------------------------------- */
/* Notify                                                                 */
/* --------------------------------------------------------------------- */
async function emitEvent(
  link: PetLink,
  type: string,
  extras: Record<string, unknown> = {},
): Promise<void> {
  const url = `${SUPABASE_URL}/functions/v1/make-server-fc003b23/portal/internal/tracker-event`;
  const body = JSON.stringify({
    tenantId:    link.tenantId,
    householdId: link.householdId,
    petId:       link.petId,
    petName:     link.petName,
    type,
    payload:     extras,
  });
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
    },
    body,
  });
  if (!res.ok) {
    const txt = await res.text();
    console.error("[detector] notify failed", res.status, txt);
  } else {
    console.log("[detector] emitted", type, "for", link.petName);
  }
}

/* --------------------------------------------------------------------- */
/* Detector                                                               */
/* --------------------------------------------------------------------- */

function cooledDown(lastAt: string | null, hours: number): boolean {
  if (!lastAt) return true;
  return Date.now() - new Date(lastAt).getTime() > hours * HOUR_MS;
}

async function detectForDevice(device: DeviceRow): Promise<{ events: number }> {
  if (!device.pet_id) return { events: 0 };

  const [statusRes, stateRes] = await Promise.all([
    admin.schema("invoxia").from("device_status_summary")
      .select("battery_pct, charging, state, offline_alert, low_battery_alert, last_synced_at")
      .eq("device_id", device.id)
      .maybeSingle(),
    admin.schema("invoxia").from("notification_state")
      .select("*")
      .eq("device_id", device.id)
      .maybeSingle(),
  ]);
  if (statusRes.error) {
    console.error("[detector] status fetch failed for", device.id, statusRes.error);
    return { events: 0 };
  }
  const status = statusRes.data as StatusRow | null;
  if (!status) return { events: 0 };

  const state = (stateRes.data ?? null) as StateRow | null;
  const pet = await resolvePet(device.pet_id);
  if (!pet) {
    console.warn("[detector] no pet record for pet_id", device.pet_id, "device", device.id);
    return { events: 0 };
  }

  let emitted = 0;
  const now = new Date().toISOString();

  // ---------- Battery LOW transition ----------
  // Threshold = 15%. Only fire when not charging (the user just plugged it
  // in would otherwise count as "running low") and only once per cooldown.
  if (
    status.battery_pct != null &&
    status.battery_pct < 15 &&
    status.charging === false &&
    (state?.last_battery_pct == null || state.last_battery_pct >= 15) &&
    cooledDown(state?.last_battery_low_at ?? null, COOLDOWN_HOURS.battery_low)
  ) {
    await emitEvent(pet, "tracker.battery_low", { batteryPct: status.battery_pct });
    emitted++;
  }

  // ---------- Battery CHARGED transition ----------
  // Fire when we previously notified low AND the tracker is now full.  We
  // accept "full" as >= 95% while not charging (i.e. owner removed it from
  // the cradle) — using the previous-was-charging signal is unreliable
  // because the sync may not catch the brief charging-true blip.
  if (
    status.battery_pct != null &&
    status.battery_pct >= 95 &&
    status.charging === false &&
    state?.last_battery_low_at != null &&
    (state?.last_battery_charged_at == null ||
      new Date(state.last_battery_charged_at) < new Date(state.last_battery_low_at)) &&
    cooledDown(state?.last_battery_charged_at ?? null, COOLDOWN_HOURS.battery_charged)
  ) {
    await emitEvent(pet, "tracker.battery_charged", { batteryPct: status.battery_pct });
    emitted++;
  }

  // ---------- Offline transition ----------
  if (
    status.offline_alert === true &&
    state?.last_offline_alert !== true &&
    cooledDown(state?.last_offline_at ?? null, COOLDOWN_HOURS.offline)
  ) {
    await emitEvent(pet, "tracker.offline");
    emitted++;
  }

  // ---------- Online transition ----------
  if (
    status.offline_alert === false &&
    state?.last_offline_alert === true &&
    cooledDown(state?.last_online_at ?? null, COOLDOWN_HOURS.online)
  ) {
    await emitEvent(pet, "tracker.online");
    emitted++;
  }

  // ---------- Persist new state ----------
  const newState = {
    device_id: device.id,
    last_battery_pct:   status.battery_pct,
    last_charging:      status.charging,
    last_offline_alert: status.offline_alert,
    last_state:         status.state,
    // Only stamp the *_at columns when we actually emitted, so we don't
    // reset the cooldown clock on every detector run.
    last_battery_low_at:     emitted && status.battery_pct != null && status.battery_pct < 15
      ? now : state?.last_battery_low_at ?? null,
    last_battery_charged_at: emitted && status.battery_pct != null && status.battery_pct >= 95
      ? now : state?.last_battery_charged_at ?? null,
    last_offline_at:         emitted && status.offline_alert === true && state?.last_offline_alert !== true
      ? now : state?.last_offline_at ?? null,
    last_online_at:          emitted && status.offline_alert === false && state?.last_offline_alert === true
      ? now : state?.last_online_at ?? null,
    updated_at: now,
  };

  const { error: stateErr } = await admin
    .schema("invoxia").from("notification_state")
    .upsert(newState, { onConflict: "device_id" });
  if (stateErr) console.error("[detector] notification_state upsert failed", stateErr);

  return { events: emitted };
}

/* --------------------------------------------------------------------- */
/* Entrypoint                                                             */
/* --------------------------------------------------------------------- */

/**
 * Seed mode (called as `?seed=1`): emit one of every tracker event type per
 * device, without consulting state.  Useful to visually verify the drawer
 * rendering end-to-end before the motion classifier provides real signal
 * for walk / transport / zoomies.  Does NOT touch invoxia.notification_state,
 * so the real detector's de-dup logic is unaffected.
 *
 * Anyone with the URL can hit this — same rationale as the regular detect
 * mode (no caller-controlled input, no sensitive data exposed).  Strip the
 * branch later when seeding is no longer useful.
 */
const SAMPLE_EVENTS: Array<{ type: string; payload?: Record<string, unknown> }> = [
  { type: "tracker.zone_left",          payload: { zoneName: "Home" } },
  { type: "tracker.zone_entered",       payload: { zoneName: "Park" } },
  { type: "tracker.walk_started" },
  { type: "tracker.walk_ended" },
  { type: "tracker.transport_started" },
  { type: "tracker.transport_ended" },
  { type: "tracker.zoomies" },
  { type: "tracker.battery_low",        payload: { batteryPct: 12 } },
  { type: "tracker.battery_charged",    payload: { batteryPct: 100 } },
  { type: "tracker.offline" },
  { type: "tracker.online" },
];

async function seedForDevice(device: DeviceRow): Promise<{ events: number }> {
  if (!device.pet_id) return { events: 0 };
  const pet = await resolvePet(device.pet_id);
  if (!pet) return { events: 0 };

  for (const ev of SAMPLE_EVENTS) {
    await emitEvent(pet, ev.type, ev.payload ?? {});
  }
  return { events: SAMPLE_EVENTS.length };
}

Deno.serve(async (req: Request) => {
  const t0 = Date.now();
  const url = new URL(req.url);
  const isSeed = url.searchParams.get("seed") === "1";

  const { data: devices, error } = await admin.schema("invoxia").from("devices")
    .select("id, name, pet_id")
    .not("pet_id", "is", null);
  if (error) {
    console.error("[detector] device fetch failed", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  let totalEvents = 0;
  let scanned = 0;
  for (const d of (devices ?? []) as DeviceRow[]) {
    try {
      const r = isSeed ? await seedForDevice(d) : await detectForDevice(d);
      totalEvents += r.events;
      scanned++;
    } catch (e) {
      console.error("[detector] device error", d.id, e);
    }
  }

  const summary = {
    ok: true,
    mode: isSeed ? "seed" : "detect",
    scanned,
    eventsEmitted: totalEvents,
    durationMs: Date.now() - t0,
  };
  console.log("[detector] run summary", summary);
  return new Response(JSON.stringify(summary), {
    headers: { "Content-Type": "application/json", "Connection": "keep-alive" },
  });
});
