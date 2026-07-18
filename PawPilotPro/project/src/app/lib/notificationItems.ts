// Pure builders for the staff notification bell. The bell is a work-queue
// aggregator (Phase 1): every row is an existing pending-work queue with a
// count and a deep link into the module that clears it. No read-state of its
// own — counts are self-clearing as the queues are worked.

import type { InboxCounts } from '../hooks/useInboxCounts';

export interface NotificationItem {
  key: 'booking_requests' | 'pet_verifications' | 'vax_reviews' | 'photo_review' | 'messages';
  label: string;
  count: number;
  /** Route that clears this queue. */
  to: string;
}

/** Which sources this user may see — mirrors the RBAC/beta gates that show
 *  or hide the corresponding nav entries. A source the user can't access is
 *  omitted entirely (not shown as zero). */
export interface NotificationAccess {
  /** Portal Inbox (customers module): booking requests, pet verifications, vax reviews. */
  inbox: boolean;
  /** Daycare photo review queue (admin/manager only). */
  photos: boolean;
  /** Messaging module (beta-gated). */
  messages: boolean;
}

export function buildNotificationItems(args: {
  inbox: InboxCounts | null;
  photoQueue: number | null;
  unreadMessages: number | null;
  access: NotificationAccess;
}): NotificationItem[] {
  const items: NotificationItem[] = [];
  if (args.access.inbox && args.inbox) {
    items.push(
      {
        key: 'booking_requests',
        label: 'Booking requests',
        count: args.inbox.pendingRequests,
        to: '/customers/pending-requests?tab=bookings',
      },
      {
        key: 'pet_verifications',
        label: 'New pets to verify',
        count: args.inbox.petVerifications,
        to: '/customers/pending-requests?tab=pets',
      },
      {
        key: 'vax_reviews',
        label: 'Vaccinations to review',
        count: args.inbox.vaxQueue,
        to: '/customers/pending-requests?tab=vaccinations',
      },
    );
  }
  if (args.access.photos && args.photoQueue !== null) {
    items.push({
      key: 'photo_review',
      label: 'Photos awaiting review',
      count: args.photoQueue,
      to: '/daycare/photo-review',
    });
  }
  if (args.access.messages && args.unreadMessages !== null) {
    items.push({
      key: 'messages',
      label: 'Unread messages',
      count: args.unreadMessages,
      to: '/messages',
    });
  }
  return items;
}

/** Badge total: everything pending across the queues the user can see. */
export function pendingNotificationTotal(items: NotificationItem[]): number {
  return items.reduce((sum, item) => sum + item.count, 0);
}
