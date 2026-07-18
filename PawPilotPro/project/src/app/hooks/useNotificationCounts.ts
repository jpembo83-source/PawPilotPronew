import { useCallback, useEffect, useState } from 'react';
import { getAuthHeaders } from '../../utils/supabase/authHeaders';
import { projectId } from '../../../utils/supabase/info';
import { useInboxCounts } from './useInboxCounts';
import {
  buildNotificationItems,
  pendingNotificationTotal,
  type NotificationAccess,
  type NotificationItem,
} from '../lib/notificationItems';

const FN_ROOT = `https://${projectId}.supabase.co/functions/v1/make-server-fc003b23`;

/**
 * Counts behind the header bell: the Portal Inbox queues (via the existing
 * useInboxCounts hook, which handles its own realtime/focus refresh) plus the
 * daycare photo-review queue and unread customer messages.
 *
 * Same refresh strategy as useInboxCounts — mount, window focus, 2-minute
 * fallback — and the same best-effort stance: a failed fetch keeps the last
 * known count; the module pages are the source of truth.
 */
export function useNotificationCounts(access: NotificationAccess): {
  items: NotificationItem[];
  total: number;
  /** Passthrough of the Portal Inbox counts so callers that also show the
   *  inbox nav badge (MobileLayout, Sidebar) don't need a second hook
   *  instance polling the same endpoint. */
  inbox: ReturnType<typeof useInboxCounts>;
} {
  const inbox = useInboxCounts(access.inbox);
  const [photoQueue, setPhotoQueue] = useState<number | null>(null);
  const [unreadMessages, setUnreadMessages] = useState<number | null>(null);

  const { photos: canPhotos, messages: canMessages } = access;

  const load = useCallback(async () => {
    if (!canPhotos && !canMessages) return;
    try {
      const headers = await getAuthHeaders();
      if (canPhotos) {
        const res = await fetch(`${FN_ROOT}/pet-updates/review-queue/count`, { headers });
        if (res.ok) setPhotoQueue(((await res.json()) as { count: number }).count);
      }
      if (canMessages) {
        const res = await fetch(`${FN_ROOT}/messaging/stats`, { headers });
        if (res.ok) setUnreadMessages(((await res.json()) as { unread: number }).unread);
      }
    } catch {
      // Best-effort badge — keep the last known counts.
    }
  }, [canPhotos, canMessages]);

  useEffect(() => {
    if (!canPhotos) setPhotoQueue(null);
    if (!canMessages) setUnreadMessages(null);
    if (!canPhotos && !canMessages) return;
    void load();
    const refresh = () => void load();
    window.addEventListener('focus', refresh);
    const interval = window.setInterval(refresh, 120_000);
    return () => {
      window.removeEventListener('focus', refresh);
      window.clearInterval(interval);
    };
  }, [canPhotos, canMessages, load]);

  const items = buildNotificationItems({ inbox, photoQueue, unreadMessages, access });
  return { items, total: pendingNotificationTotal(items), inbox };
}
