/**
 * Transport Routes - MDC Operations Centre
 * Server-side transport job management with full tenant isolation
 * NO SEED DATA - all operations use real household and pet references
 */

import { Context, Hono } from 'npm:hono';
import { cors } from 'npm:hono/cors';
import { z } from 'npm:zod';
import { createClient } from 'npm:@supabase/supabase-js@2';
import * as kv from './kv_store.tsx';
import { requireAuth, requireRole, AuthenticatedUser, Role } from './_shared/auth.ts';
import { internalError, logWarn } from './_shared/log.ts';
import { signPetPhotoUrl, storedPetPhoto } from './lib/pet_photos.ts';

const app = new Hono();

// Enable CORS
app.use('*', cors());

// Every transport route requires a validated user. requireAuth handles JWT
// validation server-side with SERVICE_ROLE_KEY; the ad-hoc ANON_KEY-validated
// getUserFromToken helper that used to live here has been removed.
app.use('*', requireAuth);

// ============================================================================
// SCHEMAS (runtime mirror of shared/schemas/transport.ts — keep in sync)
// ============================================================================

const directionEnum = z.enum(['pickup', 'dropoff', 'roundtrip']);
// 'failed' = driver-reported unsuccessful attempt; distinct from 'cancelled'
// (dispatcher decision) so failed stops stay visible and re-schedulable.
const jobStatusEnum = z.enum(['scheduled', 'in_progress', 'completed', 'failed', 'cancelled']);
const statusEventEnum = z.enum(['started', 'arrived', 'picked_up', 'dropped_off', 'completed', 'failed', 'cancelled']);
const bookingTypeEnum = z.enum(['daycare', 'grooming', 'overnight']);
const serviceDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'expected YYYY-MM-DD');
const optionalTime = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'expected HH:MM').nullable().optional();

function timeWindowOrdered(d: { time_window_start?: string | null; time_window_end?: string | null }): boolean {
  if (!d.time_window_start || !d.time_window_end) return true;
  return d.time_window_start < d.time_window_end;
}

const createJobSchema = z
  .object({
    location_id: z.string().min(1),
    service_date: serviceDate,
    direction: directionEnum,
    household_id: z.string().min(1),
    pet_id: z.string().min(1),
    address_pickup: z.string().max(500).nullable().optional(),
    address_dropoff: z.string().max(500).nullable().optional(),
    time_window_start: optionalTime,
    time_window_end: optionalTime,
    notes: z.string().max(2000).nullable().optional(),
    booking_id: z.string().max(200).nullable().optional(),
    booking_type: bookingTypeEnum.nullable().optional(),
    driver_user_id: z.string().max(200).nullable().optional(),
    vehicle_id: z.string().max(200).nullable().optional(),
  })
  .refine((d) => !!(d.address_pickup?.trim() || d.address_dropoff?.trim()), {
    message: 'At least one address (pickup or dropoff) is required',
    path: ['address_pickup'],
  })
  .refine(timeWindowOrdered, {
    message: 'time_window_start must be before time_window_end',
    path: ['time_window_end'],
  });

// PATCH whitelist. Deliberately excludes id, tenant_id, created_by,
// created_at and location_id (a job never moves between locations — this
// keeps the per-location KV indexes consistent). .strict() rejects any key
// outside the whitelist (mass-assignment guard).
const updateJobSchema = z
  .object({
    service_date: serviceDate.optional(),
    direction: directionEnum.optional(),
    status: jobStatusEnum.optional(),
    address_pickup: z.string().max(500).nullable().optional(),
    address_dropoff: z.string().max(500).nullable().optional(),
    time_window_start: optionalTime,
    time_window_end: optionalTime,
    assigned_driver_user_id: z.string().max(200).nullable().optional(),
    assigned_vehicle_id: z.string().max(200).nullable().optional(),
    notes: z.string().max(2000).nullable().optional(),
  })
  .strict()
  .refine(timeWindowOrdered, {
    message: 'time_window_start must be before time_window_end',
    path: ['time_window_end'],
  });

const assignJobSchema = z.object({
  vehicle_id: z.string().min(1),
  driver_user_id: z.string().max(200).nullable().optional(),
});

const statusUpdateSchema = z.object({
  event_type: statusEventEnum,
  notes: z.string().max(2000).nullable().optional(),
});

const createVehicleSchema = z.object({
  location_id: z.string().min(1),
  name: z.string().min(1).max(100),
  licence_plate: z.string().min(1).max(20),
  capacity: z.number().int().min(1).max(50),
  notes: z.string().max(2000).nullable().optional(),
  assigned_driver_user_id: z.string().max(200).nullable().optional(),
  is_active: z.boolean().optional(),
});

const updateVehicleSchema = z
  .object({
    location_id: z.string().min(1).optional(),
    name: z.string().min(1).max(100).optional(),
    licence_plate: z.string().min(1).max(20).optional(),
    capacity: z.number().int().min(1).max(50).optional(),
    notes: z.string().max(2000).nullable().optional(),
    assigned_driver_user_id: z.string().max(200).nullable().optional(),
    is_active: z.boolean().optional(),
  })
  .strict();

