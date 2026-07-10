// Customer Management Types - MDC Operations Centre
// Complete type definitions for household, contacts, pets, documents

export type HouseholdStatus = 'active' | 'inactive';

export interface Household {
  id: string;
  tenant_id: string;
  external_id?: string; // For bulk imports
  name: string;
  status: HouseholdStatus;
  vip: boolean;
  payment_hold: boolean;
  hold_reason?: string;
  hold_notes?: string;
  primary_contact_id?: string;
  primary_location_id?: string;
  address?: {
    line1?: string;
    line2?: string;
    city?: string;
    postcode?: string;
    country?: string;
  };
  internal_notes?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export type ContactMethod = 'email' | 'phone' | 'sms';

export interface HouseholdContact {
  id: string;
  tenant_id: string;
  household_id: string;
  first_name: string;
  last_name: string;
  email?: string;
  phone?: string;
  preferred_contact_method?: ContactMethod;
  is_primary: boolean;
  is_emergency_contact: boolean;
  emergency_contact_relationship?: string;
  marketing_consent: boolean;
  sms_consent: boolean;
  email_consent: boolean;
  // Address fields - primary contact's address is used for transport
  address_line1?: string;
  address_line2?: string;
  address_city?: string;
  address_postcode?: string;
  address_country?: string;
  created_at: string;
  updated_at: string;
}

export type PetSex = 'male' | 'female' | 'unknown';

export interface Pet {
  id: string;
  tenant_id: string;
  household_id: string;
  name: string;
  photo_url?: string;
  breed?: string;
  sex?: PetSex;
  date_of_birth?: string;
  age_years?: number;
  microchip?: string;
  weight_kg?: number;
  colour?: string;
  
  // Address
  address?: {
    line1?: string;
    line2?: string;
    city?: string;
    postcode?: string;
    country?: string;
  };
  
  // Neutered/Spayed status
  neutered_status?: 'spayed' | 'castrated' | 'none';
  
  // Care information
  behaviour_notes?: string; // Permission gated
  medical_notes?: string; // Permission gated
  feeding_instructions?: string;
  allergies?: string;
  
  // Vet details
  vet_name?: string;
  vet_phone?: string;
  vet_address?: string;
  
  // Feature enrollment
  daycare_enrolled: boolean;
  grooming_enrolled: boolean;
  transport_enrolled: boolean;
  overnights_enrolled: boolean;
  
  // Status
  active: boolean;
  
