// Single helper that writes an in-app notification record + best-effort fires a transactional
// email. Email failures are logged but do NOT fail the calling handler — the in-app
// notification is the source of truth.

import * as kv from "../kv_store.tsx";
import { getEmailSender } from "./email.ts";
import { logError } from "../_shared/log.ts";

export type PortalNotificationType =
  | "booking.received"
  | "booking.confirmed"
  | "booking.declined"
  | "booking.cancelled"
  | "vax.approved"
  | "vax.rejected"
  | "vax.expiring"
  // Tracker events — emitted by the invoxia-event-detector edge function
  // and (optionally) by /portal/internal/tracker-event for ops/test seeding.
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

interface NotifyArgs {
  tenantId: string;
  householdId: string;
  type: PortalNotificationType;
  payload: Record<string, unknown>;
  link: string | null;
  email?: { to: string; subject: string; html: string; text?: string };
}

export async function notify(args: NotifyArgs) {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await kv.set(`notification:${args.tenantId}:${args.householdId}:${id}`, {
    id,
    tenantId: args.tenantId,
    householdId: args.householdId,
    type: args.type,
    payload: args.payload,
    link: args.link,
    readAt: null,
    createdAt: now,
  });

  if (args.email) {
    // Respect notification prefs on the portal user record
    const link = (await kv.get(`portal_users:${args.tenantId}:${args.householdId}`)) as any;
    const prefs = link?.notificationPrefs ?? { booking: true, vax: true, tracker: true };
    const category = args.type.startsWith("booking")
      ? "booking"
      : args.type.startsWith("vax")
      ? "vax"
      : args.type.startsWith("tracker")
      ? "tracker"
      : "other";
    if (prefs[category] === false) return;
    try {
      await getEmailSender().send(args.email);
    } catch (e) {
      logError("notify.emailSend.failed", e, { tenantId: args.tenantId, householdId: args.householdId, type: args.type });
    }
  }
}

export async function getOwnerEmail(tenantId: string, householdId: string): Promise<string | null> {
  // Lookup primary contact email on the household
  const household = (await kv.get(`customer:${tenantId}:household:${householdId}`)) as any;
  if (!household) return null;
  if (household.primary_contact_id) {
    const direct = await kv.get(`customer:${tenantId}:contact:${householdId}:${household.primary_contact_id}`) as any;
    if (direct?.email) return direct.email;
  }
  const all = (await kv.getByPrefix(`customer:${tenantId}:contact:${householdId}:`)) as any[];
  const primary = all.find((c) => c.is_primary) ?? all[0];
  return primary?.email ?? null;
}

export async function getOwnerName(tenantId: string, householdId: string): Promise<string> {
  const household = (await kv.get(`customer:${tenantId}:household:${householdId}`)) as any;
  if (household?.primary_contact_id) {
    const c = (await kv.get(`customer:${tenantId}:contact:${householdId}:${household.primary_contact_id}`)) as any;
    if (c?.first_name) return c.first_name;
  }
  const contacts = (await kv.getByPrefix(`customer:${tenantId}:contact:${householdId}:`)) as any[];
  const primary = contacts.find((c) => c.is_primary) ?? contacts[0];
  return primary?.first_name ?? "there";
}
