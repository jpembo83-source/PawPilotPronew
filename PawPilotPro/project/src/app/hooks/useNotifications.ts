import { useCallback, useEffect, useState } from 'react';
import { getAuthHeaders } from '../../utils/supabase/authHeaders';
import { projectId } from '../../../utils/supabase/info';

const FN_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-fc003b23/notifications`;

export interface StaffNotification {
  id: string;
  type: 'booking_request' | 'vaccination' | 'incident' | 'message';
  title: string;
  body: string;
  created_at: string;
  href: string;
}

interface NotificationsResponse {
  items: StaffNotification[];
  unread_count: number;
  last_seen_at: string | null;
}

/**
 * Staff notifications for the header bell. The feed is server-derived from
 * live data (pending portal requests, vax review queue, open incidents,
 * unread messages), so it needs no local bookkeeping beyond the unread count.
 *
 * Refresh strategy mirrors useInboxCounts: on mount, on window focus, and a
 * 2-minute fallback interval. Best-effort — failures leave the last state.
 */
export function useNotifications() {
  const [items, setItems] = useState<StaffNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  const load = useCallback(async () => {
    try {
      setIsLoading(true);
      const headers = await getAuthHeaders();
      const res = await fetch(FN_BASE, { headers });
      if (res.ok) {
        const data = (await res.json()) as NotificationsResponse;
        setItems(data.items);
        setUnreadCount(data.unread_count);
      }
    } catch {
      // Bell is best-effort — the linked pages are the source of truth.
    } finally {
      setIsLoading(false);
    }
  }, []);

  const markRead = useCallback(async () => {
    setUnreadCount(0); // optimistic — the dot clears the moment the panel opens
    try {
      const headers = await getAuthHeaders();
      await fetch(`${FN_BASE}/mark-read`, { method: 'POST', headers });
    } catch {
      // Non-fatal: the next load recomputes unread from the server.
    }
  }, []);

  useEffect(() => {
    void load();
    const refresh = () => void load();
    window.addEventListener('focus', refresh);
    const interval = window.setInterval(refresh, 2 * 60 * 1000);
    return () => {
      window.removeEventListener('focus', refresh);
      window.clearInterval(interval);
    };
  }, [load]);

  return { items, unreadCount, isLoading, reload: load, markRead };
}
