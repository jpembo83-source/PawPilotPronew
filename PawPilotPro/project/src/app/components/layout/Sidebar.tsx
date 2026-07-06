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
import {
  GridFour,
  PawPrint,
  Scissors,
  Van,
  Moon,
  UsersThree,
  ChatCircleDots,
  Receipt,
  Warning,
  ChartBar,
  ClipboardText,
  UserGear,
  Package,
  Gear,
  ShoppingBag,
  Gauge,
  CalendarCheck,
  MagnifyingGlass,
} from '@phosphor-icons/react';
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

import { MODULES } from '../../modules/settings/constants/modules';

// Helper for class names if cn doesn't exist yet
function classNames(...classes: (string | undefined | null | false)[]) {
  return classes.filter(Boolean).join(' ');
}

// Map nav item paths to module names for permission checking
// Each path maps to a permission module - user must have 'view' on that module
const PATH_TO_MODULE: Record<string, string> = {
  '/': 'dashboard',
  '/capacity': 'capacity', // Separate permission for capacity management
  '/calendar': 'calendar',
  '/customers': 'customers',
  '/customers/pending-requests': 'customers',
  '/daycare': 'daycare',
  '/daycare/check-in': 'daycare',
  '/grooming': 'grooming',
  '/boutique': 'boutique',
  '/billing': 'billing',
  '/invoices': 'invoices',
  '/messages': 'messages',
  '/messaging': 'messages',
  '/incidents': 'incidents',
  '/transport': 'transport',
  '/reports': 'reports',
  '/staff': 'staff',
  '/policies': 'staff', // Policies is part of staff management
  '/memberships': 'memberships',
  '/packages': 'packages',
  '/overnights': 'overnights', // Separate permission for overnights
  '/settings': 'settings',
};

// Phosphor icon overrides — weight="fill" for active, weight="regular" for inactive
const PATH_ICONS: Record<string, React.ElementType> = {
  '/':           GridFour,
  '/daycare':    PawPrint,
  '/capacity':   Gauge,
  '/grooming':   Scissors,
  '/transport':  Van,
  '/overnights': Moon,
  '/customers':  UsersThree,
  '/messages':   ChatCircleDots,
  '/messaging':  ChatCircleDots,
  '/billing':    Receipt,
  '/invoices':   Receipt,
  '/incidents':  Warning,
  '/reports':    ChartBar,
  '/policies':   ClipboardText,
  '/staff':      UserGear,
  '/packages':   Package,
  '/settings':   Gear,
  '/boutique':   ShoppingBag,
  '/calendar':   CalendarCheck,
};

