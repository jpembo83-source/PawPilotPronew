// Staff notifications feed — powers the header bell.
//
// The feed is DERIVED from live operational data rather than stored events:
// pending portal booking requests, the vaccination review queue, open
// incidents, and unread customer message threads. Deriving keeps it always
// consistent with reality (approve a request anywhere and the notification
// disappears) and needs no instrumentation of the write paths that create
// those records.
//
// Per-user read state is a single last-seen timestamp
// (staff_notification_seen:{tenant}:{userId}) — items newer than it count as
// unread. Marking read never mutates the underlying records.

import { Hono } from 'npm:hono';
import * as kv from './kv_store.tsx';
import { requireAuth } from './_shared/auth.ts';
import { internalError } from './_shared/log.ts';

const app = new Hono();
app.use('*', requireAuth);

type Rec = Record<string, unknown>;

export interface StaffNotification {
  id: string;
  type: 'booking_request' | 'vaccination' | 'incident' | 'message';
  title: string;
  body: string;
  created_at: string;
  href: string;
}

const isRecord = (v: unknown): v is Rec =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

const str = (v: unknown): string | null =>
  typeof v === 'string' && v.trim() ? v : null;

/** First parseable date among the fields, as ISO — records vary by module. */
function recordDate(rec: Rec, fields: string[]): string | null {
  for (const field of fields) {
    const raw = str(rec[field]);
    if (!raw) continue;
    const parsed = new Date(raw);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
  }
  return null;
}

const MAX_ITEMS = 30;

const seenKey = (tenantId: string, userId: string) =>
  `staff_notification_seen:${tenantId}:${userId}`;

app.get('/', async (c) => {
  try {
    const user = c.get('user');
    const tenantId = user.tenantId;

    const [bookings, vaxQueue, incidents, threads, seen] = await Promise.all([
      kv.getByPrefix(`portal_booking:${tenantId}:`),
      kv.getByPrefix(`vax_review_queue:${tenantId}:`),
      kv.getByPrefix('incident:main:'),
      kv.getByPrefix('message_thread:'),
      kv.get(seenKey(tenantId, user.id)),
    ]);

    const items: StaffNotification[] = [];

    for (const rec of (bookings ?? []).filter(isRecord)) {
      const id = str(rec.id);
      if (!id || str(rec.status) !== 'pending') continue;
      const petName = str(rec.petName) ?? str(rec.pet_name);
      const service = str(rec.serviceType) ?? str(rec.service_type) ?? 'booking';
      items.push({
        id: `booking:${id}`,
        type: 'booking_request',
        title: petName ? `New booking request for ${petName}` : 'New booking request',
        body: `A customer requested a ${service} — waiting in the Portal Inbox.`,
        created_at: recordDate(rec, ['createdAt', 'created_at', 'submittedAt']) ?? '',
        href: '/customers/pending-requests',
      });
    }

    for (const rec of (vaxQueue ?? []).filter(isRecord)) {
      const id = str(rec.id);
      if (!id) continue;
      // Reviewed entries carry a status/resolution; fresh uploads do not.
      const status = str(rec.status);
      if (status && status !== 'pending') continue;
      const petName = str(rec.petName);
      items.push({
        id: `vax:${id}`,
        type: 'vaccination',
        title: petName
          ? `Vaccination record for ${petName} needs review`
          : 'Vaccination record needs review',
        body: 'A customer uploaded a vaccination document for approval.',
        created_at: recordDate(rec, ['createdAt', 'created_at', 'uploadedAt']) ?? '',
        href: '/customers/pending-requests?tab=vaccinations',
      });
    }

    for (const rec of (incidents ?? []).filter(isRecord)) {
      const id = str(rec.id);
      if (!id) continue;
      const status = str(rec.status);
      if (status === 'closed' || status === 'resolved') continue;
      const severity = str(rec.severity);
      const summary = str(rec.summary) ?? 'Incident reported';
      items.push({
        id: `incident:${id}`,
        type: 'incident',
        title: severity ? `Open ${severity} incident` : 'Open incident',
        body: summary.length > 120 ? `${summary.slice(0, 117)}…` : summary,
        created_at: recordDate(rec, ['created_at', 'occurred_at', 'createdAt']) ?? '',
        href: `/incidents/${id}`,
      });
    }

    for (const rec of (threads ?? []).filter(isRecord)) {
      const id = str(rec.id);
      if (!id || rec.isUnread !== true) continue;
      const household = str(rec.householdName);
      items.push({
        id: `message:${id}`,
        type: 'message',
        title: household ? `New message from ${household}` : 'New customer message',
        body: str(rec.lastMessagePreview) ?? 'Open Messages to read and reply.',
        created_at: recordDate(rec, ['lastMessageAt', 'updatedAt', 'createdAt']) ?? '',
        href: '/messages',
      });
    }

    items.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
    const capped = items.slice(0, MAX_ITEMS);

    const lastSeenAt = isRecord(seen) ? str(seen.last_seen_at) : null;
    const unreadCount = lastSeenAt
      ? capped.filter((i) => i.created_at > lastSeenAt).length
      : capped.length;

    return c.json({
      items: capped,
      unread_count: unreadCount,
      last_seen_at: lastSeenAt,
      total: items.length,
    });
  } catch (e) {
    return internalError(c, 'notifications.list', e);
  }
});

// Marks everything currently in the feed as seen for THIS user only.
app.post('/mark-read', async (c) => {
  try {
    const user = c.get('user');
    const lastSeenAt = new Date().toISOString();
    await kv.set(seenKey(user.tenantId, user.id), { last_seen_at: lastSeenAt });
    return c.json({ last_seen_at: lastSeenAt });
  } catch (e) {
    return internalError(c, 'notifications.markRead', e);
  }
});

export default app;
