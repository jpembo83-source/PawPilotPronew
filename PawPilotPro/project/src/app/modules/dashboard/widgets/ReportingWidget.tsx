import React, { useEffect, useState } from 'react';
import { projectId } from '../../../../../utils/supabase/info';
import { WidgetCard } from './WidgetCard';
import { Badge } from '../../../components/ui/badge';
import { 
  TrendingUp, 
  TrendingDown,
  DollarSign,
  Dog,
  Clock
} from 'lucide-react';
import { useDashboardStore } from '../store';
import { useSettingsStore } from '../../settings/store';
import { supabase } from '../../../../utils/supabase/client';
import { publicAnonKey } from '../../../../../utils/supabase/info';

interface ReportingData {
  today: {
    revenue: number;
    dogs: number;
    revenue_trend: number;
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
  const { selectedLocationId, widgetRefreshTrigger } = useDashboardStore();
  const { organisation } = useSettingsStore();
  
  const [data, setData] = useState<ReportingData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
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
        `https://${projectId}.supabase.co/functions/v1/make-server-fc003b23/reports/quick-stats?${params}`,
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${publicAnonKey}`,
            'X-User-Token': `Bearer ${session.access_token}`,
          }
        }
      );

      if (!response.ok) {
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
    const locale = currency === 'GBP' ? 'en-GB' : currency === 'USD' ? 'en-US' : currency === 'EUR' ? 'de-DE' : 'en-GB';
    return new Intl.NumberFormat(locale, { 
      style: 'currency', 
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getTrendIcon = (trend: number) => {
    if (trend > 0) return <TrendingUp className="h-3 w-3 text-green-500" />;
    if (trend < 0) return <TrendingDown className="h-3 w-3 text-red-500" />;
    return null;
  };

  const getTrendColor = (trend: number) => {
    if (trend > 0) return 'text-green-600';
    if (trend < 0) return 'text-red-600';
    return 'text-slate-500';
  };

  if (isLoading) {
    return (
      <WidgetCard title="Quick Stats" icon={TrendingUp} description="Revenue and trends">
        <div className="space-y-3 animate-pulse">
          <div className="h-20 bg-slate-100 rounded-lg" />
          <div className="h-20 bg-slate-100 rounded-lg" />
        </div>
      </WidgetCard>
    );
  }

  if (!data) {
    return (
      <WidgetCard title="Quick Stats" icon={TrendingUp} description="Revenue and trends">
        <div className="text-center py-8">
          <TrendingUp className="h-10 w-10 text-slate-300 mx-auto mb-2" />
          <p className="text-sm text-slate-500">Unable to load stats</p>
        </div>
      </WidgetCard>
    );
  }

  const maxDogs = Math.max(...data.by_day.map(d => d.dogs), 1);

  return (
    <WidgetCard title="Quick Stats" icon={TrendingUp} description="Revenue and trends">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-green-50 rounded-lg p-3">
            <div className="flex items-center gap-1.5 text-green-700 mb-1">
              <DollarSign className="h-3.5 w-3.5" />
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

        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-slate-600">This Week</span>
            <span className="text-xs text-slate-500">
              Avg: {data.week.avg_daily_dogs.toFixed(0)} dogs/day
            </span>
          </div>
          <div className="flex items-end gap-1 h-16">
            {data.by_day.map((day) => (
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
      </div>
    </WidgetCard>
  );
}
