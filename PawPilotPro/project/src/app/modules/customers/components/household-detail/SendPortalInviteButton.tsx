import { useState } from 'react';
import { toast } from 'sonner';
import { Mail } from 'lucide-react';
import { Button } from '../../../../components/ui/button';
import { projectId, publicAnonKey } from '../../../../../../utils/supabase/info';
import { supabase } from '@/utils/supabase/client';

interface Props {
  customerId: string;
  hasPortalAccess: boolean;
  onSent?: () => void;
}

export function SendPortalInviteButton({ customerId, hasPortalAccess, onSent }: Props) {
  const [busy, setBusy] = useState(false);

  if (hasPortalAccess) {
    return <span className="text-xs text-muted-foreground">Portal active</span>;
  }

  const handleClick = async () => {
    setBusy(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const url = `https://${projectId}.supabase.co/functions/v1/make-server-fc003b23/portal-admin/customers/${customerId}/portal-invite`;
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${publicAnonKey}`,
          'X-User-Token': `Bearer ${session?.access_token ?? ''}`,
          'Content-Type': 'application/json',
        },
      });
      const body = await res.json().catch(() => ({} as any));
      if (!res.ok) {
        throw new Error(body?.error ?? `HTTP ${res.status}`);
      }
      if (body.emailWarning) {
        toast.warning(body.emailWarning);
      } else {
        toast.success('Invite sent');
      }
      onSent?.();
    } catch (e: any) {
      toast.error(e?.message ?? 'Failed to send invite');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={busy}
      onClick={handleClick}
    >
      <Mail className="h-4 w-4 mr-2" />
      {busy ? 'Sending…' : 'Send portal invite'}
    </Button>
  );
}
