import React, { useEffect } from 'react';
import { NavLink, useLocation, Navigate, Outlet } from 'react-router';
import { useSettingsStore } from './store';
import { cn } from '../../components/ui/utils';
import { useAuth } from '../../context/AuthContext';
import { getAccessibleSections, hasSettingsPermission } from './utils/rbac';
import { SettingsSection as SettingsSectionKey } from './types/permissions';
import { 
  Buildings,
  MapPin,
  UsersThree,
  Tag,
  BookOpen,
  ChatTeardrop,
  Receipt,
  ShieldCheck,
  GitBranch,
  Gauge,
  SlidersHorizontal,
  CaretRight,
  MagnifyingGlass
} from '@phosphor-icons/react';

interface SettingsSection {
  id: string;
  label: string;
  icon: React.ElementType;
  path: string;
  description: string;
  sectionKey: SettingsSectionKey;
}

const sections: SettingsSection[] = [
  { id: 'org', label: 'Organisation', icon: Buildings, path: '/settings/organisation', description: 'Profile, brand, and global defaults', sectionKey: 'organisation' },
  // 'Modules' hidden (owner-confirmed): enabling/disabling platform modules
  // is a multi-tenant concept with no value for one business using its
  // modules. Page, route, and server code stay intact for re-enabling.
  { id: 'locations', label: 'Locations', icon: MapPin, path: '/settings/locations', description: 'Manage branches and capacity', sectionKey: 'locations' },
  { id: 'users', label: 'Users & Access', icon: UsersThree, path: '/settings/users', description: 'Staff accounts and roles', sectionKey: 'users' },
  { id: 'services', label: 'Services & Pricing', icon: Tag, path: '/settings/services', description: 'Service catalogue and price books', sectionKey: 'services' },
  // Sits in the operations RBAC bucket since these caps drive whether the
  // Portal Inbox shows pending requests as Limited/Full/Overbooked.
  { id: 'capacity', label: 'Service Capacity', icon: Gauge, path: '/settings/capacity', description: 'Daily caps used by the Portal Inbox', sectionKey: 'operations' },
  { id: 'ops', label: 'Operations Rules', icon: BookOpen, path: '/settings/operations', description: 'Booking and check-in policies', sectionKey: 'operations' },
  { id: 'comms', label: 'Communications', icon: ChatTeardrop, path: '/settings/communications', description: 'Templates and channels', sectionKey: 'communications' },
  { id: 'billing', label: 'Billing & Finance', icon: Receipt, path: '/settings/billing', description: 'Invoices, taxes, and penalties', sectionKey: 'billing' },
  { id: 'compliance', label: 'Data & Compliance', icon: ShieldCheck, path: '/settings/compliance', description: 'Retention and GDPR', sectionKey: 'compliance' },
  { id: 'integrations', label: 'Integrations', icon: GitBranch, path: '/settings/integrations', description: 'API and webhooks', sectionKey: 'integrations' },
  // 'Dashboard Config' removed — it managed widget visibility for an older
  // widget-based dashboard. The current dashboard is fixed-tile so this
  // section had nothing useful to configure. The DashboardSettings page +
  // /settings/dashboard route are left in the source tree in case widgets
  // come back; they're just no longer surfaced in the sidebar/grid.
  { id: 'system', label: 'System', icon: SlidersHorizontal, path: '/settings/system', description: 'Environment and maintenance', sectionKey: 'system' },
];

export function SettingsLayout() {
  const location = useLocation();
  const { user } = useAuth();
  const [navSearch, setNavSearch] = React.useState('');
  
  // Security check - only admins and managers can access settings
  if (!user || (user.role !== 'admin' && user.role !== 'manager' && user.role !== 'assistant_manager')) {
     return <Navigate to="/" replace />;
  }

  // Get accessible sections for this user
  const accessibleSectionKeys = getAccessibleSections(user.role);
  
  // Filter sections by user permissions and search
  const filteredSections = sections.filter(s => {
    const hasAccess = accessibleSectionKeys.includes(s.sectionKey);
    const matchesSearch = s.label.toLowerCase().includes(navSearch.toLowerCase()) ||
      s.description.toLowerCase().includes(navSearch.toLowerCase());
    return hasAccess && matchesSearch;
  });

  return (
    <div className="flex flex-col h-full bg-slate-50">
      <div className="bg-white border-b border-slate-200 px-4 sm:px-8 py-4">
        <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
          <span>Settings</span>
          <CaretRight className="h-4 w-4" />
          <span className="font-medium text-slate-900">
            {sections.find(s => location.pathname.startsWith(s.path))?.label || 'Overview'}
          </span>
        </div>
        <h1 className="text-2xl font-bold text-slate-900">Settings</h1>
        <p className="text-slate-500 mt-1">Configure your operations, policies, and system preferences.</p>
      </div>

      {/* Stacks on phones: the section nav becomes a horizontal, scrollable
          strip above the content instead of a fixed sidebar squeezing it. */}
      <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
        {/* Settings Sidebar */}
        <nav className="w-full md:w-64 shrink-0 bg-white md:border-r border-b md:border-b-0 border-slate-200 md:overflow-y-auto py-3 md:py-4 flex flex-col">
          <div className="px-4 mb-3 md:mb-4 hidden md:block">
             <div className="relative">
                <MagnifyingGlass className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search settings..."
                  value={navSearch}
                  onChange={(e) => setNavSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-sm bg-slate-50 border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
             </div>
          </div>
          <div className="flex md:flex-col gap-1 md:space-y-0 px-3 flex-1 overflow-x-auto md:overflow-x-visible scrollbar-hide">
            {filteredSections.map((section) => {
              const isActive = location.pathname.startsWith(section.path);
              return (
                <NavLink
                  key={section.id}
                  to={section.path}
                  className={({ isActive }) => cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors group whitespace-nowrap shrink-0 md:shrink md:whitespace-normal',
                    isActive
                      ? 'bg-secondary text-primary'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  )}
                >
                  <section.icon className={cn(
                    "h-5 w-5 flex-shrink-0",
                    isActive ? "text-primary" : "text-slate-400 group-hover:text-slate-500"
                  )} />
                  <div className="flex-1 text-left">
                    <div className="leading-none">{section.label}</div>
                  </div>
                </NavLink>
              );
            })}
          </div>
        </nav>

        {/* Content Area */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-8">
          <div className="max-w-4xl mx-auto">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}