// ============================================================================
// HELPERS
// ============================================================================

function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Returns the same shape callers already consume (auth.user, auth.tenant_id,
 * etc.). The `error`/`status` branch is gone — requireAuth has already
 * short-circuited unauthenticated requests with 401 before we get here.
 */
function validateUserPermission(c: Context, _requiredPermission: string) {
  const user = c.get('user') as AuthenticatedUser;
  return {
    user,
    tenant_id: user.tenantId,
    location_id: null as string | null,
    role_id: user.role,
  };
}

/**
 * Roles that may manage transport jobs (create/edit/assign). Staff get in
 * only via the Driver template — mirroring the client-side Driver template,
 * which grants transport create/update. templateId is authorization-bearing,
 * so it is read from app_metadata only (server-set, untamperable).
 */
const TRANSPORT_MANAGE_ROLES: Role[] = ['admin', 'manager', 'assistant_manager'];

function isDriver(user: AuthenticatedUser): boolean {
  return (user.app_metadata?.templateId as string | undefined) === 'tpl-driver';
}

/**
 * Write gate for job create/edit/assign. Must run AFTER requireAuth.
 * Deletes and vehicle management use the stricter shared requireRole
 * ('admin', 'manager') instead. On a miss the client gets a generic 403 +
 * correlation ID; who was denied what is logged server-side only.
 */
async function requireJobWrite(c: Context, next: () => Promise<void>) {
  const user = c.get('user') as AuthenticatedUser;
  if (TRANSPORT_MANAGE_ROLES.includes(user.role) || isDriver(user)) {
    return await next();
  }
  const correlationId = crypto.randomUUID();
  logWarn('transport.write_denied', {
    correlationId,
    userId: user.id,
    role: user.role,
    method: c.req.method,
    path: c.req.path,
  });
  return c.json({ error: 'forbidden', correlationId }, 403);
}

/**
 * Get active drivers for a location, scoped to the requesting tenant.
 * Active driver = not banned, templateId='tpl-driver', same tenant.
 *
 * Tenant resolution matches _shared/auth.ts validateUserToken: app_metadata
 * tenant_id / tenantId, falling back to the user's own id. Without this
 * filter, drivers (names + emails) from OTHER tenants leaked into the
 * response and were counted for auto-assignment.
 */
async function getActiveDrivers(tenantId: string, locationId?: string) {
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!serviceRoleKey) {
    logWarn('transport.getActiveDrivers.no_service_role', {});
    return [];
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    serviceRoleKey
  );

  try {
    const drivers: Array<{
      user_id: string;
      first_name: string;
      last_name: string;
      email: string | undefined;
      role: string;
      location_ids: string[];
    }> = [];

    // listUsers is paginated (default 50/page) — walk every page, or drivers
    // beyond the first page silently vanish. MAX_PAGES bounds the walk.
    const perPage = 1000;
    const MAX_PAGES = 10;
    for (let page = 1; page <= MAX_PAGES; page++) {
      const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
      if (error) {
        logWarn('transport.getActiveDrivers.list_users_failed', { page });
        break;
      }
      const users = data?.users ?? [];

      for (const user of users as any[]) {
        if (user.banned_until) continue;

        // All checks below are AUTHORIZATION checks, so they read
        // app_metadata only (server-set, untamperable from the client).
        const meta = user.app_metadata ?? {};

        const userTenant = meta.tenant_id ?? meta.tenantId ?? user.id;
        if (userTenant !== tenantId) continue;

        if (meta.templateId !== 'tpl-driver') continue;

        const locationIds: string[] = meta.locationIds ?? [];
        if (locationId && !locationIds.includes('all') && !locationIds.includes(locationId)) {
          continue;
        }

        drivers.push({
          user_id: user.id,
          first_name: user.user_metadata?.name?.split(' ')[0] || user.email?.split('@')[0] || 'Unknown',
          last_name: user.user_metadata?.name?.split(' ').slice(1).join(' ') || '',
          email: user.email,
          role: meta.role || 'staff',
          location_ids: locationIds,
        });
      }

      if (users.length < perPage) break;
    }

    return drivers;
  } catch (error) {
    logWarn('transport.getActiveDrivers.exception', {});
    return [];
  }
}

/**
 * Get active vehicles for a location/tenant
 */
async function getActiveVehicles(tenantId: string, locationId?: string) {
  const allVehicles = await kv.getByPrefix(`transport_vehicle:${tenantId}:`);

  return allVehicles.filter((vehicle: any) => {
    // Must be active (use is_active field, not status)
    if (vehicle.is_active !== true) {
      return false;
    }

    // If location_id specified, check location
    if (locationId && vehicle.location_id !== locationId) {
      return false;
    }

    return true;
  });
}

// ============================================================================
// TRANSPORT - GET ACTIVE DRIVER COUNT
// ============================================================================

