import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../../../components/ui/card';
import { Button } from '../../../../components/ui/button';
import { Badge } from '../../../../components/ui/badge';
import {
  Mail, Copy, ShieldOff, CheckCircle2, Clock, Send, RefreshCw, KeyRound, PauseCircle, PlayCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../../../../../utils/supabase/client';
import { projectId, publicAnonKey } from '../../../../../../utils/supabase/info';

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
}

interface ActivityData {
  link: PortalLink | null;
  pendingInvites: PortalInvite[];
  lastSignInAt?: string | null;
  suspended?: boolean;
}

// Public URL the owner-facing portal is served at. In prod (Netlify) this
// must be set via VITE_PORTAL_PUBLIC_URL; the localhost fallback is dev-only.
// Previous version hardcoded the localhost URL and shipped — meaning staff
// who clicked "Copy link" in prod handed the owner a dead link.
const PORTAL_BASE_URL = (
  (import.meta.env.VITE_PORTAL_PUBLIC_URL as string | undefined)?.replace(/\/+$/, '') ??
  'http://localhost:5175'
);
const FN_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-fc003b23/portal-admin`;

async function authHeaders() {
  const { data: { session } } = await supabase.auth.getSession();
  return {
    Authorization: `Bearer ${publicAnonKey}`,
    'X-User-Token': `Bearer ${session?.access_token ?? ''}`,
    'Content-Type': 'application/json',
  };
}

async function callAdmin(path: string, opts: RequestInit = {}) {
  const headers = await authHeaders();
  const res = await fetch(`${FN_BASE}${path}`, { ...opts, headers: { ...headers, ...(opts.headers ?? {}) } });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body?.error ?? `HTTP ${res.status}`);
  return body;
}

export function PortalActivityTab({ householdId }: PortalActivityTabProps) {
  const [data, setData] = useState<ActivityData | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyAction, setBusyAction] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const headers = await authHeaders();
      const res = await fetch(`${FN_BASE}/customers/${householdId}/portal-activity`, { headers });
      if (res.ok) setData(await res.json());
      else setData({ link: null, pendingInvites: [] });
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
        if (body?.emailWarning && body?.acceptUrl) {
          try { await navigator.clipboard.writeText(body.acceptUrl); } catch {}
          toast.warning('Email delivery skipped — invite link copied to clipboard', {
            description: body.acceptUrl,
            duration: 14000,
          });
        } else {
          toast.success(successMsg);
        }
        await load();
      } catch (e: any) {
        toast.error(e?.message ?? 'Action failed');
      } finally {
        setBusyAction(null);
      }
    },
    [load],
  );

  const sendInvite = () => runAction(
    'send-invite',
    () => callAdmin(`/customers/${householdId}/portal-invite`, { method: 'POST' }),
    'Invite email sent',
  );

  const resendInvite = () => runAction(
    'resend-invite',
    () => callAdmin(`/customers/${householdId}/portal-invite/resend`, { method: 'POST' }),
    'Invite re-sent',
  );

  const resetPassword = () => {
    if (!confirm("Send a password reset email to this household's portal account?")) return;
    return runAction(
      'reset-password',
      () => callAdmin(`/customers/${householdId}/portal-reset-password`, { method: 'POST' }),
      'Password reset email sent',
    );
  };

  const pause = () => {
    if (!confirm("Pause this household's portal access? They won't be able to sign in until you resume.")) return;
    return runAction(
      'pause',
      () => callAdmin(`/customers/${householdId}/portal-pause`, { method: 'POST' }),
      'Portal access paused',
    );
  };

  const resume = () => runAction(
    'resume',
    () => callAdmin(`/customers/${householdId}/portal-resume`, { method: 'POST' }),
    'Portal access resumed',
  );

  const revoke = () => {
    if (!confirm("Revoke this household's portal access? They'll need a new invite to get back in.\n\nPause is usually the gentler option.")) return;
    return runAction(
      'revoke',
      () => callAdmin(`/customers/${householdId}/portal-revoke`, { method: 'POST' }),
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
                <div className="flex items-center justify-between">
                  <dt className="text-muted-foreground">Last sign-in</dt>
                  <dd className="font-medium">
                    {lastSignInAt ? new Date(lastSignInAt).toLocaleString() : 'Never signed in'}
                  </dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-muted-foreground">Auth user ID</dt>
                  <dd className="font-mono text-xs">{data.link.authUserId.slice(0, 8)}…</dd>
                </div>
              </dl>

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
            <Button onClick={sendInvite} disabled={!!busyAction}>
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
                    <div className="text-sm">
                      <p className="font-medium">Expires in {hoursLeft}h</p>
                      <p className="text-xs text-muted-foreground">Sent {new Date(inv.createdAt).toLocaleString()}</p>
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
    </div>
  );
}
