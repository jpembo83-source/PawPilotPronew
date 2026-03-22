import { useEffect } from 'react';
import { useSettingsStore } from '../modules/settings/store';

export function ThemeManager() {
  const { organisation } = useSettingsStore();

  useEffect(() => {
    const root = document.documentElement;
    
    // Update Primary Brand Color
    if (organisation.primaryColor) {
      root.style.setProperty('--primary', organisation.primaryColor);
      root.style.setProperty('--ring', organisation.primaryColor);
      root.style.setProperty('--sidebar-primary', organisation.primaryColor);
      root.style.setProperty('--sidebar-ring', organisation.primaryColor);
      
      // Simple logic to keep foreground readable (optional, but good practice)
      // This assumes if user picks a color, they might need to stick with white/black contrast
      // For now, we leave foreground as defined in CSS (usually white for primary)
    }

    // Update Secondary Brand Color
    if (organisation.secondaryColor) {
      root.style.setProperty('--secondary', organisation.secondaryColor);
      // Secondary foreground usually dark, assuming secondary is light/pastel
      // root.style.setProperty('--secondary-foreground', '#4A3B39'); 
    }

  }, [organisation.primaryColor, organisation.secondaryColor]);

  return null;
}
