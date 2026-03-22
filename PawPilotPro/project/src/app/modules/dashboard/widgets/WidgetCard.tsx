import React from 'react';
import { GripVertical } from 'lucide-react';
import { cn } from '../../../components/ui/utils';

interface WidgetCardProps {
  title: string;
  icon?: any;
  description?: string;
  children: React.ReactNode;
  className?: string;
  isDraggable?: boolean;
  dragHandleProps?: any;
  actions?: React.ReactNode;
}

export function WidgetCard({ 
  title, 
  icon: Icon, 
  description, 
  children, 
  className,
  isDraggable,
  dragHandleProps,
  actions
}: WidgetCardProps) {
  return (
    <div className={cn(
      "group/card bg-card rounded-2xl border border-border/50 shadow-sm hover:shadow-md transition-all duration-300 flex flex-col h-full overflow-hidden",
      className
    )}>
      <div className="px-4 pt-4 pb-2.5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 overflow-hidden">
          {isDraggable && (
            <div 
              {...dragHandleProps} 
              className="cursor-grab hover:text-foreground text-muted-foreground/40 -ml-1"
            >
              <GripVertical className="h-4 w-4" />
            </div>
          )}
          {Icon && (
            <div className="p-2 bg-primary/10 rounded-xl text-primary ring-1 ring-primary/10">
              <Icon className="h-4 w-4" />
            </div>
          )}
          <div className="overflow-hidden">
            <h3 className="font-semibold text-foreground truncate text-sm">{title}</h3>
            {description && (
              <p className="text-xs text-muted-foreground truncate">{description}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover/card:opacity-100 transition-opacity">
          {actions}
        </div>
      </div>
      <div className="px-4 pb-4 flex-1 min-h-0 overflow-auto">
        {children}
      </div>
    </div>
  );
}
