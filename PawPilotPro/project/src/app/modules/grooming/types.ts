// Grooming Types - MDC Operations Centre
// Production-grade type definitions for grooming salon operations

// ============================================================================
// APPOINTMENT STATUS
// ============================================================================

export type AppointmentStatus = 
  | 'requested'
  | 'confirmed'
  | 'checked_in'
  | 'in_progress'
  | 'completed'
  | 'cancelled'
  | 'no_show';

// ============================================================================
// SERVICE TYPES
// ============================================================================

export type GroomingServiceType =
  | 'bath_brush'
  | 'bath_trim'
  | 'full_groom'
  | 'puppy_groom'
  | 'nail_trim'
  | 'teeth_cleaning'
  | 'ear_cleaning'
  | 'deshed_treatment'
  | 'flea_treatment'
  | 'custom';

// ============================================================================
// GROOMING APPOINTMENT
// ============================================================================

export interface GroomingAppointment {
  id: string;
  
  // Links
  household_id: string;
  household_name: string;
  pet_id: string;
  pet_name: string;
  pet_photo_url?: string;
  pet_breed?: string;
  pet_size?: 'small' | 'medium' | 'large' | 'xl';
  location_id: string;
  location_name: string;
  
  // Service Details
  service_type: GroomingServiceType;
  service_name: string;
  estimated_duration_minutes: number;
  
  // Scheduling
  appointment_date: string; // YYYY-MM-DD
  appointment_time: string; // HH:mm
  end_time?: string; // HH:mm - calculated from duration
  
  // Status
  status: AppointmentStatus;
  
  // Timing
  actual_check_in_time?: string;
  grooming_started_at?: string;
  grooming_completed_at?: string;
  actual_check_out_time?: string;
  
  // Staff Assignment
  groomer_id?: string;
  groomer_name?: string;
  checked_in_by_id?: string;
  checked_in_by_name?: string;
  checked_out_by_id?: string;
  checked_out_by_name?: string;
  
  // Special Instructions
  customer_notes?: string;
  grooming_instructions?: string;
  style_preferences?: string;
  
  // Flags
  has_behaviour_flag: boolean;
  has_medical_flag: boolean;
  behaviour_notes?: string;
  medical_notes?: string;
  has_matting: boolean;
  matting_severity?: 'light' | 'moderate' | 'severe';
  
  // Pricing
  base_price: number;
  additional_charges: AdditionalCharge[];
  total_price: number;
  currency: string;
  price_locked_at?: string;
  
  // Post-Groom
  groomer_notes?: string;
  next_appointment_recommended?: string;
  photos_taken: string[];
  
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

export interface AdditionalCharge {
  id: string;
  description: string;
  amount: number;
  reason: 'matting' | 'extra_time' | 'add_on_service' | 'special_handling' | 'other';
  added_by_id: string;
  added_by_name: string;
  added_at: string;
}

// ============================================================================
// GROOMER
// ============================================================================

export interface Groomer {
  id: string;
  user_id: string;
  name: string;
  location_id: string;
  
  // Skills
  specializations: GroomingServiceType[];
  can_handle_large_dogs: boolean;
  can_handle_difficult_dogs: boolean;
  
  // Schedule
  working_days: number[]; // 0-6, Sunday = 0
  working_hours_start: string; // HH:mm
  working_hours_end: string; // HH:mm
  
  // Capacity
  max_appointments_per_day: number;
  
  // Status
  is_active: boolean;
  is_on_break: boolean;
  current_appointment_id?: string;
  
  // Audit
  created_at: string;
  updated_at: string;
}

// ============================================================================
// GROOMING STATION
// ============================================================================

export interface GroomingStation {
  id: string;
  location_id: string;
  name: string;
  
  // Equipment
  has_bath: boolean;
  has_dryer: boolean;
  has_grooming_table: boolean;
  
  // Size capability
  max_dog_size: 'small' | 'medium' | 'large' | 'xl';
  
  // Status
  is_active: boolean;
  is_under_maintenance: boolean;
  current_appointment_id?: string;
  current_groomer_id?: string;
  
