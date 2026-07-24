// My Account — self-service account hub for the SIGNED-IN staff user.
// Pure module (no Deno imports) so it is unit-testable under vitest,
// mirroring lib/location_header.ts and lib/pet_photos.ts.
//
// Everything here operates on the AUTHENTICATED user's own record only.
// Security-bearing fields (role, permissions, tenant, locations) are
// server-set in app_metadata and can NEVER pass through these helpers:
// sanitizeProfileUpdate returns only display fields, and prefs are stored
// in a plain user-prefs KV record that grants nothing.

export const AVATAR_SIGNED_URL_TTL_SECONDS = 60 * 30;
export const MAX_AVATAR_BYTES = 8 * 1024 * 1024; // 8MB (same as header images)

const EXT_BY_CONTENT_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export function avatarExt(contentType: unknown): string | null {
  if (typeof contentType !== "string") return null;
  return EXT_BY_CONTENT_TYPE[contentType.toLowerCase()] ?? null;
}

export function validateAvatarUpload(file: {
  type?: unknown;
  size?: unknown;
}): { ok: true; ext: string } | { ok: false; error: string } {
  const ext = avatarExt(file?.type);
  if (!ext) return { ok: false, error: "Photo must be a JPEG, PNG, or WebP image" };
  const size = typeof file?.size === "number" ? file.size : Number.NaN;
  if (!Number.isFinite(size) || size <= 0) return { ok: false, error: "Empty upload" };
  if (size > MAX_AVATAR_BYTES) {
    return { ok: false, error: "Photo must be smaller than 8MB" };
  }
  return { ok: true, ext };
}

/** tenant/{tenantId}/staff-avatars/{userId}.{ext} — ids are UUIDs/slugs;
 *  anything path-shaped is rejected rather than sanitised so a malformed id
 *  can never escape its tenant prefix (mirrors buildHeaderImagePath). */
export function buildAvatarPath(
  tenantId: string,
  userId: string,
  ext: string,
): string | null {
  const safe = (s: unknown): s is string =>
    typeof s === "string" && s.length > 0 && /^[A-Za-z0-9_-]+$/.test(s);
  if (!safe(tenantId) || !safe(userId) || !safe(ext)) return null;
  return `tenant/${tenantId}/staff-avatars/${userId}.${ext}`;
}

// --- KV keys -----------------------------------------------------------

/** The user record the Team Directory reads (Settings → Users & Access). */
export const userProfileKey = (tenantId: string, userId: string) =>
  `user:${tenantId}:profile:${userId}`;

/** Per-user preferences (default location, theme, notification prefs).
 *  Display/UX only — nothing in this record grants access to anything. */
export const userPrefsKey = (tenantId: string, userId: string) =>
  `user_prefs:${tenantId}:${userId}`;

// --- Profile updates ---------------------------------------------------

export interface ProfileUpdate {
  name?: string;
  phone?: string;
}

const PHONE_RE = /^[0-9+()\-\s.]*$/;

/** Allow-list body parser for PATCH /account/profile. Only display fields
 *  survive: `name` and `phone`. Role, permissions, tenant, locations, email
 *  or anything else in the body is silently dropped — those are server-set
 *  (app_metadata) and must never be user-editable here. */
export function sanitizeProfileUpdate(
  body: unknown,
): { ok: true; update: ProfileUpdate } | { ok: false; error: string } {
  const b = body as Record<string, unknown> | null | undefined;
  if (!b || typeof b !== "object") return { ok: false, error: "Invalid body" };

  const update: ProfileUpdate = {};

  if (b.name !== undefined) {
    if (typeof b.name !== "string") return { ok: false, error: "Name must be text" };
    const name = b.name.trim();
    if (name.length < 1) return { ok: false, error: "Name is required" };
    if (name.length > 80) return { ok: false, error: "Name must be 80 characters or fewer" };
    update.name = name;
  }

  if (b.phone !== undefined) {
    if (typeof b.phone !== "string") return { ok: false, error: "Phone must be text" };
    const phone = b.phone.trim();
    if (phone.length > 32) return { ok: false, error: "Phone must be 32 characters or fewer" };
    if (!PHONE_RE.test(phone)) {
      return { ok: false, error: "Phone may only contain digits, spaces, and + ( ) - ." };
    }
    update.phone = phone; // empty string clears the phone
  }

  if (update.name === undefined && update.phone === undefined) {
    return { ok: false, error: "Nothing to update" };
  }
  return { ok: true, update };
}

// --- Password change ---------------------------------------------------

export const MIN_PASSWORD_LENGTH = 8;

export function validatePasswordChange(
  body: unknown,
): { ok: true; currentPassword: string; newPassword: string } | { ok: false; error: string } {
  const b = body as Record<string, unknown> | null | undefined;
  const current = typeof b?.currentPassword === "string" ? b.currentPassword : "";
  const next = typeof b?.newPassword === "string" ? b.newPassword : "";
  if (!current) return { ok: false, error: "Current password is required" };
  if (next.length < MIN_PASSWORD_LENGTH) {
    return { ok: false, error: `New password must be at least ${MIN_PASSWORD_LENGTH} characters` };
  }
  if (next === current) {
    return { ok: false, error: "New password must be different from the current password" };
  }
  return { ok: true, currentPassword: current, newPassword: next };
}

// --- Notification preferences ------------------------------------------

/** Mirrors the feed types in notifications_routes.ts. */
export const STAFF_NOTIFICATION_TYPES = [
  "booking_request",
  "vaccination",
  "incident",
  "message",
] as const;
export type StaffNotificationType = (typeof STAFF_NOTIFICATION_TYPES)[number];

