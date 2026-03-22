import React from 'react';
import { WidgetCard } from './WidgetCard';

interface PlaceholderWidgetProps {
  title: string;
  icon: any;
  description: string;
}

export function PlaceholderWidget({ title, icon, description }: PlaceholderWidgetProps) {
  return (
    <WidgetCard 
      title={title} 
      icon={icon} 
      description={description}
      className="h-full min-h-[150px]"
    >
      <div className="flex flex-col items-center justify-center h-full text-center p-4">
        <div className="h-10 w-10 bg-slate-50 rounded-full flex items-center justify-center text-slate-300 mb-2">
           {React.createElement(icon, { className: "h-5 w-5" })}
        </div>
        <p className="text-sm text-slate-400">No data available for this period.</p>
        <div className="w-1/2 h-2 bg-slate-100 rounded mt-2 animate-pulse" />
      </div>
    </WidgetCard>
  );
}
