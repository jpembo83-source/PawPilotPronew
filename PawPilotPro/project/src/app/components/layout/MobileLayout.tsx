/**
 * Mobile App Layout
 *
 * A dedicated mobile experience with:
 * - Bottom navigation bar (like native apps)
 * - Full-screen content area
 * - Slide-out drawer
 * - No sidebar wasted space
 */

import React, { useState } from 'react';
import { NavLink, useLocation, Outlet } from 'react-router';
import {
  Gauge,
  UsersThree,
  Dog,
  Truck,
  Gear,
  List,
  X,
  Buildings,
  SignOut,
  Bell,
  Scissors,
  Receipt,
  Warning,
  ChatTeardrop,
  Moon,
  UserGear,
  DotsThree,
  CaretRight,
} from '@phosphor-icons/react';
import { useAuth } from '../../context/AuthContext';
import { useDashboardStore } from '../../modules/dashboard/store';
import { useSettingsStore } from '../../modules/settings/store';
import { usePermissions } from '../../hooks/usePermissions';
import { OfflineBanner } from './OfflineBanner';
import defaultLogo from '../../../assets/logo.svg';

// Section groupings for drawer
const SECTION_LABELS: Record<string, string> = {
  dashboard: 'Operations',
  daycare: 'Operations',
  grooming: 'Operations',
  transport: 'Operations',
  overnights: 'Operations',
  customers: 'Business',
  billing: 'Business',
  messages: 'Business',
  incidents: 'Team',
  staff: 'Team',
  settings: 'Admin',
};

// Optional modules gated by globalEnabledModules
const OPTIONAL_MODULES = new Set(['grooming', 'transport', 'overnights', 'boutique']);

const isModuleVisible = (moduleId: string, globalEnabledModules: string[]) =>
  !OPTIONAL_MODULES.has(moduleId) || globalEnabledModules.includes(moduleId);

// Bottom nav items — most important 4 for mobile + More tab
const getBottomNavItems = (
  permissions: ReturnType<typeof usePermissions>,
  globalEnabledModules: string[],
) => {
  const items: Array<{ path: string; icon: any; label: string; module: string }> = [
    { path: '/', icon: Gauge, label: 'Home', module: 'dashboard' },
  ];

  if (permissions.canAccessModule('daycare') && isModuleVisible('daycare', globalEnabledModules)) {
    items.push({ path: '/daycare', icon: Dog, label: 'Daycare', module: 'daycare' });
  }
  if (permissions.canAccessModule('transport') && isModuleVisible('transport', globalEnabledModules)) {
    items.push({ path: '/transport', icon: Truck, label: 'Transport', module: 'transport' });
  }
  if (permissions.canAccessModule('grooming') && isModuleVisible('grooming', globalEnabledModules)) {
    items.push({ path: '/grooming', icon: Scissors, label: 'Grooming', module: 'grooming' });
  }
  if (permissions.canAccessModule('customers') && isModuleVisible('customers', globalEnabledModules)) {
    items.push({ path: '/customers', icon: UsersThree, label: 'Customers', module: 'customers' });
  }

  // Limit to 4 items — 5th slot is always "More"
  return items.slice(0, 4);
};

// All menu items for the slide-out drawer
const getAllMenuItems = (
  permissions: ReturnType<typeof usePermissions>,
  globalEnabledModules: string[],
) => {
  const items: Array<{ path: string; icon: any; label: string; module: string }> = [];

  if (permissions.canAccessModule('dashboard')) {
    items.push({ path: '/', icon: Gauge, label: 'Dashboard', module: 'dashboard' });
  }
  if (permissions.canAccessModule('daycare') && isModuleVisible('daycare', globalEnabledModules)) {
    items.push({ path: '/daycare', icon: Dog, label: 'Daycare', module: 'daycare' });
  }
  if (permissions.canAccessModule('grooming') && isModuleVisible('grooming', globalEnabledModules)) {
    items.push({ path: '/grooming', icon: Scissors, label: 'Grooming', module: 'grooming' });
  }
  if (permissions.canAccessModule('transport') && isModuleVisible('transport', globalEnabledModules)) {
    items.push({ path: '/transport', icon: Truck, label: 'Transport', module: 'transport' });
  }
  if (permissions.canAccessModule('overnights') && isModuleVisible('overnights', globalEnabledModules)) {
    items.push({ path: '/overnights', icon: Moon, label: 'Overnights', module: 'overnights' });
  }
  if (permissions.canAccessModule('customers')) {
    items.push({ path: '/customers', icon: UsersThree, label: 'Customers', module: 'customers' });
  }
  if (permissions.canAccessModule('billing')) {
    items.push({ path: '/billing', icon: Receipt, label: 'Billing', module: 'billing' });
  }
  if (permissions.canAccessModule('messages')) {
    items.push({ path: '/messages', icon: ChatTeardrop, label: 'Messages', module: 'messages' });
  }
  if (permissions.canAccessModule('incidents')) {
    items.push({ path: '/incidents', icon: Warning, label: 'Incidents', module: 'incidents' });
  }
  if (permissions.canAccessModule('staff')) {
    items.push({ path: '/staff', icon: UserGear, label: 'Staff', module: 'staff' });
  }
  if (permissions.canAccessModule('settings')) {
    items.push({ path: '/settings', icon: Gear, label: 'Gear', module: 'settings' });
  }

  return items;
};

