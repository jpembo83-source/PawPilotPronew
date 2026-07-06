import React from 'react';
import '../styles/theme.css';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ViewAsProvider } from './context/ViewAsContext';
import { Layout } from './components/layout/Layout';
import { MobileLayout } from './components/layout/MobileLayout';
import { useIsMobile } from './components/ui/use-mobile';
import { LoginPage } from './modules/auth/LoginPage';
import { ResetPasswordPage } from './modules/auth/ResetPasswordPage';
import { Daycare } from './modules/daycare/Daycare';
import { Grooming } from './modules/grooming';
import { Dashboard } from './modules/dashboard/Dashboard';
import { SettingsLayout } from './modules/settings/SettingsLayout';
import { SettingsOverview } from './modules/settings/pages/SettingsOverview';
import { OrganisationSettings } from './modules/settings/pages/OrganisationSettings';
import { LocationSettings } from './modules/settings/pages/LocationSettings';
import { ModuleSettings } from './modules/settings/pages/ModuleSettings';
import { DashboardSettings } from './modules/settings/pages/DashboardSettings';
import { ServiceCapacitySettings } from './modules/settings/pages/ServiceCapacitySettings';
import { Transportation } from './modules/transport/Transportation';
import { UserManagement } from './modules/settings/pages/UserManagement';
import { ServicesPricingPage } from './modules/services-pricing/pages/ServicesPricingPage';
import { ThemeManager } from './components/ThemeManager';
import { Toaster } from 'sonner';
import ErrorBoundary from './components/ErrorBoundary';
import { Overnights } from './modules/overnights/pages/Overnights';
import { CustomersPage, CreateHouseholdPage, HouseholdDetailPage, PetProfilePage, BulkImportPage, ExportPage, ClearDataPage, VaxReviewPage, PendingRequestsPage } from './modules/customers';
import { MessagingPage } from './modules/messaging/MessagingPage';
import { OperationalRulesPage } from './modules/operational-rules/OperationalRulesPage';
import { CommunicationsSettingsPage } from './modules/communications-settings';
import { BillingFinanceSettingsPage } from './modules/billing-finance-settings';
import { DataCompliancePage } from './modules/data-compliance';
import { IntegrationsSettingsPage } from './modules/integrations-settings';
import { SystemPage } from './modules/system';
import { Billing } from './modules/billing/Billing';
import { PolicyPortal } from './modules/policies';
import { IncidentsListPage, IncidentDetailPage } from './modules/incidents';
import { RBACDocumentationPage } from './modules/settings/pages/RBACDocumentationPage';
import { StaffPage, StaffMemberDetailPage } from './modules/staff';
import Packages from './modules/packages';
import CapacityDashboard from './modules/capacity';
import { BetaRoute } from './components/BetaRoute';
import { Reporting } from './modules/reporting';

// Placeholder components for unimplemented modules
const PlaceholderModule = ({ title }: { title: string }) => (
  <div className="flex flex-col items-center justify-center h-[50vh] text-center">
    <h2 className="text-2xl font-bold text-slate-300 mb-2">{title}</h2>
    <p className="text-slate-400">Module under construction.</p>
  </div>
);

// Component to redirect /app/* paths to remove the /app prefix
function AppPrefixRedirect() {
  const location = window.location.pathname;
  const newPath = location.replace('/app/', '/');
  return <Navigate to={newPath} replace />;
}

// Responsive layout that switches between mobile and desktop
function ResponsiveLayout() {
  const isMobile = useIsMobile();
  return isMobile ? <MobileLayout /> : <Layout />;
}

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  
  if (isLoading) return <div className="h-screen flex items-center justify-center bg-slate-50">Loading...</div>;
  
  return user ? <>{children}</> : <Navigate to="/login" />;
}

function PublicOnlyRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  
  if (isLoading) return null;
  
  return !user ? <>{children}</> : <Navigate to="/" />;
}

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Toaster position="top-right" />
        <AuthProvider>
          <ViewAsProvider>
            <ThemeManager />
            <Routes>
              {/* Redirect /app/* to remove the /app prefix */}
              <Route path="/app/*" element={<AppPrefixRedirect />} />
              
              <Route path="/login" element={
                <PublicOnlyRoute>
                  <LoginPage />
                </PublicOnlyRoute>
              } />

              {/* Standalone: must work regardless of the recovery session state */}
              <Route path="/reset-password" element={<ResetPasswordPage />} />
              
              <Route path="/" element={
                <PrivateRoute>
                  <ResponsiveLayout />
                </PrivateRoute>
              }>
                <Route index element={<Dashboard />} />
                <Route path="daycare/*" element={<Daycare />} />
                <Route path="grooming/*" element={<BetaRoute><Grooming /></BetaRoute>} />
                <Route path="overnights/*" element={<Overnights />} />
                <Route path="transport/*" element={<Transportation />} />
                <Route path="boutique" element={<PlaceholderModule title="Boutique & POS" />} />
                <Route path="customers" element={<CustomersPage />} />
                <Route path="customers/new" element={<CreateHouseholdPage />} />
                <Route path="customers/:householdId" element={<HouseholdDetailPage />} />
                <Route path="customers/pets/:petId" element={<PetProfilePage />} />
                <Route path="customers/bulk-import" element={<BulkImportPage />} />
                <Route path="customers/export" element={<ExportPage />} />
                <Route path="customers/clear-data" element={<ClearDataPage />} />
                <Route path="customers/vax-review" element={<VaxReviewPage />} />
                <Route path="customers/pending-requests" element={<PendingRequestsPage />} />
                {/* Beta-only routes - only visible to beta testers */}
                <Route path="messages" element={<BetaRoute><MessagingPage /></BetaRoute>} />
                <Route path="billing" element={<BetaRoute><Billing /></BetaRoute>} />
                <Route path="policies" element={<BetaRoute><PolicyPortal /></BetaRoute>} />
                <Route path="staff" element={<BetaRoute><StaffPage /></BetaRoute>} />
                <Route path="staff/member/:id" element={<BetaRoute><StaffMemberDetailPage /></BetaRoute>} />
                <Route path="packages/*" element={<BetaRoute><Packages /></BetaRoute>} />
                
                {/* Production routes */}
                <Route path="incidents" element={<IncidentsListPage />} />
                <Route path="incidents/:id" element={<IncidentDetailPage />} />
                <Route path="capacity" element={<CapacityDashboard />} />
                <Route path="reports/*" element={<Reporting />} />
                <Route path="settings" element={<SettingsLayout />}>
                  <Route index element={<SettingsOverview />} />
                  <Route path="organisation" element={<OrganisationSettings />} />
                  <Route path="modules" element={<ModuleSettings />} />
                  <Route path="locations" element={<LocationSettings />} />
                  <Route path="users" element={<UserManagement />} />
                  <Route path="services" element={<ServicesPricingPage />} />
                  <Route path="capacity" element={<ServiceCapacitySettings />} />
                  <Route path="operations" element={<OperationalRulesPage />} />
                  <Route path="communications" element={<CommunicationsSettingsPage />} />
                  <Route path="billing" element={<BillingFinanceSettingsPage />} />
                  <Route path="compliance" element={<DataCompliancePage />} />
                  <Route path="integrations" element={<IntegrationsSettingsPage />} />
                  <Route path="dashboard" element={<DashboardSettings />} />
                  <Route path="system" element={<SystemPage />} />
                  <Route path="rbac-docs" element={<RBACDocumentationPage />} />
                </Route>
              </Route>
            </Routes>
          </ViewAsProvider>
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
}