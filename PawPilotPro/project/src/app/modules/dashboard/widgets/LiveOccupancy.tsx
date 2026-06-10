import React, { useEffect, useState } from 'react';
import { WidgetCard } from './WidgetCard';
import { useDashboardStore } from '../store';
import { useSettingsStore } from '../../settings/store';
import { useDaycareStore } from '../../daycare/store';
import { UsersThree, Warning, ArrowRight, SignOut } from '@phosphor-icons/react';
import { useNavigate } from 'react-router';
import { AttendanceRecord } from '../../daycare/types';

// Check-out Time Modal Component
interface CheckoutTimeModalProps {
  petName: string;
  checkInTime: string;
  onConfirm: (checkoutTime?: string) => void;
  onCancel: () => void;
}

function CheckoutTimeModal({ petName, checkInTime, onConfirm, onCancel }: CheckoutTimeModalProps) {
  const [mode, setMode] = useState<'now' | 'earlier'>('now');
  const [customTime, setCustomTime] = useState('');
  const [customDate, setCustomDate] = useState('');

  // Initialize date/time from check-in
  useEffect(() => {
    const now = new Date();
    const checkIn = new Date(checkInTime);
    
    // Default custom time to current time
    setCustomTime(now.toTimeString().slice(0, 5)); // HH:MM
    setCustomDate(checkIn.toISOString().split('T')[0]); // YYYY-MM-DD
  }, [checkInTime]);

  const handleConfirm = () => {
    if (mode === 'now') {
      onConfirm(); // No custom time = use server time
    } else {
      // Build ISO string from date + time
      const checkoutDateTime = new Date(`${customDate}T${customTime}:00`);
      onConfirm(checkoutDateTime.toISOString());
    }
  };

  const formatModalCheckInTime = (timeStr: string) => {
    try {
      const date = new Date(timeStr);
      return date.toLocaleString('en-GB', {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return timeStr;
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
        <h3 className="text-lg font-semibold text-slate-900 mb-2">
          Check out {petName}
        </h3>
        <p className="text-sm text-slate-600 mb-4">
          Checked in: {formatModalCheckInTime(checkInTime)}
        </p>

        <div className="space-y-3 mb-6">
          {/* Option 1: Check out now */}
          <button
            onClick={() => setMode('now')}
            className={`w-full flex items-start gap-3 p-4 rounded-lg border-2 transition-colors ${
              mode === 'now'
                ? 'border-blue-500 bg-blue-50'
                : 'border-slate-200 hover:border-slate-300'
            }`}
          >
            <input
              type="radio"
              checked={mode === 'now'}
              onChange={() => setMode('now')}
              className="mt-0.5"
            />
            <div className="flex-1 text-left">
              <div className="font-medium text-slate-900">Check out now</div>
              <div className="text-sm text-slate-600">Use current time</div>
            </div>
          </button>

          {/* Option 2: Dog left earlier */}
          <button
            onClick={() => setMode('earlier')}
            className={`w-full flex items-start gap-3 p-4 rounded-lg border-2 transition-colors ${
              mode === 'earlier'
                ? 'border-blue-500 bg-blue-50'
                : 'border-slate-200 hover:border-slate-300'
            }`}
          >
            <input
              type="radio"
              checked={mode === 'earlier'}
              onChange={() => setMode('earlier')}
              className="mt-0.5"
            />
            <div className="flex-1 text-left">
              <div className="font-medium text-slate-900">Dog left earlier</div>
              <div className="text-sm text-slate-600">Backdate the check-out time</div>
            </div>
          </button>

          {/* Time picker when "earlier" is selected */}
          {mode === 'earlier' && (
            <div className="ml-11 space-y-3 pt-2">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Date
                </label>
                <input
                  type="date"
                  value={customDate}
                  onChange={(e) => setCustomDate(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Time
                </label>
                <input
                  type="time"
                  value={customTime}
                  onChange={(e) => setCustomTime(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2 border border-slate-300 rounded-md text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            Confirm check-out
          </button>
        </div>
      </div>
    </div>
  );
}

export function LiveOccupancy() {
  const { selectedLocationId, refreshTrigger } = useDashboardStore();
  const { locations } = useSettingsStore();
  const { attendance, fetchActiveAttendance, checkOut } = useDaycareStore();
  const [isLoading, setIsLoading] = useState(true);
  const [showDogList, setShowDogList] = useState(false);
  const [checkingOut, setCheckingOut] = useState<string | null>(null);
  const [checkoutModal, setCheckoutModal] = useState<{ record: AttendanceRecord | null; isOpen: boolean }>({ record: null, isOpen: false });
  const navigate = useNavigate();

  const loadAttendance = async () => {
    setIsLoading(true);
    try {
      await fetchActiveAttendance(
        selectedLocationId === 'ALL' ? undefined : selectedLocationId
      );
    } catch (error) {
      console.error('Failed to load attendance:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAttendance();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedLocationId, refreshTrigger]);

  const getCapacityData = () => {
    if (isLoading) return null;
    
    // Determine active locations and capacities
    let targetLocations = locations.filter(l => l && l.isActive);
    if (selectedLocationId !== 'ALL') {
       const loc = locations.find(l => l && l.id === selectedLocationId);
       if (!loc) return null;
       targetLocations = [loc];
    }

    // Calculate total capacity from locations
    const maxCapacity = targetLocations.reduce((sum, l) => sum + (l.capacity?.maxDogs || 0), 0);
    const smallCapacity = targetLocations.reduce((sum, l) => sum + (l.capacity?.smallDogLimit || 0), 0);
    const largeCapacity = targetLocations.reduce((sum, l) => sum + (l.capacity?.largeDogLimit || 0), 0);

    // Calculate current occupancy from attendance records
    // Filter attendance by selected location(s)
    const activeAttendance = attendance.filter(a => {
      if (selectedLocationId === 'ALL') return true;
      return a.location_id === selectedLocationId;
    });

    const currentTotal = activeAttendance.length;

    // For now, show total capacity and a breakdown by configured limits
    // In future: fetch actual pet sizes to categorize properly
    const hasRoomBreakdown = smallCapacity > 0 && largeCapacity > 0;

    return {
       total: { 
          current: currentTotal, 
          capacity: maxCapacity, 
          percent: maxCapacity > 0 ? Math.round((currentTotal / maxCapacity) * 100) : 0 
       },
       rooms: hasRoomBreakdown ? [
          { 
            name: 'Small Dogs Area', 
            current: 0, // Will be calculated when pet size is available
            capacity: smallCapacity,
            percent: 0,
            placeholder: true
          },
          { 
            name: 'Large Dogs Area', 
            current: 0, // Will be calculated when pet size is available
            capacity: largeCapacity,
            percent: 0,
            placeholder: true
          },
       ] : [
          {
            name: 'All Dogs',
            current: currentTotal,
            capacity: maxCapacity,
            percent: maxCapacity > 0 ? Math.round((currentTotal / maxCapacity) * 100) : 0,
            placeholder: false
          }
       ]
    };
  };

  const data = getCapacityData();

  if (isLoading || !data) {
     return (
        <WidgetCard title="Live Occupancy" icon={UsersThree} className="h-full">
           <div className="flex items-center justify-center h-40">
             <div className="text-center">
               <div className="animate-spin h-8 w-8 border-4 border-slate-200 border-t-slate-600 rounded-full mx-auto mb-2"></div>
               <p className="text-xs text-slate-500">Loading occupancy...</p>
             </div>
           </div>
        </WidgetCard>
     );
  }

  const color = data.total.percent > 90 ? 'bg-red-500' : data.total.percent > 75 ? 'bg-amber-500' : 'bg-green-500';
  const textColor = data.total.percent > 90 ? 'text-red-600' : data.total.percent > 75 ? 'text-amber-600' : 'text-green-600';

  // Get filtered attendance for current location
  const activeAttendance = attendance.filter(a => {
    if (selectedLocationId === 'ALL') return true;
    return a.location_id === selectedLocationId;
  });

  const handleCheckOut = async (record: AttendanceRecord) => {
    // Open modal instead of direct confirm
    setCheckoutModal({ record, isOpen: true });
  };

  const handleCheckoutConfirm = async (checkoutTime?: string) => {
    const record = checkoutModal.record;
    if (!record) return;
    
    setCheckingOut(record.id);
    setCheckoutModal({ record: null, isOpen: false });
    
    try {
      await checkOut(record.booking_id, undefined, checkoutTime);
      await loadAttendance(); // Refresh
    } catch (error) {
      console.error('Failed to check out:', error);
      alert('Failed to check out. Please try again.');
    } finally {
      setCheckingOut(null);
    }
  };

  const formatCheckInTime = (timeStr: string) => {
    try {
      const date = new Date(timeStr);
      return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    } catch {
      return timeStr;
    }
  };

  return (
    <>
      <WidgetCard 
        title="Live Occupancy" 
        icon={UsersThree}
        description="Real-time check-ins"
        className="h-full"
      >
        <div className="space-y-6">
          <div className="text-center py-2">
            <div className="text-4xl font-bold text-slate-900 mb-1">
              {data.total.current} <span className="text-lg text-slate-400 font-normal">/ {data.total.capacity}</span>
            </div>
            <div className="flex items-center justify-center gap-2">
               <div className={`h-2.5 w-2.5 rounded-full ${color}`} />
               <span className={`text-sm font-medium ${textColor}`}>{data.total.percent}% Capacity</span>
            </div>
            {data.total.current > 0 && (
              <p className="text-[10px] text-slate-400 mt-1">
                Dogs currently on site (all dates)
              </p>
            )}
          </div>

          <div className="space-y-3">
            {data.rooms.map((room) => {
              const roomColor = room.percent > 90 ? 'bg-red-500' : room.percent > 75 ? 'bg-amber-500' : 'bg-green-500';
              return (
                <div key={room.name}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="font-medium text-slate-700">{room.name}</span>
                    <span className="text-slate-500">{room.current}/{room.capacity}</span>
                  </div>
                  <div className="relative h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div 
                      className={`h-full transition-all duration-500 ${roomColor}`}
                      style={{ width: `${Math.min(room.percent, 100)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {data.total.percent > 80 && (
            <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 p-3 rounded-md text-amber-900 text-xs">
              <Warning className="h-4 w-4 shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">High occupancy warning</p>
                <p className="text-amber-700 mt-0.5">Check staff ratios and supervision levels</p>
              </div>
            </div>
          )}

          {data.total.percent >= 100 && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-200 p-3 rounded-md text-red-900 text-xs">
              <Warning className="h-4 w-4 shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">At capacity</p>
                <p className="text-red-700 mt-0.5">No additional check-ins available</p>
              </div>
            </div>
          )}

          {data.total.current === 0 && (
            <div className="text-center py-4 text-slate-400 text-sm">
              <UsersThree className="h-8 w-8 mx-auto mb-2 text-slate-300" />
              <p>No dogs currently checked in</p>
            </div>
          )}

          {/* Checked-in Dogs List with Quick Check-out */}
          {data.total.current > 0 && (
            <div className="border-t border-slate-100 pt-4">
              <button
                onClick={() => setShowDogList(!showDogList)}
                className="w-full flex items-center justify-between text-xs font-medium text-slate-700 hover:text-slate-900 mb-3"
              >
                <span>Checked-in Dogs ({activeAttendance.length})</span>
                <span className="text-slate-400">{showDogList ? '−' : '+'}</span>
              </button>
              
              {showDogList && (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {activeAttendance.map((record) => (
                    <div 
                      key={record.id}
                      className="flex items-center justify-between gap-2 p-2 bg-slate-50 rounded-md hover:bg-slate-100 transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <div className="text-xs font-medium text-slate-900 truncate">
                            {record.pet_name}
                          </div>
                          <div className="text-[10px] text-slate-500">
                            {formatCheckInTime(record.check_in_time)}
                          </div>
                        </div>
                        <div className="text-[10px] text-slate-500 truncate">
                          {record.household_name}
                        </div>
                      </div>
                      <button
                        onClick={() => handleCheckOut(record)}
                        disabled={checkingOut === record.id}
                        className="shrink-0 flex items-center gap-1 px-2 py-1 text-[10px] font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded border border-blue-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Check out"
                      >
                        {checkingOut === record.id ? (
                          <div className="animate-spin h-3 w-3 border-2 border-blue-200 border-t-blue-600 rounded-full"></div>
                        ) : (
                          <>
                            <SignOut className="h-3 w-3" />
                            <span>Out</span>
                          </>
                        )}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* View Details Link */}
          {data.total.current > 0 && (
            <button
              onClick={() => navigate('/daycare/attendance')}
              className="w-full flex items-center justify-center gap-2 text-sm text-slate-600 hover:text-slate-900 hover:bg-slate-50 py-2 px-3 rounded-md transition-colors"
            >
              <span>View full attendance</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          )}
        </div>
      </WidgetCard>

      {/* Check-out Time Modal */}
      {checkoutModal.isOpen && checkoutModal.record && (
        <CheckoutTimeModal
          petName={checkoutModal.record.pet_name}
          checkInTime={checkoutModal.record.check_in_time}
          onConfirm={handleCheckoutConfirm}
          onCancel={() => setCheckoutModal({ record: null, isOpen: false })}
        />
      )}
    </>
  );
}