app.get('/active-drivers', async (c) => {
  try {
    const auth = validateUserPermission(c, 'transport:read');
    
    const locationId = c.req.query('location_id');
    const activeDrivers = await getActiveDrivers(auth.tenant_id, locationId);
    const activeVehicles = await getActiveVehicles(auth.tenant_id, locationId);
    
    return c.json({
      driver_count: activeDrivers.length,
      vehicle_count: activeVehicles.length,
      drivers: activeDrivers,
      vehicles: activeVehicles
    });
    
  } catch (error) {
    return internalError(c, 'transport.getActiveDrivers', error);
  }
});

// ============================================================================
// TRANSPORT JOBS - CREATE
// ============================================================================

app.post('/jobs', requireJobWrite, async (c) => {
  try {
    const auth = validateUserPermission(c, 'transport:write');
    
    const body = await c.req.json();
    const parsed = createJobSchema.safeParse(body);
    if (!parsed.success) return c.json({ error: parsed.error.format() }, 400);
    const {
      location_id,
      service_date,
      direction,
      household_id,
      pet_id,
      address_pickup,
      address_dropoff,
      time_window_start,
      time_window_end,
      notes,
      booking_id,
      booking_type,
      driver_user_id,
      vehicle_id
    } = parsed.data;

    // Verify household and pet exist and belong to tenant
    const householdKey = `customer:${auth.tenant_id}:household:${household_id}`;
    const household = await kv.get(householdKey);

    if (!household) {
      return c.json({ error: 'Household not found or access denied' }, 404);
    }

    const petKey = `customer:${auth.tenant_id}:pet:${household_id}:${pet_id}`;
    const pet = await kv.get(petKey);

    if (!pet) {
      return c.json({ error: 'Pet not found or access denied' }, 404);
    }

    // Parse if needed (KV store may return strings)
    const petData = typeof pet === 'string' ? JSON.parse(pet) : pet;
    
    // Verify pet belongs to household
    if (petData.household_id !== household_id) {
      return c.json({ error: 'Pet does not belong to specified household' }, 400);
    }
    
    // 3. Check driver assignment logic
    const activeDrivers = await getActiveDrivers(auth.tenant_id, location_id);
    const driverCount = activeDrivers.length;

    // Conditional driver assignment logic
    let assigned_driver_user_id = driver_user_id ?? undefined; // Respect manual assignment if provided
    let assigned_vehicle_id = vehicle_id ?? undefined;

    if (driverCount === 0) {
      // Rule A: No drivers - Allow creation but job will be unassigned
      assigned_driver_user_id = undefined;
      assigned_vehicle_id = undefined;
    } else if (driverCount === 1) {
      // Rule B: Exactly one driver - Auto-assign if not manually specified
      if (!assigned_driver_user_id) {
        assigned_driver_user_id = activeDrivers[0].user_id;

        // Also auto-assign vehicle if only one active vehicle
        if (!assigned_vehicle_id) {
          const activeVehicles = await getActiveVehicles(auth.tenant_id, location_id);
          if (activeVehicles.length === 1) {
            assigned_vehicle_id = activeVehicles[0].id;
          }
        }
      }
    }
    // Rule C (2+ drivers): allow creation with or without assignment.
    
    // Create transport job
    const jobId = generateId('tjob');
    const now = new Date().toISOString();
    
    const job = {
      id: jobId,
      tenant_id: auth.tenant_id,
      location_id,
      service_date,
      direction,
      status: 'scheduled',
      household_id,
      pet_id,
      address_pickup: address_pickup || null,
      address_dropoff: address_dropoff || null,
      time_window_start: time_window_start || null,
      time_window_end: time_window_end || null,
      assigned_driver_user_id: assigned_driver_user_id,
      assigned_vehicle_id: assigned_vehicle_id,
      booking_id: booking_id || null,
      booking_type: booking_type || null,
      notes: notes || null,
      created_by: auth.user.id,
      created_at: now,
      updated_at: now
    };
    
    // Store job
    const jobKey = `transport_job:${auth.tenant_id}:${jobId}`;
    await kv.set(jobKey, job);
    
    // Add to date index for efficient querying
    const dateIndexKey = `transport_job_index:${auth.tenant_id}:${service_date}`;
    const existingIndex = await kv.get(dateIndexKey) || [];
    await kv.set(dateIndexKey, [...existingIndex, jobId]);
    
    // Add to location index
    const locationIndexKey = `transport_job_location_index:${auth.tenant_id}:${location_id}:${service_date}`;
    const existingLocationIndex = await kv.get(locationIndexKey) || [];
    await kv.set(locationIndexKey, [...existingLocationIndex, jobId]);
    
    // Log event
    const eventId = generateId('tevt');
    const event = {
      id: eventId,
      tenant_id: auth.tenant_id,
      transport_job_id: jobId,
      event_type: 'created',
      event_time: now,
      actor_user_id: auth.user.id,
      metadata: { booking_id, booking_type }
    };
    
    const eventKey = `transport_event:${auth.tenant_id}:${eventId}`;
    await kv.set(eventKey, event);
    
    // Global audit log
    const auditId = generateId('audit');
    await kv.set(`audit:${auth.tenant_id}:${auditId}`, {
      id: auditId,
      tenant_id: auth.tenant_id,
      user_id: auth.user.id,
      action: 'transport_job_created',
      resource_type: 'transport_job',
      resource_id: jobId,
      metadata: { household_id, pet_id, service_date },
      created_at: now
    });
    
    return c.json({ success: true, job }, 201);
    
  } catch (error) {
    return internalError(c, 'transport.postJobs', error);
  }
});

