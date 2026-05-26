import { useEffect, useState, useCallback } from 'react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../../../components/ui/card';
import { Button } from '../../../../components/ui/button';
import { Badge } from '../../../../components/ui/badge';
import { Shield, AlertCircle, Clock, UserX } from 'lucide-react';
import { projectId, publicAnonKey } from '../../../../../../utils/supabase/info';
import { supabase } from '@/utils/supabase/client';

interface ActivityData {
  link: {
    authUserId: string;
    customerId: string;
    tenantId: string;
    createdAt: string;
  } | null;
  pendingInvites: Array<{
    token: string;
    customerId: string;
    expiresAt: string;
    createdAt: string;
  }>;
}

interface Props {
  customerId: string;
}

export function PortalActivityTab({ customerId }: Props) {
  const [data, setData] = useState<ActivityData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const url = `https://${projectId}.supabase.co/functions/v1/make-server-fc003b23/portal-admin/customers/${customerId}/portal-activity`;
      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${publicAnonKey}`,
          'X-User-Token': `Bearer ${session?.access_token ?? ''}`,
        },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({} as any));
        throw new Error(body?.error ?? `HTTP ${res.status}`);
      }
      setData(await res.json());
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load portal activity');
    } finally {
      setLoading(false);
    }
  }, [customerId]);

  useEffect(() => {
    load();
  }, [load]);

  const revoke = async () => {
    if (!confirm("Revoke this household's portal access? They will no longer be able to sign in.")) return;
    setBusy(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const url = `https://${projectId}.supabase.co/functions/v1/make-server-fc003b23/portal-admin/customers/${customerId}/portal-revoke`;
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${publicAnonKey}`,
          'X-User-Token': `Bearer ${session?.access_token ?? ''}`,
        },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({} as any));
        throw new Error(body?.error ?? `HTTP ${res.status}`);
      }
      toast.success('Portal access revoked');
      load();
    } catch (e: any) {
      toast.error(e?.message ?? 'Failed to revoke access');
    } finally {
      setBusy(false);
    }
  };

  if (loading && !data) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-slate-500 text-sm">
          Loading portal activity…
        </CardContent>
      </Card>
    );
  }

  if (error && !data) {
    return (
      <Card className="border-amber-200 bg-amber-50">
        <CardContent className="py-12 text-center">
          <AlertCircle className="h-12 w-12 text-amber-600 mx-auto mb-4" />
          <h3 className="font-semibold text-amber-900 mb-2">Couldn't load portal activity</h3>
          <p className="text-amber-700 text-sm">{error}</p>
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Portal Account
          </CardTitle>
          <CardDescription>
            Customer-facing portal login for this household
          </CardDescription>
        </CardHeader>
        <CardContent>
          {data.link ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Badge variant="default">Active</Badge>
                <span className="text-sm text-slate-600">
                  Linked since {new Date(data.link.createdAt).toLocaleString()}
                </span>
              </div>
              <div className="text-sm">
                <span className="text-slate-600">Auth user ID: </span>
                <code className="text-xs bg-slate-100 px-2 py-1 rounded">
                  {data.link.authUserId}
                </code>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={busy}
                onClick={revoke}
                className="border-red-300 text-red-700 hover:bg-red-50 hover:text-red-700"
              >
                <UserX className="h-4 w-4 mr-2" />
                {busy ? 'Revoking…' : 'Revoke access'}
              </Button>
            </div>
          ) : (
            <p className="text-sm text-slate-500">No portal account on file for this household.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Pending Invites ({data.pendingInvites.length})
          </CardTitle>
          <CardDescription>
            Invites that have been sent but not yet accepted
          </CardDescription>
        </CardHeader>
        <CardContent>
          {data.pendingInvites.length === 0 ? (
            <p className="text-sm text-slate-500">No pending invites.</p>
          ) : (
            <ul className="space-y-2">
              {data.pendingInvites.map((invite) => {
                const expires = new Date(invite.expiresAt);
                const expired = expires.getTime() < Date.now();
                return (
                  <li
                    key={invite.token}
                    className="border border-slate-200 rounded-md p-3 flex items-center justify-between"
                  >
                    <div className="text-sm">
                      <p className="text-slate-700">
                        Sent {new Date(invite.createdAt).toLocaleString()}
                      </p>
                      <p className={`text-xs mt-1 ${expired ? 'text-red-600' : 'text-slate-500'}`}>
                        {expired ? 'Expired' : 'Expires'} {expires.toLocaleString()}
                      </p>
                    </div>
                    <Badge variant={expired ? 'destructive' : 'secondary'}>
                      {expired ? 'Expired' : 'Pending'}
                    </Badge>
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
