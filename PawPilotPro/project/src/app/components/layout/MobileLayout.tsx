/**
 * Mobile App Layout
 * 
 * A dedicated mobile experience with:
 * - Bottom navigation bar (like native apps)
 * - Full-screen content area
 * - Swipe gestures
 * - No sidebar wasted space
 */

import React, { useState } from 'react';
import { NavLink, useLocation, Outlet } from 'react-router';
import { 
  LayoutDashboard, 
  Users, 
  Dog,
  Truck,
  Settings,
  Menu,
  X,
  ChevronRight,
  Building2,
  LogOut,
  Bell,
  Scissors,
  Receipt,
  AlertTriangle,
  MessageSquare,
  Moon,
  UserCog
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useDashboardStore } from '../../modules/dashboard/store';
import { useSettingsStore } from '../../modules/settings/store';
import { usePermissions } from '../../hooks/usePermissions';
import defaultLogo from '../../../assets/logo.svg';

// Bottom nav items - most important 5 for mobile
const getBottomNavItems = (permissions: ReturnType<typeof usePermissions>) => {
  const items = [
    { path: '/', icon: LayoutDashboard, label: 'Home', module: 'dashboard' },
  ];
  
  // Add based on permissions - most relevant for the user's role
  if (permissions.canAccessModule('daycare')) {
    items.push({ path: '/daycare', icon: Dog, label: 'Daycare', module: 'daycare' });
  }
  if (permissions.canAccessModule('transport')) {
    items.push({ path: '/transport', icon: Truck, label: 'Transport', module: 'transport' });
  }
  if (permissions.canAccessModule('grooming')) {
    items.push({ path: '/grooming', icon: Scissors, label: 'Grooming', module: 'grooming' });
  }
  if (permissions.canAccessModule('customers')) {
    items.push({ path: '/customers', icon: Users, label: 'Customers', module: 'customers' });
  }
  
  // Limit to 5 items max for bottom nav
  return items.slice(0, 5);
};

// All menu items for the slide-out menu
const getAllMenuItems = (permissions: ReturnType<typeof usePermissions>) => {
  const items: Array<{ path: string; icon: any; label: string; module: string }> = [];
  
  if (permissions.canAccessModule('dashboard')) {
    items.push({ path: '/', icon: LayoutDashboard, label: 'Dashboard', module: 'dashboard' });
  }
  if (permissions.canAccessModule('daycare')) {
    items.push({ path: '/daycare', icon: Dog, label: 'Daycare', module: 'daycare' });
  }
  if (permissions.canAccessModule('grooming')) {
    items.push({ path: '/grooming', icon: Scissors, label: 'Grooming', module: 'grooming' });
  }
  if (permissions.canAccessModule('transport')) {
    items.push({ path: '/transport', icon: Truck, label: 'Transport', module: 'transport' });
  }
  if (permissions.canAccessModule('overnights')) {
    items.push({ path: '/overnights', icon: Moon, label: 'Overnights', module: 'overnights' });
  }
  if (permissions.canAccessModule('customers')) {
    items.push({ path: '/customers', icon: Users, label: 'Customers', module: 'customers' });
  }
  if (permissions.canAccessModule('billing')) {
    items.push({ path: '/billing', icon: Receipt, label: 'Billing', module: 'billing' });
  }
  if (permissions.canAccessModule('messages')) {
    items.push({ path: '/messages', icon: MessageSquare, label: 'Messages', module: 'messages' });
  }
  if (permissions.canAccessModule('incidents')) {
    items.push({ path: '/incidents', icon: AlertTriangle, label: 'Incidents', module: 'incidents' });
  }
  if (permissions.canAccessModule('staff')) {
    items.push({ path: '/staff', icon: UserCog, label: 'Staff', module: 'staff' });
  }
  if (permissions.canAccessModule('settings')) {
    items.push({ path: '/settings', icon: Settings, label: 'Settings', module: 'settings' });
  }
  
  return items;
};

