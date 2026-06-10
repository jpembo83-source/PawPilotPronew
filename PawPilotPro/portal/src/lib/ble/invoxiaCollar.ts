/**
 * Invoxia Biotracker (LWT6) BLE bridge.
 *
 * Maps observed via mitmproxy + LightBlue discovery (2026-05-30):
 *   - Device name: LWT6_<serial>  (e.g. LWT6_115315)
 *   - Manufacturer Name String:   Invoxia
 *   - Model Number:               LWT6
 *   - No pairing required for connect; multi-subscriber supported.
 *
 * Custom service that carries data ("data service"):
 *   011B1500-2212-4DBF-9E2B-6722A4552380
 *     0x...1508  notify         — heartbeat / empty pings
 *     0x...1510  notify, read   — short status frames (e.g. 0xC008 idle)
 *     0x...1511  notify, read   — firmware debug log stream (ASCII inside hex frames)
 *     0x...1514  notify, read   — quiet between health sessions
 *     0x...1520  notify, read   — quiet between health sessions
 *     0x...1506  read, write    — control / command channel
 *
 * The collar only streams biometric data during active health sessions
 * (per Invoxia API: "3 health sessions totaling 6 minutes today"). This
 * bridge subscribes to all notify chars passively and forwards every
 * packet to Supabase for later decoding. No assumptions about which
 * channel is which kind of biometric — let the data shape tell us.
 */

import { BleClient, type ScanResult } from "@capacitor-community/bluetooth-le";

export const COLLAR_NAME_PREFIX = "LWT6_";

export const DATA_SERVICE = "011B1500-2212-4DBF-9E2B-6722A4552380";

export const NOTIFY_CHARS = [
  "011B1508-2212-4DBF-9E2B-6722A4552380", // heartbeat
  "011B1510-2212-4DBF-9E2B-6722A4552380", // status frames
  "011B1511-2212-4DBF-9E2B-6722A4552380", // debug logs
  "011B1514-2212-4DBF-9E2B-6722A4552380", // (quiet)
  "011B1520-2212-4DBF-9E2B-6722A4552380", // (quiet)
] as const;

/** Standard Bluetooth SIG Device Information Service — readable identity. */
export const DEVICE_INFO_SERVICE = "0000180a-0000-1000-8000-00805f9b34fb";
export const DEVICE_INFO = {
  modelNumber:   "00002a24-0000-1000-8000-00805f9b34fb",
  manufacturer:  "00002a29-0000-1000-8000-00805f9b34fb",
  hardwareRev:   "00002a27-0000-1000-8000-00805f9b34fb",
  systemId:      "00002a23-0000-1000-8000-00805f9b34fb",
};

export interface CollarPacket {
  /** UUID of the source characteristic (one of NOTIFY_CHARS) */
  charUuid: string;
  /** Hex-encoded raw payload */
  hex: string;
  /** Local timestamp in ms */
  receivedAt: number;
}

export interface CollarIdentity {
  deviceId: string;        // BLE address / iOS-side UUID
  name: string;            // e.g. "LWT6_115315"
  serial: string | null;   // parsed from name suffix
  modelNumber?: string;    // e.g. "LWT6"
  manufacturer?: string;   // e.g. "Invoxia"
  hardwareRev?: string;    // e.g. "LWT6V2"
}

export interface CollarBridgeHandlers {
  onPacket: (p: CollarPacket) => void;
  onState: (state: "scanning" | "connecting" | "connected" | "disconnected" | "error", info?: unknown) => void;
}

/**
 * Wraps the BLE plugin in a single-collar bridge.
 * Lifecycle:
 *   await bridge.start()      — initialize + request permissions
 *   await bridge.discover()   — scan for nearby LWT6_* devices, returns candidates
 *   await bridge.connect(id)  — connect, identify, subscribe to all notify chars
 *   await bridge.disconnect()
 */
export class InvoxiaCollarBridge {
  private deviceId: string | null = null;
  private connected = false;

  constructor(private readonly handlers: CollarBridgeHandlers) {}

  async start(): Promise<void> {
    // Initialize triggers iOS permission prompt if not granted.
    await BleClient.initialize({ androidNeverForLocation: true });
  }

