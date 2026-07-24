// My Account (server lib): self-only profile sanitisation, tenant-prefixed
// avatar paths in the PRIVATE tenant-assets bucket, notification prefs with
// safety-first defaults, quiet hours, and theme/default-location prefs.
// Security invariant under test: role/permissions/tenant can NEVER pass
// through a profile update, and a malformed id can never escape its tenant
// prefix.
import { describe, it, expect } from 'vitest';
import {
  buildAvatarPath,
  validateAvatarUpload,
  MAX_AVATAR_BYTES,
  sanitizeProfileUpdate,
  validatePasswordChange,
  DEFAULT_STAFF_NOTIFICATION_PREFS,
  normalizeStaffNotificationPrefs,
  filterStaffNotifications,
  isWithinQuietHours,
  parseHHMM,
  normalizeThemePref,
  sanitizeDefaultLocationId,
  mergeAccountPrefs,
  normalizeAccountPrefs,
  userPrefsKey,
  userProfileKey,
} from '../../supabase/functions/server/lib/my_account.ts';

describe('buildAvatarPath', () => {
  it('builds a tenant-prefixed path under staff-avatars', () => {
    expect(buildAvatarPath('demo-tenant-001', 'user-1', 'jpg')).toBe(
      'tenant/demo-tenant-001/staff-avatars/user-1.jpg'
    );
  });
  it('rejects path-shaped ids outright — no escaping the tenant prefix', () => {
    expect(buildAvatarPath('../other-tenant', 'user-1', 'jpg')).toBeNull();
    expect(buildAvatarPath('t1', '../../etc/passwd', 'jpg')).toBeNull();
    expect(buildAvatarPath('t1', 'user/1', 'jpg')).toBeNull();
    expect(buildAvatarPath('', 'user-1', 'jpg')).toBeNull();
    expect(buildAvatarPath('t1', 'user-1', 'jpg?x=1')).toBeNull();
  });
});

describe('validateAvatarUpload', () => {
  it('accepts jpeg/png/webp under the cap', () => {
    expect(validateAvatarUpload({ type: 'image/jpeg', size: 1000 })).toEqual({ ok: true, ext: 'jpg' });
    expect(validateAvatarUpload({ type: 'image/PNG', size: 1000 })).toEqual({ ok: true, ext: 'png' });
    expect(validateAvatarUpload({ type: 'image/webp', size: 1000 })).toEqual({ ok: true, ext: 'webp' });
  });
  it('rejects other types, empty and oversize files', () => {
    expect(validateAvatarUpload({ type: 'image/gif', size: 1000 }).ok).toBe(false);
    expect(validateAvatarUpload({ type: 'application/pdf', size: 1000 }).ok).toBe(false);
    expect(validateAvatarUpload({ type: 'image/jpeg', size: 0 }).ok).toBe(false);
    expect(validateAvatarUpload({ type: 'image/jpeg', size: MAX_AVATAR_BYTES + 1 }).ok).toBe(false);
  });
});

describe('sanitizeProfileUpdate — the self-edit allow-list', () => {
  it('passes name and phone through, trimmed', () => {
    const r = sanitizeProfileUpdate({ name: '  Jane Doe ', phone: ' 07700 900123 ' });
    expect(r).toEqual({ ok: true, update: { name: 'Jane Doe', phone: '07700 900123' } });
  });
  it('NEVER passes security-bearing fields — role, permissions, tenant, locations', () => {
    const r = sanitizeProfileUpdate({
      name: 'Jane',
      role: 'admin',
      permissions: [{ module: 'settings', action: 'update' }],
      tenant_id: 'other-tenant',
      tenantId: 'other-tenant',
      locationIds: ['all'],
      templateId: 'tpl-admin',
      isActive: false,
      email: 'attacker@example.com',
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.update).toEqual({ name: 'Jane' });
      expect(Object.keys(r.update)).not.toContain('role');
    }
  });
  it('allows clearing phone with an empty string', () => {
    expect(sanitizeProfileUpdate({ phone: '' })).toEqual({ ok: true, update: { phone: '' } });
  });
  it('rejects empty/overlong names, malformed phones, and empty bodies', () => {
    expect(sanitizeProfileUpdate({ name: '   ' }).ok).toBe(false);
    expect(sanitizeProfileUpdate({ name: 'x'.repeat(81) }).ok).toBe(false);
    expect(sanitizeProfileUpdate({ phone: 'call me maybe' }).ok).toBe(false);
    expect(sanitizeProfileUpdate({}).ok).toBe(false);
    expect(sanitizeProfileUpdate(null).ok).toBe(false);
    expect(sanitizeProfileUpdate({ role: 'admin' }).ok).toBe(false); // nothing editable left
  });
});