export interface QuietHours {
  enabled: boolean;
  /** "HH:MM" 24h */
  start: string;
  /** "HH:MM" 24h */
  end: string;
}

export type StaffNotificationPrefs = Record<StaffNotificationType, boolean> & {
  quietHours: QuietHours;
};

/** Defaults are ALL ON — safety alerts (incidents) must never be silenced
 *  by default; a user has to opt out explicitly. Mirrors the portal
 *  notificationPrefs pattern (portal_routes.tsx + lib/notify.ts). */
export const DEFAULT_STAFF_NOTIFICATION_PREFS: StaffNotificationPrefs = {
  booking_request: true,
  vaccination: true,
  incident: true,
  message: true,
  quietHours: { enabled: false, start: "22:00", end: "07:00" },
};

const HHMM_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

function normalizeQuietHours(v: unknown): QuietHours {
  const q = v as Record<string, unknown> | null | undefined;
  const d = DEFAULT_STAFF_NOTIFICATION_PREFS.quietHours;
  return {
    enabled: q?.enabled === true,
    start: typeof q?.start === "string" && HHMM_RE.test(q.start) ? q.start : d.start,
    end: typeof q?.end === "string" && HHMM_RE.test(q.end) ? q.end : d.end,
  };
}

/** Merge whatever is stored/sent with the defaults: unknown keys dropped,
 *  missing keys default ON, malformed quiet hours fall back to defaults. */
export function normalizeStaffNotificationPrefs(v: unknown): StaffNotificationPrefs {
  const p = v as Record<string, unknown> | null | undefined;
  const out = { ...DEFAULT_STAFF_NOTIFICATION_PREFS } as StaffNotificationPrefs;
  for (const type of STAFF_NOTIFICATION_TYPES) {
    if (typeof p?.[type] === "boolean") out[type] = p[type] as boolean;
  }
  out.quietHours = normalizeQuietHours(p?.quietHours);
  return out;
}

/** Drop feed items whose type the user has switched off. Unknown types are
 *  kept (fail open for new alert kinds rather than silently hiding them). */
export function filterStaffNotifications<T extends { type: string }>(
  items: T[],
  prefs: StaffNotificationPrefs,
): T[] {
  return items.filter((item) => {
    const enabled = (prefs as Record<string, unknown>)[item.type];
    return enabled !== false;
  });
}

export function parseHHMM(value: string): number | null {
  if (!HHMM_RE.test(value)) return null;
  const [h, m] = value.split(":").map(Number);
  return h * 60 + m;
}

/** True when `minutesOfDay` (0–1439, local to the user) falls inside the
 *  quiet window. Windows may cross midnight (22:00 → 07:00). During quiet
 *  hours the feed still shows items — only the unread badge goes quiet. */
export function isWithinQuietHours(q: QuietHours, minutesOfDay: number): boolean {
  if (!q.enabled) return false;
  const start = parseHHMM(q.start);
  const end = parseHHMM(q.end);
  if (start === null || end === null || start === end) return false;
  if (start < end) return minutesOfDay >= start && minutesOfDay < end;
  return minutesOfDay >= start || minutesOfDay < end; // crosses midnight
}

// --- Account preferences (default location, theme) ----------------------

export const THEME_PREFS = ["light", "dark", "system"] as const;
export type ThemePref = (typeof THEME_PREFS)[number];

export function normalizeThemePref(v: unknown): ThemePref {
  return typeof v === "string" && (THEME_PREFS as readonly string[]).includes(v)
    ? (v as ThemePref)
    : "system";
}

/** 'ALL', a safe location id, or null (no default). Path-shaped or otherwise
 *  malformed ids are rejected outright rather than sanitised. */
export function sanitizeDefaultLocationId(v: unknown): string | null {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v !== "string") return null;
  if (v === "ALL") return "ALL";
  return /^[A-Za-z0-9_-]{1,64}$/.test(v) ? v : null;
}

export interface AccountPrefs {
  defaultLocationId: string | null;
  theme: ThemePref;
  notifications: StaffNotificationPrefs;
}

export const DEFAULT_ACCOUNT_PREFS: AccountPrefs = {
  defaultLocationId: null,
  theme: "system",
  notifications: DEFAULT_STAFF_NOTIFICATION_PREFS,
};

export function normalizeAccountPrefs(v: unknown): AccountPrefs {
  const p = v as Record<string, unknown> | null | undefined;
  return {
    defaultLocationId: sanitizeDefaultLocationId(p?.defaultLocationId),
    theme: normalizeThemePref(p?.theme),
    notifications: normalizeStaffNotificationPrefs(p?.notifications),
  };
}

/** Merge a PUT /account/prefs body over the stored prefs. Only known keys
 *  move; each is normalized independently so a bad field can't corrupt the
 *  rest. Omitted keys keep their stored value. */
export function mergeAccountPrefs(stored: unknown, patch: unknown): AccountPrefs {
  const base = normalizeAccountPrefs(stored);
  const p = patch as Record<string, unknown> | null | undefined;
  if (!p || typeof p !== "object") return base;
  return {
    defaultLocationId:
      "defaultLocationId" in p ? sanitizeDefaultLocationId(p.defaultLocationId) : base.defaultLocationId,
    theme: "theme" in p ? normalizeThemePref(p.theme) : base.theme,
    notifications:
      "notifications" in p
        ? normalizeStaffNotificationPrefs({
            ...base.notifications,
            ...(typeof p.notifications === "object" && p.notifications !== null
              ? p.notifications
              : {}),
          })
        : base.notifications,
  };
}
