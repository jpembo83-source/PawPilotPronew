import { Hono } from 'npm:hono';
import * as kv from './kv_store.tsx';
import { requireAuth, AuthenticatedUser } from './_shared/auth.ts';
import { internalError } from './_shared/log.ts';

const app = new Hono();

// Every calendar route requires a validated user. requireAuth handles JWT
// validation server-side with SERVICE_ROLE_KEY. The local middleware that
// used to live here read X-User-Token via getUserFromToken validated with
// the ANON_KEY (which cannot verify JWT signatures) — both have been removed.
app.use('*', requireAuth);

interface CalendarEvent {
  id: string;
  source_type: 'daycare' | 'grooming' | 'overnights' | 'transport';
  source_id: string;
  title: string;
  subtitle: string;
  start_at: string;
  end_at: string;
  pet_name: string;
  pet_id: string;
  household_name: string;
  household_id: string;
  location_id: string;
  assigned_staff: string;
  assigned_staff_id: string;
  status: string;
  display_type: string;
  direction?: string;
  service_type?: string;
  flags: string[];
}

function parseDate(d: string): Date | null {
  if (!d) return null;
  const parsed = new Date(d);
  return isNaN(parsed.getTime()) ? null : parsed;
}

function dateStr(d: Date): string {
  return d.toISOString().split('T')[0];
}

function isDateInRange(dateVal: string, startDate: string, endDate: string): boolean {
  if (!dateVal) return false;
  const d = dateVal.split('T')[0];
  return d >= startDate && d <= endDate;
}

async function getDaycareEvents(tenantId: string, startDate: string, endDate: string, locationId?: string): Promise<CalendarEvent[]> {
  const events: CalendarEvent[] = [];
  const bookings = await kv.getByPrefix(`daycare:booking:`);

  for (const b of bookings) {
    if (!b || !b.booking_date) continue;
    if (b.tenant_id && b.tenant_id !== tenantId) continue;
    if (!isDateInRange(b.booking_date, startDate, endDate)) continue;
    if (locationId && b.location_id !== locationId) continue;

    const serviceType = b.service_type || b.booking_type || 'full_day';
    let startTime = '08:00';
    let endTime = '18:00';
    if (serviceType === 'half_day_am' || serviceType === 'half_day_morning') {
      startTime = '08:00'; endTime = '13:00';
    } else if (serviceType === 'half_day_pm' || serviceType === 'half_day_afternoon') {
      startTime = '13:00'; endTime = '18:00';
    } else if (serviceType === 'trial') {
      startTime = '09:00'; endTime = '12:00';
    }

    const flags: string[] = [];
    if (b.requires_transport) flags.push('transport');
    if (b.special_requirements) flags.push('special_needs');
    if (b.is_trial) flags.push('trial');

    events.push({
      id: `daycare-${b.id}`,
      source_type: 'daycare',
      source_id: b.id,
      title: b.pet_name || 'Unknown Pet',
      subtitle: serviceType.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()),
      start_at: `${b.booking_date}T${startTime}:00`,
      end_at: `${b.booking_date}T${endTime}:00`,
      pet_name: b.pet_name || '',
      pet_id: b.pet_id || '',
      household_name: b.household_name || b.owner_name || '',
      household_id: b.household_id || '',
      location_id: b.location_id || '',
      assigned_staff: '',
      assigned_staff_id: '',
      status: b.booking_status || b.status || 'confirmed',
      display_type: 'block',
      service_type: serviceType,
      flags,
    });
  }
  return events;
}

