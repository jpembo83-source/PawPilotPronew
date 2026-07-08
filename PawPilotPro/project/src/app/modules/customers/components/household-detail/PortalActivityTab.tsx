import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../../../components/ui/card';
import { Button } from '../../../../components/ui/button';
import { Badge } from '../../../../components/ui/badge';
import {
  Mail, Copy, ShieldOff, CheckCircle2, Clock, Send, RefreshCw, KeyRound, PauseCircle, PlayCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { useConfirmDialog } from '../../../../hooks/useConfirmDialog';
import { getAuthHeaders } from '../../../../../utils/supabase/authHeaders';
import { projectId } from '../../../../../../utils/supabase/info';
import {
  PORTAL_ADMIN_BASE,
  callPortalAdmin,
  sendPortalInviteRequest,
  notifyPortalActionResult,
} from '../../portalAdmin';

interface PortalActivityTabProps {
  householdId: string;
}

interface PortalLink {
  authUserId: string;
  // The actual KV record uses `householdId` (see portal_routes.tsx
  // accept-invite + portal_users:{tenantId}:{householdId}). Older code on
  // both sides typed this as customerId; rename keeps the TypeScript view
  // honest about what's on the wire.
  householdId: string;
  tenantId: string;
  createdAt: string;
}

interface PortalInvite {
  token: string;
  householdId: string;
  expiresAt: string;
  createdAt: string;
  email?: string;
  contactName?: string;
}

/** One linked login — a household can have several (one per invited contact). */
interface PortalUserInfo {
  id: string;
  email: string | null;
  lastSignInAt: string | null;
  suspended: boolean;
}

interface HouseholdContact {
  id: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  is_primary?: boolean;
}

interface ActivityData {
  link: PortalLink | null;
  pendingInvites: PortalInvite[];
  lastSignInAt?: string | null;
  suspended?: boolean;
  users?: PortalUserInfo[];
}

// Public URL the owner-facing portal is served at. In prod (Netlify) this
// must be set via VITE_PORTAL_PUBLIC_URL; the localhost fallback is dev-only.
// Previous version hardcoded the localhost URL and shipped — meaning staff
// who clicked "Copy link" in prod handed the owner a dead link.
const PORTAL_BASE_URL = (
  (import.meta.env.VITE_PORTAL_PUBLIC_URL as string | undefined)?.replace(/\/+$/, '') ??
  'http://localhost:5175'
);
const CUSTOMERS_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-fc003b23/customers`;

export function PortalActivityTab({ householdId }: PortalActivityTabProps) {
  const [data, setData] = useState<ActivityData | null>(null);
  const [contacts, setContacts] = useState<HouseholdContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const { confirm, confirmDialog } = useConfirmDialog();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const headers = await getAuthHeaders();
      const [activityRes, householdRes] = await Promise.all([
        fetch(`${PORTAL_ADMIN_BASE}/customers/${householdId}/portal-activity`, { headers }),
        fetch(`${CUSTOMERS_BASE}/households/${householdId}`, { headers }),
      ]);
      if (activityRes.ok) setData(await activityRes.json());
      else setData({ link: null, pendingInvites: [] });
      if (householdRes.ok) {
        const household = (await householdRes.json()) as { contacts?: HouseholdContact[] };
        setContacts(Array.isArray(household.contacts) ? household.contacts : []);
      }
    } catch {
      setData({ link: null, pendingInvites: [] });
    } finally {
      setLoading(false);
    }
  }, [householdId]);

  useEffect(() => { load(); }, [load]);

  const runAction = useCallback(
    async (id: string, fn: () => Promise<any>, successMsg: string) => {
      setBusyAction(id);
      try {
        const body = await fn();
        await notifyPortalActionResult(body, successMsg);
        await load();
      } catch (e: any) {
        toast.error(e?.message ?? 'Action failed');
      } finally {
        setBusyAction(null);
      }
    },
    [load],
  );

  // No contactId → the primary contact (original flow). With contactId →
  // that specific contact gets their own portal login for this household.
  const sendInvite = (contactId?: string) => runAction(
    contactId ? `send-invite-${contactId}` : 'send-invite',
    () => sendPortalInviteRequest(householdId, contactId),
    'Invite email sent',
  );

  const resendInvite = () => runAction(
    'resend-invite',
    () => callPortalAdmin(`/customers/${householdId}/portal-invite/resend`, { method: 'POST' }),
    'Invite re-sent',
  );

  const resetPassword = async () => {
    const confirmed = await confirm({
      title: 'Send password reset email?',
      description: "A password reset email will be sent to this household's portal account.",
      confirmLabel: 'Send email',
    });
    if (!confirmed) return;
    return runAction(
      'reset-password',
      () => callPortalAdmin(`/customers/${householdId}/portal-reset-password`, { method: 'POST' }),
      'Password reset email sent',
    );
  };

  const pause = async () => {
    const confirmed = await confirm({
      title: "Pause this household's portal access?",
      description: "They won't be able to sign in until you resume.",
      confirmLabel: 'Pause access',
    });
    if (!confirmed) return;
    return runAction(
      'pause',
      () => callPortalAdmin(`/customers/${householdId}/portal-pause`, { method: 'POST' }),
      'Portal access paused',
    );
  };

  const resume = () => runAction(
    'resume',
    () => callPortalAdmin(`/customers/${householdId}/portal-resume`, { method: 'POST' }),
    'Portal access resumed',
  );

  const revoke = async () => {
    const confirmed = await confirm({
      title: "Revoke this household's portal access?",
      description: "They'll need a new invite to get back in. Pause is usually the gentler option.",
      confirmLabel: 'Revoke access',
      destructive: true,
    });
    if (!confirmed) return;
    return runAction(
      'revoke',
      () => callPortalAdmin(`/customers/${householdId}/portal-revoke`, { method: 'POST' }),
      'Portal access revoked',
    );
  };

  const copyAcceptUrl = async (token: string) => {
    const url = `${PORTAL_BASE_URL}/accept-invite?token=${token}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success('Accept link copied to clipboard');
    } catch {
      toast.error('Could not copy link');
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">Loading portal activity…</CardContent>
      </Card>
    );
  }

  const hasLink = !!data?.link;
  const pending = data?.pendingInvites ?? [];
  const suspended = !!data?.suspended;
  const lastSignInAt = data?.lastSignInAt ?? null;
  const users = data?.users ?? [];
  const linkedEmails = new Set(users.map((u) => (u.email ?? '').toLowerCase()).filter(Boolean));
  const pendingEmails = new Set(pending.map((i) => (i.email ?? '').toLowerCase()).filter(Boolean));
  // Contacts who could get their own portal login: have an email that isn't
  // already linked and doesn't have an invite in flight.
  const invitableContacts = contacts.filter(
    (ct) => ct.email && !linkedEmails.has(ct.email.toLowerCase()) && !pendingEmails.has(ct.email.toLowerCase()),
  );

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5 text-primary" />
                Portal account
              </CardTitle>
              <CardDescription>
                Let this household self-serve booking requests, vaccination uploads, and pet profile views.
              </CardDescription>
            </div>
            {hasLink ? (
              suspended ? (
                <Badge variant="outline" className="border-amber-400 text-amber-700">
                  <PauseCircle className="h-3 w-3 mr-1" />
                  Paused
                </Badge>
              ) : (
                <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  Active
                </Badge>
              )
            ) : (
              <Badge variant="outline">Not active</Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {hasLink && data?.link ? (
            <>
              <dl className="text-sm space-y-1.5">
                <div className="flex items-center justify-between">
                  <dt className="text-muted-foreground">Linked since</dt>
                  <dd className="font-medium">{new Date(data.link.createdAt).toLocaleString()}</dd>
                </div>
                {users.length === 0 && (
                  <div className="flex items-center justify-between">
                    <dt className="text-muted-foreground">Last sign-in</dt>
                    <dd className="font-medium">
                      {lastSignInAt ? new Date(lastSignInAt).toLocaleString() : 'Never signed in'}
                    </dd>
                  </div>
                )}
              </dl>

              {/* Every login on this household — one per invited contact */}
              {users.length > 0 && (
                <ul className="space-y-2">
                  {users.map((u) => (
                    <li key={u.id} className="flex items-center justify-between gap-3 p-3 rounded-md border bg-muted/30">
                      <div className="text-sm min-w-0">
                        <p className="font-medium truncate">{u.email ?? `${u.id.slice(0, 8)}…`}</p>
                        <p className="text-sm text-muted-foreground">
                          {u.lastSignInAt
                            ? `Last sign-in ${new Date(u.lastSignInAt).toLocaleString()}`
                            : 'Never signed in'}
                        </p>
                      </div>
                      {u.suspended && (
                        <Badge variant="outline" className="border-amber-400 text-amber-700 shrink-0">
                          Paused
                        </Badge>
                      )}
                    </li>
                  ))}
                </ul>
              )}

              {/* Additional logins for other contacts with an email */}
              {invitableContacts.length > 0 && (
                <div className="pt-2 border-t space-y-2">
                  <p className="text-sm text-muted-foreground">
                    Other contacts in this household can have their own login:
                  </p>
                  {invitableContacts.map((ct) => (
                    <div key={ct.id} className="flex items-center justify-between gap-3">
                      <div className="text-sm min-w-0">
                        <p className="font-medium truncate">
                          {`${ct.first_name ?? ''} ${ct.last_name ?? ''}`.trim() || ct.email}
                        </p>
                        <p className="text-sm text-muted-foreground truncate">{ct.email}</p>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={!!busyAction}
                        onClick={() => void sendInvite(ct.id)}
                      >
                        <Send className="h-3.5 w-3.5 mr-1.5" />
                        {busyAction === `send-invite-${ct.id}` ? 'Sending…' : 'Send invite'}
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              {/* Everyday actions */}
              <div className="grid grid-cols-2 gap-2 pt-2">
                {suspended ? (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!!busyAction}
                    onClick={resume}
                    className="border-primary/30 text-primary hover:bg-primary/5"
                  >
                    <PlayCircle className="h-4 w-4 mr-2" />
                    {busyAction === 'resume' ? 'Resuming…' : 'Resume access'}
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!!busyAction}
                    onClick={pause}
                  >
                    <PauseCircle className="h-4 w-4 mr-2" />
                    {busyAction === 'pause' ? 'Pausing…' : 'Pause access'}
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!!busyAction}
                  onClick={resetPassword}
                >
                  <KeyRound className="h-4 w-4 mr-2" />
                  {busyAction === 'reset-password' ? 'Sending…' : 'Reset password'}
                </Button>
              </div>

              {/* Destructive — small, off to the side */}
              <div className="pt-2 border-t">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!!busyAction}
                  onClick={revoke}
                  className="border-destructive/30 text-destructive hover:bg-destructive/5"
                >
                  <ShieldOff className="h-4 w-4 mr-2" />
                  {busyAction === 'revoke' ? 'Revoking…' : 'Revoke access'}
                </Button>
                <p className="text-xs text-muted-foreground mt-1.5">
                  Revoking removes their portal access entirely. Pause is usually what you want.
                </p>
              </div>
            </>
          ) : (
            <Button onClick={() => void sendInvite()} disabled={!!busyAction}>
              <Send className="h-4 w-4 mr-2" />
              {busyAction === 'send-invite' ? 'Sending…' : 'Send portal invite'}
            </Button>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Clock className="h-4 w-4 text-muted-foreground" />
            Pending invites
            <Badge variant="outline" className="ml-2">{pending.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {pending.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {hasLink
                ? 'No outstanding invites. Use Reset password if the owner needs help getting back in.'
                : 'No outstanding invites.'}
            </p>
          ) : (
            <ul className="space-y-2">
              {pending.map((inv) => {
                const exp = new Date(inv.expiresAt);
                const hoursLeft = Math.max(0, Math.round((exp.getTime() - Date.now()) / 3_600_000));
                return (
                  <li key={inv.token} className="flex items-center justify-between gap-3 p-3 rounded-md border bg-muted/30">
                    <div className="text-sm min-w-0">
                      <p className="font-medium truncate">
                        {inv.contactName || inv.email || 'Invite'} — expires in {hoursLeft}h
                      </p>
                      <p className="text-sm text-muted-foreground">Sent {new Date(inv.createdAt).toLocaleString()}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button size="sm" variant="outline" onClick={() => copyAcceptUrl(inv.token)}>
                        <Copy className="h-3.5 w-3.5 mr-1.5" />
                        Copy link
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={!!busyAction}
                        onClick={resendInvite}
                      >
                        <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                        {busyAction === 'resend-invite' ? 'Resending…' : 'Resend'}
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
      {confirmDialog}
    </div>
  );
}
