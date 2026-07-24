/**
 * Grooming Routes - MDC Operations Centre
 * Server-side grooming appointment management with tenant isolation and RBAC
 */

import { Hono } from 'npm:hono';
import * as kv from './kv_store.tsx';
import { requireAuth, AuthenticatedUser } from './_shared/auth.ts';
import { internalError } from './_shared/log.ts';
import { flagCheckInIssues } from './lib/flag_gate.ts';
import { isNonBillablePet } from './lib/billing_exempt.ts';
import { petPhotoPathFromStored, signPetPhotoUrl, withSignedPetPhotos } from './lib/pet_photos.ts';
import { checkTimeWithinHours, operatingHoursFromOrg } from './lib/operating_hours.ts';

const app = new Hono();

// Every grooming route requires a validated user. requireAuth handles JWT
// validation server-side with SERVICE_ROLE_KEY; the ad-hoc ANON_KEY-validated
// getUserFromToken helper that used to live here has been removed.
app.use('*', requireAuth);

// ============================================================================
// TYPES
// ============================================================================

type AppointmentStatus = 'requested' | 'confirmed' | 'checked_in' | 'in_progress' | 'completed' | 'cancelled' | 'no_show';

interface GroomingAppointment {
  id: string;
  household_id: string;
  household_name: string;
  pet_id: string;
  pet_name: string;
  pet_photo_url?: string;
  pet_breed?: string;
  pet_size?: string;
  location_id: string;
  location_name: string;
  service_type: string;
  service_name: string;
  estimated_duration_minutes: number;
  appointment_date: string;
  appointment_time: string;
  status: AppointmentStatus;
  actual_check_in_time?: string;
  grooming_started_at?: string;
  grooming_completed_at?: string;
  actual_check_out_time?: string;
  groomer_id?: string;
  groomer_name?: string;
  checked_in_by_id?: string;
  checked_in_by_name?: string;
  customer_notes?: string;
  grooming_instructions?: string;
  groomer_notes?: string;
  has_behaviour_flag: boolean;
  has_medical_flag: boolean;
  behaviour_notes?: string;
  medical_notes?: string;
  has_matting: boolean;
  matting_severity?: string;
  vaccination_status: string;
  base_price: number;
  total_price: number;
  /** House dog: appointment holds its slot but was priced at zero. */
  non_billable?: boolean;
  currency: string;
  photos_taken: string[];
  created_by_id: string;
  created_by_name: string;
  created_at: string;
  updated_at: string;
  cancelled_at?: string;
  cancelled_by_id?: string;
  cancelled_by_name?: string;
  cancellation_reason?: string;
  tenant_id: string;
}

// ============================================================================
// HELPERS
// ============================================================================

function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function getUserInfo(user: AuthenticatedUser) {
  return {
    id: user.id,
    name: user.name,
    role: user.role,
  };
}

const SERVICE_DEFAULTS: Record<string, { name: string; duration: number; price: number }> = {
  bath_brush: { name: 'Bath & Brush', duration: 45, price: 35 },
  bath_trim: { name: 'Bath & Trim', duration: 60, price: 55 },
  full_groom: { name: 'Full Groom', duration: 90, price: 75 },
  puppy_groom: { name: 'Puppy Groom', duration: 45, price: 40 },
  nail_trim: { name: 'Nail Trim', duration: 15, price: 15 },
  teeth_cleaning: { name: 'Teeth Cleaning', duration: 20, price: 20 },
  ear_cleaning: { name: 'Ear Cleaning', duration: 15, price: 15 },
  deshed_treatment: { name: 'De-shed Treatment', duration: 60, price: 50 },
  flea_treatment: { name: 'Flea Treatment', duration: 30, price: 35 },
  custom: { name: 'Custom Service', duration: 60, price: 50 },
};

// ============================================================================
// APPOINTMENTS
// ============================================================================

