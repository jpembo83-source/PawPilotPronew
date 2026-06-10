// Weekly Pulse Widget - Bar chart showing activity over the week
import React, { useState, useEffect } from 'react';
import { WidgetCard } from './WidgetCard';
import { TrendUp } from '@phosphor-icons/react';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Cell } from 'recharts';
import { useDaycareStore } from '../../daycare/store';
import { useDashboardStore } from '../store';

interface DayData {
  day: string;
  date: string;
  count: number;
  isToday: boolean;
}

export function WeeklyActivityWidget() {
  const [weekData, setWeekData] = useState<DayData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { fetchBookings } = useDaycareStore();
  const { selectedLocationId, refreshTrigger } = useDashboardStore();

  const loadWeeklyData = async () => {
    setIsLoading(true);
    try {
      // Get current week (Monday to Sunday)
      const today = new Date();
      const dayOfWeek = today.getDay(); // 0 = Sunday, 1 = Monday, etc.
      const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek; // Get to current week's Monday
      
      const weekDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
      const data: DayData[] = [];
      
      // Create a map to count bookings by date
      const bookingsByDate = new Map<string, number>();
      
      // Calculate start and end dates for the week
      const startDate = new Date(today);
      startDate.setDate(today.getDate() + mondayOffset);
      startDate.setHours(0, 0, 0, 0);
      
      const endDate = new Date(startDate);
      endDate.setDate(startDate.getDate() + 6);
      endDate.setHours(23, 59, 59, 999);
      
      // Fetch bookings for the entire week range
      // We'll fetch without date filter and filter client-side for better performance
      await fetchBookings({
        location_id: selectedLocationId === 'ALL' ? undefined : selectedLocationId,
        booking_status: 'confirmed',
      });
      
      // Get bookings from store and count by date
      const allBookings = useDaycareStore.getState().bookings;
      
      // Initialize counts for all days to 0
      for (let i = 0; i < 7; i++) {
        const date = new Date(startDate);
        date.setDate(startDate.getDate() + i);
        const dateStr = date.toISOString().split('T')[0];
        bookingsByDate.set(dateStr, 0);
      }
      
      // Count bookings for each day in the week
      allBookings.forEach(booking => {
        const bookingDate = booking.booking_date;
        if (bookingsByDate.has(bookingDate)) {
          bookingsByDate.set(bookingDate, (bookingsByDate.get(bookingDate) || 0) + 1);
        }
      });
      
      // Build the chart data
      const todayStr = today.toISOString().split('T')[0];
      for (let i = 0; i < 7; i++) {
        const date = new Date(startDate);
        date.setDate(startDate.getDate() + i);
        const dateStr = date.toISOString().split('T')[0];
        
        data.push({
          day: weekDays[i],
          date: dateStr,
          count: bookingsByDate.get(dateStr) || 0,
          isToday: dateStr === todayStr,
        });
      }

      setWeekData(data);
    } catch (err) {
      console.error('Failed to load weekly data:', err);
      // Show empty data on error
      const weekDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
      setWeekData(weekDays.map((day, i) => ({
        day,
        date: '',
        count: 0,
        isToday: false,
      })));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadWeeklyData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedLocationId, refreshTrigger]);

  const maxCount = Math.max(...weekData.map(d => d.count), 8); // Minimum scale of 8
  const yAxisMax = Math.ceil(maxCount / 8) * 8; // Round up to nearest 8

  return (
    <WidgetCard title="Weekly Pulse" icon={TrendUp}>
      <div className="flex flex-col h-full">
        {isLoading ? (
          <div className="flex items-center justify-center h-[200px]">
            <div className="text-center">
              <div className="animate-spin h-8 w-8 border-4 border-slate-200 border-t-slate-600 rounded-full mx-auto mb-2"></div>
              <p className="text-xs text-slate-500">Loading activity...</p>
            </div>
          </div>
        ) : (
          <>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={weekData}>
                <XAxis 
                  dataKey="day" 
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#64748b', fontSize: 12 }}
                />
                <YAxis 
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#64748b', fontSize: 12 }}
                  domain={[0, yAxisMax]}
                  allowDecimals={false}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'white', 
                    border: '1px solid #e2e8f0',
                    borderRadius: '6px',
                    fontSize: '12px'
                  }}
                  labelStyle={{ color: '#1e293b', fontWeight: 600 }}
                  formatter={(value: number, name: string, props: any) => {
                    const dayData = props.payload as DayData;
                    return [
                      `${value} booking${value !== 1 ? 's' : ''}`,
                      dayData.isToday ? 'Today' : dayData.day
                    ];
                  }}
                />
                <Bar 
                  dataKey="count" 
                  radius={[4, 4, 0, 0]}
                >
                  {weekData.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`}
                      fill={entry.isToday ? '#C08080' : '#E8D4D4'}
                      opacity={entry.isToday ? 1 : 0.6}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            
            {/* Summary */}
            <div className="mt-3 pt-3 border-t flex items-center justify-between text-xs">
              <span className="text-slate-500">Week Total</span>
              <span className="font-semibold text-slate-700">
                {weekData.reduce((sum, day) => sum + day.count, 0)} bookings
              </span>
            </div>
          </>
        )}
      </div>
    </WidgetCard>
  );
}