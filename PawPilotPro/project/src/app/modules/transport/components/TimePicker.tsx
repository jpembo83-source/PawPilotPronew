/**
 * TimePicker — hour/minute dropdowns for a "HH:MM" (or empty) time value.
 *
 * Replaces the native <input type="time">, which some users could not commit
 * a value in (the segment would highlight but never register). Plain <select>
 * controls behave identically on every browser, PWA webview and device.
 */
import { Clock } from '@phosphor-icons/react';

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
// 5-minute granularity — enough for pickup/drop-off windows.
const MINUTES = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, '0'));

interface TimePickerProps {
  value: string; // "HH:MM" or ""
  onChange: (value: string) => void;
  className?: string;
}

export function TimePicker({ value, onChange, className }: TimePickerProps) {
  const [hh = '', mm = ''] = value ? value.split(':') : [];
  const selectCls =
    'h-10 px-2 rounded-md border border-input bg-input-background text-sm text-foreground flex-1';

  const setHour = (h: string) => {
    if (!h) return onChange(''); // clearing the hour clears the whole value
    onChange(`${h}:${mm || '00'}`);
  };
  const setMinute = (m: string) => {
    // A minute is meaningless without an hour — default the hour to 00.
    onChange(`${hh || '00'}:${m}`);
  };

  return (
    <div className={`flex items-center gap-1.5 ${className ?? ''}`}>
      <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
      <select value={hh} onChange={(e) => setHour(e.target.value)} className={selectCls} aria-label="Hour">
        <option value="">--</option>
        {HOURS.map((h) => (
          <option key={h} value={h}>{h}</option>
        ))}
      </select>
      <span className="text-muted-foreground">:</span>
      <select value={mm} onChange={(e) => setMinute(e.target.value)} className={selectCls} aria-label="Minute">
        <option value="">--</option>
        {MINUTES.map((m) => (
          <option key={m} value={m}>{m}</option>
        ))}
      </select>
    </div>
  );
}
