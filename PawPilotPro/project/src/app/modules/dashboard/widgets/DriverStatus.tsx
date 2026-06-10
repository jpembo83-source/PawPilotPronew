import React, { useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Badge } from '../../../components/ui/badge';
import { 
  Truck, 
  MapPin, 
  NavigationArrow, 
  User, 
  Clock,
  ArrowRight,
  Warning,
  CircleNotch,
  Plus
} from '@phosphor-icons/react';
import { useNavigate } from 'react-router';
import { useAuth } from '../../../context/AuthContext';
import { useTransportStore } from '../../transport/store';
import { useSettingsStore } from '../../settings/store';
import { format, isToday } from 'date-fns';
import { useDashboardStore } from '../store';

export function DriverStatus() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { selectedLocationId } = useDashboardStore();
  const { locations } = useSettingsStore();
  const { 
    jobs, 
    isLoading, 
    error,
    fetchJobs,
    clearError 
  } = useTransportStore();

  // Get today's date in YYYY-MM-DD format
  const today = new Date().toISOString().split('T')[0];

  // Fetch jobs for selected location and date
  useEffect(() => {
    if (selectedLocationId && selectedLocationId !== 'ALL') {
      fetchJobs({ 
        location_id: selectedLocationId,
        service_date: today
      });
    }
  }, [selectedLocationId]); // Remove fetchJobs and today from dependencies to prevent infinite loop

  // Check if Transport feature is enabled for selected location
  const selectedLocation = locations.find(l => l.id === selectedLocationId);
  const transportEnabled = selectedLocation?.enabledModules?.includes('transport') ?? false;

  // Filter jobs for today
  const todaysJobs = jobs.filter(job => {
    const jobDate = new Date(job.service_date);
    return isToday(jobDate);
  });

  // Calculate stats
  const scheduledJobs = todaysJobs.filter(j => j.status === 'scheduled');
  const inProgressJobs = todaysJobs.filter(j => j.status === 'in_progress');
  const completedJobs = todaysJobs.filter(j => j.status === 'completed');
  const unassignedJobs = scheduledJobs.filter(j => !j.assigned_driver_user_id);

  // "All Locations" mode
  if (selectedLocationId === 'ALL') {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Truck className="h-5 w-5" />
            Transport
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <MapPin className="h-8 w-8 text-slate-300 mx-auto mb-3" />
            <p className="text-sm text-slate-600 mb-1">Select a location</p>
            <p className="text-xs text-slate-500">
              Transport jobs are location-specific
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Feature not enabled
  if (!transportEnabled) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Truck className="h-5 w-5" />
            Transport
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="bg-slate-50 rounded-lg p-4 text-center">
            <Warning className="h-6 w-6 text-slate-400 mx-auto mb-2" />
            <p className="text-sm text-slate-600">
              Transport not enabled for this location
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Loading state
  if (isLoading && jobs.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Truck className="h-5 w-5" />
            Transport
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <CircleNotch className="h-6 w-6 text-slate-400 animate-spin" />
          </div>
        </CardContent>
      </Card>
    );
  }

  // Error state
  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Truck className="h-5 w-5" />
            Transport
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-start gap-2">
              <Warning className="h-5 w-5 text-red-500 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-red-800 mb-1">
                  Failed to load transport jobs
                </p>
                <p className="text-xs text-red-600 mb-3">
                  {error}
                </p>
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => {
                    clearError();
                    if (selectedLocationId !== 'ALL') {
                      fetchJobs({ 
                        location_id: selectedLocationId,
                        service_date: today
                      });
                    }
                  }}
                >
                  Retry
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Truck className="h-5 w-5" />
            Transport
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(`/transport?location=${selectedLocationId}&date=${today}`)}
            className="text-xs"
          >
            View All
            <ArrowRight className="h-3 w-3 ml-1" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Stats Summary */}
        <div className="grid grid-cols-4 gap-2">
          <div className="bg-slate-50 rounded-lg p-2 text-center">
            <div className="text-lg font-bold text-slate-900">{todaysJobs.length}</div>
            <div className="text-[10px] text-slate-500 uppercase tracking-wide">Total</div>
          </div>
          <div className="bg-amber-50 rounded-lg p-2 text-center">
            <div className="text-lg font-bold text-amber-700">{unassignedJobs.length}</div>
            <div className="text-[10px] text-amber-600 uppercase tracking-wide">Unassigned</div>
          </div>
          <div className="bg-green-50 rounded-lg p-2 text-center">
            <div className="text-lg font-bold text-green-700">{inProgressJobs.length}</div>
            <div className="text-[10px] text-green-600 uppercase tracking-wide">Active</div>
          </div>
          <div className="bg-blue-50 rounded-lg p-2 text-center">
            <div className="text-lg font-bold text-blue-700">{completedJobs.length}</div>
            <div className="text-[10px] text-blue-600 uppercase tracking-wide">Done</div>
          </div>
        </div>

        {/* Job List */}
        {todaysJobs.length === 0 ? (
          <div className="text-center py-6 bg-slate-50 rounded-lg">
            <NavigationArrow className="h-8 w-8 text-slate-300 mx-auto mb-2" />
            <p className="text-sm text-slate-600 mb-1">No transport jobs today</p>
            <p className="text-xs text-slate-500 mb-3">
              Schedule transport for customers
            </p>
            <Button 
              size="sm" 
              onClick={() => navigate(`/transport/jobs/new?location=${selectedLocationId}`)}
            >
              <Plus className="h-3 w-3 mr-1" />
              New Transport Job
            </Button>
          </div>
        ) : (
          <div className="space-y-2 max-h-[300px] overflow-y-auto">
            {todaysJobs.slice(0, 8).map(job => {
              const statusColors = {
                scheduled: 'bg-slate-100 text-slate-700',
                in_progress: 'bg-green-100 text-green-700',
                completed: 'bg-blue-100 text-blue-700',
                cancelled: 'bg-red-100 text-red-700'
              };

              const directionIcons = {
                pickup: '↑',
                dropoff: '↓',
                roundtrip: '↕'
              };

              return (
                <div
                  key={job.id}
                  onClick={() => navigate(`/transport/jobs/${job.id}`)}
                  className="bg-white border border-slate-200 rounded-lg p-3 hover:border-slate-300 hover:shadow-sm transition-all cursor-pointer"
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm text-slate-900 truncate">
                        {job.pet_name}
                      </div>
                      <div className="text-xs text-slate-500 truncate">
                        {job.household_name}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <Badge 
                        variant="secondary" 
                        className={`${statusColors[job.status]} text-[10px] px-1.5 py-0`}
                      >
                        {job.status === 'in_progress' ? 'Active' : job.status}
                      </Badge>
                      <span className="text-lg" title={job.direction}>
                        {directionIcons[job.direction]}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 text-xs text-slate-500">
                    {job.time_window_start && (
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        <span>{job.time_window_start}</span>
                      </div>
                    )}
                    {job.assigned_driver_user_id ? (
                      <div className="flex items-center gap-1">
                        <User className="h-3 w-3" />
                        <span className="truncate">Assigned</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 text-amber-600">
                        <Warning className="h-3 w-3" />
                        <span>Needs driver</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Quick Actions */}
        {todaysJobs.length > 0 && (
          <div className="pt-2 border-t border-slate-200 flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="flex-1 text-xs"
              onClick={() => navigate(`/transport?location=${selectedLocationId}&date=${today}`)}
            >
              Manage Jobs
            </Button>
            <Button
              size="sm"
              className="flex-1 text-xs"
              onClick={() => navigate(`/transport/jobs/new?location=${selectedLocationId}`)}
            >
              <Plus className="h-3 w-3 mr-1" />
              New Job
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}