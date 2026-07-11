import { useEffect } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import {
  BellOff, Calendar, Syringe, MapPin, Footprints, Car,
  Zap, BatteryLow, BatteryFull, WifiOff, Wifi, Dog, Camera,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useNotifications, PortalNotification } from "@/hooks/useNotifications";
import { getPortalApi } from "@/lib/api";

interface Props {
  open: boolean;
  onClose: () => void;
}

/**
 * Per-type renderer. Each entry returns the icon, an accent colour the
 * icon chip uses, and a {title, body} pair composed from the notification
 * payload.  Falls back to a generic Dog icon + the raw type string for
 * any type the renderer doesn't know about, so a server-side rollout of
 * a new event type degrades gracefully instead of crashing the drawer.
 */
type Renderer = {
  Icon: typeof Dog;
  /** Tailwind colour bucket for the icon chip. */
  accent: "primary" | "warn" | "info" | "success" | "subtle";
  title: string;
  body?: string;
};

function renderNotification(n: PortalNotification): Renderer {
  const p = (n.payload ?? {}) as {
    petName?: string;
    zoneName?: string;
    batteryPct?: number;
    note?: string | null;
    hasPhoto?: boolean;
    photoCount?: number;
    reason?: string;
  };
  const pet = p.petName ?? "Your pet";

  switch (n.type) {
    /* ----- Existing booking + vax types --------------------------- */
    case "booking.received":
      return { Icon: Calendar, accent: "primary", title: "Booking request received", body: "We've passed it to the team." };
    case "booking.confirmed":
      return { Icon: Calendar, accent: "success", title: "Booking confirmed" };
    case "booking.declined":
      return { Icon: Calendar, accent: "warn", title: "Booking declined" };
    case "booking.cancelled":
      return { Icon: Calendar, accent: "subtle", title: "Booking cancelled" };
    case "vax.approved":
      return { Icon: Syringe, accent: "success", title: "Vaccination added" };
    case "vax.rejected":
      return { Icon: Syringe, accent: "warn", title: "Vaccination not accepted" };
    case "vax.expiring":
      return { Icon: Syringe, accent: "warn", title: "Vaccination expiring soon" };

    /* ----- Pet verification (owner-added pets) --------------------- */
    case "pet.approved":
      return {
        Icon: Dog, accent: "success",
        title: `${pet} is verified`,
        body: "Bookings are open — pick them in the booking wizard.",
      };
    case "pet.rejected":
      return {
        Icon: Dog, accent: "warn",
        title: `We couldn't verify ${pet}`,
        body: p.reason || undefined,
      };

    /* ----- Day-feed moments ---------------------------------------- */
    case "moment.shared": {
      // Approvals arrive batched: one notification per pet, photoCount deep.
      const count = p.photoCount ?? (p.hasPhoto ? 1 : 0);
      return {
        Icon: Camera, accent: "primary",
        title: count > 1
          ? `${count} new photos of ${pet} 🐾`
          : `A moment from ${pet}'s day`,
        body: p.note ||
          (count > 1
            ? "Fresh from the yard — see them in the gallery."
            : count === 1
              ? "The team shared a new photo."
              : undefined),
      };
    }

    /* ----- Tracker / collar events -------------------------------- */
    case "tracker.zone_left":
      return {
        Icon: MapPin, accent: "info",
        title: `${pet} left the '${p.zoneName ?? "Home"}' zone`,
      };
    case "tracker.zone_entered":
      return {
        Icon: MapPin, accent: "success",
        title: `${pet} arrived at '${p.zoneName ?? "Home"}'`,
      };
    case "tracker.walk_started":
      return {
        Icon: Footprints, accent: "info",
        title: "Pet walk detected",
        body: `${pet} has been walking for several minutes.`,
      };
    case "tracker.walk_ended":
      return {
        Icon: Footprints, accent: "subtle",
        title: "End of the walk",
        body: `${pet} has stopped walking for several minutes.`,
      };
    case "tracker.transport_started":
      return {
        Icon: Car, accent: "info",
        title: "Transport detected",
        body: `${pet} has been moving for several minutes.`,
      };
    case "tracker.transport_ended":
      return {
        Icon: Car, accent: "subtle",
        title: "End of transport",
        body: `${pet} has finished moving for several minutes.`,
      };
    case "tracker.zoomies":
      return {
        Icon: Zap, accent: "primary",
        title: "Zoomies alert!",
        body: `${pet}'s just made a sprint.`,
      };
    case "tracker.battery_low":
      return {
        Icon: BatteryLow, accent: "warn",
        title: "Battery low",
        body:
          p.batteryPct != null
            ? `${pet}'s tracker is at ${Math.round(p.batteryPct)}%.`
            : `${pet}'s tracker battery is running low.`,
      };
    case "tracker.battery_charged":
      return {
        Icon: BatteryFull, accent: "success",
        title: "Battery recharged",
        body: `${pet}'s tracker battery is fully charged.`,
      };
    case "tracker.offline":
      return {
        Icon: WifiOff, accent: "warn",
        title: "Tracker offline",
        body: `${pet}'s tracker hasn't checked in for a while.`,
      };
    case "tracker.online":
      return {
        Icon: Wifi, accent: "success",
        title: "Tracker back online",
        body: `${pet}'s tracker is connected again.`,
      };

    default:
      return { Icon: Dog, accent: "subtle", title: n.type };
  }
}

