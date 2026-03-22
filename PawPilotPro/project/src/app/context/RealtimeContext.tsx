import React, { useEffect } from 'react';
import { useAuth } from './AuthContext';
import { realtimeManager } from '../lib/realtime';
import { supabase } from '../../utils/supabase/client';

export function RealtimeProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) {
      realtimeManager.disconnect();
      return;
    }

    const getTenantId = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const tenantId =
        session?.user?.user_metadata?.tenant_id ||
        session?.user?.user_metadata?.tenantId ||
        'default';
      realtimeManager.init(tenantId);
    };

    getTenantId();

    return () => {
      realtimeManager.disconnect();
    };
  }, [user?.id]);

  return <>{children}</>;
}
