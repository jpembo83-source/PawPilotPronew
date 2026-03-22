import { realtimeManager, type RealtimeModule } from './realtime';
import { supabase } from '../../utils/supabase/client';

export async function broadcastMutation(
  module: RealtimeModule,
  entity: string,
  action: 'created' | 'updated' | 'deleted',
  recordId?: string,
  meta?: Record<string, unknown>
) {
  let userId = 'unknown';
  try {
    const { data: { session } } = await supabase.auth.getSession();
    userId = session?.user?.id || 'unknown';
  } catch {
    // proceed with unknown
  }

  realtimeManager.broadcast({
    module,
    entity,
    action,
    recordId,
    userId,
    meta,
  });
}
