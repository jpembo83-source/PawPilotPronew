import { Outlet } from "react-router-dom";
import { BottomTabBar } from "./BottomTabBar";

export function AppShell() {
  return (
    <div className="min-h-screen pb-24" style={{ paddingTop: "var(--safe-top)" }}>
      <Outlet />
      <BottomTabBar />
    </div>
  );
}
