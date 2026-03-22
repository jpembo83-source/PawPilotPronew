import React from 'react';
import { Booking, Dog } from '../../../lib/store';
import { useSettingsStore } from '../../settings/store';

interface LiveOccupancyProps {
  bookings: Booking[];
  dogs: Dog[];
}

export function LiveOccupancy({ bookings, dogs }: LiveOccupancyProps) {
  const { locations } = useSettingsStore();
  const activeLocations = locations.filter(l => l.isActive);

  if (activeLocations.length === 0) {
    return <div className="p-4 text-center text-slate-500">No active locations found.</div>;
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 w-full">
      {activeLocations.map(location => {
        const locBookings = bookings.filter(b => b.locationId === location.id && b.status === 'checked-in');
        const current = locBookings.length;
        const capacity = location.capacity.maxDogs;
        const occupancy = capacity > 0 ? (current / capacity) * 100 : 0;
        const isFull = occupancy >= 90;
        
        return (
          <div key={location.id} className={`p-4 rounded-lg border ${isFull ? 'border-red-200 bg-red-50' : 'border-slate-200 bg-white'} relative overflow-hidden`}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold text-slate-700 truncate pr-2">{location.name}</h3>
              <span className={`text-xs font-mono px-2 py-1 rounded-full ${isFull ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-600'}`}>
                {current} / {capacity}
              </span>
            </div>
            
            <div className="flex flex-wrap gap-2 content-start min-h-[60px]">
              {locBookings.map((b, i) => {
                 const dog = dogs.find(d => d.id === b.dogId);
                 return (
                    <div 
                      key={b.id} 
                      className="w-8 h-8 rounded-full bg-indigo-500 border-2 border-white shadow-sm flex items-center justify-center text-[10px] text-white font-bold"
                      title={dog?.name || 'Unknown'}
                    >
                      {(dog?.name || '?').charAt(0)}
                    </div>
                 );
              })}
              {Array.from({ length: Math.max(0, Math.min(10, capacity - current)) }).map((_, i) => (
                <div 
                  key={`empty-${i}`} 
                  className="w-8 h-8 rounded-full border-2 border-dashed border-slate-200"
                />
              ))}
            </div>

            <div className="absolute bottom-0 left-0 w-full h-1 bg-slate-100">
              <div 
                className={`h-full transition-all duration-500 ${isFull ? 'bg-red-500' : 'bg-indigo-500'}`} 
                style={{ width: `${Math.min(100, occupancy)}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
