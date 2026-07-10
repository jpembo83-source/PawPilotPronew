// Shared portal-admin API helpers — extracted from PortalActivityTab so the
// onboarding wizard's invite step and the Portal tab share one send-invite
// implementation (including the clipboard fallback when email delivery is
// skipped).

import { toast } from 'sonner';
import { getAuthHeaders } from '@/utils/supabase/authHeaders';
import { projectId } from '../../../../utils/supabase/info';

export const PORTAL_ADMIN_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-fc003b23/portal-admin`;

/** Response body shape shared by the portal-admin endpoints. */
export interface PortalAdminResponse {
  error?: string;
  emailWarning?: boolean;
  acceptUrl?: string;
  [key: string]: unknown;
}

export async function callPortalAdmin(path: string, opts: RequestInit = {}): Promise<PortalAdminResponse> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${PORTAL_ADMIN_BASE}${path}`, { ...opts, headers: { ...headers, ...(opts.headers ?? {}) } });
  const body = (await res.json().catch(() => ({}))) as PortalAdminResponse;
  if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
  return body;
}

// No contactId → the primary contact (original flow). With contactId →
// that specific contact gets their own portal login for this household.
export function sendPortalInviteRequest(householdId: string, contactId?: string) {
  return callPortalAdmin(`/customers/${householdId}/portal-invite`, {
    method: 'POST',
    ...(contactId ? { body: JSON.stringify({ contactId }) } : {}),
  });
}

// Admin responses can carry emailWarning + acceptUrl when the invite email
// couldn't be delivered; the fallback copies the accept link to the clipboard
// so staff can hand it to the owner directly.
export async function notifyPortalActionResult(body: PortalAdminResponse, successMsg: string) {
  if (body.emailWarning && body.acceptUrl) {
    try {
      await navigator.clipboard.writeText(body.acceptUrl);
    } catch {
      // Clipboard can be unavailable (permissions/non-secure context); the
      // toast below still shows the URL in its description.
    }
    toast.warning('Email delivery skipped — invite link copied to clipboard', {
      description: body.acceptUrl,
      duration: 14000,
    });
  } else {
    toast.success(successMsg);
  }
}
