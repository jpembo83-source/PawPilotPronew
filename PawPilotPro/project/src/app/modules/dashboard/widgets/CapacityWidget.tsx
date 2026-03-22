import React, { useEffect, useState } from 'react';
import { projectId } from '../../../../../utils/supabase/info';
import { WidgetCard } from './WidgetCard';
import { Button } from '../../../components/ui/button';
import { Badge } from '../../../components/ui/badge';
import { 
  Gauge, 
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Calendar,
  Plus
} from 'lucide-react';
import { useNavigate } from 'react-router';
import { useDashboardStore } from '../store';
import { useAuth } from '../../../context/AuthContext';
import { supabase } from '../../../../utils/supabase/client';
import { publicAnonKey } from '../../../../../utils/supabase/info';

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
        `https://${projectId}.supabase.co/functions/v1/make-server-fc003b23/daycare/capacity?${params}`,
        {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'X-User-Token': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.ok) {
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
          icon: CheckCircle2,
          label: 'Spots Available',
          progressColor: 'bg-green-500'
        };
      case 'limited':
        return {
          color: 'text-orange-600',
          bgColor: 'bg-orange-50',
          borderColor: 'border-orange-200',
          icon: AlertTriangle,
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
          icon: AlertTriangle,
          label: 'Overbooked!',
          progressColor: 'bg-red-600'
        };
    }
  };

  const canBook = hasPermission('bookings', 'create');

  if (isLoading) {
    return (
      <WidgetCard title="Daily Capacity" icon={Gauge} description="Available spots today">
        <div className="space-y-3 animate-pulse">
          <div className="h-24 bg-slate-100 rounded-xl" />
          <div className="h-4 bg-slate-100 rounded w-full" />
          <div className="h-16 bg-slate-100 rounded-xl" />
        </div>
      </WidgetCard>
    );
  }

  if (!capacity) {
    return (
      <WidgetCard title="Daily Capacity" icon={Gauge} description="Available spots today">
        <div className="text-center py-8">
          <Gauge className="h-10 w-10 text-slate-300 mx-auto mb-2" />
          <p className="text-sm text-slate-500">Unable to load capacity data</p>
        </div>
      </WidgetCard>
    );
  }

  const statusConfig = getStatusConfig(capacity.status);
  const StatusIcon = statusConfig.icon;

  return (
    <WidgetCard
      title="Daily Capacity"
      icon={Gauge}
      actions={
        <Badge 
          variant="outline" 
          className={`${statusConfig.color} ${statusConfig.borderColor} text-xs`}
        >
          <StatusIcon className="h-3 w-3 mr-1" />
          {statusConfig.label}
        </Badge>
      }
    >
      <div className="space-y-4">
        <div className={`rounded-xl p-4 ${statusConfig.bgColor} ${statusConfig.borderColor} border`}>
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

        <div>
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
            {capacity.utilization_percent}% utilisation
          </div>
        </div>

        {capacity.tomorrow && (
          <div className="bg-slate-50 rounded-lg p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-slate-400" />
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
      </div>
    </WidgetCard>
  );
}