// GET /grooming/appointments - List appointments
app.get('/appointments', async (c) => {
  try {
    const user = c.get('user') as AuthenticatedUser;
    const tenantId = user.tenantId;
    const date = c.req.query('date');
    const status = c.req.query('status');
    const serviceType = c.req.query('service_type');
    const locationId = c.req.query('location_id');
    
    let appointments = await kv.getByPrefix(`grooming-apt:${tenantId}:`);
    
    // Filter by date
    if (date) {
      appointments = appointments.filter((a: GroomingAppointment) => a.appointment_date === date);
    }
    
    // Filter by status
    if (status) {
      appointments = appointments.filter((a: GroomingAppointment) => a.status === status);
    }
    
    // Filter by service type
    if (serviceType) {
      appointments = appointments.filter((a: GroomingAppointment) => a.service_type === serviceType);
    }
    
    // Filter by location
    if (locationId) {
      appointments = appointments.filter((a: GroomingAppointment) => a.location_id === locationId);
    }
    
    // Sort by appointment time
    appointments.sort((a: GroomingAppointment, b: GroomingAppointment) => {
      const timeA = a.appointment_time || '00:00';
      const timeB = b.appointment_time || '00:00';
      return timeA.localeCompare(timeB);
    });
    
    // pet_photo_url is stored as a storage path — sign per response.
    return c.json(await withSignedPetPhotos(appointments as Record<string, unknown>[], 'pet_photo_url'));
  } catch (e: any) {
    return internalError(c, 'grooming.listAppointments', e);
  }
});

// GET /grooming/appointments/:id - Get single appointment
app.get('/appointments/:id', async (c) => {
  try {
    const user = c.get('user') as AuthenticatedUser;
    const tenantId = user.tenantId;
    const id = c.req.param('id');
    
    const appointment = await kv.get(`grooming-apt:${tenantId}:${id}`);
    if (!appointment) {
      return c.json({ error: 'Appointment not found' }, 404);
    }

    return c.json({ ...appointment, pet_photo_url: await signPetPhotoUrl(appointment.pet_photo_url) });
  } catch (e: any) {
    return internalError(c, 'grooming.getAppointment', e);
  }
});

// POST /grooming/appointments - Create appointment
app.post('/appointments', async (c) => {
  try {
    const user = c.get('user') as AuthenticatedUser;
    const tenantId = user.tenantId;
    const userInfo = getUserInfo(user);
    const body = await c.req.json();
    
    const serviceDefaults = SERVICE_DEFAULTS[body.service_type] || SERVICE_DEFAULTS.custom;

    // Appointment times must honour the organisation's operating hours
    // (Settings → Organisation). Skipped when no parseable hours are set.
    const orgHours = operatingHoursFromOrg(await kv.get('settings:org'));
    if (orgHours) {
      const hoursCheck = checkTimeWithinHours(body.appointment_time, orgHours, 'appointment time');
      if (!hoursCheck.ok) {
        return c.json({ error: hoursCheck.error }, 400);
      }
    }

    // House dogs (pet.non_billable) get zero-priced appointments — the slot
    // and record exist as normal, no charge can derive from them.
    const groomPet = body.household_id && body.pet_id
      ? await kv.get(`customer:${tenantId}:pet:${body.household_id}:${body.pet_id}`)
      : undefined;
    const petNonBillable = isNonBillablePet(groomPet);

    const appointment: GroomingAppointment = {
      id: generateId('groom'),
      household_id: body.household_id,
      household_name: body.household_name || 'Unknown',
      pet_id: body.pet_id,
      pet_name: body.pet_name || 'Unknown',
      // Clients send whatever URL they rendered (signed, or legacy public) —
      // persist the storage path; read endpoints re-sign it per response.
      pet_photo_url: petPhotoPathFromStored(body.pet_photo_url) ?? body.pet_photo_url ?? null,
      pet_breed: body.pet_breed,
      pet_size: body.pet_size,
      location_id: body.location_id || 'default',
      location_name: body.location_name || 'Main Location',
      service_type: body.service_type || 'full_groom',
      service_name: body.service_name || serviceDefaults.name,
      estimated_duration_minutes: body.estimated_duration_minutes || serviceDefaults.duration,
      appointment_date: body.appointment_date,
      appointment_time: body.appointment_time,
      status: 'confirmed',
      has_behaviour_flag: body.has_behaviour_flag || false,
      has_medical_flag: body.has_medical_flag || false,
      behaviour_notes: body.behaviour_notes,
      medical_notes: body.medical_notes,
      has_matting: body.has_matting || false,
      matting_severity: body.matting_severity,
      vaccination_status: body.vaccination_status || 'valid',
      customer_notes: body.customer_notes,
      grooming_instructions: body.grooming_instructions,
      base_price: petNonBillable ? 0 : (body.base_price || serviceDefaults.price),
      total_price: petNonBillable ? 0 : (body.total_price || serviceDefaults.price),
      non_billable: petNonBillable,
      currency: body.currency || 'GBP',
      photos_taken: [],
      created_by_id: userInfo.id,
      created_by_name: userInfo.name,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      tenant_id: tenantId,
    };
    
    await kv.set(`grooming-apt:${tenantId}:${appointment.id}`, appointment);

    return c.json({ ...appointment, pet_photo_url: await signPetPhotoUrl(appointment.pet_photo_url) }, 201);
  } catch (e: any) {
    return internalError(c, 'grooming.createAppointment', e);
  }
});

