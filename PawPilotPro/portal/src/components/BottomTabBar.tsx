import { NavLink } from "react-router-dom";
import { Home, Calendar, PawPrint, User } from "lucide-react";

const TABS = [
  { to: "/", label: "Home", Icon: Home, end: true },
  { to: "/bookings", label: "Bookings", Icon: Calendar, end: false },
  { to: "/pets", label: "Pets", Icon: PawPrint, end: false },
  { to: "/account", label: "Account", Icon: User, end: false },
] as const;

export function BottomTabBar() {
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 bg-white/95 backdrop-blur border-t border-neutral-200 dark:bg-neutral-950/95 dark:border-neutral-800"
      style={{ paddingBottom: "var(--safe-bottom)" }}
    >
      <ul className="grid grid-cols-4 max-w-md mx-auto">
        {TABS.map(({ to, label, Icon, end }) => (
          <li key={to} className="flex">
            <NavLink
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex-1 flex flex-col items-center justify-center gap-1 py-2 text-[11px] min-h-[56px] transition-colors ${
                  isActive
                    ? "text-blue-600 dark:text-blue-400 font-semibold"
                    : "text-neutral-500 dark:text-neutral-400"
                }`
              }
            >
              <Icon size={20} aria-hidden="true" />
              <span>{label}</span>
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
