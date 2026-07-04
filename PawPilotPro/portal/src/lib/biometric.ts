import { Capacitor } from "@capacitor/core";
import { NativeBiometric } from "@capgo/capacitor-native-biometric";
import { getSupabase } from "./supabase";

/**
 * Biometric quick unlock.
 *
 * Security model (documented in the PR): after a successful password login
 * the user may opt in to Face ID / fingerprint unlock. We store ONLY the
 * Supabase refresh token in the platform secure store (iOS Keychain /
 * Android Keystore via the plugin) — never the password. Reads are gated
 * by an explicit verifyIdentity() biometric prompt. Supabase rotates
 * refresh tokens on every use, so the stored token is overwritten on each
 * TOKEN_REFRESHED event (silent write — hardware access-controlled storage
 * would prompt on Android writes, which rules it out for rotation).
 * Any failure path (prompt cancelled, token revoked/stale, keychain wiped)
 * cleans up and falls back to the password form.
 */

const SERVER = "portal.pawpilotpro.session";
const ENABLED_KEY = "portal.biometric.enabled";
const OFFERED_KEY = "portal.biometric.offered";

export function isNativeApp(): boolean {
  return Capacitor.isNativePlatform();
}

/** Device has usable biometrics (native shell only). */
export async function biometricSupported(): Promise<boolean> {
  if (!isNativeApp()) return false;
  try {
    return (await NativeBiometric.isAvailable()).isAvailable;
  } catch {
    return false;
  }
}

/** User has opted in on this device. */
export function biometricEnabled(): boolean {
  return isNativeApp() && localStorage.getItem(ENABLED_KEY) === "1";
}

/** The one-time post-login offer has already been shown on this device. */
export function biometricOffered(): boolean {
  return localStorage.getItem(OFFERED_KEY) === "1";
}

export function markBiometricOffered(): void {
  localStorage.setItem(OFFERED_KEY, "1");
}

/**
 * Opt in: verify user presence, then store the current session's refresh
 * token in the secure store. Throws if there is no session or the prompt
 * is cancelled.
 */
export async function enableBiometric(): Promise<void> {
  const { data } = await getSupabase().auth.getSession();
  const session = data.session;
  if (!session?.refresh_token) throw new Error("No active session");
  await NativeBiometric.verifyIdentity({
    reason: "Confirm it's you to turn on quick unlock",
    title: "Quick unlock",
  });
  await NativeBiometric.setCredentials({
    server: SERVER,
    username: session.user.email ?? "portal-user",
    password: session.refresh_token,
  });
  localStorage.setItem(ENABLED_KEY, "1");
}

/** Opt out: clear the flag and delete the stored token. */
export async function disableBiometric(): Promise<void> {
  localStorage.removeItem(ENABLED_KEY);
  try {
    await NativeBiometric.deleteCredentials({ server: SERVER });
  } catch {
    // Nothing stored — fine.
  }
}

/**
 * Biometric fast-path on the login screen: prompt, read the stored refresh
 * token, exchange it for a fresh session. On any failure the stored token
 * is wiped and the flag cleared so the UI falls back to password login
 * without retry loops. Throws with a user-safe message.
 */
export async function biometricLogin(): Promise<void> {
  try {
    await NativeBiometric.verifyIdentity({
      reason: "Unlock your pet portal",
      title: "Unlock",
    });
  } catch {
    // Cancelled or failed the prompt — keep enrolment, just fall back.
    throw new Error("cancelled");
  }

  let refreshToken: string;
  try {
    const creds = await NativeBiometric.getCredentials({ server: SERVER });
    refreshToken = creds.password;
  } catch {
    await disableBiometric();
    throw new Error("Quick unlock needs setting up again — please sign in with your password.");
  }

  const { data, error } = await getSupabase().auth.refreshSession({
    refresh_token: refreshToken,
  });
  if (error || !data.session) {
    // Token revoked, rotated away underneath us, or expired.
    await disableBiometric();
    throw new Error("Quick unlock has expired — please sign in with your password.");
  }
  // Rotation: persist the replacement token immediately.
  await storeRefreshToken(data.session.refresh_token, data.session.user.email);
}

async function storeRefreshToken(token: string, email?: string | null): Promise<void> {
  try {
    await NativeBiometric.setCredentials({
      server: SERVER,
      username: email ?? "portal-user",
      password: token,
    });
  } catch {
    // Secure store unavailable — next biometric login will fall back cleanly.
  }
}

let syncStarted = false;

/**
 * Keep the stored refresh token current. Supabase rotates the refresh token
 * on every refresh; without this, the stored copy goes stale within an hour
 * of normal app use and every biometric unlock would fail. Registered once
 * from AuthProvider; no-op on web builds or when the user hasn't opted in.
 */
export function initBiometricTokenSync(): void {
  if (syncStarted || !isNativeApp()) return;
  syncStarted = true;
  getSupabase().auth.onAuthStateChange((event, session) => {
    if (!biometricEnabled()) return;
    if ((event === "TOKEN_REFRESHED" || event === "SIGNED_IN") && session?.refresh_token) {
      void storeRefreshToken(session.refresh_token, session.user.email);
    }
    if (event === "SIGNED_OUT") {
      void disableBiometric();
    }
  });
}
