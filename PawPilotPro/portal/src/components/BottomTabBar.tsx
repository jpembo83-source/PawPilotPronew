import { NavLink } from "react-router-dom";
import { Home, Calendar, PawPrint, User } from "lucide-react";

const TABS = [
  { to: "/", label: "Home", Icon: Home, end: true },
  { to: "/bookings", label: "Bookings", Icon: Calendar, end: false },
  { to: "/pets", label: "Pets", Icon: PawPrint, end: false },
  { to: "/account", label: "Account", Icon: User, end: false },
] as const;

/**
 * Floating glassy pill bottom nav. Sits above the safe area with a soft
 * shadow lift, blurred translucent surface, and an active-pill backdrop on
 * the selected tab. Editorial micro-typography on the labels.
 */
export function BottomTabBar() {
  return (
    <nav
      className="fixed inset-x-0 z-40"
      style={{ bottom: "calc(0.4rem + var(--safe-bottom))" }}
      aria-label="Primary"
    >
      <ul
        className="mx-auto max-w-[22rem] grid grid-cols-4 rounded-[2rem] backdrop-blur-xl bg-card/80 border border-border/60 px-1.5 py-1.5"
        style={{ boxShadow: "var(--shadow-md)" }}
      >
        {TABS.map(({ to, label, Icon, end }) => (
          <li key={to} className="flex">
            <NavLink
              to={to}
              end={end}
              className={({ isActive }) =>
                `press relative flex-1 flex flex-col items-center justify-center gap-0.5 py-2 min-h-[52px] rounded-[1.6rem] transition-all duration-200 ${
                  isActive ? "text-secondary-foreground bg-secondary" : "text-muted-foreground/85 hover:text-foreground"
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <Icon
                    size={19}
                    strokeWidth={isActive ? 2.4 : 1.9}
                    className="transition-transform duration-200"
                    style={{ transform: isActive ? "translateY(-1px)" : "none" }}
                  />
                  <span className={`text-[10px] tracking-[0.04em] ${isActive ? "font-semibold" : "font-medium"}`}>
                    {label}
                  </span>
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
