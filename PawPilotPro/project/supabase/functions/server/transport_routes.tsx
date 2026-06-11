/**
 * Transport Routes - MDC Operations Centre
 * Server-side transport job management with full tenant isolation
 * NO SEED DATA - all operations use real household and pet references
 */

import { Context, Hono } from 'npm:hono';
import { cors } from 'npm:hono/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';
import * as kv from './kv_store.tsx';
import { requireAuth, AuthenticatedUser } from './_shared/auth.ts';
import { internalError } from './_shared/log.ts';

const app = new Hono();

// Enable CORS
app.use('*', cors());

// Every transport route requires a validated user. requireAuth handles JWT
// validation server-side with SERVICE_ROLE_KEY; the ad-hoc ANON_KEY-validated
// getUserFromToken helper that used to live here has been removed.
app.use('*', requireAuth);

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
 * Get active drivers for a location/tenant
 * Active driver = user with isActive=true and templateId='tpl-driver'
 */
async function getActiveDrivers(tenantId: string, locationId?: string) {
  // Get Supabase client to fetch users
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  
  if (!serviceRoleKey) {
    console.error('[getActiveDrivers] SUPABASE_SERVICE_ROLE_KEY not available - cannot list users');
    return [];
  }
  
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    serviceRoleKey
  );
  
  try {
    console.log('[getActiveDrivers] Fetching users from Supabase Auth...');
    
    // Fetch all users from Supabase Auth
    const { data: { users }, error } = await supabase.auth.admin.listUsers();
    
    if (error) {
      console.error('[getActiveDrivers] Error fetching users:', error);
      return [];
    }
    
    console.log(`[getActiveDrivers] Found ${users?.length || 0} total users`);
    
    // Filter for active drivers with the Driver template
    const activeDrivers = users.filter((user: any) => {
      // Must be active (not banned)
      if (user.banned_until) {
        return false;
      }
      
      // Must have the Driver template assigned. This is an AUTHORIZATION
      // check, so it reads app_metadata only (server-set, untamperable).
      const templateId = user.app_metadata?.templateId;
      if (templateId !== 'tpl-driver') {
        return false;
      }

      // If location_id specified, check location assignment
      // (app_metadata only; server-set).
      if (locationId) {
        const locationIds = user.app_metadata?.locationIds ?? [];
        
        // Check if user has global access ('all') or includes the specific location
        if (!locationIds.includes('all') && !locationIds.includes(locationId)) {
          return false;
        }
      }
      
      return true;
    });
    
    console.log(`[getActiveDrivers] Found ${activeDrivers.length} drivers with tpl-driver template`);
    
    // Map to a simpler format
    return activeDrivers.map((user: any) => ({
      user_id: user.id,
      first_name: user.user_metadata?.name?.split(' ')[0] || user.email?.split('@')[0] || 'Unknown',
      last_name: user.user_metadata?.name?.split(' ').slice(1).join(' ') || '',
      email: user.email,
      // Role lives in app_metadata (server-set, untamperable from client).
      role: user.app_metadata?.role || 'staff',
      // Security fields come from app_metadata only (server-set).
      location_ids: user.app_metadata?.locationIds ?? []
    }));
    
  } catch (error) {
    console.error('[getActiveDrivers] Exception:', error);
    return [];
  }
}

/**
 * Get active vehicles for a location/tenant
 */
async function getActiveVehicles(tenantId: string, locationId?: string) {
  const allVehicles = await kv.getByPrefix(`transport_vehicle:${tenantId}:`);
  
  console.log(`[getActiveVehicles] Found ${allVehicles.length} total vehicles`);
  
  // Debug: Log first few vehicles
  allVehicles.slice(0, 3).forEach((vehicle: any) => {
    console.log(`[getActiveVehicles] Vehicle ${vehicle.name} - is_active: ${vehicle.is_active}, location_id: ${vehicle.location_id}`);
  });
  
  const activeVehicles = allVehicles.filter((vehicle: any) => {
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
  
  console.log(`[getActiveVehicles] Found ${activeVehicles.length} active vehicles`);
  
  return activeVehicles;
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
    console.error('Error getting active drivers:', error);
    return internalError(c, 'transport.getActiveDrivers', error);
  }
});

// ============================================================================
// TRANSPORT JOBS - CREATE
// ============================================================================

