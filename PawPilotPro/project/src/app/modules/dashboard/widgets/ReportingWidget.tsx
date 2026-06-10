// Simple Reporting Widget - Daily revenue, dogs per day trend, busiest days
// Quick insights without navigating to full reports

import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Badge } from '../../../components/ui/badge';
import { Skeleton } from '../../../components/ui/skeleton';
import { 
  ChartBar, 
  TrendUp, 
  TrendDown,
  CalendarBlank,
  CurrencyDollar,
  Dog,
  Clock
} from '@phosphor-icons/react';
import { useNavigate } from 'react-router';
import { useDashboardStore } from '../store';
import { useSettingsStore } from '../../settings/store';
import { supabase } from '../../../../utils/supabase/client';

interface ReportingData {
  today: {
    revenue: number;
    dogs: number;
    revenue_trend: number; // % vs same day last week
    dogs_trend: number;
  };
  week: {
    total_revenue: number;
    total_dogs: number;
    avg_daily_dogs: number;
    busiest_day: string;
    busiest_day_count: number;
  };
  by_day: {
    day: string;
    dogs: number;
    revenue: number;
  }[];
}

export function ReportingWidget() {
  const navigate = useNavigate();
  const { selectedLocationId, widgetRefreshTrigger } = useDashboardStore();
  const { organisation } = useSettingsStore();
  
  const [data, setData] = useState<ReportingData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  // Use organisation currency, fallback to GBP
  const currency = organisation.currency || 'GBP';

  useEffect(() => {
    fetchReportingData();
  }, [selectedLocationId, widgetRefreshTrigger]);

  const fetchReportingData = async () => {
    setIsLoading(true);
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const params = new URLSearchParams();
      if (selectedLocationId && selectedLocationId !== 'ALL') {
        params.append('location_id', selectedLocationId);
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/make-server-fc003b23/reports/quick-stats?${params}`,
        {
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'X-User-Token': session.access_token,
          }
        }
      );

      if (!response.ok) {
        // No mock data - show empty state until API is implemented
        setData(null);
        return;
      }

      const result = await response.json();
      setData(result);
    } catch (err) {
      console.error('Failed to fetch reporting data:', err);
      setData(null);
    } finally {
      setIsLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    // Use appropriate locale based on currency
    const locale = currency === 'GBP' ? 'en-GB' : currency === 'USD' ? 'en-US' : currency === 'EUR' ? 'de-DE' : 'en-GB';
    return new Intl.NumberFormat(locale, { 
      style: 'currency', 
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getTrendIcon = (trend: number) => {
    if (trend > 0) return <TrendUp className="h-3 w-3 text-green-500" />;
    if (trend < 0) return <TrendDown className="h-3 w-3 text-red-500" />;
    return null;
  };

  const getTrendColor = (trend: number) => {
    if (trend > 0) return 'text-green-600';
    if (trend < 0) return 'text-red-600';
    return 'text-slate-500';
  };

  if (isLoading) {
    return (
      <Card className="h-full">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <ChartBar className="h-4 w-4" />
            Quick Stats
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data) {
    return (
      <Card className="h-full">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <ChartBar className="h-4 w-4" />
            Quick Stats
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-slate-500">Unable to load stats</p>
        </CardContent>
      </Card>
    );
  }

  // Calculate max for chart scaling
  const maxDogs = Math.max(...data.by_day.map(d => d.dogs), 1);

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <ChartBar className="h-4 w-4 text-blue-500" />
          Quick Stats
        </CardTitle>
      </CardHeader>
      
      <CardContent className="flex-1 space-y-4">
        {/* Today's Stats */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-green-50 rounded-lg p-3">
            <div className="flex items-center gap-1.5 text-green-700 mb-1">
              <CurrencyDollar className="h-3.5 w-3.5" />
              <span className="text-xs font-medium">Today's Revenue</span>
            </div>
            <div className="text-xl font-bold text-green-800">
              {formatCurrency(data.today.revenue)}
            </div>
            <div className={`text-xs flex items-center gap-1 ${getTrendColor(data.today.revenue_trend)}`}>
              {getTrendIcon(data.today.revenue_trend)}
              {data.today.revenue_trend > 0 ? '+' : ''}{data.today.revenue_trend.toFixed(1)}% vs last week
            </div>
          </div>
          
          <div className="bg-blue-50 rounded-lg p-3">
            <div className="flex items-center gap-1.5 text-blue-700 mb-1">
              <Dog className="h-3.5 w-3.5" />
              <span className="text-xs font-medium">Dogs Today</span>
            </div>
            <div className="text-xl font-bold text-blue-800">
              {data.today.dogs}
            </div>
            <div className={`text-xs flex items-center gap-1 ${getTrendColor(data.today.dogs_trend)}`}>
              {getTrendIcon(data.today.dogs_trend)}
              {data.today.dogs_trend > 0 ? '+' : ''}{data.today.dogs_trend.toFixed(1)}% vs last week
            </div>
          </div>
        </div>

        {/* Mini bar chart - dogs per day this week */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-slate-600">This Week</span>
            <span className="text-xs text-slate-500">
              Avg: {data.week.avg_daily_dogs.toFixed(0)} dogs/day
            </span>
          </div>
          <div className="flex items-end gap-1 h-16">
            {data.by_day.map((day, i) => (
              <div key={day.day} className="flex-1 flex flex-col items-center">
                <div 
                  className="w-full bg-blue-400 rounded-t transition-all hover:bg-blue-500"
                  style={{ 
                    height: `${(day.dogs / maxDogs) * 100}%`,
                    minHeight: '4px'
                  }}
                  title={`${day.day}: ${day.dogs} dogs, ${formatCurrency(day.revenue)}`}
                />
                <span className="text-[10px] text-slate-500 mt-1">{day.day}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Week summary */}
        <div className="bg-slate-50 rounded-lg p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-600">Week Total</span>
            <span className="text-sm font-semibold">{formatCurrency(data.week.total_revenue)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-600">Total Dogs</span>
            <span className="text-sm font-semibold">{data.week.total_dogs}</span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1 text-xs text-slate-600">
              <Clock className="h-3 w-3" />
              Busiest Day
            </div>
            <Badge variant="secondary" className="text-xs">
              {data.week.busiest_day} ({data.week.busiest_day_count})
            </Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
