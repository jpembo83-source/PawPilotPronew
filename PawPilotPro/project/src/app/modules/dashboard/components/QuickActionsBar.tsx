import React, { useState, useMemo } from 'react';
import { 
  SignIn, 
  CalendarBlank, 
  Truck, 
  SignOut,
  UserPlus,
  MagnifyingGlass,
  Scissors,
  Moon,
  ArrowClockwise,
  Note,
  Camera,
  CaretRight
} from '@phosphor-icons/react';
import { Button } from '../../../components/ui/button';
import { Tooltip, TooltipTrigger, TooltipContent } from '../../../components/ui/tooltip';
import { useAuth } from '../../../context/AuthContext';
import { useBetaFeatures } from '../../../hooks/useBetaFeatures';
import { useDashboardStore } from '../store';
import { useSettingsStore } from '../../settings/store';
import { QuickCheckInModal } from './modals/QuickCheckInModal';
import { QuickBookModal } from './modals/QuickBookModal';
import { QuickTransportModal } from './modals/QuickTransportModal';
import { QuickCheckOutModal } from './modals/QuickCheckOutModal';
import { QuickNoteModal } from './modals/QuickNoteModal';
import { PhotoUploadModal } from './modals/PhotoUploadModal';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { cn } from '../../../components/ui/utils';

function adjustColor(hex: string, percent: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const amt = Math.round(2.55 * percent);
  const R = Math.max(0, Math.min(255, (num >> 16) + amt));
  const G = Math.max(0, Math.min(255, ((num >> 8) & 0x00FF) + amt));
  const B = Math.max(0, Math.min(255, (num & 0x0000FF) + amt));
  return `#${(0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1)}`;
}

function isLightColor(hex: string): boolean {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5;
}

interface QuickAction {
  id: string;
  label: string;
  icon: any;
  variant: 'primary' | 'secondary' | 'subtle';
  action: 'modal' | 'navigate' | 'refresh';
  target?: string;
  requiredModule?: string;
  requiredPermission?: { module: string; action: string };
  isBeta?: boolean;
  requiresSingleLocation?: boolean;
}

const QUICK_ACTIONS: QuickAction[] = [
  {
    id: 'check-in',
    label: 'Check-in',
    icon: SignIn,
    variant: 'primary',
    action: 'modal',
    requiredModule: 'daycare',
    requiredPermission: { module: 'daycare', action: 'update' },
    requiresSingleLocation: true,
  },
  {
    id: 'check-out',
    label: 'Check-out',
    icon: SignOut,
    variant: 'primary',
    action: 'modal',
    requiredPermission: { module: 'daycare', action: 'update' },
    requiresSingleLocation: true,
  },
  {
    id: 'book',
    label: 'New Booking',
    icon: CalendarBlank,
    variant: 'primary',
    action: 'modal',
    requiredPermission: { module: 'bookings', action: 'create' },
    requiresSingleLocation: true,
  },
  {
    id: 'transport',
    label: 'Transport',
    icon: Truck,
    variant: 'primary',
    action: 'modal',
    requiredModule: 'transport',
    requiredPermission: { module: 'transport', action: 'create' },
    requiresSingleLocation: true,
  },
  {
    id: 'quick-note',
    label: 'Quick Note',
    icon: Note,
    variant: 'secondary',
    action: 'modal',
    requiredPermission: { module: 'daycare', action: 'update' },
    requiresSingleLocation: true,
  },
  {
    id: 'photo',
    label: 'Photo',
    icon: Camera,
    variant: 'secondary',
    action: 'modal',
    requiredPermission: { module: 'daycare', action: 'update' },
    requiresSingleLocation: true,
  },
  {
    id: 'new-customer',
    label: 'New Customer',
    icon: UserPlus,
    variant: 'secondary',
    action: 'navigate',
    target: '/customers/new',
    requiredPermission: { module: 'customers', action: 'create' },
  },
  {
    id: 'search',
    label: 'Search',
    icon: MagnifyingGlass,
    variant: 'subtle',
    action: 'navigate',
    target: '/customers',
  },
  {
    id: 'grooming',
    label: 'Grooming',
    icon: Scissors,
    variant: 'secondary',
    action: 'navigate',
    target: '/grooming',
    requiredModule: 'grooming',
    isBeta: true,
  },
  {
    id: 'overnights',
    label: 'Overnights',
    icon: Moon,
    variant: 'secondary',
    action: 'navigate',
    target: '/overnights',
    requiredModule: 'overnights',
  },
  {
    id: 'refresh',
    label: 'Refresh',
    icon: ArrowClockwise,
    variant: 'subtle',
    action: 'refresh',
  },
];