// ============================================================================
// TRANSPORT JOBS - LIST
// ============================================================================

app.get('/jobs', async (c) => {
  try {
    const auth = validateUserPermission(c, 'transport:read');
    
    const url = new URL(c.req.url);
    const location_id = url.searchParams.get('location_id');
    const service_date = url.searchParams.get('service_date');
    const status = url.searchParams.get('status');
    const assigned_driver_user_id = url.searchParams.get('driver_user_id');
    
    let jobs: any[] = [];

    // Query by date and location for efficiency
    if (service_date && location_id) {
      const locationIndexKey = `transport_job_location_index:${auth.tenant_id}:${location_id}:${service_date}`;
      const jobIds: string[] = await kv.get(locationIndexKey) || [];
      jobs = jobIds.length
        ? await kv.mget(jobIds.map((id) => `transport_job:${auth.tenant_id}:${id}`))
        : [];
    } else if (service_date) {
      const dateIndexKey = `transport_job_index:${auth.tenant_id}:${service_date}`;
      const jobIds: string[] = await kv.get(dateIndexKey) || [];
      jobs = jobIds.length
        ? await kv.mget(jobIds.map((id) => `transport_job:${auth.tenant_id}:${id}`))
        : [];
    } else {
      // Get all jobs by prefix (less efficient, but works for smaller
      // datasets). The values ARE the jobs — no need to re-fetch by id.
      jobs = await kv.getByPrefix(`transport_job:${auth.tenant_id}:`);
    }

    // Filter out null values and apply filters
    let filteredJobs = jobs.filter((j) => j !== null && j !== undefined);

    if (location_id) {
      filteredJobs = filteredJobs.filter((j) => j.location_id === location_id);
    }

    if (status) {
      filteredJobs = filteredJobs.filter((j) => j.status === status);
    }

    if (assigned_driver_user_id) {
      filteredJobs = filteredJobs.filter((j) => j.assigned_driver_user_id === assigned_driver_user_id);
    }

    // Deterministic order: earliest time window first, then creation time.
    // Neither mget nor the index arrays guarantee a useful order, and the
    // driver views treat this order as the route order.
    filteredJobs.sort((a, b) =>
      (a.time_window_start ?? '99:99').localeCompare(b.time_window_start ?? '99:99') ||
      (a.created_at ?? '').localeCompare(b.created_at ?? '')
    );
    
    // Batch-enrich with household, pet, contact and vehicle data. The old
    // path issued up to 4 sequential KV reads PER JOB (N+1); now each record
    // type is fetched once via mget over the deduplicated key set. mget
    // returns values in arbitrary order and silently drops missing keys, so
    // results are re-keyed by each record's own id field.
    const parseVal = (v: unknown) => {
      if (!v) return null;
      return typeof v === 'string' ? JSON.parse(v) : v;
    };
    const byId = async (keys: string[]) => {
      const map = new Map<string, any>();
      if (keys.length === 0) return map;
      const values = await kv.mget(keys);
      for (const raw of values) {
        const value = parseVal(raw);
        if (value?.id) map.set(value.id, value);
      }
      return map;
    };

    const dedupe = (keys: (string | null)[]) =>
      [...new Set(keys.filter((k): k is string => !!k))];

    const householdKeys = dedupe(filteredJobs.map((j) =>
      `customer:${auth.tenant_id}:household:${j.household_id}`));
    const petKeys = dedupe(filteredJobs.map((j) =>
      `customer:${auth.tenant_id}:pet:${j.household_id}:${j.pet_id}`));
    const vehicleKeys = dedupe(filteredJobs.map((j) =>
      j.assigned_vehicle_id ? `transport_vehicle:${auth.tenant_id}:${j.assigned_vehicle_id}` : null));

    const [households, pets, vehicleMap] = await Promise.all([
      byId(householdKeys),
      byId(petKeys),
      byId(vehicleKeys),
    ]);

    // Contacts depend on each household's primary_contact_id — second batch.
    const contactKeys = dedupe(filteredJobs.map((j) => {
      const household = households.get(j.household_id);
      return household?.primary_contact_id
        ? `customer:${auth.tenant_id}:contact:${j.household_id}:${household.primary_contact_id}`
        : null;
    }));
    const contactMap = await byId(contactKeys);

    const enrichedJobs = await Promise.all(
      filteredJobs.map(async (job) => {
        const household = households.get(job.household_id) ?? null;
        const pet = pets.get(job.pet_id) ?? null;
        const contact = household?.primary_contact_id
          ? contactMap.get(household.primary_contact_id) ?? null
          : null;
        const vehicle = job.assigned_vehicle_id
          ? vehicleMap.get(job.assigned_vehicle_id) ?? null
          : null;

        return {
          ...job,
          pet_name: pet?.name || 'Unknown',
          // Private bucket — mint a signed URL from the stored path.
          pet_photo_url: await signPetPhotoUrl(storedPetPhoto(pet)),
          household_name: household?.name || 'Unknown',
          contact_name: contact ? `${contact.first_name} ${contact.last_name}` : null,
          contact_phone: contact?.phone || null,
          contact_email: contact?.email || null,
          vehicle_name: vehicle?.name || null,
          vehicle_licence_plate: vehicle?.licence_plate || null
        };
      })
    );

    return c.json({ success: true, jobs: enrichedJobs });
    
  } catch (error) {
    return internalError(c, 'transport.getJobs', error);
  }
});

