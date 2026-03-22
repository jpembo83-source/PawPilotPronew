// Daycare Check-Out - MDC Operations Centre

import React, { useEffect, useState } from 'react';
import { useDaycareStore } from '../store';
import { useDashboardStore } from '../../dashboard/store';
import { useSettingsStore } from '../../settings/store';
import { useOvernightsStore } from '../../overnights/store';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Textarea } from '../../../components/ui/textarea';
import { Switch } from '../../../components/ui/switch';
import { Label } from '../../../components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../../components/ui/dialog';
import { Search, LogOut, ArrowRightLeft, Moon } from 'lucide-react';
import { toast } from 'sonner';
import type { DaycareBooking } from '../types';

export function DaycareCheckOut() {
  const { selectedLocationId } = useDashboardStore();
  const { locations } = useSettingsStore();
  const { bookings, isLoading, fetchBookings, checkOut } = useDaycareStore();
  const { transitionFromDaycare } = useOvernightsStore();

  const selectedLocation = locations.find(l => l.id === selectedLocationId);
  const isOvernightsEnabled = selectedLocation?.enabledModules?.includes('overnights') ?? false;
  
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBooking, setSelectedBooking] = useState<DaycareBooking | null>(null);
  const [checkoutNotes, setCheckoutNotes] = useState('');
  const [showDialog, setShowDialog] = useState(false);
  const [transitionToOvernightMode, setTransitionToOvernightMode] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  
  const today = new Date().toISOString().split('T')[0];
  
  useEffect(() => {
    loadBookings();
  }, [selectedLocationId]);
  
  const loadBookings = async () => {
    try {
      await fetchBookings({
        location_id: selectedLocationId === 'ALL' ? undefined : selectedLocationId,
        date: today,
        check_in_status: 'checked_in',
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
  
  const handleSelectBooking = (booking: DaycareBooking) => {
    setSelectedBooking(booking);
    setCheckoutNotes('');
    setTransitionToOvernightMode(false);
    setShowDialog(true);
  };
  
  const handleCheckOut = async () => {
    if (!selectedBooking) return;

    if (transitionToOvernightMode) {
      if (!selectedBooking.pet_id || !selectedBooking.location_id) {
        toast.error('Unable to transition: missing pet or location information');
        return;
      }
      setIsTransitioning(true);
      try {
        await transitionFromDaycare({
          type: 'daycare_to_overnight',
          petId: selectedBooking.pet_id,
          locationId: selectedBooking.location_id,
          sourceBookingId: selectedBooking.id,
        });
        toast.success(`${selectedBooking.pet_name} transitioned to overnight stay`);
        setShowDialog(false);
        setSelectedBooking(null);
        await loadBookings();
      } catch (error: any) {
        toast.error(error.message || 'Failed to transition to overnight');
      } finally {
        setIsTransitioning(false);
      }
      return;
    }
    
    try {
      await checkOut(selectedBooking.id, checkoutNotes);
      toast.success(`${selectedBooking.pet_name} checked out successfully`);
      setShowDialog(false);
      setSelectedBooking(null);
      
      await loadBookings();
      
      const { fetchStats } = useDaycareStore.getState();
      const today = new Date().toISOString().split('T')[0];
      await fetchStats(selectedLocationId === 'ALL' ? undefined : selectedLocationId, today);
    } catch (error: any) {
      toast.error(error.message || 'Failed to check out');
    }
  };
  
  const calculateDuration = (booking: DaycareBooking) => {
    if (!booking.actual_check_in_time) return '-';
    const checkIn = new Date(booking.actual_check_in_time);
    const now = new Date();
    const minutes = Math.floor((now.getTime() - checkIn.getTime()) / 60000);
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };
  
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Check-Out</h1>
        <p className="text-slate-600 mt-1">Check out pets from daycare</p>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Find Pet</CardTitle>
          <CardDescription>Search currently in daycare</CardDescription>
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
      
      <Card>
        <CardHeader>
          <CardTitle>Currently In Daycare ({filteredBookings.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-slate-500">Loading...</div>
          ) : filteredBookings.length === 0 ? (
            <div className="text-center py-8 text-slate-500">No pets currently checked in</div>
          ) : (
            <div className="space-y-3">
              {filteredBookings.map((booking) => (
                <div
                  key={booking.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-slate-50"
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
                      <p className="text-xs text-slate-500">
                        Duration: {calculateDuration(booking)}
                      </p>
                    </div>
                  </div>
                  
                  <Button onClick={() => handleSelectBooking(booking)}>
                    <LogOut className="h-4 w-4 mr-2" />
                    Check Out
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      
      <Dialog open={showDialog} onOpenChange={(open) => { setShowDialog(open); if (!open) setTransitionToOvernightMode(false); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Check Out: {selectedBooking?.pet_name}</DialogTitle>
            <DialogDescription>{selectedBooking?.household_name}</DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {isOvernightsEnabled && (
              <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-lg space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="transition-overnight" className="flex items-center gap-2 font-medium text-indigo-900 cursor-pointer">
                    <ArrowRightLeft className="h-4 w-4" />
                    Transition to Overnight?
                  </Label>
                  <Switch
                    id="transition-overnight"
                    checked={transitionToOvernightMode}
                    onCheckedChange={setTransitionToOvernightMode}
                  />
                </div>
                {transitionToOvernightMode && (
                  <p className="text-xs text-indigo-600 ml-6">
                    This will close the daycare attendance and open an overnight stay for {selectedBooking?.pet_name}.
                  </p>
                )}
              </div>
            )}

            {!transitionToOvernightMode && (
              <div>
                <label className="text-sm font-medium text-slate-700">
                  Check-Out Notes (Optional)
                </label>
                <Textarea
                  placeholder="How was their day? Any incidents or notes..."
                  value={checkoutNotes}
                  onChange={(e) => setCheckoutNotes(e.target.value)}
                  rows={3}
                  className="mt-2"
                />
              </div>
            )}
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCheckOut}
              disabled={isLoading || isTransitioning}
              className={transitionToOvernightMode ? 'bg-indigo-600 hover:bg-indigo-700' : undefined}
            >
              {transitionToOvernightMode ? (
                <>
                  <Moon className="h-4 w-4 mr-2" />
                  {isTransitioning ? 'Transitioning...' : 'Transition to Overnight'}
                </>
              ) : (
                <>
                  <LogOut className="h-4 w-4 mr-2" />
                  Confirm Check-Out
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
