// Daycare Check-In - MDC Operations Centre
// Fast check-in flow with validation and warnings

import React, { useEffect, useState } from 'react';
import { useDaycareStore } from '../store';
import { useDashboardStore } from '../../dashboard/store';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Textarea } from '../../../components/ui/textarea';
import { Badge } from '../../../components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../../components/ui/dialog';
import { Checkbox } from '../../../components/ui/checkbox';
import { Search, AlertTriangle, CheckCircle, XCircle, LogIn } from 'lucide-react';
import { toast } from 'sonner';
import type { DaycareBooking, CheckInValidation } from '../types';
import { BOOKING_STATUSES, CHECK_IN_STATUSES } from '../types';

export function DaycareCheckIn() {
  const { selectedLocationId } = useDashboardStore();
  const { bookings, isLoading, fetchBookings, validateCheckIn, checkIn } = useDaycareStore();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBooking, setSelectedBooking] = useState<DaycareBooking | null>(null);
  const [validation, setValidation] = useState<CheckInValidation | null>(null);
  const [handoverNotes, setHandoverNotes] = useState('');
  const [warningsAcknowledged, setWarningsAcknowledged] = useState(false);
  const [showValidationDialog, setShowValidationDialog] = useState(false);
  
  const today = new Date().toISOString().split('T')[0];
  
  useEffect(() => {
    loadBookings();
  }, [selectedLocationId]);
  
  const loadBookings = async () => {
    try {
      await fetchBookings({
        location_id: selectedLocationId === 'ALL' ? undefined : selectedLocationId,
        date: today,
        check_in_status: 'not_checked_in',
        booking_status: 'confirmed',
      });
    } catch (err) {
      // Error handled by store
    }
  };
  
  const filteredBookings = bookings.filter(b =>
    searchQuery === '' ||
    b.pet_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    b.household_name.toLowerCase().includes(searchQuery.toLowerCase())
  );
  
  const handleSelectBooking = async (booking: DaycareBooking) => {
    try {
      console.log('[DaycareCheckIn] Validating booking:', {
        booking_id: booking.id,
        household_id: booking.household_id,
        pet_name: booking.pet_name,
        household_name: booking.household_name
      });
      
      const result = await validateCheckIn(booking.id);
      
      console.log('[DaycareCheckIn] Validation result:', {
        can_check_in: result.can_check_in,
        blockers: result.blockers,
        warnings: result.warnings
      });
      
      console.log('[DaycareCheckIn] FULL VALIDATION RESPONSE:', JSON.stringify(result, null, 2));
      
      setValidation(result);
      setSelectedBooking(booking);
      setHandoverNotes('');
      setWarningsAcknowledged(false);
      setShowValidationDialog(true);
    } catch (error: any) {
      console.error('[DaycareCheckIn] Validation error:', error);
      toast.error(error.message || 'Failed to validate check-in');
    }
  };
  
  const handleCheckIn = async () => {
    if (!selectedBooking || !validation) return;
    
    if (!validation.can_check_in) {
      toast.error('Cannot check in due to blockers');
      return;
    }
    
    if (validation.warnings.length > 0 && !warningsAcknowledged) {
      toast.error('Please acknowledge warnings before checking in');
      return;
    }
    
    try {
      await checkIn(selectedBooking.id, {
        handover_notes: handoverNotes,
        warnings_acknowledged: validation.warnings.length > 0,
      });
      
      toast.success(`${selectedBooking.pet_name} checked in successfully`);
      setShowValidationDialog(false);
      setSelectedBooking(null);
      setValidation(null);
      
      // Refresh bookings list
      await loadBookings();
      
      // Refresh dashboard stats if available
      const { fetchStats } = useDaycareStore.getState();
      const today = new Date().toISOString().split('T')[0];
      await fetchStats(selectedLocationId === 'ALL' ? undefined : selectedLocationId, today);
    } catch (error: any) {
      toast.error(error.message || 'Failed to check in');
    }
  };
  
  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Check-In</h1>
        <p className="text-slate-600 mt-1">Check in pets for daycare</p>
      </div>
      
      {/* Search */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Find Booking</CardTitle>
          <CardDescription>Search by pet name or household</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Search pet or household..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </CardContent>
      </Card>
      
      {/* Bookings List */}
      <Card>
        <CardHeader>
          <CardTitle>Ready for Check-In ({filteredBookings.length})</CardTitle>
          <CardDescription>Confirmed bookings for today</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-slate-500">Loading bookings...</div>
          ) : filteredBookings.length === 0 ? (
            <div className="text-center py-8">
              <LogIn className="h-12 w-12 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-500">No bookings ready for check-in</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredBookings.map((booking) => (
                <div
                  key={booking.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-slate-50 cursor-pointer"
                  onClick={() => handleSelectBooking(booking)}
                >
                  <div className="flex items-center gap-4">
                    {booking.pet_photo_url && (
                      <img
                        src={booking.pet_photo_url}
                        alt={booking.pet_name}
                        className="w-12 h-12 rounded-full object-cover"
                      />
                    )}
                    <div>
                      <p className="font-medium text-slate-900">{booking.pet_name}</p>
                      <p className="text-sm text-slate-600">{booking.household_name}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    {booking.planned_start_time && (
                      <Badge variant="outline">{booking.planned_start_time}</Badge>
                    )}
                    
                    {booking.has_behaviour_flag && (
                      <Badge className="bg-amber-100 text-amber-700 border-0">
                        <AlertTriangle className="h-3 w-3 mr-1" />
                        Behaviour
                      </Badge>
                    )}
                    
                    {booking.has_medical_flag && (
                      <Badge className="bg-red-100 text-red-700 border-0">
                        <AlertTriangle className="h-3 w-3 mr-1" />
                        Medical
                      </Badge>
                    )}
                    
                    {booking.vaccination_status !== 'valid' && booking.vaccination_status !== 'up_to_date' && (
                      <Badge className={`border-0 ${
                        booking.vaccination_status === 'expired' ? 'bg-red-100 text-red-700' :
                        booking.vaccination_status === 'expiring_soon' ? 'bg-orange-100 text-orange-700' :
                        'bg-red-100 text-red-700'
                      }`}>
                        {booking.vaccination_status === 'expired' ? 'Vaccination Expired' :
                         booking.vaccination_status === 'expiring_soon' ? 'Vaccination Expiring' :
                         'No Vaccination'}
                      </Badge>
                    )}
                    
                    <Button size="sm">
                      <LogIn className="h-4 w-4 mr-2" />
                      Check In
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* Validation Dialog */}
      <Dialog open={showValidationDialog} onOpenChange={setShowValidationDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              Check In: {selectedBooking?.pet_name}
            </DialogTitle>
            <DialogDescription>
              {selectedBooking?.household_name}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* Blockers */}
            {validation && validation.blockers.length > 0 && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg space-y-2">
                <div className="flex items-center gap-2 text-red-900 font-medium">
                  <XCircle className="h-5 w-5" />
                  Blockers - Cannot Check In
                </div>
                {validation.blockers.map((blocker, index) => (
                  <div key={index} className="flex items-start gap-2 ml-7 text-sm text-red-700">
                    <span>•</span>
                    <span>{blocker.message}</span>
                  </div>
                ))}
              </div>
            )}
            
            {/* Warnings */}
            {validation && validation.warnings.length > 0 && (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg space-y-3">
                <div className="flex items-center gap-2 text-amber-900 font-medium">
                  <AlertTriangle className="h-5 w-5" />
                  Warnings - Acknowledge Required
                </div>
                {validation.warnings.map((warning, index) => (
                  <div key={index} className="flex items-start gap-2 ml-7 text-sm text-amber-700">
                    <span>•</span>
                    <span>{warning.message}</span>
                  </div>
                ))}
                
                <div className="flex items-center gap-2 ml-7 pt-2">
                  <Checkbox
                    id="acknowledge-warnings"
                    checked={warningsAcknowledged}
                    onCheckedChange={(checked) => setWarningsAcknowledged(checked as boolean)}
                  />
                  <label
                    htmlFor="acknowledge-warnings"
                    className="text-sm font-medium text-amber-900 cursor-pointer"
                  >
                    I acknowledge these warnings and confirm check-in
                  </label>
                </div>
              </div>
            )}
            
            {/* Success */}
            {validation && validation.can_check_in && validation.blockers.length === 0 && validation.warnings.length === 0 && (
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center gap-2 text-green-900 font-medium">
                  <CheckCircle className="h-5 w-5" />
                  Ready to Check In
                </div>
                <p className="text-sm text-green-700 ml-7 mt-1">
                  No issues detected. Ready to proceed.
                </p>
              </div>
            )}
            
            {/* Handover Notes */}
            {validation && validation.can_check_in && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">
                  Handover Notes (Optional)
                </label>
                <Textarea
                  placeholder="Any important information about the pet today..."
                  value={handoverNotes}
                  onChange={(e) => setHandoverNotes(e.target.value)}
                  rows={3}
                />
              </div>
            )}
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowValidationDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleCheckIn} 
              disabled={!validation?.can_check_in || (validation.warnings.length > 0 && !warningsAcknowledged) || isLoading}
            >
              <LogIn className="h-4 w-4 mr-2" />
              {validation?.can_check_in ? 'Confirm Check-In' : 'Cannot Check In'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
    </div>
  );
}