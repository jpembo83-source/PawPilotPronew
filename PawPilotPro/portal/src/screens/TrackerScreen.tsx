/**
 * Tracker — owner-facing BLE bridge view.
 *
 * Surfaces ONLY what a daycare client needs: connection status, the auto-
 * upload/auto-reconnect toggles, and a friendly "capturing N readings"
 * summary.  Anything that reads as engineer-debug (raw characteristic UUIDs,
 * hex packet dumps, per-channel counters, manual-flush button) is hidden
 * behind a "Show diagnostics" disclosure so it's still reachable from a
 * support session, but never assaults the regular user.
 */
import { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import {
  ChevronLeft, Bluetooth, BluetoothOff, Loader2, X, CheckCircle2,
  Activity, ChevronDown, ChevronUp,
} from "lucide-react";
import { useCollar } from "@/context/CollarBridgeContext";

const SHORT_LABELS: Record<string, string> = {
  "011B1508-2212-4DBF-9E2B-6722A4552380": "heartbeat",
  "011B1510-2212-4DBF-9E2B-6722A4552380": "status",
  "011B1511-2212-4DBF-9E2B-6722A4552380": "log",
  "011B1514-2212-4DBF-9E2B-6722A4552380": "ch14",
  "011B1520-2212-4DBF-9E2B-6722A4552380": "ch20",
};

function relativeAgo(ms: number): string {
  if (ms < 1000) return "just now";
  if (ms < 60_000)    return `${Math.round(ms / 1000)} s ago`;
  if (ms < 3_600_000) return `${Math.round(ms / 60_000)} min ago`;
  return `${Math.round(ms / 3_600_000)} h ago`;
}

export function TrackerScreen() {
  const { id: petId } = useParams<{ id: string }>();
  const {
    state, identity, errorMsg, packets, counts,
    totalPackets, uploadedTotal,
    autoUpload, setAutoUpload,
    autoConnect, setAutoConnect, hasPaired,
    activePetId, setActivePetId,
    connect, disconnect,
  } = useCollar();

  // Hidden by default — re-veal for support / debugging.
  const [showDiagnostics, setShowDiagnostics] = useState(false);

  // Pet attribution for backgrounded uploads — same as before.
  useEffect(() => {
    if (petId && petId !== activePetId) setActivePetId(petId);
  }, [petId, activePetId, setActivePetId]);

  // Derive a single friendly "last reading" timestamp from the most recent
  // packet across all channels.  Ticks every second so the relative time
  // stays current while the user watches.
  const [nowTick, setNowTick] = useState(Date.now());
  useEffect(() => {
    if (state !== "connected") return;
    const t = window.setInterval(() => setNowTick(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, [state]);

  const lastPacket = packets[0];
  const lastReading = useMemo(() => {
    if (!lastPacket) return null;
    return {
      msAgo: nowTick - lastPacket.receivedAt,
      label: relativeAgo(nowTick - lastPacket.receivedAt),
    };
  }, [lastPacket, nowTick]);

  return (
    <main className="px-5 pt-8 pb-12 max-w-md mx-auto">
      <Link
        to={petId ? `/pets/${petId}` : "/pets"}
        className="inline-flex items-center gap-0.5 -ml-1 mb-5 h-8 pr-2 pl-1 rounded-lg text-sm font-medium text-primary"
      >
        <ChevronLeft size={16} strokeWidth={2.5} />
        Pet
      </Link>

      <p className="text-[10px] tracking-[0.22em] uppercase font-medium text-muted-foreground">
        Optional · Live augment
      </p>
      <h1 className="font-display leading-[0.95] tracking-[-0.015em] mt-1 mb-3" style={{ fontSize: 40 }}>
        Tracker
      </h1>
      <p className="text-sm text-muted-foreground mb-6 max-w-[36ch] leading-relaxed">
        Your dashboard, Pulse and Whereabouts already work without this — the
        collar syncs to the cloud every 5 minutes on its own. Connect over
        Bluetooth here when you want sub-minute streaming readings (vet visits,
        debugging an unusual session, or just watching live).
      </p>

      {/* ── Connection card ────────────────────────────────────────── */}
      <section
        className="rounded-2xl border border-border/60 bg-card p-5 mb-4"
        style={{ boxShadow: "var(--shadow-card-soft)" }}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
              Status
            </p>
            <p className="text-base font-medium">
              {state === "idle"        && "Not connected"}
              {state === "scanning"    && "Scanning for collar…"}
              {state === "connecting"  && "Connecting…"}
              {state === "connected"   && (identity?.name ?? "Connected")}
              {state === "disconnected" && (identity ? `Disconnected from ${identity.name}` : "Disconnected")}
              {state === "error"       && "Error"}
            </p>
            {identity && state === "connected" && (
              <p className="text-xs text-muted-foreground mt-1 truncate">
                {identity.manufacturer ?? "Invoxia"} · {identity.modelNumber ?? "LWT6"}
                {identity.hardwareRev ? ` · ${identity.hardwareRev}` : ""}
              </p>
            )}
          </div>
          {state === "connected" ? (
            <Bluetooth className="text-emerald-600 shrink-0" size={20} />
          ) : (state === "scanning" || state === "connecting") ? (
            <Loader2 className="animate-spin text-muted-foreground shrink-0" size={20} />
          ) : (
            <BluetoothOff className="text-muted-foreground shrink-0" size={20} />
          )}
        </div>

        {errorMsg && (
          <div className="mt-3 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {errorMsg}
          </div>
        )}

        <div className="mt-4 flex gap-2">
          {state === "connected" ? (
            <button
              onClick={disconnect}
              className="press rounded-lg bg-muted px-4 py-2 text-sm font-medium"
            >
              <X size={16} className="inline-block mr-1 -mt-0.5" /> Disconnect
            </button>
          ) : (
            <button
              onClick={connect}
              disabled={state === "scanning" || state === "connecting"}
              className="press rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
            >
              <Bluetooth size={16} className="inline-block mr-1 -mt-0.5" /> Connect to collar
            </button>
          )}
          <label className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={autoUpload}
              onChange={(e) => setAutoUpload(e.target.checked)}
            />
            Auto-upload
          </label>
        </div>

        {state === "connected" && (
          <div className="mt-3 flex items-center gap-2 text-xs text-emerald-700">
            <CheckCircle2 size={12} />
            Connection stays alive while you use other screens in this app.
          </div>
        )}

        {hasPaired && (
          <label className="mt-4 flex items-start gap-2.5 text-xs text-muted-foreground border-t border-border/60 pt-3 cursor-pointer">
            <input
              type="checkbox"
              checked={autoConnect}
              onChange={(e) => setAutoConnect(e.target.checked)}
              className="mt-0.5 size-4 rounded border-2 border-border accent-primary cursor-pointer shrink-0"
            />
            <span className="flex-1">
              <span className="block text-foreground font-medium text-[13px] leading-tight">
                Reconnect automatically when nearby
              </span>
              <span className="block mt-0.5 leading-relaxed">
                On launch, silently scan for this collar and connect if it's in range. Your cloud sync runs regardless.
              </span>
            </span>
          </label>
        )}
      </section>

      {/* ── Friendly capture summary ──────────────────────────────────
          Replaces the old "Live channels + Recent packets" debug walls.
          One line tells the owner everything they need: am I capturing
          right now, when was the last reading, and is upload current. */}
      {(state === "connected" || totalPackets > 0) && (
        <section
          className="rounded-2xl border border-border/60 bg-card p-5 mb-4"
          style={{ boxShadow: "var(--shadow-card-soft)" }}
        >
          <div className="flex items-center gap-3 mb-3">
            <span
              className={`relative inline-flex size-9 rounded-xl items-center justify-center ${
                state === "connected" ? "bg-emerald-50 text-emerald-700" : "bg-muted text-muted-foreground"
              }`}
              aria-hidden="true"
            >
              <Activity size={16} strokeWidth={2.2} />
              {state === "connected" && (
                <span className="absolute -inset-1 rounded-2xl ring-2 ring-emerald-400/30 animate-ping" />
              )}
            </span>
            <div className="flex-1">
              <p className="text-[10px] tracking-[0.22em] uppercase font-medium text-muted-foreground">
                {state === "connected" ? "Capturing live" : "Paused"}
              </p>
              <p className="font-semibold text-[15px] leading-tight mt-0.5">
                {state === "connected"
                  ? (lastReading ? `Last reading ${lastReading.label}` : "Awaiting first reading")
                  : `${totalPackets.toLocaleString()} readings this session`}
              </p>
            </div>
          </div>

          {/* Tabular numerals strip — readings vs uploaded */}
          <div className="grid grid-cols-2 gap-4 pt-3 border-t border-border/60">
            <div>
              <p className="text-[9px] uppercase tracking-[0.20em] font-semibold text-muted-foreground">
                Captured
              </p>
              <p className="text-[15px] font-semibold tabular-nums leading-tight mt-1">
                {totalPackets.toLocaleString()}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[9px] uppercase tracking-[0.20em] font-semibold text-muted-foreground">
                Synced
              </p>
              <p className="text-[15px] font-semibold tabular-nums leading-tight mt-1">
                {uploadedTotal.toLocaleString()}
                {totalPackets > 0 && uploadedTotal < totalPackets && (
                  <span className="text-xs text-amber-700 font-medium ml-1.5">
                    +{(totalPackets - uploadedTotal).toLocaleString()} queued
                  </span>
                )}
              </p>
            </div>
          </div>
        </section>
      )}

      {/* ── Diagnostics (collapsed by default) ─────────────────────────
          The engineer-grade detail (BLE characteristic UUIDs, hex packet
          dumps).  Hidden behind a small disclosure so it's still
          reachable for support but invisible to the regular owner. */}
      {(state === "connected" || totalPackets > 0) && (
        <details
          className="rounded-2xl border border-border/60 bg-card overflow-hidden"
          style={{ boxShadow: "var(--shadow-card-soft)" }}
          onToggle={(e) => setShowDiagnostics((e.target as HTMLDetailsElement).open)}
        >
          <summary className="press flex items-center justify-between gap-2 px-5 py-3.5 cursor-pointer list-none">
            <span className="text-[10px] tracking-[0.22em] uppercase font-semibold text-muted-foreground">
              Diagnostics
            </span>
            {showDiagnostics
              ? <ChevronUp size={15} className="text-muted-foreground" />
              : <ChevronDown size={15} className="text-muted-foreground" />}
          </summary>

          <div className="px-5 pb-5 border-t border-border/60 pt-4">
            <p className="text-[11px] text-muted-foreground leading-relaxed mb-4">
              Raw BLE characteristic channels and the rolling packet tail. Useful for
              support if the collar isn't reporting readings.
            </p>

            {/* Per-channel counters */}
            <ul className="space-y-1.5 text-sm mb-5">
              {Object.entries(SHORT_LABELS).map(([uuid, label]) => (
                <li key={uuid} className="flex items-center justify-between">
                  <span className="text-muted-foreground">{label}</span>
                  <span className="font-mono tabular-nums">{counts[uuid] ?? 0}</span>
                </li>
              ))}
            </ul>

            {/* Recent packet tail */}
            <p className="text-[10px] tracking-[0.22em] uppercase font-semibold text-muted-foreground mb-2">
              Recent packets
            </p>
            {packets.length === 0 ? (
              <p className="text-[11px] text-muted-foreground">
                Nothing captured yet.
              </p>
            ) : (
              <ul className="space-y-1 text-[11px] font-mono max-h-64 overflow-y-auto">
                {packets.slice(0, 30).map((p, i) => (
                  <li key={`${p.receivedAt}-${i}`} className="flex gap-2">
                    <span className="text-muted-foreground shrink-0">
                      {new Date(p.receivedAt).toLocaleTimeString("en-GB", { hour12: false })}
                    </span>
                    <span className="text-muted-foreground shrink-0 w-16">
                      {SHORT_LABELS[p.charUuid] ?? p.charUuid.slice(0, 8)}
                    </span>
                    <span className="truncate">{p.hex || "(empty)"}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </details>
      )}

      <p className="mt-6 text-xs text-muted-foreground leading-relaxed">
        Heart rate, breath rate, and HRV only flow during the collar's active
        health sessions (typically a few minutes per day). Between sessions
        the collar sends only quiet heartbeat pings.
      </p>
    </main>
  );
}
