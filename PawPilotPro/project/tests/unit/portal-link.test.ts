// portal_users link helpers: multi-login households + legacy back-compat.
import { describe, it, expect } from 'vitest';
import {
  linkedUserIds,
  isLinkedPortalUser,
  withLinkedUser,
  withoutLinkedUser,
} from '../../supabase/functions/server/lib/portal_link.ts';

const BASE = { tenantId: 'tenant-1', householdId: 'hh-1' };

describe('linkedUserIds', () => {
  it('reads legacy single-user records', () => {
    expect(linkedUserIds({ authUserId: 'user-a' })).toEqual(['user-a']);
  });

  it('merges legacy authUserId with authUserIds without duplicating', () => {
    expect(linkedUserIds({ authUserId: 'user-a', authUserIds: ['user-a', 'user-b'] })).toEqual([
      'user-a',
      'user-b',
    ]);
  });

  it('is empty for null/garbage records', () => {
    expect(linkedUserIds(null)).toEqual([]);
    expect(linkedUserIds('nope')).toEqual([]);
    expect(linkedUserIds({})).toEqual([]);
  });
});

describe('isLinkedPortalUser', () => {
  it('accepts any linked user, not just the first', () => {
    const link = { authUserId: 'user-a', authUserIds: ['user-a', 'user-b'] };
    expect(isLinkedPortalUser(link, 'user-a')).toBe(true);
    expect(isLinkedPortalUser(link, 'user-b')).toBe(true);
  });

  it('rejects unknown users, missing links, and empty ids', () => {
    expect(isLinkedPortalUser({ authUserId: 'user-a' }, 'user-b')).toBe(false);
    expect(isLinkedPortalUser(null, 'user-a')).toBe(false);
    expect(isLinkedPortalUser({ authUserId: 'user-a' }, '')).toBe(false);
  });
});

describe('withLinkedUser', () => {
  it('creates a record for the first user', () => {
    const link = withLinkedUser(null, BASE, 'user-a');
    expect(link.authUserId).toBe('user-a');
    expect(link.authUserIds).toEqual(['user-a']);
    expect(link.tenantId).toBe('tenant-1');
    expect(link.createdAt).toBeTruthy();
  });

  it('ADDS a second login instead of replacing the first (the old lockout bug)', () => {
    const first = withLinkedUser(null, BASE, 'user-icloud');
    const second = withLinkedUser(first, BASE, 'user-me');
    // Both keep access; the original stays primary for legacy readers.
    expect(isLinkedPortalUser(second, 'user-icloud')).toBe(true);
    expect(isLinkedPortalUser(second, 'user-me')).toBe(true);
    expect(second.authUserId).toBe('user-icloud');
  });

  it('upgrades legacy single-user records in place', () => {
    const legacy = { authUserId: 'user-a', tenantId: 'tenant-1', householdId: 'hh-1', notificationPrefs: { booking: false } };
    const upgraded = withLinkedUser(legacy, BASE, 'user-b');
    expect(upgraded.authUserIds).toEqual(['user-a', 'user-b']);
    // Existing fields (prefs) survive the merge.
    expect(upgraded.notificationPrefs).toEqual({ booking: false });
  });

  it('is idempotent for an already-linked user', () => {
    const once = withLinkedUser(null, BASE, 'user-a');
    const twice = withLinkedUser(once, BASE, 'user-a');
    expect(twice.authUserIds).toEqual(['user-a']);
  });
});

describe('withoutLinkedUser', () => {
  it('removes one login and promotes the next to primary', () => {
    const link = withLinkedUser(withLinkedUser(null, BASE, 'user-a'), BASE, 'user-b');
    const after = withoutLinkedUser(link, 'user-a');
    expect(after?.authUserId).toBe('user-b');
    expect(after?.authUserIds).toEqual(['user-b']);
  });

  it('returns null when the last login is removed (caller deletes the record)', () => {
    const link = withLinkedUser(null, BASE, 'user-a');
    expect(withoutLinkedUser(link, 'user-a')).toBeNull();
  });
});
