/**
 * Transport Dashboard - Main operational view for managers/admins
 * Shows today's transport jobs with KPI cards and actionable job list
 * British English throughout, production-grade, no mock data
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { useTransportStore } from '../store';
import { useSettingsStore } from '../../settings/store';
import { Button } from '@/app/components/ui/button';
import { Badge } from '@/app/components/ui/badge';
import { 
  CalendarBlank, 
  MapPin, 
  Truck, 
  Plus, 
  Warning, 
  CircleNotch,
  Clock,
  CheckCircle,
  Circle,
  NavigationArrow,
  ArrowRight,
  UsersThree
} from '@phosphor-icons/react';
import { format, startOfToday } from 'date-fns';
import { CreateTransportJobDialog } from '../components/CreateTransportJobDialog';
import { CreateFromBookingsDialog } from '../components/CreateFromBookingsDialog';
import type { TransportJobWithDetails } from '../types';

export function TransportDashboard() {
  const navigate = useNavigate();
  const { jobs, isLoading, error, fetchJobs } = useTransportStore();
  const { locations } = useSettingsStore();

  const [selectedDate, setSelectedDate] = useState<Date>(startOfToday());
  const [selectedLocation, setSelectedLocation] = useState<string>('');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showFromBookingsDialog, setShowFromBookingsDialog] = useState(false);
  
  const dateStr = format(selectedDate, 'yyyy-MM-dd');
  
  // Initialize location from user's first location
  useEffect(() => {
    if (!selectedLocation && locations.length > 0) {
      setSelectedLocation(locations[0].id);
    }
  }, [locations, selectedLocation]);
  
  // Fetch data when filters change
  useEffect(() => {
    if (selectedLocation) {
      fetchJobs({ location_id: selectedLocation, service_date: dateStr });
    }
  }, [selectedLocation, dateStr, fetchJobs]);

  // Auto-refresh every 30 seconds so the dispatcher sees live status updates
  useEffect(() => {
    if (!selectedLocation) return;
    const interval = setInterval(() => {
      if (document.visibilityState !== 'hidden') {
        fetchJobs({ location_id: selectedLocation, service_date: dateStr });
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [selectedLocation, dateStr, fetchJobs]);
  
  // Calculate KPIs
  const todaysJobs = jobs;
  const pickupJobs = jobs.filter(j => j.direction === 'pickup' || j.direction === 'roundtrip');
  const dropoffJobs = jobs.filter(j => j.direction === 'dropoff' || j.direction === 'roundtrip');
  const inProgressJobs = jobs.filter(j => j.status === 'in_progress');
  const completedJobs = jobs.filter(j => j.status === 'completed');
  const unassignedJobs = jobs.filter(j => !j.assigned_driver_user_id && j.status === 'scheduled');
  
  const handleJobClick = (jobId: string) => {
    navigate(`/transport/jobs/${jobId}`);
  };
  
  const handleCreateSuccess = async () => {
    // Refresh jobs list after successful creation
    if (selectedLocation) {
      await fetchJobs({
        location_id: selectedLocation,
        service_date: dateStr
      });
    }
  };
  
  return (
    <div className="h-[calc(100vh-100px)] flex flex-col gap-6">
      {/* Dialogs */}
      <CreateTransportJobDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        defaultDate={selectedDate}
        defaultLocationId={selectedLocation}
        onJobCreated={handleCreateSuccess}
      />
      <CreateFromBookingsDialog
        open={showFromBookingsDialog}
        onOpenChange={setShowFromBookingsDialog}
        date={selectedDate}
        locationId={selectedLocation}
        onCreated={handleCreateSuccess}
      />

      {/* Header — stacks on mobile; the old fixed rows overflowed the
          viewport on phones. */}
      <div className="bg-card p-4 md:p-6 rounded-lg border border-border shadow-sm shrink-0">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold text-foreground">Transport Dashboard</h2>
            <p className="text-muted-foreground mt-1">Manage daily transport operations</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={() => setShowFromBookingsDialog(true)}
              disabled={!selectedLocation}
              title="Batch-create jobs from today's confirmed bookings that require transport"
              className="w-full sm:w-auto"
            >
              <CalendarBlank className="h-4 w-4 mr-2" />
              From Bookings
            </Button>
            <Button onClick={() => setShowCreateDialog(true)} size="lg" className="w-full sm:w-auto">
              <Plus className="h-4 w-4 mr-2" />
              New Transport Job
            </Button>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
          {/* Date Selector — 44px touch target on mobile */}
          <div className="flex items-center gap-2">
            <CalendarBlank className="h-4 w-4 text-muted-foreground shrink-0" />
            <input
              type="date"
              value={dateStr}
              onChange={e => setSelectedDate(new Date(e.target.value))}
              className="h-11 md:h-10 px-3 rounded-md border border-input text-sm bg-input-background text-foreground flex-1 sm:flex-none"
            />
          </div>

          {/* Location Filter */}
          <select
            value={selectedLocation}
            onChange={e => setSelectedLocation(e.target.value)}
            className="h-11 md:h-10 px-3 rounded-md border border-input text-sm bg-input-background text-foreground w-full sm:w-auto"
          >
            <option value="">Select Location</option>
            {locations.map(loc => (
              <option key={loc.id} value={loc.id}>{loc.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
          <Warning className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
          <div>
            <h4 className="font-medium text-red-900">Error Loading Transport Data</h4>
            <p className="text-sm text-red-700 mt-1">{error}</p>
          </div>
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <CircleNotch className="h-8 w-8 text-muted-foreground animate-spin mx-auto mb-2" />
            <p className="text-muted-foreground">Loading transport jobs...</p>
          </div>
        </div>
      )}

      {/* Main Content */}
      {!isLoading && !error && selectedLocation && (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 shrink-0">
            <KPICard 
              title="Today's Jobs" 
              value={todaysJobs.length} 
              icon={<Truck className="h-4 w-4" />}
              color="blue"
            />
            <KPICard 
              title="Pick-ups" 
              value={pickupJobs.length} 
              icon={<ArrowRight className="h-4 w-4" />}
              color="green"
            />
            <KPICard 
              title="Drop-offs" 
              value={dropoffJobs.length} 
              icon={<ArrowRight className="h-4 w-4 rotate-180" />}
              color="orange"
            />
            <KPICard 
              title="In Progress" 
              value={inProgressJobs.length} 
              icon={<NavigationArrow className="h-4 w-4" />}
              color="purple"
            />
            <KPICard 
              title="Completed" 
              value={completedJobs.length} 
              icon={<CheckCircle className="h-4 w-4" />}
              color="teal"
            />
            <KPICard 
              title="Unassigned" 
              value={unassignedJobs.length} 
              icon={<Warning className="h-4 w-4" />}
              color="red"
              highlight={unassignedJobs.length > 0}
            />
          </div>

          {/* Unassigned Jobs Alert */}
          {unassignedJobs.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 shrink-0">
              <div className="flex items-start gap-3">
                <Warning className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-medium text-amber-900">
                    {unassignedJobs.length} job{unassignedJobs.length !== 1 ? 's' : ''} awaiting driver assignment
                  </h4>
                  <p className="text-sm text-amber-700 mt-1">
                    Assign drivers to ensure all transport jobs are covered
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Jobs List */}
          <div className="flex-1 overflow-auto bg-card rounded-lg border border-border shadow-sm">
            {jobs.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center max-w-md p-8">
                  <div className="bg-muted w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Truck className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">No Transport Jobs</h3>
                  <p className="text-muted-foreground mb-4">
                    There are no transport tasks scheduled for {format(selectedDate, 'MMMM d, yyyy')} at{' '}
                    {locations.find(l => l.id === selectedLocation)?.name}.
                  </p>
                  <Button onClick={() => setShowCreateDialog(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Create First Job
                  </Button>
                </div>
              </div>
            ) : (
              <div className="divide-y divide-border min-w-[880px]">
                {/* Table Header */}
                <div className="grid grid-cols-12 gap-4 px-6 py-3 bg-muted text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  <div className="col-span-1">Status</div>
                  <div className="col-span-2">Pet & Household</div>
                  <div className="col-span-1">Direction</div>
                  <div className="col-span-2">Time Window</div>
                  <div className="col-span-3">Address</div>
                  <div className="col-span-2">Driver</div>
                  <div className="col-span-1">Actions</div>
                </div>
                
                {/* Jobs */}
                {jobs.map(job => (
                  <JobRow 
                    key={job.id} 
                    job={job} 
                    onClick={() => handleJobClick(job.id)}
                  />
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// KPI Card Component
function KPICard({ 
  title, 
  value, 
  icon, 
  color,
  highlight = false 
}: { 
  title: string; 
  value: number; 
  icon: React.ReactNode;
  color: string;
  highlight?: boolean;
}) {
  const colorMap: Record<string, string> = {
    blue: 'bg-blue-100 text-blue-600',
    green: 'bg-green-100 text-green-600',
    orange: 'bg-orange-100 text-orange-600',
    purple: 'bg-purple-100 text-purple-600',
    teal: 'bg-teal-100 text-teal-600',
    red: 'bg-red-100 text-red-600'
  };
  
  return (
    <div className={`bg-card rounded-lg border p-4 ${highlight ? 'border-amber-300 shadow-md' : 'border-border shadow-sm'}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{title}</span>
        <div className={`p-1.5 rounded ${colorMap[color]}`}>
          {icon}
        </div>
      </div>
      <div className="text-2xl font-bold text-foreground">{value}</div>
    </div>
  );
}

// Job Row Component
function JobRow({ job, onClick }: { job: TransportJobWithDetails; onClick: () => void }) {
  const statusColors: Record<string, string> = {
    scheduled: 'bg-muted text-foreground',
    in_progress: 'bg-green-100 text-green-700',
    completed: 'bg-teal-100 text-teal-700',
    failed: 'bg-orange-100 text-orange-700',
    cancelled: 'bg-red-100 text-red-700'
  };
  
  const directionColors = {
    pickup: 'text-green-600 bg-green-50',
    dropoff: 'text-orange-600 bg-orange-50',
    roundtrip: 'text-blue-600 bg-blue-50'
  };
  
  const address = job.direction === 'pickup' 
    ? job.address_pickup 
    : job.direction === 'dropoff'
    ? job.address_dropoff
    : `${job.address_pickup} → ${job.address_dropoff}`;
  
  return (
    <div 
      onClick={onClick}
      className="grid grid-cols-12 gap-4 px-6 py-4 hover:bg-muted/50 cursor-pointer transition-colors"
    >
      <div className="col-span-1">
        <Badge className={statusColors[job.status]}>
          {job.status.replace('_', ' ')}
        </Badge>
      </div>
      
      <div className="col-span-2">
        <div className="font-medium text-foreground">{job.pet_name}</div>
        <div className="text-sm text-muted-foreground">{job.household_name}</div>
      </div>
      
      <div className="col-span-1">
        <div className={`inline-flex px-2 py-1 rounded text-xs font-medium ${directionColors[job.direction]}`}>
          {job.direction === 'roundtrip' ? 'round trip' : job.direction}
        </div>
      </div>
      
      <div className="col-span-2">
        {job.time_window_start && job.time_window_end ? (
          <div className="flex items-center gap-1 text-sm text-muted-foreground">
            <Clock className="h-3 w-3" />
            {job.time_window_start} - {job.time_window_end}
          </div>
        ) : (
          <span className="text-sm text-muted-foreground">No time set</span>
        )}
      </div>
      
      <div className="col-span-3">
        <div className="flex items-start gap-2 text-sm text-muted-foreground">
          <MapPin className="h-4 w-4 shrink-0 mt-0.5 text-muted-foreground" />
          <span className="line-clamp-2">{address}</span>
        </div>
      </div>
      
      <div className="col-span-2">
        {job.assigned_driver_user_id ? (
          <div className="flex items-center gap-2">
            <UsersThree className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">
              {job.vehicle_name || 'Assigned'}
            </span>
          </div>
        ) : (
          <Badge variant="outline" className="text-amber-600 border-amber-300">
            Unassigned
          </Badge>
        )}
      </div>
      
      <div className="col-span-1">
        <Button
          variant={!job.assigned_driver_user_id && job.status === 'scheduled' ? 'default' : 'ghost'}
          size="sm"
          onClick={(e) => { e.stopPropagation(); onClick(); }}
          className={!job.assigned_driver_user_id && job.status === 'scheduled' ? 'text-xs' : ''}
        >
          {!job.assigned_driver_user_id && job.status === 'scheduled' ? 'Assign' : 'View'}
        </Button>
      </div>
    </div>
  );
}