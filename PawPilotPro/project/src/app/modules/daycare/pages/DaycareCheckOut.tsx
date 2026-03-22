// Daycare Check-Out - MDC Operations Centre

import React, { useEffect, useState } from 'react';
import { useDaycareStore } from '../store';
import { useDashboardStore } from '../../dashboard/store';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Textarea } from '../../../components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../../components/ui/dialog';
import { Search, LogOut } from 'lucide-react';
import { toast } from 'sonner';
import type { DaycareBooking } from '../types';

export function DaycareCheckOut() {
  const { selectedLocationId } = useDashboardStore();
  const { bookings, isLoading, fetchBookings, checkOut } = useDaycareStore();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBooking, setSelectedBooking] = useState<DaycareBooking | null>(null);
  const [checkoutNotes, setCheckoutNotes] = useState('');
  const [showDialog, setShowDialog] = useState(false);
  
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
    setShowDialog(true);
  };
  
  const handleCheckOut = async () => {
    if (!selectedBooking) return;
    
    try {
      await checkOut(selectedBooking.id, checkoutNotes);
      toast.success(`${selectedBooking.pet_name} checked out successfully`);
      setShowDialog(false);
      setSelectedBooking(null);
      
      // Refresh bookings list
      await loadBookings();
      
      // Refresh dashboard stats if available
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
      
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Check Out: {selectedBooking?.pet_name}</DialogTitle>
            <DialogDescription>{selectedBooking?.household_name}</DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
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
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleCheckOut} disabled={isLoading}>
              <LogOut className="h-4 w-4 mr-2" />
              Confirm Check-Out
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}