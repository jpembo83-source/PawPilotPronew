// My Account (client lib): the UI gates and pref logic the dialog and
// sidebar rely on. Key invariants: staff/assistant managers never see the
// Team section, only admins may default to All Locations, and quiet hours
// only ever mute the badge in the user's local time.
import { describe, it, expect } from 'vitest';
import {
  canManageTeam,
  canDefaultToAllLocations,
  accessibleLocations,
  validatePasswordForm,
  isWithinQuietHours,
  resolveIsDark,
  DEFAULT_ACCOUNT_PREFS,
} from '../../src/app/lib/account.ts';

describe('canManageTeam — Team section visibility', () => {
  it('is admin/manager only', () => {
    expect(canManageTeam('admin')).toBe(true);
    expect(canManageTeam('manager')).toBe(true);
  });
  it('is hidden for staff, assistant managers, and garbage roles', () => {
    expect(canManageTeam('staff')).toBe(false);
    expect(canManageTeam('assistant_manager')).toBe(false);
    expect(canManageTeam(undefined)).toBe(false);
    expect(canManageTeam('')).toBe(false);
  });
});

describe('canDefaultToAllLocations', () => {
  it('mirrors the sidebar switcher: ALL is admin-only', () => {
    expect(canDefaultToAllLocations('admin')).toBe(true);
    expect(canDefaultToAllLocations('manager')).toBe(false);
    expect(canDefaultToAllLocations('staff')).toBe(false);
  });
});

describe('accessibleLocations — default-location choices', () => {
  const locations = [
    { id: 'loc-1', name: 'North' },
    null,
    { id: 'loc-2', name: 'South' },
    { id: 'loc-3', name: 'East' },
  ];
  it('scopes to the user locationIds when restricted', () => {
    expect(accessibleLocations({ locationIds: ['loc-2'] }, locations).map((l) => l.id)).toEqual([
      'loc-2',
    ]);
  });
  it("offers everything for unrestricted scopes ('all' or empty)", () => {
    expect(accessibleLocations({ locationIds: ['all'] }, locations)).toHaveLength(3);
    expect(accessibleLocations({ locationIds: [] }, locations)).toHaveLength(3);
    expect(accessibleLocations(null, locations)).toHaveLength(3);
  });
});

describe('validatePasswordForm', () => {
  const form = (currentPassword: string, newPassword: string, confirmPassword: string) => ({
    currentPassword,
    newPassword,
    confirmPassword,
  });
  it('accepts a valid change', () => {
    expect(validatePasswordForm(form('old-pass', 'new-pass-1', 'new-pass-1'))).toBeNull();
  });
  it('requires current password, min length, difference, and matching confirm', () => {
    expect(validatePasswordForm(form('', 'new-pass-1', 'new-pass-1'))).toMatch(/current/i);
    expect(validatePasswordForm(form('old', 'short', 'short'))).toMatch(/8/);
    expect(validatePasswordForm(form('same-pass', 'same-pass', 'same-pass'))).toMatch(/different/i);
    expect(validatePasswordForm(form('old', 'new-pass-1', 'new-pass-2'))).toMatch(/match/i);
  });
});

describe('quiet hours (client mirror — badge muting in local time)', () => {
  it('matches the server behaviour for overnight windows', () => {
    const q = { enabled: true, start: '22:00', end: '07:00' };
    expect(isWithinQuietHours(q, 23 * 60)).toBe(true);
    expect(isWithinQuietHours(q, 6 * 60)).toBe(true);
    expect(isWithinQuietHours(q, 12 * 60)).toBe(false);
    expect(isWithinQuietHours({ ...q, enabled: false }, 23 * 60)).toBe(false);
  });
});

describe('resolveIsDark', () => {
  it('honours explicit prefs and falls back to the system for "system"', () => {
    expect(resolveIsDark('dark', false)).toBe(true);
    expect(resolveIsDark('light', true)).toBe(false);
    expect(resolveIsDark('system', true)).toBe(true);
    expect(resolveIsDark('system', false)).toBe(false);
  });
});

describe('defaults', () => {
  it('every notification type defaults ON — incidents are never pre-silenced', () => {
    const n = DEFAULT_ACCOUNT_PREFS.notifications;
    expect(n.incident).toBe(true);
    expect(n.booking_request).toBe(true);
    expect(n.vaccination).toBe(true);
    expect(n.message).toBe(true);
    expect(n.quietHours.enabled).toBe(false);
  });
});