// Group items by section label
function groupBySection(items: Array<{ path: string; icon: any; label: string; module: string }>) {
  const groups: Record<string, typeof items> = {};
  const order: string[] = [];

  for (const item of items) {
    const section = SECTION_LABELS[item.module] || 'Other';
    if (!groups[section]) {
      groups[section] = [];
      order.push(section);
    }
    groups[section].push(item);
  }

  return order.map((section) => ({ section, items: groups[section] }));
}

export function MobileLayout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const permissions = usePermissions();
  const { selectedLocationId, setLocation } = useDashboardStore();
  const { locations, organisation, globalEnabledModules } = useSettingsStore();

  const [menuOpen, setMenuOpen] = useState(false);
  const [locationPickerOpen, setLocationPickerOpen] = useState(false);

  const logo = organisation.logoUrl || defaultLogo;
  const orgName = organisation.tradingName || organisation.name || 'PawPilot Pro';

  const bottomNavItems = getBottomNavItems(permissions, globalEnabledModules || []);
  const allMenuItems = getAllMenuItems(permissions, globalEnabledModules || []);
  const groupedMenuItems = groupBySection(allMenuItems);

  const activeLocationName =
    selectedLocationId === 'ALL'
      ? 'All Locations'
      : locations.find((l) => l && l.id === selectedLocationId)?.name || 'Select Location';

  // Check if current path is "More" (i.e. not in bottom nav)
  const isMoreActive = !bottomNavItems.some(
    (item) =>
      location.pathname === item.path ||
      (item.path !== '/' && location.pathname.startsWith(item.path)),
  );

  return (
    <div
      className="h-[100dvh] flex flex-col overflow-hidden"
      style={{ background: '#F4F3EF', fontFamily: "'Plus Jakarta Sans', sans-serif" }}
    >
      {/* ── Top Header ─────────────────────────────────────────── */}
      <header
        className="bg-white border-b flex items-center justify-between px-4 shrink-0"
        style={{
          borderColor: '#E2DED8',
          height: 56,
          paddingTop: 'env(safe-area-inset-top)',
        }}
      >
        {/* Hamburger */}
        <button
          onClick={() => setMenuOpen(true)}
          className="p-2 -ml-2 rounded-lg transition-colors"
          style={{ WebkitTapHighlightColor: 'transparent' }}
          aria-label="Open menu"
          onMouseDown={(e) => (e.currentTarget.style.background = '#F4F3EF')}
          onMouseUp={(e) => (e.currentTarget.style.background = 'transparent')}
          onTouchStart={(e) => (e.currentTarget.style.background = '#F4F3EF')}
          onTouchEnd={(e) => (e.currentTarget.style.background = 'transparent')}
        >
          <List className="h-6 w-6" style={{ color: '#6B6762' }} />
        </button>

        {/* Org pill — tapping opens location picker */}
        <button
          onClick={() => setLocationPickerOpen(true)}
          className="flex items-center gap-2 px-3 py-1.5 rounded-full transition-opacity"
          style={{ background: '#F4F3EF', WebkitTapHighlightColor: 'transparent' }}
        >
          <img src={logo} alt={orgName} className="h-5 w-5 object-contain rounded-sm shrink-0" />
          <span
            className="text-sm font-semibold max-w-[140px] truncate"
            style={{ color: '#1C1916' }}
          >
            {orgName}
          </span>
        </button>

        {/* Bell */}
        <button
          className="p-2 -mr-2 rounded-lg transition-colors relative"
          style={{ WebkitTapHighlightColor: 'transparent' }}
          aria-label="Notifications"
          onMouseDown={(e) => (e.currentTarget.style.background = '#F4F3EF')}
          onMouseUp={(e) => (e.currentTarget.style.background = 'transparent')}
          onTouchStart={(e) => (e.currentTarget.style.background = '#F4F3EF')}
          onTouchEnd={(e) => (e.currentTarget.style.background = 'transparent')}
        >
          <Bell className="h-6 w-6" style={{ color: '#6B6762' }} />
          {/* Brand dot — visible when there are notifications */}
          <span
            className="absolute top-2 right-2 h-2 w-2 rounded-full border-2 border-white"
            style={{ background: 'var(--primary)' }}
          />
        </button>
      </header>

      <OfflineBanner />

      {/* ── Main Content ───────────────────────────────────────── */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>

      {/* ── Bottom Navigation ──────────────────────────────────── */}
      <nav
        className="bg-white border-t shrink-0"
        style={{
          borderColor: '#E2DED8',
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}
      >
        <div className="flex justify-around items-stretch" style={{ height: 60 }}>
          {/* Regular nav items */}
          {bottomNavItems.map((item) => {
            const isActive =
              location.pathname === item.path ||
              (item.path !== '/' && location.pathname.startsWith(item.path));

            return (
              <NavLink
                key={item.path}
                to={item.path}
                className="relative flex flex-col items-center justify-center flex-1 pt-1 transition-colors"
                style={{ WebkitTapHighlightColor: 'transparent' }}
              >
                {/* Active indicator — 3px rounded line at top of tab */}
                {isActive && (
                  <span
                    className="absolute top-0 left-1/2 -translate-x-1/2 rounded-b-full"
                    style={{ width: 28, height: 3, background: 'var(--primary)' }}
                  />
                )}
                <item.icon
                  className="h-5 w-5 mb-1"
                  style={{ color: isActive ? 'var(--primary)' : '#9E9B97' }}
                />
                <span
                  className="text-[10px] font-semibold leading-none"
                  style={{ color: isActive ? 'var(--primary)' : '#9E9B97' }}
                >
                  {item.label}
                </span>
              </NavLink>
            );
          })}

          {/* More tab */}
          <button
            onClick={() => setMenuOpen(true)}
            className="relative flex flex-col items-center justify-center flex-1 pt-1 transition-colors"
            style={{ WebkitTapHighlightColor: 'transparent' }}
          >
            {isMoreActive && (
              <span
                className="absolute top-0 left-1/2 -translate-x-1/2 rounded-b-full"
                style={{ width: 28, height: 3, background: 'var(--primary)' }}
              />
            )}
            <DotsThree
              className="h-5 w-5 mb-1"
              style={{ color: isMoreActive ? 'var(--primary)' : '#9E9B97' }}
            />
            <span
              className="text-[10px] font-semibold leading-none"
              style={{ color: isMoreActive ? 'var(--primary)' : '#9E9B97' }}
            >
              More
            </span>
          </button>
        </div>
      </nav>

      {/* ── Slide-out Drawer ───────────────────────────────────── */}
      {menuOpen && (
        <div className="fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
            onClick={() => setMenuOpen(false)}
          />

          {/* Drawer panel */}
          <div
            className="relative bg-white h-full flex flex-col shadow-2xl animate-slide-in-left"
            style={{ width: 300, maxWidth: '85vw' }}
          >
            {/* Drawer header */}
            <div
              className="flex items-center gap-3 px-4 py-4 border-b shrink-0"
              style={{
                borderColor: '#E2DED8',
                paddingTop: 'calc(env(safe-area-inset-top) + 16px)',
              }}
            >
              <div
                className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: 'var(--primary-tint)' }}
              >
                <img src={logo} alt={orgName} className="h-7 w-7 object-contain" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm truncate" style={{ color: '#1C1916' }}>
                  {orgName}
                </p>
                <p className="text-xs truncate" style={{ color: '#6B6762' }}>
                  {activeLocationName}
                </p>
              </div>
              <button
                onClick={() => setMenuOpen(false)}
                className="p-1.5 rounded-lg transition-colors shrink-0"
                style={{ WebkitTapHighlightColor: 'transparent' }}
                aria-label="Close menu"
                onMouseDown={(e) => (e.currentTarget.style.background = '#F4F3EF')}
                onMouseUp={(e) => (e.currentTarget.style.background = 'transparent')}
                onTouchStart={(e) => (e.currentTarget.style.background = '#F4F3EF')}
                onTouchEnd={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                <X className="h-5 w-5" style={{ color: '#6B6762' }} />
              </button>
            </div>

            {/* Nav groups */}
            <div className="flex-1 overflow-auto py-3">
              {groupedMenuItems.map(({ section, items }) => (
                <div key={section} className="mb-3">
                  {/* Section label */}
                  <p
                    className="px-5 pb-1.5 text-[10px] font-bold uppercase tracking-widest"
                    style={{ color: '#9E9B97' }}
                  >
                    {section}
                  </p>
                  {items.map((item) => {
                    const isActive =
                      location.pathname === item.path ||
                      (item.path !== '/' && location.pathname.startsWith(item.path));

                    return (
                      <NavLink
                        key={item.path}
                        to={item.path}
                        onClick={() => setMenuOpen(false)}
                        className="flex items-center gap-3 px-4 py-2.5 mx-2 rounded-xl transition-colors"
                        style={
                          isActive
                            ? { background: 'var(--primary-tint)', color: 'var(--primary)' }
                            : { color: '#1C1916' }
                        }
                      >
                        <item.icon
                          className="h-5 w-5 shrink-0"
                          style={{ color: isActive ? 'var(--primary)' : '#6B6762' }}
                        />
                        <span
                          className="font-medium text-sm"
                          style={{ color: isActive ? 'var(--primary)' : '#1C1916' }}
                        >
                          {item.label}
                        </span>
                      </NavLink>
                    );
                  })}
                </div>
              ))}
            </div>

            {/* User section at bottom */}
            <div
              className="px-4 py-4 border-t shrink-0"
              style={{
                borderColor: '#E2DED8',
                paddingBottom: 'calc(env(safe-area-inset-bottom) + 16px)',
              }}
            >
              {/* User info row */}
              <div className="flex items-center gap-3 mb-3">
                <div
                  className="h-9 w-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
                  style={{ background: 'var(--primary-tint)', color: 'var(--primary)' }}
                >
                  {user?.name?.charAt(0)?.toUpperCase() || 'U'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate" style={{ color: '#1C1916' }}>
                    {user?.name || user?.email}
                  </p>
                  <p className="text-xs capitalize truncate" style={{ color: '#6B6762' }}>
                    {user?.role}
                  </p>
                </div>
              </div>

              {/* Sign out button */}
              <button
                onClick={() => {
                  setMenuOpen(false);
                  logout();
                }}
                className="flex items-center gap-2 w-full px-4 py-2.5 rounded-xl transition-colors"
                style={{ background: '#FEF2F2' }}
              >
                <SignOut className="h-4 w-4" style={{ color: '#DC2626' }} />
                <span className="text-sm font-semibold" style={{ color: '#DC2626' }}>
                  Sign Out
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Location Picker Bottom Sheet ───────────────────────── */}
      {locationPickerOpen && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
            onClick={() => setLocationPickerOpen(false)}
          />

          {/* Sheet */}
          <div
            className="relative bg-white rounded-t-3xl max-h-[70vh] flex flex-col shadow-2xl animate-slide-up"
          >
            {/* Drag handle */}
            <div className="flex justify-center pt-3 pb-1 shrink-0">
              <div className="w-10 h-1 rounded-full" style={{ background: '#E2DED8' }} />
            </div>

            <h3
              className="px-5 pt-2 pb-4 text-base font-bold shrink-0"
              style={{ color: '#1C1916' }}
            >
              Select Location
            </h3>

            <div
              className="overflow-auto px-4 pb-6 space-y-2"
              style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 24px)' }}
            >
              {/* All Locations — admin only */}
              {permissions.isAdmin && (
                <button
                  onClick={() => {
                    setLocation('ALL');
                    setLocationPickerOpen(false);
                  }}
                  className="flex items-center justify-between w-full p-4 rounded-xl border transition-colors"
                  style={
                    selectedLocationId === 'ALL'
                      ? { background: 'var(--primary-tint)', borderColor: 'var(--primary)', color: 'var(--primary)' }
                      : { background: '#FFFFFF', borderColor: '#E2DED8', color: '#1C1916' }
                  }
                >
                  <div className="flex items-center gap-3">
                    <Buildings
                      className="h-5 w-5"
                      style={{ color: selectedLocationId === 'ALL' ? 'var(--primary)' : '#6B6762' }}
                    />
                    <span className="font-semibold text-sm">All Locations</span>
                  </div>
                  {selectedLocationId === 'ALL' && (
                    <CaretRight className="h-4 w-4" style={{ color: 'var(--primary)' }} />
                  )}
                </button>
              )}

              {locations.filter((l) => l != null).map((loc) => (
                <button
                  key={loc.id}
                  onClick={() => {
                    setLocation(loc.id);
                    setLocationPickerOpen(false);
                  }}
                  className="flex items-center justify-between w-full p-4 rounded-xl border transition-colors"
                  style={
                    selectedLocationId === loc.id
                      ? { background: 'var(--primary-tint)', borderColor: 'var(--primary)', color: 'var(--primary)' }
                      : { background: '#FFFFFF', borderColor: '#E2DED8', color: '#1C1916' }
                  }
                >
                  <div className="flex items-center gap-3">
                    <Buildings
                      className="h-5 w-5"
                      style={{ color: selectedLocationId === loc.id ? 'var(--primary)' : '#6B6762' }}
                    />
                    <span className="font-semibold text-sm">{loc.name}</span>
                  </div>
                  {selectedLocationId === loc.id && (
                    <CaretRight className="h-4 w-4" style={{ color: 'var(--primary)' }} />
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
