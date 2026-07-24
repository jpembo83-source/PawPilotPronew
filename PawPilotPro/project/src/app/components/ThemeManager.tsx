import { useEffect } from 'react';
import { useSettingsStore } from '../modules/settings/store';
import { useAccountStore } from '../stores/accountStore';
import { resolveIsDark } from '../lib/account';

function isValidHex(hex: string | undefined): boolean {
  if (!hex) return false;
  return /^#[0-9a-fA-F]{6}$/.test(hex);
}

export function ThemeManager() {
  const { organisation } = useSettingsStore();
  // Per-user appearance preference (My Account → Preferences). Persisted
  // server-side per user and cached locally, so it applies on load without
  // flashing the wrong theme.
  const theme = useAccountStore((s) => s.prefs.theme);

  useEffect(() => {
    const root = document.documentElement;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => root.classList.toggle('dark', resolveIsDark(theme, media.matches));
    apply();
    if (theme === 'system') {
      media.addEventListener('change', apply);
      return () => media.removeEventListener('change', apply);
    }
  }, [theme]);

  useEffect(() => {
    const root = document.documentElement;

    // Always reset to design system defaults first so a cleared brand color
    // returns the UI to teal rather than persisting the last applied value.
    root.style.removeProperty('--primary');
    root.style.removeProperty('--ring');
    root.style.removeProperty('--secondary');

    if (isValidHex(organisation.primaryColor)) {
      root.style.setProperty('--primary', organisation.primaryColor!);
      root.style.setProperty('--ring', organisation.primaryColor!);
    }

    if (isValidHex(organisation.secondaryColor)) {
      root.style.setProperty('--secondary', organisation.secondaryColor!);
    }
  }, [organisation.primaryColor, organisation.secondaryColor]);

  return null;
}