// ============================================================================
// TRANSPORT JOBS - GET ONE
// ============================================================================

app.get('/jobs/:id', async (c) => {
  try {
    const auth = validateUserPermission(c, 'transport:read');
    
    const jobId = c.req.param('id');
    const jobKey = `transport_job:${auth.tenant_id}:${jobId}`;
    const job = await kv.get(jobKey);
    
    if (!job) {
      return c.json({ error: 'Transport job not found' }, 404);
    }
    
    // Enrich with details
    const householdKey = `customer:${auth.tenant_id}:household:${job.household_id}`;
    const householdStr = await kv.get(householdKey);
    const household = householdStr ? (typeof householdStr === 'string' ? JSON.parse(householdStr) : householdStr) : null;
    
    const petKey = `customer:${auth.tenant_id}:pet:${job.household_id}:${job.pet_id}`;
    const petStr = await kv.get(petKey);
    const pet = petStr ? (typeof petStr === 'string' ? JSON.parse(petStr) : petStr) : null;
    
    let contact = null;
    if (household?.primary_contact_id) {
      const contactKey = `customer:${auth.tenant_id}:contact:${job.household_id}:${household.primary_contact_id}`;
      const contactStr = await kv.get(contactKey);
      contact = contactStr ? (typeof contactStr === 'string' ? JSON.parse(contactStr) : contactStr) : null;
    }
    
    let vehicle = null;
    if (job.assigned_vehicle_id) {
      const vehicleKey = `transport_vehicle:${auth.tenant_id}:${job.assigned_vehicle_id}`;
      vehicle = await kv.get(vehicleKey);
    }
    
    const enrichedJob = {
      ...job,
      pet_name: pet?.name || 'Unknown',
      // Private bucket — mint a signed URL from the stored path.
      pet_photo_url: await signPetPhotoUrl(storedPetPhoto(pet)),
      household_name: household?.name || 'Unknown',
      contact_name: contact ? `${contact.first_name} ${contact.last_name}` : null,
      contact_phone: contact?.phone || null,
      contact_email: contact?.email || null,
      vehicle_name: vehicle?.name || null,
      vehicle_licence_plate: vehicle?.licence_plate || null
    };
    
    return c.json({ success: true, job: enrichedJob });
    
  } catch (error) {
    return internalError(c, 'transport.getJobsId', error);
  }
});

// ============================================================================
// TRANSPORT JOBS - UPDATE
// ============================================================================

app.patch('/jobs/:id', requireJobWrite, async (c) => {
  try {
    const auth = validateUserPermission(c, 'transport:write');
    
    const jobId = c.req.param('id');
    const jobKey = `transport_job:${auth.tenant_id}:${jobId}`;
    const job = await kv.get(jobKey);
    
    if (!job) {
      return c.json({ error: 'Transport job not found' }, 404);
    }
    
    const body = await c.req.json();
    const parsedUpdates = updateJobSchema.safeParse(body);
    if (!parsedUpdates.success) return c.json({ error: parsedUpdates.error.format() }, 400);
    const updates = parsedUpdates.data;

    // Update job. The schema whitelist guarantees id/tenant_id/created_by/
    // location_id cannot be overwritten here.
    const updatedJob = {
      ...job,
      ...updates,
      updated_at: new Date().toISOString()
    };

    // If date changed, update indices. location_id is immutable (excluded
    // from the schema), so the location index only ever moves across dates.
    if (updates.service_date && updates.service_date !== job.service_date) {
      // Remove from old index
      const oldDateIndexKey = `transport_job_index:${auth.tenant_id}:${job.service_date}`;
      const oldIndex = await kv.get(oldDateIndexKey) || [];
      await kv.set(oldDateIndexKey, oldIndex.filter((id: string) => id !== jobId));
      
      // Add to new index
      const newDateIndexKey = `transport_job_index:${auth.tenant_id}:${updates.service_date}`;
      const newIndex = await kv.get(newDateIndexKey) || [];
      await kv.set(newDateIndexKey, [...newIndex, jobId]);
      
      // Update location index
      const oldLocationIndexKey = `transport_job_location_index:${auth.tenant_id}:${job.location_id}:${job.service_date}`;
      const oldLocationIndex = await kv.get(oldLocationIndexKey) || [];
      await kv.set(oldLocationIndexKey, oldLocationIndex.filter((id: string) => id !== jobId));
      
      const newLocationIndexKey = `transport_job_location_index:${auth.tenant_id}:${job.location_id}:${updates.service_date}`;
      const newLocationIndex = await kv.get(newLocationIndexKey) || [];
      await kv.set(newLocationIndexKey, [...newLocationIndex, jobId]);
    }
    
    await kv.set(jobKey, updatedJob);
    
    // Log event
    const eventId = generateId('tevt');
    const event = {
      id: eventId,
      tenant_id: auth.tenant_id,
      transport_job_id: jobId,
      event_type: 'updated',
      event_time: new Date().toISOString(),
      actor_user_id: auth.user.id,
      metadata: updates
    };
    
    const eventKey = `transport_event:${auth.tenant_id}:${eventId}`;
    await kv.set(eventKey, event);
    
    return c.json({ success: true, job: updatedJob });
    
  } catch (error) {
    return internalError(c, 'transport.patchJobsId', error);
  }
});

