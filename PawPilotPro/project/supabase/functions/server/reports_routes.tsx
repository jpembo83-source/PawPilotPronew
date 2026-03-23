// Reports Routes - PawPilot Pro
// Aggregated reporting across all modules

import { Hono } from 'npm:hono';
import { createClient } from 'npm:@supabase/supabase-js';
import * as kv from './kv_store.tsx';

const app = new Hono();

// ============================================================================
// UTILITIES
// ============================================================================

const getUserFromToken = async (token: string) => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
  if (!supabaseUrl || !supabaseAnonKey) throw new Error('Missing Supabase configuration');
  const supabase = createClient(supabaseUrl, supabaseAnonKey);
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) throw new Error('Invalid or expired token');
  return user;
};

const getTenantId = (user: any): string => user.user_metadata?.tenant_id || user.id;

const auth = async (c: any) => {
  const token = c.req.header('X-User-Token')?.replace('Bearer ', '');
  if (!token) return null;
  try { return await getUserFromToken(token); } catch { return null; }
};

// ============================================================================
// PETS REPORT
// ============================================================================

app.get('/pets', async (c) => {
  try {
    const user = await auth(c);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);
    const tenantId = getTenantId(user);

    const allPets = await kv.getByPrefix(`customer:${tenantId}:pet:`);
    const allHouseholds = await kv.getByPrefix(`customer:${tenantId}:household:`);
    const householdMap = new Map(allHouseholds.map((h: any) => [h.id, h.name]));

    const pets = allPets
      .filter((p: any) => p && p.id && p.name)
      .map((p: any) => ({
        name: p.name,
        breed: p.breed || '',
        species: p.species || '',
        sex: p.sex || '',
        weight: p.weight || '',
        dateOfBirth: p.dateOfBirth || p.date_of_birth || '',
        neutered: p.neutered ?? p.isNeutered ?? false,
        householdName: householdMap.get(p.household_id) || '',
        status: p.status || 'active',
      }));

    return c.json({ pets });
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

// ============================================================================
// BREEDS REPORT
// ============================================================================

app.get('/breeds', async (c) => {
  try {
    const user = await auth(c);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);
    const tenantId = getTenantId(user);

    const allPets = await kv.getByPrefix(`customer:${tenantId}:pet:`);
    const breedMap = new Map<string, string[]>();

    allPets.filter((p: any) => p && p.name).forEach((p: any) => {
      const breed = p.breed || 'Unknown';
      if (!breedMap.has(breed)) breedMap.set(breed, []);
      breedMap.get(breed)!.push(p.name);
    });

    const breeds = Array.from(breedMap.entries())
      .map(([breed, names]) => ({ breed, count: names.length, petNames: names.join(', ') }))
      .sort((a, b) => b.count - a.count);

    return c.json({ breeds });
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

// ============================================================================
// CUSTOMERS REPORT
// ============================================================================

app.get('/customers', async (c) => {
  try {
    const user = await auth(c);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);
    const tenantId = getTenantId(user);

    const allHouseholds = await kv.getByPrefix(`customer:${tenantId}:household:`);
    const allContacts = await kv.getByPrefix(`customer:${tenantId}:contact:`);
    const allPets = await kv.getByPrefix(`customer:${tenantId}:pet:`);

    const contactsByHousehold = new Map<string, any[]>();
    allContacts.forEach((c: any) => {
      if (!contactsByHousehold.has(c.household_id)) contactsByHousehold.set(c.household_id, []);
      contactsByHousehold.get(c.household_id)!.push(c);
    });

    const petsByHousehold = new Map<string, any[]>();
    allPets.filter((p: any) => p && p.id).forEach((p: any) => {
      if (!petsByHousehold.has(p.household_id)) petsByHousehold.set(p.household_id, []);
      petsByHousehold.get(p.household_id)!.push(p);
    });

    const customers = allHouseholds
      .filter((h: any) => h && h.id)
      .map((h: any) => {
        const contacts = contactsByHousehold.get(h.id) || [];
        const primary = contacts.find((c: any) => c.isPrimary) || contacts[0];
        const pets = petsByHousehold.get(h.id) || [];
        return {
          householdName: h.name,
          primaryContact: primary ? `${primary.firstName} ${primary.lastName}`.trim() : '',
          email: primary?.email || '',
          phone: primary?.phone || '',
          petCount: pets.length,
          petNames: pets.map((p: any) => p.name).join(', '),
          status: h.status || 'active',
          createdAt: h.createdAt ? h.createdAt.split('T')[0] : '',
        };
      });

    return c.json({ customers });
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

// ============================================================================
// ATTENDANCE REPORT
// ============================================================================

app.get('/attendance', async (c) => {
  try {
    const user = await auth(c);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);
    const tenantId = getTenantId(user);

    const fromDate = c.req.query('from_date') || '';
    const toDate = c.req.query('to_date') || '';
    const locationId = c.req.query('location_id') || '';

    const attendance: any[] = [];

    // Daycare bookings
    const daycareBookings = await kv.getByPrefix('daycare:booking:');
    daycareBookings
      .filter((b: any) => b && b.id && b.pet_name)
      .filter((b: any) => !fromDate || b.booking_date >= fromDate)
      .filter((b: any) => !toDate || b.booking_date <= toDate)
      .filter((b: any) => !locationId || b.location_id === locationId)
      .forEach((b: any) => {
        attendance.push({
          bookingDate: b.booking_date,
          petName: b.pet_name,
          householdName: b.household_name,
          serviceType: 'Daycare',
          status: b.booking_status,
          checkedInAt: b.checked_in_at || '',
          checkedOutAt: b.checked_out_at || '',
          locationName: b.location_name || '',
        });
      });

    // Grooming appointments
    const groomingApts = await kv.getByPrefix(`grooming-apt:${tenantId}:`);
    groomingApts
      .filter((a: any) => a && a.id)
      .filter((a: any) => !fromDate || a.appointment_date >= fromDate)
      .filter((a: any) => !toDate || a.appointment_date <= toDate)
      .filter((a: any) => !locationId || a.location_id === locationId)
      .forEach((a: any) => {
        attendance.push({
          bookingDate: a.appointment_date,
          petName: a.pet_name || '',
          householdName: a.household_name || '',
          serviceType: 'Grooming',
          status: a.status,
          checkedInAt: a.checked_in_at || '',
          checkedOutAt: a.checked_out_at || '',
          locationName: a.location_name || '',
        });
      });

    // Transport jobs
    const transportJobs = await kv.getByPrefix(`transport_job:${tenantId}:`);
    transportJobs
      .filter((j: any) => j && j.id)
      .filter((j: any) => !fromDate || j.service_date >= fromDate)
      .filter((j: any) => !toDate || j.service_date <= toDate)
      .filter((j: any) => !locationId || j.location_id === locationId)
      .forEach((j: any) => {
        attendance.push({
          bookingDate: j.service_date,
          petName: j.pet_name || '',
          householdName: j.household_name || '',
          serviceType: 'Transport',
          status: j.status,
          checkedInAt: '',
          checkedOutAt: '',
          locationName: j.location_name || '',
        });
      });

    // Overnight reservations
    const overnightRes = await kv.getByPrefix(`overnight:${tenantId}:reservation:`);
    overnightRes
      .filter((r: any) => r && r.id)
      .filter((r: any) => !fromDate || r.startDate >= fromDate)
      .filter((r: any) => !toDate || r.startDate <= toDate)
      .forEach((r: any) => {
        attendance.push({
          bookingDate: r.startDate,
          petName: r.petName || '',
          householdName: r.householdName || '',
          serviceType: 'Overnight',
          status: r.status,
          checkedInAt: r.checkInTime || '',
          checkedOutAt: r.checkOutTime || '',
          locationName: r.locationName || '',
        });
      });

    attendance.sort((a, b) => b.bookingDate.localeCompare(a.bookingDate));
    return c.json({ attendance });
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

// ============================================================================
// SERVICE USAGE REPORT
// ============================================================================

app.get('/service-usage', async (c) => {
  try {
    const user = await auth(c);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);
    const tenantId = getTenantId(user);

    const fromDate = c.req.query('from_date') || '';
    const toDate = c.req.query('to_date') || '';
    const locationId = c.req.query('location_id') || '';

    const usage: any[] = [];

    const daycareBookings = await kv.getByPrefix('daycare:booking:');
    daycareBookings
      .filter((b: any) => b && b.id && b.pet_name)
      .filter((b: any) => !fromDate || b.booking_date >= fromDate)
      .filter((b: any) => !toDate || b.booking_date <= toDate)
      .filter((b: any) => !locationId || b.location_id === locationId)
      .forEach((b: any) => usage.push({
        date: b.booking_date,
        module: 'Daycare',
        serviceType: b.service_type || 'Full Day',
        petName: b.pet_name,
        householdName: b.household_name,
        status: b.booking_status,
      }));

    const groomingApts = await kv.getByPrefix(`grooming-apt:${tenantId}:`);
    groomingApts
      .filter((a: any) => a && a.id)
      .filter((a: any) => !fromDate || a.appointment_date >= fromDate)
      .filter((a: any) => !toDate || a.appointment_date <= toDate)
      .filter((a: any) => !locationId || a.location_id === locationId)
      .forEach((a: any) => usage.push({
        date: a.appointment_date,
        module: 'Grooming',
        serviceType: a.service_type || 'Grooming',
        petName: a.pet_name || '',
        householdName: a.household_name || '',
        status: a.status,
      }));

    const transportJobs = await kv.getByPrefix(`transport_job:${tenantId}:`);
    transportJobs
      .filter((j: any) => j && j.id)
      .filter((j: any) => !fromDate || j.service_date >= fromDate)
      .filter((j: any) => !toDate || j.service_date <= toDate)
      .filter((j: any) => !locationId || j.location_id === locationId)
      .forEach((j: any) => usage.push({
        date: j.service_date,
        module: 'Transport',
        serviceType: j.service_type || 'Transport',
        petName: j.pet_name || '',
        householdName: j.household_name || '',
        status: j.status,
      }));

    const overnightRes = await kv.getByPrefix(`overnight:${tenantId}:reservation:`);
    overnightRes
      .filter((r: any) => r && r.id)
      .filter((r: any) => !fromDate || r.startDate >= fromDate)
      .filter((r: any) => !toDate || r.startDate <= toDate)
      .forEach((r: any) => usage.push({
        date: r.startDate,
        module: 'Overnights',
        serviceType: `${r.totalNights || 1} night(s)`,
        petName: r.petName || '',
        householdName: r.householdName || '',
        status: r.status,
      }));

    usage.sort((a, b) => b.date.localeCompare(a.date));
    return c.json({ usage });
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

// ============================================================================
// REVENUE REPORT
// ============================================================================

app.get('/revenue', async (c) => {
  try {
    const user = await auth(c);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);
    const tenantId = getTenantId(user);

    const fromDate = c.req.query('from_date') || '';
    const toDate = c.req.query('to_date') || '';

    const allHouseholds = await kv.getByPrefix(`customer:${tenantId}:household:`);
    const householdMap = new Map(allHouseholds.map((h: any) => [h.id, h.name]));

    const allInvoices: any[] = await kv.getByPrefix('invoice:');
    let invoices = allInvoices
      .filter((inv: any) => inv && inv.id && inv.household_id)
      .filter((inv: any) => !fromDate || (inv.issue_date || inv.created_at || '') >= fromDate)
      .filter((inv: any) => !toDate || (inv.issue_date || inv.created_at || '') <= toDate)
      .map((inv: any) => ({
        invoiceNumber: inv.invoice_number || inv.id.slice(0, 8).toUpperCase(),
        householdName: householdMap.get(inv.household_id) || inv.household_name || '',
        issueDate: inv.issue_date ? inv.issue_date.split('T')[0] : '',
        dueDate: inv.due_date ? inv.due_date.split('T')[0] : '',
        status: inv.status,
        subtotal: inv.subtotal || 0,
        tax: inv.tax_amount || 0,
        total: inv.total || 0,
        amountPaid: inv.amount_paid || 0,
        balance: (inv.total || 0) - (inv.amount_paid || 0),
      }));

    invoices.sort((a: any, b: any) => b.issueDate.localeCompare(a.issueDate));

    const summary = {
      totalInvoiced: invoices.reduce((s: number, i: any) => s + i.total, 0),
      totalPaid: invoices.reduce((s: number, i: any) => s + i.amountPaid, 0),
      totalOutstanding: invoices.reduce((s: number, i: any) => s + Math.max(0, i.balance), 0),
    };

    return c.json({ summary, invoices });
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

// ============================================================================
// CANCELLATIONS & NO-SHOWS REPORT
// ============================================================================

app.get('/cancellations', async (c) => {
  try {
    const user = await auth(c);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);
    const tenantId = getTenantId(user);

    const fromDate = c.req.query('from_date') || '';
    const toDate = c.req.query('to_date') || '';
    const locationId = c.req.query('location_id') || '';

    const cancellations: any[] = [];

    const daycareBookings = await kv.getByPrefix('daycare:booking:');
    daycareBookings
      .filter((b: any) => b && b.id && b.pet_name)
      .filter((b: any) => b.booking_status === 'cancelled' || b.booking_status === 'no_show')
      .filter((b: any) => !fromDate || b.booking_date >= fromDate)
      .filter((b: any) => !toDate || b.booking_date <= toDate)
      .filter((b: any) => !locationId || b.location_id === locationId)
      .forEach((b: any) => cancellations.push({
        date: b.booking_date,
        module: 'Daycare',
        petName: b.pet_name,
        householdName: b.household_name,
        status: b.booking_status,
        reason: b.cancellation_reason || '',
        cancelledAt: b.cancelled_at ? b.cancelled_at.split('T')[0] : '',
      }));

    const groomingApts = await kv.getByPrefix(`grooming-apt:${tenantId}:`);
    groomingApts
      .filter((a: any) => a && a.id)
      .filter((a: any) => a.status === 'cancelled' || a.status === 'no_show')
      .filter((a: any) => !fromDate || a.appointment_date >= fromDate)
      .filter((a: any) => !toDate || a.appointment_date <= toDate)
      .forEach((a: any) => cancellations.push({
        date: a.appointment_date,
        module: 'Grooming',
        petName: a.pet_name || '',
        householdName: a.household_name || '',
        status: a.status,
        reason: a.cancellation_reason || '',
        cancelledAt: a.cancelled_at ? a.cancelled_at.split('T')[0] : '',
      }));

    const transportJobs = await kv.getByPrefix(`transport_job:${tenantId}:`);
    transportJobs
      .filter((j: any) => j && j.id)
      .filter((j: any) => j.status === 'cancelled')
      .filter((j: any) => !fromDate || j.service_date >= fromDate)
      .filter((j: any) => !toDate || j.service_date <= toDate)
      .forEach((j: any) => cancellations.push({
        date: j.service_date,
        module: 'Transport',
        petName: j.pet_name || '',
        householdName: j.household_name || '',
        status: j.status,
        reason: j.cancellation_reason || '',
        cancelledAt: j.cancelled_at ? j.cancelled_at.split('T')[0] : '',
      }));

    const overnightRes = await kv.getByPrefix(`overnight:${tenantId}:reservation:`);
    overnightRes
      .filter((r: any) => r && r.id)
      .filter((r: any) => r.status === 'cancelled')
      .filter((r: any) => !fromDate || r.startDate >= fromDate)
      .filter((r: any) => !toDate || r.startDate <= toDate)
      .forEach((r: any) => cancellations.push({
        date: r.startDate,
        module: 'Overnights',
        petName: r.petName || '',
        householdName: r.householdName || '',
        status: r.status,
        reason: r.cancellationReason || '',
        cancelledAt: r.cancelledAt ? r.cancelledAt.split('T')[0] : '',
      }));

    cancellations.sort((a, b) => b.date.localeCompare(a.date));
    return c.json({ cancellations });
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

// ============================================================================
// MONTHLY SUMMARY REPORT
// ============================================================================

app.get('/monthly-summary', async (c) => {
  try {
    const user = await auth(c);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);
    const tenantId = getTenantId(user);

    const month = c.req.query('month') || new Date().toISOString().slice(0, 7); // YYYY-MM
    const locationId = c.req.query('location_id') || '';

    const fromDate = `${month}-01`;
    const toDate = `${month}-31`;

    const allPets = await kv.getByPrefix(`customer:${tenantId}:pet:`);
    const allHouseholds = await kv.getByPrefix(`customer:${tenantId}:household:`);
    const householdMap = new Map(allHouseholds.map((h: any) => [h.id, h.name]));

    // Build per-pet activity maps
    const petDaycare = new Map<string, number>();
    const petGrooming = new Map<string, number>();
    const petTransport = new Map<string, number>();
    const petOvernights = new Map<string, number>();

    const daycareBookings = await kv.getByPrefix('daycare:booking:');
    daycareBookings
      .filter((b: any) => b && b.id && b.pet_id)
      .filter((b: any) => b.booking_date >= fromDate && b.booking_date <= toDate)
      .filter((b: any) => b.booking_status !== 'cancelled')
      .filter((b: any) => !locationId || b.location_id === locationId)
      .forEach((b: any) => petDaycare.set(b.pet_id, (petDaycare.get(b.pet_id) || 0) + 1));

    const groomingApts = await kv.getByPrefix(`grooming-apt:${tenantId}:`);
    groomingApts
      .filter((a: any) => a && a.id && a.pet_id)
      .filter((a: any) => a.appointment_date >= fromDate && a.appointment_date <= toDate)
      .filter((a: any) => a.status !== 'cancelled')
      .forEach((a: any) => petGrooming.set(a.pet_id, (petGrooming.get(a.pet_id) || 0) + 1));

    const transportJobs = await kv.getByPrefix(`transport_job:${tenantId}:`);
    transportJobs
      .filter((j: any) => j && j.id && j.pet_id)
      .filter((j: any) => j.service_date >= fromDate && j.service_date <= toDate)
      .filter((j: any) => j.status !== 'cancelled')
      .forEach((j: any) => petTransport.set(j.pet_id, (petTransport.get(j.pet_id) || 0) + 1));

    const overnightRes = await kv.getByPrefix(`overnight:${tenantId}:reservation:`);
    overnightRes
      .filter((r: any) => r && r.id && r.petId)
      .filter((r: any) => r.startDate >= fromDate && r.startDate <= toDate)
      .filter((r: any) => r.status !== 'cancelled')
      .forEach((r: any) => petOvernights.set(r.petId, (petOvernights.get(r.petId) || 0) + (r.totalNights || 1)));

    // Only include pets with activity
    const activePetIds = new Set([
      ...petDaycare.keys(),
      ...petGrooming.keys(),
      ...petTransport.keys(),
      ...petOvernights.keys(),
    ]);

    const petMap = new Map(allPets.filter((p: any) => p && p.id).map((p: any) => [p.id, p]));

    const summaries = Array.from(activePetIds).map(petId => {
      const pet = petMap.get(petId) as any;
      const daycareDays = petDaycare.get(petId) || 0;
      const groomingCount = petGrooming.get(petId) || 0;
      const transportCount = petTransport.get(petId) || 0;
      const overnightNights = petOvernights.get(petId) || 0;
      return {
        petName: pet?.name || 'Unknown',
        breed: pet?.breed || '',
        householdName: householdMap.get(pet?.household_id) || '',
        daycareDays,
        groomingCount,
        transportCount,
        overnightNights,
        totalEstimated: daycareDays + groomingCount + transportCount + overnightNights,
      };
    }).sort((a, b) => a.petName.localeCompare(b.petName));

    return c.json({ summaries });
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

export default app;
