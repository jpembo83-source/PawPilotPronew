import { useNavigate } from 'react-router';
import { ArrowLeft } from '@phosphor-icons/react';
import { Button } from './ui/button';

interface BackButtonProps {
  /**
   * Where to go when there is no in-app history to return to (deep link,
   * fresh tab, page opened from a notification). With in-app history the
   * button behaves like the browser back button, returning to wherever the
   * user actually came from instead of a hardcoded parent route.
   */
  fallback: string;
  label?: string;
  className?: string;
}

/**
 * History-aware back navigation — the ONE back implementation for drill-in
 * pages. react-router's BrowserRouter keeps an entry index in history.state;
 * idx > 0 means going back stays inside the app, so the user returns to
 * wherever they actually came from (search, Portal Inbox, dashboard tile…)
 * instead of a hardcoded parent route. The fallback covers deep links and
 * fresh tabs, where browser-back would leave the app.
 *
 * Pages with bespoke back-button styling use the hook directly; everything
 * else renders <BackButton/>.
 */
export function useBackNavigation(fallback: string): () => void {
  const navigate = useNavigate();
  return () => {
    const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0;
    if (idx > 0) void navigate(-1);
    else void navigate(fallback);
  };
}

export function BackButton({ fallback, label = 'Back', className }: BackButtonProps) {
  const goBack = useBackNavigation(fallback);

  return (
    <Button variant="ghost" size="sm" onClick={goBack} className={className}>
      <ArrowLeft className="h-4 w-4 mr-2" />
      {label}
    </Button>
  );
}
