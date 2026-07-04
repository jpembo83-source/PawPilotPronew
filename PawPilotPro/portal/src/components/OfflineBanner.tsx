import { WifiOff } from "lucide-react";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";

/**
 * Persistent connectivity banner (design spec §11). Sticky just below the
 * safe-area top inset so it stays visible on every screen, including
 * mid-scroll and inside the fullscreen booking flow. Informative, not
 * alarming — warm muted palette, no red: losing signal in a car park is
 * ordinary, and the app recovers on its own.
 */
export function OfflineBanner() {
  const online = useOnlineStatus();
  if (online) return null;

  return (
    <div
      role="status"
      className="animate-banner-settle sticky z-40 flex items-center justify-center gap-2 px-4 py-2.5 bg-muted text-foreground border-b border-border text-[13px] font-medium"
      style={{ top: "var(--safe-top)" }}
    >
      <WifiOff size={14} strokeWidth={2} className="shrink-0 text-muted-foreground" aria-hidden="true" />
      You're offline. We'll reconnect automatically.
    </div>
  );
}
