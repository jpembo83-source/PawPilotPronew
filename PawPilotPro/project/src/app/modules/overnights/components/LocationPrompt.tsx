import React from 'react';
import { Moon } from '@phosphor-icons/react';

interface LocationPromptProps {
  /** True when "All locations" is active and the tenant has several sites. */
  needsSelection: boolean;
  /** What the user is trying to do, e.g. "manage overnight check-ins". */
  action: string;
}

/** Empty state shown when an overnight operational page has no single location to act on. */
export function LocationPrompt({ needsSelection, action }: LocationPromptProps) {
  return (
    <div className="flex flex-col items-center justify-center h-96 text-slate-500">
      <Moon className="h-16 w-16 text-slate-300 mb-4" />
      <h2 className="text-lg font-medium text-slate-900">
        {needsSelection ? 'Select a Location' : 'No Location Selected'}
      </h2>
      <p>
        {needsSelection
          ? `You are viewing all locations — select a specific location to ${action}.`
          : `Please select a location to ${action}.`}
      </p>
    </div>
  );
}
