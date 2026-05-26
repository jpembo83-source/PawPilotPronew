import { Link } from "react-router-dom";
import { Bell, Plus } from "lucide-react";
import { usePortalQuery } from "@/hooks/usePortalQuery";
import { Skeleton } from "@/components/Skeleton";
import { EmptyState } from "@/components/EmptyState";
import { StatusBadge } from "@/components/StatusBadge";
import type { Booking } from "@shared/types/booking";

interface HomeData {
  greeting: { firstName: string; tenantName: string };
  upcoming: Booking[];
  alerts: {
    vaxExpiring: Array<{ petId: string; vaxType: string; expiresAt: string }>;
    pendingRequests: number;
  };
}

const SERVICE_LABEL: Record<string, string> = {
  daycare: "Daycare",
  grooming: "Grooming",
  overnights: "Overnights",
  transport: "Transport",
};

export function HomeScreen() {
  const { data, isLoading } = usePortalQuery<HomeData>(["portal", "home"], "/portal/home");

  return (
    <main className="px-5 pt-6 max-w-md mx-auto">
      <header className="flex items-start justify-between mb-6">
        <div>
          {isLoading || !data ? (
            <>
              <Skeleton className="h-5 w-24 mb-1" />
              <Skeleton className="h-3 w-16" />
            </>
          ) : (
            <>
              <h1 className="text-xl font-semibold">Hi, {data.greeting.firstName}</h1>
              <p className="text-xs uppercase tracking-widest text-neutral-500 mt-1">
                {data.greeting.tenantName}
              </p>
            </>
          )}
        </div>
        <button
          aria-label="Notifications"
          className="size-10 grid place-items-center rounded-full bg-neutral-100 dark:bg-neutral-800"
        >
          <Bell size={18} />
        </button>
      </header>

      <section className="mb-6">
        <h2 className="text-xs uppercase tracking-widest text-neutral-500 mb-3">Up next</h2>
        {isLoading || !data ? (
          <Skeleton className="h-20 w-full rounded-2xl" />
        ) : data.upcoming.length === 0 ? (
          <EmptyState title="Nothing booked yet" body="Your upcoming bookings will appear here." />
        ) : (
          <ul className="space-y-2">
            {data.upcoming.map((b) => (
              <li key={b.id}>
                <Link
                  to={`/bookings/${b.id}`}
                  className="block bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-4"
                >
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="font-medium text-sm">
                      {SERVICE_LABEL[b.service] ?? b.service} ·{" "}
                      {new Date(b.startAt).toLocaleDateString(undefined, {
                        weekday: "short",
                        day: "numeric",
                        month: "short",
                      })}
                    </h3>
                    <StatusBadge status={b.status} />
                  </div>
                  <p className="text-xs text-neutral-500">
                    {new Date(b.startAt).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}{" "}
                    —{" "}
                    {new Date(b.endAt).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Link
        to="/book"
        className="flex items-center justify-center gap-2 w-full h-14 rounded-2xl bg-blue-600 text-white font-semibold mb-6"
      >
        <Plus size={18} /> Book a service
      </Link>

      {!isLoading && data && data.alerts.vaxExpiring.length > 0 && (
        <section className="rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 p-4 text-sm">
          <h3 className="font-medium mb-1 text-amber-900 dark:text-amber-200">
            Vaccinations need attention
          </h3>
          <p className="text-amber-800 dark:text-amber-300">
            {data.alerts.vaxExpiring.length} expiring in the next 30 days.
          </p>
          <Link
            to="/pets"
            className="mt-2 inline-block text-amber-900 dark:text-amber-200 font-medium underline underline-offset-2"
          >
            Review
          </Link>
        </section>
      )}
    </main>
  );
}
