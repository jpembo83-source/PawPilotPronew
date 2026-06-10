// Grooming Dashboard - MDC Operations Centre
// Operational home for grooming salon with today's overview and quick actions

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { useGroomingStore } from '../store';
import { useDashboardStore } from '../../dashboard/store';
import { useAuth } from '../../../context/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Badge } from '../../../components/ui/badge';
import { 
  CalendarBlank, 
  UsersThree, 
  Clock, 
  Scissors,
  Plus,
  Warning,
  CheckCircle,
  Play,
  UserCheck,
} from '@phosphor-icons/react';
import { toast } from 'sonner';
import { APPOINTMENT_STATUSES, SERVICE_TYPES } from '../types';

export function GroomingDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { selectedLocationId } = useDashboardStore();
  const { 
    stats, 
    queue,
    groomers,
    isLoading, 
    error, 
    fetchStats, 
    fetchQueue,
    fetchGroomers,
    clearError 
  } = useGroomingStore();
  
  const [currentTime, setCurrentTime] = useState(new Date());
  const today = new Date().toISOString().split('T')[0];
  
  useEffect(() => {
    loadData();
    const interval = setInterval(() => {
      setCurrentTime(new Date());
      loadData(); // Refresh data every minute
    }, 60000);
    return () => clearInterval(interval);
  }, [selectedLocationId]);
  
  useEffect(() => {
    if (error) {
      toast.error(error);
      clearError();
    }
  }, [error]);
  
  const loadData = async () => {
    const locationId = selectedLocationId === 'ALL' ? undefined : selectedLocationId;
    await Promise.all([
      fetchStats(locationId, today),
      fetchQueue(locationId),
      fetchGroomers(locationId),
    ]);
  };
  
  const canCreate = user?.role === 'admin' || user?.role === 'manager' || user?.role === 'assistant_manager' || user?.role === 'staff';
  
  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Grooming Salon</h1>
          <p className="text-slate-600 mt-1">
            {currentTime.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            {' · '}
            {currentTime.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {canCreate && (
            <Button onClick={() => navigate('/grooming/appointments?action=create')}>
              <Plus className="h-4 w-4 mr-2" />
              New Appointment
            </Button>
          )}
        </div>
      </div>
      
      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card 
          className="cursor-pointer hover:shadow-lg transition-shadow"
          onClick={() => navigate(`/grooming/appointments?date=${today}`)}
        >
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <CalendarBlank className="h-4 w-4" />
              Today's Appointments
            </CardDescription>
            <CardTitle className="text-3xl">{stats?.total_appointments || 0}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-600">
              {stats?.confirmed_appointments || 0} confirmed
            </p>
          </CardContent>
        </Card>
        
        <Card 
          className="border-amber-200 bg-amber-50 cursor-pointer hover:shadow-lg transition-shadow"
          onClick={() => navigate('/grooming/queue')}
        >
          <CardHeader className="pb-2">
            <CardDescription className="text-amber-900 flex items-center gap-2">
              <UsersThree className="h-4 w-4" />
              Waiting
            </CardDescription>
            <CardTitle className="text-3xl text-amber-900">{stats?.queue_length || queue.length || 0}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-amber-700">
              {stats?.avg_wait_time_minutes ? `~${stats.avg_wait_time_minutes} min avg wait` : 'No queue'}
            </p>
          </CardContent>
        </Card>
        
        <Card 
          className="border-purple-200 bg-purple-50 cursor-pointer hover:shadow-lg transition-shadow"
          onClick={() => navigate('/grooming/appointments?status=in_progress')}
        >
          <CardHeader className="pb-2">
            <CardDescription className="text-purple-900 flex items-center gap-2">
              <Scissors className="h-4 w-4" />
              In Progress
            </CardDescription>
            <CardTitle className="text-3xl text-purple-900">{stats?.in_progress_count || 0}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-purple-700">
              {stats?.active_groomers || groomers.filter(g => g.current_appointment_id).length || 0} groomers busy
            </p>
          </CardContent>
        </Card>
        
        <Card 
          className="border-green-200 bg-green-50 cursor-pointer hover:shadow-lg transition-shadow"
          onClick={() => navigate('/grooming/appointments?status=completed')}
        >
          <CardHeader className="pb-2">
            <CardDescription className="text-green-900 flex items-center gap-2">
              <CheckCircle className="h-4 w-4" />
              Completed
            </CardDescription>
            <CardTitle className="text-3xl text-green-900">{stats?.completed_count || 0}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-green-700">
              {stats?.avg_groom_duration_minutes ? `~${stats.avg_groom_duration_minutes} min avg` : 'No data'}
            </p>
          </CardContent>
        </Card>
        
        <Card
          className="cursor-pointer hover:shadow-lg transition-shadow"
          onClick={() => navigate('/grooming/appointments?has_flags=true')}
        >
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <Warning className="h-4 w-4" />
              Alerts
            </CardDescription>
            <CardTitle className="text-3xl">
              {(stats?.behaviour_flags || 0) + (stats?.medical_flags || 0)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-600">
              Needs attention
            </p>
          </CardContent>
        </Card>
      </div>
      
      {/* Queue and Groomers */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Current Queue */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Waiting Queue
            </CardTitle>
            <CardDescription>Dogs waiting to be groomed</CardDescription>
          </CardHeader>
          <CardContent>
            {queue.length === 0 ? (
              <p className="text-slate-500 text-center py-8">No dogs waiting</p>
            ) : (
              <div className="space-y-3">
                {queue.slice(0, 5).map((item, index) => (
                  <div 
                    key={item.appointment_id}
                    className="flex items-center justify-between p-3 bg-slate-50 rounded-lg cursor-pointer hover:bg-slate-100"
                    onClick={() => navigate(`/grooming/appointments/${item.appointment_id}`)}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-sm font-medium">
                        {index + 1}
                      </div>
                      <div>
                        <p className="font-medium">{item.pet_name}</p>
                        <p className="text-sm text-slate-600">{item.service_name}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium">{item.wait_time_minutes} min</p>
                      <p className="text-xs text-slate-500">waiting</p>
                    </div>
                  </div>
                ))}
                {queue.length > 5 && (
                  <Button variant="ghost" className="w-full" onClick={() => navigate('/grooming/queue')}>
                    View all {queue.length} in queue
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>
        
        {/* Groomer Status */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserCheck className="h-5 w-5" />
              Groomer Status
            </CardTitle>
            <CardDescription>Today's grooming team</CardDescription>
          </CardHeader>
          <CardContent>
            {groomers.length === 0 ? (
              <p className="text-slate-500 text-center py-8">No groomers on duty</p>
            ) : (
              <div className="space-y-3">
                {groomers.map((groomer) => (
                  <div 
                    key={groomer.id}
                    className="flex items-center justify-between p-3 bg-slate-50 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-3 h-3 rounded-full ${
                        groomer.is_on_break ? 'bg-yellow-400' :
                        groomer.current_appointment_id ? 'bg-purple-500' : 'bg-green-500'
                      }`} />
                      <div>
                        <p className="font-medium">{groomer.name}</p>
                        <p className="text-sm text-slate-600">
                          {groomer.specializations?.slice(0, 2).map(s => SERVICE_TYPES[s]?.label || s).join(', ')}
                        </p>
                      </div>
                    </div>
                    <Badge variant={
                      groomer.is_on_break ? 'secondary' :
                      groomer.current_appointment_id ? 'default' : 'outline'
                    }>
                      {groomer.is_on_break ? 'On Break' :
                       groomer.current_appointment_id ? 'Busy' : 'Available'}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      
      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <Button variant="outline" onClick={() => navigate('/grooming/appointments')}>
              <CalendarBlank className="h-4 w-4 mr-2" />
              View Schedule
            </Button>
            <Button variant="outline" onClick={() => navigate('/grooming/queue')}>
              <UsersThree className="h-4 w-4 mr-2" />
              Manage Queue
            </Button>
            {canCreate && (
              <Button variant="outline" onClick={() => navigate('/grooming/appointments?action=create')}>
                <Plus className="h-4 w-4 mr-2" />
                Book Appointment
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
