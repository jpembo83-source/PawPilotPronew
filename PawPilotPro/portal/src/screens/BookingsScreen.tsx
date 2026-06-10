import { useState } from "react";
import { Link } from "react-router-dom";
import { Plus, CalendarPlus, Sun, Scissors, Moon, Car, PawPrint } from "lucide-react";
import { usePortalQuery } from "@/hooks/usePortalQuery";
import { Skeleton } from "@/components/Skeleton";
import { StatusBadge } from "@/components/StatusBadge";
import type { Booking } from "@shared/types/booking";

type Scope = "upcoming" | "past";

const SERVICE_LABEL: Record<string, string> = {
  daycare: "Daycare",
  grooming: "Grooming",
  overnights: "Overnights",
  transport: "Transport",
};

const SERVICE_ICON: Record<string, typeof Sun> = {
  daycare:    Sun,
  grooming:   Scissors,
  overnights: Moon,
  transport:  Car,
};

function relativeDay(iso: string): string {
  const now = new Date();
  const date = new Date(iso);
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const days = Math.floor((date.getTime() - startOfToday) / 86_400_000);
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  if (days === -1) return "Yesterday";
  if (days < 7 && days > 1) return date.toLocaleDateString(undefined, { weekday: "long" });
  return date.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
}

export function BookingsScreen() {
  const [scope, setScope] = useState<Scope>("upcoming");
  const { data, isLoading } = usePortalQuery<{ bookings: Booking[] }>(
    ["portal", "bookings", scope],
    `/portal/bookings?scope=${scope}`,
  );

  const bookings = data?.bookings ?? [];

  return (
    <main className="px-5 pt-8 pb-4 max-w-md mx-auto">
      {/* HEADER -------------------------------------------------------- */}
      <header className="mb-7 anim-fade-in">
        <p className="text-eyebrow mb-2">Activity</p>
        <h1 className="text-display-sm">Bookings</h1>
      </header>

      {/* SEGMENTED CONTROL --------------------------------------------- */}
      <div
        role="tablist"
        aria-label="Filter bookings"
        className="relative inline-flex w-full bg-muted rounded-xl p-1 mb-6"
      >
        {(["upcoming", "past"] as Scope[]).map((s) => {
          const active = scope === s;
          return (
            <button
              key={s}
              role="tab"
              aria-selected={active}
              onClick={() => setScope(s)}
              className={`press flex-1 h-9 rounded-lg text-sm font-medium capitalize transition-colors ${
                active
                  ? "bg-card text-foreground shadow-[var(--shadow-xs)]"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {s}
            </button>
          );
        })}
      </div>

      {/* LIST ---------------------------------------------------------- */}
      {isLoading ? (
        <ul className="space-y-2.5">
          <li><Skeleton className="h-[88px] rounded-2xl" /></li>
          <li><Skeleton className="h-[88px] rounded-2xl opacity-60" /></li>
          <li><Skeleton className="h-[88px] rounded-2xl opacity-40" /></li>
        </ul>
      ) : bookings.length === 0 ? (
        scope === "upcoming" ? <EmptyUpcoming /> : <EmptyPast />
      ) : (
        <ul className="space-y-2.5">
          {bookings.map((b, i) => {
            const ServiceIcon = SERVICE_ICON[b.service] ?? PawPrint;
            return (
            <li
              key={b.id}
              className="anim-slide-up"
              style={{ animationDelay: `${i * 50}ms` }}
            >
              <Link
                to={`/bookings/${b.id}`}
                className="press group block bg-card border border-border rounded-[1.25rem] p-3.5 hover:border-primary/40 transition-colors"
                style={{ boxShadow: "var(--shadow-card-soft)" }}
              >
                <div className="flex items-center gap-3.5">
                  <div className="size-12 rounded-2xl bg-secondary text-secondary-foreground grid place-items-center shrink-0">
                    <ServiceIcon size={18} strokeWidth={2} aria-hidden="true" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-0.5">
                      <h3 className="font-semibold text-[15px] leading-tight truncate">
                        {SERVICE_LABEL[b.service] ?? b.service}
                      </h3>
                      <StatusBadge status={b.status} />
                    </div>
                    <p className="text-[13px] text-foreground text-tabular">
                      {relativeDay(b.startAt)} ·{" "}
                      {new Date(b.startAt).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                      {" – "}
                      {new Date(b.endAt).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                    {(b as any).petNames?.length > 0 && (
                      <p className="text-xs text-muted-foreground mt-1 truncate">
                        {(b as any).petNames.join(", ")}
                      </p>
                    )}
                  </div>
                </div>
              </Link>
            </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}

function EmptyUpcoming() {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-card/40 px-5 py-9 text-center anim-fade-in">
      <div className="size-10 rounded-full bg-secondary text-secondary-foreground grid place-items-center mx-auto mb-3">
        <CalendarPlus size={18} />
      </div>
      <h3 className="font-semibold text-[15px] mb-1">No upcoming bookings</h3>
      <p className="text-[13px] text-muted-foreground mb-4">
        Send your first request and we'll keep you posted.
      </p>
      <Link
        to="/book"
        className="press inline-flex items-center gap-1.5 h-10 px-4 rounded-xl bg-primary text-primary-foreground text-sm font-semibold shadow-[var(--shadow-sm)] hover:shadow-[var(--shadow-md)]"
      >
        <Plus size={16} strokeWidth={2.5} />
        Book a service
      </Link>
    </div>
  );
}

function EmptyPast() {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-card/40 px-5 py-9 text-center anim-fade-in">
      <div className="size-10 rounded-full bg-secondary text-secondary-foreground grid place-items-center mx-auto mb-3">
        <CalendarPlus size={18} />
      </div>
      <h3 className="font-semibold text-[15px] mb-1">Nothing here yet</h3>
      <p className="text-[13px] text-muted-foreground">
        Your past bookings will appear here after they wrap.
      </p>
    </div>
  );
}
