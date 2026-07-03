import { useSyncExternalStore } from "react";

/**
 * Live navigator.onLine, per the portal design spec (§11 Network): a
 * persistent banner when offline, no service worker in v1 — the Capacitor
 * shell caches the bundle natively and React Query retries reads.
 *
 * onLine flips reliably inside the Capacitor webview when the device loses
 * signal (car parks, lifts), which is the failure mode this covers.
 */
function subscribe(onChange: () => void) {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

export function useOnlineStatus(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    () => true,
  );
}
