/**
 * Global Invoxia collar BLE bridge — survives navigation across screens.
 *
 * Mounted at the App root so the BLE connection, the packet stream, and the
 * Supabase auto-upload loop keep running even when the user leaves the
 * Tracker screen. The screen itself becomes a viewer/controller.
 *
 * Lifecycle:
 *   App mounts → bridge instantiated lazily on first connect
 *   user navigates Tracker → Home → Pets → Tracker → connection persists
 *   user logs out / app closed → cleanup
 */
import {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
  type ReactNode,
} from "react";
import {
  InvoxiaCollarBridge,
  type CollarIdentity,
  type CollarPacket,
} from "@/lib/ble/invoxiaCollar";
import { getPortalApi } from "@/lib/api";

type ConnState = "idle" | "scanning" | "connecting" | "connected" | "disconnected" | "error";

interface CollarBridgeContextValue {
  state: ConnState;
  identity: CollarIdentity | null;
  errorMsg: string | null;
  packets: CollarPacket[];
  counts: Record<string, number>;
  uploadedTotal: number;
  totalPackets: number;
  autoUpload: boolean;
  setAutoUpload: (v: boolean) => void;
  autoConnect: boolean;
  setAutoConnect: (v: boolean) => void;
  /** has this provider ever stored a "last device" — i.e. is auto-connect possible? */
  hasPaired: boolean;
  activePetId: string | null;
  setActivePetId: (id: string | null) => void;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  flushUpload: () => Promise<void>;
}

const Ctx = createContext<CollarBridgeContextValue | null>(null);

const UPLOAD_BATCH = 200;
const UPLOAD_FLUSH_MS = 10_000;
const PACKET_TAIL = 300;

// ── Persistence keys ────────────────────────────────────────────────
const LAST_DEVICE_KEY  = "ppp:bridge:lastDevice:v1";
const AUTO_CONNECT_KEY = "ppp:bridge:autoConnect:v1";
const LAST_DEVICE_TTL_MS = 60 * 86_400_000; // 60 days

interface LastDevice {
  deviceId: string;
  name: string | null;
  at: number;
}

function readLastDevice(): LastDevice | null {
  try {
    const raw = localStorage.getItem(LAST_DEVICE_KEY);
    if (!raw) return null;
    const d = JSON.parse(raw) as LastDevice;
    if (!d.deviceId) return null;
    return d;
  } catch {
    return null;
  }
}

function writeLastDevice(d: LastDevice): void {
  try { localStorage.setItem(LAST_DEVICE_KEY, JSON.stringify(d)); } catch {}
}