// PATCH /grooming/appointments/:id - Update appointment
app.patch('/appointments/:id', async (c) => {
  try {
    const user = c.get('user') as AuthenticatedUser;
    const tenantId = user.tenantId;
    const id = c.req.param('id');
    const body = await c.req.json();
    
    const existing = await kv.get(`grooming-apt:${tenantId}:${id}`);
    if (!existing) {
      return c.json({ error: 'Appointment not found' }, 404);
    }
    
    // Rescheduling honours operating hours too (same rule as creation).
    if ('appointment_time' in body) {
      const orgHours = operatingHoursFromOrg(await kv.get('settings:org'));
      if (orgHours) {
        const hoursCheck = checkTimeWithinHours(body.appointment_time, orgHours, 'appointment time');
        if (!hoursCheck.ok) {
          return c.json({ error: hoursCheck.error }, 400);
        }
      }
    }

    const updated = {
      ...existing,
      ...body,
      updated_at: new Date().toISOString(),
    };
    // Never persist a URL a client echoed back — reduce to the storage path.
    if ('pet_photo_url' in body) {
      updated.pet_photo_url = petPhotoPathFromStored(body.pet_photo_url) ?? body.pet_photo_url ?? null;
    }

    await kv.set(`grooming-apt:${tenantId}:${id}`, updated);
    
    return c.json({ ...updated, pet_photo_url: await signPetPhotoUrl(updated.pet_photo_url) });
  } catch (e: any) {
    return internalError(c, 'grooming.updateAppointment', e);
  }
});

// POST /grooming/appointments/:id/cancel - Cancel appointment
app.post('/appointments/:id/cancel', async (c) => {
  try {
    const user = c.get('user') as AuthenticatedUser;
    const tenantId = user.tenantId;
    const userInfo = getUserInfo(user);
    const id = c.req.param('id');
    const body = await c.req.json();
    
    const existing = await kv.get(`grooming-apt:${tenantId}:${id}`);
    if (!existing) {
      return c.json({ error: 'Appointment not found' }, 404);
    }
    
    const updated = {
      ...existing,
      status: 'cancelled',
      cancelled_at: new Date().toISOString(),
      cancelled_by_id: userInfo.id,
      cancelled_by_name: userInfo.name,
      cancellation_reason: body.reason,
      updated_at: new Date().toISOString(),
    };
    
    await kv.set(`grooming-apt:${tenantId}:${id}`, updated);
    
    return c.json({ ...updated, pet_photo_url: await signPetPhotoUrl(updated.pet_photo_url) });
  } catch (e: any) {
    return internalError(c, 'grooming.cancelAppointment', e);
  }
});

