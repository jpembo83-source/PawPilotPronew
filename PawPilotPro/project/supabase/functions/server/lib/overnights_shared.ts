// Shared overnight-stay helpers used by overnights_routes and the portal
// approval bridge (portal_bookings), so both sides agree on which nights a
// stay occupies, which statuses still hold a bed, and what a night costs.
//
// Pure semantics live in overnight_semantics.ts (unit-tested via vitest);
// this module adds the kv-backed lookups on top.

import * as kv from "../kv_store.tsx";
import {
  DEFAULT_OVERNIGHT_RATE,
  firstFullNight,
  nightsOf,
  occupiesNight,
  TERMINAL_OVERNIGHT_STATUSES,
} from "./overnight_semantics.ts";

export { DEFAULT_OVERNIGHT_RATE, nightsOf, occupiesNight, TERMINAL_OVERNIGHT_STATUSES };

export interface OvernightCapacityRecord {
  maxOvernightCapacity?: number;
  bufferSlots?: number;
  pricePerNight?: unknown;
}

export async function getOvernightCapacity(
  tenantId: string,
  locationId: string | undefined,
): Promise<OvernightCapacityRecord | null> {
  if (!locationId) return null;
  return (await kv.get(`overnight:${tenantId}:capacity:${locationId}`)) as OvernightCapacityRecord | null;
}

/**
 * The configured nightly rate for a location (Overnights → Capacity), the
 * source of truth for boarding pricing. Falls back to DEFAULT_OVERNIGHT_RATE
 * when unset or non-positive.
 */
export async function nightlyRateFor(tenantId: string, locationId: string | undefined): Promise<number> {
  const capacity = await getOvernightCapacity(tenantId, locationId);
  const rate = capacity?.pricePerNight;
  return typeof rate === "number" && rate > 0 ? rate : DEFAULT_OVERNIGHT_RATE;
}

/**
 * Capacity gate for a prospective stay. Returns the first night that has no
 * bed left, or null when every night fits (or the location has no capacity
 * configured — unconfigured locations are not enforced).
 *
 * `useBuffer: false` (bookings) keeps `bufferSlots` in reserve; `true`
 * (daycare→overnight transitions, i.e. a dog already on site) may spend the
 * emergency buffer up to the hard maximum.
 */
export async function findFullNight(opts: {
  tenantId: string;
  locationId: string;
  startDate: string;
  endDate: string;
  excludeReservationId?: string;
  useBuffer?: boolean;
}): Promise<{ date: string; capacity: number } | null> {
  const { tenantId, locationId, startDate, endDate, excludeReservationId, useBuffer } = opts;
  const capacity = await getOvernightCapacity(tenantId, locationId);
  const max = capacity?.maxOvernightCapacity;
  if (typeof max !== "number" || max <= 0) return null;
  const buffer = typeof capacity?.bufferSlots === "number" ? capacity.bufferSlots : 0;
  const effective = useBuffer ? max : Math.max(0, max - buffer);

  const reservations = (await kv.getByPrefix(`overnight:${tenantId}:reservation:`)) as any[];
  const relevant = reservations.filter(
    (r: any) => r && r.locationId === locationId && r.id !== excludeReservationId,
  );

  const date = firstFullNight(startDate, endDate, relevant, effective);
  return date ? { date, capacity: effective } : null;
}

/** Append an entry to a stay's audit trail. */
export async function recordOvernightEvent(
  tenantId: string,
  stayId: string,
  eventType: string,
  actorUserId: string,
  actorName: string,
  metadata?: Record<string, unknown>,
) {
  const event = {
    id: crypto.randomUUID(),
    stayId,
    eventType,
    actorUserId,
    actorName,
    timestamp: new Date().toISOString(),
    metadata: metadata || {},
    tenant_id: tenantId,
  };
  await kv.set(`overnight:${tenantId}:event:${event.id}`, event);
  return event;
}
