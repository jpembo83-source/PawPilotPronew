// Loads the signed-in user's account (profile/avatar/prefs) once per login
// and applies the DEFAULT LOCATION preference to the dashboard store — once
// per browser session, so the location switcher still wins for the rest of
// the session. Theme application lives in ThemeManager (which reads the
// same prefs); this component renders nothing.

import { useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useAccountStore } from '../../stores/accountStore';
import { useSettingsStore } from '../../modules/settings/store';
import { useDashboardStore } from '../../modules/dashboard/store';

const DEFAULT_LOCATION_APPLIED_KEY = 'mdc-default-location-applied';

export function AccountBootstrap() {
  const { user } = useAuth();
  const fetchAccount = useAccountStore((s) => s.fetchAccount);
  const reset = useAccountStore((s) => s.reset);
  const hasLoaded = useAccountStore((s) => s.hasLoaded);
  const defaultLocationId = useAccountStore((s) => s.prefs.defaultLocationId);
  const { locations } = useSettingsStore();
  const setLocation = useDashboardStore((s) => s.setLocation);

  // Fetch on login, clear on logout. Best-effort: a failed fetch leaves the
  // cached prefs in place and the app fully usable.
  useEffect(() => {
    if (user?.id) {
      void fetchAccount().catch(() => {});
    } else {
      reset();
      // Next login (possibly a different user) gets their default applied.
      sessionStorage.removeItem(DEFAULT_LOCATION_APPLIED_KEY);
    }
  }, [user?.id, fetchAccount, reset]);

  // Apply the default location once per browser session, after both the
  // prefs and the tenant's locations have loaded (so a stale pref pointing
  // at a deleted location is ignored rather than selecting "Unknown").
  useEffect(() => {
    if (!user?.id || !hasLoaded || !defaultLocationId) return;
    if (sessionStorage.getItem(DEFAULT_LOCATION_APPLIED_KEY)) return;

    if (defaultLocationId === 'ALL') {
      sessionStorage.setItem(DEFAULT_LOCATION_APPLIED_KEY, '1');
      if (user.role === 'admin') setLocation('ALL');
      return;
    }
    if (locations.length === 0) return; // wait for locations to load
    sessionStorage.setItem(DEFAULT_LOCATION_APPLIED_KEY, '1');
    if (locations.some((l) => l && l.id === defaultLocationId)) {
      setLocation(defaultLocationId);
    }
  }, [user?.id, user?.role, hasLoaded, defaultLocationId, locations, setLocation]);

  return null;
}
