import React, { useState } from 'react';
import { 
  SignIn, 
  CalendarBlank, 
  Truck, 
  SignOut, 
  Clock
} from '@phosphor-icons/react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../../components/ui/card';
import { Button } from '../../../../components/ui/button';
import { Badge } from '../../../../components/ui/badge';
import { Tooltip, TooltipTrigger, TooltipContent } from '../../../../components/ui/tooltip';
import { useAuth } from '../../../../context/AuthContext';
import { useDashboardStore } from '../../store';
import { useSettingsStore } from '../../../settings/store';
import { QuickCheckInModal } from '../modals/QuickCheckInModal';
import { QuickBookModal } from '../modals/QuickBookModal';
import { QuickTransportModal } from '../modals/QuickTransportModal';
import { QuickCheckOutModal } from '../modals/QuickCheckOutModal';
import { toast } from 'sonner';

interface QuickAction {
  id: string;
  label: string;
  icon: any;
  color: string;
  category: 'operations' | 'communications' | 'safety';
  requiredModule?: string;
  requiredPermission: { module: string; action: string };
  requiresSingleLocation?: boolean;
}

// Only include quick actions that are fully functional
const QUICK_ACTIONS: QuickAction[] = [
  {
    id: 'check-in',
    label: 'Check-in',
    icon: SignIn,
    color: 'text-green-600 bg-green-50 hover:bg-green-100',
    category: 'operations',
    requiredModule: 'daycare',
    requiredPermission: { module: 'daycare', action: 'update' },
    requiresSingleLocation: true,
  },
  {
    id: 'book',
    label: 'Book',
    icon: CalendarBlank,
    color: 'text-blue-600 bg-blue-50 hover:bg-blue-100',
    category: 'operations',
    requiredPermission: { module: 'bookings', action: 'create' },
    requiresSingleLocation: true,
  },
  {
    id: 'transport',
    label: 'Transport',
    icon: Truck,
    color: 'text-purple-600 bg-purple-50 hover:bg-purple-100',
    category: 'operations',
    requiredModule: 'transport',
    requiredPermission: { module: 'transport', action: 'create' },
    requiresSingleLocation: true,
  },
  {
    id: 'check-out',
    label: 'Check-out',
    icon: SignOut,
    color: 'text-orange-600 bg-orange-50 hover:bg-orange-100',
    category: 'operations',
    requiredPermission: { module: 'daycare', action: 'update' },
    requiresSingleLocation: true,
  },
  // NOTE: The following quick actions are disabled until their backends are implemented:
  // - message (messaging module not implemented)
  // - incident (incidents module not implemented)
  // - document (document upload not implemented)
  // - overnight-checkin (modal is placeholder)
  // - boutique (boutique module not implemented)
];

export function QuickLinksWidget() {
  const { user, hasPermission } = useAuth();
  const { selectedLocationId } = useDashboardStore();
  const { locations, globalEnabledModules } = useSettingsStore();

  const [activeModal, setActiveModal] = useState<string | null>(null);

  // Get the selected location
  const selectedLocation = locations.find(loc => loc.id === selectedLocationId);
  const isSingleLocationSelected = selectedLocationId && selectedLocationId !== 'ALL';

  // Check if an action is available
  const isActionAvailable = (action: QuickAction): boolean => {
    // Check permission
    if (!hasPermission(action.requiredPermission.module, action.requiredPermission.action)) {
      return false;
    }

    // Check module enablement (global level)
    if (action.requiredModule && !globalEnabledModules.includes(action.requiredModule)) {
      return false;
    }

    // Check module enablement (location level) if single location selected
    if (action.requiredModule && isSingleLocationSelected && selectedLocation) {
      if (!selectedLocation.enabledModules.includes(action.requiredModule)) {
        return false;
      }
    }

    // Check if action requires single location
    if (action.requiresSingleLocation && !isSingleLocationSelected) {
      return false;
    }

    return true;
  };

  // Get disabled reason
  const getDisabledReason = (action: QuickAction): string | null => {
    if (!hasPermission(action.requiredPermission.module, action.requiredPermission.action)) {
      return 'No permission';
    }

    if (action.requiredModule && !globalEnabledModules.includes(action.requiredModule)) {
      return 'Module disabled';
    }

    if (action.requiredModule && isSingleLocationSelected && selectedLocation) {
      if (!selectedLocation.enabledModules.includes(action.requiredModule)) {
        return 'Not enabled at this location';
      }
    }

    if (action.requiresSingleLocation && !isSingleLocationSelected) {
      return 'Select a location';
    }

    return null;
  };

  const handleActionClick = (actionId: string) => {
    const action = QUICK_ACTIONS.find(a => a.id === actionId);
    if (!action) return;

    const disabledReason = getDisabledReason(action);
    if (disabledReason) {
      toast.error(disabledReason);
      return;
    }

    setActiveModal(actionId);
  };

  const renderActionButton = (action: QuickAction) => {
    const available = isActionAvailable(action);
    const disabledReason = getDisabledReason(action);
    const Icon = action.icon;

    const tooltipContent = available 
      ? action.label 
      : `${action.label} - ${disabledReason}`;

    return (
      <Tooltip key={action.id}>
        <TooltipTrigger asChild>
          <Button
            onClick={() => handleActionClick(action.id)}
            disabled={!available}
            variant="ghost"
            size="sm"
            className={`
              h-9 px-3 flex items-center gap-2 justify-start
              transition-all
              ${available ? action.color : 'bg-slate-50 text-slate-400 cursor-not-allowed opacity-50'}
            `}
          >
            <Icon className="h-4 w-4 flex-shrink-0" />
            <span className="text-xs font-medium truncate">{action.label}</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-[200px]">
          {tooltipContent}
        </TooltipContent>
      </Tooltip>
    );
  };

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="h-4 w-4 text-slate-600" />
              Quick Links
            </CardTitle>
            {!isSingleLocationSelected && (
              <Badge variant="outline" className="text-xs">
                Select location
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Quick Actions Grid */}
          <div className="grid grid-cols-2 gap-1.5">
            {QUICK_ACTIONS.map(renderActionButton)}
          </div>
        </CardContent>
      </Card>

      {/* Modals - only functional ones */}
      <QuickCheckInModal 
        key="check-in-modal"
        open={activeModal === 'check-in'} 
        onClose={() => setActiveModal(null)} 
      />
      <QuickBookModal 
        key="book-modal"
        open={activeModal === 'book'} 
        onClose={() => setActiveModal(null)} 
      />
      <QuickTransportModal 
        key="transport-modal"
        open={activeModal === 'transport'} 
        onClose={() => setActiveModal(null)} 
      />
      <QuickCheckOutModal 
        key="check-out-modal"
        open={activeModal === 'check-out'} 
        onClose={() => setActiveModal(null)} 
      />
    </>
  );
}