async function getGroomingEvents(tenantId: string, startDate: string, endDate: string, locationId?: string): Promise<CalendarEvent[]> {
  const events: CalendarEvent[] = [];
  const appointments = await kv.getByPrefix(`grooming-apt:${tenantId}:`);

  for (const a of appointments) {
    if (!a || !a.appointment_date) continue;
    if (!isDateInRange(a.appointment_date, startDate, endDate)) continue;
    if (locationId && a.location_id !== locationId) continue;

    const startTime = a.appointment_time || '09:00';
    const duration = a.estimated_duration_minutes || 60;
    const [h, m] = startTime.split(':').map(Number);
    const endMinutes = h * 60 + m + duration;
    const endH = Math.floor(endMinutes / 60).toString().padStart(2, '0');
    const endM = (endMinutes % 60).toString().padStart(2, '0');

    const flags: string[] = [];
    if (a.special_instructions) flags.push('special_instructions');

    events.push({
      id: `grooming-${a.id}`,
      source_type: 'grooming',
      source_id: a.id,
      title: a.pet_name || 'Unknown Pet',
      subtitle: a.service_name || a.service_type || 'Grooming',
      start_at: `${a.appointment_date}T${startTime}:00`,
      end_at: `${a.appointment_date}T${endH}:${endM}:00`,
      pet_name: a.pet_name || '',
      pet_id: a.pet_id || '',
      household_name: a.household_name || a.owner_name || '',
      household_id: a.household_id || '',
      location_id: a.location_id || '',
      assigned_staff: a.groomer_name || '',
      assigned_staff_id: a.groomer_id || '',
      status: a.status || 'confirmed',
      display_type: 'card',
      service_type: a.service_name || a.service_type || '',
      flags,
    });
  }
  return events;
}

async function getOvernightEvents(tenantId: string, startDate: string, endDate: string, locationId?: string): Promise<CalendarEvent[]> {
  const events: CalendarEvent[] = [];
  const reservations = await kv.getByPrefix(`overnight:${tenantId}:reservation:`);

  for (const r of reservations) {
    if (!r) continue;
    const rStart = (r.startDate || r.check_in_date || r.start_date || '').split('T')[0];
    const rEnd = (r.endDate || r.check_out_date || r.end_date || '').split('T')[0];
    if (!rStart) continue;

    if (rEnd && rEnd < startDate) continue;
    if (rStart > endDate) continue;

    if (locationId && r.locationId !== locationId && r.location_id !== locationId) continue;

    const flags: string[] = [];
    if (r.specialNeeds || r.special_needs) flags.push('special_needs');
    if (r.medicationRequired || r.medication_required) flags.push('medication');

    events.push({
      id: `overnight-${r.id}`,
      source_type: 'overnights',
      source_id: r.id,
      title: r.petName || r.pet_name || 'Unknown Pet',
      subtitle: `${r.totalNights || r.total_nights || '?'} night(s)`,
      start_at: `${rStart}T18:00:00`,
      end_at: rEnd ? `${rEnd}T10:00:00` : `${rStart}T10:00:00`,
      pet_name: r.petName || r.pet_name || '',
      pet_id: r.petId || r.pet_id || '',
      household_name: r.householdName || r.household_name || '',
      household_id: r.householdId || r.household_id || '',
      location_id: r.locationId || r.location_id || '',
      assigned_staff: r.carerName || r.carer_name || '',
      assigned_staff_id: r.carerId || r.carer_id || '',
      status: r.status || 'confirmed',
      display_type: 'spanning',
      flags,
    });
  }
  return events;
}

async function getTransportEvents(tenantId: string, startDate: string, endDate: string, locationId?: string): Promise<CalendarEvent[]> {
  const events: CalendarEvent[] = [];
  const jobs = await kv.getByPrefix(`transport_job:${tenantId}:`);

  for (const j of jobs) {
    if (!j) continue;
    const jobDate = (j.service_date || j.date || '').split('T')[0];
    if (!jobDate) continue;
    if (!isDateInRange(jobDate, startDate, endDate)) continue;
    if (locationId && j.location_id !== locationId) continue;

    const direction = j.direction || 'pickup';
    const timeWindow = j.time_window || j.pickup_time || j.dropoff_time || '';
    let startTime = '08:00';
    let endTime = '08:30';

    if (timeWindow) {
      if (timeWindow.includes('-')) {
        const parts = timeWindow.split('-');
        startTime = parts[0].trim();
        endTime = parts[1].trim();
      } else {
        startTime = timeWindow;
        const [h, m] = startTime.split(':').map(Number);
        const totalMin = h * 60 + m + 30;
        endTime = `${Math.floor(totalMin / 60).toString().padStart(2, '0')}:${(totalMin % 60).toString().padStart(2, '0')}`;
      }
    } else if (direction === 'dropoff') {
      startTime = '17:00';
      endTime = '17:30';
    }

    const flags: string[] = [];
    if (j.notes) flags.push('has_notes');

    events.push({
      id: `transport-${j.id}`,
      source_type: 'transport',
      source_id: j.id,
      title: j.pet_name || 'Unknown Pet',
      subtitle: `${direction === 'pickup' ? 'Pick-up' : 'Drop-off'}`,
      start_at: `${jobDate}T${startTime}:00`,
      end_at: `${jobDate}T${endTime}:00`,
      pet_name: j.pet_name || '',
      pet_id: j.pet_id || '',
      household_name: j.household_name || j.owner_name || '',
      household_id: j.household_id || '',
      location_id: j.location_id || '',
      assigned_staff: j.driver_name || '',
      assigned_staff_id: j.assigned_driver_user_id || j.driver_id || '',
      status: j.status || 'scheduled',
      display_type: 'strip',
      direction,
      flags,
    });
  }
  return events;
}

