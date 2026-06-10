/**
 * Whereabouts — the real-map deep view.
 *
 *   • Last 48 h of cellular GPS pings rendered as a smoothed trail polyline
 *     on top of OpenStreetMap raster tiles.
 *   • Stays (dedupe'd lingering points) plotted as duration-sized circles.
 *   • Latest position as a bold rose dot — the visual answer to "where is
 *     my dog right now?".
 *   • Below the map, a chronological list of stays with reverse-geocoded
 *     human place names (Nominatim + 30-day localStorage cache).
 *
 * Reads from /portal/pets/:id/whereabouts, which itself reads from cloud-
 * synced invoxia.positions + invoxia.stays — independent of BLE.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, Link } from "react-router-dom";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  ChevronLeft, MapPin, Navigation, Wifi, RefreshCw, Radar, X,
  BatteryFull, BatteryMedium, BatteryLow, BatteryCharging, WifiOff,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { usePortalQuery } from "@/hooks/usePortalQuery";
import { getPortalApi } from "@/lib/api";
import { reverseGeocode } from "@/lib/geocode";

interface DeviceStatus {
  battery_pct: number | null;
  charging:    boolean | null;
  state:       string;
  lowBattery:  boolean;
  offline:     boolean;
  lastSyncedAt: string | null;
  network:      string | null;
  subscriptionEnds: string | null;
}

interface WhereaboutsResponse {
  lastSeen: { lat: number; lng: number; accuracy_m: number; recorded_at: string; method: number } | null;
  positions: Array<{ ts: string; lat: number; lng: number; accuracy_m: number }>;
  stays: Array<{ startedAt: string; endedAt: string; durationSec: number; pointCount: number; lat: number; lng: number }>;
  coverage: "live" | "stale" | "no_device";
  deviceStatus: DeviceStatus | null;
  deviceName?: string | null;
}

function formatDuration(sec: number): string {
  if (sec < 60)   return `${sec} s`;
  if (sec < 3600) return `${Math.round(sec / 60)} min`;
  const h = sec / 3600;
  return h < 10 ? `${h.toFixed(1)} h` : `${Math.round(h)} h`;
}

function relativeAge(iso: string): string {
  const min = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));
  if (min < 1)         return "just now";
  if (min < 60)        return `${min} min ago`;
  if (min < 60 * 24)   return `${Math.round(min / 60)} h ago`;
  if (min < 60 * 24 * 7) return `${Math.round(min / 1440)} d ago`;
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

export function WhereaboutsScreen() {
  const { id: petId } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const mapEl = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const [places, setPlaces] = useState<Record<string, string | null>>({});
  const [refreshing, setRefreshing] = useState(false);

  // "Find" / tracking mode — when active, the cache polls /whereabouts every
  // 5 s so any new ping that lands in Supabase shows up on the map without
  // the user having to refresh.  Auto-stops at 60 s OR when we see a position
  // newer than the request start.
  const [trackingStartedAt, setTrackingStartedAt] = useState<number | null>(null);
  const [now, setNow] = useState<number>(() => Date.now());
  const trackingActive = trackingStartedAt != null && (now - trackingStartedAt) < 60_000;

  const { data, isLoading, refetch } = usePortalQuery<WhereaboutsResponse>(
    ["portal", "pets", petId, "whereabouts"],
    `/portal/pets/${petId}/whereabouts`,
    {
      enabled: !!petId,
      staleTime: 60_000,
      refetchInterval: trackingActive ? 5_000 : false,
    },
  );

  // Tick clock once a second while tracking so the countdown renders.
  useEffect(() => {
    if (!trackingActive) return;
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, [trackingActive]);

  // Auto-end tracking when a fresh ping arrives.
  useEffect(() => {
    if (!trackingStartedAt || !data?.lastSeen) return;
    const lastSeenMs = new Date(data.lastSeen.recorded_at).getTime();
    if (lastSeenMs > trackingStartedAt - 5_000) {
      // A position newer than (request_start − 5s) is "fresh enough".
      toast.success("Fresh ping received.", { duration: 2200 });
      setTrackingStartedAt(null);
    }
  }, [data?.lastSeen?.recorded_at, trackingStartedAt]);

  async function handleLocate() {
    if (trackingActive || !petId) return;
    try {
      await getPortalApi().post(`/portal/pets/${petId}/locate`);
      setTrackingStartedAt(Date.now());
      setNow(Date.now());
      toast.success("Pinging the collar…", {
        description: "Watching for fresh positions for 60 s.",
        duration: 2200,
      });
    } catch (e: any) {
      toast.error("Couldn't request a location.", {
        description: e?.message ?? String(e),
      });
    }
  }

  function cancelTracking() {
    setTrackingStartedAt(null);
  }

  async function handleRefresh() {
    if (refreshing) return;
    setRefreshing(true);
    try {
      await qc.invalidateQueries({ queryKey: ["portal", "pets", petId, "whereabouts"] });
      await refetch();
      toast.success("Refreshed", {
        description: "Pulled the latest 5-min cellular sync.",
        duration: 1800,
      });
    } finally {
      // Short minimum spin so the user perceives the refresh actually happened.
      setTimeout(() => setRefreshing(false), 400);
    }
  }

  // Build a stable chronological list of positions, used both by the map
  // and by the trail polyline.
  const chrono = useMemo(() => {
    if (!data?.positions?.length) return [] as WhereaboutsResponse["positions"];
    return [...data.positions].sort((a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime());
  }, [data?.positions]);

  // ── Map init ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapEl.current || !data || mapRef.current) return;
    if (!data.lastSeen && chrono.length === 0) return; // nothing to draw

    const map = L.map(mapEl.current, {
      zoomControl: false,
      attributionControl: false,
      preferCanvas: true,
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      crossOrigin: true,
    }).addTo(map);

    // Trail polyline through every ping in time order.
    if (chrono.length > 1) {
      const latlngs = chrono.map((p) => [p.lat, p.lng] as [number, number]);
      L.polyline(latlngs, {
        color: "rgb(220 38 67)",
        weight: 2.5,
        opacity: 0.75,
        smoothFactor: 1.2,
      }).addTo(map);
    }

    // Tiny dots on each individual ping.
    chrono.forEach((p) => {
      L.circleMarker([p.lat, p.lng], {
        radius: 2.5,
        color: "rgb(220 38 67)",
        weight: 1.2,
        fillColor: "#FFFFFF",
        fillOpacity: 1,
      })
        .bindTooltip(new Date(p.ts).toLocaleString(undefined, {
          weekday: "short", hour: "2-digit", minute: "2-digit",
        }), { direction: "top", offset: [0, -4] })
        .addTo(map);
    });

    // Stay circles, sized by relative duration.  Sage tone to distinguish
    // from the rose ping dots.
    if (data.stays.length > 0) {
      const maxDur = Math.max(...data.stays.map((s) => s.durationSec));
      data.stays.forEach((s, i) => {
        const r = maxDur > 0
          ? 9 + 18 * (s.durationSec / maxDur)
          : 12;
        L.circleMarker([s.lat, s.lng], {
          radius: r,
          color: "rgb(47 122 87)",
          weight: 1.6,
          fillColor: "rgb(47 122 87)",
          fillOpacity: 0.22,
        })
          .bindPopup(
            `<div style="font-family: system-ui; font-size: 12px; line-height: 1.5;">
               <strong>Stay #${i + 1}</strong><br/>
               ${formatDuration(s.durationSec)}<br/>
               <span style="color:#6B6762">${new Date(s.startedAt).toLocaleString()}</span>
             </div>`,
            { closeButton: false }
          )
          .addTo(map);
      });
    }

    // The hero marker — last seen.
    if (data.lastSeen) {
      L.circleMarker([data.lastSeen.lat, data.lastSeen.lng], {
        radius: 9,
        color: "#FFFFFF",
        weight: 3,
        fillColor: "rgb(220 38 67)",
        fillOpacity: 0.95,
      })
        .bindTooltip(`Last seen ${relativeAge(data.lastSeen.recorded_at)}`, {
          direction: "top", offset: [0, -8], permanent: false,
        })
        .addTo(map);
    }

    // Fit-bounds across everything we drew.
    const allLat = [
      ...chrono.map((p) => [p.lat, p.lng] as [number, number]),
      ...data.stays.map((s) => [s.lat, s.lng] as [number, number]),
      ...(data.lastSeen ? [[data.lastSeen.lat, data.lastSeen.lng] as [number, number]] : []),
    ];
    if (allLat.length > 1) {
      map.fitBounds(L.latLngBounds(allLat), { padding: [32, 32] });
    } else {
      const single = allLat[0]!;
      map.setView([single[0], single[1]], 14);
    }

    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [data, chrono]);

  // ── Reverse-geocode lastSeen + stays serially ──────────────────────
  useEffect(() => {
    if (!data) return;
    const work: Array<{ key: string; lat: number; lng: number }> = [];
    if (data.lastSeen) {
      work.push({ key: "last", lat: data.lastSeen.lat, lng: data.lastSeen.lng });
    }
    data.stays.slice(0, 12).forEach((s, i) => {
      work.push({ key: `stay-${i}`, lat: s.lat, lng: s.lng });
    });

    let cancelled = false;
    (async () => {
      for (const w of work) {
        if (cancelled) return;
        if (places[w.key] !== undefined) continue; // already resolved
        const name = await reverseGeocode(w.lat, w.lng);
        if (cancelled) return;
        setPlaces((prev) => ({ ...prev, [w.key]: name }));
        // Respect Nominatim's 1 req/sec.
        await new Promise((r) => setTimeout(r, 1100));
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  const lastSeenName = places["last"];
  const isStale = data?.lastSeen
    ? (Date.now() - new Date(data.lastSeen.recorded_at).getTime()) > 60 * 60_000
    : false;

  return (
    <main className="px-5 pt-8 pb-12 max-w-md mx-auto">
      <Link
        to={petId ? `/pets/${petId}` : "/pets"}
        className="inline-flex items-center gap-0.5 -ml-1 mb-5 h-8 pr-2 pl-1 rounded-lg text-sm font-medium text-primary"
      >
        <ChevronLeft size={16} strokeWidth={2.5} />
        Pet
      </Link>

      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] tracking-[0.22em] uppercase font-medium text-muted-foreground">
            Cellular GPS
          </p>
          <h1 className="font-display leading-[0.95] tracking-[-0.015em] mt-1 mb-3" style={{ fontSize: 40 }}>
            Whereabouts
          </h1>
        </div>
        {/* Refresh — re-invalidates the React Query cache.  The cron writes
            fresh positions every 5 minutes, so this typically picks up the
            newest ping the moment it lands in Supabase. */}
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="press shrink-0 mt-1 size-10 rounded-full bg-card border border-border/60 grid place-items-center text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors disabled:opacity-60"
          style={{ boxShadow: "var(--shadow-card-soft)" }}
          aria-label="Refresh latest ping"
        >
          <RefreshCw size={15} strokeWidth={2.2} className={refreshing ? "animate-spin" : ""} aria-hidden="true" />
        </button>
      </div>
      <p className="text-sm text-muted-foreground mb-5 max-w-[34ch] leading-relaxed">
        Where the collar's been over the last 48 hours — captured every 5 minutes via cellular sync, no phone needed.
      </p>

      {/* Collar status strip — battery + network + alerts */}
      {data?.deviceStatus && (
        <DeviceStatusStrip status={data.deviceStatus} />
      )}

      {/* Find / locate button.  When idle: dark CTA.  When tracking: a
          live countdown bar with a cancel affordance. */}
      {data?.lastSeen && (
        trackingActive && trackingStartedAt != null ? (
          <TrackingBar
            startedAt={trackingStartedAt}
            now={now}
            onCancel={cancelTracking}
          />
        ) : (
          <button
            onClick={handleLocate}
            className="press group relative inline-flex items-center justify-center gap-2.5 w-full h-13 rounded-[1.25rem] bg-foreground text-background font-semibold mb-5 hover:opacity-[0.96] transition-opacity overflow-hidden"
            style={{ boxShadow: "var(--shadow-card-soft)", height: 52 }}
          >
            <span className="absolute inset-x-0 top-0 h-px bg-white/10 pointer-events-none" aria-hidden="true" />
            <Radar size={17} strokeWidth={2.4} aria-hidden="true" />
            <span className="tracking-[-0.005em] text-[15px]">Find now</span>
            <span className="ml-2 text-[10px] tracking-[0.18em] uppercase font-medium text-background/55">
              fresh ping · 60 s
            </span>
          </button>
        )
      )}

      {/* Live status pill — last-seen relative + accuracy */}
      {data?.lastSeen && (
        <div
          className="rounded-2xl bg-card border border-border/60 px-4 py-3 mb-5 flex items-center gap-3"
          style={{ boxShadow: "var(--shadow-card-soft)" }}
        >
          <span
            className={`shrink-0 size-10 rounded-xl grid place-items-center ${
              isStale ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700"
            }`}
            aria-hidden="true"
          >
            <Navigation size={18} strokeWidth={2} />
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] tracking-[0.22em] uppercase font-medium text-muted-foreground">
              {isStale ? "Stale" : "Live"} · {relativeAge(data.lastSeen.recorded_at)}
            </p>
            <p className="font-display text-foreground truncate" style={{ fontSize: 18, letterSpacing: "-0.01em" }}>
              {lastSeenName ?? `${data.lastSeen.lat.toFixed(4)}, ${data.lastSeen.lng.toFixed(4)}`}
            </p>
          </div>
          <span className="text-[10px] tracking-wide font-medium text-muted-foreground tabular-nums shrink-0">
            ±{data.lastSeen.accuracy_m} m
          </span>
        </div>
      )}

      {/* THE MAP --------------------------------------------------------- */}
      {isLoading ? (
        <div
          className="aspect-square w-full rounded-3xl mb-5 bg-muted animate-shimmer"
          aria-label="Loading map"
        />
      ) : !data || (!data.lastSeen && chrono.length === 0) ? (
        <EmptyMap />
      ) : (
        <div
          className="rounded-3xl overflow-hidden border border-border/60 mb-5 relative"
          style={{ boxShadow: "var(--shadow-card-soft)" }}
        >
          <div
            ref={mapEl}
            className="aspect-square w-full bg-muted"
            style={{ minHeight: 360 }}
          />
          {/* Legend overlay — Bento 2.0 micro-typography */}
          <div className="absolute left-3 bottom-3 right-3 flex items-center gap-3 rounded-xl bg-card/85 backdrop-blur-md border border-border/40 px-3 py-2 pointer-events-none">
            <LegendDot color="rgb(220 38 67)" label="Pings" />
            <LegendDot color="rgb(47 122 87)" label="Stays" />
            <span className="ml-auto text-[10px] text-muted-foreground tabular-nums">
              {chrono.length} pings · {data.stays.length} stays
            </span>
          </div>
        </div>
      )}

      {/* PLACES VISITED -------------------------------------------------- */}
      {data?.stays && data.stays.length > 0 && (
        <section className="mb-6">
          <div className="flex items-baseline justify-between mb-3">
            <p className="text-[10px] tracking-[0.22em] uppercase font-medium text-muted-foreground">
              Places · 7 days
            </p>
            <span className="text-[10px] text-muted-foreground tabular-nums">
              {data.stays.length}
            </span>
          </div>
          <ul className="space-y-2">
            {data.stays.slice(0, 12).map((s, i) => {
              const name = places[`stay-${i}`];
              return (
                <li
                  key={`${s.startedAt}-${i}`}
                  className="rounded-2xl bg-card border border-border/60 p-4 flex items-center gap-3 anim-slide-up"
                  style={{ boxShadow: "var(--shadow-card-soft)", animationDelay: `${i * 40}ms` }}
                >
                  <div className="size-10 rounded-xl bg-secondary text-secondary-foreground grid place-items-center shrink-0">
                    <MapPin size={16} strokeWidth={2} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm leading-snug truncate">
                      {name ?? <span className="font-mono text-xs">{s.lat.toFixed(4)}, {s.lng.toFixed(4)}</span>}
                    </p>
                    <p className="text-xs text-muted-foreground tabular-nums mt-0.5">
                      {formatDuration(s.durationSec)} · {relativeAge(s.startedAt)}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <p className="text-[10px] text-muted-foreground/80 leading-relaxed">
        Map data ©{" "}
        <a
          href="https://www.openstreetmap.org/copyright"
          target="_blank"
          rel="noopener noreferrer"
          className="underline underline-offset-2"
        >
          OpenStreetMap
        </a>{" "}
        contributors. Place names via Nominatim.
      </p>
    </main>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className="size-2 rounded-full"
        style={{ backgroundColor: color }}
        aria-hidden="true"
      />
      <span className="text-[10px] font-medium tracking-wide text-foreground">{label}</span>
    </span>
  );
}

function EmptyMap() {
  return (
    <div
      className="aspect-square w-full rounded-3xl mb-5 border border-dashed border-border/60 bg-card/50 grid place-items-center px-8 text-center"
      style={{ boxShadow: "var(--shadow-xs)" }}
    >
      <div>
        <div className="size-12 mx-auto mb-3 rounded-2xl bg-secondary text-secondary-foreground grid place-items-center">
          <Wifi size={20} strokeWidth={1.6} />
        </div>
        <h3 className="font-semibold text-[15px] mb-1">No pings yet</h3>
        <p className="text-[13px] text-muted-foreground leading-relaxed max-w-[28ch] mx-auto">
          The collar's cellular link will report a location with the next health session — typically within the hour.
        </p>
      </div>
    </div>
  );
}

/* Tracking-mode countdown bar.  Renders in place of the Find button while
   we're actively polling /whereabouts for a fresh ping.  Includes a smoothly
   draining progress bar, a tabular seconds-remaining readout, and a cancel
   affordance. */
function TrackingBar({
  startedAt, now, onCancel,
}: {
  startedAt: number;
  now: number;
  onCancel: () => void;
}) {
  const elapsedMs = Math.max(0, now - startedAt);
  const remainingMs = Math.max(0, 60_000 - elapsedMs);
  const remainingS = Math.ceil(remainingMs / 1000);
  const progressPct = (elapsedMs / 60_000) * 100;

  return (
    <div
      className="relative mb-5 rounded-[1.25rem] overflow-hidden bg-foreground text-background"
      style={{ boxShadow: "var(--shadow-card-soft)" }}
      role="status"
      aria-live="polite"
    >
      {/* Drain bar — fills from right as time elapses */}
      <div
        className="absolute inset-y-0 left-0 bg-background/10 pointer-events-none transition-[width] duration-1000 ease-linear"
        style={{ width: `${progressPct}%` }}
        aria-hidden="true"
      />
      <div className="relative flex items-center gap-3 px-5 py-3.5">
        <span className="inline-flex items-center gap-2">
          <span className="relative inline-flex">
            <Radar size={18} strokeWidth={2.2} className="text-background animate-pulse-dot" aria-hidden="true" />
            <span className="absolute inset-0 rounded-full ring-2 ring-background/30 animate-ping" aria-hidden="true" />
          </span>
          <span className="text-[10px] tracking-[0.22em] uppercase font-semibold text-background/70">
            Listening
          </span>
        </span>
        <span className="font-display text-tabular text-background leading-none ml-1" style={{ fontSize: 22, letterSpacing: "-0.02em" }}>
          {remainingS}
        </span>
        <span className="text-[12px] text-background/65 tracking-wide -mb-0.5">s</span>
        <button
          onClick={onCancel}
          className="press ml-auto size-8 rounded-full bg-background/10 hover:bg-background/15 grid place-items-center text-background transition-colors"
          aria-label="Cancel locate"
        >
          <X size={14} strokeWidth={2.4} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

/* Collar status strip — battery + carrier + offline alert.  Reads from the
   /whereabouts deviceStatus block, which surfaces invoxia.device_status_summary
   and invoxia.devices.status JSONB. */
function DeviceStatusStrip({ status }: { status: DeviceStatus }) {
  const pct = status.battery_pct;

  let BatteryIcon: typeof BatteryFull = BatteryFull;
  let batteryTone = "text-emerald-700 bg-emerald-50 border-emerald-200/70";
  if (pct != null) {
    if (status.charging) {
      BatteryIcon = BatteryCharging;
      batteryTone = "text-emerald-700 bg-emerald-50 border-emerald-200/70";
    } else if (pct <= 15 || status.lowBattery) {
      BatteryIcon = BatteryLow;
      batteryTone = "text-rose-700 bg-rose-50 border-rose-200/70";
    } else if (pct <= 40) {
      BatteryIcon = BatteryMedium;
      batteryTone = "text-amber-700 bg-amber-50 border-amber-200/70";
    }
  }

  return (
    <div
      className="rounded-2xl bg-card border border-border/60 px-4 py-3 mb-5 flex items-center gap-3"
      style={{ boxShadow: "var(--shadow-card-soft)" }}
    >
      {pct != null && (
        <span
          className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-[3px] text-[11px] font-semibold tabular-nums tracking-wide ${batteryTone}`}
        >
          <BatteryIcon size={13} strokeWidth={2.2} aria-hidden="true" />
          {pct}%{status.charging ? " · charging" : ""}
        </span>
      )}

      <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground tracking-wide">
        {status.offline ? (
          <WifiOff size={12} strokeWidth={2.2} className="text-rose-700" aria-hidden="true" />
        ) : (
          <Wifi size={12} strokeWidth={2.2} className="text-emerald-700" aria-hidden="true" />
        )}
        <span className="text-foreground font-semibold">{status.offline ? "Offline" : "Online"}</span>
        {status.network && <span>· {status.network.toUpperCase()}</span>}
      </span>

      {status.lastSyncedAt && (
        <span className="ml-auto text-[10px] text-muted-foreground tabular-nums tracking-wide">
          synced {relativeAge(status.lastSyncedAt)}
        </span>
      )}
    </div>
  );
}
