import { useEffect, useState } from 'react';
import { getAuthHeaders } from '../../../../utils/supabase/authHeaders';
import { projectId } from '../../../../../utils/supabase/info';
import {
  derivePortalStatus,
  portalStatusPresentation,
  type PortalActivitySnapshot,
  type PortalStatus,
  type PortalStatusTone,
} from '../portalStatus';

const PORTAL_ADMIN_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-fc003b23/portal-admin`;

/**
 * Portal status for the household header. Returns null while loading or if
 * the endpoint fails/denies — callers render nothing rather than a guess.
 */
export function usePortalStatus(householdId: string | undefined): PortalStatus | null {
  const [status, setStatus] = useState<PortalStatus | null>(null);

  useEffect(() => {
    if (!householdId) return;
    let cancelled = false;
    setStatus(null);

    void (async () => {
      try {
        const headers = await getAuthHeaders();
        const res = await fetch(`${PORTAL_ADMIN_BASE}/customers/${householdId}/portal-activity`, { headers });
        if (!res.ok) return;
        const data = (await res.json()) as PortalActivitySnapshot;
        if (!cancelled) setStatus(derivePortalStatus(data));
      } catch {
        // leave null — no chip beats a wrong chip
      }
    })();

    return () => { cancelled = true; };
  }, [householdId]);

  return status;
}

const TONE_CLASSES: Record<PortalStatusTone, string> = {
  positive: 'bg-green-100 text-green-800 border-green-200',
  warning: 'bg-amber-100 text-amber-800 border-amber-300',
  critical: 'bg-red-100 text-red-800 border-red-300',
  neutral: 'bg-slate-100 text-slate-600 border-slate-200',
};

interface PortalStatusChipProps {
  status: PortalStatus;
  /** Opens the Portal tab. Navigation-only by design: resend (with its
      confirm/email-fallback logic) stays in PortalActivityTab. */
  onClick: () => void;
}

export function PortalStatusChip({ status, onClick }: PortalStatusChipProps) {
  const { label, tone } = portalStatusPresentation(status);

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Portal status: ${label}. Open Portal tab`}
      title="Open Portal tab"
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-sm font-medium border whitespace-nowrap transition-opacity hover:opacity-80 ${TONE_CLASSES[tone]}`}
    >
      {label}
    </button>
  );
}
