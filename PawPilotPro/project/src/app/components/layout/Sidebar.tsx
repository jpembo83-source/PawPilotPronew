import React from 'react';
import { NavLink, useLocation } from 'react-router';
import { 
  LayoutDashboard, 
  Dog, 
  Scissors,
  CalendarCheck, 
  Users, 
  MessageSquare, 
  Receipt, 
  AlertTriangle, 
  Settings, 
  LogOut,
  Building2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Check,
  FlaskConical,
  ShieldAlert
} from 'lucide-react';
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

export function Sidebar() {
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
    
    // Optional modules - check if enabled OR user has permission
    let isModuleEnabled = false;

    if (selectedLocationId === 'ALL') {
      isModuleEnabled = (globalEnabledModules || []).includes(module.id);
    } else {
      const isGloballyEnabled = (globalEnabledModules || []).includes(module.id);
      const currentLoc = locations.find(l => l && l.id === selectedLocationId);
      if (currentLoc && currentLoc.isActive && isGloballyEnabled) {
        isModuleEnabled = (currentLoc.enabledModules || []).includes(module.id);
      }
    }

    // Also check if user has explicit permission for this module
    // This ensures drivers see Transport even if not "enabled" at org level
    const userHasPermission = canAccessModule(module.id);

    if (!isModuleEnabled && !userHasPermission) {
      return acc; // Skip - not enabled AND user has no permission
    }
    
    // Add all nav items from this module
    return [...acc, ...module.navItems];
  }, [] as any[]);
  
  // Step 2: Add Settings nav item
  allNavItems.push({ label: 'Settings', icon: Settings, path: '/settings' });
  
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

  return (
    <div className={classNames(
      "flex flex-col h-full bg-slate-900 text-white flex-shrink-0 transition-all duration-300 relative",
      isCollapsed ? "w-16" : "w-64"
    )}>
      {/* Collapse Toggle Button */}
      <button
        onClick={toggleSidebar}
        className="absolute -right-3 top-20 z-50 h-6 w-6 bg-white border border-slate-200 rounded-full shadow-md flex items-center justify-center text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-colors"
        title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        {isCollapsed ? (
          <ChevronRight className="h-4 w-4" />
        ) : (
          <ChevronLeft className="h-4 w-4" />
        )}
      </button>

      <div className={classNames(
        "flex items-center gap-3 bg-[rgb(255,250,250)] transition-all duration-300",
        isCollapsed ? "p-3 justify-center" : "p-6"
      )}>
        <div className={classNames(
          "flex-shrink-0 bg-white rounded-full p-1 overflow-hidden transition-all duration-300",
          isCollapsed ? "h-8 w-8" : "h-10 w-10"
        )}>
          <img src={logo} alt="Organisation Logo" className="h-full w-full object-contain" />
        </div>
        {!isCollapsed && (
          <div className="overflow-hidden">
            <h1 className="font-bold text-lg tracking-tight leading-tight text-[rgb(0,0,0)] truncate">{orgName}</h1>
            <p className="text-xs text-slate-400">Control Centre</p>
          </div>
        )}
      </div>

      <div className={classNames(
        "bg-[rgb(255,252,252)] transition-all duration-300",
        isCollapsed ? "px-2 py-2" : "px-6 py-2"
      )}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className={classNames(
              "w-full bg-[rgb(255,255,255)] hover:bg-slate-700 transition-colors rounded-md flex items-center text-sm border border-slate-700 group text-[rgb(0,0,0)]",
              isCollapsed ? "p-2 justify-center" : "p-3 justify-between"
            )}>
              <div className="flex items-center gap-2 overflow-hidden">
                <Building2 className="h-4 w-4 text-primary shrink-0" />
                {!isCollapsed && (
                  <span className="font-medium truncate text-left">{activeLocationName}</span>
                )}
              </div>
              {!isCollapsed && (
                <ChevronDown className="h-3 w-3 text-slate-400 group-hover:text-white" />
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-52 bg-slate-800 border-slate-700 text-slate-200">
            {user?.role === 'admin' && (
              <>
                <DropdownMenuItem 
                  onClick={() => setLocation('ALL')}
                  className="focus:bg-slate-700 focus:text-white cursor-pointer flex justify-between"
                >
                  <span>All Locations</span>
                  {selectedLocationId === 'ALL' && <Check className="h-4 w-4" />}
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-slate-700" />
              </>
            )}
            
            {locations.filter(loc => loc != null).map(loc => (
              <DropdownMenuItem 
                key={loc.id}
                onClick={() => setLocation(loc.id)}
                className="focus:bg-slate-700 focus:text-white cursor-pointer flex justify-between"
              >
                <span>{loc.name}</span>
                {selectedLocationId === loc.id && <Check className="h-4 w-4" />}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <nav className={classNames(
        "flex-1 py-6 space-y-1 overflow-y-auto bg-[rgb(255,255,255)] transition-all duration-300",
        isCollapsed ? "px-2" : "px-4"
      )}>
        {/* Beta indicator for admins */}
        {hasBetaAccess && !isCollapsed && (
          <div className="flex items-center gap-2 px-3 py-2 mb-2 text-xs text-purple-600 bg-purple-50 rounded-md border border-purple-200">
            <FlaskConical className="h-3.5 w-3.5" />
            <span>Beta modules visible</span>
          </div>
        )}
        {filteredNavItems.map((item: any) => {
          const isActive = location.pathname === item.path || 
                          (item.path !== '/' && location.pathname.startsWith(item.path));
          return (
            <NavLink
              key={item.path}
              to={item.path}
              title={isCollapsed ? (item.label || item.name) : undefined}
              className={({ isActive }) => classNames(
                'flex items-center rounded-md text-sm font-medium transition-colors',
                isCollapsed ? 'justify-center px-2 py-2.5' : 'gap-3 px-3 py-2.5',
                isActive 
                  ? 'bg-primary text-white shadow-sm' 
                  : 'text-slate-900 hover:bg-slate-800 hover:text-white'
              )}
            >
              <item.icon className="h-5 w-5 flex-shrink-0" />
              {!isCollapsed && (item.label || item.name)}
            </NavLink>
          );
        })}
      </nav>

      <div className={classNames(
        "border-t border-slate-800 bg-[rgb(255,252,252)] transition-all duration-300",
        isCollapsed ? "p-2" : "p-4"
      )}>
        {!isCollapsed && (
          <div className="flex items-center gap-3 px-2 mb-4">
            <div className="h-8 w-8 rounded-full bg-secondary flex items-center justify-center text-primary font-bold flex-shrink-0">
              {user?.name.charAt(0)}
            </div>
            <div className="overflow-hidden">
              <p className="text-sm font-medium truncate text-[rgb(0,0,0)]">{user?.name}</p>
              <p className="text-xs text-slate-400 capitalize">{user?.role}</p>
            </div>
          </div>
        )}
        {isCollapsed && (
          <div className="flex justify-center mb-2">
            <div className="h-8 w-8 rounded-full bg-secondary flex items-center justify-center text-primary font-bold" title={user?.name}>
              {user?.name.charAt(0)}
            </div>
          </div>
        )}
        <button
          onClick={logout}
          title={isCollapsed ? "Sign Out" : undefined}
          className={classNames(
            "flex items-center w-full text-sm text-[rgb(0,0,0)] hover:text-white hover:bg-slate-800 rounded-md transition-colors",
            isCollapsed ? "justify-center px-2 py-2" : "gap-2 px-3 py-2"
          )}
        >
          <LogOut className="h-4 w-4 flex-shrink-0" />
          {!isCollapsed && "Sign Out"}
        </button>
      </div>
    </div>
  );
}