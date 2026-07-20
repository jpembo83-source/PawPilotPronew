// Staff notifications feed: derived from live data (pending portal requests,
// vax review queue, open incidents, unread threads), per-user read state,
// unread counting against the last-seen timestamp.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import './setup';

const kvStore = new Map<string, unknown>();
vi.mock('../../supabase/functions/server/kv_store.tsx', () => ({
  get: vi.fn((key: string) => Promise.resolve(kvStore.get(key) ?? null)),
  set: vi.fn((key: string, value: unknown) => Promise.resolve(void kvStore.set(key, value))),
  del: vi.fn((key: string) => Promise.resolve(void kvStore.delete(key))),
  mget: vi.fn((keys: string[]) => Promise.resolve(keys.map((k) => kvStore.get(k) ?? null))),
  mset: vi.fn(() => Promise.resolve()),
  mdel: vi.fn(() => Promise.resolve()),
  getByPrefix: vi.fn((prefix: string) =>
    Promise.resolve(
      [...kvStore.entries()].filter(([k]) => k.startsWith(prefix)).map(([, v]) => v),
    ),
  ),
}));

const currentUser = {
  id: 'staff-1',
  role: 'staff',
  name: 'Staff Member',
  email: 'staff@example.com',
  tenantId: 'demo-tenant-001',
  locationIds: [] as string[],
};
vi.mock('../../supabase/functions/server/_shared/auth.ts', () => ({
  requireAuth: async (
    c: { set: (k: string, v: unknown) => void },
    next: () => Promise<void>,
  ) => {
    c.set('user', currentUser);
    await next();
  },
  requireRole: () => async (_c: unknown, next: () => Promise<void>) => next(),
}));

import app from '../../supabase/functions/server/notifications_routes';

const TENANT = 'demo-tenant-001';

interface FeedBody {
  items: Array<{ id: string; type: string; title: string; href: string; created_at: string }>;
  unread_count: number;
  last_seen_at: string | null;
}

const getFeed = async (): Promise<FeedBody> => {
  const res = await app.request('/');
  expect(res.status).toBe(200);
  return (await res.json()) as FeedBody;
};

beforeEach(() => {
  kvStore.clear();
  currentUser.id = 'staff-1';
});

function seedSources() {
  kvStore.set(`portal_booking:${TENANT}:pb1`, {
    id: 'pb1', status: 'pending', petName: 'Rex', serviceType: 'daycare',
    createdAt: '2026-07-19T10:00:00.000Z',
  });
  kvStore.set(`portal_booking:${TENANT}:pb2`, {
    id: 'pb2', status: 'approved', petName: 'Fido', createdAt: '2026-07-18T10:00:00.000Z',
  });
  kvStore.set(`vax_review_queue:${TENANT}:vq1`, {
    id: 'vq1', petName: 'Bella', createdAt: '2026-07-19T09:00:00.000Z',
  });
  kvStore.set('incident:main:inc1', {
    id: 'inc1', status: 'open', severity: 'minor', summary: 'Scraped paw at pickup',
    created_at: '2026-07-19T08:00:00.000Z',
  });
  kvStore.set('incident:main:inc2', {
    id: 'inc2', status: 'resolved', summary: 'Old incident', created_at: '2026-07-01T08:00:00.000Z',
  });
  kvStore.set('message_thread:th1', {
    id: 'th1', isUnread: true, householdName: 'Smith Family',
    lastMessagePreview: 'Is Rex ok today?', lastMessageAt: '2026-07-19T11:00:00.000Z',
  });
  kvStore.set('message_thread:th2', {
    id: 'th2', isUnread: false, householdName: 'Read Family', lastMessageAt: '2026-07-19T07:00:00.000Z',
  });
}

describe('GET /notifications', () => {
  it('derives one item per actionable record, newest first, resolved/handled excluded', async () => {
    seedSources();
    const feed = await getFeed();
    expect(feed.items.map((i) => i.id)).toEqual([
      'message:th1',      // 11:00
      'booking:pb1',      // 10:00
      'vax:vq1',          // 09:00
      'incident:inc1',    // 08:00
    ]);
    expect(feed.items[0].title).toBe('New message from Smith Family');
    expect(feed.items[1].href).toBe('/customers/pending-requests');
    expect(feed.items[3].href).toBe('/incidents/inc1');
    // Everything unread when the user has never opened the panel.
    expect(feed.unread_count).toBe(4);
    expect(feed.last_seen_at).toBeNull();
  });

  it('counts only items newer than the user last-seen timestamp as unread', async () => {
    seedSources();
    kvStore.set(`staff_notification_seen:${TENANT}:staff-1`, {
      last_seen_at: '2026-07-19T09:30:00.000Z',
    });
    const feed = await getFeed();
    // Newer than 09:30: message (11:00) + booking (10:00).
    expect(feed.unread_count).toBe(2);
    expect(feed.items).toHaveLength(4); // full list still returned
  });

  it('returns an empty, zero-unread feed when nothing is actionable', async () => {
    const feed = await getFeed();
    expect(feed.items).toEqual([]);
    expect(feed.unread_count).toBe(0);
  });
});

describe('POST /notifications/mark-read', () => {
  it('stamps last-seen for THIS user only and zeroes their unread count', async () => {
    seedSources();
    const res = await app.request('/mark-read', { method: 'POST' });
    expect(res.status).toBe(200);

    const after = await getFeed();
    expect(after.unread_count).toBe(0);
    expect(after.items).toHaveLength(4);

    // A different user still sees everything as unread.
    currentUser.id = 'staff-2';
    const other = await getFeed();
    expect(other.unread_count).toBe(4);
  });
});
