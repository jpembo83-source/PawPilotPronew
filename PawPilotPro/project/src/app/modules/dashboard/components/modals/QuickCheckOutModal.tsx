import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../../../../components/ui/dialog';
import { Button } from '../../../../components/ui/button';
import { Input } from '../../../../components/ui/input';
import { Label } from '../../../../components/ui/label';
import { Textarea } from '../../../../components/ui/textarea';
import { Badge } from '../../../../components/ui/badge';
import { Search, LogOut, Clock } from 'lucide-react';
import { useDaycareStore } from '../../../daycare/store';
import { useDashboardStore } from '../../store';
import { toast } from 'sonner';
import type { AttendanceRecord } from '../../../daycare/types';

interface QuickCheckOutModalProps {
  open: boolean;
  onClose: () => void;
}

export function QuickCheckOutModal({ open, onClose }: QuickCheckOutModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAttendance, setSelectedAttendance] = useState<AttendanceRecord | null>(null);
  const [checkoutNotes, setCheckoutNotes] = useState('');
  const [isCheckingOut, setIsCheckingOut] = useState(false);

  const { attendance, fetchActiveAttendance, checkOut } = useDaycareStore();
  const { selectedLocationId, refreshAllWidgets } = useDashboardStore();

  useEffect(() => {
    if (open) {
      loadActiveAttendance();
      // Reset state
      setSearchQuery('');
      setSelectedAttendance(null);
      setCheckoutNotes('');
    }
  }, [open]);

  const loadActiveAttendance = async () => {
    try {
      await fetchActiveAttendance(
        selectedLocationId === 'ALL' ? undefined : selectedLocationId
      );
    } catch (err) {
      console.error('Failed to load attendance:', err);
    }
  };

  // Filter attendance based on search
  const filteredAttendance = attendance.filter(a => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      a.pet_name.toLowerCase().includes(query) ||
      a.household_name.toLowerCase().includes(query)
    );
  });

  const handleSelectAttendance = (record: AttendanceRecord) => {
    setSelectedAttendance(record);
  };

  const handleCheckOut = async () => {
    if (!selectedAttendance) return;

    setIsCheckingOut(true);
    
    try {
      await checkOut(selectedAttendance.booking_id, checkoutNotes);
      
      toast.success(`${selectedAttendance.pet_name} checked out successfully`);
      
      // Refresh dashboard widgets
      refreshAllWidgets?.();
      
      // Close modal
      onClose();
    } catch (error: any) {
      console.error('Check-out error:', error);
      toast.error(error.message || 'Failed to check out');
    } finally {
      setIsCheckingOut(false);
    }
  };

  const calculateDuration = (checkInTime: string): string => {
    const checkIn = new Date(checkInTime);
    const now = new Date();
    const diffMs = now.getTime() - checkIn.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    
    if (diffHours > 0) {
      return `${diffHours}h ${diffMins}m`;
    }
    return `${diffMins}m`;
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <LogOut className="h-5 w-5" />
            Quick Check-out
          </DialogTitle>
          <DialogDescription>
            Select a pet currently in daycare to check them out
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4">
          {/* Search */}
          <div>
            <Label>Search Currently in Daycare</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Type pet name or household name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
                autoFocus
              />
            </div>
            <p className="text-xs text-slate-500 mt-1">
              {filteredAttendance.length} pet(s) currently in daycare
            </p>
          </div>

          {/* Attendance List */}
          {!selectedAttendance && (
            <div className="border rounded-lg max-h-96 overflow-y-auto">
              {filteredAttendance.length === 0 ? (
                <div className="p-8 text-center text-slate-500">
                  <LogOut className="h-12 w-12 mx-auto mb-3 text-slate-300" />
                  <p className="font-medium">No pets in daycare</p>
                  <p className="text-sm mt-1">
                    {searchQuery ? `No matches for "${searchQuery}"` : 'No pets currently checked in'}
                  </p>
                </div>
              ) : (
                <div className="divide-y">
                  {filteredAttendance.map(record => (
                    <button
                      key={record.id}
                      onClick={() => handleSelectAttendance(record)}
                      className="w-full p-3 text-left hover:bg-slate-50 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {record.pet_photo_url && (
                            <img
                              src={record.pet_photo_url}
                              alt={record.pet_name}
                              className="h-10 w-10 rounded-full object-cover"
                            />
                          )}
                          <div>
                            <div className="font-medium">{record.pet_name}</div>
                            <div className="text-sm text-slate-600">{record.household_name}</div>
                            <div className="flex items-center gap-2 text-xs text-slate-500 mt-1">
                              <Clock className="h-3 w-3" />
                              In for {calculateDuration(record.check_in_time)}
                              <span>•</span>
                              <span>Checked in: {new Date(record.check_in_time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-col gap-1 items-end">
                          {record.has_behaviour_flag && (
                            <Badge variant="outline" className="text-xs border-orange-500 text-orange-600">
                              Behaviour
                            </Badge>
                          )}
                          {record.has_medical_flag && (
                            <Badge variant="outline" className="text-xs border-red-500 text-red-600">
                              Medical
                            </Badge>
                          )}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Selected Attendance Details */}
          {selectedAttendance && (
            <>
              <div className="border rounded-lg p-4 bg-slate-50">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    {selectedAttendance.pet_photo_url && (
                      <img
                        src={selectedAttendance.pet_photo_url}
                        alt={selectedAttendance.pet_name}
                        className="h-12 w-12 rounded-full object-cover"
                      />
                    )}
                    <div>
                      <h3 className="font-semibold text-lg">{selectedAttendance.pet_name}</h3>
                      <p className="text-sm text-slate-600">{selectedAttendance.household_name}</p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSelectedAttendance(null);
                      setCheckoutNotes('');
                    }}
                  >
                    Change
                  </Button>
                </div>
                
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-slate-500">Check-in Time:</span>
                    <div className="font-medium">
                      {new Date(selectedAttendance.check_in_time).toLocaleTimeString('en-GB', { 
                        hour: '2-digit', 
                        minute: '2-digit' 
                      })}
                    </div>
                  </div>
                  <div>
                    <span className="text-slate-500">Duration:</span>
                    <div className="font-medium">
                      {calculateDuration(selectedAttendance.check_in_time)}
                    </div>
                  </div>
                  <div className="col-span-2">
                    <span className="text-slate-500">Checked in by:</span>
                    <div className="font-medium">{selectedAttendance.checked_in_by_name}</div>
                  </div>
                </div>

                {/* Alert Flags */}
                {(selectedAttendance.has_behaviour_flag || selectedAttendance.has_medical_flag) && (
                  <div className="mt-3 pt-3 border-t space-y-2">
                    {selectedAttendance.has_behaviour_flag && selectedAttendance.behaviour_notes && (
                      <div className="text-sm">
                        <span className="text-orange-600 font-medium">Behaviour:</span>
                        <p className="text-slate-700 mt-1">{selectedAttendance.behaviour_notes}</p>
                      </div>
                    )}
                    {selectedAttendance.has_medical_flag && selectedAttendance.medical_notes && (
                      <div className="text-sm">
                        <span className="text-red-600 font-medium">Medical:</span>
                        <p className="text-slate-700 mt-1">{selectedAttendance.medical_notes}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Checkout Notes */}
              <div>
                <Label htmlFor="checkout-notes">Check-out Notes (Optional)</Label>
                <Textarea
                  id="checkout-notes"
                  placeholder="Any notes about the pet's day, behaviour, or handover information..."
                  value={checkoutNotes}
                  onChange={(e) => setCheckoutNotes(e.target.value)}
                  rows={4}
                  className="mt-1"
                />
                <p className="text-xs text-slate-500 mt-1">
                  These notes will be visible to the customer
                </p>
              </div>
            </>
          )}
        </div>

        {/* Footer Actions */}
        <DialogFooter className="border-t pt-4">
          <Button variant="outline" onClick={onClose} disabled={isCheckingOut}>
            Cancel
          </Button>
          {selectedAttendance && (
            <Button 
              onClick={handleCheckOut} 
              disabled={isCheckingOut}
              className="min-w-32"
            >
              {isCheckingOut ? (
                <>
                  <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full mr-2"></div>
                  Checking out...
                </>
              ) : (
                <>
                  <LogOut className="h-4 w-4 mr-2" />
                  Check Out
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}