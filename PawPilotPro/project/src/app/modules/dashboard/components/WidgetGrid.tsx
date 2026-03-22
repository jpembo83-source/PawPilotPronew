import React, { useMemo } from 'react';
import { useDashboardStore } from '../store';
import { WIDGETS } from '../constants';
import { LiveOccupancy } from '../widgets/LiveOccupancy';
import { DriverStatus } from '../widgets/DriverStatus';
import { PlaceholderWidget } from '../widgets/PlaceholderWidget';
import { TodaysDaycareDogs } from '../widgets/TodaysDaycareDogs';
import { TodaysDogsWidget } from '../widgets/TodaysDogsWidget';
import { WeeklyActivityWidget } from '../widgets/WeeklyActivityWidget';
import { AlertsFlagsWidget } from '../widgets/AlertsFlagsWidget';
import { GroomingTodayWidget } from '../widgets/GroomingTodayWidget';
import { OvernightsTodayWidget } from '../widgets/OvernightsTodayWidget';
import { VaccinationExpiryWidget } from '../widgets/VaccinationExpiryWidget';
import { CapacityWidget } from '../widgets/CapacityWidget';
import { ReportingWidget } from '../widgets/ReportingWidget';
import { useAuth } from '../../../context/AuthContext';
import { useBetaFeatures } from '../../../hooks/useBetaFeatures';
import { WidgetCard } from '../widgets/WidgetCard';
import { GripVertical, EyeOff, Eye } from 'lucide-react';
import { useDrag, useDrop } from 'react-dnd';
import { cn } from '../../../components/ui/utils';

const COMPONENT_MAP: Record<string, React.ElementType> = {
  todays_dogs: TodaysDogsWidget,
  weekly_activity: WeeklyActivityWidget,
  todays_daycare_dogs: TodaysDaycareDogs,
  occupancy: LiveOccupancy,
  driver_status: DriverStatus,
  documents: AlertsFlagsWidget,
  grooming_today: GroomingTodayWidget,
  overnights_today: OvernightsTodayWidget,
  vaccination_alerts: VaccinationExpiryWidget,
  capacity: CapacityWidget,
  reporting: ReportingWidget,
};

interface WidgetWrapperProps {
  id: string;
  index: number;
  isCustomizing: boolean;
  moveWidget: (dragIndex: number, hoverIndex: number) => void;
  toggleVisibility: (id: string) => void;
}

