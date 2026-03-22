import { useEffect, useRef } from 'react';
import { realtimeManager, type RealtimeModule, type RealtimeEvent } from '../lib/realtime';
import { useDashboardStore } from '../modules/dashboard/store';
import { notifyRealtimeUpdate } from '../components/ConflictNotification';

const OPERATIONAL_MODULES: RealtimeModule[] = [
  'daycare',
  'grooming',
  'transport',
  'overnights',
  'customers',
  'staff',
  'billing',
];

export function useRealtimeDashboard(enabled = true) {
  const refreshAllWidgets = useDashboardStore((s) => s.refreshAllWidgets);
  const unsubsRef = useRef<Array<() => void>>([]);

  useEffect(() => {
    if (!enabled) return;

    const handleEvent = (event: RealtimeEvent) => {
      notifyRealtimeUpdate(event);
      refreshAllWidgets();
    };

    unsubsRef.current = OPERATIONAL_MODULES.map((mod) =>
      realtimeManager.subscribe(mod, handleEvent)
    );

    return () => {
      unsubsRef.current.forEach((unsub) => unsub());
      unsubsRef.current = [];
    };
  }, [enabled, refreshAllWidgets]);
}
