import { describe, it, expect } from 'vitest';
import {
  buildNotificationItems,
  pendingNotificationTotal,
  type NotificationAccess,
} from '../../src/app/lib/notificationItems';

const ALL: NotificationAccess = { inbox: true, photos: true, messages: true };
const inbox = { pendingRequests: 2, petVerifications: 1, vaxQueue: 3, total: 6 };

describe('buildNotificationItems — the bell is a work-queue aggregator', () => {
  it('builds every queue the user can access, each deep-linking to the page that clears it', () => {
    const items = buildNotificationItems({
      inbox,
      photoQueue: 4,
      unreadMessages: 5,
      access: ALL,
    });
    expect(items.map((i) => [i.key, i.count, i.to])).toEqual([
      ['booking_requests', 2, '/customers/pending-requests?tab=bookings'],
      ['pet_verifications', 1, '/customers/pending-requests?tab=pets'],
      ['vax_reviews', 3, '/customers/pending-requests?tab=vaccinations'],
      ['photo_review', 4, '/daycare/photo-review'],
      ['messages', 5, '/messages'],
    ]);
    expect(pendingNotificationTotal(items)).toBe(15);
  });

  it('omits sources the user cannot access — never shows them as zero', () => {
    const items = buildNotificationItems({
      inbox,
      photoQueue: 4,
      unreadMessages: 5,
      access: { inbox: true, photos: false, messages: false },
    });
    expect(items.map((i) => i.key)).toEqual([
      'booking_requests',
      'pet_verifications',
      'vax_reviews',
    ]);
    expect(pendingNotificationTotal(items)).toBe(6);
  });

  it('omits sources that have not loaded yet (null), so the badge never guesses', () => {
    const items = buildNotificationItems({
      inbox: null,
      photoQueue: null,
      unreadMessages: null,
      access: ALL,
    });
    expect(items).toEqual([]);
    expect(pendingNotificationTotal(items)).toBe(0);
  });

  it('keeps zero-count rows in the data (the sheet hides them; the total ignores them)', () => {
    const items = buildNotificationItems({
      inbox: { pendingRequests: 0, petVerifications: 0, vaxQueue: 0, total: 0 },
      photoQueue: 0,
      unreadMessages: 0,
      access: ALL,
    });
    expect(items).toHaveLength(5);
    expect(pendingNotificationTotal(items)).toBe(0);
  });
});