// ============================================================================
// TRANSPORT JOBS - DELETE
// ============================================================================

app.delete('/jobs/:id', requireRole('admin', 'manager'), async (c) => {
  try {
    const auth = validateUserPermission(c, 'transport:write');
    
    const jobId = c.req.param('id');
    const jobKey = `transport_job:${auth.tenant_id}:${jobId}`;
    const job = await kv.get(jobKey);
    
    if (!job) {
      return c.json({ error: 'Transport job not found' }, 404);
    }
    
    // Remove from indices
    const dateIndexKey = `transport_job_index:${auth.tenant_id}:${job.service_date}`;
    const dateIndex = await kv.get(dateIndexKey) || [];
    await kv.set(dateIndexKey, dateIndex.filter((id: string) => id !== jobId));
    
    const locationIndexKey = `transport_job_location_index:${auth.tenant_id}:${job.location_id}:${job.service_date}`;
    const locationIndex = await kv.get(locationIndexKey) || [];
    await kv.set(locationIndexKey, locationIndex.filter((id: string) => id !== jobId));
    
    // Delete job
    await kv.del(jobKey);
    
    // Log event
    const auditId = generateId('audit');
    await kv.set(`audit:${auth.tenant_id}:${auditId}`, {
      id: auditId,
      tenant_id: auth.tenant_id,
      user_id: auth.user.id,
      action: 'transport_job_deleted',
      resource_type: 'transport_job',
      resource_id: jobId,
      metadata: { job },
      created_at: new Date().toISOString()
    });
    
    return c.json({ success: true });
    
  } catch (error) {
    return internalError(c, 'transport.deleteJobsId', error);
  }
});

// ============================================================================
// TRANSPORT JOBS - ASSIGN DRIVER
// ============================================================================

app.post('/jobs/:id/assign', requireJobWrite, async (c) => {
  try {
    const auth = validateUserPermission(c, 'transport:write');
    
    const jobId = c.req.param('id');
    const parsedAssign = assignJobSchema.safeParse(await c.req.json());
    if (!parsedAssign.success) return c.json({ error: parsedAssign.error.format() }, 400);
    const { driver_user_id, vehicle_id } = parsedAssign.data;

    const jobKey = `transport_job:${auth.tenant_id}:${jobId}`;
    const job = await kv.get(jobKey);

    if (!job) {
      return c.json({ error: 'Transport job not found' }, 404);
    }

    // Vehicle must exist in this tenant — the assignment is meaningless (and
    // the UI shows 'Assigned' with no vehicle) otherwise.
    const vehicleKey = `transport_vehicle:${auth.tenant_id}:${vehicle_id}`;
    const vehicle = await kv.get(vehicleKey);
    if (!vehicle) {
      return c.json({ error: 'Vehicle not found' }, 404);
    }

    // No driver given → fall back to the vehicle's default driver, which is
    // what the assign dialog promises. If the vehicle has none, reject rather
    // than silently leaving the job unassigned.
    const resolvedDriverId = driver_user_id || vehicle.assigned_driver_user_id || null;
    if (!resolvedDriverId) {
      return c.json({
        error: 'This vehicle has no default driver. Select a driver to assign.'
      }, 400);
    }

    // Update assignment
    const updatedJob = {
      ...job,
      assigned_driver_user_id: resolvedDriverId,
      assigned_vehicle_id: vehicle_id,
      updated_at: new Date().toISOString()
    };

    await kv.set(jobKey, updatedJob);

    // Log event
    const eventId = generateId('tevt');
    const event = {
      id: eventId,
      tenant_id: auth.tenant_id,
      transport_job_id: jobId,
      event_type: 'assigned',
      event_time: new Date().toISOString(),
      actor_user_id: auth.user.id,
      metadata: { driver_user_id: resolvedDriverId, vehicle_id }
    };
    
    const eventKey = `transport_event:${auth.tenant_id}:${eventId}`;
    await kv.set(eventKey, event);
    
    return c.json({ success: true, job: updatedJob });
    
  } catch (error) {
    return internalError(c, 'transport.postJobsIdAssign', error);
  }
});

