// Capacity Widget - Shows available spots for today with overbooking protection
// At-a-glance view of "we have X spots left today"

import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Badge } from '../../../components/ui/badge';
import { Skeleton } from '../../../components/ui/skeleton';
import { Progress } from '../../../components/ui/progress';
import { 
  UsersThree, 
  Warning,
  CheckCircle,
  XCircle,
  TrendUp,
  CalendarBlank,
  Plus
} from '@phosphor-icons/react';
import { useNavigate } from 'react-router';
import { useDashboardStore } from '../store';
import { useAuth } from '../../../context/AuthContext';
import { supabase } from '../../../../utils/supabase/client';

interface CapacityData {
  date: string;
  total_capacity: number;
  booked: number;
  checked_in: number;
  available: number;
  utilization_percent: number;
  status: 'available' | 'limited' | 'full' | 'overbooked';
  tomorrow?: {
    booked: number;
    available: number;
    utilization_percent: number;
  };
}

export function CapacityWidget() {
  const navigate = useNavigate();
  const { user, hasPermission } = useAuth();
  const { selectedLocationId, widgetRefreshTrigger } = useDashboardStore();
  
  const [capacity, setCapacity] = useState<CapacityData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchCapacity();
  }, [selectedLocationId, widgetRefreshTrigger]);

  const fetchCapacity = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setError('Not authenticated');
        return;
      }

      const params = new URLSearchParams();
      if (selectedLocationId && selectedLocationId !== 'ALL') {
        params.append('location_id', selectedLocationId);
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/make-server-fc003b23/daycare/capacity?${params}`,
        {
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'X-User-Token': session.access_token,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.ok) {
        // No mock data - show empty state until API is implemented
        setCapacity(null);
        return;
      }

      const data = await response.json();
      setCapacity(data);
    } catch (err) {
      console.error('Failed to fetch capacity:', err);
      setCapacity(null);
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusConfig = (status: CapacityData['status']) => {
    switch (status) {
      case 'available':
        return {
          color: 'text-green-600',
          bgColor: 'bg-green-50',
          borderColor: 'border-green-200',
          icon: CheckCircle,
          label: 'Spots Available',
          progressColor: 'bg-green-500'
        };
      case 'limited':
        return {
          color: 'text-orange-600',
          bgColor: 'bg-orange-50',
          borderColor: 'border-orange-200',
          icon: Warning,
          label: 'Limited Spots',
          progressColor: 'bg-orange-500'
        };
      case 'full':
        return {
          color: 'text-red-600',
          bgColor: 'bg-red-50',
          borderColor: 'border-red-200',
          icon: XCircle,
          label: 'Fully Booked',
          progressColor: 'bg-red-500'
        };
      case 'overbooked':
        return {
          color: 'text-red-700',
          bgColor: 'bg-red-100',
          borderColor: 'border-red-300',
          icon: Warning,
          label: 'Overbooked!',
          progressColor: 'bg-red-600'
        };
    }
  };

  const canBook = hasPermission('bookings', 'create');

  if (isLoading) {
    return (
      <Card className="h-full">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <UsersThree className="h-4 w-4" />
            Today's Capacity
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-24 w-full mb-4" />
          <Skeleton className="h-4 w-full mb-2" />
          <Skeleton className="h-16 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!capacity) {
    return (
      <Card className="h-full">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <UsersThree className="h-4 w-4" />
            Today's Capacity
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-slate-500">Unable to load capacity data</p>
        </CardContent>
      </Card>
    );
  }

  const statusConfig = getStatusConfig(capacity.status);
  const StatusIcon = statusConfig.icon;

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <UsersThree className="h-4 w-4" />
            Today's Capacity
          </CardTitle>
          <Badge 
            variant="outline" 
            className={`${statusConfig.color} ${statusConfig.borderColor}`}
          >
            <StatusIcon className="h-3 w-3 mr-1" />
            {statusConfig.label}
          </Badge>
        </div>
      </CardHeader>
      
      <CardContent className="flex-1">
        {/* Main capacity display */}
        <div className={`rounded-xl p-4 ${statusConfig.bgColor} ${statusConfig.borderColor} border mb-4`}>
          <div className="text-center">
            <div className={`text-4xl font-bold ${statusConfig.color}`}>
              {capacity.available}
            </div>
            <div className="text-sm text-slate-600 mt-1">
              spots available
            </div>
            <div className="text-xs text-slate-500 mt-0.5">
              of {capacity.total_capacity} total capacity
            </div>
          </div>
        </div>

        {/* Progress bar */}
        <div className="mb-4">
          <div className="flex justify-between text-xs text-slate-600 mb-1">
            <span>{capacity.checked_in} checked in</span>
            <span>{capacity.booked} booked</span>
          </div>
          <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
            <div 
              className={`h-full ${statusConfig.progressColor} transition-all duration-500`}
              style={{ width: `${Math.min(capacity.utilization_percent, 100)}%` }}
            />
          </div>
          <div className="text-xs text-slate-500 mt-1 text-center">
            {capacity.utilization_percent}% utilization
          </div>
        </div>

        {/* Tomorrow preview */}
        {capacity.tomorrow && (
          <div className="bg-slate-50 rounded-lg p-3 mb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CalendarBlank className="h-4 w-4 text-slate-400" />
                <span className="text-sm font-medium text-slate-700">Tomorrow</span>
              </div>
              <div className="text-right">
                <span className={`text-sm font-bold ${
                  capacity.tomorrow.available <= 2 ? 'text-orange-600' : 'text-slate-700'
                }`}>
                  {capacity.tomorrow.available} spots
                </span>
                <span className="text-xs text-slate-500 ml-1">
                  ({capacity.tomorrow.utilization_percent}%)
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Quick action */}
        {canBook && capacity.available > 0 && (
          <Button 
            className="w-full" 
            size="sm"
            onClick={() => navigate('/daycare/bookings?action=create')}
          >
            <Plus className="h-4 w-4 mr-2" />
            New Booking
          </Button>
        )}
        
        {capacity.available === 0 && (
          <div className="text-center py-2">
            <p className="text-sm text-red-600 font-medium">
              No more bookings available today
            </p>
            <Button 
              variant="outline" 
              size="sm" 
              className="mt-2"
              onClick={() => navigate('/daycare/bookings')}
            >
              Manage Waitlist
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
