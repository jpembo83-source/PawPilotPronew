// Capacity Dashboard - Unified view of capacity across all services
// Look forward and back, make informed booking decisions

import React, { useEffect, useState } from 'react';
import { useCapacityStore } from './store';
import { useDashboardStore } from '../dashboard/store';
import { useSettingsStore } from '../settings/store';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Skeleton } from '../../components/ui/skeleton';
import { 
  Calendar,
  ChevronLeft,
  ChevronRight,
  Dog,
  Scissors,
  Moon,
  Truck,
  Users,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  CalendarDays
} from 'lucide-react';
import type { ServiceCapacity, DailyCapacitySummary } from './types';

// Helper to format date
function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

// Helper to get week start (Monday)
function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.setDate(diff));
}

// Service config
const SERVICES = [
  { id: 'daycare', label: 'Daycare', icon: Dog, color: 'blue' },
  { id: 'grooming', label: 'Grooming', icon: Scissors, color: 'purple' },
  { id: 'overnights', label: 'Overnights', icon: Moon, color: 'indigo' },
  { id: 'transport', label: 'Transport', icon: Truck, color: 'amber' },
] as const;

// Capacity status colors
function getStatusColor(status: ServiceCapacity['status']) {
  switch (status) {
    case 'available': return 'bg-green-500';
    case 'limited': return 'bg-amber-500';
    case 'full': return 'bg-red-500';
    case 'overbooked': return 'bg-red-700';
    default: return 'bg-slate-300';
  }
}

function getStatusBadge(status: ServiceCapacity['status']) {
  switch (status) {
    case 'available': 
      return <Badge className="bg-green-100 text-green-700 border-green-200">Available</Badge>;
    case 'limited': 
      return <Badge className="bg-amber-100 text-amber-700 border-amber-200">Limited</Badge>;
    case 'full': 
      return <Badge className="bg-red-100 text-red-700 border-red-200">Full</Badge>;
    case 'overbooked': 
      return <Badge className="bg-red-200 text-red-800 border-red-300">Overbooked</Badge>;
    default: 
      return <Badge variant="outline">Unknown</Badge>;
  }
}