// POST /grooming/appointments/:id/check-in - Check in
app.post('/appointments/:id/check-in', async (c) => {
  try {
    const user = c.get('user') as AuthenticatedUser;
    const tenantId = user.tenantId;
    const userInfo = getUserInfo(user);
    const id = c.req.param('id');
    const body = await c.req.json();
    
    const existing = await kv.get(`grooming-apt:${tenantId}:${id}`);
    if (!existing) {
      return c.json({ error: 'Appointment not found' }, 404);
    }

    // Block-severity operational flags prevent check-in server-side; the
    // validate-checkin call is advisory only. Same enforcement as daycare's
    // check-in route, scoped to the flag gate so existing vaccination
    // semantics on this route are unchanged.
    const flagRecords = await kv.getByPrefix(
      `customer:${tenantId}:household:${existing.household_id}:flag:`,
    );
    const { blockers } = flagCheckInIssues(flagRecords, existing.pet_id);
    if (blockers.length > 0) {
      return c.json({ error: 'Check-in blocked', blockers }, 400);
    }

    const updated = {
      ...existing,
      status: 'checked_in',
      actual_check_in_time: new Date().toISOString(),
      checked_in_by_id: userInfo.id,
      checked_in_by_name: userInfo.name,
      updated_at: new Date().toISOString(),
    };
    
    if (body.notes) {
      updated.customer_notes = body.notes;
    }
    
    await kv.set(`grooming-apt:${tenantId}:${id}`, updated);
    
    return c.json({ ...updated, pet_photo_url: await signPetPhotoUrl(updated.pet_photo_url) });
  } catch (e: any) {
    return internalError(c, 'grooming.checkIn', e);
  }
});

// POST /grooming/appointments/:id/start - Start grooming
app.post('/appointments/:id/start', async (c) => {
  try {
    const user = c.get('user') as AuthenticatedUser;
    const tenantId = user.tenantId;
    const id = c.req.param('id');
    const body = await c.req.json();
    
    const existing = await kv.get(`grooming-apt:${tenantId}:${id}`);
    if (!existing) {
      return c.json({ error: 'Appointment not found' }, 404);
    }
    
    // Get groomer info
    let groomerName = 'Unknown Groomer';
    if (body.groomer_id) {
      const groomer = await kv.get(`groomer:${tenantId}:${body.groomer_id}`);
      if (groomer) {
        groomerName = groomer.name;
      }
    }
    
    const updated = {
      ...existing,
      status: 'in_progress',
      grooming_started_at: new Date().toISOString(),
      groomer_id: body.groomer_id,
      groomer_name: groomerName,
      updated_at: new Date().toISOString(),
    };
    
    await kv.set(`grooming-apt:${tenantId}:${id}`, updated);
    
    // Update groomer status
    if (body.groomer_id) {
      const groomer = await kv.get(`groomer:${tenantId}:${body.groomer_id}`);
      if (groomer) {
        groomer.current_appointment_id = id;
        await kv.set(`groomer:${tenantId}:${body.groomer_id}`, groomer);
      }
    }
    
    return c.json({ ...updated, pet_photo_url: await signPetPhotoUrl(updated.pet_photo_url) });
  } catch (e: any) {
    return internalError(c, 'grooming.startAppointment', e);
  }
});

// POST /grooming/appointments/:id/complete - Complete grooming
app.post('/appointments/:id/complete', async (c) => {
  try {
    const user = c.get('user') as AuthenticatedUser;
    const tenantId = user.tenantId;
    const id = c.req.param('id');
    const body = await c.req.json();
    
    const existing = await kv.get(`grooming-apt:${tenantId}:${id}`);
    if (!existing) {
      return c.json({ error: 'Appointment not found' }, 404);
    }
    
    const updated = {
      ...existing,
      status: 'completed',
      grooming_completed_at: new Date().toISOString(),
      groomer_notes: body.groomer_notes,
      photos_taken: body.photos || [],
      updated_at: new Date().toISOString(),
    };
    
    await kv.set(`grooming-apt:${tenantId}:${id}`, updated);
    
    // Free up groomer
    if (existing.groomer_id) {
      const groomer = await kv.get(`groomer:${tenantId}:${existing.groomer_id}`);
      if (groomer) {
        groomer.current_appointment_id = null;
        await kv.set(`groomer:${tenantId}:${existing.groomer_id}`, groomer);
      }
    }
    
    return c.json({ ...updated, pet_photo_url: await signPetPhotoUrl(updated.pet_photo_url) });
  } catch (e: any) {
    return internalError(c, 'grooming.completeAppointment', e);
  }
});