export function CollarBridgeProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ConnState>("idle");
  const [identity, setIdentity] = useState<CollarIdentity | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [packets, setPackets] = useState<CollarPacket[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [uploadedTotal, setUploadedTotal] = useState(0);
  const [autoUpload, setAutoUpload] = useState(true);
  const [autoConnect, setAutoConnectState] = useState<boolean>(() => {
    try { return localStorage.getItem(AUTO_CONNECT_KEY) !== "false"; }
    catch { return true; }
  });
  const [hasPaired, setHasPaired] = useState<boolean>(() => readLastDevice() != null);
  const [activePetId, setActivePetId] = useState<string | null>(null);

  const bridgeRef = useRef<InvoxiaCollarBridge | null>(null);
  const queueRef  = useRef<CollarPacket[]>([]);
  const flushTimerRef = useRef<number | null>(null);
  const activePetIdRef = useRef<string | null>(null);
  const autoUploadRef = useRef(true);

  // Keep refs in sync (interval closure reads them)
  useEffect(() => { activePetIdRef.current = activePetId; }, [activePetId]);
  useEffect(() => { autoUploadRef.current  = autoUpload;  }, [autoUpload]);

  const setAutoConnect = useCallback((v: boolean) => {
    setAutoConnectState(v);
    try { localStorage.setItem(AUTO_CONNECT_KEY, String(v)); } catch {}
  }, []);

  function ensureBridge(): InvoxiaCollarBridge {
    if (bridgeRef.current) return bridgeRef.current;
    const bridge = new InvoxiaCollarBridge({
      onPacket: (p) => {
        queueRef.current.push(p);
        setPackets((prev) => {
          const next = [p, ...prev];
          if (next.length > PACKET_TAIL) next.length = PACKET_TAIL;
          return next;
        });
        setCounts((prev) => ({ ...prev, [p.charUuid]: (prev[p.charUuid] ?? 0) + 1 }));
      },
      onState: (s, info) => {
        setState(s);
        if (s === "connected" && info && typeof info === "object" && "deviceId" in info) {
          const ident = info as CollarIdentity;
          setIdentity(ident);
          setErrorMsg(null);
          // Remember this collar for next-launch silent auto-connect.
          writeLastDevice({
            deviceId: ident.deviceId,
            name: ident.name ?? null,
            at: Date.now(),
          });
          setHasPaired(true);
        }
        if (s === "disconnected") {
          // Note: we keep identity around so the UI can show "Last connected to LWT6_115315"
        }
        if (s === "error" && info) setErrorMsg(JSON.stringify(info));
      },
    });
    bridgeRef.current = bridge;
    return bridge;
  }

  // ── Silent auto-connect on mount ──────────────────────────────────
  // If a previous session has stored a collar deviceId AND auto-connect is
  // enabled, attempt a quick background scan and connect.  Stays silent on
  // failure (no error toast, no UI noise) — the user can still tap Connect
  // manually on the Tracker screen.  Cloud sync remains the source of truth.
  useEffect(() => {
    if (!autoConnect) return;
    const last = readLastDevice();
    if (!last) return;
    if (Date.now() - last.at > LAST_DEVICE_TTL_MS) return;

    let cancelled = false;
    const t = window.setTimeout(async () => {
      const bridge = ensureBridge();
      try {
        await bridge.start();
        // Short scan window — we don't want to drain the battery.
        const candidates = await bridge.discover(8);
        if (cancelled) return;
        const match = candidates.find((c) => c.device.deviceId === last.deviceId);
        if (!match) {
          // Not in range — give up quietly, keep state idle.
          return;
        }
        const advName = match.localName ?? match.device.name ?? last.name ?? undefined;
        console.log(`[auto-connect] found cached collar nearby (rssi=${match.rssi}), connecting`);
        await bridge.connect(match.device.deviceId, advName);
      } catch (e) {
        // Stay silent — auto-connect is best-effort.
        console.log("[auto-connect] silent attempt failed:", (e as any)?.message ?? e);
      }
    }, 1500); // small initial delay so the app shell can paint first

    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // mount only

  // Auto-upload loop — runs ONCE for the lifetime of the provider
  useEffect(() => {
    flushTimerRef.current = window.setInterval(async () => {
      if (!autoUploadRef.current) return;
      if (!activePetIdRef.current) return;
      if (queueRef.current.length === 0) return;
      const batch = queueRef.current.splice(0, UPLOAD_BATCH);
      try {
        await getPortalApi().post(
          `/portal/pets/${activePetIdRef.current}/tracker/ble`,
          {
            device_serial: identity?.serial ?? null,
            device_name: identity?.name ?? null,
            packets: batch.map((p) => ({
              char: p.charUuid,
              hex: p.hex,
              at: p.receivedAt,
            })),
          },
        );
        setUploadedTotal((n) => n + batch.length);
      } catch (e) {
        console.warn("[collar-bridge] auto-upload failed, requeueing", e);
        queueRef.current.unshift(...batch);
      }
    }, UPLOAD_FLUSH_MS);
    return () => {
      if (flushTimerRef.current) window.clearInterval(flushTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // identity captured via ref-pattern through bridgeRef when changed; safe to omit

  const connect = useCallback(async () => {
    const bridge = ensureBridge();
    setErrorMsg(null);
    try {
      await bridge.start();
      const candidates = await bridge.discover(10);
      if (candidates.length === 0) {
        setErrorMsg(
          "No LWT6 collar advertising nearby. " +
          "If the Invoxia Biotracker app is open on this phone, force-quit it (swipe up from app switcher) and try again — iOS lets one app hold the BLE connection at a time."
        );
        setState("idle");
        return;
      }
      const closest = candidates[0]!;
      const advertisedName = closest.localName ?? closest.device.name ?? undefined;
      console.log(
        `[collar-bridge] connecting to ${advertisedName ?? "(no name)"} id=${closest.device.deviceId} rssi=${closest.rssi}`,
      );
      await bridge.connect(closest.device.deviceId, advertisedName);
    } catch (e: any) {
      console.error("[collar-bridge] connect error", e);
      setErrorMsg(e?.message ?? String(e));
      setState("error");
    }
  }, []);

  const disconnect = useCallback(async () => {
    if (!bridgeRef.current) return;
    await bridgeRef.current.disconnect();
  }, []);

  const flushUpload = useCallback(async () => {
    if (!activePetIdRef.current) return;
    if (queueRef.current.length === 0) return;
    const batch = queueRef.current.splice(0, UPLOAD_BATCH);
    try {
      await getPortalApi().post(
        `/portal/pets/${activePetIdRef.current}/tracker/ble`,
        {
          device_serial: identity?.serial ?? null,
          device_name: identity?.name ?? null,
          packets: batch.map((p) => ({
            char: p.charUuid,
            hex: p.hex,
            at: p.receivedAt,
          })),
        },
      );
      setUploadedTotal((n) => n + batch.length);
    } catch (e) {
      console.warn("[collar-bridge] manual flush failed, requeueing", e);
      queueRef.current.unshift(...batch);
    }
  }, [identity]);

  const totalPackets = useMemo(
    () => Object.values(counts).reduce((a, b) => a + b, 0),
    [counts],
  );

  const value: CollarBridgeContextValue = {
    state, identity, errorMsg, packets, counts, uploadedTotal, totalPackets,
    autoUpload, setAutoUpload,
    autoConnect, setAutoConnect, hasPaired,
    activePetId, setActivePetId,
    connect, disconnect, flushUpload,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCollar(): CollarBridgeContextValue {
  const v = useContext(Ctx);
  if (!v) throw new Error("useCollar must be used inside <CollarBridgeProvider>");
  return v;
}
