import { useEffect, useRef } from 'react';
import { realtimeManager, type RealtimeModule, type RealtimeEvent } from '../lib/realtime';

export function useRealtimeSync(
  module: RealtimeModule,
  onEvent: (event: RealtimeEvent) => void,
  enabled = true
) {
  const callbackRef = useRef(onEvent);
  callbackRef.current = onEvent;

  useEffect(() => {
    if (!enabled) return;

    const unsub = realtimeManager.subscribe(module, (event) => {
      callbackRef.current(event);
    });

    return unsub;
  }, [module, enabled]);
}