export function QuickActionsBar() {
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const { hasBetaAccess } = useBetaFeatures();
  const { selectedLocationId, refreshAllWidgets } = useDashboardStore();
  const { locations, globalEnabledModules, organisation } = useSettingsStore();
  
  const [activeModal, setActiveModal] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const selectedLocation = locations.find(loc => loc.id === selectedLocationId);
  const isSingleLocationSelected = selectedLocationId && selectedLocationId !== 'ALL';

  const primaryColor = organisation.primaryColor || '#BA7E74';
  const secondaryColor = organisation.secondaryColor || '#F4E5E3';
  const primaryHover = adjustColor(primaryColor, -15);
  const secondaryHover = adjustColor(secondaryColor, -10);
  const primaryTextColor = isLightColor(primaryColor) ? '#1e293b' : '#ffffff';
  const secondaryTextColor = isLightColor(secondaryColor) ? '#1e293b' : '#ffffff';

  const getButtonStyle = (variant: 'primary' | 'secondary' | 'subtle', available: boolean) => {
    if (!available) {
      return { backgroundColor: 'var(--muted)', color: 'var(--muted-foreground)', opacity: 0.5 };
    }
    
    switch (variant) {
      case 'primary':
        return { 
          backgroundColor: primaryColor, 
          color: primaryTextColor,
          '--hover-bg': primaryHover 
        } as React.CSSProperties;
      case 'secondary':
        return { 
          backgroundColor: secondaryColor, 
          color: secondaryTextColor,
          '--hover-bg': secondaryHover 
        } as React.CSSProperties;
      case 'subtle':
      default:
        return { 
          backgroundColor: 'var(--muted)', 
          color: 'var(--foreground)' 
        };
    }
  };

  const isActionAvailable = (action: QuickAction): boolean => {
    if (action.requiredPermission && !hasPermission(action.requiredPermission.module, action.requiredPermission.action)) {
      return false;
    }
    if (action.requiredModule && !globalEnabledModules.includes(action.requiredModule)) {
      return false;
    }
    if (action.requiredModule && isSingleLocationSelected && selectedLocation) {
      if (!selectedLocation.enabledModules?.includes(action.requiredModule)) {
        return false;
      }
    }
    if (action.requiresSingleLocation && !isSingleLocationSelected) {
      return false;
    }
    return true;
  };

  const getDisabledReason = (action: QuickAction): string | null => {
    if (action.requiredPermission && !hasPermission(action.requiredPermission.module, action.requiredPermission.action)) {
      return 'No permission';
    }
    if (action.requiredModule && !globalEnabledModules.includes(action.requiredModule)) {
      return 'Module disabled';
    }
    if (action.requiredModule && isSingleLocationSelected && selectedLocation) {
      if (!selectedLocation.enabledModules?.includes(action.requiredModule)) {
        return 'Not enabled at this location';
      }
    }
    if (action.requiresSingleLocation && !isSingleLocationSelected) {
      return 'Select a location first';
    }
    return null;
  };

  const handleAction = async (action: QuickAction) => {
    const disabledReason = getDisabledReason(action);
    if (disabledReason) {
      toast.error(disabledReason);
      return;
    }

    switch (action.action) {
      case 'modal':
        setActiveModal(action.id);
        break;
      case 'navigate':
        if (action.target) navigate(action.target);
        break;
      case 'refresh':
        setIsRefreshing(true);
        refreshAllWidgets();
        toast.success('Dashboard refreshed');
        setTimeout(() => setIsRefreshing(false), 1000);
        break;
    }
  };

  const allActions = useMemo(() => {
    if (hasBetaAccess) return QUICK_ACTIONS;
    return QUICK_ACTIONS.filter(action => !action.isBeta);
  }, [hasBetaAccess]);

  const primaryActions = allActions.filter(a => a.variant === 'primary');
  const secondaryActions = allActions.filter(a => a.variant === 'secondary' || a.variant === 'subtle');

  return (
    <>
      <div className="bg-card rounded-2xl shadow-sm border border-border/50 p-4 mb-6 overflow-hidden">
        <div className="flex items-center gap-3 overflow-x-auto scrollbar-hide pb-0.5">
          {primaryActions.map((action) => {
            const available = isActionAvailable(action);
            const reason = getDisabledReason(action);
            const Icon = action.icon;
            const buttonStyle = getButtonStyle(action.variant, available);
            
            return (
              <Tooltip key={action.id}>
                <TooltipTrigger asChild>
                  <Button
                    onClick={() => handleAction(action)}
                    disabled={!available}
                    size="sm"
                    style={buttonStyle}
                    className={cn(
                      "transition-all flex-shrink-0 rounded-xl shadow-sm hover:shadow-md hover:scale-[1.02] active:scale-[0.98]",
                      !available && 'cursor-not-allowed !opacity-50 hover:!scale-100 hover:!shadow-sm'
                    )}
                  >
                    <Icon className="h-4 w-4 mr-1.5" />
                    <span className="whitespace-nowrap">{action.label}</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {available ? action.label : `${action.label} — ${reason}`}
                </TooltipContent>
              </Tooltip>
            );
          })}

          <div className="w-px h-6 bg-border/60 flex-shrink-0 mx-1" />

          {secondaryActions.map((action) => {
            const available = isActionAvailable(action);
            const reason = getDisabledReason(action);
            const Icon = action.icon;
            const isRefreshAction = action.id === 'refresh';
            const buttonStyle = getButtonStyle(action.variant, available);
            
            return (
              <Tooltip key={action.id}>
                <TooltipTrigger asChild>
                  <Button
                    onClick={() => handleAction(action)}
                    disabled={!available}
                    size="sm"
                    style={buttonStyle}
                    className={cn(
                      "transition-all flex-shrink-0 rounded-xl hover:scale-[1.02] active:scale-[0.98]",
                      !available && 'cursor-not-allowed !opacity-50 hover:!scale-100'
                    )}
                  >
                    <Icon className={cn("h-4 w-4", !isRefreshAction && 'mr-1.5', isRefreshAction && isRefreshing && 'animate-spin')} />
                    {!isRefreshAction && <span className="whitespace-nowrap">{action.label}</span>}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {available ? action.label : `${action.label} — ${reason}`}
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>

        {!isSingleLocationSelected && (
          <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border/30">
            <span className="w-1.5 h-1.5 bg-amber-400 rounded-full animate-pulse" />
            <p className="text-xs text-muted-foreground">
              Select a location to enable check-in/out and booking actions
            </p>
          </div>
        )}
      </div>

      <QuickCheckInModal 
        open={activeModal === 'check-in'} 
        onClose={() => setActiveModal(null)} 
      />
      <QuickBookModal 
        open={activeModal === 'book'} 
        onClose={() => setActiveModal(null)} 
      />
      <QuickTransportModal 
        open={activeModal === 'transport'} 
        onClose={() => setActiveModal(null)} 
      />
      <QuickCheckOutModal 
        open={activeModal === 'check-out'} 
        onClose={() => setActiveModal(null)} 
      />
      <QuickNoteModal 
        open={activeModal === 'quick-note'} 
        onClose={() => setActiveModal(null)} 
      />
      <PhotoUploadModal 
        open={activeModal === 'photo'} 
        onClose={() => setActiveModal(null)} 
      />
    </>
  );
}