// ============================================================================
// DRIVER STATUS UPDATE
// ============================================================================

app.post('/jobs/:id/status', async (c) => {
  try {
    // Allow both drivers (for their jobs) and managers/admins (for any job)
    const auth = validateUserPermission(c, 'transport:read');
    
    const jobId = c.req.param('id');
    const parsedStatus = statusUpdateSchema.safeParse(await c.req.json());
    if (!parsedStatus.success) return c.json({ error: parsedStatus.error.format() }, 400);
    const { event_type, notes } = parsedStatus.data;

    const jobKey = `transport_job:${auth.tenant_id}:${jobId}`;
    const job = await kv.get(jobKey);

    if (!job) {
      return c.json({ error: 'Transport job not found' }, 404);
    }

    // auth.user is the AuthenticatedUser from requireAuth — its .role is
    // already sourced from app_metadata, no need to re-read.
    const userRole = auth.user.role || 'driver';
    // 'owner' is not a Role in this codebase (Role = admin | manager |
    // assistant_manager | staff), so the comparison was always false.
    const isManager = userRole === 'manager' || userRole === 'admin';

    // Drivers can only update jobs assigned to them
    // Managers/Admins can update any job
    if (!isManager && job.assigned_driver_user_id !== auth.user.id) {
      return c.json({ error: 'This job is not assigned to you' }, 403);
    }

    // Terminal states accept no further status events.
    if (job.status === 'completed' || job.status === 'cancelled' || job.status === 'failed') {
      return c.json({ error: `Job is already ${job.status}` }, 409);
    }

    const now = new Date().toISOString();

    // Update job status based on event
    const updatedJob = { ...job, updated_at: now };

    if (event_type === 'started') {
      updatedJob.status = 'in_progress';
    } else if (event_type === 'completed') {
      updatedJob.status = 'completed';
    } else if (event_type === 'failed') {
      // Driver-reported unsuccessful attempt (customer not home, …).
      // Distinct from 'cancelled' (dispatcher decision) so failed stops stay
      // visible and re-schedulable.
      updatedJob.status = 'failed';
    } else if (event_type === 'cancelled') {
      updatedJob.status = 'cancelled';
    } else if (event_type === 'picked_up') {
      // Intermediate event; the timestamp doubles as roundtrip leg state
      // (leg 1 done → driver UI moves on to the drop-off leg).
      updatedJob.picked_up_at = now;
    } else if (event_type === 'dropped_off') {
      updatedJob.dropped_off_at = now;
    }
    // 'arrived' is logged for audit only and changes nothing on the job.

    await kv.set(jobKey, updatedJob);
    
    // Log event
    const eventId = generateId('tevt');
    const event = {
      id: eventId,
      tenant_id: auth.tenant_id,
      transport_job_id: jobId,
      event_type,
      event_time: now,
      actor_user_id: auth.user.id,
      metadata: { notes }
    };
    
    const eventKey = `transport_event:${auth.tenant_id}:${eventId}`;
    await kv.set(eventKey, event);
    
    return c.json({ success: true, job: updatedJob });
    
  } catch (error) {
    return internalError(c, 'transport.postJobsIdStatus', error);
  }
});

// ============================================================================
// VEHICLES - CREATE
// ============================================================================

app.post('/vehicles', requireRole('admin', 'manager'), async (c) => {
  try {
    const auth = validateUserPermission(c, 'transport:write');
    
    const parsedVehicle = createVehicleSchema.safeParse(await c.req.json());
    if (!parsedVehicle.success) return c.json({ error: parsedVehicle.error.format() }, 400);
    const { location_id, name, licence_plate, capacity, notes, assigned_driver_user_id, is_active } = parsedVehicle.data;

    const vehicleId = generateId('tveh');
    const now = new Date().toISOString();

    const vehicle = {
      id: vehicleId,
      tenant_id: auth.tenant_id,
      location_id,
      name,
      licence_plate,
      capacity,
      assigned_driver_user_id: assigned_driver_user_id || null,
      notes: notes || null,
      is_active: is_active ?? true,
      created_at: now,
      updated_at: now
    };
    
    const vehicleKey = `transport_vehicle:${auth.tenant_id}:${vehicleId}`;
    await kv.set(vehicleKey, vehicle);
    
    // Add to location index
    const locationIndexKey = `transport_vehicle_location_index:${auth.tenant_id}:${location_id}`;
    const existingIndex = await kv.get(locationIndexKey) || [];
    await kv.set(locationIndexKey, [...existingIndex, vehicleId]);
    
    return c.json({ success: true, vehicle }, 201);
    
  } catch (error) {
    return internalError(c, 'transport.postVehicles', error);
  }
});

