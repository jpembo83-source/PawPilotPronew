// Single source of truth for staff navigation.
//
// Desktop (Sidebar) and mobile (MobileLayout bottom bar + drawer) both derive
// their items from NAV_MANIFEST through getVisibleNavEntries — RBAC, module
// enablement, and beta gating are applied HERE, once. Before this module
// existed the two navs were maintained by hand in parallel and had drifted
// (different sections, different icons, beta filtering on desktop only, and
// a mobile drawer missing a third of the routes).
//
// Adding a module to the app? Add ONE entry below and it appears correctly
// in both navs, in the right section, with RBAC applied.

import type React from 'react';
import {
  GridFour,
  Tray,
  Gauge,
  PawPrint,
  Scissors,
  Van,
  Moon,
  ShoppingBag,
  UsersThree,
  ChatCircleDots,
  Receipt,
  Warning,
  ChartBar,
  ClipboardText,
  UserGear,
  Package,
  Gear,
} from '@phosphor-icons/react';
import { MODULES } from '../../modules/settings/constants/modules';

export type NavSection = 'Operations' | 'Business' | 'Team' | 'Admin';

export const NAV_SECTION_ORDER: NavSection[] = ['Operations', 'Business', 'Team', 'Admin'];

export interface NavEntry {
  path: string;
  label: string;
  icon: React.ElementType;
  section: NavSection;
  /** Permission module checked via usePermissions().canAccessModule. */
  module: string;
  /**
   * Owning feature module for enablement gating. Entries whose moduleId is an
   * optional module (MODULES with isCore !== true) are hidden when that module
   * is globally disabled, and location-gated when a specific location is
   * selected. 'core' entries are always eligible.
   */
  moduleId: string;
  /** Present = candidate for the mobile bottom bar; the 4 lowest values win. */
  mobilePriority?: number;
  /** Compact label for the mobile bottom bar (defaults to label). */
  shortLabel?: string;
}

// Order within a section is display order on both surfaces.
export const NAV_MANIFEST: NavEntry[] = [
  // ── Operations ──
  { path: '/', label: 'Dashboard', shortLabel: 'Home', icon: GridFour, section: 'Operations', module: 'dashboard', moduleId: 'core', mobilePriority: 0 },
  { path: '/customers/pending-requests', label: 'Portal Inbox', icon: Tray, section: 'Operations', module: 'customers', moduleId: 'core' },
  { path: '/capacity', label: 'Capacity', icon: Gauge, section: 'Operations', module: 'capacity', moduleId: 'core' },
  { path: '/daycare', label: 'Daycare', icon: PawPrint, section: 'Operations', module: 'daycare', moduleId: 'daycare', mobilePriority: 10 },
  { path: '/grooming', label: 'Grooming', icon: Scissors, section: 'Operations', module: 'grooming', moduleId: 'grooming', mobilePriority: 30 },
  { path: '/transport', label: 'Transport', icon: Van, section: 'Operations', module: 'transport', moduleId: 'transport', mobilePriority: 20 },
  { path: '/overnights', label: 'Overnights', icon: Moon, section: 'Operations', module: 'overnights', moduleId: 'overnights' },
  { path: '/boutique', label: 'Boutique', icon: ShoppingBag, section: 'Operations', module: 'boutique', moduleId: 'boutique' },
  // ── Business ──
  { path: '/customers', label: 'Customers', icon: UsersThree, section: 'Business', module: 'customers', moduleId: 'core', mobilePriority: 40 },
  { path: '/messages', label: 'Messages', icon: ChatCircleDots, section: 'Business', module: 'messages', moduleId: 'core' },
  { path: '/billing', label: 'Billing', icon: Receipt, section: 'Business', module: 'billing', moduleId: 'core' },
  { path: '/incidents', label: 'Incidents', icon: Warning, section: 'Business', module: 'incidents', moduleId: 'core' },
  { path: '/reports', label: 'Reports', icon: ChartBar, section: 'Business', module: 'reports', moduleId: 'core' },
  // ── Team ──
  { path: '/policies', label: 'Policies', icon: ClipboardText, section: 'Team', module: 'staff', moduleId: 'core' },
  { path: '/staff', label: 'Staff', icon: UserGear, section: 'Team', module: 'staff', moduleId: 'core' },
  { path: '/packages', label: 'Packages', icon: Package, section: 'Team', module: 'packages', moduleId: 'packages' },
  // ── Admin ──
  { path: '/settings', label: 'Settings', icon: Gear, section: 'Admin', module: 'settings', moduleId: 'core' },
];

const OPTIONAL_MODULE_IDS = new Set(MODULES.filter((m) => !m.isCore).map((m) => m.id));

export interface NavVisibilityContext {
  /** usePermissions().canAccessModule */
  canAccessModule: (module: string) => boolean;
  /** useBetaFeatures().filterNavItems — beta paths hidden for non-admins */
  filterNavItems: <T extends { path: string; label?: string }>(items: T[]) => T[];
  globalEnabledModules: string[];
  selectedLocationId: string;
  locations: Array<{ id: string; isActive?: boolean; enabledModules?: string[] } | null>;
}

/**
 * THE nav filter — every surface calls this and nothing else.
 *
 * Gates, in order (same semantics the desktop sidebar always had):
 * 1. Optional feature modules must be globally enabled — for everyone.
 * 2. With a specific location selected, an optional module must also be
 *    enabled at that location — unless the user has an explicit permission
 *    for it (e.g. drivers always see Transport, wherever they are).
 * 3. RBAC: the user needs any permission on the entry's permission module.
 * 4. Beta paths are visible to beta users only.
 */
export function getVisibleNavEntries(ctx: NavVisibilityContext): NavEntry[] {
  const globallyEnabled = ctx.globalEnabledModules || [];
  const entries = NAV_MANIFEST.filter((entry) => {
    if (OPTIONAL_MODULE_IDS.has(entry.moduleId)) {
      if (!globallyEnabled.includes(entry.moduleId)) return false;
      if (ctx.selectedLocationId !== 'ALL') {
        const loc = ctx.locations.find((l) => l && l.id === ctx.selectedLocationId);
        const enabledAtLocation = !!loc?.isActive && (loc.enabledModules || []).includes(entry.moduleId);
        if (!enabledAtLocation && !ctx.canAccessModule(entry.module)) return false;
      }
    }
    return ctx.canAccessModule(entry.module);
  });
  return ctx.filterNavItems(entries);
}

/** Entries grouped for section-structured display (sidebar, drawer). */
export function groupNavEntries(entries: NavEntry[]): Array<{ section: NavSection; items: NavEntry[] }> {
  return NAV_SECTION_ORDER
    .map((section) => ({ section, items: entries.filter((e) => e.section === section) }))
    .filter((group) => group.items.length > 0);
}

/** The 4 highest-priority visible entries for the mobile bottom bar. */
export function bottomBarEntries(entries: NavEntry[]): NavEntry[] {
  return entries
    .filter((e) => e.mobilePriority !== undefined)
    .sort((a, b) => (a.mobilePriority ?? 0) - (b.mobilePriority ?? 0))
    .slice(0, 4);
}
