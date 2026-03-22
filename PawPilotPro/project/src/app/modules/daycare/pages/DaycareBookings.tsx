// Daycare Bookings - MDC Operations Centre
// View and manage daycare bookings with filtering

import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { useDaycareStore } from '../store';
import { useDashboardStore } from '../../dashboard/store';
import { useAuth } from '../../../context/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Badge } from '../../../components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../../components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../../components/ui/tabs';
import { 
  Calendar, 
  Search, 
  Plus, 
  AlertTriangle, 
  XCircle,
  CheckCircle,
  Clock,
} from 'lucide-react';
import { toast } from 'sonner';
import type { DaycareBooking } from '../types';
import { SERVICE_TYPES } from '../types';
import { CreateBookingDialog } from '../components/CreateBookingDialog';

export function DaycareBookings() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const { selectedLocationId } = useDashboardStore();
  const { bookings, isLoading, fetchBookings, cancelBooking } = useDaycareStore();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<DaycareBooking | null>(null);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  
  // Get filter from URL params
  const filterParam = searchParams.get('filter') || 'all';
  const dateParam = searchParams.get('date') || new Date().toISOString().split('T')[0];
  const statusParam = searchParams.get('status');
  const checkInStatusParam = searchParams.get('check_in_status');
  
  useEffect(() => {
    // Check if we should open create dialog
    if (searchParams.get('action') === 'create') {
      setShowCreateDialog(true);
      // Clear action param
      searchParams.delete('action');
      setSearchParams(searchParams);
    }
  }, []);
  
  useEffect(() => {
    loadBookings();
  }, [selectedLocationId, filterParam, dateParam, statusParam, checkInStatusParam]);
  
  const loadBookings = async () => {
    try {
      const filters: any = {
        location_id: selectedLocationId === 'ALL' ? undefined : selectedLocationId,
      };
      
      // Always apply date filter when a date is selected
      if (dateParam) {
        filters.date = dateParam;
      }
      
      // Apply filters based on URL params
      if (filterParam === 'today') {
        // "Today" tab uses the date filter (already applied above)
      } else if (filterParam === 'upcoming') {
        // "Upcoming" could filter for future dates
        filters.upcoming = true;
      }
      
      if (statusParam) {
        filters.booking_status = statusParam;
      }
      
      if (checkInStatusParam) {
        filters.check_in_status = checkInStatusParam;
      }
      
      await fetchBookings(filters);
    } catch (err) {
      // Error handled by store
    }
  };
  
  const filteredBookings = bookings.filter(b => {
    if (searchQuery === '') return true;
    const search = searchQuery.toLowerCase();
    return (
      b.pet_name.toLowerCase().includes(search) ||
      b.household_name.toLowerCase().includes(search)
    );
  });
  
  const handleCancelBooking = async () => {
    if (!selectedBooking) return;
    
    try {
      await cancelBooking(selectedBooking.id, cancelReason);
      toast.success(`Booking for ${selectedBooking.pet_name} cancelled`);
      setShowCancelDialog(false);
      setSelectedBooking(null);
      setCancelReason('');
      await loadBookings();
    } catch (error: any) {
      toast.error(error.message || 'Failed to cancel booking');
    }
  };
  
  const getStatusBadge = (booking: DaycareBooking) => {
    if (booking.booking_status === 'cancelled') {
      return <Badge className="bg-red-100 text-red-700 border-0">Cancelled</Badge>;
    }
    if (booking.booking_status === 'no_show') {
      return <Badge className="bg-orange-100 text-orange-700 border-0">No Show</Badge>;
    }
    if (booking.booking_status === 'completed') {
      return <Badge className="bg-green-100 text-green-700 border-0">Completed</Badge>;
    }
    if (booking.check_in_status === 'checked_in') {
      return <Badge className="bg-blue-100 text-blue-700 border-0">Checked In</Badge>;
    }
    if (booking.check_in_status === 'checked_out') {
      return <Badge className="bg-slate-100 text-slate-700 border-0">Checked Out</Badge>;
    }
    return <Badge variant="outline">Confirmed</Badge>;
  };
  
  const canCreate = user?.role === 'admin' || user?.role === 'manager' || user?.role === 'assistant_manager' || user?.role === 'staff';
  const canCancel = user?.role === 'admin' || user?.role === 'manager';
  
  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Bookings</h1>
          <p className="text-slate-600 mt-1">Manage daycare bookings</p>
        </div>
        {canCreate && (
          <Button onClick={() => setShowCreateDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            New Booking
          </Button>
        )}
      </div>
      
      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Filter Bookings</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search by pet or household name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Input
              type="date"
              value={dateParam}
              onChange={(e) => {
                searchParams.set('date', e.target.value);
                setSearchParams(searchParams);
              }}
              className="w-48"
            />
          </div>
        </CardContent>
      </Card>
      
      {/* Tabs */}
      <Tabs value={filterParam} onValueChange={(value) => {
        searchParams.set('filter', value);
        setSearchParams(searchParams);
      }}>
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="today">Today</TabsTrigger>
          <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
        </TabsList>
        
        <TabsContent value={filterParam} className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Bookings ({filteredBookings.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="text-center py-8 text-slate-500">Loading bookings...</div>
              ) : filteredBookings.length === 0 ? (
                <div className="text-center py-8">
                  <Calendar className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                  <p className="text-slate-500">No bookings found</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredBookings.map((booking) => (
                    <div
                      key={booking.id}
                      className="flex items-center justify-between p-4 border rounded-lg hover:bg-slate-50"
                    >
                      <div key="left-section" className="flex items-center gap-4">
                        {booking.pet_photo_url && (
                          <img
                            key="pet-photo"
                            src={booking.pet_photo_url}
                            alt={booking.pet_name}
                            className="w-12 h-12 rounded-full object-cover"
                          />
                        )}
                        <div key="pet-info">
                          <p className="font-medium text-slate-900">{booking.pet_name}</p>
                          <p className="text-sm text-slate-600">{booking.household_name}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <Calendar key="cal-icon" className="h-3 w-3 text-slate-400" />
                            <span key="date" className="text-xs text-slate-500">
                              {new Date(booking.booking_date).toLocaleDateString('en-GB')}
                            </span>
                            {booking.planned_start_time && (
                              <>
                                <Clock key="clock-icon" className="h-3 w-3 text-slate-400 ml-2" />
                                <span key="time" className="text-xs text-slate-500">
                                  {booking.planned_start_time}
                                </span>
                              </>
                            )}
                            {booking.service_type && SERVICE_TYPES[booking.service_type] && (
                              <Badge className={`${SERVICE_TYPES[booking.service_type].bgColor} ${SERVICE_TYPES[booking.service_type].color} border-0 text-xs ml-1`}>
                                {SERVICE_TYPES[booking.service_type].label}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      <div key="right-section" className="flex items-center gap-3">
                        {getStatusBadge(booking)}
                        
                        {booking.has_behaviour_flag && (
                          <Badge key="behaviour-badge" className="bg-amber-100 text-amber-700 border-0">
                            <AlertTriangle className="h-3 w-3 mr-1" />
                            Behaviour
                          </Badge>
                        )}
                        
                        {booking.has_medical_flag && (
                          <Badge key="medical-badge" className="bg-red-100 text-red-700 border-0">
                            <AlertTriangle className="h-3 w-3 mr-1" />
                            Medical
                          </Badge>
                        )}
                        
                        {canCancel && booking.booking_status === 'confirmed' && (
                          <Button
                            key="cancel-button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedBooking(booking);
                              setShowCancelDialog(true);
                            }}
                          >
                            <XCircle className="h-3 w-3 mr-1" />
                            Cancel
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      
      {/* Create Booking Dialog */}
      <CreateBookingDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        onSuccess={() => {
          setShowCreateDialog(false);
          loadBookings();
        }}
      />
      
      {/* Cancel Dialog */}
      <Dialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel Booking</DialogTitle>
            <DialogDescription>
              Are you sure you want to cancel the booking for {selectedBooking?.pet_name}?
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-slate-700">
                Cancellation Reason
              </label>
              <Input
                placeholder="Enter reason for cancellation..."
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                className="mt-2"
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCancelDialog(false)}>
              Close
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleCancelBooking}
              disabled={isLoading || !cancelReason}
            >
              Cancel Booking
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}