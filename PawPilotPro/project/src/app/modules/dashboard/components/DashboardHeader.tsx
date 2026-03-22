import React from 'react';
import { Calendar as CalendarIcon, LayoutTemplate, RotateCcw, Sparkles } from 'lucide-react';
import { useDashboardStore, DateRange } from '../store';
import { useAuth } from '../../../context/AuthContext';
import { useSettingsStore } from '../../settings/store';
import { Button } from "../../../components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../../../components/ui/dropdown-menu";

interface DashboardHeaderProps {
  isCustomizing: boolean;
  setIsCustomizing: (val: boolean) => void;
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good Morning';
  if (hour < 17) return 'Good Afternoon';
  return 'Good Evening';
}

function getFormattedDate(): string {
  return new Date().toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export function DashboardHeader({ isCustomizing, setIsCustomizing }: DashboardHeaderProps) {
  const { dateRange, setDateRange, resetUserLayout, selectedLocationId } = useDashboardStore();
  const { user } = useAuth();
  const { locations } = useSettingsStore();

  const selectedLocation = locations.find(l => l.id === selectedLocationId);
  const locationLabel = selectedLocationId === 'ALL' || !selectedLocationId
    ? 'All Locations'
    : selectedLocation?.name || 'Unknown';

  const handleReset = () => {
    if (confirm('Reset dashboard layout to default?')) {
      if (user) resetUserLayout(user.id, user.role);
    }
  };

  const getRangeLabel = (range: DateRange) => {
    switch(range) {
      case 'today': return 'Today';
      case 'yesterday': return 'Yesterday';
      case '7d': return 'Last 7 Days';
      case '30d': return 'Last 30 Days';
      case 'custom': return 'Custom Range';
      default: return 'Today';
    }
  };

  const firstName = user?.user_metadata?.name?.split(' ')[0]
    || user?.user_metadata?.full_name?.split(' ')[0]
    || '';

  return (
    <div className="relative overflow-hidden border-b border-border/40">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/8 via-secondary/30 to-accent/20" />
      <div className="absolute top-0 right-0 w-96 h-96 bg-primary/5 rounded-full -translate-y-1/2 translate-x-1/3 blur-3xl" />
      <div className="absolute bottom-0 left-0 w-64 h-64 bg-secondary/40 rounded-full translate-y-1/2 -translate-x-1/4 blur-3xl" />

      <div className="relative px-6 md:px-8 py-5 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground tracking-wide uppercase">
            <span>{getFormattedDate()}</span>
            <span className="text-border">|</span>
            <span className="inline-flex items-center gap-1 text-primary">
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              {locationLabel}
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground tracking-tight">
            {isCustomizing ? (
              <span className="flex items-center gap-2">
                <Sparkles className="h-6 w-6 text-primary" />
                Customise Dashboard
              </span>
            ) : (
              <>
                {getGreeting()}{firstName ? `, ${firstName}` : ''}
              </>
            )}
          </h1>
          <p className="text-sm text-muted-foreground">
            {isCustomizing
              ? 'Drag widgets to reorder or toggle visibility'
              : 'Your operational overview at a glance'
            }
          </p>
        </div>

        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                className="w-[150px] justify-start text-left font-normal bg-card/80 backdrop-blur-sm border-border/60 shadow-sm hover:shadow-md transition-shadow"
              >
                <CalendarIcon className="mr-2 h-4 w-4 text-primary" />
                {getRangeLabel(dateRange)}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[150px]">
              <DropdownMenuItem onClick={() => setDateRange('today')}>Today</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setDateRange('yesterday')}>Yesterday</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setDateRange('7d')}>Last 7 Days</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setDateRange('30d')}>Last 30 Days</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {isCustomizing ? (
            <>
              <Button
                variant="ghost"
                onClick={handleReset}
                className="text-muted-foreground hover:text-foreground"
              >
                <RotateCcw className="h-4 w-4 mr-2" />
                Reset
              </Button>
              <Button
                onClick={() => setIsCustomizing(false)}
                className="bg-primary text-primary-foreground hover:bg-primary/90 shadow-md"
              >
                Done
              </Button>
            </>
          ) : (
            <Button
              variant="outline"
              onClick={() => setIsCustomizing(true)}
              className="gap-2 bg-card/80 backdrop-blur-sm border-border/60 shadow-sm hover:shadow-md transition-shadow"
            >
              <LayoutTemplate className="h-4 w-4" />
              Customise
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
