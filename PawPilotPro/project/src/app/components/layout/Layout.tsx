import React, { useEffect } from 'react';
import { Sidebar } from './Sidebar';
import { Outlet } from 'react-router';
import { useSettingsStore } from '../../modules/settings/store';
import { ViewAsBanner } from '../view-as/ViewAsBanner';
import { OfflineBanner } from './OfflineBanner';
import { useAuth } from '../../context/AuthContext';

export function Layout() {
  const { fetchLocations, fetchOrganisation, fetchGlobalModules } = useSettingsStore();
  const { user, isLoading: isAuthLoading } = useAuth();

  useEffect(() => {
    // Only fetch when user is authenticated and not loading
    if (!isAuthLoading && user) {
      // Silently skip if these fail (e.g., when visiting Staff portal without platform login)
      fetchLocations().catch(err => console.debug('[Layout] fetchLocations skipped:', err.message));
      fetchOrganisation().catch(err => console.debug('[Layout] fetchOrganisation skipped:', err.message));
      fetchGlobalModules().catch(err => console.debug('[Layout] fetchGlobalModules skipped:', err.message));
    }
  }, [fetchLocations, fetchOrganisation, fetchGlobalModules, isAuthLoading, user]);

  return (
    <div className="flex flex-col h-screen w-full bg-[#F4F3EF] text-[#1C1916] font-sans">
      <ViewAsBanner />
      <OfflineBanner />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-auto h-full w-full bg-[#F4F3EF]">
          <div className="h-full w-full max-w-7xl mx-auto p-6 md:p-8">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}