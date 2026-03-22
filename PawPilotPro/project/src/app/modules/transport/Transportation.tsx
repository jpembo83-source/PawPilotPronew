import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate, NavLink, useLocation } from 'react-router';
import { Truck, Calendar, Navigation, List, LayoutGrid, Smartphone, Monitor } from 'lucide-react';
import { TransportDashboard } from './pages/TransportDashboard';
import { JobsList } from './pages/JobsList';
import { CreateJob } from './pages/CreateJob';
import { JobDetail } from './pages/JobDetail';
import { RoutePlanner } from './pages/RoutePlanner';
import { VehicleManager } from './pages/VehicleManager';
import { DriverDashboard } from './pages/DriverDashboard';
import { DriverMobileView } from './pages/DriverMobileView';
import { usePermissions } from '@/app/hooks/usePermissions';

// Detect if on mobile device
function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);
  
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768 || /iPhone|iPad|iPod|Android/i.test(navigator.userAgent));
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);
  
  return isMobile;
}

export function Transportation() {
  const location = useLocation();
  const isMobile = useIsMobile();
  const { isAdmin, isManager } = usePermissions();
  const [forceDesktop, setForceDesktop] = useState(false);
  
  // Staff (drivers) on mobile go straight to driver view
  const isStaff = !isAdmin && !isManager;
  const showMobileDriverView = isMobile && isStaff && !forceDesktop;
  
  // Full-screen mobile driver view for staff
  if (showMobileDriverView) {
    return <DriverMobileView onExit={() => setForceDesktop(true)} />;
  }

  // Manager/Admin View (or staff who forced desktop)
  return (
    <div className="h-full flex flex-col">
      {/* Module Header */}
      <div className="bg-white border-b border-slate-200 px-4 md:px-6 py-3 flex flex-col md:flex-row md:items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-2">
          <div className="bg-blue-100 p-2 rounded-lg text-blue-600">
            <Truck className="h-5 w-5" />
          </div>
          <h1 className="text-xl font-bold text-slate-900">Transportation</h1>
        </div>
        
        {/* Navigation Tabs - scrollable on mobile */}
        <div className="flex bg-slate-100 p-1 rounded-lg overflow-x-auto">
          <NavLink 
            to="/transport" 
            end
            className={({ isActive }) => `flex items-center gap-2 px-3 md:px-4 py-1.5 rounded-md text-sm font-medium transition-all whitespace-nowrap ${isActive ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            <LayoutGrid className="h-4 w-4" />
            <span className="hidden sm:inline">Dashboard</span>
          </NavLink>
          <NavLink 
            to="/transport/jobs" 
            className={({ isActive }) => `flex items-center gap-2 px-3 md:px-4 py-1.5 rounded-md text-sm font-medium transition-all whitespace-nowrap ${isActive ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            <List className="h-4 w-4" />
            <span className="hidden sm:inline">Jobs</span>
          </NavLink>
          {(isAdmin || isManager) && (
            <NavLink 
              to="/transport/vehicles" 
              className={({ isActive }) => `flex items-center gap-2 px-3 md:px-4 py-1.5 rounded-md text-sm font-medium transition-all whitespace-nowrap ${isActive ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              <Truck className="h-4 w-4" />
              <span className="hidden sm:inline">Vehicles</span>
            </NavLink>
          )}
          <NavLink 
            to="/transport/driver" 
            className={({ isActive }) => `flex items-center gap-2 px-3 md:px-4 py-1.5 rounded-md text-sm font-medium transition-all whitespace-nowrap ${isActive ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            <Navigation className="h-4 w-4" />
            <span className="hidden sm:inline">Driver</span>
          </NavLink>
        </div>
        
        {/* View toggle for testing on desktop */}
        {!isMobile && (
          <NavLink
            to="/transport/driver-mobile"
            className="hidden md:flex items-center gap-2 px-3 py-1.5 text-sm text-slate-500 hover:text-slate-700"
          >
            <Smartphone className="h-4 w-4" />
            Mobile Preview
          </NavLink>
        )}
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-auto p-4 md:p-6 bg-slate-50/50">
        <Routes>
          <Route index element={<TransportDashboard />} />
          <Route path="jobs" element={<JobsList />} />
          <Route path="jobs/new" element={<CreateJob />} />
          <Route path="jobs/:jobId" element={<JobDetail />} />
          <Route path="planner" element={<RoutePlanner />} />
          <Route path="vehicles" element={<VehicleManager />} />
          <Route path="driver" element={isMobile ? <DriverMobileView /> : <DriverDashboard />} />
          <Route path="driver-mobile" element={<DriverMobileView />} />
        </Routes>
      </div>
    </div>
  );
}