// POST /grooming/appointments/:id/check-out - Check out
app.post('/appointments/:id/check-out', async (c) => {
  try {
    const user = c.get('user') as AuthenticatedUser;
    const tenantId = user.tenantId;
    const userInfo = getUserInfo(user);
    const id = c.req.param('id');
    const body = await c.req.json();
    
    const existing = await kv.get(`grooming-apt:${tenantId}:${id}`);
    if (!existing) {
      return c.json({ error: 'Appointment not found' }, 404);
    }
    
    const updated = {
      ...existing,
      actual_check_out_time: new Date().toISOString(),
      checked_out_by_id: userInfo.id,
      checked_out_by_name: userInfo.name,
      updated_at: new Date().toISOString(),
    };
    
    if (body.notes) {
      updated.groomer_notes = (updated.groomer_notes || '') + '\n\nCheckout notes: ' + body.notes;
    }
    
    await kv.set(`grooming-apt:${tenantId}:${id}`, updated);
    
    return c.json({ ...updated, pet_photo_url: await signPetPhotoUrl(updated.pet_photo_url) });
  } catch (e: any) {
    return internalError(c, 'grooming.checkOut', e);
  }
});

// GET /grooming/appointments/:id/validate-checkin - Validate check-in
app.get('/appointments/:id/validate-checkin', async (c) => {
  try {
    const user = c.get('user') as AuthenticatedUser;
    const tenantId = user.tenantId;
    const id = c.req.param('id');
    
    const appointment = await kv.get(`grooming-apt:${tenantId}:${id}`);
    if (!appointment) {
      return c.json({ error: 'Appointment not found' }, 404);
    }
    
    const blockers: any[] = [];
    const warnings: any[] = [];
    
    // Check vaccination status
    if (appointment.vaccination_status === 'expired' || appointment.vaccination_status === 'missing') {
      blockers.push({
        type: 'blocker',
        category: 'vaccination',
        message: 'Vaccinations are expired or missing',
      });
    } else if (appointment.vaccination_status === 'expiring_soon') {
      warnings.push({
        type: 'warning',
        category: 'vaccination',
        message: 'Vaccinations are expiring soon',
      });
    }
    
    // Behaviour / medical warnings read the LIVE pet record — the copies on
    // the appointment were client-supplied at creation and go stale (same
    // fix as daycare's validateCheckIn). Appointment snapshot stays as the
    // fallback when the pet record is gone, failing towards showing.
    const livePet = (await kv.get(
      `customer:${tenantId}:pet:${appointment.household_id}:${appointment.pet_id}`,
    )) as { behaviour_notes?: string; medical_notes?: string } | null;
    const behaviourNotes = livePet ? livePet.behaviour_notes : appointment.behaviour_notes;
    const medicalNotes = livePet ? livePet.medical_notes : appointment.medical_notes;
    const hasBehaviourFlag = livePet ? !!behaviourNotes : appointment.has_behaviour_flag;
    const hasMedicalFlag = livePet ? !!medicalNotes : appointment.has_medical_flag;

    if (hasBehaviourFlag) {
      warnings.push({
        type: 'warning',
        category: 'behaviour',
        message: behaviourNotes || 'Pet has behaviour concerns',
      });
    }

    if (hasMedicalFlag) {
      warnings.push({
        type: 'warning',
        category: 'medical',
        message: medicalNotes || 'Pet has medical concerns',
      });
    }
    
    // Check matting
    if (appointment.has_matting && appointment.matting_severity === 'severe') {
      warnings.push({
        type: 'warning',
        category: 'matting',
        message: 'Severe matting detected - additional time/charges may apply',
      });
    }

    // Operational flags — LIVE read (same fix as daycare's validateCheckIn):
    // warn flags must be acknowledged, block flags prevent check-in until
    // cleared, regardless of when the appointment was created.
    const flagRecords = await kv.getByPrefix(
      `customer:${tenantId}:household:${appointment.household_id}:flag:`,
    );
    const flagIssues = flagCheckInIssues(flagRecords, appointment.pet_id);
    blockers.push(...flagIssues.blockers);
    warnings.push(...flagIssues.warnings);

    return c.json({
      can_check_in: blockers.length === 0,
      blockers,
      warnings,
    });
  } catch (e: any) {
    return internalError(c, 'grooming.validateCheckIn', e);
  }
});

// ============================================================================
// QUEUE
// ============================================================================