function getUserAllowedLocations(user: AuthenticatedUser): string[] | null {
  const locs = user.locationIds;
  if (!locs || locs.length === 0 || locs.includes('all')) return null;
  return locs;
}

function filterByAllowedLocations(events: CalendarEvent[], allowed: string[] | null): CalendarEvent[] {
  if (!allowed) return events;
  return events.filter(e => !e.location_id || allowed.includes(e.location_id));
}

app.get('/events', async (c) => {
  try {
    const user = c.get('user') as AuthenticatedUser;
    const tenantId = user.tenantId;
    const allowedLocations = getUserAllowedLocations(user);
    let locationId = c.req.query('location_id') || undefined;

    if (locationId && allowedLocations && !allowedLocations.includes(locationId)) {
      return c.json({ events: [], summary: { total: 0, daycare: 0, grooming: 0, overnights: 0, transport: 0 } });
    }

    const startDate = c.req.query('start_date') || dateStr(new Date());
    const endDate = c.req.query('end_date') || startDate;
    const featureFilter = c.req.query('feature');
    const statusFilter = c.req.query('status');
    const staffFilter = c.req.query('staff_id');
    const petFilter = c.req.query('pet');
    const householdFilter = c.req.query('household');

    const promises: Promise<CalendarEvent[]>[] = [];

    if (!featureFilter || featureFilter === 'daycare') {
      promises.push(getDaycareEvents(tenantId, startDate, endDate, locationId));
    }
    if (!featureFilter || featureFilter === 'grooming') {
      promises.push(getGroomingEvents(tenantId, startDate, endDate, locationId));
    }
    if (!featureFilter || featureFilter === 'overnights') {
      promises.push(getOvernightEvents(tenantId, startDate, endDate, locationId));
    }
    if (!featureFilter || featureFilter === 'transport') {
      promises.push(getTransportEvents(tenantId, startDate, endDate, locationId));
    }

    const results = await Promise.all(promises);
    let events = filterByAllowedLocations(results.flat(), allowedLocations);

    if (statusFilter) {
      events = events.filter(e => e.status === statusFilter);
    }
    if (staffFilter) {
      events = events.filter(e => e.assigned_staff_id === staffFilter);
    }
    if (petFilter && householdFilter) {
      const pq = petFilter.toLowerCase();
      const hq = householdFilter.toLowerCase();
      events = events.filter(e =>
        e.pet_name.toLowerCase().includes(pq) || e.household_name.toLowerCase().includes(hq)
      );
    } else if (petFilter) {
      const q = petFilter.toLowerCase();
      events = events.filter(e => e.pet_name.toLowerCase().includes(q));
    } else if (householdFilter) {
      const q = householdFilter.toLowerCase();
      events = events.filter(e => e.household_name.toLowerCase().includes(q));
    }

    events.sort((a, b) => a.start_at.localeCompare(b.start_at));

    const summary = {
      total: events.length,
      daycare: events.filter(e => e.source_type === 'daycare').length,
      grooming: events.filter(e => e.source_type === 'grooming').length,
      overnights: events.filter(e => e.source_type === 'overnights').length,
      transport: events.filter(e => e.source_type === 'transport').length,
    };

    return c.json({ events, summary });
  } catch (err: any) {
    return internalError(c, 'calendar.events', err);
  }
});

export default app;
