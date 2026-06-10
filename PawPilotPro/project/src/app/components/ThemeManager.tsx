import { useEffect } from 'react';
import { useSettingsStore } from '../modules/settings/store';

function isValidHex(hex: string | undefined): boolean {
  if (!hex) return false;
  return /^#[0-9a-fA-F]{6}$/.test(hex);
}

export function ThemeManager() {
  const { organisation } = useSettingsStore();

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
