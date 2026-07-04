import React from 'react';
import { WifiSlash } from '@phosphor-icons/react';
import { useConnectivity } from '../../hooks/useConnectivity';

/**
 * Persistent offline banner. Rendered in both layout shells (Layout and
 * MobileLayout) as a flex row above the main content, so it pushes the page
 * down rather than covering anything, and it cannot be dismissed while
 * offline. Deliberately not a toast: it must stay visible for as long as
 * saving is impossible.
 */
export function OfflineBanner() {
  const isOnline = useConnectivity();
  if (isOnline) return null;

  return (
    <div
      role="alert"
      className="shrink-0 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-white"
      style={{ background: '#B91C1C' }}
    >
      <WifiSlash size={16} weight="bold" className="shrink-0" />
      You're offline — changes can't be saved right now.
    </div>
  );
}
