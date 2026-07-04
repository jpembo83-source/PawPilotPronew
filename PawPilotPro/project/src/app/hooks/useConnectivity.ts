// Connectivity detection - navigator.onLine + online/offline events + ping fallback.
//
// navigator.onLine alone is unreliable: it reports true whenever there is a
// network interface, even if the router has no internet (the yard/kennel wifi
// failure mode this exists for). So the browser events give us instant
// transitions, and a lightweight same-origin ping confirms real reachability
// on a slow interval.
import { create } from 'zustand';

interface ConnectivityState {
  isOnline: boolean;
}

export const useConnectivityStore = create<ConnectivityState>(() => ({
  isOnline: typeof navigator === 'undefined' ? true : navigator.onLine,
}));

/** Subscribe to the current online/offline state. */
export function useConnectivity(): boolean {
  return useConnectivityStore(s => s.isOnline);
}

const PING_INTERVAL_MS = 30_000;
const PING_TIMEOUT_MS = 5_000;

// A unique query string per ping guarantees the request bypasses both the
// HTTP cache and the service worker precache (workbox only ignores utm_*
// params when matching precached URLs), so a cached hit can never fake
// "online".
function pingUrl(): string {
  return `/manifest.json?connectivity-ping=${Date.now()}`;
}

async function ping(): Promise<boolean> {
  try {
    const res = await fetch(pingUrl(), {
      method: 'HEAD',
      cache: 'no-store',
      signal: AbortSignal.timeout(PING_TIMEOUT_MS),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// Monotonic token so a slow in-flight ping can't overwrite a newer, more
// authoritative signal (e.g. the 'offline' event firing while a ping is out).
let epoch = 0;

function setOnline(isOnline: boolean) {
  if (useConnectivityStore.getState().isOnline !== isOnline) {
    useConnectivityStore.setState({ isOnline });
  }
}

async function verify() {
  const myEpoch = ++epoch;
  if (!navigator.onLine) {
    setOnline(false);
    return;
  }
  const reachable = await ping();
  if (myEpoch === epoch) setOnline(reachable);
}

let started = false;

/**
 * Start listening for connectivity changes. Call once at app boot; safe to
 * call again (no-op).
 */
export function initConnectivityMonitor(): void {
  if (started || typeof window === 'undefined') return;
  started = true;

  window.addEventListener('online', () => void verify());
  window.addEventListener('offline', () => {
    epoch++;
    setOnline(false);
  });

  // Re-check when the tab becomes visible again (device woke up, staff
  // switched back to the app) and on a slow heartbeat while visible, to
  // catch "wifi connected but no internet" where onLine stays true.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void verify();
  });
  window.setInterval(() => {
    if (document.visibilityState === 'visible') void verify();
  }, PING_INTERVAL_MS);

  void verify();
}
