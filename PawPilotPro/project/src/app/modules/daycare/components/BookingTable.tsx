import React from 'react';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '../../../components/ui/table';
import { Badge } from '../../../components/ui/badge';
import { Button } from '../../../components/ui/button';
import { Dog, Booking, Owner } from '../../../lib/store';
import { Warning, CheckCircle, Clock } from '@phosphor-icons/react';

interface BookingTableProps {
  bookings: Booking[];
  dogs: Dog[];
  owners: Owner[];
  onCheckIn: (id: string) => void;
}

export function BookingTable({ bookings, dogs, owners, onCheckIn }: BookingTableProps) {
  const getDog = (id: string) => dogs.find(d => d.id === id);
  const getOwner = (id: string) => owners.find(o => o.id === id);

  return (
    <div className="rounded-md border border-slate-200">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Dog</TableHead>
            <TableHead>Breed</TableHead>
            <TableHead>Owner</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Alerts</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {bookings.map((booking) => {
            const dog = getDog(booking.dogId);
            const owner = dog ? getOwner(dog.ownerId) : null;
            
            return (
              <TableRow key={booking.id}>
                <TableCell className="font-medium">
                  {dog?.name}
                </TableCell>
                <TableCell>{dog?.breed}</TableCell>
                <TableCell>
                  <div className="flex flex-col">
                    <span className="text-sm">{owner?.name}</span>
                    <span className="text-xs text-slate-500">{owner?.phone}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <StatusBadge status={booking.status} />
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    {dog?.alerts.includes('medication') && (
                      <div className="text-blue-500" title="Medication Required">
                        <Clock className="h-4 w-4" />
                      </div>
                    )}
                    {dog?.alerts.includes('anxious') && (
                      <div className="text-orange-500" title="Behavioral Alert">
                        <Warning className="h-4 w-4" />
                      </div>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  {booking.status === 'booked' && (
                    <Button 
                      size="sm" 
                      onClick={() => onCheckIn(booking.id)}
                      className=""
                    >
                      Check In
                    </Button>
                  )}
                  {booking.status === 'checked-in' && (
                     <span className="text-xs text-slate-500 font-mono">
                       In: {booking.checkInTime}
                     </span>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    'booked': 'bg-slate-100 text-slate-800',
    'checked-in': 'bg-green-100 text-green-800',
    'completed': 'bg-blue-100 text-blue-800',
    'cancelled': 'bg-red-100 text-red-800',
  };

  return (
    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${styles[status] || 'bg-gray-100'}`}>
      {status.replace('-', ' ').toUpperCase()}
    </span>
  );
}
