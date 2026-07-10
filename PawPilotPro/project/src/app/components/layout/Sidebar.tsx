import React from 'react';
import { NavLink, useLocation } from 'react-router';
import {
  SignOut,
  Buildings,
  CaretDown,
  CaretLeft,
  CaretRight,
  Check,
} from '@phosphor-icons/react';
import { MagnifyingGlass } from '@phosphor-icons/react';
// Default logo imported as defaultLogo above
import { useAuth } from '../../context/AuthContext';
import { useDashboardStore } from '../../modules/dashboard/store';
import { useSettingsStore } from '../../modules/settings/store';
import { useBetaFeatures } from '../../hooks/useBetaFeatures';
import { usePermissions } from '../../hooks/usePermissions';
import defaultLogo from '../../../assets/logo.svg';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from "../../components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "../../components/ui/tooltip";
import { getVisibleNavEntries, groupNavEntries, type NavEntry } from './navManifest';
import { useInboxCounts, formatBadgeCount } from '../../hooks/useInboxCounts';

// Helper for class names if cn doesn't exist yet
function classNames(...classes: (string | undefined | null | false)[]) {
  return classes.filter(Boolean).join(' ');
}

interface SidebarProps {
  /** Opens the global search palette (same one Cmd/Ctrl+K toggles). */
  onOpenSearch?: () => void;
}

