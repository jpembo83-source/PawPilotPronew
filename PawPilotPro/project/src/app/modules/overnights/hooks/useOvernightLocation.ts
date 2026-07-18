import { useDashboardStore } from '../../dashboard/store';
import { useSettingsStore } from '../../settings/store';
import type { Location } from '../../settings/store';

export interface OvernightLocationState {
  /** The location overnight operations act on, or null when none is resolvable. */
  location: Location | null;
  /** True when "All locations" is selected but the tenant has several — the
   *  user must pick one before operating (check-in, care logs, capacity…). */
  needsSelection: boolean;
}

/**
 * Overnight operational pages act on exactly ONE site. With a specific
 * location selected, use it; with "All locations", a single-location tenant
 * unambiguously means that site, while a multi-location tenant must pick one
 * explicitly — silently falling back to the first location risks staff
 * checking dogs in or editing capacity for the wrong site.
 */
export function useOvernightLocation(): OvernightLocationState {
  const { selectedLocationId } = useDashboardStore();
  const locations = useSettingsStore((s) => s.locations);

  if (selectedLocationId !== 'ALL') {
    return { location: locations.find((l) => l.id === selectedLocationId) ?? null, needsSelection: false };
  }
  if (locations.length === 1) {
    return { location: locations[0], needsSelection: false };
  }
  return { location: null, needsSelection: locations.length > 1 };
}
