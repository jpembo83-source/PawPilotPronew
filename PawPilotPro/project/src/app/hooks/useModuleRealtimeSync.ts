import { useCallback } from 'react';
import { useRealtimeSync } from './useRealtimeSync';
import { notifyRealtimeUpdate } from '../components/ConflictNotification';
import type { RealtimeModule, RealtimeEvent } from '../lib/realtime';

export function useModuleRealtimeSync(
  module: RealtimeModule,
  refetchFn: () => void | Promise<void>,
  enabled = true,
  allowedLocationIds?: string[]
) {
  const handleEvent = useCallback(
    (event: RealtimeEvent) => {
      if (
        allowedLocationIds &&
        allowedLocationIds.length > 0 &&
        event.locationId &&
        !allowedLocationIds.includes(event.locationId)
      ) {
        return;
      }

      notifyRealtimeUpdate(event);
      refetchFn();
    },
    [refetchFn, allowedLocationIds]
  );

  useRealtimeSync(module, handleEvent, enabled);
}