const DraggableWidget = ({ id, index, isCustomizing, moveWidget, toggleVisibility }: WidgetWrapperProps) => {
  const definition = WIDGETS.find(w => w.id === id);
  if (!definition) return null;

  const Component = COMPONENT_MAP[id] || (() => (
    <PlaceholderWidget 
      title={definition.title} 
      icon={definition.icon} 
      description={definition.description} 
    />
  ));

  const ref = React.useRef<HTMLDivElement>(null);

  const [{ isDragging }, drag] = useDrag({
    type: 'WIDGET',
    item: { id, index },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
    canDrag: isCustomizing,
  });

  const [, drop] = useDrop({
    accept: 'WIDGET',
    hover(item: { index: number }, monitor) {
      if (!ref.current) return;
      const dragIndex = item.index;
      const hoverIndex = index;
      if (dragIndex === hoverIndex) return;
      moveWidget(dragIndex, hoverIndex);
      item.index = hoverIndex;
    },
  });

  if (isCustomizing) {
    drag(drop(ref));
  }

  const colClass = definition.colSpan === 2 ? 'md:col-span-2' : 'col-span-1';
  const rowClass = definition.rowSpan === 2 ? 'md:row-span-2' : 'row-span-1';

  return (
    <div 
      ref={ref} 
      className={cn(
        colClass,
        rowClass,
        "relative transition-all duration-300 min-h-0", 
        isDragging && "opacity-40 scale-[0.98]",
        isCustomizing && "ring-2 ring-dashed ring-primary/20 rounded-2xl"
      )}
    >
      {isCustomizing && (
        <div className="absolute top-3 right-3 z-10">
          <button 
            onClick={() => toggleVisibility(id)}
            className="bg-card p-1.5 rounded-xl shadow-md border border-border/60 hover:text-destructive hover:border-destructive/30 transition-colors"
            title="Hide Widget"
          >
            <EyeOff className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
      
      <Component />
      
      {isCustomizing && (
        <div className="absolute inset-0 bg-primary/[0.03] rounded-2xl flex items-center justify-center pointer-events-none">
          <div className="bg-card px-3 py-1.5 rounded-full shadow-md border border-border/60 text-xs font-medium text-muted-foreground flex items-center gap-2">
            <GripVertical className="h-3 w-3 text-primary" />
            Drag to Reorder
          </div>
        </div>
      )}
    </div>
  );
};

export function WidgetGrid({ isCustomizing }: { isCustomizing: boolean }) {
  const { user } = useAuth();
  const { hasBetaAccess } = useBetaFeatures();
  const { 
    userLayouts, 
    userHiddenWidgets, 
    rolePermissions, 
    updateUserLayout, 
    toggleUserWidget, 
    resetUserLayout,
    mergeNewWidgets
  } = useDashboardStore();

  const userId = user?.id || 'default';
  const role = user?.role || 'staff';
  
  const availableWidgets = useMemo(() => {
    if (hasBetaAccess) return WIDGETS;
    return WIDGETS.filter(w => !w.isBeta);
  }, [hasBetaAccess]);
  
  const availableWidgetIds = useMemo(() => availableWidgets.map(w => w.id), [availableWidgets]);

  React.useEffect(() => {
    const currentLayout = userLayouts[userId];
    const allowedWidgets = rolePermissions[role] || [];
    
    if (!currentLayout) {
      resetUserLayout(userId, role);
    } else {
      const newWidgets = allowedWidgets.filter(id => !currentLayout.includes(id));
      if (newWidgets.length > 0) {
        mergeNewWidgets(userId, role);
      }
    }
  }, [userId, role]);

  const layout = userLayouts[userId] || [];
  const hidden = userHiddenWidgets[userId] || [];

  const roleAllowedIds = rolePermissions[role] || [];
  const allowedIds = roleAllowedIds.filter(id => availableWidgetIds.includes(id));
  const visibleWidgets = layout.filter(id => allowedIds.includes(id) && !hidden.includes(id));
  const hiddenWidgets = layout.filter(id => allowedIds.includes(id) && hidden.includes(id));

  const moveWidget = React.useCallback((dragIndex: number, hoverIndex: number) => {
    const newLayout = [...layout];
    const dragId = visibleWidgets[dragIndex];
    const hoverId = visibleWidgets[hoverIndex];
    const realDragIndex = newLayout.indexOf(dragId);
    const realHoverIndex = newLayout.indexOf(hoverId);
    const [removed] = newLayout.splice(realDragIndex, 1);
    newLayout.splice(realHoverIndex, 0, removed);
    updateUserLayout(userId, newLayout);
  }, [layout, visibleWidgets, userId, updateUserLayout]);

  return (
    <div className="space-y-6">
      <div
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 pb-8"
        style={{ gridAutoRows: 'minmax(220px, auto)', gridAutoFlow: 'dense' }}
      >
        {visibleWidgets.map((id, index) => (
          <DraggableWidget
            key={id}
            id={id}
            index={index}
            isCustomizing={isCustomizing}
            moveWidget={moveWidget}
            toggleVisibility={(id) => toggleUserWidget(userId, id)}
          />
        ))}
      </div>

      {isCustomizing && hiddenWidgets.length > 0 && (
        <div className="border-t border-border/40 pt-6">
          <h3 className="text-sm font-medium text-muted-foreground mb-4 uppercase tracking-wider">
            Hidden Widgets
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
            {hiddenWidgets.map((id) => {
              const def = WIDGETS.find(w => w.id === id);
              if(!def) return null;
              return (
                <div key={id} className="relative group opacity-50 hover:opacity-80 transition-opacity">
                  <WidgetCard title={def.title} icon={def.icon} className="h-40">
                    <div className="flex items-center justify-center h-full">
                      <button 
                        onClick={() => toggleUserWidget(userId, id)}
                        className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-xl shadow-md hover:shadow-lg hover:scale-105 transition-all text-sm font-medium"
                      >
                        <Eye className="h-4 w-4" />
                        Show Widget
                      </button>
                    </div>
                  </WidgetCard>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