// GET /grooming/queue - Get current queue
app.get('/queue', async (c) => {
  try {
    const user = c.get('user') as AuthenticatedUser;
    const tenantId = user.tenantId;
    const locationId = c.req.query('location_id');
    const today = new Date().toISOString().split('T')[0];
    
    let appointments = await kv.getByPrefix(`grooming-apt:${tenantId}:`);
    
    // Filter to today's checked-in appointments
    appointments = appointments.filter((a: GroomingAppointment) => 
      a.appointment_date === today && a.status === 'checked_in'
    );
    
    // Filter by location
    if (locationId) {
      appointments = appointments.filter((a: GroomingAppointment) => a.location_id === locationId);
    }
    
    // Sort by check-in time
    appointments.sort((a: GroomingAppointment, b: GroomingAppointment) => {
      const timeA = a.actual_check_in_time || '';
      const timeB = b.actual_check_in_time || '';
      return timeA.localeCompare(timeB);
    });
    
    // Map to queue items
    const queue = appointments.map((a: GroomingAppointment) => {
      const checkInTime = a.actual_check_in_time ? new Date(a.actual_check_in_time) : new Date();
      const waitTime = Math.round((Date.now() - checkInTime.getTime()) / 60000);
      
      return {
        appointment_id: a.id,
        pet_name: a.pet_name,
        pet_photo_url: a.pet_photo_url,
        household_name: a.household_name,
        service_name: a.service_name,
        estimated_duration_minutes: a.estimated_duration_minutes,
        checked_in_at: a.actual_check_in_time,
        wait_time_minutes: waitTime,
        has_flags: a.has_behaviour_flag || a.has_medical_flag,
        priority: (a.has_behaviour_flag || a.has_medical_flag) ? 'high' : 'normal',
      };
    });
    
    // Queue items carry the stored path — sign per response.
    return c.json(await withSignedPetPhotos(queue as Record<string, unknown>[], 'pet_photo_url'));
  } catch (e: any) {
    return internalError(c, 'grooming.queue', e);
  }
});

// ============================================================================
// GROOMERS
// ============================================================================

// GET /grooming/groomers - List groomers
app.get('/groomers', async (c) => {
  try {
    const user = c.get('user') as AuthenticatedUser;
    const tenantId = user.tenantId;
    const locationId = c.req.query('location_id');
    
    let groomers = await kv.getByPrefix(`groomer:${tenantId}:`);
    
    // Filter by location
    if (locationId) {
      groomers = groomers.filter((g: any) => g.location_id === locationId);
    }
    
    // Filter active only
    groomers = groomers.filter((g: any) => g.is_active);
    
    return c.json(groomers);
  } catch (e: any) {
    return internalError(c, 'grooming.listGroomers', e);
  }
});

