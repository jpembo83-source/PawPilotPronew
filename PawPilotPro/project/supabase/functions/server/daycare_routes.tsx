// Daycare Routes - MDC Operations Centre
// Production-grade daycare management API with RBAC enforcement and operational rules integration
// Integrated with Transport (auto-create jobs) and Overnights (attendance inclusion)

import { Hono } from 'npm:hono';
import { createClient } from 'npm:@supabase/supabase-js';
import * as kv from './kv_store.tsx';
import { requireAuth, AuthenticatedUser } from './_shared/auth.ts';
import { internalError } from './_shared/log.ts';
import { buildPetUpdate, recordPetUpdate } from './lib/pet_updates.ts';
import { flagCheckInIssues } from './lib/flag_gate.ts';
import { signPetPhotoUrl, storedPetPhoto, withSignedPetPhotos } from './lib/pet_photos.ts';
import { findDuplicateBooking } from './lib/daycare_dedup.ts';
import { isNonBillablePet } from './lib/billing_exempt.ts';
import {
  consumeCredits,
  membershipCoverage,
  restoreCredits,
  sessionTypeForServiceId,
  type CustomerMembership,
} from './lib/membership_catalog.ts';
import { activeMembershipForHousehold } from './lib/membership_store.ts';
import {
  annotateLiveAlertFlags,
  buildPetNotesMap,
  countBehaviourMedicalAlerts,
  groupFlagsByHousehold,
} from './lib/dashboard_alerts.ts';

const app = new Hono();

// Every daycare route requires a validated user. requireAuth handles JWT
// validation server-side with SERVICE_ROLE_KEY; the ad-hoc ANON_KEY-validated
// getUserFromToken helper that used to live here has been removed.
app.use('*', requireAuth);

// ============================================================================
// TYPES
// ============================================================================

type BookingStatus = 'requested' | 'confirmed' | 'cancelled' | 'no_show' | 'completed';
type CheckInStatus = 'not_checked_in' | 'checked_in' | 'checked_out';
type ServiceType = 'hourly' | 'half_day' | 'full_day' | 'trial_day' | 'membership';
type RAGStatus = 'green' | 'amber' | 'red';

interface DaycareEvent {
  id: string;
  booking_id?: string;
  location_id: string;
  event_type: 'booking_created' | 'booking_cancelled' | 'checked_in' | 'checked_out' | 'capacity_override' | 'booking_updated';
  actor_id: string;
  actor_name: string;
  description: string;
  metadata?: Record<string, any>;
  timestamp: string;
}

export interface DaycareBooking {
  id: string;
  household_id: string;
  household_name: string;
  pet_id: string;
  pet_name: string;
  pet_photo_url?: string;
  location_id: string;
  location_name: string;
  service_id: string;
  service_name: string;
  service_type: 'hourly' | 'half_day' | 'full_day' | 'trial_day' | 'membership';
  booking_date: string;
  /** Set when this booking is one day of a multi-day day-visit range, so the
   *  days can be listed/managed together. Single bookings leave it unset. */
  booking_group_id?: string;
  /** Set when this booking was generated from a standing (recurring) schedule
   *  — the planner shows these with a recurring marker and offers per-day
   *  skip/override. Manual bookings leave it unset. */
  standing_booking_id?: string;
  planned_start_time?: string;
  planned_end_time?: string;
  booking_status: BookingStatus;
  check_in_status: CheckInStatus;
  actual_check_in_time?: string;
  actual_check_out_time?: string;
  checked_in_by_id?: string;
  checked_in_by_name?: string;
  checked_out_by_id?: string;
  checked_out_by_name?: string;
  notes?: string;
  customer_notes?: string;
  handover_notes?: string;
  checkout_notes?: string;
  capacity_slot: number;
  has_behaviour_flag: boolean;
  has_medical_flag: boolean;
  behaviour_notes?: string;
  medical_notes?: string;
  vaccination_status: 'valid' | 'expiring_soon' | 'expired' | 'missing';
  waiver_status: 'valid' | 'expiring_soon' | 'expired' | 'missing';
  has_booking_hold: boolean;
  has_payment_hold: boolean;
  hold_reason?: string;
  base_price_locked: number;
  tax_rate: number;
  total_price: number;
  currency: string;
  /** House dog: booking occupies a slot but was priced at zero. */
  non_billable?: boolean;
  /** Set when an active membership covered this booking: the covering
   *  customer_membership id and the credits drawn (0 for unlimited plans).
   *  Cancellation restores the credits via these fields. */
  membership_id?: string;
  membership_credits_used?: number;
  billing_line_item_ids: string[];
  requires_transport: boolean;
  transport_pickup_id?: string;
  transport_dropoff_id?: string;
  created_by_id: string;
  created_by_name: string;
  created_at: string;
  updated_at: string;
  cancelled_at?: string;
  cancelled_by_id?: string;
  cancelled_by_name?: string;
  cancellation_reason?: string;
  tenant_id?: string;
}

interface AttendanceRecord {
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
  assigned_group?: string;
  assigned_area?: string;
  checked_in_by_id: string;
  checked_in_by_name: string;
  checked_out_by_id?: string;
  checked_out_by_name?: string;
  has_behaviour_flag: boolean;
  has_medical_flag: boolean;
  behaviour_notes?: string;
  medical_notes?: string;
  /** Owner's drop-off handover notes — handlers read these off the live
   *  attendance board, so they live on the attendance record itself. */
  handover_notes?: string;
  notes: any[];
  status: 'in_daycare' | 'checked_out';
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

const getSupabase = () => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing Supabase credentials');
  }
  
  return createClient(supabaseUrl, supabaseServiceKey);
};

const hasPermission = (userRole: string, action: string): boolean => {
  const permissions: Record<string, string[]> = {
    admin: ['view', 'create_booking', 'update_booking', 'check_in', 'check_out', 'cancel', 'override_rules', 'reports', 'export'],
    manager: ['view', 'create_booking', 'update_booking', 'check_in', 'check_out', 'cancel', 'reports', 'export'],
    assistant_manager: ['view', 'create_booking', 'update_booking', 'check_in', 'check_out'],
    staff: ['view', 'create_booking', 'check_in', 'check_out'],
  };
  
  return permissions[userRole]?.includes(action) || false;
};