  // Audit
  created_at: string;
  updated_at: string;
}

// ============================================================================
// DASHBOARD STATS
// ============================================================================

export interface GroomingStats {
  location_id: string;
  date: string;
  
  // Counts
  total_appointments: number;
  confirmed_appointments: number;
  checked_in_count: number;
  in_progress_count: number;
  completed_count: number;
  no_shows: number;
  cancellations: number;
  
  // Groomers
  active_groomers: number;
  groomers_on_break: number;
  
  // Time
  avg_wait_time_minutes: number;
  avg_groom_duration_minutes: number;
  
  // Queue
  queue_length: number;
  next_available_slot?: string;
  
  // Alerts
  behaviour_flags: number;
  medical_flags: number;
  overdue_count: number; // Appointments past expected end time
  
  // Revenue (permission gated)
  total_revenue?: number;
  currency?: string;
}

// ============================================================================
// FILTERS
// ============================================================================

export interface GroomingFilters {
  location_id?: string;
  date?: string;
  start_date?: string;
  end_date?: string;
  status?: AppointmentStatus;
  service_type?: GroomingServiceType;
  groomer_id?: string;
  pet_id?: string;
  household_id?: string;
  has_flags?: boolean;
  search?: string;
}

// ============================================================================
// CHECK-IN VALIDATION
// ============================================================================

export interface GroomingCheckInValidation {
  can_check_in: boolean;
  blockers: GroomingValidationIssue[];
  warnings: GroomingValidationIssue[];
  suggested_groomer?: string;
  suggested_station?: string;
}

export interface GroomingValidationIssue {
  type: 'blocker' | 'warning';
  category: 'behaviour' | 'medical' | 'matting' | 'capacity' | 'other';
  message: string;
  details?: unknown;
}

// ============================================================================
// QUEUE ITEM
// ============================================================================

export interface GroomingQueueItem {
  appointment_id: string;
  pet_name: string;
  pet_photo_url?: string;
  household_name: string;
  service_name: string;
  estimated_duration_minutes: number;
  checked_in_at: string;
  wait_time_minutes: number;
  has_flags: boolean;
  priority: 'normal' | 'high'; // High for medical/behaviour flags
}

// ============================================================================
// CONSTANTS
// ============================================================================

export const APPOINTMENT_STATUSES: Record<AppointmentStatus, { label: string; color: string; bgColor: string }> = {
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
  checked_in: {
    label: 'Checked In',
    color: 'text-amber-700',
    bgColor: 'bg-amber-100',
  },
  in_progress: {
    label: 'In Progress',
    color: 'text-purple-700',
    bgColor: 'bg-purple-100',
  },
  completed: {
    label: 'Completed',
    color: 'text-emerald-700',
    bgColor: 'bg-emerald-100',
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
};

export const SERVICE_TYPES: Record<GroomingServiceType, { label: string; defaultDuration: number }> = {
  bath_brush: { label: 'Bath & Brush', defaultDuration: 45 },
  bath_trim: { label: 'Bath & Trim', defaultDuration: 60 },
  full_groom: { label: 'Full Groom', defaultDuration: 90 },
  puppy_groom: { label: 'Puppy Groom', defaultDuration: 45 },
  nail_trim: { label: 'Nail Trim', defaultDuration: 15 },
  teeth_cleaning: { label: 'Teeth Cleaning', defaultDuration: 20 },
  ear_cleaning: { label: 'Ear Cleaning', defaultDuration: 15 },
  deshed_treatment: { label: 'De-shed Treatment', defaultDuration: 60 },
  flea_treatment: { label: 'Flea Treatment', defaultDuration: 30 },
  custom: { label: 'Custom Service', defaultDuration: 60 },
};

export const DOG_SIZES: Record<string, string> = {
  small: 'Small (under 10kg)',
  medium: 'Medium (10-25kg)',
  large: 'Large (25-40kg)',
  xl: 'Extra Large (over 40kg)',
};