// Section grouping for nav items
const NAV_SECTIONS = [
  { label: 'Operations', paths: ['/', '/customers/pending-requests', '/daycare', '/overnights', '/grooming', '/transport', '/capacity'] },
  { label: 'Business', paths: ['/customers', '/billing', '/messages', '/reports', '/incidents'] },
  { label: 'Team', paths: ['/staff', '/policies', '/packages'] },
  { label: 'Admin', paths: ['/settings'] },
];

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

  const isCollapsed = sidebarCollapsed;

  // Search is useful only to staff who can see what it finds (mirrors the
  // RBAC gate inside GlobalSearch itself).
  const canSearch = canAccessModule('customers') || canAccessModule('daycare');
  const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/i.test(navigator.platform);

  const activeLocationName = selectedLocationId === 'ALL'
    ? 'All Locations'
    : locations.find(l => l && l.id === selectedLocationId)?.name || 'Unknown Location';

  // Build dynamic nav items from MODULES
  // Step 1: Collect all nav items from modules
  // Optional modules are shown if:
  //   a) Enabled for the location, OR
  //   b) User has explicit permission (via template) - so drivers always see Transport
  const allNavItems = MODULES.reduce((acc, module) => {
    // Core modules - always include
    if (module.isCore) {
      return [...acc, ...module.navItems];
    }

    // Global enable/disable is the primary gate — a disabled module is hidden for everyone
    const isGloballyEnabled = (globalEnabledModules || []).includes(module.id);
    if (!isGloballyEnabled) {
      return acc;
    }

    // When viewing a specific location, also check that location's enabledModules.
    // Exception: if the user has an explicit role permission (e.g. driver for Transport),
    // still show the item so they can do their job.
    if (selectedLocationId !== 'ALL') {
      const currentLoc = locations.find(l => l && l.id === selectedLocationId);
      const isEnabledAtLocation = currentLoc?.isActive &&
        (currentLoc.enabledModules || []).includes(module.id);
      const userHasPermission = canAccessModule(module.id);
      if (!isEnabledAtLocation && !userHasPermission) {
        return acc;
      }
    }

    // Add all nav items from this module
    return [...acc, ...module.navItems];
  }, [] as any[]);

  // Step 2: Add Settings nav item (icon resolved via PATH_ICONS)
  allNavItems.push({ label: 'Settings', icon: Gear, path: '/settings' });

  // Step 3: Filter by beta access (adds "(beta)" suffix for admins, hides for others)
  const betaFilteredNavItems = filterNavItems(allNavItems);

  // Step 4: Filter by RBAC permissions - this is the key enforcement point
  const filteredNavItems = betaFilteredNavItems.filter((item: any) => {
    const moduleName = PATH_TO_MODULE[item.path];

    // If no module mapping found, hide the item (fail secure)
    if (!moduleName) {
      console.warn(`[Sidebar] No permission mapping for path: ${item.path}`);
      return false;
    }

    // Check if user has permission to access this module
    return canAccessModule(moduleName);
  });

  // Group filteredNavItems into sections
  const groupedSections = NAV_SECTIONS.map(section => ({
    label: section.label,
    items: filteredNavItems.filter((item: any) => section.paths.includes(item.path)),
  })).filter(section => section.items.length > 0);

  // Any items not matched by a section fall into an "Other" group
  const allSectionPaths = NAV_SECTIONS.flatMap(s => s.paths);
  const ungroupedItems = filteredNavItems.filter((item: any) => !allSectionPaths.includes(item.path));

  const renderNavItem = (item: any) => {
    const PhosphorIcon = PATH_ICONS[item.path];
    return (
      <NavLink
        key={item.path}
        to={item.path}
        title={isCollapsed ? (item.label || item.name) : undefined}
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
            {PhosphorIcon ? (
              <PhosphorIcon
                size={isCollapsed ? 20 : 18}
                weight={isActive ? 'fill' : 'regular'}
                className={classNames(
                  "flex-shrink-0 transition-colors",
                  isActive ? 'text-primary' : 'text-[#78716C] group-hover:text-[#1C1916]'
                )}
              />
            ) : (
              <item.icon
                className={classNames(
                  "flex-shrink-0 transition-colors",
                  isCollapsed ? "h-5 w-5" : "h-[18px] w-[18px]",
                  isActive ? 'text-primary' : 'text-[#78716C] group-hover:text-[#1C1916]'
                )}
                strokeWidth={1.5}
              />
            )}
            {!isCollapsed && (
              <span className="leading-none tracking-tight">{item.label || item.name}</span>
            )}
          </>
        )}
      </NavLink>
    );
  };

  return (
    <div className={classNames(
      "flex flex-col h-full bg-[#FAFAF8] border-r border-[#E2DED8] flex-shrink-0 transition-all duration-300 relative",
      isCollapsed ? "w-16" : "w-60"
    )}>
      {/* Collapse Toggle Button */}
      <button
        onClick={toggleSidebar}
        className="absolute -right-3 top-20 z-50 h-6 w-6 bg-white border border-[#E2DED8] rounded-full shadow-sm flex items-center justify-center text-[#6B6762] hover:text-[#1C1916] hover:bg-[#F0EDE8] transition-colors"
        title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        {isCollapsed ? (
          <CaretRight className="h-3.5 w-3.5" />
        ) : (
          <CaretLeft className="h-3.5 w-3.5" />
        )}
      </button>

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
            <button className={classNames(
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
                {section.items.map((item: any) => renderNavItem(item))}
              </div>
            </React.Fragment>
          ))}

          {ungroupedItems.length > 0 && (
            <React.Fragment>
              <div className="my-1.5 mx-2 h-px bg-[#EAE7E2]" />
              <div className="space-y-px">
                {ungroupedItems.map((item: any) => renderNavItem(item))}
              </div>
            </React.Fragment>
          )}
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
              className="text-[#A09893] hover:text-[#C03030] transition-colors rounded p-1 hover:bg-[#FEF2F2] ml-auto"
            >
              <SignOut className="h-3.5 w-3.5" strokeWidth={1.5} />
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
              className="text-[#A09893] hover:text-[#C03030] transition-colors rounded p-1.5 hover:bg-[#FEF2F2]"
            >
              <SignOut className="h-3.5 w-3.5" strokeWidth={1.5} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
