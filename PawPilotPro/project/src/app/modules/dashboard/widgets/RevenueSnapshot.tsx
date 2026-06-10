import React from 'react';
import { WidgetCard } from './WidgetCard';
import { useDashboardStore } from '../store';
import { CreditCard, TrendUp, TrendDown, CurrencyDollar } from '@phosphor-icons/react';
import { Area, AreaChart, CartesianGrid, XAxis, Tooltip, ResponsiveContainer } from 'recharts';

// TODO: Replace with actual revenue data from backend
// This should be fetched from: GET /api/analytics/revenue?locationId=X&dateRange=7d
const generatePlaceholderData = (days: number) => {
  return Array.from({ length: days }).map((_, i) => ({
    name: `Day ${i + 1}`,
    daycare: 0,
    grooming: 0,
    retail: 0,
  }));
};

export function RevenueSnapshot() {
  const { dateRange, selectedLocationId } = useDashboardStore();
  
  const days = dateRange === '30d' ? 30 : dateRange === '7d' ? 7 : 1;
  // TODO: Fetch actual revenue data instead of using placeholder
  const data = generatePlaceholderData(days);
  
  const total = data.reduce((acc, curr) => acc + curr.daycare + curr.grooming + curr.retail, 0);
  const totalFormatted = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(total);
  
  // TODO: Calculate actual trend from real data
  const isUp = false;

  return (
    <WidgetCard 
      title="Revenue Snapshot" 
      icon={CreditCard}
      description={selectedLocationId === 'ALL' ? 'Aggregated across all locations' : 'Location specific performance'}
      className="min-h-[400px]"
    >
      <div className="flex flex-col h-full">
         <div className="flex items-end gap-3 mb-6">
            <h2 className="text-3xl font-bold text-slate-900">{totalFormatted}</h2>
            <div className={`flex items-center gap-1 text-sm font-medium mb-1.5 text-slate-400`}>
               <TrendUp className="h-4 w-4" />
               <span>No data</span>
            </div>
         </div>

         <div className="-ml-4 w-full" style={{ height: '200px' }}>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorDaycare" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8884d8" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#8884d8" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorGrooming" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#82ca9d" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#82ca9d" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="name" hide />
                <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#f1f5f9" />
                <Tooltip 
                  contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  itemStyle={{ fontSize: '12px' }}
                />
                <Area type="monotone" dataKey="daycare" stackId="1" stroke="#8884d8" fill="url(#colorDaycare)" name="Daycare" />
                <Area type="monotone" dataKey="grooming" stackId="1" stroke="#82ca9d" fill="url(#colorGrooming)" name="Grooming" />
                <Area type="monotone" dataKey="retail" stackId="1" stroke="#ffc658" fill="#ffc658" name="Retail" />
              </AreaChart>
            </ResponsiveContainer>
         </div>

         <div className="grid grid-cols-3 gap-2 mt-4 text-center text-xs text-slate-500">
             <div>
               <div className="font-semibold text-slate-900">65%</div>
               Daycare
             </div>
             <div>
               <div className="font-semibold text-slate-900">25%</div>
               Grooming
             </div>
             <div>
               <div className="font-semibold text-slate-900">10%</div>
               Retail
             </div>
         </div>
      </div>
    </WidgetCard>
  );
}