import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { useDaycareStore } from '../store';
import { useDashboardStore } from '../../dashboard/store';
import { useAuth } from '../../../context/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Badge } from '../../../components/ui/badge';
import { 
  Calendar, 
  Users, 
  AlertCircle, 
  Clock, 
  TrendingUp,
  LogIn,
  LogOut,
  Plus,
  AlertTriangle,
  Truck,
  Dog,
} from 'lucide-react';
import { toast } from 'sonner';
import { SERVICE_TYPES, RAG_STATUS_CONFIG } from '../types';
import type { DaycareBooking, RAGStatus } from '../types';

export function DaycareDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { selectedLocationId } = useDashboardStore();
  const { stats, bookings, isLoading, error, fetchStats, fetchBookings, clearError } = useDaycareStore();
  
  const [currentTime, setCurrentTime] = useState(new Date());
  const today = new Date().toISOString().split('T')[0];
  
  useEffect(() => {
    loadData();
    const interval = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(interval);
  }, [selectedLocationId]);
  
  useEffect(() => {
    if (error) {
      toast.error(error);
      clearError();
    }
  }, [error]);
  
  const loadData = async () => {
    try {
      const locId = selectedLocationId === 'ALL' ? undefined : selectedLocationId;
      await Promise.all([
        fetchStats(locId, today),
        fetchBookings({ location_id: locId, date: today }),
      ]);
    } catch (err) {
    }
  };
  
  const canCreate = user?.role === 'admin' || user?.role === 'manager' || user?.role === 'assistant_manager' || user?.role === 'staff';
  
  const ragStatus: RAGStatus = (stats?.rag_status as RAGStatus) || 'green';
  const ragConfig = RAG_STATUS_CONFIG[ragStatus];
  
  const todayActiveBookings = bookings.filter(b => 
    b.booking_date === today && b.booking_status !== 'cancelled'
  );
  
  const sortedBookings = [...todayActiveBookings].sort((a, b) => {
    const statusOrder: Record<string, number> = { not_checked_in: 0, checked_in: 1, checked_out: 2 };
    const orderDiff = (statusOrder[a.check_in_status] || 0) - (statusOrder[b.check_in_status] || 0);
    if (orderDiff !== 0) return orderDiff;
    return (a.planned_start_time || '').localeCompare(b.planned_start_time || '');
  });

  const getCheckInBadge = (booking: DaycareBooking) => {
    if (booking.check_in_status === 'checked_in') {
      return <Badge className="bg-blue-100 text-blue-700 border-0 text-xs">In Daycare</Badge>;
    }
    if (booking.check_in_status === 'checked_out') {
      return <Badge className="bg-green-100 text-green-700 border-0 text-xs">Collected</Badge>;
    }
    return <Badge className="bg-slate-100 text-slate-600 border-0 text-xs">Expected</Badge>;
  };

  const getServiceBadge = (serviceType: string) => {
    const config = SERVICE_TYPES[serviceType];
    if (!config) return null;
    return (
      <Badge className={`${config.bgColor} ${config.color} border-0 text-xs`}>
        {config.label}
      </Badge>
    );
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Daycare Dashboard</h1>
          <p className="text-slate-600 mt-1">
            {currentTime.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            {' · '}
            {currentTime.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {canCreate && (
            <>
              <Button variant="outline" onClick={() => navigate('/daycare/check-in')}>
                <LogIn className="h-4 w-4 mr-2" />
                Quick Check-in
              </Button>
              <Button onClick={() => navigate('/daycare/bookings?action=create')}>
                <Plus className="h-4 w-4 mr-2" />
                New Booking
              </Button>
            </>
          )}
        </div>
      </div>
      
      {stats && stats.max_capacity > 0 && (
        <Card className={`${ragConfig.borderColor} border-2`}>
          <CardContent className="py-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-3">
                <Badge className={`${ragConfig.bgColor} ${ragConfig.color} border-0`}>
                  {ragConfig.label}
                </Badge>
                <span className="text-sm text-slate-600">
                  {stats.available_slots} of {stats.max_capacity} spots available
                </span>
              </div>
              <span className="text-sm font-medium text-slate-700">
                {Math.round(stats.capacity_utilisation)}% utilisation
              </span>
            </div>
            <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
              <div 
                className={`h-full transition-all duration-500 rounded-full ${
                  ragStatus === 'red' ? 'bg-red-500' : ragStatus === 'amber' ? 'bg-amber-500' : 'bg-green-500'
                }`}
                style={{ width: `${Math.min(stats.capacity_utilisation, 100)}%` }}
              />
            </div>
            {stats.service_breakdown && (
              <div className="flex items-center gap-4 mt-2 text-xs text-slate-500">
                {stats.service_breakdown.full_day > 0 && (
                  <span>{stats.service_breakdown.full_day} Full Day</span>
                )}
                {stats.service_breakdown.half_day > 0 && (
                  <span>{stats.service_breakdown.half_day} Half Day</span>
                )}
                {stats.service_breakdown.trial_day > 0 && (
                  <span>{stats.service_breakdown.trial_day} Trial Day</span>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card 
          className="cursor-pointer hover:shadow-lg transition-shadow"
          onClick={() => navigate(`/daycare/bookings?filter=today&date=${today}`)}
        >
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Today's Bookings
            </CardDescription>
            <CardTitle className="text-3xl">{stats?.total_bookings || 0}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-600">
              {stats?.confirmed_bookings || 0} confirmed
            </p>
          </CardContent>
        </Card>
        
        <Card 
          className="border-blue-200 bg-blue-50 cursor-pointer hover:shadow-lg transition-shadow"
          onClick={() => navigate('/daycare/attendance')}
        >
          <CardHeader className="pb-2">
            <CardDescription className="text-blue-900 flex items-center gap-2">
              <Users className="h-4 w-4" />
              Currently In
            </CardDescription>
            <CardTitle className="text-3xl text-blue-900">{stats?.checked_in_count || 0}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-blue-700">
              {stats?.checked_out_count || 0} checked out
            </p>
          </CardContent>
        </Card>
        
        <Card 
          className="cursor-pointer hover:shadow-lg transition-shadow"
          onClick={() => navigate('/daycare/attendance')}
        >
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Capacity
            </CardDescription>
            <CardTitle className="text-3xl">
              {stats?.capacity_utilisation ? `${Math.round(stats.capacity_utilisation)}%` : '0%'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-600">
              {stats?.available_slots || 0} slots available
            </p>
          </CardContent>
        </Card>
        
        <Card 
          className="border-orange-200 bg-orange-50 cursor-pointer hover:shadow-lg transition-shadow"
          onClick={() => navigate(`/daycare/bookings?filter=today&date=${today}&check_in_status=not_checked_in`)}
        >
          <CardHeader className="pb-2">
            <CardDescription className="text-orange-900 flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Expected Arrivals
            </CardDescription>
            <CardTitle className="text-3xl text-orange-900">{stats?.expected_arrivals_2h || 0}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-orange-700">Next 2 hours</p>
          </CardContent>
        </Card>
        
        <Card 
          className="border-green-200 bg-green-50 cursor-pointer hover:shadow-lg transition-shadow"
          onClick={() => navigate(`/daycare/bookings?filter=today&date=${today}&check_in_status=checked_in`)}
        >
          <CardHeader className="pb-2">
            <CardDescription className="text-green-900 flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Expected Pickups
            </CardDescription>
            <CardTitle className="text-3xl text-green-900">{stats?.expected_pickups_2h || 0}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-green-700">Next 2 hours</p>
          </CardContent>
        </Card>
      </div>
      
      {stats && (stats.vaccination_alerts > 0 || stats.waiver_alerts > 0 || stats.hold_alerts > 0 || stats.behaviour_flags > 0 || stats.medical_flags > 0) && (
        <Card className="border-amber-200 bg-amber-50">
          <CardHeader className="pb-2 pt-3">
            <CardTitle className="text-sm text-amber-900 flex items-center gap-2">
              <AlertTriangle className="h-3.5 w-3.5" />
              Alerts & Flags
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 pb-3">
            <div className="flex flex-wrap gap-2">
              {stats.vaccination_alerts > 0 && (
                <div className="flex items-center gap-1.5 px-2.5 py-1 bg-white rounded-md border border-red-200">
                  <AlertCircle className="h-3.5 w-3.5 text-red-500" />
                  <span className="text-xs text-slate-600">Vaccination Issues:</span>
                  <span className="text-sm font-bold text-red-700">{stats.vaccination_alerts}</span>
                </div>
              )}
              {stats.waiver_alerts > 0 && (
                <div className="flex items-center gap-1.5 px-2.5 py-1 bg-white rounded-md border border-red-200">
                  <AlertCircle className="h-3.5 w-3.5 text-red-500" />
                  <span className="text-xs text-slate-600">Waiver Issues:</span>
                  <span className="text-sm font-bold text-red-700">{stats.waiver_alerts}</span>
                </div>
              )}
              {stats.hold_alerts > 0 && (
                <div className="flex items-center gap-1.5 px-2.5 py-1 bg-white rounded-md border border-orange-200">
                  <AlertCircle className="h-3.5 w-3.5 text-orange-500" />
                  <span className="text-xs text-slate-600">Account Holds:</span>
                  <span className="text-sm font-bold text-orange-700">{stats.hold_alerts}</span>
                </div>
              )}
              {stats.behaviour_flags > 0 && (
                <div className="flex items-center gap-1.5 px-2.5 py-1 bg-white rounded-md border border-amber-200">
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                  <span className="text-xs text-slate-600">Behaviour Flags:</span>
                  <span className="text-sm font-bold text-amber-700">{stats.behaviour_flags}</span>
                </div>
              )}
              {stats.medical_flags > 0 && (
                <div className="flex items-center gap-1.5 px-2.5 py-1 bg-white rounded-md border border-amber-200">
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                  <span className="text-xs text-slate-600">Medical Flags:</span>
                  <span className="text-sm font-bold text-amber-700">{stats.medical_flags}</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
      
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Dog className="h-5 w-5" />
                Daily Overview
              </CardTitle>
              <CardDescription>All dogs scheduled for today</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={() => navigate('/daycare/bookings')}>
              View All Bookings
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-slate-500">Loading...</div>
          ) : sortedBookings.length === 0 ? (
            <div className="text-center py-8">
              <Dog className="h-12 w-12 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-500">No dogs scheduled for today</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="text-left text-xs font-medium text-slate-500 pb-3 pr-4">Dog</th>
                    <th className="text-left text-xs font-medium text-slate-500 pb-3 pr-4">Service</th>
                    <th className="text-left text-xs font-medium text-slate-500 pb-3 pr-4">Time</th>
                    <th className="text-left text-xs font-medium text-slate-500 pb-3 pr-4">Status</th>
                    <th className="text-left text-xs font-medium text-slate-500 pb-3 pr-4">Transport</th>
                    <th className="text-left text-xs font-medium text-slate-500 pb-3">Flags</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedBookings.map((booking) => (
                    <tr key={booking.id} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="py-3 pr-4">
                        <div className="flex items-center gap-3">
                          {booking.pet_photo_url ? (
                            <img
                              src={booking.pet_photo_url}
                              alt={booking.pet_name}
                              className="w-8 h-8 rounded-full object-cover"
                            />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center">
                              <Dog className="h-4 w-4 text-slate-400" />
                            </div>
                          )}
                          <div>
                            <p className="text-sm font-medium text-slate-900">{booking.pet_name}</p>
                            <p className="text-xs text-slate-500">{booking.household_name}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 pr-4">
                        {getServiceBadge(booking.service_type)}
                      </td>
                      <td className="py-3 pr-4">
                        <div className="text-sm text-slate-600">
                          {booking.planned_start_time || '—'}
                          {booking.planned_end_time && ` – ${booking.planned_end_time}`}
                        </div>
                      </td>
                      <td className="py-3 pr-4">
                        {getCheckInBadge(booking)}
                      </td>
                      <td className="py-3 pr-4">
                        {booking.requires_transport ? (
                          <Badge className="bg-violet-100 text-violet-700 border-0 text-xs">
                            <Truck className="h-3 w-3 mr-1" />
                            Transport
                          </Badge>
                        ) : (
                          <span className="text-xs text-slate-400">Drop-off</span>
                        )}
                      </td>
                      <td className="py-3">
                        <div className="flex items-center gap-1">
                          {booking.has_behaviour_flag && (
                            <AlertTriangle className="h-3.5 w-3.5 text-amber-500" title="Behaviour flag" />
                          )}
                          {booking.has_medical_flag && (
                            <AlertTriangle className="h-3.5 w-3.5 text-red-500" title="Medical flag" />
                          )}
                          {(booking.vaccination_status === 'expired' || booking.vaccination_status === 'expiring_soon') && (
                            <AlertCircle className="h-3.5 w-3.5 text-red-500" title="Vaccination alert" />
                          )}
                          {!booking.has_behaviour_flag && !booking.has_medical_flag && booking.vaccination_status !== 'expired' && booking.vaccination_status !== 'expiring_soon' && (
                            <span className="text-xs text-slate-400">—</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>Common daycare operations</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Button 
              variant="outline" 
              className="h-24 flex-col gap-2"
              onClick={() => navigate('/daycare/check-in')}
            >
              <LogIn className="h-6 w-6" />
              <span>Check-in</span>
            </Button>
            
            <Button 
              variant="outline" 
              className="h-24 flex-col gap-2"
              onClick={() => navigate('/daycare/check-out')}
            >
              <LogOut className="h-6 w-6" />
              <span>Check-out</span>
            </Button>
            
            <Button 
              variant="outline" 
              className="h-24 flex-col gap-2"
              onClick={() => navigate('/daycare/bookings?action=create')}
            >
              <Plus className="h-6 w-6" />
              <span>New Booking</span>
            </Button>
            
            <Button 
              variant="outline" 
              className="h-24 flex-col gap-2"
              onClick={() => navigate('/daycare/attendance')}
            >
              <Users className="h-6 w-6" />
              <span>View Attendance</span>
            </Button>
          </div>
        </CardContent>
      </Card>
      
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card 
            className="cursor-pointer hover:shadow-lg transition-shadow"
            onClick={() => navigate(`/daycare/bookings?filter=today&date=${today}&status=no_show`)}
          >
            <CardHeader>
              <CardTitle className="text-lg">No Shows</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-slate-900">{stats.no_shows}</p>
              <p className="text-sm text-slate-600 mt-1">
                {stats.total_bookings > 0 ? `${((stats.no_shows / stats.total_bookings) * 100).toFixed(1)}%` : '0%'} of bookings
              </p>
            </CardContent>
          </Card>
          
          <Card 
            className="cursor-pointer hover:shadow-lg transition-shadow"
            onClick={() => navigate(`/daycare/bookings?filter=today&date=${today}&status=cancelled`)}
          >
            <CardHeader>
              <CardTitle className="text-lg">Cancellations</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-slate-900">{stats.cancellations}</p>
              <p className="text-sm text-slate-600 mt-1">
                {stats.total_bookings > 0 ? `${((stats.cancellations / stats.total_bookings) * 100).toFixed(1)}%` : '0%'} of bookings
              </p>
            </CardContent>
          </Card>
          
          <Card 
            className="cursor-pointer hover:shadow-lg transition-shadow"
            onClick={() => navigate(`/daycare/bookings?filter=today&date=${today}`)}
          >
            <CardHeader>
              <CardTitle className="text-lg">Completion Rate</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-green-700">
                {stats.total_bookings > 0 
                  ? `${(((stats.total_bookings - stats.cancellations - stats.no_shows) / stats.total_bookings) * 100).toFixed(1)}%`
                  : '0%'}
              </p>
              <p className="text-sm text-slate-600 mt-1">Successful bookings</p>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