export function Sidebar({ onOpenSearch }: SidebarProps) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const { selectedLocationId, setLocation, sidebarCollapsed, toggleSidebar } = useDashboardStore();
  const { locations, globalEnabledModules, organisation } = useSettingsStore();
  const { hasBetaAccess, filterNavItems } = useBetaFeatures();
  const { canAccessModule, isAdmin } = usePermissions();

  // Get logo and name from organisation settings
  const logo = organisation.logoUrl || defaultLogo;
  const orgName = organisation.tradingName || organisation.name || 'Paw Pilot Pro';

  // Icon-only nav depends on hover/focus tooltips for its labels, and touch
  // devices have neither — a coarse-pointer user could never learn what the
  // icons mean. On touch-primary devices the sidebar therefore stays
  // expanded (labels always visible) and the collapse toggle is not offered.
  const [touchPrimary] = React.useState(
    () => typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches === true
  );
  const isCollapsed = sidebarCollapsed && !touchPrimary;

  // Search is useful only to staff who can see what it finds (mirrors the
  // RBAC gate inside GlobalSearch itself).
  const canSearch = canAccessModule('customers') || canAccessModule('daycare');
  const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/i.test(navigator.platform);

  const activeLocationName = selectedLocationId === 'ALL'
    ? 'All Locations'
    : locations.find(l => l && l.id === selectedLocationId)?.name || 'Unknown Location';

  // Visible nav items come from the shared manifest — RBAC, module
  // enablement, and beta gating all happen inside getVisibleNavEntries,
  // identically for this sidebar and the mobile layout.
  const visibleNavEntries = getVisibleNavEntries({
    canAccessModule,
    filterNavItems,
    globalEnabledModules: globalEnabledModules || [],
    selectedLocationId,
    locations,
  });
  const groupedSections = groupNavEntries(visibleNavEntries).map(({ section, items }) => ({
    label: section,
    items,
  }));

  // Portal Inbox pending-count badge — RBAC-gated exactly like the nav entry
  // (module 'customers'), so users who can't see the inbox never fetch it.
  const inboxCounts = useInboxCounts(canAccessModule('customers'));
  const badgeCountFor = (path: string): number =>
    path === '/customers/pending-requests' ? (inboxCounts?.total ?? 0) : 0;

  const renderNavItem = (item: NavEntry) => {
    const PhosphorIcon = item.icon;
    const label = item.label;
    const badgeCount = badgeCountFor(item.path);
    const labelWithCount = badgeCount > 0 ? `${label} — ${formatBadgeCount(badgeCount)} pending` : label;
    const link = (
      <NavLink
        key={item.path}
        to={item.path}
        aria-label={isCollapsed ? labelWithCount : undefined}
        className={({ isActive }) => classNames(
          'group relative flex items-center rounded-lg text-[13.5px] font-medium transition-all duration-150',
          isCollapsed ? 'justify-center p-2.5' : 'gap-3 px-3 py-2.5',
          isActive
            ? 'text-primary bg-primary-tint'
            : 'text-[#57534E] hover:text-[#1C1916] hover:bg-[#F5F3F0]'
        )}
      >
        {({ isActive }) => (
          <>
            {isActive && !isCollapsed && (
              <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-primary rounded-r-full" />
            )}
            <PhosphorIcon
              size={isCollapsed ? 20 : 18}
              weight={isActive ? 'fill' : 'regular'}
              className={classNames(
                "flex-shrink-0 transition-colors",
                isActive ? 'text-primary' : 'text-[#78716C] group-hover:text-[#1C1916]'
              )}
            />
            {!isCollapsed && (
              <span className="leading-none tracking-tight">{label}</span>
            )}
            {/* Pending-count pill (expanded) / dot (collapsed) — the count
                itself is in the tooltip + aria-label when collapsed. */}
            {!isCollapsed && badgeCount > 0 && (
              <span className="ml-auto rounded-full bg-primary text-white text-[11px] leading-none font-semibold tabular-nums px-1.5 py-1">
                {formatBadgeCount(badgeCount)}
              </span>
            )}
            {isCollapsed && badgeCount > 0 && (
              <span aria-hidden="true" className="absolute top-1 right-1 h-2 w-2 rounded-full bg-primary" />
            )}
          </>
        )}
      </NavLink>
    );

    // Collapsed icons get a real tooltip (shows on hover AND keyboard focus,
    // unlike the title attribute it replaces).
    if (!isCollapsed) return link;
    return (
      <Tooltip key={item.path}>
        <TooltipTrigger asChild>{link}</TooltipTrigger>
        <TooltipContent side="right">{labelWithCount}</TooltipContent>
      </Tooltip>
    );
  };

  return (
    <div className={classNames(
      "flex flex-col h-full bg-[#FAFAF8] border-r border-[#E2DED8] flex-shrink-0 transition-all duration-300 relative",
      isCollapsed ? "w-16" : "w-60"
    )}>
      {/* Collapse Toggle Button — not offered on touch-primary devices,
          where the icon-only state would have no visible labels. */}
      {!touchPrimary && (
        <button
          onClick={toggleSidebar}
          aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="absolute -right-3 top-20 z-50 h-6 w-6 bg-white border border-[#E2DED8] rounded-full shadow-sm flex items-center justify-center text-[#6B6762] hover:text-[#1C1916] hover:bg-[#F0EDE8] transition-colors"
          title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {isCollapsed ? (
            <CaretRight className="h-3.5 w-3.5" aria-hidden="true" />
          ) : (
            <CaretLeft className="h-3.5 w-3.5" aria-hidden="true" />
          )}
        </button>
      )}

      {/* Logo / Org Header */}
      <div className={classNames(
        "flex items-center gap-2.5 transition-all duration-300",
        isCollapsed ? "p-3 justify-center" : "px-4 py-[18px]"
      )}>
        <div className={classNames(
          "flex-shrink-0 rounded-lg overflow-hidden flex items-center justify-center bg-primary transition-all duration-300",
          isCollapsed ? "h-7 w-7 p-1" : "h-7 w-7 p-1"
        )}>
          <img src={logo} alt="" className="h-full w-full object-contain brightness-0 invert" />
        </div>
        {!isCollapsed && (
          <div className="overflow-hidden flex-1 min-w-0">
            <h1 className="font-semibold text-[13px] leading-tight text-[#1C1916] truncate">{orgName}</h1>
          </div>
        )}
      </div>

      {/* Location Picker */}
      <div className={classNames(
        "transition-all duration-300 border-b border-[#E2DED8]",
        isCollapsed ? "px-2 py-2" : "px-2 py-2"
      )}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              aria-label={isCollapsed ? `Change location — currently ${activeLocationName}` : undefined}
              className={classNames(
                "w-full hover:bg-[#F0EDE8] transition-colors rounded-lg flex items-center text-[13px] group",
                isCollapsed ? "p-2 justify-center" : "px-3 py-2 gap-2 justify-between"
              )}>
              <div className="flex items-center gap-2 overflow-hidden">
                <Buildings className="h-3.5 w-3.5 text-primary shrink-0" strokeWidth={1.5} />
                {!isCollapsed && (
                  <span className="font-medium truncate text-left text-[#57534E]">{activeLocationName}</span>
                )}
              </div>
              {!isCollapsed && (
                <CaretDown className="h-3 w-3 text-[#A09893] shrink-0" strokeWidth={1.5} />
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-52">
            {user?.role === 'admin' && (
              <>
                <DropdownMenuItem
                  onClick={() => setLocation('ALL')}
                  className="cursor-pointer flex justify-between"
                >
                  <span>All Locations</span>
                  {selectedLocationId === 'ALL' && <Check className="h-4 w-4 text-primary" />}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
              </>
            )}

            {locations.filter(loc => loc != null).map(loc => (
              <DropdownMenuItem
                key={loc.id}
                onClick={() => setLocation(loc.id)}
                className="cursor-pointer flex justify-between"
              >
                <span>{loc.name}</span>
                {selectedLocationId === loc.id && <Check className="h-4 w-4 text-primary" />}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Global search — visible entry point for the Cmd/Ctrl+K palette */}
      {canSearch && onOpenSearch && (
        <div className="px-2 pt-2">
          <button
            onClick={onOpenSearch}
            title={isCollapsed ? 'Search dogs & owners' : undefined}
            aria-label="Search dogs and owners"
            className={classNames(
              'w-full flex items-center rounded-lg border border-[#E2DED8] bg-white text-[13px] text-[#57534E]',
              'hover:text-[#1C1916] hover:border-[#CFC9C1] hover:bg-[#FDFDFC] transition-colors',
              isCollapsed ? 'justify-center p-2.5' : 'gap-2 px-3 py-2'
            )}
          >
            <MagnifyingGlass className="h-4 w-4 text-[#78716C] shrink-0" />
            {!isCollapsed && (
              <>
                <span className="flex-1 text-left font-medium">Search</span>
                <kbd className="text-[11px] leading-none text-tertiary-foreground border border-[#E2DED8] rounded px-1.5 py-1 bg-[#FAFAF8] font-sans">
                  {isMac ? '⌘K' : 'Ctrl K'}
                </kbd>
              </>
            )}
          </button>
        </div>
      )}

      {/* Navigation */}
      <nav className={classNames(
        "flex-1 py-2 overflow-y-auto transition-all duration-300",
        isCollapsed ? "px-2" : "px-2"
      )}>
        <div>
          {groupedSections.map((section, sectionIdx) => (
            <React.Fragment key={section.label}>
              {sectionIdx > 0 && (
                <div className="my-1.5 mx-2 h-px bg-[#EAE7E2]" />
              )}
              <div className="space-y-px">
                {section.items.map(item => renderNavItem(item))}
              </div>
            </React.Fragment>
          ))}
        </div>
      </nav>

      {/* User / Sign Out Section */}
      <div className={classNames(
        "border-t border-[#E2DED8] transition-all duration-300",
        isCollapsed ? "p-2" : "px-2 py-2"
      )}>
        {!isCollapsed ? (
          <div className="flex items-center gap-2.5 px-2 py-2 rounded-lg hover:bg-[#F5F3F0] transition-colors cursor-default">
            <div className="h-6 w-6 rounded-full bg-primary flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0">
              {user?.name.charAt(0).toUpperCase()}
            </div>
            <div className="overflow-hidden flex-1">
              <p className="text-[13px] font-medium truncate text-[#1C1916] leading-tight">{user?.name}</p>
              <p className="text-[11px] text-tertiary-foreground capitalize leading-tight">{user?.role?.replace('_', ' ')}</p>
            </div>
            <button
              onClick={logout}
              title="Sign Out"
              aria-label="Sign out"
              className="text-[#A09893] hover:text-[#C03030] transition-colors rounded p-1 hover:bg-[#FEF2F2] ml-auto"
            >
              <SignOut className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <div
              className="h-7 w-7 rounded-full bg-primary flex items-center justify-center text-white text-xs font-bold"
              title={user?.name}
            >
              {user?.name.charAt(0).toUpperCase()}
            </div>
            <button
              onClick={logout}
              title="Sign Out"
              aria-label="Sign out"
              className="text-[#A09893] hover:text-[#C03030] transition-colors rounded p-1.5 hover:bg-[#FEF2F2]"
            >
              <SignOut className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
