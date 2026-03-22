import React from 'react';
import { SourceType, SERVICE_COLOURS, SERVICE_LABELS } from '../types';

const SERVICES: SourceType[] = ['daycare', 'grooming', 'overnights', 'transport'];

interface LegendProps {
  activeFeatures: Set<SourceType>;
  onToggle: (feature: SourceType) => void;
}

export function Legend({ activeFeatures, onToggle }: LegendProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {SERVICES.map(s => {
        const c = SERVICE_COLOURS[s];
        const active = activeFeatures.has(s);
        return (
          <button
            key={s}
            onClick={() => onToggle(s)}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${
              active
                ? `${c.bg} ${c.border} ${c.text}`
                : 'bg-slate-50 border-slate-200 text-slate-400 opacity-50'
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${active ? c.dot : 'bg-slate-300'}`} />
            {SERVICE_LABELS[s]}
          </button>
        );
      })}
    </div>
  );
}