// ============================================================================
// VEHICLES - LIST
// ============================================================================

app.get('/vehicles', async (c) => {
  try {
    const auth = validateUserPermission(c, 'transport:read');
    
    const url = new URL(c.req.url);
    const location_id = url.searchParams.get('location_id');
    
    let vehicleIds: string[] = [];
    
    if (location_id) {
      const locationIndexKey = `transport_vehicle_location_index:${auth.tenant_id}:${location_id}`;
      vehicleIds = await kv.get(locationIndexKey) || [];
    } else {
      // Get all vehicles by prefix
      const allVehiclesKey = `transport_vehicle:${auth.tenant_id}:`;
      const allVehicles = await kv.getByPrefix(allVehiclesKey);
      vehicleIds = allVehicles.map((v: any) => v.id);
    }
    
    // Fetch all vehicles
    const vehicles = await Promise.all(
      vehicleIds.map(async (vehicleId) => {
        const vehicleKey = `transport_vehicle:${auth.tenant_id}:${vehicleId}`;
        return await kv.get(vehicleKey);
      })
    );
    
    const filteredVehicles = vehicles.filter((v) => v !== null);
    
    return c.json({ success: true, vehicles: filteredVehicles });
    
  } catch (error) {
    return internalError(c, 'transport.getVehicles', error);
  }
});

// ============================================================================
// VEHICLES - UPDATE
// ============================================================================

app.patch('/vehicles/:id', requireRole('admin', 'manager'), async (c) => {
  try {
    const auth = validateUserPermission(c, 'transport:write');
    
    const vehicleId = c.req.param('id');
    const vehicleKey = `transport_vehicle:${auth.tenant_id}:${vehicleId}`;
    const vehicle = await kv.get(vehicleKey);
    
    if (!vehicle) {
      return c.json({ error: 'Vehicle not found' }, 404);
    }

    const parsedVehicleUpdates = updateVehicleSchema.safeParse(await c.req.json());
    if (!parsedVehicleUpdates.success) return c.json({ error: parsedVehicleUpdates.error.format() }, 400);
    const updates = parsedVehicleUpdates.data;

    // Whitelisted spread — id/tenant_id/created_at cannot be overwritten.
    const updatedVehicle = {
      ...vehicle,
      ...updates,
      updated_at: new Date().toISOString()
    };

    // The UI allows changing a vehicle's home location — move it between the
    // per-location indexes or it keeps appearing at the old location.
    if (updates.location_id && updates.location_id !== vehicle.location_id) {
      const oldIndexKey = `transport_vehicle_location_index:${auth.tenant_id}:${vehicle.location_id}`;
      const oldIndex = await kv.get(oldIndexKey) || [];
      await kv.set(oldIndexKey, oldIndex.filter((id: string) => id !== vehicleId));

      const newIndexKey = `transport_vehicle_location_index:${auth.tenant_id}:${updates.location_id}`;
      const newIndex = await kv.get(newIndexKey) || [];
      if (!newIndex.includes(vehicleId)) {
        await kv.set(newIndexKey, [...newIndex, vehicleId]);
      }
    }

    await kv.set(vehicleKey, updatedVehicle);

    return c.json({ success: true, vehicle: updatedVehicle });
    
  } catch (error) {
    return internalError(c, 'transport.patchVehiclesId', error);
  }
});

// ============================================================================
// VEHICLES - DELETE
// ============================================================================

app.delete('/vehicles/:id', requireRole('admin', 'manager'), async (c) => {
  try {
    const auth = validateUserPermission(c, 'transport:write');
    
    const vehicleId = c.req.param('id');
    const vehicleKey = `transport_vehicle:${auth.tenant_id}:${vehicleId}`;
    const vehicle = await kv.get(vehicleKey);
    
    if (!vehicle) {
      return c.json({ error: 'Vehicle not found' }, 404);
    }

    // Refuse to delete a vehicle that open jobs still reference — deleting it
    // would leave those jobs pointing at nothing ('Assigned' with no vehicle).
    const allJobs = await kv.getByPrefix(`transport_job:${auth.tenant_id}:`);
    const openJobs = allJobs.filter((j: any) =>
      j.assigned_vehicle_id === vehicleId &&
      (j.status === 'scheduled' || j.status === 'in_progress')
    );
    if (openJobs.length > 0) {
      return c.json({
        error: `Vehicle is assigned to ${openJobs.length} open transport job${openJobs.length !== 1 ? 's' : ''}. Reassign or complete them first.`
      }, 409);
    }

    // Remove from location index
    const locationIndexKey = `transport_vehicle_location_index:${auth.tenant_id}:${vehicle.location_id}`;
    const locationIndex = await kv.get(locationIndexKey) || [];
    await kv.set(locationIndexKey, locationIndex.filter((id: string) => id !== vehicleId));
    
    // Delete vehicle
    await kv.del(vehicleKey);
    
    return c.json({ success: true });
    
  } catch (error) {
    return internalError(c, 'transport.deleteVehiclesId', error);
  }
});

export default app;