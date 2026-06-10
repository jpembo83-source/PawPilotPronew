/**
 * Runtime branding — pulls the live org Brand Configuration (name, colors, logo,
 * email sender) from the backend and applies it as CSS custom properties + a
 * tiny store consumed by LoginScreen / HomeScreen. Cached in localStorage so the
 * very first paint (login, pre-auth) is already correctly themed.
 */
import { create } from "zustand";

export interface Branding {
  name: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
  logoUrl: string | null;
  emailSenderName: string | null;
}

const CACHE_KEY = "pawpilot.portal.branding";

const empty: Branding = {
  name: null,
  primaryColor: null,
  secondaryColor: null,
  logoUrl: null,
  emailSenderName: null,
};

interface BrandingStore {
  brand: Branding;
  setBrand: (b: Branding) => void;
}
export const useBranding = create<BrandingStore>((set) => ({
  brand: empty,
  setBrand: (b) => set({ brand: b }),
}));

/** YIQ-based contrast picker: dark text on bright bg, white text on dark bg. */
function readableForeground(hex: string): string {
  const c = hex.replace("#", "");
  if (c.length !== 6) return "#FFFFFF";
  const r = parseInt(c.slice(0, 2), 16);
  const g = parseInt(c.slice(2, 4), 16);
  const b = parseInt(c.slice(4, 6), 16);
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq >= 140 ? "#1C1916" : "#FFFFFF";
}

function isHex(v: unknown): v is string {
  return typeof v === "string" && /^#[0-9A-Fa-f]{6}$/.test(v);
}

/** Apply brand colours as CSS custom properties on :root. */
export function applyBranding(b: Branding): void {
  const root = document.documentElement.style;
  if (isHex(b.primaryColor)) {
    root.setProperty("--primary", b.primaryColor);
    root.setProperty("--primary-foreground", readableForeground(b.primaryColor));
    root.setProperty("--ring", b.primaryColor);
  }
  if (isHex(b.secondaryColor)) {
    root.setProperty("--secondary", b.secondaryColor);
    root.setProperty("--secondary-foreground", readableForeground(b.secondaryColor));
    root.setProperty("--accent", b.secondaryColor);
    root.setProperty("--accent-foreground", readableForeground(b.secondaryColor));
  }
}

/** Read whatever is cached and apply it synchronously — call this before React renders. */
export function applyCachedBranding(): void {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return;
    const cached = JSON.parse(raw) as Branding;
    applyBranding(cached);
    useBranding.getState().setBrand({ ...empty, ...cached });
  } catch {
    /* ignore */
  }
}

/** Fetch the live brand from the backend, apply it, cache it. Public endpoint (no auth). */
export async function fetchBranding(): Promise<void> {
  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (!projectId || !anonKey) return;
  try {
    const res = await fetch(
      `https://${projectId}.supabase.co/functions/v1/make-server-fc003b23/portal/branding`,
      { headers: { Authorization: `Bearer ${anonKey}` } },
    );
    if (!res.ok) return;
    const fresh = (await res.json()) as Branding;
    applyBranding(fresh);
    useBranding.getState().setBrand({ ...empty, ...fresh });
    localStorage.setItem(CACHE_KEY, JSON.stringify(fresh));
  } catch {
    /* ignore — keep cached */
  }
}

export function initBranding(): void {
  applyCachedBranding();
  // Fire-and-forget; updates the page when it lands.
  void fetchBranding();
}
