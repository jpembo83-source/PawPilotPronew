export type SourceType = 'daycare' | 'grooming' | 'overnights' | 'transport';

export interface CalendarEvent {
  id: string;
  source_type: SourceType;
  source_id: string;
  title: string;
  subtitle: string;
  start_at: string;
  end_at: string;
  pet_name: string;
  pet_id: string;
  household_name: string;
  household_id: string;
  location_id: string;
  assigned_staff: string;
  assigned_staff_id: string;
  status: string;
  display_type: string;
  direction?: string;
  service_type?: string;
  flags: string[];
}

export interface CalendarSummary {
  total: number;
  daycare: number;
  grooming: number;
  overnights: number;
  transport: number;
}

export type CalendarView = 'day' | 'week' | 'agenda';
export type GroupBy = 'time' | 'feature' | 'location' | 'staff';

export const SERVICE_COLOURS: Record<SourceType, { bg: string; border: string; text: string; dot: string; light: string }> = {
  daycare: { bg: 'bg-blue-100', border: 'border-blue-400', text: 'text-blue-800', dot: 'bg-blue-500', light: 'bg-blue-50' },
  grooming: { bg: 'bg-purple-100', border: 'border-purple-400', text: 'text-purple-800', dot: 'bg-purple-500', light: 'bg-purple-50' },
  overnights: { bg: 'bg-emerald-100', border: 'border-emerald-400', text: 'text-emerald-800', dot: 'bg-emerald-500', light: 'bg-emerald-50' },
  transport: { bg: 'bg-orange-100', border: 'border-orange-400', text: 'text-orange-800', dot: 'bg-orange-500', light: 'bg-orange-50' },
};

export const SERVICE_LABELS: Record<SourceType, string> = {
  daycare: 'Daycare',
  grooming: 'Grooming',
  overnights: 'Overnights',
  transport: 'Transport',
};