  /**
   * Scan for ~10 seconds, return collars sorted by RSSI (closest first).
   *
   * NOTE: We do NOT filter by service UUID. The LWT6 advertises an
   * unrelated 'beacon' service (F27A4900-…) — the data service we want
   * (011B1500-…) is only exposed AFTER connecting. iOS also marks the
   * device 'Not Connectable' in advertisement packets when another app
   * already holds the connection, which would otherwise hide it from a
   * service-filtered scan. We match by name prefix instead.
   */
  async discover(seconds = 10): Promise<ScanResult[]> {
    this.handlers.onState("scanning");
    const seen = new Map<string, ScanResult>();
    let totalSeen = 0;
    await BleClient.requestLEScan(
      { allowDuplicates: true },
      (r) => {
        totalSeen++;
        const name = r.localName ?? r.device.name ?? "";
        if (name.startsWith(COLLAR_NAME_PREFIX)) {
          // Keep the strongest sighting per device
          const prior = seen.get(r.device.deviceId);
          if (!prior || (r.rssi ?? -99) > (prior.rssi ?? -99)) {
            seen.set(r.device.deviceId, r);
          }
        }
      },
    );
    await new Promise((res) => setTimeout(res, seconds * 1000));
    await BleClient.stopLEScan();
    console.log(`[invoxia-ble] scan: ${totalSeen} ads, ${seen.size} LWT6 collar(s)`);
    return [...seen.values()].sort((a, b) => (b.rssi ?? -99) - (a.rssi ?? -99));
  }

  async connect(
    deviceId: string,
    advertisedName: string | undefined,
    onDisconnect?: () => void,
  ): Promise<CollarIdentity> {
    this.handlers.onState("connecting");
    await BleClient.connect(deviceId, () => {
      this.connected = false;
      this.handlers.onState("disconnected");
      onDisconnect?.();
    });
    this.deviceId = deviceId;
    this.connected = true;
    const identity = await this.readIdentity(deviceId, advertisedName);
    await this.subscribeAll(deviceId);
    this.handlers.onState("connected", identity);
    return identity;
  }

  private async readIdentity(
    deviceId: string,
    advertisedName: string | undefined,
  ): Promise<CollarIdentity> {
    const dec = new TextDecoder();
    const safeRead = async (svc: string, char: string): Promise<string | undefined> => {
      try {
        const v = await BleClient.read(deviceId, svc, char);
        return dec.decode(v.buffer).replace(/\0+$/, "");
      } catch {
        return undefined;
      }
    };
    const [modelNumber, manufacturer, hardwareRev] = await Promise.all([
      safeRead(DEVICE_INFO_SERVICE, DEVICE_INFO.modelNumber),
      safeRead(DEVICE_INFO_SERVICE, DEVICE_INFO.manufacturer),
      safeRead(DEVICE_INFO_SERVICE, DEVICE_INFO.hardwareRev),
    ]);

    const name = advertisedName ?? "";
    const serial = name.startsWith(COLLAR_NAME_PREFIX)
      ? name.slice(COLLAR_NAME_PREFIX.length)
      : null;

    return { deviceId, name, serial, modelNumber, manufacturer, hardwareRev };
  }

  private async subscribeAll(deviceId: string): Promise<void> {
    for (const charUuid of NOTIFY_CHARS) {
      try {
        await BleClient.startNotifications(deviceId, DATA_SERVICE, charUuid, (value) => {
          const bytes = new Uint8Array(value.buffer);
          const hex = bytesToHex(bytes);
          this.handlers.onPacket({ charUuid, hex, receivedAt: Date.now() });
        });
      } catch (err) {
        console.warn(`[invoxia-ble] subscribe ${charUuid} failed:`, err);
        this.handlers.onState("error", { charUuid, err: String(err) });
      }
    }
  }

  async disconnect(): Promise<void> {
    if (!this.deviceId) return;
    try {
      for (const charUuid of NOTIFY_CHARS) {
        await BleClient.stopNotifications(this.deviceId, DATA_SERVICE, charUuid).catch(() => {});
      }
      await BleClient.disconnect(this.deviceId);
    } finally {
      this.deviceId = null;
      this.connected = false;
      this.handlers.onState("disconnected");
    }
  }

  isConnected(): boolean { return this.connected; }
}

function bytesToHex(bytes: Uint8Array): string {
  let out = "";
  for (let i = 0; i < bytes.length; i++) {
    out += (bytes[i] ?? 0).toString(16).padStart(2, "0");
  }
  return out;
}
