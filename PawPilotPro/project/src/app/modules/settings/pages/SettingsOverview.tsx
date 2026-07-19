import React from 'react';
import { useNavigate } from 'react-router';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../components/ui/card';
import { useAuth } from '../../../context/AuthContext';
import { getAccessibleSections } from '../utils/rbac';
import { SettingsSection as SettingsSectionKey } from '../types/permissions';
import { 
  Buildings, 
  Stack, 
  MapPin, 
  UsersThree, 
  Tag, 
  BookOpen, 
  ChatTeardrop, 
  Receipt, 
  ShieldCheck,
  Gauge,
  SlidersHorizontal 
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
  { id: 'org', label: 'Organisation', icon: Buildings, path: '/settings/organisation', description: 'Legal entity, brand settings, and global operational defaults.', sectionKey: 'organisation' },
  { id: 'modules', label: 'Modules', icon: Stack, path: '/settings/modules', description: 'Enable/disable major functional modules across the organisation.', sectionKey: 'modules' },
  { id: 'locations', label: 'Locations', icon: MapPin, path: '/settings/locations', description: 'Manage branch profiles, operating hours, and capacity limits.', sectionKey: 'locations' },
  { id: 'users', label: 'Users & Access', icon: UsersThree, path: '/settings/users', description: 'Staff accounts, roles, permissions, and security policies.', sectionKey: 'users' },
  { id: 'services', label: 'Services & Pricing', icon: Tag, path: '/settings/services', description: 'Service catalogue, price books, memberships, and packages.', sectionKey: 'services' },
  { id: 'ops', label: 'Operations Rules', icon: BookOpen, path: '/settings/operations', description: 'Booking policies, vaccination requirements, and incident rules.', sectionKey: 'operations' },
  { id: 'comms', label: 'Communications', icon: ChatTeardrop, path: '/settings/communications', description: 'Email/SMS templates, notification channels, and consent.', sectionKey: 'communications' },
  { id: 'billing', label: 'Billing & Finance', icon: Receipt, path: '/settings/billing', description: 'Payment providers, tax settings, invoices, and penalties.', sectionKey: 'billing' },
  { id: 'compliance', label: 'Data & Compliance', icon: ShieldCheck, path: '/settings/compliance', description: 'Data retention, GDPR requests, and document requirements.', sectionKey: 'compliance' },
  // 'Integrations' hidden — sync runner is a stub, nothing live uses it
  // (Invoxia runs via its own edge functions). See SettingsLayout.tsx.
  // 'Dashboard Config' removed — see SettingsLayout.tsx for the why.
  { id: 'system', label: 'Advanced / Maintenance', icon: SlidersHorizontal, path: '/settings/system', description: 'Feature flags, environment, health, and maintenance safeguards.', sectionKey: 'system' },
];

export function SettingsOverview() {
  const navigate = useNavigate();
  const { user } = useAuth();
  
  if (!user) return null;
  
  // Get accessible sections for this user
  const accessibleSectionKeys = getAccessibleSections(user.role);
  
  // Filter sections by permissions
  const accessibleSections = sections.filter(s => 
    accessibleSectionKeys.includes(s.sectionKey)
  );

  return (
    <div className="space-y-6">
      {/* RBAC Documentation Link */}
      {user.role === 'admin' || user.role === 'manager' && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <ShieldCheck className="h-5 w-5 text-blue-600 mt-0.5" />
            <div className="flex-1">
              <h3 className="font-semibold text-blue-900">Settings Access Control</h3>
              <p className="text-sm text-blue-700 mt-1">
                View the complete RBAC model and your permissions for all settings sections.
              </p>
              <button
                onClick={() => navigate('/settings/rbac-documentation')}
                className="mt-2 text-sm font-medium text-blue-600 hover:text-blue-800 underline"
              >
                View RBAC Documentation →
              </button>
            </div>
          </div>
        </div>
      )}
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {accessibleSections.map((section) => (
          <button
            key={section.id}
            onClick={() => navigate(section.path)}
            className="flex items-start gap-4 p-5 bg-white border border-slate-200 rounded-lg hover:border-primary/50 hover:shadow-md transition-all text-left group"
          >
            <div className="p-2 bg-slate-50 rounded-lg group-hover:bg-secondary transition-colors">
              <section.icon className="h-6 w-6 text-slate-500 group-hover:text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 group-hover:text-primary">{section.label}</h3>
              <p className="text-sm text-slate-500 mt-1">{section.description}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}