// POST /grooming/groomers/seed - Seed sample groomers
app.post('/groomers/seed', async (c) => {
  try {
    const user = c.get('user') as AuthenticatedUser;
    const tenantId = user.tenantId;
    
    const sampleGroomers = [
      {
        id: 'groomer_1',
        user_id: 'user_1',
        name: 'Sarah Johnson',
        location_id: 'default',
        specializations: ['full_groom', 'bath_trim', 'puppy_groom'],
        can_handle_large_dogs: true,
        can_handle_difficult_dogs: true,
        working_days: [1, 2, 3, 4, 5],
        working_hours_start: '09:00',
        working_hours_end: '17:00',
        max_appointments_per_day: 6,
        is_active: true,
        is_on_break: false,
        current_appointment_id: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: 'groomer_2',
        user_id: 'user_2',
        name: 'Mike Peters',
        location_id: 'default',
        specializations: ['bath_brush', 'nail_trim', 'deshed_treatment'],
        can_handle_large_dogs: true,
        can_handle_difficult_dogs: false,
        working_days: [1, 2, 3, 4, 5],
        working_hours_start: '09:00',
        working_hours_end: '17:00',
        max_appointments_per_day: 8,
        is_active: true,
        is_on_break: false,
        current_appointment_id: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: 'groomer_3',
        user_id: 'user_3',
        name: 'Emma Williams',
        location_id: 'default',
        specializations: ['full_groom', 'puppy_groom', 'teeth_cleaning'],
        can_handle_large_dogs: false,
        can_handle_difficult_dogs: true,
        working_days: [2, 3, 4, 5, 6],
        working_hours_start: '10:00',
        working_hours_end: '18:00',
        max_appointments_per_day: 5,
        is_active: true,
        is_on_break: false,
        current_appointment_id: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];
    
    for (const groomer of sampleGroomers) {
      await kv.set(`groomer:${tenantId}:${groomer.id}`, groomer);
    }
    
    return c.json({ success: true, count: sampleGroomers.length });
  } catch (e: any) {
    return internalError(c, 'grooming.seedGroomers', e);
  }
});

// ============================================================================
// STATS
// ============================================================================

// GET /grooming/stats - Get dashboard stats
app.get('/stats', async (c) => {
  try {
    const user = c.get('user') as AuthenticatedUser;
    const tenantId = user.tenantId;
    const locationId = c.req.query('location_id');
    const date = c.req.query('date') || new Date().toISOString().split('T')[0];
    
    let appointments = await kv.getByPrefix(`grooming-apt:${tenantId}:`);
    
    // Filter by date
    appointments = appointments.filter((a: GroomingAppointment) => a.appointment_date === date);
    
    // Filter by location
    if (locationId) {
      appointments = appointments.filter((a: GroomingAppointment) => a.location_id === locationId);
    }
    
    // Calculate stats
    const stats = {
      location_id: locationId || 'all',
      date,
      total_appointments: appointments.length,
      confirmed_appointments: appointments.filter((a: GroomingAppointment) => a.status === 'confirmed').length,
      checked_in_count: appointments.filter((a: GroomingAppointment) => a.status === 'checked_in').length,
      in_progress_count: appointments.filter((a: GroomingAppointment) => a.status === 'in_progress').length,
      completed_count: appointments.filter((a: GroomingAppointment) => a.status === 'completed').length,
      no_shows: appointments.filter((a: GroomingAppointment) => a.status === 'no_show').length,
      cancellations: appointments.filter((a: GroomingAppointment) => a.status === 'cancelled').length,
      queue_length: appointments.filter((a: GroomingAppointment) => a.status === 'checked_in').length,
      vaccination_alerts: appointments.filter((a: GroomingAppointment) => 
        a.vaccination_status === 'expired' || a.vaccination_status === 'missing'
      ).length,
      behaviour_flags: appointments.filter((a: GroomingAppointment) => a.has_behaviour_flag).length,
      medical_flags: appointments.filter((a: GroomingAppointment) => a.has_medical_flag).length,
      avg_wait_time_minutes: 0,
      avg_groom_duration_minutes: 0,
      active_groomers: 0,
      groomers_on_break: 0,
    };
    
    // Get groomer stats
    let groomers = await kv.getByPrefix(`groomer:${tenantId}:`);
    if (locationId) {
      groomers = groomers.filter((g: any) => g.location_id === locationId);
    }
    groomers = groomers.filter((g: any) => g.is_active);
    
    stats.active_groomers = groomers.filter((g: any) => g.current_appointment_id).length;
    stats.groomers_on_break = groomers.filter((g: any) => g.is_on_break).length;
    
    // Calculate avg wait time for checked-in appointments
    const checkedIn = appointments.filter((a: GroomingAppointment) => a.status === 'checked_in' && a.actual_check_in_time);
    if (checkedIn.length > 0) {
      const totalWait = checkedIn.reduce((sum: number, a: GroomingAppointment) => {
        const checkInTime = new Date(a.actual_check_in_time!);
        return sum + Math.round((Date.now() - checkInTime.getTime()) / 60000);
      }, 0);
      stats.avg_wait_time_minutes = Math.round(totalWait / checkedIn.length);
    }
    
    // Calculate avg groom duration for completed appointments
    const completed = appointments.filter((a: GroomingAppointment) => 
      a.status === 'completed' && a.grooming_started_at && a.grooming_completed_at
    );
    if (completed.length > 0) {
      const totalDuration = completed.reduce((sum: number, a: GroomingAppointment) => {
        const start = new Date(a.grooming_started_at!);
        const end = new Date(a.grooming_completed_at!);
        return sum + Math.round((end.getTime() - start.getTime()) / 60000);
      }, 0);
      stats.avg_groom_duration_minutes = Math.round(totalDuration / completed.length);
    }
    
    return c.json(stats);
  } catch (e: any) {
    return internalError(c, 'grooming.stats', e);
  }
});

export default app;
