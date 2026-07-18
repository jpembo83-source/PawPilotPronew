import React from 'react';
import { CalendarBlank as CalendarIcon } from '@phosphor-icons/react';
import { useDashboardStore, DateRange } from '../store';
import { useAuth } from '../../../context/AuthContext';
import { useSettingsStore } from '../../settings/store';
import { Button } from '../../../components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../../../components/ui/dropdown-menu';
import {
  HEADER_IMAGE_SCRIM,
  HEADER_IMAGE_TEXT_SHADOW,
  headerImageOpacity,
  headerObjectPosition,
} from '../headerImageStyle';

/**
 * Previously rendered a Customise button + customise-mode header swap
 * that toggled an `isCustomizing` flag. The dashboard body (Dashboard.tsx)
 * was rebuilt around hardcoded tiles and never consumed the flag — the
 * button only swapped its own heading + button labels and otherwise did
 * nothing. The old widget-based design (WidgetGrid + widgets/) has since
 * been deleted; the widget-layout slice of dashboardStore and constants.ts
 * remain only because the routed DashboardSettings page still reads them.
 *
 * If a real customise surface comes back later it needs a parallel rebuild
 * of the body (per-tile IDs, draggable wrapper, hide-from-store
 * integration). Until then the header is just date-range + greeting.
 */

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

export function DashboardHeader() {
  const { dateRange, setDateRange, selectedLocationId } = useDashboardStore();
  const { user } = useAuth();
  const { locations } = useSettingsStore();

  const selectedLocation = locations.find((l) => l.id === selectedLocationId);
  const locationLabel =
    selectedLocationId === 'ALL' || !selectedLocationId
      ? 'All Locations'
      : selectedLocation?.name || 'Unknown';

  const getRangeLabel = (range: DateRange) => {
    switch (range) {
      case 'today':
        return 'Today';
      case 'yesterday':
        return 'Yesterday';
      case '7d':
        return 'Last 7 Days';
      case '30d':
        return 'Last 30 Days';
      case 'custom':
        return 'Custom Range';
      default:
        return 'Today';
    }
  };

  // AuthContext resolves the display name (metadata → email fallback);
  // user_metadata is often empty here, which left the greeting nameless.
  const firstName = user?.name?.split(' ')[0] || '';

  // Per-location header image — only for a specific location that has one.
  // 'ALL' and image-less locations keep the plain header, byte for byte.
  const headerImage =
    selectedLocationId !== 'ALL' && selectedLocation?.headerImageUrl
      ? {
          url: selectedLocation.headerImageUrl,
          opacity: headerImageOpacity(selectedLocation.headerImageStrength),
          objectPosition: headerObjectPosition(selectedLocation.headerImageFocalPoint),
        }
      : null;
  const textShadow = headerImage ? { textShadow: HEADER_IMAGE_TEXT_SHADOW } : undefined;
  const frosted = headerImage ? 'bg-white/70 backdrop-blur-md' : '';

  return (
    <div className="relative overflow-hidden bg-white border-b border-[#E2DED8] px-6 md:px-8 py-5">
      {headerImage && (
        <>
          <img
            src={headerImage.url}
            alt=""
            aria-hidden="true"
            className="absolute inset-0 h-full w-full object-cover"
            style={{ opacity: headerImage.opacity, objectPosition: headerImage.objectPosition }}
          />
          {/* Always-on readability scrim — legibility never depends on the
              photo (contrast math in headerImageStyle.ts). */}
          <div className="absolute inset-0" style={{ background: HEADER_IMAGE_SCRIM }} aria-hidden="true" />
        </>
      )}
      <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-4">

        {/* Left: greeting + meta */}
        <div className="space-y-0.5">

          {/* Date + location breadcrumb */}
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className="text-xs font-medium text-tertiary-foreground uppercase tracking-wide"
              style={textShadow}
            >
              {getFormattedDate()}
            </span>
            <span className="text-[#E2DED8] text-xs">·</span>
            <span
              className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full ${
                headerImage ? `${frosted} text-primary border border-white/60` : 'bg-primary-tint text-primary'
              }`}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
              {locationLabel}
            </span>
          </div>

          <h1 className="text-2xl font-bold text-[#1C1916]" style={textShadow}>
            {getGreeting()}{firstName ? `, ${firstName} 👋` : ' 👋'}
          </h1>

          <p className="text-sm text-[#6B6762]" style={textShadow}>
            Here's what's happening today.
          </p>
        </div>

        {/* Right: date range only */}
        <div className="flex items-center gap-2 shrink-0">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                className={`h-9 gap-2 text-sm font-medium border-[#E2DED8] text-[#44403C] hover:bg-[#F4F3EF] ${frosted}`}
              >
                <CalendarIcon className="h-4 w-4 text-primary" />
                {getRangeLabel(dateRange)}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setDateRange('today')}>Today</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setDateRange('yesterday')}>Yesterday</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setDateRange('7d')}>Last 7 Days</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setDateRange('30d')}>Last 30 Days</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  );
}