app.post('/jobs', async (c) => {
  try {
    const auth = validateUserPermission(c, 'transport:write');
    
    const body = await c.req.json();
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
    } = body;
    
    // Validation
    if (!location_id || !service_date || !direction || !household_id || !pet_id) {
      return c.json({ error: 'Missing required fields' }, 400);
    }
    
    if (!address_pickup && !address_dropoff) {
      return c.json({ error: 'At least one address (pickup or dropoff) is required' }, 400);
    }
    
    // Verify household and pet exist and belong to tenant
    const householdKey = `customer:${auth.tenant_id}:household:${household_id}`;
    console.log('[Transport Job Create] Looking for household with key:', householdKey);
    const household = await kv.get(householdKey);
    
    if (!household) {
      console.log('[Transport Job Create] Household not found');
      return c.json({ error: 'Household not found or access denied' }, 404);
    }
    
    console.log('[Transport Job Create] Household found');
    
    const petKey = `customer:${auth.tenant_id}:pet:${household_id}:${pet_id}`;
    console.log('[Transport Job Create] Looking for pet with key:', petKey);
    const pet = await kv.get(petKey);
    
    if (!pet) {
      console.log('[Transport Job Create] Pet not found. Searching for all pets in household...');
      const allPets = await kv.getByPrefix(`customer:${auth.tenant_id}:pet:${household_id}:`);
      console.log('[Transport Job Create] Pets in household:', allPets.length);
      return c.json({ error: 'Pet not found or access denied' }, 404);
    }
    
    console.log('[Transport Job Create] Pet found');
    
    // Parse if needed (KV store may return strings)
    const householdData = typeof household === 'string' ? JSON.parse(household) : household;
    const petData = typeof pet === 'string' ? JSON.parse(pet) : pet;
    
    // Verify pet belongs to household
    if (petData.household_id !== household_id) {
      return c.json({ error: 'Pet does not belong to specified household' }, 400);
    }
    
    // 3. Check driver assignment logic
    const activeDrivers = await getActiveDrivers(auth.tenant_id, location_id);
    const driverCount = activeDrivers.length;
    
    console.log(`[Transport] Driver assignment check - Found ${driverCount} active drivers for location ${location_id}`);
    
    // Conditional driver assignment logic
    let assigned_driver_user_id = driver_user_id; // Respect manual assignment if provided
    let assigned_vehicle_id = vehicle_id;
    let auto_assigned = false;
    
    if (driverCount === 0) {
      // Rule A: No drivers - Allow creation but job will be unassigned
      console.log('[Transport] Rule A: No drivers configured - creating unassigned job');
      assigned_driver_user_id = undefined;
      assigned_vehicle_id = undefined;
    } else if (driverCount === 1) {
      // Rule B: Exactly one driver - Auto-assign if not manually specified
      if (!assigned_driver_user_id) {
        const soleDriver = activeDrivers[0];
        assigned_driver_user_id = soleDriver.user_id;
        auto_assigned = true;
        console.log(`[Transport] Rule B: Auto-assigning to sole driver: ${soleDriver.first_name} ${soleDriver.last_name} (${soleDriver.user_id})`);
        
        // Also auto-assign vehicle if only one active vehicle
        if (!assigned_vehicle_id) {
          const activeVehicles = await getActiveVehicles(auth.tenant_id, location_id);
          if (activeVehicles.length === 1) {
            assigned_vehicle_id = activeVehicles[0].id;
            console.log(`[Transport] Also auto-assigning sole vehicle: ${activeVehicles[0].name} (${activeVehicles[0].id})`);
          }
        }
      }
    } else {
      // Rule C: Multiple drivers - Allow creation with or without assignment
      console.log(`[Transport] Rule C: ${driverCount} drivers available - assignment ${assigned_driver_user_id ? 'provided' : 'not provided'}`);
    }
    
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
      address_pickup,
      address_dropoff,
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
    console.error('Error creating transport job:', error);
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
    
    let jobIds: string[] = [];
    
    // Query by date and location for efficiency
    if (service_date && location_id) {
      const locationIndexKey = `transport_job_location_index:${auth.tenant_id}:${location_id}:${service_date}`;
      jobIds = await kv.get(locationIndexKey) || [];
    } else if (service_date) {
      const dateIndexKey = `transport_job_index:${auth.tenant_id}:${service_date}`;
      jobIds = await kv.get(dateIndexKey) || [];
    } else {
      // Get all jobs by prefix (less efficient, but works for smaller datasets)
      const allJobsKey = `transport_job:${auth.tenant_id}:`;
      const allJobs = await kv.getByPrefix(allJobsKey);
      jobIds = allJobs.map((j: any) => j.id);
    }
    
    // Fetch all jobs
    const jobs = await Promise.all(
      jobIds.map(async (jobId) => {
        const jobKey = `transport_job:${auth.tenant_id}:${jobId}`;
        return await kv.get(jobKey);
      })
    );
    
    // Filter out null values and apply filters
    let filteredJobs = jobs.filter((j) => j !== null);
    
    if (location_id) {
      filteredJobs = filteredJobs.filter((j) => j.location_id === location_id);
    }
    
    if (status) {
      filteredJobs = filteredJobs.filter((j) => j.status === status);
    }
    
    if (assigned_driver_user_id) {
      filteredJobs = filteredJobs.filter((j) => j.assigned_driver_user_id === assigned_driver_user_id);
    }
    
    // Enrich with household and pet data
    const enrichedJobs = await Promise.all(
      filteredJobs.map(async (job) => {
        const householdKey = `customer:${auth.tenant_id}:household:${job.household_id}`;
        const householdStr = await kv.get(householdKey);
        const household = householdStr ? (typeof householdStr === 'string' ? JSON.parse(householdStr) : householdStr) : null;
        
        const petKey = `customer:${auth.tenant_id}:pet:${job.household_id}:${job.pet_id}`;
        const petStr = await kv.get(petKey);
        const pet = petStr ? (typeof petStr === 'string' ? JSON.parse(petStr) : petStr) : null;
        
        // Get primary contact
        let contact = null;
        if (household?.primary_contact_id) {
          const contactKey = `customer:${auth.tenant_id}:contact:${job.household_id}:${household.primary_contact_id}`;
          const contactStr = await kv.get(contactKey);
          contact = contactStr ? (typeof contactStr === 'string' ? JSON.parse(contactStr) : contactStr) : null;
        }
        
        // Get vehicle if assigned
        let vehicle = null;
        if (job.assigned_vehicle_id) {
          const vehicleKey = `transport_vehicle:${auth.tenant_id}:${job.assigned_vehicle_id}`;
          vehicle = await kv.get(vehicleKey);
        }
        
        return {
          ...job,
          pet_name: pet?.name || 'Unknown',
          pet_photo_url: pet?.photo_url || null,
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
    console.error('Error listing transport jobs:', error);
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
      pet_photo_url: pet?.photo_url || null,
      household_name: household?.name || 'Unknown',
      contact_name: contact ? `${contact.first_name} ${contact.last_name}` : null,
      contact_phone: contact?.phone || null,
      contact_email: contact?.email || null,
      vehicle_name: vehicle?.name || null,
      vehicle_licence_plate: vehicle?.licence_plate || null
    };
    
    return c.json({ success: true, job: enrichedJob });
    
  } catch (error) {
    console.error('Error fetching transport job:', error);
    return internalError(c, 'transport.getJobsId', error);
  }
});

// ============================================================================
// TRANSPORT JOBS - UPDATE
// ============================================================================

app.patch('/jobs/:id', async (c) => {
  try {
    const auth = validateUserPermission(c, 'transport:write');
    
    const jobId = c.req.param('id');
    const jobKey = `transport_job:${auth.tenant_id}:${jobId}`;
    const job = await kv.get(jobKey);
    
    if (!job) {
      return c.json({ error: 'Transport job not found' }, 404);
    }
    
    const updates = await c.req.json();
    
    // Update job
    const updatedJob = {
      ...job,
      ...updates,
      updated_at: new Date().toISOString()
    };
    
    // If date changed, update indices
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
    console.error('Error updating transport job:', error);
    return internalError(c, 'transport.patchJobsId', error);
  }
});

// ============================================================================
// TRANSPORT JOBS - DELETE
// ============================================================================

app.delete('/jobs/:id', async (c) => {
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
    console.error('Error deleting transport job:', error);
    return internalError(c, 'transport.deleteJobsId', error);
  }
});

// ============================================================================
// TRANSPORT JOBS - ASSIGN DRIVER
// ============================================================================

app.post('/jobs/:id/assign', async (c) => {
  try {
    const auth = validateUserPermission(c, 'transport:write');
    
    const jobId = c.req.param('id');
    const { driver_user_id, vehicle_id } = await c.req.json();
    
    const jobKey = `transport_job:${auth.tenant_id}:${jobId}`;
    const job = await kv.get(jobKey);
    
    if (!job) {
      return c.json({ error: 'Transport job not found' }, 404);
    }
    
    // Update assignment
    const updatedJob = {
      ...job,
      assigned_driver_user_id: driver_user_id,
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
      metadata: { driver_user_id, vehicle_id }
    };
    
    const eventKey = `transport_event:${auth.tenant_id}:${eventId}`;
    await kv.set(eventKey, event);
    
    return c.json({ success: true, job: updatedJob });
    
  } catch (error) {
    console.error('Error assigning transport job:', error);
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
    const { event_type, notes } = await c.req.json();
    
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
    
    const now = new Date().toISOString();
    
    // Update job status based on event
    let updatedJob = { ...job, updated_at: now };
    
    if (event_type === 'started') {
      updatedJob.status = 'in_progress';
    } else if (event_type === 'completed') {
      updatedJob.status = 'completed';
    } else if (event_type === 'cancelled') {
      updatedJob.status = 'cancelled';
    } else if (event_type === 'arrived' || event_type === 'picked_up' || event_type === 'dropped_off') {
      // These are intermediate events that don't change the overall status
      // but are logged for audit purposes
    }
    
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
    console.error('Error updating transport job status:', error);
    return internalError(c, 'transport.postJobsIdStatus', error);
  }
});

// ============================================================================
// VEHICLES - CREATE
// ============================================================================

app.post('/vehicles', async (c) => {
  try {
    const auth = validateUserPermission(c, 'transport:write');
    
    const body = await c.req.json();
    const { location_id, name, licence_plate, capacity, notes, assigned_driver_user_id } = body;
    
    if (!location_id || !name || !licence_plate || !capacity) {
      return c.json({ error: 'Missing required fields' }, 400);
    }
    
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
      is_active: true,
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
    console.error('Error creating vehicle:', error);
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
    console.error('Error listing vehicles:', error);
    return internalError(c, 'transport.getVehicles', error);
  }
});

// ============================================================================
// VEHICLES - UPDATE
// ============================================================================

app.patch('/vehicles/:id', async (c) => {
  try {
    const auth = validateUserPermission(c, 'transport:write');
    
    const vehicleId = c.req.param('id');
    const vehicleKey = `transport_vehicle:${auth.tenant_id}:${vehicleId}`;
    const vehicle = await kv.get(vehicleKey);
    
    if (!vehicle) {
      return c.json({ error: 'Vehicle not found' }, 404);
    }
    
    const updates = await c.req.json();
    
    const updatedVehicle = {
      ...vehicle,
      ...updates,
      updated_at: new Date().toISOString()
    };
    
    await kv.set(vehicleKey, updatedVehicle);
    
    return c.json({ success: true, vehicle: updatedVehicle });
    
  } catch (error) {
    console.error('Error updating vehicle:', error);
    return internalError(c, 'transport.patchVehiclesId', error);
  }
});

// ============================================================================
// VEHICLES - DELETE
// ============================================================================

app.delete('/vehicles/:id', async (c) => {
  try {
    const auth = validateUserPermission(c, 'transport:write');
    
    const vehicleId = c.req.param('id');
    const vehicleKey = `transport_vehicle:${auth.tenant_id}:${vehicleId}`;
    const vehicle = await kv.get(vehicleKey);
    
    if (!vehicle) {
      return c.json({ error: 'Vehicle not found' }, 404);
    }
    
    // Remove from location index
    const locationIndexKey = `transport_vehicle_location_index:${auth.tenant_id}:${vehicle.location_id}`;
    const locationIndex = await kv.get(locationIndexKey) || [];
    await kv.set(locationIndexKey, locationIndex.filter((id: string) => id !== vehicleId));
    
    // Delete vehicle
    await kv.del(vehicleKey);
    
    return c.json({ success: true });
    
  } catch (error) {
    console.error('Error deleting vehicle:', error);
    return internalError(c, 'transport.deleteVehiclesId', error);
  }
});

export default app;