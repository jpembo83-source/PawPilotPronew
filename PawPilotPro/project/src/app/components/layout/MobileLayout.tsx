/**
 * Mobile App Layout
 *
 * A dedicated mobile experience with:
 * - Bottom navigation bar (like native apps)
 * - Full-screen content area
 * - Slide-out drawer
 * - No sidebar wasted space
 */

import React, { useEffect, useState } from 'react';
import { NavLink, useLocation, Outlet } from 'react-router';
import {
  List,
  X,
  Buildings,
  SignOut,
  Bell,
  DotsThree,
  CaretRight,
  MagnifyingGlass,
} from '@phosphor-icons/react';
import { GlobalSearch } from '../search/GlobalSearch';
import { useAuth } from '../../context/AuthContext';
import { useDashboardStore } from '../../modules/dashboard/store';
import { useSettingsStore } from '../../modules/settings/store';
import { usePermissions } from '../../hooks/usePermissions';
import { useBetaFeatures } from '../../hooks/useBetaFeatures';
import { OfflineBanner } from './OfflineBanner';
import { NotificationsSheet } from '../notifications/NotificationsSheet';
import { useNotifications } from '../../hooks/useNotifications';
import defaultLogo from '../../../assets/logo.svg';
import { getVisibleNavEntries, groupNavEntries, bottomBarEntries } from './navManifest';
import { useInboxCounts, formatBadgeCount } from '../../hooks/useInboxCounts';

export function MobileLayout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const permissions = usePermissions();
  const { filterNavItems } = useBetaFeatures();
  const { selectedLocationId, setLocation } = useDashboardStore();
  const { locations, organisation, globalEnabledModules } = useSettingsStore();

  const [menuOpen, setMenuOpen] = useState(false);
  const [locationPickerOpen, setLocationPickerOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const notifications = useNotifications();

  const handleOpenNotifications = () => {
    setNotificationsOpen(true);
    void notifications.reload();
    // Opening the panel is "seeing" the items — clear the dot for this user.
    void notifications.markRead();
  };

  const canSearch =
    permissions.canAccessModule('customers') || permissions.canAccessModule('daycare');

  // Stamp the mobile shell on <body> so theme.css can enforce the 44px
  // touch-target floor everywhere — including dialogs rendered in portals
  // outside this component's subtree.
  useEffect(() => {
    document.body.classList.add('mobile-shell');
    return () => document.body.classList.remove('mobile-shell');
  }, []);

  const logo = organisation.logoUrl || defaultLogo;
  const orgName = organisation.tradingName || organisation.name || 'PawPilot Pro';

  // Same manifest + same filter as the desktop sidebar — the two navs can
  // no longer drift apart.
  const visibleNavEntries = getVisibleNavEntries({
    canAccessModule: permissions.canAccessModule,
    filterNavItems,
    globalEnabledModules: globalEnabledModules || [],
    selectedLocationId,
    locations,
  });
  const bottomNavItems = bottomBarEntries(visibleNavEntries);
  const groupedMenuItems = groupNavEntries(visibleNavEntries);

  // Portal Inbox pending-count badge — same RBAC gate as the nav entry.
  // Shown on the drawer's Portal Inbox row and (since that entry lives
  // behind "More") as a count on the More tab itself, so pending portal
  // work is visible without opening anything.
  const inboxCounts = useInboxCounts(permissions.canAccessModule('customers'));
  const inboxBadge = inboxCounts?.total ?? 0;
  const badgeCountFor = (path: string): number =>
    path === '/customers/pending-requests' ? inboxBadge : 0;

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
          className="-ml-2 rounded-lg transition-colors flex items-center justify-center touch-target"
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

        {/* Search + Bell */}
        <div className="flex items-center">
          {canSearch && (
            <button
              onClick={() => setSearchOpen(true)}
              className="rounded-lg transition-colors flex items-center justify-center touch-target"
              style={{ WebkitTapHighlightColor: 'transparent' }}
              aria-label="Search pets and households"
              onMouseDown={(e) => (e.currentTarget.style.background = '#F4F3EF')}
              onMouseUp={(e) => (e.currentTarget.style.background = 'transparent')}
              onTouchStart={(e) => (e.currentTarget.style.background = '#F4F3EF')}
              onTouchEnd={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              <MagnifyingGlass className="h-6 w-6" style={{ color: '#6B6762' }} />
            </button>
          )}
          <button
            onClick={handleOpenNotifications}
            className="-mr-2 rounded-lg transition-colors relative flex items-center justify-center touch-target"
            style={{ WebkitTapHighlightColor: 'transparent' }}
            aria-label="Notifications"
            onMouseDown={(e) => (e.currentTarget.style.background = '#F4F3EF')}
            onMouseUp={(e) => (e.currentTarget.style.background = 'transparent')}
            onTouchStart={(e) => (e.currentTarget.style.background = '#F4F3EF')}
            onTouchEnd={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            <Bell className="h-6 w-6" style={{ color: '#6B6762' }} />
            {/* Brand dot — only when something is actually waiting */}
            {notifications.unreadCount > 0 && (
              <span
                className="absolute top-2 right-2 h-2 w-2 rounded-full border-2 border-white"
                style={{ background: 'var(--primary)' }}
              />
            )}
          </button>
        </div>
      </header>

      <OfflineBanner />

      {/* Global search — header icon or Cmd/Ctrl+K */}
      <GlobalSearch open={searchOpen} onOpenChange={setSearchOpen} />

      {/* Notifications panel behind the header bell */}
      <NotificationsSheet
        open={notificationsOpen}
        onOpenChange={setNotificationsOpen}
        items={notifications.items}
        isLoading={notifications.isLoading}
      />

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
                  style={{ color: isActive ? 'var(--primary)' : 'var(--tertiary-foreground)' }}
                />
                <span
                  className="text-[10px] font-semibold leading-none"
                  style={{ color: isActive ? 'var(--primary)' : 'var(--tertiary-foreground)' }}
                >
                  {item.shortLabel ?? item.label}
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
              style={{ color: isMoreActive ? 'var(--primary)' : 'var(--tertiary-foreground)' }}
            />
            <span
              className="text-[10px] font-semibold leading-none"
              style={{ color: isMoreActive ? 'var(--primary)' : 'var(--tertiary-foreground)' }}
            >
              More
            </span>
            {/* Portal Inbox lives behind More on mobile — surface its
                pending count here so it's visible without opening the menu. */}
            {inboxBadge > 0 && (
              <span
                aria-label={`Portal Inbox — ${formatBadgeCount(inboxBadge)} pending`}
                className="absolute rounded-full text-white text-[10px] leading-none font-bold tabular-nums px-1.5 py-[3px] border-2 border-white"
                style={{ background: 'var(--primary)', top: 4, left: '50%', transform: 'translateX(6px)' }}
              >
                {formatBadgeCount(inboxBadge)}
              </span>
            )}
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
                    style={{ color: 'var(--tertiary-foreground)' }}
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
                        {badgeCountFor(item.path) > 0 && (
                          <span
                            aria-label={`${formatBadgeCount(badgeCountFor(item.path))} pending`}
                            className="ml-auto rounded-full text-white text-[11px] leading-none font-semibold tabular-nums px-1.5 py-1"
                            style={{ background: 'var(--primary)' }}
                          >
                            {formatBadgeCount(badgeCountFor(item.path))}
                          </span>
                        )}
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