export function MobileLayout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const permissions = usePermissions();
  const { selectedLocationId, setLocation } = useDashboardStore();
  const { locations, organisation } = useSettingsStore();
  
  const [menuOpen, setMenuOpen] = useState(false);
  const [locationPickerOpen, setLocationPickerOpen] = useState(false);
  
  const logo = organisation.logoUrl || defaultLogo;
  const orgName = organisation.tradingName || organisation.name || 'Paw Pilot Pro';
  
  const bottomNavItems = getBottomNavItems(permissions);
  const allMenuItems = getAllMenuItems(permissions);
  
  const activeLocationName = selectedLocationId === 'ALL' 
    ? 'All Locations' 
    : locations.find(l => l && l.id === selectedLocationId)?.name || 'Select Location';

  return (
    <div className="h-[100dvh] flex flex-col bg-slate-50 overflow-hidden">
      {/* Top Header - Slim */}
      <header className="bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between shrink-0 safe-area-top">
        <button 
          onClick={() => setMenuOpen(true)}
          className="p-2 -ml-2 text-slate-600 active:bg-slate-100 rounded-lg"
        >
          <Menu className="h-6 w-6" />
        </button>
        
        <button 
          onClick={() => setLocationPickerOpen(true)}
          className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 rounded-full text-sm font-medium text-slate-700 active:bg-slate-200"
        >
          <Building2 className="h-4 w-4 text-primary" />
          <span className="max-w-[120px] truncate">{activeLocationName}</span>
        </button>
        
        <button className="p-2 -mr-2 text-slate-600 active:bg-slate-100 rounded-lg relative">
          <Bell className="h-6 w-6" />
          {/* Notification dot */}
          <span className="absolute top-1.5 right-1.5 h-2 w-2 bg-red-500 rounded-full" />
        </button>
      </header>

      {/* Main Content - Full screen with scroll */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>

      {/* Bottom Navigation - Fixed */}
      <nav className="bg-white border-t border-slate-200 px-2 py-2 shrink-0 safe-area-bottom">
        <div className="flex justify-around items-center">
          {bottomNavItems.map((item) => {
            const isActive = location.pathname === item.path || 
              (item.path !== '/' && location.pathname.startsWith(item.path));
            
            return (
              <NavLink
                key={item.path}
                to={item.path}
                className="flex flex-col items-center gap-1 px-3 py-2 rounded-xl min-w-[64px] active:bg-slate-100"
              >
                <item.icon 
                  className={`h-6 w-6 ${isActive ? 'text-primary' : 'text-slate-400'}`} 
                />
                <span 
                  className={`text-xs font-medium ${isActive ? 'text-primary' : 'text-slate-500'}`}
                >
                  {item.label}
                </span>
              </NavLink>
            );
          })}
        </div>
      </nav>

      {/* Slide-out Menu */}
      {menuOpen && (
        <div className="fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-black/50"
            onClick={() => setMenuOpen(false)}
          />
          
          {/* Menu Panel */}
          <div className="relative w-[280px] max-w-[80vw] bg-white h-full flex flex-col shadow-xl animate-slide-in-left">
            {/* Menu Header */}
            <div className="p-4 border-b border-slate-200 flex items-center gap-3 safe-area-top">
              <div className="h-12 w-12 rounded-xl bg-slate-100 p-2 flex items-center justify-center">
                <img src={logo} alt="Logo" className="h-full w-full object-contain" />
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="font-bold text-slate-900 truncate">{orgName}</h2>
                <p className="text-sm text-slate-500 truncate">{user?.email}</p>
              </div>
              <button 
                onClick={() => setMenuOpen(false)}
                className="p-2 text-slate-400 active:bg-slate-100 rounded-lg"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            {/* Menu Items */}
            <div className="flex-1 overflow-auto py-2">
              {allMenuItems.map((item) => {
                const isActive = location.pathname === item.path || 
                  (item.path !== '/' && location.pathname.startsWith(item.path));
                
                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    onClick={() => setMenuOpen(false)}
                    className={`flex items-center gap-3 px-4 py-3 mx-2 rounded-xl ${
                      isActive 
                        ? 'bg-primary text-white' 
                        : 'text-slate-700 active:bg-slate-100'
                    }`}
                  >
                    <item.icon className="h-5 w-5" />
                    <span className="font-medium">{item.label}</span>
                  </NavLink>
                );
              })}
            </div>
            
            {/* User Section */}
            <div className="p-4 border-t border-slate-200 safe-area-bottom">
              <div className="flex items-center gap-3 mb-4">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                  {user?.name?.charAt(0) || 'U'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-slate-900 truncate">{user?.name}</p>
                  <p className="text-sm text-slate-500 capitalize">{user?.role}</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setMenuOpen(false);
                  logout();
                }}
                className="flex items-center gap-2 w-full px-4 py-3 text-red-600 bg-red-50 rounded-xl font-medium active:bg-red-100"
              >
                <LogOut className="h-5 w-5" />
                Sign Out
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Location Picker Bottom Sheet */}
      {locationPickerOpen && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-black/50"
            onClick={() => setLocationPickerOpen(false)}
          />
          
          {/* Bottom Sheet */}
          <div className="relative bg-white rounded-t-3xl max-h-[70vh] flex flex-col animate-slide-up">
            {/* Handle */}
            <div className="flex justify-center py-3">
              <div className="w-10 h-1 bg-slate-300 rounded-full" />
            </div>
            
            <h3 className="px-4 pb-3 text-lg font-bold text-slate-900">Select Location</h3>
            
            <div className="overflow-auto px-4 pb-4 safe-area-bottom">
              {permissions.isAdmin && (
                <button
                  onClick={() => {
                    setLocation('ALL');
                    setLocationPickerOpen(false);
                  }}
                  className={`flex items-center justify-between w-full p-4 rounded-xl mb-2 ${
                    selectedLocationId === 'ALL' 
                      ? 'bg-primary text-white' 
                      : 'bg-slate-100 text-slate-900 active:bg-slate-200'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Building2 className="h-5 w-5" />
                    <span className="font-medium">All Locations</span>
                  </div>
                  {selectedLocationId === 'ALL' && (
                    <ChevronRight className="h-5 w-5" />
                  )}
                </button>
              )}
              
              {locations.filter(l => l != null).map((loc) => (
                <button
                  key={loc.id}
                  onClick={() => {
                    setLocation(loc.id);
                    setLocationPickerOpen(false);
                  }}
                  className={`flex items-center justify-between w-full p-4 rounded-xl mb-2 ${
                    selectedLocationId === loc.id 
                      ? 'bg-primary text-white' 
                      : 'bg-slate-100 text-slate-900 active:bg-slate-200'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Building2 className="h-5 w-5" />
                    <span className="font-medium">{loc.name}</span>
                  </div>
                  {selectedLocationId === loc.id && (
                    <ChevronRight className="h-5 w-5" />
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
