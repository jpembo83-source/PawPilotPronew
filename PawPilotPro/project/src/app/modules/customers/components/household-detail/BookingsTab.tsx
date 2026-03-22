import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../../../components/ui/card';
import { Calendar } from 'lucide-react';

interface BookingsTabProps {
  householdId: string;
}

export function BookingsTab({ householdId }: BookingsTabProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Bookings & Visit History</CardTitle>
        <CardDescription>
          Complete history of daycare, grooming, overnights, and transport bookings
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="text-center py-12 text-slate-400">
          <Calendar className="h-12 w-12 mx-auto mb-2 text-slate-300" />
          <p>Booking history will appear here</p>
          <p className="text-sm mt-1">Integrated with Daycare, Grooming, Overnights, and Transport modules</p>
        </div>
      </CardContent>
    </Card>
  );
}
