import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { ChevronLeft, Car, Scissors, Sun, Moon, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { usePortalQuery } from "@/hooks/usePortalQuery";
import { Skeleton } from "@/components/Skeleton";
import { StatusBadge } from "@/components/StatusBadge";
import { ConfirmSheet } from "@/components/ConfirmSheet";
import { getPortalApi } from "@/lib/api";
import type { Booking } from "@shared/types/booking";

const SERVICE_LABEL: Record<string, string> = {
  daycare: "Daycare",
  grooming: "Grooming",
  overnights: "Overnights",
  transport: "Transport",
};

const SERVICE_ICON: Record<string, typeof Sun> = {
  daycare: Sun,
  grooming: Scissors,
  overnights: Moon,
  transport: Car,
};

interface BundleChild {
  id: string;
  service: string;
  startAt: string;
  endAt: string;
  status: string;
}

function formatRange(start: string, end: string): { primary: string; secondary: string } {
  const s = new Date(start);
  const e = new Date(end);
  const sameDay = s.toDateString() === e.toDateString();
  const dateOpts: Intl.DateTimeFormatOptions = {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: s.getFullYear() === new Date().getFullYear() ? undefined : "numeric",
  };
  const timeOpts: Intl.DateTimeFormatOptions = { hour: "2-digit", minute: "2-digit" };
  if (sameDay) {
    return {
      primary: s.toLocaleDateString(undefined, dateOpts),
      secondary: `${s.toLocaleTimeString([], timeOpts)} – ${e.toLocaleTimeString([], timeOpts)}`,
    };
  }
  return {
    primary: `${s.toLocaleDateString(undefined, dateOpts)} – ${e.toLocaleDateString(undefined, dateOpts)}`,
    secondary: `${s.toLocaleTimeString([], timeOpts)} → ${e.toLocaleTimeString([], timeOpts)}`,
  };
}

export function BookingDetailScreen() {
  const { id } = useParams();
  const { data, isLoading } = usePortalQuery<{
    booking: Booking & {
      petNames?: string[];
      declineReason?: string;
      kind?: "bundle_parent" | "bundle_child";
      childIds?: string[];
      services?: string[];
    };
    children?: BundleChild[];
  }>(
    ["portal", "bookings", "detail", id],
    `/portal/bookings/${id}`,
    { enabled: !!id },
  );
  const [busy, setBusy] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const qc = useQueryClient();

  async function cancel() {
    if (!id) return;
    setConfirmOpen(false);
    setBusy(true);
    try {
      await getPortalApi().post(`/portal/bookings/${id}/cancel`);
      toast.success("Cancelled");
      qc.invalidateQueries({ queryKey: ["portal", "bookings"] });
      qc.invalidateQueries({ queryKey: ["portal", "bookings", "detail", id] });
      qc.invalidateQueries({ queryKey: ["portal", "home"] });
    } catch (e: any) {
      toast.error(e?.message ?? "Cancel failed");
    } finally {
      setBusy(false);
    }
  }

  if (isLoading || !data) {
    return (
      <main className="px-5 pt-8 pb-4 max-w-md mx-auto">
        <Skeleton className="h-4 w-24 mb-4" />
        <Skeleton className="h-3.5 w-20 mb-3" />
        <Skeleton className="h-8 w-44 mb-6" />
        <Skeleton className="h-44 rounded-2xl" />
      </main>
    );
  }
  const b = data.booking;
  const isBundle = b.kind === "bundle_parent";
  const children = data.children ?? [];
  const serviceLabel = isBundle
    ? `Bundle · ${children.length} services`
    : SERVICE_LABEL[b.service] ?? b.service;
  const range = formatRange(b.startAt, b.endAt);

  return (
    <main className="px-5 pt-8 max-w-md mx-auto pb-12">
      {/* BACK LINK ----------------------------------------------------- */}
      <Link
        to="/bookings"
        className="press inline-flex items-center gap-0.5 -ml-1 mb-5 h-8 pr-2 pl-1 rounded-lg text-sm font-medium text-primary"
      >
        <ChevronLeft size={16} strokeWidth={2.5} />
        All bookings
      </Link>

      {/* HEADER -------------------------------------------------------- */}
      <header className="mb-6 anim-fade-in">
        <div className="flex items-center justify-between gap-3 mb-3">
          <p className="text-eyebrow truncate">{serviceLabel}</p>
          <StatusBadge status={b.status} />
        </div>
        <div className="flex items-start gap-3">
          {(() => {
            const Icon = isBundle ? Sparkles : (SERVICE_ICON[b.service] ?? Sparkles);
            return (
              <div
                className="size-14 rounded-2xl bg-secondary text-secondary-foreground grid place-items-center shrink-0"
                aria-hidden="true"
              >
                <Icon size={22} strokeWidth={2} />
              </div>
            );
          })()}
          <div className="min-w-0">
            <h1 className="text-display-sm leading-tight">{range.primary}</h1>
            <p className="text-[13px] text-muted-foreground text-tabular mt-1">{range.secondary}</p>
          </div>
        </div>
      </header>

      {/* BUNDLE LINE ITEMS ------------------------------------------ */}
      {isBundle && children.length > 0 && (
        <section className="mb-5 anim-slide-up">
          <p className="text-eyebrow mb-2.5">What's included</p>
          <ul className="space-y-2">
            {children.map((line) => {
              const Icon = SERVICE_ICON[line.service] ?? Sun;
              return (
                <li
                  key={line.id}
                  className="flex items-center gap-3 p-3.5 rounded-xl border border-border bg-card"
                >
                  <div className="size-10 rounded-xl bg-secondary text-secondary-foreground grid place-items-center shrink-0">
                    <Icon size={18} strokeWidth={2} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-[14.5px] leading-tight">
                      {SERVICE_LABEL[line.service] ?? line.service}
                    </p>
                    <p className="text-[12.5px] text-muted-foreground mt-0.5 text-tabular">
                      {new Date(line.startAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      {" – "}
                      {new Date(line.endAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* DETAILS CARD -------------------------------------------------- */}
      <dl className="rounded-2xl border border-border bg-card p-2 text-sm mb-5 anim-slide-up" style={{ animationDelay: "60ms" }}>
        <Row label="Pets" value={b.petNames?.length ? b.petNames.join(", ") : `${b.petIds.length} pet(s)`} />
        {!isBundle && <Row label="Service" value={serviceLabel} />}
        <Row
          label="Submitted"
          value={new Date(b.createdAt).toLocaleDateString(undefined, {
            day: "numeric",
            month: "short",
            year: "numeric",
          })}
          last={!b.notes && !(b.status === "declined" && b.declineReason)}
        />
        {b.notes && (
          <div className="border-t border-border px-3 py-3">
            <dt className="text-eyebrow mb-1.5">Notes</dt>
            <dd className="text-foreground leading-relaxed">{b.notes}</dd>
          </div>
        )}
        {b.status === "declined" && b.declineReason && (
          <div className="border-t border-border px-3 py-3">
            <dt className="text-eyebrow mb-1.5" style={{ color: "var(--destructive)" }}>
              Reason for decline
            </dt>
            <dd className="text-destructive leading-relaxed">{b.declineReason}</dd>
          </div>
        )}
      </dl>

      {/* CANCEL CTA ---------------------------------------------------- */}
      {b.status === "pending" && (
        <>
          <button
            onClick={() => setConfirmOpen(true)}
            disabled={busy}
            className="press w-full h-12 rounded-2xl border border-destructive/40 text-destructive font-semibold disabled:opacity-50 hover:bg-destructive/5"
          >
            {busy ? "Cancelling…" : isBundle ? "Cancel whole bundle" : "Cancel request"}
          </button>
          <ConfirmSheet
            open={confirmOpen}
            onClose={() => setConfirmOpen(false)}
            onConfirm={() => void cancel()}
            title="Cancel this request?"
            body="The team will be notified — you can always book again."
            confirmLabel="Cancel request"
            cancelLabel="Keep booking"
            busy={busy}
          />
        </>
      )}
    </main>
  );
}

function Row({ label, value, last = false }: { label: string; value: string; last?: boolean }) {
  return (
    <div
      className={`flex items-baseline justify-between gap-4 px-3 py-3 ${
        last ? "" : "border-b border-border"
      }`}
    >
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium text-right text-tabular truncate">{value}</dd>
    </div>
  );
}
