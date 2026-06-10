/**
 * Wire-format notification types. Anything the portal NotificationDrawer can
 * render lives here; the backend lib/notify.ts mirrors this union.
 *
 * Tracker.* events come from the Invoxia sync (server-side detection on the
 * invoxia.* schema) and surface in the portal's bell/drawer.  Each one
 * carries a small payload — at minimum a petName so the drawer can compose
 * "Meg has finished moving" rather than "Tracker has finished moving".
 */
export type NotificationType =
  | "booking.received"
  | "booking.confirmed"
  | "booking.declined"
  | "booking.cancelled"
  | "vax.approved"
  | "vax.rejected"
  | "vax.expiring"
  // ----- Tracker / collar events ------------------------------------
  | "tracker.zone_left"
  | "tracker.zone_entered"
  | "tracker.walk_started"
  | "tracker.walk_ended"
  | "tracker.transport_started"
  | "tracker.transport_ended"
  | "tracker.zoomies"
  | "tracker.battery_low"
  | "tracker.battery_charged"
  | "tracker.offline"
  | "tracker.online";

/**
 * Per-type payload shape. The drawer reads from this to compose titles
 * and badges; the backend only needs to write the fields it has.  All
 * fields are optional so older/server-side stub events still render.
 */
export interface NotificationTrackerPayload {
  /** The pet the event is about. Renders as the subject in the title. */
  petName?: string;
  /** Pet id, for routing into the right detail screen on tap. */
  petId?: string;
  /** Geofence zone name ("Home", "Park"). Only on tracker.zone_*. */
  zoneName?: string;
  /** Battery percentage at the time of the event. Only on battery_*. */
  batteryPct?: number;
  /** Speed (km/h) or distance (m) snapshot for activity/zoomies events. */
  metric?: { kind: "speed_kmh" | "distance_m" | "duration_min"; value: number };
  /** Detector run id, useful for de-dup audits. */
  source?: { detector: string; runId?: string };
}

export interface NotificationEvent<T = unknown> {
  id: string;
  tenantId: string;
  customerId: string;
  type: NotificationType;
  payload: T;
  link: string | null;
  readAt: string | null;
  createdAt: string;
}
