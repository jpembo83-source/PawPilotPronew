import React, { useEffect } from 'react';
import { NavLink, useLocation, Navigate, Outlet } from 'react-router';
import { useSettingsStore } from './store';
import { cn } from '../../components/ui/utils';
import { useAuth } from '../../context/AuthContext';
import { getAccessibleSections, hasSettingsPermission } from './utils/rbac';
import { SettingsSection as SettingsSectionKey } from './types/permissions';
import { 
  Building2,
  Layers,
  MapPin,
  Users,
  Tag,
  BookOpen,
  MessageSquare,
  Receipt,
  ShieldCheck,
  Workflow,
  LayoutDashboard,
  Settings2,
  ChevronRight,
  Search
} from 'lucide-react';

interface SettingsSection {
  id: string;
  label: string;
  icon: React.ElementType;
  path: string;
  description: string;
  sectionKey: SettingsSectionKey;
}

const sections: SettingsSection[] = [
  { id: 'org', label: 'Organisation', icon: Building2, path: '/settings/organisation', description: 'Profile, brand, and global defaults', sectionKey: 'organisation' },
  { id: 'modules', label: 'Modules', icon: Layers, path: '/settings/modules', description: 'Enable/disable platform modules', sectionKey: 'modules' },
  { id: 'locations', label: 'Locations', icon: MapPin, path: '/settings/locations', description: 'Manage branches and capacity', sectionKey: 'locations' },
  { id: 'users', label: 'Users & Access', icon: Users, path: '/settings/users', description: 'Staff accounts and roles', sectionKey: 'users' },
  { id: 'services', label: 'Services & Pricing', icon: Tag, path: '/settings/services', description: 'Service catalogue and price books', sectionKey: 'services' },
  { id: 'ops', label: 'Operations Rules', icon: BookOpen, path: '/settings/operations', description: 'Booking and check-in policies', sectionKey: 'operations' },
  { id: 'comms', label: 'Communications', icon: MessageSquare, path: '/settings/communications', description: 'Templates and channels', sectionKey: 'communications' },
  { id: 'billing', label: 'Billing & Finance', icon: Receipt, path: '/settings/billing', description: 'Invoices, taxes, and penalties', sectionKey: 'billing' },
  { id: 'compliance', label: 'Data & Compliance', icon: ShieldCheck, path: '/settings/compliance', description: 'Retention and GDPR', sectionKey: 'compliance' },
  { id: 'integrations', label: 'Integrations', icon: Workflow, path: '/settings/integrations', description: 'API and webhooks', sectionKey: 'integrations' },
  { id: 'dashboard', label: 'Dashboard Config', icon: LayoutDashboard, path: '/settings/dashboard', description: 'Widget visibility and RBAC', sectionKey: 'dashboard' },
  { id: 'system', label: 'System', icon: Settings2, path: '/settings/system', description: 'Environment and maintenance', sectionKey: 'system' },
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
      <div className="bg-white border-b border-slate-200 px-8 py-4">
        <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
          <span>Settings</span>
          <ChevronRight className="h-4 w-4" />
          <span className="font-medium text-slate-900">
            {sections.find(s => location.pathname.startsWith(s.path))?.label || 'Overview'}
          </span>
        </div>
        <h1 className="text-2xl font-bold text-slate-900">Settings</h1>
        <p className="text-slate-500 mt-1">Configure your operations, policies, and system preferences.</p>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Settings Sidebar */}
        <nav className="w-64 bg-white border-r border-slate-200 overflow-y-auto py-4 flex flex-col">
          <div className="px-4 mb-4">
             <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                <input 
                  type="text" 
                  placeholder="Search settings..." 
                  value={navSearch}
                  onChange={(e) => setNavSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-sm bg-slate-50 border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
             </div>
          </div>
          <div className="space-y-1 px-3 flex-1">
            {filteredSections.map((section) => {
              const isActive = location.pathname.startsWith(section.path);
              return (
                <NavLink
                  key={section.id}
                  to={section.path}
                  className={({ isActive }) => cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors group',
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
        <main className="flex-1 overflow-y-auto p-8">
          <div className="max-w-4xl mx-auto">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}