const generateId = (prefix: string) => `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

const filterByLocationPermission = (items: any[], user: any, locationKey: string = 'location_id'): any[] => {
  if (user.role === 'admin') return items;
  return items.filter(item => user.locationIds.includes(item[locationKey]));
};

// Location capacity comes from the SAME record the Settings → Locations
// page writes: `location:{id}` (see app_routes). This used to read a
// `settings:location:` key that never existed, so EVERY location silently
// fell back to 19 — and a module-level cache pinned whatever an isolate
// saw first for its whole lifetime. No cache: one indexed kv.get per call
// is cheap, and a capacity change in Settings must apply on the next
// request, not on the next cold start.
const FALLBACK_LOCATION_CAPACITY = 19;

const resolveLocationCapacity = async (locationId: string): Promise<number> => {
  const locationData = await kv.get(`location:${locationId}`) as any;
  const maxDogs = locationData?.capacity?.maxDogs;
  if (typeof maxDogs === 'number' && maxDogs > 0) {
    return maxDogs;
  }
  console.warn(JSON.stringify({
    scope: 'daycare.capacity',
    msg: 'location record missing capacity.maxDogs — using fallback',
    locationId,
    fallback: FALLBACK_LOCATION_CAPACITY,
  }));
  return FALLBACK_LOCATION_CAPACITY;
};

// 'All Locations' is the whole operation, not zero: capacity is the SUM of
// every location the user is allowed to see, so the dashboard reads e.g.
// 0/63 across three sites instead of 0/0.
const sumVisibleLocationCapacity = async (user: AuthenticatedUser): Promise<number> => {
  const locations = (await kv.getByPrefix('location:')) as any[];
  const visible = (Array.isArray(locations) ? locations : []).filter((loc) => {
    if (!loc?.id) return false;
    if (user.role === 'admin') return true;
    return Array.isArray(user.locationIds) && user.locationIds.includes(loc.id);
  });
  return visible.reduce((sum, loc) => {
    const maxDogs = loc?.capacity?.maxDogs;
    return sum + (typeof maxDogs === 'number' && maxDogs > 0 ? maxDogs : FALLBACK_LOCATION_CAPACITY);
  }, 0);
};

const calculateRAGStatus = (booked: number, maxCapacity: number): RAGStatus => {
  if (maxCapacity <= 0) return 'red';
  const utilisation = (booked / maxCapacity) * 100;
  if (utilisation > 90) return 'red';
  if (utilisation >= 75) return 'amber';
  return 'green';
};

const getCapacity = async (locationId: string, date: string) => {
  const key = `daycare:capacity:${locationId}:${date}`;
  let capacity = await kv.get(key) as any;
  
  const maxCapacity = await resolveLocationCapacity(locationId);
  
  if (!capacity) {
    capacity = {
      id: generateId('cap'),
      location_id: locationId,
      date,
      max_capacity: maxCapacity,
      current_bookings: 0,
      current_checked_in: 0,
      available_slots: maxCapacity,
      is_full: false,
      rag_status: 'green' as RAGStatus,
    };
    await kv.set(key, capacity);
  } else if (capacity.max_capacity !== maxCapacity) {
    capacity.max_capacity = maxCapacity;
    capacity.available_slots = maxCapacity - capacity.current_bookings;
    capacity.is_full = capacity.available_slots <= 0;
    capacity.rag_status = calculateRAGStatus(capacity.current_bookings, maxCapacity);
    await kv.set(key, capacity);
  }
  
  if (!capacity.rag_status) {
    capacity.rag_status = calculateRAGStatus(capacity.current_bookings, capacity.max_capacity);
  }
  
  return capacity;
};

const logDaycareEvent = async (event: Omit<DaycareEvent, 'id' | 'timestamp'>) => {
  const eventId = generateId('dcev');
  const now = new Date().toISOString();
  const fullEvent: DaycareEvent = {
    ...event,
    id: eventId,
    timestamp: now,
  };
  await kv.set(`daycare:event:${eventId}`, fullEvent);
  if (event.booking_id) {
    await kv.set(`daycare:event:booking:${event.booking_id}:${eventId}`, eventId);
  }
  await kv.set(`daycare:event:location:${event.location_id}:${eventId}`, eventId);
  return fullEvent;
};

// Validate check-in requirements
const validateCheckIn = async (booking: DaycareBooking, tenantId: string) => {
  const blockers: any[] = [];
  const warnings: any[] = [];
  
  console.log('[validateCheckIn] Starting validation for booking:', booking.id);
  console.log('[validateCheckIn] Household ID:', booking.household_id);
  console.log('[validateCheckIn] Tenant ID (created_by_id):', booking.created_by_id);
  
  // Vaccination check - WARNING ONLY (operational flexibility)
  if (booking.vaccination_status === 'expired' || booking.vaccination_status === 'missing') {
    warnings.push({
      type: 'warning',
      category: 'vaccination',
      message: 'Vaccination certificate expired or missing. Please update records.',
    });
  } else if (booking.vaccination_status === 'expiring_soon') {
    warnings.push({
      type: 'warning',
      category: 'vaccination',
      message: 'Vaccination certificate expiring soon',
    });
  }
  
  // Waiver check - dynamically fetch latest status - WARNING ONLY
  console.log('[validateCheckIn] Fetching documents with prefix:', `customer:${tenantId}:document:${booking.household_id}:`);
  const householdDocs = await kv.getByPrefix(`customer:${tenantId}:document:${booking.household_id}:`);
  console.log('[validateCheckIn] Found', householdDocs.length, 'documents');
  
  const waiverDoc = householdDocs.find((d) => {
    const doc = d;
    console.log('[validateCheckIn] Checking document:', doc.id, 'type:', doc.document_type, 'pet_id:', doc.pet_id, 'checking_in_pet:', booking.pet_id);
    // Waiver must be for this household AND either:
    // 1. Household-level (no pet_id) - applies to all pets
    // 2. Pet-specific (pet_id matches the pet being checked in)
    return doc.document_type === 'waiver' && (!doc.pet_id || doc.pet_id === booking.pet_id);
  });
  
  console.log('[validateCheckIn] Found valid waiver for this pet:', waiverDoc ? 'YES' : 'NO');
  
  let waiver_status: 'valid' | 'expiring_soon' | 'expired' | 'missing' = 'missing';
  let debug_waiver_info: any = {
    search_prefix: `customer:${tenantId}:document:${booking.household_id}:`,
    docs_found: householdDocs.length,
    household_id: booking.household_id,
    waiver_found: !!waiverDoc
  };
  
  if (waiverDoc) {
    const doc = waiverDoc;
    console.log('[validateCheckIn] Waiver document:', doc);
    debug_waiver_info.waiver_doc = doc;
    if (doc.expiry_date) {
      const expiryDate = new Date(doc.expiry_date);
      const now = new Date();
      const daysDiff = Math.floor((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      
      console.log('[validateCheckIn] Expiry date:', doc.expiry_date, 'Days until expiry:', daysDiff);
      debug_waiver_info.expiry_date = doc.expiry_date;
      debug_waiver_info.days_until_expiry = daysDiff;
      
      if (daysDiff < 0) {
        waiver_status = 'expired';
      } else if (daysDiff < 30) {
        waiver_status = 'expiring_soon';
      } else {
        waiver_status = 'valid';
      }
    }
  }
  
  console.log('[validateCheckIn] Calculated waiver_status:', waiver_status);
  
  if (waiver_status === 'expired' || waiver_status === 'missing') {
    warnings.push({
      type: 'warning',
      category: 'waiver',
      message: `Waiver expired or missing. Please obtain signed waiver.`,
    });
  } else if (waiver_status === 'expiring_soon') {
    warnings.push({
      type: 'warning',
      category: 'waiver',
      message: 'Waiver expiring soon',
    });
  }
  
  // Holds check - BLOCKER (business-critical)
  if (booking.has_booking_hold || booking.has_payment_hold) {
    blockers.push({
      type: 'blocker',
      category: 'hold',
      message: `Account hold: ${booking.hold_reason || 'Payment or booking issue'}. Manager override required.`,
    });
  }
  
  // Behaviour / medical - WARNING. Read the LIVE pet record (same reasoning
  // as the waiver lookup above): these notes are safety data staff can edit
  // at any time, but has_behaviour_flag/behaviour_notes are stamped onto the
  // booking at creation and go stale — a bite history or medication change
  // recorded after booking would otherwise never reach the check-in screen.
  // The booking snapshot stays as the fallback when the pet record is gone,
  // so warnings fail towards showing rather than disappearing.
  const livePet = (await kv.get(
    `customer:${tenantId}:pet:${booking.household_id}:${booking.pet_id}`,
  )) as { behaviour_notes?: string; medical_notes?: string } | null;
  const behaviourNotes = livePet ? livePet.behaviour_notes : booking.behaviour_notes;
  const medicalNotes = livePet ? livePet.medical_notes : booking.medical_notes;
  const hasBehaviourFlag = livePet ? !!behaviourNotes : booking.has_behaviour_flag;
  const hasMedicalFlag = livePet ? !!medicalNotes : booking.has_medical_flag;

  if (hasBehaviourFlag) {
    warnings.push({
      type: 'warning',
      category: 'behaviour',
      message: `Behaviour alert: ${behaviourNotes || 'See pet profile'}`,
    });
  }

  if (hasMedicalFlag) {
    warnings.push({
      type: 'warning',
      category: 'medical',
      message: `Medical alert: ${medicalNotes || 'See pet profile'}`,
    });
  }

  // Operational flags — LIVE read, same rationale as the pet record above:
  // a warn flag must surface (and a block flag must block) on the very next
  // check-in tap after staff create it, not only on bookings made afterwards.
  const flagRecords = await kv.getByPrefix(
    `customer:${tenantId}:household:${booking.household_id}:flag:`,
  );
  const flagIssues = flagCheckInIssues(flagRecords, booking.pet_id, {
    // The hold check above already reports payment holds stamped on the
    // booking; skip the duplicate message from the payment_hold flag.
    skipPaymentHold: booking.has_payment_hold || booking.has_booking_hold,
  });
  blockers.push(...flagIssues.blockers);
  warnings.push(...flagIssues.warnings);

  return {
    can_check_in: blockers.length === 0,
    blockers,
    warnings,
  };
};

// ============================================================================
// ROUTES - BOOKINGS
// ============================================================================

// Search households and pets for booking creation
app.get('/search-customers', async (c) => {
  try {
    const user = c.get('user') as AuthenticatedUser;
    
    if (!hasPermission(user.role, 'view')) {
      return c.json({ error: 'Access denied: insufficient permissions' }, 403);
    }
    
    const query = c.req.query('q') || '';
    const tenantId = user.tenantId;
    
    // Search households and pets from customer database
    const allHouseholds = await kv.getByPrefix(`customer:${tenantId}:household:`);
    const allPets = await kv.getByPrefix(`customer:${tenantId}:pet:`);
    const allContacts = await kv.getByPrefix(`customer:${tenantId}:contact:`);
    
    // Data is already parsed from KV store (JSONB)
    const households = allHouseholds;
    const pets = allPets;
    const contacts = allContacts;
    
    const searchLower = query.toLowerCase();
    const results: any[] = [];
    
    // Search households by name
    households.forEach((household: any) => {
      if (household?.name?.toLowerCase().includes(searchLower)) {
        const householdPets = pets.filter((p: any) => p.household_id === household.id);
        const householdContacts = contacts.filter((c: any) => c.household_id === household.id);
        
        results.push({
          type: 'household',
          household_id: household.id,
          household_name: household.name,
          pets: householdPets.map((p: any) => ({
            id: p.id,
            name: p.name,
            breed: p.breed,
            photo_url: storedPetPhoto(p),
            behaviour_notes: p.behaviour_notes,
            medical_notes: p.medical_notes,
            vaccination_status: p.vaccination_status || 'unknown',
          })),
          contacts: householdContacts,
        });
      }
    });
    
    // Search pets by name
    pets.forEach((pet: any) => {
      if (pet?.name?.toLowerCase().includes(searchLower)) {
        const household = households.find((h: any) => h.id === pet.household_id);
        if (household && !results.some((r: any) => r.household_id === household.id)) {
          const householdPets = pets.filter((p: any) => p.household_id === household.id);
          const householdContacts = contacts.filter((c: any) => c.household_id === household.id);
          
          results.push({
            type: 'pet',
            household_id: household.id,
            household_name: household.name,
            pets: householdPets.map((p: any) => ({
              id: p.id,
              name: p.name,
              breed: p.breed,
              photo_url: storedPetPhoto(p),
              behaviour_notes: p.behaviour_notes,
              medical_notes: p.medical_notes,
              vaccination_status: p.vaccination_status || 'unknown',
            })),
            contacts: householdContacts,
            matched_pet_id: pet.id,
          });
        }
      }
    });
    
    // Search contacts by name, email, or phone
    contacts.forEach((contact: any) => {
      const matchesName = contact?.name?.toLowerCase().includes(searchLower);
      const matchesEmail = contact?.email?.toLowerCase().includes(searchLower);
      const matchesPhone = contact?.phone?.includes(query);
      
      if (matchesName || matchesEmail || matchesPhone) {
        const household = households.find((h: any) => h.id === contact.household_id);
        if (household && !results.some((r: any) => r.household_id === household.id)) {
          const householdPets = pets.filter((p: any) => p.household_id === household.id);
          const householdContacts = contacts.filter((c: any) => c.household_id === household.id);
          
          results.push({
            type: 'contact',
            household_id: household.id,
            household_name: household.name,
            pets: householdPets.map((p: any) => ({
              id: p.id,
              name: p.name,
              breed: p.breed,
              photo_url: storedPetPhoto(p),
              behaviour_notes: p.behaviour_notes,
              medical_notes: p.medical_notes,
              vaccination_status: p.vaccination_status || 'unknown',
            })),
            contacts: householdContacts,
            matched_contact_id: contact.id,
          });
        }
      }
    });
    
    // Sign pet photos on the trimmed result set only (private bucket).
    const trimmed = results.slice(0, 20);
    for (const r of trimmed) {
      r.pets = await withSignedPetPhotos(r.pets);
    }

    // Attach each household's saved addresses (named transport pickup/
    // drop-off points) in one scan; records carry household_id. null (no
    // record yet) vs [] (deliberately cleared) is meaningful: clients derive
    // a "Home" fallback from the contact address only for null.
    const savedAddressRecords = await kv.getByPrefix(`customer_saved_addresses:${tenantId}:`);
    const savedByHousehold = new Map<string, unknown[]>(
      savedAddressRecords.map((rec: any) => [rec.household_id, rec.addresses ?? []])
    );
    for (const r of trimmed) {
      r.saved_addresses = savedByHousehold.get(r.household_id) ?? null;
    }

    return c.json(trimmed); // Limit to 20 results
  } catch (error: any) {
    return internalError(c, 'daycare.searchCustomers', error);
  }
});

// ============================================================================
// TRANSPORT INTEGRATION HELPERS
// ============================================================================

async function getActiveDriversForLocation(tenantId: string, locationId: string) {
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!serviceRoleKey) return [];
  
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    serviceRoleKey
  );
  
  try {
    const { data: { users }, error } = await supabase.auth.admin.listUsers();
    if (error || !users) return [];
    
    return users
      .filter(u => {
        const meta = u.user_metadata || {};
        return meta.isActive !== false && meta.templateId === 'tpl-driver' &&
          (meta.tenantId === tenantId || meta.tenant_id === tenantId) &&
          (!meta.locationIds || meta.locationIds.includes('all') || meta.locationIds.includes(locationId));
      })
      .map(u => ({
        user_id: u.id,
        name: `${u.user_metadata?.first_name || ''} ${u.user_metadata?.last_name || ''}`.trim() || u.email,
      }));
  } catch {
    return [];
  }
}

async function getActiveVehiclesForLocation(tenantId: string, locationId: string) {
  const allVehicles = await kv.getByPrefix(`transport_vehicle:${tenantId}:`);
  return allVehicles.filter((v: any) => v && v.is_active && (!v.location_id || v.location_id === locationId));
}

async function createTransportJobFromBooking(
  booking: DaycareBooking,
  direction: 'pickup' | 'dropoff',
  user: any,
  address: string,
  locationAddress: string,
) {
  const tenantId = user.tenantId;
  const jobId = generateId('tjob');
  const now = new Date().toISOString();
  
  const drivers = await getActiveDriversForLocation(tenantId, booking.location_id);
  const vehicles = await getActiveVehiclesForLocation(tenantId, booking.location_id);
  
  let assigned_driver_user_id: string | undefined;
  let assigned_vehicle_id: string | undefined;
  let requiresAssignment = false;
  
  if (drivers.length === 1) {
    assigned_driver_user_id = drivers[0].user_id;
    if (vehicles.length === 1) {
      assigned_vehicle_id = (vehicles[0] as any).id;
    }
  } else if (drivers.length > 1) {
    requiresAssignment = true;
  }
  
  const addressPickup = direction === 'pickup' ? address : locationAddress;
  const addressDropoff = direction === 'pickup' ? locationAddress : address;
  const timeWindow = direction === 'pickup'
    ? { start: booking.planned_start_time, end: booking.planned_start_time }
    : { start: booking.planned_end_time, end: booking.planned_end_time };
  
  const job = {
    id: jobId,
    tenant_id: tenantId,
    location_id: booking.location_id,
    service_date: booking.booking_date,
    direction,
    status: requiresAssignment ? 'pending_assignment' : 'scheduled',
    household_id: booking.household_id,
    pet_id: booking.pet_id,
    address_pickup: addressPickup,
    address_dropoff: addressDropoff,
    time_window_start: timeWindow.start || null,
    time_window_end: timeWindow.end || null,
    assigned_driver_user_id: assigned_driver_user_id || null,
    assigned_vehicle_id: assigned_vehicle_id || null,
    booking_id: booking.id,
    booking_type: 'daycare',
    notes: `Auto-created from daycare booking for ${booking.pet_name}`,
    requires_assignment: requiresAssignment,
    created_by: user.id,
    created_at: now,
    updated_at: now,
    pet_name: booking.pet_name,
    household_name: booking.household_name,
  };
  
  await kv.set(`transport_job:${tenantId}:${jobId}`, job);
  
  const dateIndexKey = `transport_job_index:${tenantId}:${booking.booking_date}`;
  const existingIndex = await kv.get(dateIndexKey) || [];
  await kv.set(dateIndexKey, [...(Array.isArray(existingIndex) ? existingIndex : []), jobId]);
  
  const locationIndexKey = `transport_job_location_index:${tenantId}:${booking.location_id}:${booking.booking_date}`;
  const existingLocationIndex = await kv.get(locationIndexKey) || [];
  await kv.set(locationIndexKey, [...(Array.isArray(existingLocationIndex) ? existingLocationIndex : []), jobId]);
  
  const eventId = generateId('tevt');
  await kv.set(`transport_event:${tenantId}:${eventId}`, {
    id: eventId,
    tenant_id: tenantId,
    transport_job_id: jobId,
    event_type: 'created',
    event_time: now,
    actor_user_id: user.id,
    metadata: { booking_id: booking.id, booking_type: 'daycare', auto_created: true, direction },
  });
  
  return jobId;
}

async function cancelTransportJobsForBooking(bookingId: string, tenantId: string, userId: string) {
  const allJobs = await kv.getByPrefix(`transport_job:${tenantId}:`);
  const linkedJobs = allJobs.filter((j: any) => j && j.booking_id === bookingId && j.status !== 'cancelled' && j.status !== 'completed');
  
  for (const job of linkedJobs) {
    const updatedJob = { ...(job as any), status: 'cancelled', updated_at: new Date().toISOString() };
    await kv.set(`transport_job:${tenantId}:${(job as any).id}`, updatedJob);
    
    const eventId = generateId('tevt');
    await kv.set(`transport_event:${tenantId}:${eventId}`, {
      id: eventId,
      tenant_id: tenantId,
      transport_job_id: (job as any).id,
      event_type: 'cancelled',
      event_time: new Date().toISOString(),
      actor_user_id: userId,
      metadata: { reason: 'Daycare booking cancelled', booking_id: bookingId },
    });
  }
  
  return linkedJobs.length;
}

// ============================================================================
// ROUTES - CAPACITY
// ============================================================================

app.get('/capacity', async (c) => {
  try {
    const user = c.get('user') as AuthenticatedUser;
    
    if (!hasPermission(user.role, 'view')) {
      return c.json({ error: 'Access denied' }, 403);
    }
    
    const locationId = c.req.query('location_id') || 'default';
    
    if (locationId !== 'default' && user.role !== 'admin' && !user.locationIds.includes(locationId)) {
      return c.json({ error: 'Access denied to this location' }, 403);
    }
    
    const today = new Date().toISOString().split('T')[0];
    const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
    
    const totalCapacity = await resolveLocationCapacity(locationId);
    
    const allBookings = await kv.getByPrefix('daycare:booking:');
    const todayBookings = allBookings.filter((b: any) => 
      b && typeof b === 'object' && (b.booking_date === today || b.date === today) && b.booking_status !== 'cancelled'
      && (locationId === 'default' || b.location_id === locationId)
    );
    const tomorrowBookings = allBookings.filter((b: any) => 
      b && typeof b === 'object' && (b.booking_date === tomorrow || b.date === tomorrow) && b.booking_status !== 'cancelled'
      && (locationId === 'default' || b.location_id === locationId)
    );
    
    const checkedIn = todayBookings.filter((b: any) => b.check_in_status === 'checked_in').length;
    const booked = todayBookings.length;
    const available = Math.max(0, totalCapacity - booked);
    const utilizationPercent = totalCapacity > 0 ? Math.round((booked / totalCapacity) * 100) : 0;
    const ragStatus = calculateRAGStatus(booked, totalCapacity);
    
    let status: 'available' | 'limited' | 'full' | 'overbooked' = 'available';
    if (booked > totalCapacity) status = 'overbooked';
    else if (available === 0) status = 'full';
    else if (ragStatus === 'red') status = 'full';
    else if (ragStatus === 'amber') status = 'limited';
    
    const tomorrowBooked = tomorrowBookings.length;
    const tomorrowAvailable = Math.max(0, totalCapacity - tomorrowBooked);
    const tomorrowRAG = calculateRAGStatus(tomorrowBooked, totalCapacity);
    
    return c.json({
      date: today,
      total_capacity: totalCapacity,
      booked,
      checked_in: checkedIn,
      available,
      utilization_percent: utilizationPercent,
      status,
      rag_status: ragStatus,
      tomorrow: {
        booked: tomorrowBooked,
        available: tomorrowAvailable,
        utilization_percent: totalCapacity > 0 ? Math.round((tomorrowBooked / totalCapacity) * 100) : 0,
        rag_status: tomorrowRAG,
      }
    });
  } catch (error: any) {
    return internalError(c, 'daycare.getCapacity', error);
  }
});

// Get bookings with filters
app.get('/bookings', async (c) => {
  try {
    const user = c.get('user') as AuthenticatedUser;
    
    if (!hasPermission(user.role, 'view')) {
      return c.json({ error: 'Access denied: insufficient permissions' }, 403);
    }
    
    const locationId = c.req.query('location_id');
    const date = c.req.query('date');
    const startDate = c.req.query('start_date');
    const endDate = c.req.query('end_date');
    const bookingStatus = c.req.query('booking_status');
    const checkInStatus = c.req.query('check_in_status');
    const petId = c.req.query('pet_id');
    const householdId = c.req.query('household_id');
    const search = c.req.query('search');
    
    const tenantId = user.tenantId;
    const bookingsData = await kv.getByPrefix('daycare:booking:');
    const existingHouseholds = await kv.getByPrefix(`customer:${tenantId}:household:`);
    const householdIds = new Set(existingHouseholds.map((h: any) => h.id).filter(Boolean));

    // Parse JSON strings into objects
    // Filter to only actual booking records (not index entries like daycare:booking:date:...)
    let bookings: DaycareBooking[] = bookingsData
      .map((b) => {
        try {
          const parsed = b;
          // Only include if it's a full booking object (has required fields)
          if (parsed && typeof parsed === 'object' && parsed.id && parsed.pet_name) {
            return parsed;
          }
          return null;
        } catch {
          return null;
        }
      })
      .filter((b: any) => b !== null)
      .filter((b: any) => householdIds.has(b.household_id));

    // Permission filtering
    bookings = filterByLocationPermission(bookings, user);
    
    // Apply filters
    if (locationId && locationId !== 'ALL') {
      bookings = bookings.filter(b => b.location_id === locationId);
    }
    
    if (date) {
      bookings = bookings.filter(b => b.booking_date === date);
    }
    
    if (startDate && endDate) {
      bookings = bookings.filter(b => b.booking_date >= startDate && b.booking_date <= endDate);
    }
    
    if (bookingStatus) {
      bookings = bookings.filter(b => b.booking_status === bookingStatus);
    }
    
    if (checkInStatus) {
      bookings = bookings.filter(b => b.check_in_status === checkInStatus);
    }
    
    if (petId) {
      bookings = bookings.filter(b => b.pet_id === petId);
    }
    
    if (householdId) {
      bookings = bookings.filter(b => b.household_id === householdId);
    }
    
    if (search) {
      const searchLower = search.toLowerCase();
      bookings = bookings.filter(b =>
        b.pet_name.toLowerCase().includes(searchLower) ||
        b.household_name.toLowerCase().includes(searchLower)
      );
    }
    
    // Sort by date and time
    bookings.sort((a, b) => {
      const dateCompare = (b.booking_date || '').localeCompare(a.booking_date || '');
      if (dateCompare !== 0) return dateCompare;
      return (b.planned_start_time || '').localeCompare(a.planned_start_time || '');
    });

    // Overwrite the creation-time behaviour/medical snapshot with LIVE state
    // (current pet notes + active caution flags) so the flag-filtered list,
    // card badges, and check-out warnings match the dashboard alert count.
    // The household prefix scan above already returned the :flag: records.
    const livePets = await kv.getByPrefix(`customer:${tenantId}:pet:`);
    bookings = annotateLiveAlertFlags(
      bookings,
      buildPetNotesMap(Array.isArray(livePets) ? livePets : []),
      groupFlagsByHousehold(existingHouseholds),
    );

    // pet_photo_url is stored as a storage path — sign per response.
    return c.json(await withSignedPetPhotos(bookings as unknown as Record<string, unknown>[], 'pet_photo_url'));
  } catch (error: any) {
    return internalError(c, 'daycare.listBookings', error);
  }
});

// Get single booking
app.get('/bookings/:id', async (c) => {
  try {
    const user = c.get('user') as AuthenticatedUser;
    const bookingId = c.req.param('id');
    
    if (!hasPermission(user.role, 'view')) {
      return c.json({ error: 'Access denied' }, 403);
    }
    
    const booking = await kv.get(`daycare:booking:${bookingId}`) as DaycareBooking | null;
    
    if (!booking) {
      return c.json({ error: 'Booking not found' }, 404);
    }
    
    // Permission check
    const filtered = filterByLocationPermission([booking], user);
    if (filtered.length === 0) {
      return c.json({ error: 'Access denied' }, 403);
    }

    return c.json({ ...booking, pet_photo_url: await signPetPhotoUrl(booking.pet_photo_url) });
  } catch (error: any) {
    return internalError(c, 'daycare.getBooking', error);
  }
});

// The shared creation core: everything a daycare booking needs regardless of
// where it comes from — the staff dialog (POST /bookings) or the standing-
// schedule generator (daycare_standing_routes.tsx). Both paths get identical
// validation, duplicate/capacity guards, house-dog zeroing, membership
// coverage and event logging, so a generated occurrence bills and counts
// exactly like a manual booking. Permission checks stay in the routes.
export interface CreateBookingInput {
  household_id: string;
  pet_id: string;
  location_id: string;
  location_name?: string;
  service_id: string;
  service_name?: string;
  service_type?: string;
  booking_date: string;
  planned_start_time?: string;
  planned_end_time?: string;
  customer_notes?: string;
  requires_transport?: boolean;
  booking_group_id?: string;
  standing_booking_id?: string;
}

export type CreateBookingResult =
  | { ok: true; booking: DaycareBooking }
  | {
      ok: false;
      status: number;
      error: string;
      code?: 'duplicate_booking' | 'capacity_full';
      existingBookingId?: string;
    };

export async function createBookingCore(
  user: AuthenticatedUser,
  input: CreateBookingInput,
  opts: { allowCapacityOverride: boolean },
): Promise<CreateBookingResult> {
  const {
    household_id,
    pet_id,
    location_id,
    location_name,
    service_id,
    service_name,
    service_type,
    booking_date,
    planned_start_time,
    planned_end_time,
    customer_notes,
    requires_transport,
    booking_group_id,
    standing_booking_id,
  } = input;

  // Validation
  if (!household_id || !pet_id || !location_id || !service_id || !booking_date) {
    return { ok: false, status: 400, error: 'Missing required fields' };
  }

  // Validate and fetch pet from customer database
  const tenantId = user.tenantId;
    const petData = await kv.getByPrefix(`customer:${tenantId}:pet:`);
    const petRecord = petData.find((p) => {
      const pet = p;
      return pet.id === pet_id;
    });
    
    if (!petRecord) {
      return { ok: false, status: 404, error: 'Pet not found in customer database' };
    }

    const pet = petRecord;

    // Validate pet belongs to household
    if (pet.household_id !== household_id) {
      return { ok: false, status: 400, error: 'Pet does not belong to selected household' };
    }
    
    // Fetch household data
    const householdData = await kv.getByPrefix(`customer:${tenantId}:household:`);
    const householdRecord = householdData.find((h) => {
      const household = h;
      return household.id === household_id;
    });
    
    if (!householdRecord) {
      return { ok: false, status: 404, error: 'Household not found' };
    }
    
    const household = householdRecord;

    // Same-day duplicate guard: this pet can't already have an active booking
    // at this location/date with an overlapping time window (AM + PM is fine).
    const allBookingRecords = await kv.getByPrefix('daycare:booking:');
    const activeBookings = allBookingRecords.filter(
      (b: any) => b && typeof b === 'object' && b.id && b.pet_name,
    );
    const duplicate = findDuplicateBooking(activeBookings, {
      pet_id,
      location_id,
      booking_date,
      planned_start_time,
      planned_end_time,
    });
    if (duplicate) {
      return {
        ok: false,
        status: 409,
        error: `${pet.name} already has a booking at this location on ${booking_date}.`,
        code: 'duplicate_booking',
        existingBookingId: (duplicate as { id?: string }).id,
      };
    }

    const capacity = await getCapacity(location_id, booking_date);
    const ragStatus = calculateRAGStatus(capacity.current_bookings, capacity.max_capacity);

    if (capacity.is_full && !opts.allowCapacityOverride) {
      return {
        ok: false,
        status: 400,
        error: 'Capacity full for selected date. Manager override required.',
        code: 'capacity_full',
      };
    }
    if (ragStatus === 'red' && !capacity.is_full) {
      // Allow but will be flagged
    }
    
    // Get pet validation status from pet profile and household
    const vaccination_status = pet.vaccination_status || 'unknown';
    
    // Get waiver status from household documents
    const householdDocs = await kv.getByPrefix(`customer:${tenantId}:document:`);
    const waiverDoc = householdDocs.find((d) => {
      const doc = d;
      return doc.household_id === household_id && doc.document_type === 'waiver';
    });
    
    let waiver_status: 'valid' | 'expiring_soon' | 'expired' | 'missing' = 'missing';
    if (waiverDoc) {
      const doc = waiverDoc;
      if (doc.expiry_date) {
        const expiryDate = new Date(doc.expiry_date);
        const now = new Date();
        const daysDiff = Math.floor((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        
        if (daysDiff < 0) {
          waiver_status = 'expired';
        } else if (daysDiff < 30) {
          waiver_status = 'expiring_soon';
        } else {
          waiver_status = 'valid';
        }
      }
    }
    
    // Get flags from pet profile
    const has_behaviour_flag = !!pet.behaviour_notes;
    const has_medical_flag = !!pet.medical_notes;
    const behaviour_notes = pet.behaviour_notes;
    const medical_notes = pet.medical_notes;
    
    // Get holds from household
    const has_payment_hold = household.payment_hold === true;
    const has_booking_hold = household.booking_hold === true;
    const hold_reason = household.hold_reason;
    
    // Get pricing from Services & Pricing
    const service = await kv.get(`pricing:service:${service_id}`) as any;
    let base_price_locked = service?.base_price || 99.00;
    const tax_rate = service?.tax_rate || 0.077; // Swiss VAT
    let total_price = base_price_locked * (1 + tax_rate);

    // House dogs occupy the capacity slot below like any booking, but their
    // records are stamped at zero so no charge can ever derive from them.
    const petNonBillable = isNonBillablePet(pet);
    if (petNonBillable) {
      base_price_locked = 0;
      total_price = 0;
    }

    // Membership billing — client-requested, server-verified. Staff choose
    // "Membership" vs "PAYG" billing in the dialog (a customer may want to
    // save credits), and that intent arrives as service_type 'membership'.
    // The server never trusts the claim: it resolves the household's active
    // membership from its own tenant-scoped data, checks the plan actually
    // covers this session (sessionTypeForServiceId + membershipCoverage),
    // and only then prices the booking at zero and draws a credit (with a
    // ledger entry). An uncovered claim (no membership, wrong session type,
    // no credits left — e.g. mid multi-day run) falls back to PAYG at full
    // price rather than failing; the price on the record is what's owed.
    const sessionType = sessionTypeForServiceId(service_id);
    let effective_service_type = service_type;
    let membership_id: string | undefined;
    let membership_credits_used: number | undefined;
    // A house dog is already free — never draw membership credits for it,
    // and record the honest session type instead of 'membership'.
    if (service_type === 'membership' && petNonBillable) {
      effective_service_type = sessionType ?? 'full_day';
    }
    if (service_type === 'membership' && !petNonBillable) {
      // Not covered after all → the honest service type for the record.
      effective_service_type = sessionType ?? 'full_day';
      // Applies any due lazy renewal first (an exhausted membership whose
      // billing date has passed gets topped up and covers this booking).
      const activeMembership = await activeMembershipForHousehold(tenantId, household_id);
      if (activeMembership) {
        const coverage = membershipCoverage(activeMembership, sessionType);
        if (coverage.covered && coverage.creditsNeeded > 0) {
          const drawn = consumeCredits(activeMembership, coverage.creditsNeeded, new Date());
          if (typeof drawn === 'string') {
            // Coverage said yes but the draw failed (raced with another
            // booking) — fall back to PAYG.
            console.log(`Membership ${activeMembership.id} draw failed (${drawn}); booking priced PAYG`);
          } else {
            await kv.set(`customer_membership:${tenantId}:${drawn.id}`, drawn);
            membership_id = drawn.id;
            membership_credits_used = coverage.creditsNeeded;
          }
        } else if (coverage.covered) {
          membership_id = activeMembership.id;
          membership_credits_used = 0;
        }
      }
    }
    if (membership_id) {
      base_price_locked = 0;
      total_price = 0;
      effective_service_type = 'membership';
    }

    const bookingId = generateId('daybook');
    const now = new Date().toISOString();
    
    const booking: DaycareBooking = {
      id: bookingId,
      tenant_id: tenantId,
      household_id,
      household_name: household.name,
      pet_id,
      pet_name: pet.name,
      // Storage path (or legacy URL) — read endpoints sign it per response.
      pet_photo_url: storedPetPhoto(pet) ?? undefined,
      location_id,
      location_name: location_name || '',
      service_id,
      service_name: service_name || '',
      service_type: effective_service_type as DaycareBooking['service_type'],
      booking_date,
      booking_group_id: typeof booking_group_id === 'string' ? booking_group_id : undefined,
      standing_booking_id: typeof standing_booking_id === 'string' ? standing_booking_id : undefined,
      planned_start_time,
      planned_end_time,
      booking_status: 'confirmed',
      check_in_status: 'not_checked_in',
      customer_notes,
      capacity_slot: capacity.current_bookings + 1,
      has_behaviour_flag,
      has_medical_flag,
      behaviour_notes,
      medical_notes,
      vaccination_status,
      waiver_status,
      has_booking_hold,
      has_payment_hold,
      hold_reason,
      base_price_locked,
      tax_rate,
      total_price,
      currency: 'CHF',
      // House-dog marker on the record itself, so lists/exports can show WHY
      // there is no charge without re-fetching the pet.
      non_billable: petNonBillable,
      membership_id,
      membership_credits_used,
      billing_line_item_ids: [],
      requires_transport: requires_transport === true,
      created_by_id: user.id,
      created_by_name: user.name || user.email || '',
      created_at: now,
      updated_at: now,
    };
    
    // Store booking
    await kv.set(`daycare:booking:${bookingId}`, booking);
    if (membership_id && (membership_credits_used ?? 0) > 0) {
      const usageId = crypto.randomUUID();
      await kv.set(`membership_usage:${tenantId}:${membership_id}:${usageId}`, {
        id: usageId,
        customer_package_id: membership_id,
        booking_id: bookingId,
        pet_id,
        credits_used: membership_credits_used,
        created_at: now,
        created_by: user.id,
      });
    }
    await kv.set(`daycare:booking:date:${location_id}:${booking_date}:${bookingId}`, bookingId);
    await kv.set(`daycare:booking:pet:${pet_id}:${bookingId}`, bookingId);
    await kv.set(`daycare:booking:household:${household_id}:${bookingId}`, bookingId);
    
    capacity.current_bookings += 1;
    capacity.available_slots = capacity.max_capacity - capacity.current_bookings;
    capacity.is_full = capacity.available_slots <= 0;
    capacity.rag_status = calculateRAGStatus(capacity.current_bookings, capacity.max_capacity);
    await kv.set(`daycare:capacity:${location_id}:${booking_date}`, capacity);
    
    await logDaycareEvent({
      booking_id: bookingId,
      location_id,
      event_type: 'booking_created',
      actor_id: user.id,
      actor_name: user.name,
      description: `Booking created for ${pet.name} (${service_type}) on ${booking_date}`,
      metadata: { service_type, booking_date, pet_name: pet.name, household_name: household.name, rag_status: capacity.rag_status },
    });

  return { ok: true, booking };
}

// Create booking
app.post('/bookings', async (c) => {
  try {
    const user = c.get('user') as AuthenticatedUser;

    if (!hasPermission(user.role, 'create_booking')) {
      return c.json({ error: 'Access denied: insufficient permissions to create bookings' }, 403);
    }

    const body = await c.req.json();

    const result = await createBookingCore(user, body as CreateBookingInput, {
      allowCapacityOverride: hasPermission(user.role, 'override_rules'),
    });
    if (!result.ok) {
      return c.json(
        {
          error: result.error,
          ...(result.code ? { code: result.code } : {}),
          ...(result.existingBookingId ? { existingBookingId: result.existingBookingId } : {}),
        },
        result.status as 400,
      );
    }
    const booking = result.booking;

    if (booking.requires_transport) {
      const pickupAddress = body.transport_pickup_address || '';
      const dropoffAddress = body.transport_dropoff_address || '';
      const locationAddr = body.location_address || booking.location_name || '';

      try {
        if (pickupAddress) {
          const pickupJobId = await createTransportJobFromBooking(booking, 'pickup', user, pickupAddress, locationAddr);
          booking.transport_pickup_id = pickupJobId;
        }
        if (dropoffAddress) {
          const dropoffJobId = await createTransportJobFromBooking(booking, 'dropoff', user, dropoffAddress, locationAddr);
          booking.transport_dropoff_id = dropoffJobId;
        }
        if (booking.transport_pickup_id || booking.transport_dropoff_id) {
          await kv.set(`daycare:booking:${booking.id}`, booking);
        }
      } catch (transportError) {
        console.error('Transport job creation failed (non-blocking):', transportError);
      }
    }

    return c.json({ ...booking, pet_photo_url: await signPetPhotoUrl(booking.pet_photo_url) }, 201);
  } catch (error: any) {
    return internalError(c, 'daycare.createBooking', error);
  }
});

// Shared cancellation core — used by POST /bookings/:id/cancel and by the
// standing-schedule skip/override flow (cancelling one generated occurrence
// must do the same credit-restore/capacity/event bookkeeping as a manual
// cancellation). Permission checks stay in the routes.
export type CancelBookingResult =
  | { ok: true; booking: DaycareBooking }
  | { ok: false; status: number; error: string };

export async function cancelBookingCore(
  user: AuthenticatedUser,
  bookingId: string,
  reason: string | undefined,
): Promise<CancelBookingResult> {
  const booking = await kv.get(`daycare:booking:${bookingId}`) as DaycareBooking | null;

  if (!booking) {
    return { ok: false, status: 404, error: 'Booking not found' };
  }

  if (booking.booking_status === 'cancelled' || booking.booking_status === 'completed') {
    return { ok: false, status: 400, error: 'Cannot cancel this booking' };
  }

    // Update booking
    booking.booking_status = 'cancelled';
    booking.cancelled_at = new Date().toISOString();
    booking.cancelled_by_id = user.id;
    booking.cancelled_by_name = user.name;
    booking.cancellation_reason = reason;
    booking.updated_at = new Date().toISOString();

    await kv.set(`daycare:booking:${bookingId}`, booking);

    // Hand back the membership credit this booking drew. The ledger gets a
    // compensating entry (negative credits) rather than deleting the original.
    if (booking.membership_id && (booking.membership_credits_used ?? 0) > 0) {
      const tenantId = user.tenantId;
      const membershipKey = `customer_membership:${tenantId}:${booking.membership_id}`;
      const membership = (await kv.get(membershipKey)) as CustomerMembership | undefined;
      if (membership) {
        const restored = restoreCredits(
          membership,
          booking.membership_credits_used ?? 0,
          new Date(),
        );
        await kv.set(membershipKey, restored);
        const usageId = crypto.randomUUID();
        await kv.set(`membership_usage:${tenantId}:${booking.membership_id}:${usageId}`, {
          id: usageId,
          customer_package_id: booking.membership_id,
          booking_id: bookingId,
          pet_id: booking.pet_id,
          credits_used: -(booking.membership_credits_used ?? 0),
          created_at: new Date().toISOString(),
          created_by: user.id,
        });
      }
    }

    const capacity = await getCapacity(booking.location_id, booking.booking_date);
    capacity.current_bookings = Math.max(0, capacity.current_bookings - 1);
    capacity.available_slots = capacity.max_capacity - capacity.current_bookings;
    capacity.is_full = false;
    capacity.rag_status = calculateRAGStatus(capacity.current_bookings, capacity.max_capacity);
    await kv.set(`daycare:capacity:${booking.location_id}:${booking.booking_date}`, capacity);
    
    await logDaycareEvent({
      booking_id: bookingId,
      location_id: booking.location_id,
      event_type: 'booking_cancelled',
      actor_id: user.id,
      actor_name: user.name,
      description: `Booking cancelled for ${booking.pet_name}: ${reason || 'No reason given'}`,
      metadata: { reason, pet_name: booking.pet_name },
    });

  if (booking.requires_transport) {
    try {
      const cancelledCount = await cancelTransportJobsForBooking(bookingId, user.tenantId, user.id);
      if (cancelledCount > 0) {
        console.log(`[Daycare] Cancelled ${cancelledCount} transport job(s) for booking ${bookingId}`);
      }
    } catch (transportError) {
      console.error('Transport job cancellation failed (non-blocking):', transportError);
    }
  }

  return { ok: true, booking };
}

// Cancel booking
app.post('/bookings/:id/cancel', async (c) => {
  try {
    const user = c.get('user') as AuthenticatedUser;
    const bookingId = c.req.param('id');

    if (!hasPermission(user.role, 'cancel')) {
      return c.json({ error: 'Access denied' }, 403);
    }

    const body = await c.req.json();
    const { reason } = body;

    const result = await cancelBookingCore(user, bookingId, reason);
    if (!result.ok) {
      return c.json({ error: result.error }, result.status as 400);
    }

    return c.json({ ...result.booking, pet_photo_url: await signPetPhotoUrl(result.booking.pet_photo_url) });
  } catch (error: any) {
    return internalError(c, 'daycare.cancelBooking', error);
  }
});

// ============================================================================
// ROUTES - CHECK-IN
// ============================================================================

// Validate check-in
app.post('/bookings/:id/validate-checkin', async (c) => {
  try {
    const user = c.get('user') as AuthenticatedUser;
    const bookingId = c.req.param('id');
    const tenantId = user.tenantId; // Get tenant ID from current user
    
    console.log('=== VALIDATE CHECK-IN DEBUG ===');
    console.log('Booking ID:', bookingId);
    console.log('User:', user.id, user.name);
    console.log('Tenant ID:', tenantId);
    
    const booking = await kv.get(`daycare:booking:${bookingId}`) as DaycareBooking | null;
    
    if (!booking) {
      return c.json({ error: 'Booking not found' }, 404);
    }
    
    console.log('Booking found:', {
      id: booking.id,
      household_id: booking.household_id,
      pet_name: booking.pet_name,
      household_name: booking.household_name
    });
    
    const validation = await validateCheckIn(booking, tenantId); // Pass tenantId to validation
    
    console.log('Validation complete:', {
      can_check_in: validation.can_check_in,
      blockers_count: validation.blockers.length,
      warnings_count: validation.warnings.length
    });
    console.log('=== END VALIDATE CHECK-IN DEBUG ===');
    
    return c.json(validation);
  } catch (error: any) {
    return internalError(c, 'daycare.validateCheckIn', error);
  }
});

// Check-in
app.post('/bookings/:id/checkin', async (c) => {
  try {
    const user = c.get('user') as AuthenticatedUser;
    const bookingId = c.req.param('id');
    const tenantId = user.tenantId; // Get tenant ID from current user
    
    if (!hasPermission(user.role, 'check_in')) {
      return c.json({ error: 'Access denied' }, 403);
    }
    
    const booking = await kv.get(`daycare:booking:${bookingId}`) as DaycareBooking | null;
    
    if (!booking) {
      return c.json({ error: 'Booking not found' }, 404);
    }
    
    if (booking.check_in_status !== 'not_checked_in') {
      return c.json({ error: 'Booking already checked in' }, 400);
    }
    
    // Validate
    const validation = await validateCheckIn(booking, tenantId); // Pass tenantId
    if (!validation.can_check_in) {
      return c.json({ error: 'Check-in blocked', validation }, 400);
    }
    
    const body = await c.req.json();
    const { handover_notes, warnings_acknowledged } = body;
    
    // Require warnings acknowledgement if present
    if (validation.warnings.length > 0 && !warnings_acknowledged) {
      return c.json({ error: 'Must acknowledge warnings', validation }, 400);
    }
    
    const now = new Date().toISOString();

    // Guard: one active attendance per pet per day. The existing check only
    // looks at THIS booking's status, so a pet with several bookings (multi-
    // day, or duplicates) could be "currently in daycare" several times at
    // once — the live board then shows the same dog stacked up. Active
    // records from PREVIOUS days are forgotten check-outs; they don't block
    // today's check-in (the live board surfaces them as missed check-outs
    // for staff to clear).
    const todayStr = now.slice(0, 10);
    const activeIds = ((await kv.getByPrefix('daycare:attendance:active:')) as string[] | null) || [];
    for (const rawId of activeIds) {
      let activeId = rawId;
      try { activeId = JSON.parse(rawId); } catch { /* already a plain string */ }
      const active = await kv.get(`daycare:attendance:${activeId}`) as AttendanceRecord | null;
      if (active && active.pet_id === booking.pet_id && active.check_in_time?.slice(0, 10) === todayStr) {
        return c.json({
          error: `${booking.pet_name} is already checked in today — check them out first if this is a re-arrival`,
        }, 409);
      }
    }

    // Update booking
    booking.check_in_status = 'checked_in';
    booking.actual_check_in_time = now;
    booking.checked_in_by_id = user.id;
    booking.checked_in_by_name = user.name;
    booking.handover_notes = handover_notes;
    booking.updated_at = now;

    await kv.set(`daycare:booking:${bookingId}`, booking);

    // Create attendance record
    const attendanceId = generateId('attend');
    const attendance: AttendanceRecord = {
      id: attendanceId,
      booking_id: bookingId,
      pet_id: booking.pet_id,
      pet_name: booking.pet_name,
      pet_photo_url: booking.pet_photo_url,
      household_id: booking.household_id,
      household_name: booking.household_name,
      location_id: booking.location_id,
      check_in_time: now,
      checked_in_by_id: user.id,
      checked_in_by_name: user.name,
      has_behaviour_flag: booking.has_behaviour_flag,
      has_medical_flag: booking.has_medical_flag,
      behaviour_notes: booking.behaviour_notes,
      medical_notes: booking.medical_notes,
      // Handlers work off the live attendance board — the drop-off handover
      // must be visible there, not only in the event timeline.
      handover_notes,
      notes: [],
      status: 'in_daycare',
    };
    
    await kv.set(`daycare:attendance:${attendanceId}`, attendance);
    await kv.set(`daycare:attendance:active:${booking.location_id}:${attendanceId}`, attendanceId);
    await kv.set(`daycare:attendance:booking:${bookingId}`, attendanceId);
    
    const capacity = await getCapacity(booking.location_id, booking.booking_date);
    capacity.current_checked_in += 1;
    await kv.set(`daycare:capacity:${booking.location_id}:${booking.booking_date}`, capacity);
    
    await logDaycareEvent({
      booking_id: bookingId,
      location_id: booking.location_id,
      event_type: 'checked_in',
      actor_id: user.id,
      actor_name: user.name,
      description: `${booking.pet_name} checked in by ${user.name}`,
      metadata: { pet_name: booking.pet_name, handover_notes, warnings_acknowledged },
    });

    // Owner-facing feed entry ("Rex arrived 8:42"). Best-effort: the feed
    // must never fail a check-in.
    try {
      await recordPetUpdate(buildPetUpdate({
        tenantId: user.tenantId,
        petId: booking.pet_id,
        petName: booking.pet_name,
        type: 'checked_in',
        bookingId,
        householdId: booking.household_id,
        createdById: user.id,
        createdByName: user.name,
      }));
    } catch (feedError) {
      console.error('[daycare.checkIn] pet_update write failed (non-fatal):', feedError);
    }

    const petPhotoUrl = await signPetPhotoUrl(booking.pet_photo_url);
    return c.json({
      booking: { ...booking, pet_photo_url: petPhotoUrl },
      attendance: { ...attendance, pet_photo_url: petPhotoUrl },
    });
  } catch (error: any) {
    return internalError(c, 'daycare.checkIn', error);
  }
});

// ============================================================================
// ROUTES - CHECK-OUT
// ============================================================================

// Check-out
app.post('/bookings/:id/checkout', async (c) => {
  try {
    const user = c.get('user') as AuthenticatedUser;
    const bookingId = c.req.param('id');
    
    if (!hasPermission(user.role, 'check_out')) {
      return c.json({ error: 'Access denied' }, 403);
    }
    
    const booking = await kv.get(`daycare:booking:${bookingId}`) as DaycareBooking | null;
    
    if (!booking) {
      return c.json({ error: 'Booking not found' }, 404);
    }
    
    if (booking.check_in_status !== 'checked_in') {
      return c.json({ error: 'Booking not checked in' }, 400);
    }
    
    const body = await c.req.json();
    const { checkout_notes, checkout_time } = body;
    
    // Use provided checkout_time or default to now
    const checkoutTime = checkout_time || new Date().toISOString();
    const now = new Date().toISOString();
    
    // Validate checkout_time is not before check-in time
    if (booking.actual_check_in_time && checkout_time) {
      const checkinDate = new Date(booking.actual_check_in_time);
      const checkoutDate = new Date(checkout_time);
      if (checkoutDate < checkinDate) {
        return c.json({ error: 'Check-out time cannot be before check-in time' }, 400);
      }
    }
    
    // Update booking
    booking.check_in_status = 'checked_out';
    booking.actual_check_out_time = checkoutTime;
    booking.checked_out_by_id = user.id;
    booking.checked_out_by_name = user.name;
    booking.checkout_notes = checkout_notes;
    booking.booking_status = 'completed';
    booking.updated_at = now;
    
    await kv.set(`daycare:booking:${bookingId}`, booking);
    
    // Update attendance
    const attendanceId = await kv.get(`daycare:attendance:booking:${bookingId}`) as string;
    if (attendanceId) {
      const attendance = await kv.get(`daycare:attendance:${attendanceId}`) as AttendanceRecord | null;
      if (attendance) {
        attendance.check_out_time = checkoutTime; // Use custom checkout time
        attendance.checked_out_by_id = user.id;
        attendance.checked_out_by_name = user.name;
        attendance.status = 'checked_out';
        
        // Calculate duration using the custom checkout time
        const checkInTime = new Date(attendance.check_in_time);
        const checkOutTime = new Date(checkoutTime);
        attendance.duration_minutes = Math.floor((checkOutTime.getTime() - checkInTime.getTime()) / 60000);
        
        await kv.set(`daycare:attendance:${attendanceId}`, attendance);
        await kv.del(`daycare:attendance:active:${booking.location_id}:${attendanceId}`);
      }
    }
    
    const capacity = await getCapacity(booking.location_id, booking.booking_date);
    capacity.current_checked_in = Math.max(0, capacity.current_checked_in - 1);
    await kv.set(`daycare:capacity:${booking.location_id}:${booking.booking_date}`, capacity);
    
    await logDaycareEvent({
      booking_id: bookingId,
      location_id: booking.location_id,
      event_type: 'checked_out',
      actor_id: user.id,
      actor_name: user.name,
      description: `${booking.pet_name} checked out by ${user.name}`,
      metadata: { pet_name: booking.pet_name, checkout_notes, checkout_time: checkoutTime },
    });

    // Owner-facing feed entry; carries the check-out notes (incl. the
    // "Mood: …" line the staff dialog composes). Best-effort, never fatal.
    try {
      await recordPetUpdate(buildPetUpdate({
        tenantId: user.tenantId,
        petId: booking.pet_id,
        petName: booking.pet_name,
        type: 'checked_out',
        text: typeof checkout_notes === 'string' ? checkout_notes : undefined,
        bookingId,
        householdId: booking.household_id,
        createdById: user.id,
        createdByName: user.name,
        at: new Date(checkoutTime),
      }));
    } catch (feedError) {
      console.error('[daycare.checkOut] pet_update write failed (non-fatal):', feedError);
    }

    return c.json({ ...booking, pet_photo_url: await signPetPhotoUrl(booking.pet_photo_url) });
  } catch (error: any) {
    return internalError(c, 'daycare.checkOut', error);
  }
});

// ============================================================================
// ROUTES - ATTENDANCE
// ============================================================================

// Get active attendance (currently in daycare)
// Get today's attendance (for Quick Notes modal)
app.get('/attendance/today', async (c) => {
  try {
    const user = c.get('user') as AuthenticatedUser;
    
    if (!hasPermission(user.role, 'view')) {
      return c.json({ error: 'Access denied' }, 403);
    }
    
    const locationId = c.req.query('location_id');
    const status = c.req.query('status'); // 'checked_in' to filter only checked-in dogs
    const today = new Date().toISOString().split('T')[0];
    
    // Get today's bookings that are checked in
    const allBookings = await kv.getByPrefix('daycare:booking:');
    let todayBookings = allBookings.filter((b: any) => 
      b && typeof b === 'object' && 
      (b.booking_date === today || b.date === today)
    );
    
    // Filter by status if provided
    if (status === 'checked_in') {
      todayBookings = todayBookings.filter((b: any) => b.check_in_status === 'checked_in');
    }
    
    // Filter by location if provided
    if (locationId && locationId !== 'ALL') {
      todayBookings = todayBookings.filter((b: any) => b.location_id === locationId);
    }
    
    const attendance = todayBookings.map((b: any) => ({
      id: b.id,
      pet_id: b.pet_id,
      pet_name: b.pet_name,
      breed: b.breed || '',
      customer_name: b.customer_name || 'Unknown',
      household_id: b.household_id,
      check_in_time: b.actual_check_in_time || b.planned_start_time,
      check_in_status: b.check_in_status,
      location_id: b.location_id,
      source: 'daycare',
    }));
    
    const includeOvernights = c.req.query('include_overnights') === 'true';
    if (includeOvernights) {
      try {
        const tenantId = user.tenantId;
        const overnightReservations = await kv.getByPrefix(`overnight:${tenantId}:reservation:`);
        const overnightDogs = overnightReservations.filter((r: any) => {
          if (!r || typeof r !== 'object') return false;
          if (r.status !== 'checked_in' && r.status !== 'in_stay') return false;
          if (r.includeInDaycareAttendance === false) return false;
          if (locationId && locationId !== 'ALL' && r.locationId !== locationId) return false;
          const start = new Date(r.startDate);
          const end = new Date(r.endDate);
          const todayDate = new Date(today);
          return todayDate >= start && todayDate <= end;
        });
        
        for (const res of overnightDogs) {
          const r = res as any;
          if (!attendance.some((a: any) => a.pet_id === r.petId)) {
            attendance.push({
              id: r.id,
              pet_id: r.petId,
              pet_name: r.petName || 'Unknown',
              breed: '',
              customer_name: r.customerName || 'Unknown',
              household_id: r.householdId,
              check_in_time: r.actualCheckInTime || r.checkInWindow?.start || '',
              check_in_status: 'checked_in',
              location_id: r.locationId,
              source: 'overnight',
            });
          }
        }
      } catch (overnightError) {
        console.error('Failed to include overnight dogs in attendance (non-blocking):', overnightError);
      }
    }
    
    return c.json({ attendance });
  } catch (error: any) {
    return internalError(c, 'daycare.todayAttendance', error);
  }
});

app.get('/attendance/active', async (c) => {
  try {
    const user = c.get('user') as AuthenticatedUser;
    
    if (!hasPermission(user.role, 'view')) {
      return c.json({ error: 'Access denied' }, 403);
    }
    
    const locationId = c.req.query('location_id');
    
    let attendance: AttendanceRecord[] = [];
    
    if (locationId && locationId !== 'ALL') {
      // getByPrefix returns attendance IDs, not the full records
      const attendanceIds = (await kv.getByPrefix(`daycare:attendance:active:${locationId}:`) as string[] | null) || [];
      // Parse each ID and fetch the full attendance record
      const parsedIds = attendanceIds.map((idStr: string) => {
        try {
          return JSON.parse(idStr); // This is the attendance ID stored as value
        } catch {
          return idStr; // If it's already a plain string
        }
      });
      // Fetch full attendance records
      attendance = await Promise.all(
        parsedIds.map(async (id) => await kv.get(`daycare:attendance:${id}`) as AttendanceRecord)
      );
    } else {
      // getByPrefix returns attendance IDs, not the full records
      const attendanceIds = (await kv.getByPrefix('daycare:attendance:active:') as string[] | null) || [];
      // Parse each ID and fetch the full attendance record
      const parsedIds = attendanceIds.map((idStr: string) => {
        try {
          return JSON.parse(idStr); // This is the attendance ID stored as value
        } catch {
          return idStr; // If it's already a plain string
        }
      });
      // Fetch full attendance records
      attendance = await Promise.all(
        parsedIds.map(async (id) => await kv.get(`daycare:attendance:${id}`) as AttendanceRecord)
      );
    }
    
    attendance = attendance.filter(Boolean);
    attendance = filterByLocationPermission(attendance, user);

    // Sort by check-in time
    attendance.sort((a, b) => new Date(b.check_in_time).getTime() - new Date(a.check_in_time).getTime());

    // A daycare dog "currently in" since a PREVIOUS calendar day is a missed
    // check-out, not live attendance — without this flag they pile up on the
    // board forever (dogs showing 140h+ in daycare) and inflate the count.
    // Flagged rather than filtered so the UI can surface them for staff to
    // check out properly (checkout owns the capacity/billing bookkeeping).
    const todayStr = new Date().toISOString().slice(0, 10);
    const annotated = attendance.map((a) => ({
      ...a,
      stale: (a.check_in_time ?? '').slice(0, 10) < todayStr,
    }));

    // pet_photo_url on attendance records is a storage path — sign per response.
    return c.json(await withSignedPetPhotos(annotated as unknown as Record<string, unknown>[], 'pet_photo_url'));
  } catch (error: any) {
    return internalError(c, 'daycare.activeAttendance', error);
  }
});

// ============================================================================
// ROUTES - STATS & DASHBOARD
// ============================================================================

app.get('/stats', async (c) => {
  try {
    const user = c.get('user') as AuthenticatedUser;
    
    if (!hasPermission(user.role, 'view')) {
      return c.json({ error: 'Access denied' }, 403);
    }
    
    const locationId = c.req.query('location_id');
    const date = c.req.query('date') || new Date().toISOString().split('T')[0];
    
    const bookingsData = await kv.getByPrefix('daycare:booking:');
    let bookings: DaycareBooking[] = Array.isArray(bookingsData) ? bookingsData : [];
    bookings = filterByLocationPermission(bookings, user);
    
    if (locationId && locationId !== 'ALL') {
      bookings = bookings.filter(b => b.location_id === locationId);
    }
    
    const todayBookings = bookings.filter(b => b.booking_date === date);
    const activeBookings = todayBookings.filter(b => b.booking_status !== 'cancelled');
    
    // Specific location: its per-day capacity record. 'ALL': the summed
    // capacity of every location the user can see — the dashboard's
    // capacity card must describe the whole operation, not show 0/0.
    const capacity = locationId && locationId !== 'ALL'
      ? await getCapacity(locationId, date)
      : await (async () => {
          const max = await sumVisibleLocationCapacity(user);
          return { max_capacity: max, current_checked_in: 0, available_slots: max, rag_status: 'green' };
        })();
    
    const ragStatus = capacity.max_capacity > 0 
      ? calculateRAGStatus(activeBookings.length, capacity.max_capacity) 
      : 'green';
    
    const now = new Date();
    const twoHoursFromNow = new Date(now.getTime() + 2 * 60 * 60 * 1000);

    // Behaviour/medical alerts, recomputed from LIVE data (pet notes + active
    // operational flags) rather than the snapshot stamped on the booking at
    // creation — the same sources the check-in screen reads. Without this a dog
    // booked in with a behaviour_caution flag (or notes added after booking)
    // never surfaces on the dashboard alert card. Scanned once here, not per
    // booking, to keep the hot dashboard path to two prefix reads.
    const livePets = await kv.getByPrefix(`customer:${user.tenantId}:pet:`);
    // The household prefix scan also returns the nested :flag: records — one
    // read covers every household's flags.
    const householdRecords = await kv.getByPrefix(`customer:${user.tenantId}:household:`);
    const { behaviour_flags, medical_flags, care_flags } = countBehaviourMedicalAlerts(
      activeBookings,
      buildPetNotesMap(Array.isArray(livePets) ? livePets : []),
      groupFlagsByHousehold(Array.isArray(householdRecords) ? householdRecords : []),
    );

    const serviceBreakdown = {
      full_day: activeBookings.filter(b => b.service_type === 'full_day').length,
      half_day: activeBookings.filter(b => b.service_type === 'half_day').length,
      trial_day: activeBookings.filter(b => b.service_type === 'trial_day').length,
      hourly: activeBookings.filter(b => b.service_type === 'hourly').length,
    };
    
    const stats = {
      location_id: locationId || 'ALL',
      date,
      total_bookings: todayBookings.length,
      confirmed_bookings: todayBookings.filter(b => b.booking_status === 'confirmed').length,
      checked_in_count: todayBookings.filter(b => b.check_in_status === 'checked_in').length,
      checked_out_count: todayBookings.filter(b => b.check_in_status === 'checked_out').length,
      no_shows: todayBookings.filter(b => b.booking_status === 'no_show').length,
      cancellations: todayBookings.filter(b => b.booking_status === 'cancelled').length,
      max_capacity: capacity.max_capacity,
      capacity_utilisation: capacity.max_capacity > 0 ? (activeBookings.length / capacity.max_capacity) * 100 : 0,
      available_slots: capacity.max_capacity > 0 ? Math.max(0, capacity.max_capacity - activeBookings.length) : 0,
      rag_status: ragStatus,
      service_breakdown: serviceBreakdown,
      expected_arrivals_2h: todayBookings.filter(b => 
        b.check_in_status === 'not_checked_in' && 
        b.planned_start_time &&
        b.planned_start_time <= twoHoursFromNow.toTimeString().slice(0, 5)
      ).length,
      expected_pickups_2h: todayBookings.filter(b => 
        b.check_in_status === 'checked_in' && 
        b.planned_end_time &&
        b.planned_end_time <= twoHoursFromNow.toTimeString().slice(0, 5)
      ).length,
      vaccination_alerts: todayBookings.filter(b => b.vaccination_status === 'expired' || b.vaccination_status === 'expiring_soon').length,
      waiver_alerts: todayBookings.filter(b => b.waiver_status === 'expired' || b.waiver_status === 'expiring_soon').length,
      hold_alerts: todayBookings.filter(b => b.has_booking_hold || b.has_payment_hold).length,
      behaviour_flags,
      medical_flags,
      care_flags,
    };
    
    return c.json(stats);
  } catch (error: any) {
    return internalError(c, 'daycare.stats', error);
  }
});

// ============================================================================
// ROUTES - AUDIT EVENTS
// ============================================================================

app.get('/events', async (c) => {
  try {
    const user = c.get('user') as AuthenticatedUser;
    
    if (!hasPermission(user.role, 'view')) {
      return c.json({ error: 'Access denied' }, 403);
    }
    
    const bookingId = c.req.query('booking_id');
    const locationId = c.req.query('location_id');
    const limit = parseInt(c.req.query('limit') || '50');
    
    if (locationId && user.role !== 'admin' && !user.locationIds.includes(locationId)) {
      return c.json({ error: 'Access denied to this location' }, 403);
    }
    
    let eventIds: string[] = [];
    
    if (bookingId) {
      const booking = await kv.get(`daycare:booking:${bookingId}`) as DaycareBooking | null;
      if (booking) {
        const permCheck = filterByLocationPermission([booking], user);
        if (permCheck.length === 0) {
          return c.json({ error: 'Access denied' }, 403);
        }
      }
      eventIds = (await kv.getByPrefix(`daycare:event:booking:${bookingId}:`) as string[]) || [];
    } else if (locationId) {
      eventIds = (await kv.getByPrefix(`daycare:event:location:${locationId}:`) as string[]) || [];
    } else {
      const allEvents = await kv.getByPrefix('daycare:event:') as any[];
      let events = allEvents
        .filter((e: any) => e && typeof e === 'object' && e.id && e.event_type);
      events = filterByLocationPermission(events, user);
      events = events
        .sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, limit);
      return c.json(events);
    }
    
    const parsedIds = eventIds.map((idStr: string) => {
      try { return JSON.parse(idStr); } catch { return idStr; }
    });
    
    const events = await Promise.all(
      parsedIds.map(async (id) => await kv.get(`daycare:event:${id}`) as DaycareEvent)
    );
    
    const validEvents = events
      .filter(Boolean)
      .sort((a, b) => new Date(b!.timestamp).getTime() - new Date(a!.timestamp).getTime())
      .slice(0, limit);
    
    return c.json(validEvents);
  } catch (error: any) {
    return internalError(c, 'daycare.events', error);
  }
});

export default app;