const ACCENT_CLASSES: Record<Renderer["accent"], string> = {
  primary: "bg-primary/10 text-primary",
  warn:    "bg-amber-100 text-amber-700",
  info:    "bg-blue-100 text-blue-700",
  success: "bg-emerald-100 text-emerald-700",
  subtle:  "bg-secondary text-secondary-foreground",
};

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
  });
}

export function NotificationDrawer({ open, onClose }: Props) {
  const { data, isLoading } = useNotifications();
  const qc = useQueryClient();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  const items = data?.notifications ?? [];
  const hasUnread = items.some((n) => !n.readAt);

  async function markAllRead() {
    try {
      await getPortalApi().post("/portal/notifications/read-all");
      qc.invalidateQueries({ queryKey: ["portal", "notifications"] });
    } catch {}
  }

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/45 anim-fade-in"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="bg-card rounded-t-3xl w-full max-w-md max-h-[82vh] overflow-y-auto p-5 shadow-[var(--shadow-lg)] anim-slide-up"
        onClick={(e) => e.stopPropagation()}
        style={{ paddingBottom: "calc(1.5rem + var(--safe-bottom))" }}
        role="dialog"
        aria-label="Notifications"
        aria-modal="true"
      >
        {/* Drag handle */}
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-muted" aria-hidden="true" />

        <header className="flex items-baseline justify-between mb-5">
          <h2 className="text-display-sm">Notifications</h2>
          <div className="flex items-center gap-2">
            {hasUnread && (
              <button
                onClick={markAllRead}
                className="press text-xs text-primary font-semibold h-8 px-2.5 rounded-lg hover:bg-secondary"
              >
                Mark all read
              </button>
            )}
            <button
              onClick={onClose}
              className="press text-sm text-muted-foreground hover:text-foreground h-8 px-2 -mr-1 rounded-lg"
            >
              Close
            </button>
          </div>
        </header>

        {isLoading ? (
          <p className="text-[13px] text-muted-foreground py-6 text-center">Loading…</p>
        ) : items.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card/40 px-5 py-9 text-center">
            <div
              className="mx-auto mb-3 size-10 rounded-full bg-secondary text-secondary-foreground grid place-items-center"
              aria-hidden="true"
            >
              <BellOff size={18} />
            </div>
            <h3 className="font-semibold text-[15px] mb-1">All caught up</h3>
            <p className="text-[13px] text-muted-foreground">
              We'll let you know when there's news on your bookings, pets, or tracker.
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {items.map((n, i) => (
              <li
                key={n.id}
                className="anim-slide-up"
                style={{ animationDelay: `${Math.min(i, 6) * 40}ms` }}
              >
                <NotificationItem n={n} onClick={onClose} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>,
    document.body,
  );
}

function NotificationItem({ n, onClick }: { n: PortalNotification; onClick: () => void }) {
  const r = renderNotification(n);
  const unread = !n.readAt;

  const body = (
    <div
      className={`press relative flex items-start gap-3 p-3.5 rounded-xl border transition-colors ${
        unread
          ? "bg-secondary/70 border-primary/20 hover:border-primary/40"
          : "bg-card border-border hover:border-primary/20"
      }`}
    >
      {unread && (
        <span
          className="absolute left-1.5 top-4 size-1.5 rounded-full bg-primary"
          aria-hidden="true"
        />
      )}
      <div
        className={`size-9 rounded-xl grid place-items-center shrink-0 ml-1.5 ${ACCENT_CLASSES[r.accent]}`}
        aria-hidden="true"
      >
        <r.Icon size={16} strokeWidth={2.2} />
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-sm leading-snug ${unread ? "font-semibold" : "font-medium"}`}>
          {r.title}
        </p>
        {r.body && (
          <p className="text-[12.5px] text-muted-foreground leading-snug mt-0.5">{r.body}</p>
        )}
        <p className="text-[11px] text-muted-foreground text-tabular mt-1">
          {relativeTime(n.createdAt)}
        </p>
      </div>
    </div>
  );
  return n.link ? (
    <Link to={n.link} onClick={onClick} className="block">
      {body}
    </Link>
  ) : (
    body
  );
}
