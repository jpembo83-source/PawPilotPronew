// Capacity Module Types
// Unified view of capacity across all services

export interface ServiceCapacity {
  service: 'daycare' | 'grooming' | 'overnights' | 'transport';
  date: string;
  
  // Capacity numbers
  total_capacity: number;
  booked: number;
  checked_in?: number;
  available: number;
  
  // Percentages
  utilization_percent: number;
  
  // Status
  status: 'available' | 'limited' | 'full' | 'overbooked';
  
  // Breakdowns (optional)
  by_time_slot?: TimeSlotCapacity[];
  by_staff?: StaffCapacity[];
}

export interface TimeSlotCapacity {
  start_time: string;
  end_time: string;
  booked: number;
  capacity: number;
  available: number;
}

export interface StaffCapacity {
  staff_id: string;
  staff_name: string;
  assigned_count: number;
  max_capacity: number;
  available: number;
}

export interface DailyCapacitySummary {
  date: string;
  daycare: ServiceCapacity | null;
  grooming: ServiceCapacity | null;
  overnights: ServiceCapacity | null;
  transport: ServiceCapacity | null;
  staff_on_duty?: number;
  notes?: string;
}

export interface CapacityFilters {
  location_id?: string;
  start_date: string;
  end_date: string;
  services?: ('daycare' | 'grooming' | 'overnights' | 'transport')[];
}

export interface WeeklyCapacityView {
  week_start: string;
  week_end: string;
  days: DailyCapacitySummary[];
}

/**
 * Minimal slice of a daycare booking needed to derive capacity
 * when the capacity API is not yet available.
 */
export interface CapacityBookingRecord {
  booking_date: string;
  booking_status?: string;
}

/**
 * The slice of a daycare booking the planner view renders — the digital
 * equivalent of one line in the paper register ("Roxy Full + PU/DO").
 * Comes straight from GET /daycare/bookings; no new backend.
 */
export interface PlannerBooking {
  id: string;
  booking_date: string;
  booking_status?: string;
  check_in_status?: string;
  pet_id: string;
  pet_name: string;
  household_id: string;
  household_name: string;
  location_id: string;
  service_type?: string;
  planned_start_time?: string;
  planned_end_time?: string;
  requires_transport?: boolean;
  has_behaviour_flag?: boolean;
  has_medical_flag?: boolean;
}
