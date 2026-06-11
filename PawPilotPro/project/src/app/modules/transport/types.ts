// Transportation Module Types - Production-grade with live data integration
// All types reference real households and pets - NO seed/mock data

export type TransportDirection = 'pickup' | 'dropoff' | 'roundtrip';
export type TransportJobStatus = 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
export type TransportEventType = 
  | 'created' 
  | 'assigned' 
  | 'started' 
  | 'arrived' 
  | 'picked_up' 
  | 'dropped_off' 
  | 'completed' 
  | 'cancelled';

/**
 * Transport Job - represents a single pickup or dropoff task
 * MUST reference real household_id and pet_id from customers database
 */
export interface TransportJob {
  id: string;
  tenant_id: string;
  location_id: string;
  
  // Service details
  service_date: string; // YYYY-MM-DD - day the transport occurs
  direction: TransportDirection;
  status: TransportJobStatus;
  
  // Customer references - MUST be real IDs
  household_id: string; // FK to households table
  pet_id: string; // FK to pets table
  
  // Addresses
  address_pickup: string;
  address_dropoff: string;
  
  // Timing
  time_window_start?: string; // HH:MM format
  time_window_end?: string; // HH:MM format
  
  // Assignment
  assigned_driver_user_id?: string; // FK to auth.users
  assigned_vehicle_id?: string;
  
  // Optional link to booking that generated this transport
  booking_id?: string;
  booking_type?: 'daycare' | 'grooming' | 'overnight';
  
  // Notes
  notes?: string;
  
  // Audit
  created_by: string;
  created_at: string;
  updated_at: string;
}

/**
 * Transport Event - audit trail for all transport actions
 */
export interface TransportEvent {
  id: string;
  tenant_id: string;
  transport_job_id: string;
  event_type: TransportEventType;
  event_time: string; // ISO timestamp
  actor_user_id: string;
  metadata?: Record<string, any>;
}

/**
 * Vehicle - transport fleet management
 */
export interface Vehicle {
  id: string;
  tenant_id: string;
  location_id: string;
  
  name: string; // e.g. "Blue Van"
  licence_plate: string;
  capacity: number; // Max dogs
  
  assigned_driver_user_id?: string; // Default driver
  
  notes?: string;
  is_active: boolean;
  
  created_at: string;
  updated_at: string;
}

/**
 * Transport Job with joined customer data
 * Used for display purposes - includes pet and household info
 */
export interface TransportJobWithDetails extends TransportJob {
  // Pet details
  pet_name: string;
  pet_photo_url?: string;
  
  // Household details
  household_name: string;
  
  // Primary contact details (for driver communication)
  contact_name?: string;
  contact_phone?: string;
  contact_email?: string;
  
  // Vehicle details (if assigned)
  vehicle_name?: string;
  vehicle_licence_plate?: string;
  
  // Driver details (if assigned)
  driver_name?: string;
}

/**
 * Create transport job request
 */
export interface CreateTransportJobRequest {
  location_id: string;
  service_date: string;
  direction: TransportDirection;
  household_id: string;
  pet_id: string;
  address_pickup: string;
  address_dropoff: string;
  time_window_start?: string;
  time_window_end?: string;
  notes?: string;
  booking_id?: string;
  booking_type?: 'daycare' | 'grooming' | 'overnight';
}

/**
 * Update transport job request
 */
export interface UpdateTransportJobRequest {
  service_date?: string;
  direction?: TransportDirection;
  status?: TransportJobStatus;
  address_pickup?: string;
  address_dropoff?: string;
  time_window_start?: string;
  time_window_end?: string;
  assigned_driver_user_id?: string;
  assigned_vehicle_id?: string;
  notes?: string;
}

/**
 * Transport assignment request
 */
export interface AssignTransportRequest {
  job_id: string;
  driver_user_id: string;
  vehicle_id: string;
}

/**
 * Driver status update request
 */
export interface DriverStatusUpdateRequest {
  job_id: string;
  event_type: 'started' | 'arrived' | 'picked_up' | 'dropped_off' | 'completed';
  notes?: string;
}

/**
 * Active driver summary returned by the active-drivers endpoint
 */
export interface TransportDriver {
  user_id: string;
  first_name: string;
  last_name: string;
  email?: string;
  role: string;
  location_ids: string[];
}

/**
 * Response envelope for the active-drivers endpoint
 */
export interface ActiveDriversResponse {
  driver_count?: number;
  vehicle_count?: number;
  drivers?: TransportDriver[];
  vehicles?: Vehicle[];
}
