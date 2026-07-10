import { useCallback, useEffect, useState } from 'react';
import { getAuthHeaders } from '../../utils/supabase/authHeaders';
import { projectId } from '../../../utils/supabase/info';
import { useRealtimeSync } from './useRealtimeSync';

const FN_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-fc003b23/portal-admin`;

/**
 * Same-tab refresh signal. Realtime broadcasts don't echo back to the client
 * that sent them (self: false + clientId filter), so the tab that approves or
 * rejects an inbox item would otherwise keep its stale badge until the next
 * focus event or the 2-minute fallback. Inbox actions dispatch this event;
 * every mounted badge (sidebar or mobile) refetches immediately.
 */
const INBOX_COUNTS_CHANGED_EVENT = 'pawpilot:inbox-counts-changed';

export function notifyInboxCountsChanged(): void {
  window.dispatchEvent(new Event(INBOX_COUNTS_CHANGED_EVENT));
}

/** Response of GET /portal-admin/inbox-counts. */
export interface InboxCounts {
  pendingRequests: number;
  petVerifications: number;
  vaxQueue: number;
  total: number;
}

/**
 * Pending-work counts for the Portal Inbox nav badge (desktop sidebar +
 * mobile drawer/More tab). Pass `enabled=false` when the user can't access
 * the customers module — the badge then never fetches, mirroring the RBAC
 * gate that hides the nav entry itself.
 *
 * Refresh strategy: on mount, on customers-module realtime events (inbox
 * approve/reject broadcasts), on window focus, and a 2-minute fallback
 * interval so the count stays honest even without realtime. The endpoint is
 * deliberately cheap (counts only, no enrichment/signed URLs).
 */
export function useInboxCounts(enabled: boolean): InboxCounts | null {
  const [counts, setCounts] = useState<InboxCounts | null>(null);

  const load = useCallback(async () => {
    if (!enabled) return;
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${FN_BASE}/inbox-counts`, { headers });
      if (res.ok) setCounts((await res.json()) as InboxCounts);
    } catch {
      // Badge is best-effort — the inbox page itself is the source of truth.
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) {
      setCounts(null);
      return;
    }
    void load();
    const refresh = () => void load();
    window.addEventListener('focus', refresh);
    window.addEventListener(INBOX_COUNTS_CHANGED_EVENT, refresh);
    const interval = window.setInterval(refresh, 120_000);
    return () => {
      window.removeEventListener('focus', refresh);
      window.removeEventListener(INBOX_COUNTS_CHANGED_EVENT, refresh);
      window.clearInterval(interval);
    };
  }, [enabled, load]);

  useRealtimeSync('customers', () => void load(), enabled);

  return counts;
}

/** Display form for count badges — keeps wide numbers from breaking layout. */
export function formatBadgeCount(n: number): string {
  return n > 99 ? '99+' : String(n);
}
