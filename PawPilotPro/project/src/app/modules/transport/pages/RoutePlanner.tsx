/**
 * Route Planner - Production-grade with live customer data
 * NO SEED/MOCK DATA - All transport jobs reference real households and pets
 * British English throughout
 */

import React, { useState, useEffect } from 'react';
import { useTransportStore } from '../store';
import { useSettingsStore } from '../../settings/store';
import { usePermissions } from '@/app/hooks/usePermissions';
import { Button } from '@/app/components/ui/button';
import { Badge } from '@/app/components/ui/badge';
import { CalendarBlank, MapPin, Truck, Plus, Warning, CircleNotch, Trash } from '@phosphor-icons/react';
import { format, startOfToday } from 'date-fns';
import { toast } from 'sonner';
import { useConfirmDialog } from '@/app/hooks/useConfirmDialog';
import { CreateTransportJobDialog } from '../components/CreateTransportJobDialog';

export function RoutePlanner() {
  const { jobs, vehicles, isLoading, error, fetchJobs, fetchVehicles, deleteJob } = useTransportStore();
  const { locations } = useSettingsStore();
  const { hasPermission } = usePermissions();
  const { confirm, confirmDialog } = useConfirmDialog();

  const [selectedDate, setSelectedDate] = useState<Date>(startOfToday());
  const [selectedLocation, setSelectedLocation] = useState<string>('');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  
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
      fetchJobs({
        location_id: selectedLocation,
        service_date: dateStr
      });
      fetchVehicles(selectedLocation);
    }
  }, [selectedLocation, dateStr]);
  
  const scheduledJobs = jobs.filter(j => j.status === 'scheduled');
  const inProgressJobs = jobs.filter(j => j.status === 'in_progress');
  const completedJobs = jobs.filter(j => j.status === 'completed');
  
  // Debug logging
  console.log('[RoutePlanner] Current state:', { 
    totalJobs: jobs.length, 
    scheduledCount: scheduledJobs.length,
    inProgressCount: inProgressJobs.length,
    completedCount: completedJobs.length,
    isLoading,
    error,
    selectedLocation,
    dateStr
  });
  
  const handleDeleteJob = async (jobId: string) => {
    const confirmed = await confirm({
      title: 'Delete this transport job?',
      description: 'This action cannot be undone.',
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (!confirmed) {
      return;
    }

    try {
      await deleteJob(jobId);
    } catch (err) {
      console.error('Error deleting job:', err);
      toast.error('Failed to delete transport job. Please try again.');
    }
  };
  
  return (
    <div className="h-[calc(100vh-100px)] flex flex-col gap-4">
      {/* Create Transport Job Dialog */}
      <CreateTransportJobDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        defaultDate={selectedDate}
        defaultLocationId={selectedLocation}
        onJobCreated={async () => {
          // Refresh jobs list
          console.log('[RoutePlanner] Job created callback triggered');
          console.log('[RoutePlanner] Current filters:', { selectedLocation, dateStr });
          if (selectedLocation) {
            try {
              console.log('[RoutePlanner] About to call fetchJobs...');
              await fetchJobs({
                location_id: selectedLocation,
                service_date: dateStr
              });
              console.log('[RoutePlanner] fetchJobs completed');
            } catch (err) {
              console.error('[RoutePlanner] Error calling fetchJobs:', err);
            }
          } else {
            console.log('[RoutePlanner] Skipping fetchJobs - missing location');
          }
        }}
      />

      {/* Header */}
      <div className="flex items-center justify-between bg-white p-4 rounded-lg border border-slate-200 shadow-sm shrink-0">
        <div className="flex items-center gap-4">
          <h2 className="text-lg font-semibold text-slate-900">Transport Planner</h2>
          <div className="flex items-center bg-slate-100 rounded-md px-3 py-1 text-sm text-slate-700">
            <CalendarBlank className="h-4 w-4 mr-2 text-slate-500" />
            {format(selectedDate, 'EEE, MMM d, yyyy')}
          </div>
          
          {/* Location Filter */}
          <select 
            value={selectedLocation}
            onChange={e => setSelectedLocation(e.target.value)}
            className="h-9 px-3 rounded-md border border-slate-200 text-sm bg-white"
          >
            {locations.map(loc => (
              <option key={loc.id} value={loc.id}>{loc.name}</option>
            ))}
          </select>
        </div>
        
        <div className="flex gap-2">
          <Button onClick={() => setShowCreateDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            New Transport Job
          </Button>
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
            <CircleNotch className="h-8 w-8 text-slate-400 animate-spin mx-auto mb-2" />
            <p className="text-slate-500">Loading transport jobs...</p>
          </div>
        </div>
      )}

      {/* Empty State - No jobs */}
      {!isLoading && !error && jobs.length === 0 && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center max-w-md">
            <div className="bg-slate-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
              <Truck className="h-8 w-8 text-slate-400" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900 mb-2">No Transport Jobs Scheduled</h3>
            <p className="text-slate-500 mb-4">
              There are no transport tasks for {format(selectedDate, 'MMMM d, yyyy')} at {locations.find(l => l.id === selectedLocation)?.name}.
            </p>
            <p className="text-sm text-slate-400">
              Transport jobs can be created manually or generated automatically from daycare, grooming, or overnight bookings that require transport.
            </p>
          </div>
        </div>
      )}

      {/* Jobs List */}
      {!isLoading && !error && jobs.length > 0 && (
        <div className="flex-1 overflow-auto space-y-6">
          
          {/* Scheduled Jobs */}
          {scheduledJobs.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wider mb-3 flex items-center gap-2">
                Scheduled
                <Badge variant="secondary">{scheduledJobs.length}</Badge>
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {scheduledJobs.map(job => (
                  <TransportJobCard
                    key={job.id}
                    job={job}
                    onDelete={hasPermission('transport', 'delete') ? handleDeleteJob : undefined}
                  />
                ))}
              </div>
            </div>
          )}

          {/* In Progress Jobs */}
          {inProgressJobs.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wider mb-3 flex items-center gap-2">
                In Progress
                <Badge className="bg-green-100 text-green-700 hover:bg-green-100">{inProgressJobs.length}</Badge>
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {inProgressJobs.map(job => (
                  <TransportJobCard key={job.id} job={job} />
                ))}
              </div>
            </div>
          )}

          {/* Completed Jobs */}
          {completedJobs.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wider mb-3 flex items-center gap-2">
                Completed
                <Badge variant="outline">{completedJobs.length}</Badge>
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {completedJobs.map(job => (
                  <TransportJobCard key={job.id} job={job} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
      {confirmDialog}
    </div>
  );
}

// Transport Job Card Component
function TransportJobCard({ job, onDelete }: { job: any, onDelete?: (jobId: string) => void }) {
  const directionColor = job.direction === 'pickup' ? 'text-green-600 bg-green-50' : 'text-orange-600 bg-orange-50';
  const directionLabel = job.direction === 'pickup' ? 'Pick up' : job.direction === 'dropoff' ? 'Drop off' : 'Round trip';
  
  return (
    <div className="bg-white rounded-lg border border-slate-200 p-4 hover:border-slate-300 transition-colors shadow-sm">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className={`px-2 py-1 rounded text-xs font-medium ${directionColor}`}>
            {directionLabel}
          </div>
          {job.time_window_start && job.time_window_end && (
            <span className="text-xs text-slate-500">
              {job.time_window_start} - {job.time_window_end}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Badge 
            variant={job.status === 'completed' ? 'outline' : job.status === 'in_progress' ? 'default' : 'secondary'}
            className={job.status === 'in_progress' ? 'bg-green-100 text-green-700 border-green-200' : ''}
          >
            {job.status.replace('_', ' ')}
          </Badge>
          {onDelete && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onDelete(job.id)}
              className="h-7 w-7 p-0 text-slate-400 hover:text-slate-600 hover:bg-slate-100"
            >
              <Trash className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      <div className="mb-3">
        <h4 className="font-semibold text-slate-900">{job.pet_name}</h4>
        <p className="text-sm text-slate-600">{job.household_name}</p>
      </div>

      <div className="space-y-2 text-sm">
        <div className="flex items-start gap-2">
          <MapPin className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-slate-600">
              {job.direction === 'pickup' ? job.address_pickup : job.address_dropoff}
            </p>
          </div>
        </div>

        {job.assigned_driver_user_id && (
          <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
            <Truck className="h-4 w-4 text-slate-400" />
            <span className="text-slate-600">
              {job.vehicle_name || 'Vehicle assigned'}
            </span>
          </div>
        )}

        {job.contact_phone && (
          <div className="text-xs text-slate-500 pt-2 border-t border-slate-100">
            Contact: {job.contact_phone}
          </div>
        )}
      </div>
    </div>
  );
}