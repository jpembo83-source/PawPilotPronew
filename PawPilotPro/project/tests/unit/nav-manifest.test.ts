// Nav manifest: the single source both navs derive from. These tests pin the
// filtering semantics so desktop/mobile nav can't silently drift again.
import { describe, it, expect } from 'vitest';
import {
  NAV_MANIFEST,
  NAV_SECTION_ORDER,
  getVisibleNavEntries,
  groupNavEntries,
  bottomBarEntries,
  type NavVisibilityContext,
} from '../../src/app/components/layout/navManifest';

const allowAll = () => true;
const noBeta = <T,>(items: T[]) => items;

function ctx(over: Partial<NavVisibilityContext> = {}): NavVisibilityContext {
  return {
    canAccessModule: allowAll,
    filterNavItems: noBeta,
    globalEnabledModules: ['daycare', 'grooming', 'transport', 'overnights', 'packages', 'boutique'],
    selectedLocationId: 'ALL',
    locations: [],
    ...over,
  };
}

describe('NAV_MANIFEST shape', () => {
  it('every entry is fully specified', () => {
    for (const e of NAV_MANIFEST) {
      expect(e.path, e.label).toBeTruthy();
      expect(e.label).toBeTruthy();
      expect(e.icon).toBeTruthy();
      expect(NAV_SECTION_ORDER).toContain(e.section);
      expect(e.module).toBeTruthy();
      expect(e.moduleId).toBeTruthy();
    }
  });

  it('paths are unique', () => {
    const paths = NAV_MANIFEST.map((e) => e.path);
    expect(new Set(paths).size).toBe(paths.length);
  });
});

describe('getVisibleNavEntries', () => {
  it('admin with everything enabled sees the whole manifest', () => {
    expect(getVisibleNavEntries(ctx()).length).toBe(NAV_MANIFEST.length);
  });

  it('globally disabled optional modules are hidden for everyone', () => {
    const entries = getVisibleNavEntries(ctx({ globalEnabledModules: [] }));
    const paths = entries.map((e) => e.path);
    expect(paths).not.toContain('/daycare');
    expect(paths).not.toContain('/boutique');
    expect(paths).toContain('/'); // core stays
    expect(paths).toContain('/settings');
  });

  it('RBAC hides modules the user has no permission on', () => {
    const entries = getVisibleNavEntries(ctx({ canAccessModule: (m) => m === 'dashboard' }));
    expect(entries.map((e) => e.path)).toEqual(['/']);
  });

  it('location gate hides optional modules not enabled at the selected location', () => {
    const entries = getVisibleNavEntries(ctx({
      canAccessModule: (m) => m !== 'grooming', // no explicit grooming permission
      selectedLocationId: 'loc-1',
      locations: [{ id: 'loc-1', isActive: true, enabledModules: ['daycare'] }],
    }));
    const paths = entries.map((e) => e.path);
    expect(paths).toContain('/daycare');
    expect(paths).not.toContain('/grooming');
  });

  it('explicit permission overrides the location gate (drivers keep Transport)', () => {
    const entries = getVisibleNavEntries(ctx({
      selectedLocationId: 'loc-1',
      locations: [{ id: 'loc-1', isActive: true, enabledModules: [] }],
    }));
    // canAccessModule is allowAll — transport survives despite the location
    expect(entries.map((e) => e.path)).toContain('/transport');
  });

  it('beta filter is applied to the final list', () => {
    const entries = getVisibleNavEntries(ctx({
      filterNavItems: (items) => items.filter((i) => i.path !== '/billing'),
    }));
    expect(entries.map((e) => e.path)).not.toContain('/billing');
  });
});

describe('groupNavEntries', () => {
  it('groups in canonical section order and drops empty sections', () => {
    const groups = groupNavEntries(getVisibleNavEntries(ctx()));
    expect(groups.map((g) => g.section)).toEqual(['Operations', 'Business', 'Team', 'Admin']);
    const teamOnly = groupNavEntries(NAV_MANIFEST.filter((e) => e.section === 'Team'));
    expect(teamOnly.map((g) => g.section)).toEqual(['Team']);
  });
});

describe('bottomBarEntries', () => {
  it('takes the four highest-priority visible entries, in priority order', () => {
    const bar = bottomBarEntries(getVisibleNavEntries(ctx()));
    expect(bar.map((e) => e.path)).toEqual(['/', '/daycare', '/transport', '/grooming']);
  });

  it('lower-priority entries backfill when one is filtered out', () => {
    const bar = bottomBarEntries(getVisibleNavEntries(ctx({
      canAccessModule: (m) => m !== 'grooming',
    })));
    expect(bar.map((e) => e.path)).toEqual(['/', '/daycare', '/transport', '/customers']);
  });

  it('never exceeds four slots', () => {
    expect(bottomBarEntries(getVisibleNavEntries(ctx())).length).toBeLessThanOrEqual(4);
  });
});
