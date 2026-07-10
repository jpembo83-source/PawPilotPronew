// Daycare Types - MDC Operations Centre
// Production-grade type definitions for dog daycare operations

// ============================================================================
// BOOKING TYPES
// ============================================================================

export type BookingStatus = 
  | 'requested'
  | 'confirmed'
  | 'cancelled'
  | 'no_show'
  | 'completed';

export type CheckInStatus = 
  | 'not_checked_in'
  | 'checked_in'
  | 'checked_out';

export interface DaycareBooking {
  id: string;
  
  // Links
  household_id: string;
  household_name: string;
  pet_id: string;
  pet_name: string;
  pet_photo_url?: string;
  location_id: string;
  location_name: string;
  service_id: string;
  service_name: string;
  service_type: 'hourly' | 'half_day' | 'full_day' | 'membership';
  
  // Scheduling
  booking_date: string; // YYYY-MM-DD
  planned_start_time?: string; // HH:mm
  planned_end_time?: string; // HH:mm
  
  // Status
  booking_status: BookingStatus;
  check_in_status: CheckInStatus;
  
  // Check-in/out times
  actual_check_in_time?: string; // ISO timestamp
  actual_check_out_time?: string; // ISO timestamp
  checked_in_by_id?: string;
  checked_in_by_name?: string;
  checked_out_by_id?: string;
  checked_out_by_name?: string;
  
  // Notes
  notes?: string; // Internal staff notes
  customer_notes?: string; // Customer-provided notes
  handover_notes?: string; // Check-in handover notes
  checkout_notes?: string; // Check-out notes
  
  // Capacity
  capacity_slot: number; // Auto-assigned slot number
  
  // Flags
  has_behaviour_flag: boolean;
  has_medical_flag: boolean;
  behaviour_notes?: string;
  medical_notes?: string;
  
  // Requirements validation
  vaccination_status: 'valid' | 'expiring_soon' | 'expired' | 'missing';
  waiver_status: 'valid' | 'expiring_soon' | 'expired' | 'missing';
  
  // Holds
  has_booking_hold: boolean;
  has_payment_hold: boolean;
  hold_reason?: string;
  
  // Billing
  base_price_locked: number;
  tax_rate: number;
  total_price: number;
  currency: string;
  billing_line_item_ids: string[];
  
  // Transport
  requires_transport: boolean;
  transport_pickup_id?: string;
  transport_dropoff_id?: string;
  
  // Metadata
  created_by_id: string;
  created_by_name: string;
  created_at: string;
  updated_at: string;
  cancelled_at?: string;
  cancelled_by_id?: string;
  cancelled_by_name?: string;
  cancellation_reason?: string;
}

// ============================================================================
// ATTENDANCE TYPES
// ============================================================================

export interface AttendanceRecord {
  id: string;
  booking_id: string;
  pet_id: string;
  pet_name: string;
  pet_photo_url?: string;
  household_id: string;
  household_name: string;
  location_id: string;
  
  check_in_time: string;
  check_out_time?: string;
  
  duration_minutes?: number;
  
  // Group assignment (optional)
  assigned_group?: string;
  assigned_area?: string;
  
  // Staff
  checked_in_by_id: string;
  checked_in_by_name: string;
  checked_out_by_id?: string;
  checked_out_by_name?: string;
  
  // Flags
  has_behaviour_flag: boolean;
  has_medical_flag: boolean;
  behaviour_notes?: string;
  medical_notes?: string;

  /** Owner's drop-off handover notes, shown on the live attendance board. */
  handover_notes?: string;

  // Notes during stay
  notes: AttendanceNote[];

  status: 'in_daycare' | 'checked_out';

  /**
   * Computed by GET /attendance/active: checked in on a previous calendar
   * day and never checked out — a missed check-out, not live attendance.
   */
  stale?: boolean;
}

export interface AttendanceNote {
  id: string;
  attendance_id: string;
  content: string;
  author_id: string;
  author_name: string;
  created_at: string;
  is_alert: boolean;
}

// ============================================================================
// CAPACITY TYPES
// ============================================================================

export interface DaycareCapacity {
  id: string;
  location_id: string;
  date: string; // YYYY-MM-DD
  max_capacity: number;
  current_bookings: number;
  current_checked_in: number;
  available_slots: number;
  is_full: boolean;
}

// ============================================================================
// DASHBOARD TYPES
// ============================================================================

export interface DaycareStats {
  location_id: string;
  date: string;
  
  // Counts
  total_bookings: number;
  confirmed_bookings: number;
  checked_in_count: number;
  checked_out_count: number;
  no_shows: number;
  cancellations: number;
  
