// Billing Module - MDC Operations Centre
// Production-grade billing management with RBAC enforcement

import { useState, useMemo } from 'react';
import { BillingOverview } from './pages/BillingOverview';
import { Invoices } from './pages/Invoices';
import { BackendStatus } from '../../components/BackendStatus';
import { ModuleGate, PermissionGate, AdminOnly } from '../../components/PermissionGate';
import { usePermissions } from '../../hooks/usePermissions';
import { 
  Gauge, FileText, CreditCard, Repeat, 
  Receipt, Warning, DownloadSimple, Gear,
  Lock, Shield
} from '@phosphor-icons/react';

type BillingTab = 'overview' | 'invoices' | 'payments' | 'subscriptions' | 'credits' | 'fees' | 'exports' | 'settings';

// Define which permissions are required for each tab
const TAB_PERMISSIONS: Record<BillingTab, { module: string; action: 'view' | 'create' | 'update' | 'delete' | 'export' | 'approve' }[]> = {
  overview: [{ module: 'billing', action: 'view' }],
  invoices: [{ module: 'invoices', action: 'view' }],
  payments: [{ module: 'payments', action: 'view' }],
  subscriptions: [{ module: 'billing', action: 'view' }],
  credits: [{ module: 'billing', action: 'view' }, { module: 'billing', action: 'approve' }], // Credits require approve permission
  fees: [{ module: 'billing', action: 'view' }],
  exports: [{ module: 'billing', action: 'export' }], // Exports require export permission
  settings: [{ module: 'billing', action: 'update' }], // Gear require update permission
};

export function Billing() {
  const [activeTab, setActiveTab] = useState<BillingTab>('overview');
  const { hasPermission, hasAllPermissions, getModulePermissions, isAdmin } = usePermissions();

  // Filter tabs based on permissions
  const allTabs = [
    { id: 'overview' as const, label: 'Overview', icon: Gauge },
    { id: 'invoices' as const, label: 'Invoices', icon: FileText },
    { id: 'payments' as const, label: 'Payments', icon: CreditCard },
    { id: 'subscriptions' as const, label: 'Subscriptions', icon: Repeat },
    { id: 'credits' as const, label: 'Credits & Refunds', icon: Receipt },
    { id: 'fees' as const, label: 'Fees & Adjustments', icon: Warning },
    { id: 'exports' as const, label: 'Exports', icon: DownloadSimple },
    { id: 'settings' as const, label: 'Gear', icon: Gear },
  ];

  // Filter tabs to only show those the user has permission for
  const tabs = useMemo(() => {
    return allTabs.filter(tab => {
      const requiredPerms = TAB_PERMISSIONS[tab.id];
      // Check if user has ALL required permissions for this tab
      return requiredPerms.every(perm => hasPermission(perm.module, perm.action));
    });
  }, [hasPermission]);

  // Get user's billing permissions for display
  const billingPerms = getModulePermissions('billing');
  const invoicePerms = getModulePermissions('invoices');
  const paymentPerms = getModulePermissions('payments');

  return (
    <ModuleGate module="billing" showDeniedMessage>
      <div className="space-y-6">
        {/* Header */}
        <div className="border-b border-slate-200 pb-5">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-3xl font-semibold text-slate-900">Billing</h1>
              <p className="mt-1 text-sm text-slate-500">
                Financial operations, invoicing, and payment management
              </p>
            </div>
            {/* Permission indicator for non-admins */}
            {!isAdmin && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 rounded-full text-xs text-slate-600">
                <Shield className="h-3.5 w-3.5" />
                <span>
                  {billingPerms.includes('delete') ? 'Full Access' : 
                   billingPerms.includes('create') ? 'Create & Edit' :
                   billingPerms.includes('update') ? 'Edit Only' : 'View Only'}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Navigation Tabs - filtered by permission */}
        <div className="border-b border-slate-200">
          <div className="flex space-x-1 overflow-x-auto">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                    activeTab === tab.id
                      ? 'border-slate-900 text-slate-900'
                      : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Tab Content */}
        <div className="pb-8">
          {activeTab === 'overview' && <BillingOverview />}
          {activeTab === 'invoices' && <Invoices />}
          {activeTab === 'payments' && <PaymentsPlaceholder />}
          {activeTab === 'subscriptions' && <SubscriptionsPlaceholder />}
          {activeTab === 'credits' && <CreditsPlaceholder />}
          {activeTab === 'fees' && <FeesPlaceholder />}
          {activeTab === 'exports' && <ExportsPlaceholder />}
          {activeTab === 'settings' && <SettingsPlaceholder />}
        </div>
      </div>
    </ModuleGate>
  );
}

// Placeholder components for other tabs
function PaymentsPlaceholder() {
  return (
    <div className="text-center py-12">
      <CreditCard className="h-12 w-12 mx-auto mb-4 text-slate-300" />
      <h3 className="font-medium text-slate-900">Payments</h3>
      <p className="text-sm text-slate-500 mt-2">
        Payment recording and allocation coming soon
      </p>
    </div>
  );
}

function SubscriptionsPlaceholder() {
  return (
    <div className="text-center py-12">
      <Repeat className="h-12 w-12 mx-auto mb-4 text-slate-300" />
      <h3 className="font-medium text-slate-900">Subscriptions</h3>
      <p className="text-sm text-slate-500 mt-2">
        Membership billing and management coming soon
      </p>
    </div>
  );
}

function CreditsPlaceholder() {
  return (
    <div className="text-center py-12">
      <Receipt className="h-12 w-12 mx-auto mb-4 text-slate-300" />
      <h3 className="font-medium text-slate-900">Credits & Refunds</h3>
      <p className="text-sm text-slate-500 mt-2">
        Credit and refund management coming soon
      </p>
    </div>
  );
}

function FeesPlaceholder() {
  return (
    <div className="text-center py-12">
      <Warning className="h-12 w-12 mx-auto mb-4 text-slate-300" />
      <h3 className="font-medium text-slate-900">Fees & Adjustments</h3>
      <p className="text-sm text-slate-500 mt-2">
        Fee management and adjustments coming soon
      </p>
    </div>
  );
}

function ExportsPlaceholder() {
  return (
    <div className="text-center py-12">
      <DownloadSimple className="h-12 w-12 mx-auto mb-4 text-slate-300" />
      <h3 className="font-medium text-slate-900">Exports & Reconciliation</h3>
      <p className="text-sm text-slate-500 mt-2">
        Financial exports and reconciliation coming soon
      </p>
    </div>
  );
}

function SettingsPlaceholder() {
  return (
    <div className="text-center py-12">
      <Gear className="h-12 w-12 mx-auto mb-4 text-slate-300" />
      <h3 className="font-medium text-slate-900">Billing Gear</h3>
      <p className="text-sm text-slate-500 mt-2">
        Configure billing preferences (see Gear → Billing & Finance for full configuration)
      </p>
    </div>
  );
}