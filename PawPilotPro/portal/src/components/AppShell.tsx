import { Outlet, useLocation } from "react-router-dom";
import { BottomTabBar } from "./BottomTabBar";
import { OfflineBanner } from "./OfflineBanner";

// Routes that take over the full screen — the tab bar hides for these focused flows.
const FULLSCREEN_PREFIXES = ["/book"];

export function AppShell() {
  const { pathname } = useLocation();
  const fullscreen = FULLSCREEN_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"));

  return (
    <div
      className="min-h-dvh w-full"
      style={{
        paddingTop: "var(--safe-top)",
        // When the tab bar is present, reserve room for it AND the home-indicator
        // safe area. Without this the last 80-ish px of any screen sits under
        // the bar. When in a fullscreen flow (booking wizard) we skip the offset
        // entirely so the wizard can paint edge-to-edge.
        paddingBottom: fullscreen ? undefined : "calc(var(--tab-bar-height) + var(--safe-bottom))",
      }}
    >
      <OfflineBanner />
      <Outlet />
      {!fullscreen && <BottomTabBar />}
    </div>
  );
}
