// Shared metadata for the operational-flag taxonomy (FlagKey in types.ts).
// Single source for the icon/label/severity-colour mapping used by flag
// badges (household header, Pets tab, Notes & Flags tab) and the flag editor.
// The key list mirrors the backend's validKeys in customers_routes — do not
// add or rename keys here without changing both.
import {
  Star,
  Warning,
  ShieldWarning,
  Prohibit,
  Truck,
  Scissors,
  House,
  Flag,
  type Icon,
} from '@phosphor-icons/react';
import type { FlagKey, FlagSeverity } from './types';

export const FLAG_KEYS: FlagKey[] = [
  'vip',
  'behaviour_caution',
  'medical_caution',
  'payment_hold',
  'transport_instructions',
  'grooming_restrictions',
  'overnight_restrictions',
];

const FLAG_ICONS: Record<FlagKey, Icon> = {
  vip: Star,
  behaviour_caution: Warning,
  medical_caution: ShieldWarning,
  payment_hold: Prohibit,
  transport_instructions: Truck,
  grooming_restrictions: Scissors,
  overnight_restrictions: House,
};

export function getFlagIcon(key: FlagKey): Icon {
  return FLAG_ICONS[key] ?? Flag;
}

export function getFlagLabel(key: FlagKey): string {
  return key
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

export function getSeverityColor(severity: FlagSeverity): string {
  switch (severity) {
    case 'info':
      return 'bg-blue-100 text-blue-800 border-blue-300';
    case 'warn':
      return 'bg-amber-100 text-amber-800 border-amber-300';
    case 'block':
      return 'bg-red-100 text-red-800 border-red-300';
    default:
      return 'bg-slate-100 text-slate-800 border-slate-300';
  }
}

// Plain-language consequences shown in the severity picker — staff choosing
// "block" must understand it stops check-in, not just adds a badge.
export const SEVERITY_OPTIONS: { value: FlagSeverity; label: string; explanation: string }[] = [
  {
    value: 'info',
    label: 'Info',
    explanation: 'Shown on the profile for reference — never interrupts check-in',
  },
  {
    value: 'warn',
    label: 'Warn',
    explanation: 'Shows a warning at check-in that staff must acknowledge',
  },
  {
    value: 'block',
    label: 'Block',
    explanation: 'Prevents check-in until the flag is cleared',
  },
];