// Service capacity card
function ServiceCapacityCard({ 
  service, 
  capacity, 
  onClick 
}: { 
  service: typeof SERVICES[number];
  capacity: ServiceCapacity | null;
  onClick?: () => void;
}) {
  const Icon = service.icon;
  
  if (!capacity || capacity.total_capacity === 0) {
    return (
      <Card className="opacity-50">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-slate-100">
              <Icon className="h-5 w-5 text-slate-400" />
            </div>
            <div>
              <p className="font-medium text-slate-600">{service.label}</p>
              <p className="text-xs text-slate-400">Not configured</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const statusColor = getStatusColor(capacity.status);
  
  return (
    <Card 
      className="cursor-pointer hover:shadow-md transition-shadow"
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg bg-${service.color}-100`}>
              <Icon className={`h-5 w-5 text-${service.color}-600`} />
            </div>
            <div>
              <p className="font-medium">{service.label}</p>
              <p className="text-xs text-slate-500">
                {capacity.booked} booked / {capacity.total_capacity} capacity
              </p>
            </div>
          </div>
          {getStatusBadge(capacity.status)}
        </div>
        
        {/* Capacity bar */}
        <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
          <div 
            className={`h-full ${statusColor} transition-all duration-300`}
            style={{ width: `${Math.min(capacity.utilization_percent, 100)}%` }}
          />
        </div>
        
        <div className="flex justify-between mt-2 text-sm">
          <span className="text-slate-600">
            {capacity.available} available
          </span>
          <span className="font-medium">
            {capacity.utilization_percent}%
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

// Day cell for weekly view
function DayCell({ 
  day, 
  isSelected, 
  isToday,
  onClick 
}: { 
  day: DailyCapacitySummary;
  isSelected: boolean;
  isToday: boolean;
  onClick: () => void;
}) {
  const date = new Date(day.date);
  const dayName = date.toLocaleDateString('en-GB', { weekday: 'short' });
  const dayNum = date.getDate();
  
  // Calculate overall status
  const services = [day.daycare, day.grooming, day.overnights, day.transport].filter(Boolean);
  const hasOverbooked = services.some(s => s?.status === 'overbooked');
  const hasFull = services.some(s => s?.status === 'full');
  const hasLimited = services.some(s => s?.status === 'limited');
  
  let overallStatus = 'available';
  if (hasOverbooked) overallStatus = 'overbooked';
  else if (hasFull) overallStatus = 'full';
  else if (hasLimited) overallStatus = 'limited';
  
  return (
    <button
      onClick={onClick}
      className={`
        flex-1 p-3 rounded-lg border-2 transition-all min-w-[80px]
        ${isSelected 
          ? 'border-blue-500 bg-blue-50' 
          : 'border-transparent hover:border-slate-200 hover:bg-slate-50'
        }
        ${isToday && !isSelected && 'ring-2 ring-blue-200'}
      `}
    >
      <div className="text-center">
        <p className={`text-xs font-medium ${isToday ? 'text-blue-600' : 'text-slate-500'}`}>
          {dayName}
        </p>
        <p className={`text-lg font-bold ${isSelected ? 'text-blue-700' : 'text-slate-700'}`}>
          {dayNum}
        </p>
        
        {/* Mini status indicators */}
        <div className="flex justify-center gap-1 mt-1">
          {day.daycare && day.daycare.total_capacity > 0 && (
            <div className={`w-2 h-2 rounded-full ${getStatusColor(day.daycare.status)}`} title="Daycare" />
          )}
          {day.grooming && day.grooming.total_capacity > 0 && (
            <div className={`w-2 h-2 rounded-full ${getStatusColor(day.grooming.status)}`} title="Grooming" />
          )}
          {day.overnights && day.overnights.total_capacity > 0 && (
            <div className={`w-2 h-2 rounded-full ${getStatusColor(day.overnights.status)}`} title="Overnights" />
          )}
          {day.transport && day.transport.total_capacity > 0 && (
            <div className={`w-2 h-2 rounded-full ${getStatusColor(day.transport.status)}`} title="Transport" />
          )}
        </div>
      </div>
    </button>
  );
}

export function CapacityDashboard() {
  const { selectedLocationId } = useDashboardStore();
  const { globalEnabledModules } = useSettingsStore();
  const { 
    weeklyView, 
    selectedDate, 
    dailySummary,
    isLoading, 
    setSelectedDate,
    fetchWeeklyCapacity, 
    fetchDailyCapacity 
  } = useCapacityStore();

  const [currentWeekStart, setCurrentWeekStart] = useState(() => getWeekStart(new Date()));

  useEffect(() => {
    fetchWeeklyCapacity(formatDate(currentWeekStart), selectedLocationId);
    fetchDailyCapacity(selectedDate, selectedLocationId);
  }, [currentWeekStart, selectedLocationId]);

  const goToPreviousWeek = () => {
    const newStart = new Date(currentWeekStart);
    newStart.setDate(newStart.getDate() - 7);
    setCurrentWeekStart(newStart);
  };

  const goToNextWeek = () => {
    const newStart = new Date(currentWeekStart);
    newStart.setDate(newStart.getDate() + 7);
    setCurrentWeekStart(newStart);
  };

  const goToToday = () => {
    const today = new Date();
    setCurrentWeekStart(getWeekStart(today));
    setSelectedDate(formatDate(today));
  };

  const today = formatDate(new Date());
  
  // Filter services by enabled modules
  const enabledServices = SERVICES.filter(s => 
    globalEnabledModules.includes(s.id) || s.id === 'daycare' // daycare often core
  );

  // Format week range for header
  const weekEnd = new Date(currentWeekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);
  const weekRangeText = `${currentWeekStart.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} - ${weekEnd.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`;

  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Capacity Overview</h1>
          <p className="text-slate-600 mt-1">
            View availability across all services to make informed booking decisions
          </p>
        </div>
        <Button variant="outline" onClick={goToToday}>
          <CalendarDays className="h-4 w-4 mr-2" />
          Today
        </Button>
      </div>

      {/* Week Navigation */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <Button variant="ghost" size="sm" onClick={goToPreviousWeek}>
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <CardTitle className="text-lg">{weekRangeText}</CardTitle>
            <Button variant="ghost" size="sm" onClick={goToNextWeek}>
              <ChevronRight className="h-5 w-5" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading && !weeklyView ? (
            <div className="flex gap-2">
              {[1,2,3,4,5,6,7].map(i => (
                <Skeleton key={i} className="flex-1 h-24" />
              ))}
            </div>
          ) : weeklyView ? (
            <div className="flex gap-2 overflow-x-auto pb-2">
              {weeklyView.days.map(day => (
                <DayCell
                  key={day.date}
                  day={day}
                  isSelected={day.date === selectedDate}
                  isToday={day.date === today}
                  onClick={() => setSelectedDate(day.date)}
                />
              ))}
            </div>
          ) : (
            <p className="text-center text-slate-500 py-4">No data available</p>
          )}
          
          {/* Legend */}
          <div className="flex items-center justify-center gap-4 mt-4 pt-4 border-t text-xs text-slate-500">
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-green-500" />
              <span>Available</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-amber-500" />
              <span>Limited</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-red-500" />
              <span>Full</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Selected Day Details */}
      <div>
        <h2 className="text-lg font-semibold text-slate-800 mb-4">
          {new Date(selectedDate).toLocaleDateString('en-GB', { 
            weekday: 'long', 
            day: 'numeric', 
            month: 'long', 
            year: 'numeric' 
          })}
          {selectedDate === today && (
            <Badge className="ml-2 bg-blue-100 text-blue-700">Today</Badge>
          )}
        </h2>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {enabledServices.map(service => {
            const capacity = dailySummary?.[service.id as keyof DailyCapacitySummary] as ServiceCapacity | null;
            return (
              <ServiceCapacityCard
                key={service.id}
                service={service}
                capacity={capacity}
              />
            );
          })}
        </div>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => window.location.href = '/daycare/bookings?action=create'}>
              <Dog className="h-4 w-4 mr-2" />
              New Daycare Booking
            </Button>
            <Button variant="outline" size="sm" onClick={() => window.location.href = '/grooming?action=create'}>
              <Scissors className="h-4 w-4 mr-2" />
              New Grooming Appointment
            </Button>
            <Button variant="outline" size="sm" onClick={() => window.location.href = '/overnights?action=create'}>
              <Moon className="h-4 w-4 mr-2" />
              New Overnight Booking
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Capacity Tips */}
      <Card className="bg-slate-50 border-slate-200">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Calendar className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="font-medium text-slate-700">Capacity Planning Tips</p>
              <ul className="mt-2 text-sm text-slate-600 space-y-1">
                <li>• <strong>Green</strong> - Good availability, safe to book</li>
                <li>• <strong>Amber</strong> - Limited spots, check before confirming</li>
                <li>• <strong>Red</strong> - Full or overbooked, consider alternatives</li>
                <li>• Click any day to see detailed breakdown by service</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default CapacityDashboard;