  created_at: string;
  updated_at: string;
}

export type DocumentType =
  | 'waiver'
  | 'vaccination'
  | 'insurance'
  | 'medical'
  | 'photo_id'
  | 'other';

export interface PetDocument {
  id: string;
  tenant_id: string;
  household_id: string;
  pet_id?: string; // Optional if household-level document
  document_type: DocumentType;
  name: string;
  file_name: string;
  storage_path: string;
  file_size: number;
  mime_type: string;
  expiry_date?: string;
  notes?: string;
  uploaded_by: string;
  uploaded_at: string;
}

export interface CustomerPortalUser {
  id: string;
  tenant_id: string;
  household_id: string;
  email: string;
  first_name: string;
  last_name: string;
  active: boolean;
  last_login_at?: string;
  created_at: string;
}

// Pulse Timeline Event
export type ActivityType = 
  | 'daycare_booking'
  | 'daycare_checkin'
  | 'daycare_checkout'
  | 'grooming_appointment'
  | 'grooming_booking'
  | 'transport_task'
  | 'transport_booking'
  | 'transport_pickup'
  | 'transport_dropoff'
  | 'overnight_reservation'
  | 'overnight_booking'
  | 'overnight_checkin'
  | 'overnight_checkout'
  | 'billing_invoice'
  | 'billing_payment'
  | 'message_sent'
  | 'message_received'
  | 'incident_created'
  | 'incident_reported'
  | 'document_uploaded'
  | 'document_added'
  | 'household_created'
  | 'household_updated'
  | 'pet_added'
  | 'pet_created'
  | 'pet_updated'
  | 'pet_modified'
  | 'contact_added'
  | 'contact_updated'
  | 'flag_added'
  | 'flag_updated'
  | 'medical_note';

export interface ActivityEvent {
  id: string;
  tenant_id?: string;
  household_id: string;
  pet_id?: string;
  activity_type: ActivityType;
  title: string;
  description?: string;
  metadata?: Record<string, any>;
  source_id?: string; // Link to original record
  source_module?: string;
  occurred_at: string;
  created_by?: string;
  created_by_name?: string; // Populated from user metadata
  created_at?: string;
}

// Timeline items (combines activities, notes, and flags)
export type TimelineItemType = 'activity' | 'note' | 'flag';

export interface TimelineItem {
  timeline_type: TimelineItemType;
  timeline_date: string;
  // The item will have all fields from either ActivityEvent, HouseholdNote, or HouseholdFlag
  [key: string]: any;
}

// List filters
export interface CustomerFilters {
  search?: string;
  status?: HouseholdStatus;
  vip?: boolean;
  payment_hold?: boolean;
  document_alerts?: boolean;
  location_id?: string;
}

// Bulk import/export types
export interface HouseholdImportRow {
  external_id?: string;
  household_id?: string;
  household_name: string;
  status?: string;
  vip?: string;
  payment_hold?: string;
  hold_reason?: string;
  primary_location?: string;
  address_line1?: string;
  address_city?: string;
  address_postcode?: string;
  internal_notes?: string;
}

export interface ContactImportRow {
  household_id?: string;
  household_external_id?: string;
  household_name?: string;
  contact_id?: string;
  first_name: string;
  last_name: string;
  email?: string;
  phone?: string;
  is_primary?: string;
  marketing_consent?: string;
  sms_consent?: string;
  email_consent?: string;
}

export interface PetImportRow {
  household_id?: string;
  household_external_id?: string;
  household_name?: string;
  pet_id?: string;
  pet_name: string;
  breed?: string;
  sex?: string;
  date_of_birth?: string;
  microchip?: string;
  behaviour_notes?: string;
  medical_notes?: string;
  feeding_instructions?: string;
  allergies?: string;
  daycare_enrolled?: string;
  grooming_enrolled?: string;
  active?: string;
}

export interface BulkImportResult {
  success: boolean;
  households_created: number;
  households_updated: number;
  contacts_created: number;
  contacts_updated: number;
  pets_created: number;
  pets_updated: number;
  errors: Array<{
    row: number;
    sheet: string;
    field?: string;
    message: string;
    data?: any;
  }>;
}

export interface BulkImportDryRunResult extends BulkImportResult {
  dry_run: true;
  preview: {
    households: Array<{ action: 'create' | 'update'; data: Partial<Household> }>;
    contacts: Array<{ action: 'create' | 'update'; data: Partial<HouseholdContact> }>;
    pets: Array<{ action: 'create' | 'update'; data: Partial<Pet> }>;
  };
}

// Document alerts
export interface DocumentAlert {
  household_id: string;
  household_name: string;
  pet_id?: string;
  pet_name?: string;
  alert_type: 'missing' | 'expired' | 'expiring_soon';
  document_type: DocumentType;
  expiry_date?: string;
  days_until_expiry?: number;
}

// Notes & Flags
export type NoteCategory = 
  | 'general' 
  | 'behaviour' 
  | 'medical' 
  | 'billing' 
  | 'transport' 
  | 'grooming' 
  | 'overnight';

export type NoteVisibility = 'internal' | 'customer';

export interface HouseholdNote {
  id: string;
  tenant_id: string;
  household_id: string;
  title?: string;
  content: string;
  category: NoteCategory;
  visibility: NoteVisibility;
  is_pinned: boolean;
  created_by: string;
  created_by_name?: string; // Populated from user lookup
  created_at: string;
  updated_at: string;
  deleted_at?: string;
  deleted_by?: string;
  pet_ids?: string[]; // Populated from join table
}

export type FlagKey = 
  | 'vip'
  | 'behaviour_caution'
  | 'medical_caution'
  | 'payment_hold'
  | 'transport_instructions'
  | 'grooming_restrictions'
  | 'overnight_restrictions';

export type FlagSeverity = 'info' | 'warn' | 'block';

export interface HouseholdFlag {
  id: string;
  tenant_id: string;
  household_id: string;
  pet_id?: string;
  flag_key: FlagKey;
  severity: FlagSeverity;
  is_active: boolean;
  reason?: string;
  created_by: string;
  created_by_name?: string; // Populated from user lookup
  created_at: string;
  updated_at: string;
}

// ============================================================================
// API payload shapes (customers edge function)
// ============================================================================

// Generic error body returned by the customers edge function.
export interface ApiErrorResponse {
  error?: string;
}

// Household row as returned by the list endpoint (includes aggregates).
export interface HouseholdSummary extends Household {
  contacts_count?: number;
  pets_count?: number;
  primary_contact?: HouseholdContact;
}

// Household as returned by the detail endpoint (includes related records).
export interface HouseholdDetail extends Household {
  contacts?: HouseholdContact[];
  pets?: Pet[];
  documents?: PetDocument[];
  activities?: ActivityEvent[];
  activeFlags?: HouseholdFlag[];
}

// Response body when deleting a document (storage path for clean-up).
export interface DocumentDeleteResponse {
  storage_path: string;
}

// Household detail view (flattened structure for UI)
export interface HouseholdDetailView extends Household {
  contacts: HouseholdContact[];
  pets: Pet[];
  documents: PetDocument[];
  activities: ActivityEvent[];
  activeFlags: Array<{
    id: string;
    petId: string;
    type: string;
    message: string;
  }>;
  status: 'active' | 'suspended' | 'banned';
}

