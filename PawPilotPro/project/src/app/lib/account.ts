// My Account — pure client-side helpers (no React, no fetch) so the access
// gates and pref logic are unit-testable under vitest, mirroring how
// lib/location_header.ts keeps pure copies of server gates.
//
// The pref shapes MIRROR supabase/functions/server/lib/my_account.ts — the
// server normalizes whatever it stores/returns, these types describe that
// normalized form for the client.

export type ThemePref = 'light' | 'dark' | 'system';

export interface QuietHours {
  enabled: boolean;
  /** "HH:MM" 24h, user-local time */
  start: string;
  end: string;
}

export const STAFF_NOTIFICATION_TYPES = [
  'booking_request',
  'vaccination',
  'incident',
  'message',
] as const;
export type StaffNotificationType = (typeof STAFF_NOTIFICATION_TYPES)[number];

export type StaffNotificationPrefs = Record<StaffNotificationType, boolean> & {
  quietHours: QuietHours;
};

export interface AccountPrefs {
  defaultLocationId: string | null;
  theme: ThemePref;
  notifications: StaffNotificationPrefs;
}

/** Defaults ALL ON — safety alerts (incidents) are never silenced by
 *  default. Mirrors DEFAULT_STAFF_NOTIFICATION_PREFS server-side. */
export const DEFAULT_ACCOUNT_PREFS: AccountPrefs = {
  defaultLocationId: null,
  theme: 'system',
  notifications: {
    booking_request: true,
    vaccination: true,
    incident: true,
    message: true,
    quietHours: { enabled: false, start: '22:00', end: '07:00' },
  },
};

export const NOTIFICATION_TYPE_LABELS: Record<StaffNotificationType, string> = {
  booking_request: 'Booking requests',
  vaccination: 'Vaccination reviews & expiries',
  incident: 'Incidents',
  message: 'Customer messages',
};

/** Team management (Settings → Users & Access) is admin/manager only —
 *  mirrors requirePermission('users', …) server-side. Staff and assistant
 *  managers never see the Team section. */
export function canManageTeam(role: unknown): boolean {
  return role === 'admin' || role === 'manager';
}

/** 'All Locations' as a DEFAULT is an admin-only choice, matching the
 *  sidebar switcher which gates the ALL entry to admins. */
export function canDefaultToAllLocations(role: unknown): boolean {
  return role === 'admin';
}

export interface LocationOption {
  id: string;
  name: string;
}

/** The locations a user may pick as their home/default location: the ones
 *  their account is scoped to, or every tenant location when their scope is
 *  unrestricted ('all' or empty — matching how the sidebar switcher lists). */
export function accessibleLocations(
  user: { locationIds?: string[] } | null | undefined,
  locations: Array<LocationOption | null | undefined>,
): LocationOption[] {
  const present = locations.filter((l): l is LocationOption => l != null);
  const ids = user?.locationIds ?? [];
  if (ids.length === 0 || ids.includes('all')) return present;
  return present.filter((l) => ids.includes(l.id));
}

export const MIN_PASSWORD_LENGTH = 8;

/** Client-side mirror of the server's password validation, plus the confirm
 *  field. Returns a user-facing error, or null when the form is submittable. */
export function validatePasswordForm(form: {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}): string | null {
  if (!form.currentPassword) return 'Enter your current password';
  if (form.newPassword.length < MIN_PASSWORD_LENGTH) {
    return `New password must be at least ${MIN_PASSWORD_LENGTH} characters`;
  }
  if (form.newPassword === form.currentPassword) {
    return 'New password must be different from the current password';
  }
  if (form.newPassword !== form.confirmPassword) return 'Passwords do not match';
  return null;
}

const HHMM_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export function parseHHMM(value: string): number | null {
  if (!HHMM_RE.test(value)) return null;
  const [h, m] = value.split(':').map(Number);
  return h * 60 + m;
}

/** Mirror of the server helper: true when `minutesOfDay` (user-local) falls
 *  inside the quiet window; windows may cross midnight. Quiet hours mute the
 *  bell BADGE only — feed items stay visible. */
export function isWithinQuietHours(q: QuietHours, minutesOfDay: number): boolean {
  if (!q.enabled) return false;
  const start = parseHHMM(q.start);
  const end = parseHHMM(q.end);
  if (start === null || end === null || start === end) return false;
  if (start < end) return minutesOfDay >= start && minutesOfDay < end;
  return minutesOfDay >= start || minutesOfDay < end;
}

/** Whether the `.dark` root class should be on for a theme preference. */
export function resolveIsDark(theme: ThemePref, systemPrefersDark: boolean): boolean {
  if (theme === 'dark') return true;
  if (theme === 'light') return false;
  return systemPrefersDark;
}