describe('validatePasswordChange', () => {
  it('requires current password and an 8+ char new password', () => {
    expect(validatePasswordChange({ currentPassword: '', newPassword: 'longenough' }).ok).toBe(false);
    expect(validatePasswordChange({ currentPassword: 'old', newPassword: 'short' }).ok).toBe(false);
    expect(
      validatePasswordChange({ currentPassword: 'old-pass', newPassword: 'new-pass-1' })
    ).toEqual({ ok: true, currentPassword: 'old-pass', newPassword: 'new-pass-1' });
  });
  it('rejects reusing the current password', () => {
    expect(validatePasswordChange({ currentPassword: 'same-pass', newPassword: 'same-pass' }).ok).toBe(false);
  });
});

describe('notification prefs — defaults ON, incidents never silently off', () => {
  it('defaults everything on with quiet hours disabled', () => {
    const p = normalizeStaffNotificationPrefs(undefined);
    expect(p).toEqual(DEFAULT_STAFF_NOTIFICATION_PREFS);
    expect(p.incident).toBe(true);
    expect(p.quietHours.enabled).toBe(false);
  });
  it('merges stored values and drops junk', () => {
    const p = normalizeStaffNotificationPrefs({
      message: false,
      incident: 'nope', // not a boolean → default (on)
      surprise: false, // unknown key → dropped
      quietHours: { enabled: true, start: '23:30', end: 'bad' },
    });
    expect(p.message).toBe(false);
    expect(p.incident).toBe(true);
    expect((p as Record<string, unknown>).surprise).toBeUndefined();
    expect(p.quietHours).toEqual({ enabled: true, start: '23:30', end: '07:00' });
  });
  it('filterStaffNotifications drops only switched-off types, keeps unknown types', () => {
    const items = [
      { type: 'incident', id: '1' },
      { type: 'message', id: '2' },
      { type: 'brand_new_type', id: '3' },
    ];
    const prefs = normalizeStaffNotificationPrefs({ message: false });
    expect(filterStaffNotifications(items, prefs).map((i) => i.id)).toEqual(['1', '3']);
  });
});

describe('quiet hours', () => {
  const q = (start: string, end: string, enabled = true) => ({ enabled, start, end });
  it('parses HH:MM and rejects garbage', () => {
    expect(parseHHMM('07:30')).toBe(450);
    expect(parseHHMM('24:00')).toBeNull();
    expect(parseHHMM('7:30')).toBeNull();
  });
  it('same-day window', () => {
    expect(isWithinQuietHours(q('12:00', '14:00'), 13 * 60)).toBe(true);
    expect(isWithinQuietHours(q('12:00', '14:00'), 14 * 60)).toBe(false);
  });
  it('overnight window crosses midnight', () => {
    const overnight = q('22:00', '07:00');
    expect(isWithinQuietHours(overnight, 23 * 60)).toBe(true);
    expect(isWithinQuietHours(overnight, 3 * 60)).toBe(true);
    expect(isWithinQuietHours(overnight, 12 * 60)).toBe(false);
  });
  it('disabled or degenerate windows are never quiet', () => {
    expect(isWithinQuietHours(q('22:00', '07:00', false), 23 * 60)).toBe(false);
    expect(isWithinQuietHours(q('10:00', '10:00'), 10 * 60)).toBe(false);
  });
});

describe('account prefs (theme + default location)', () => {
  it('normalizes theme to light/dark/system', () => {
    expect(normalizeThemePref('dark')).toBe('dark');
    expect(normalizeThemePref('hotdog-stand')).toBe('system');
    expect(normalizeThemePref(undefined)).toBe('system');
  });
  it('sanitizes default location ids — ALL, safe ids, or null', () => {
    expect(sanitizeDefaultLocationId('ALL')).toBe('ALL');
    expect(sanitizeDefaultLocationId('loc-1')).toBe('loc-1');
    expect(sanitizeDefaultLocationId('')).toBeNull();
    expect(sanitizeDefaultLocationId('../x')).toBeNull();
    expect(sanitizeDefaultLocationId(42)).toBeNull();
  });
  it('mergeAccountPrefs patches only the keys sent and keeps the rest', () => {
    const stored = normalizeAccountPrefs({ theme: 'dark', defaultLocationId: 'loc-1' });
    const merged = mergeAccountPrefs(stored, { notifications: { message: false } });
    expect(merged.theme).toBe('dark');
    expect(merged.defaultLocationId).toBe('loc-1');
    expect(merged.notifications.message).toBe(false);
    expect(merged.notifications.incident).toBe(true);
  });
  it('a malformed patch cannot corrupt other prefs', () => {
    const stored = normalizeAccountPrefs({ theme: 'light', defaultLocationId: 'loc-2' });
    const merged = mergeAccountPrefs(stored, { defaultLocationId: '../../evil', theme: 7 });
    expect(merged.defaultLocationId).toBeNull(); // rejected, not "sanitised"
    expect(merged.theme).toBe('system');
    expect(merged.notifications).toEqual(DEFAULT_STAFF_NOTIFICATION_PREFS);
  });
});

describe('KV keys', () => {
  it('are tenant- and user-scoped', () => {
    expect(userProfileKey('t1', 'u1')).toBe('user:t1:profile:u1');
    expect(userPrefsKey('t1', 'u1')).toBe('user_prefs:t1:u1');
  });
});