  // Capacity
  max_capacity: number;
  capacity_utilisation: number; // percentage
  available_slots: number;
  
  // Expected
  expected_arrivals_2h: number;
  expected_pickups_2h: number;
  
  // Alerts
  waiver_alerts: number;
  hold_alerts: number;
  behaviour_flags: number;
  medical_flags: number;
  vaccination_alerts: number;
  
  // Revenue (permission gated)
  total_revenue?: number;
  currency?: string;
}

// ============================================================================
// FILTERS & SEARCH
// ============================================================================

export interface DaycareFilters {
  location_id?: string;
  date?: string; // YYYY-MM-DD
  start_date?: string;
  end_date?: string;
  booking_status?: BookingStatus;
  check_in_status?: CheckInStatus;
  service_type?: string;
  pet_id?: string;
  household_id?: string;
  staff_id?: string;
  has_flags?: boolean;
  search?: string;
}

// ============================================================================
// CHECK-IN/OUT VALIDATION
// ============================================================================

export interface CheckInValidation {
  can_check_in: boolean;
  blockers: ValidationIssue[];
  warnings: ValidationIssue[];
}

export interface ValidationIssue {
  type: 'blocker' | 'warning';
  category: 'waiver' | 'hold' | 'behaviour' | 'medical' | 'capacity' | 'other';
  message: string;
  /** Optional human-readable detail; rendered directly in the UI. */
  details?: string;
}

// ============================================================================
// CUSTOMER SEARCH
// ============================================================================

/** Pet summary returned by the customer search endpoint. */
export interface CustomerSearchPet {
  id: string;
  name: string;
  breed?: string;
  photo_url?: string;
  behaviour_notes?: string;
  medical_notes?: string;
  vaccination_status: string;
}

/** Household match returned by the customer search endpoint. */
export interface CustomerSearchResult {
  type: 'household' | 'pet' | 'contact';
  household_id: string;
  household_name: string;
  pets: CustomerSearchPet[];
  contacts: unknown[];
  matched_pet_id?: string;
}

// ============================================================================
// FEES
// ============================================================================

export interface DaycareFee {
  id: string;
  booking_id: string;
  fee_type: 'late_pickup' | 'cancellation' | 'no_show' | 'early_checkin' | 'other';
  amount: number;
  currency: string;
  reason: string;
  applied_by_id: string;
  applied_by_name: string;
  applied_at: string;
  billing_line_item_id?: string;
}

// ============================================================================
// REPORTS
// ============================================================================

export interface DaycareReportData {
  period: string;
  location_id: string;
  location_name: string;
  
  // Volume
  total_bookings: number;
  total_attendance: number;
  unique_pets: number;
  unique_households: number;
  
  // Utilisation
  avg_capacity_utilisation: number;
  peak_day: string;
  peak_count: number;
  
  // Performance
  no_show_rate: number;
  cancellation_rate: number;
  on_time_checkin_rate: number;
  
  // Revenue (permission gated)
  total_revenue?: number;
  avg_booking_value?: number;
  
  // Service breakdown
  by_service_type: Record<string, number>;
}

// ============================================================================
// CONSTANTS
// ============================================================================

export const BOOKING_STATUSES: Record<BookingStatus, { label: string; color: string; bgColor: string }> = {
  requested: {
    label: 'Requested',
    color: 'text-blue-700',
    bgColor: 'bg-blue-100',
  },
  confirmed: {
    label: 'Confirmed',
    color: 'text-green-700',
    bgColor: 'bg-green-100',
  },
  cancelled: {
    label: 'Cancelled',
    color: 'text-slate-700',
    bgColor: 'bg-slate-100',
  },
  no_show: {
    label: 'No Show',
    color: 'text-red-700',
    bgColor: 'bg-red-100',
  },
  completed: {
    label: 'Completed',
    color: 'text-emerald-700',
    bgColor: 'bg-emerald-100',
  },
};

export const CHECK_IN_STATUSES: Record<CheckInStatus, { label: string; color: string; bgColor: string }> = {
  not_checked_in: {
    label: 'Not Checked In',
    color: 'text-slate-700',
    bgColor: 'bg-slate-100',
  },
  checked_in: {
    label: 'Checked In',
    color: 'text-blue-700',
    bgColor: 'bg-blue-100',
  },
  checked_out: {
    label: 'Checked Out',
    color: 'text-green-700',
    bgColor: 'bg-green-100',
  },
};

export const SERVICE_TYPES: Record<string, string> = {
  hourly: 'Hourly',
  half_day: 'Half Day',
  full_day: 'Full Day',
  membership: 'Membership',
};
