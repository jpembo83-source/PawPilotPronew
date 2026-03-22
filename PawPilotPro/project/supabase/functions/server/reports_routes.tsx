import { Hono } from 'npm:hono';
import { createClient } from 'npm:@supabase/supabase-js@2';
import * as kv from './kv_store.tsx';

const app = new Hono();

app.use('/*', async (c, next) => {
  const user = await getUserFromToken(c.req.raw);
  if (!user) {
    return c.json({ error: 'Unauthorised' }, 401);
  }
  c.set('user', user);
  await next();
});

async function getUserFromToken(request: Request) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
  if (!supabaseUrl || !supabaseAnonKey) return null;
  const supabase = createClient(supabaseUrl, supabaseAnonKey);
  const accessToken = request.headers.get('X-User-Token')?.replace('Bearer ', '');
  if (!accessToken) return null;
  const { data, error } = await supabase.auth.getUser(accessToken);
  if (error || !data?.user) return null;
  return data.user;
}

function getTenantId(user: any): string {
  return user?.user_metadata?.tenant_id || user?.tenant_id || user?.id || 'default';
}

async function getAllByPrefix(prefix: string): Promise<any[]> {
  return kv.getByPrefix(prefix);
}

app.get('/pets', async (c) => {
  try {
    const user = c.get('user');
    const tenantId = getTenantId(user);
    const locationId = c.req.query('location_id');

    const households = await getAllByPrefix(`customer:${tenantId}:household:`);
    const allPets = await getAllByPrefix(`customer:${tenantId}:pet:`);

    const hhMap: Record<string, any> = {};
    for (const hh of households) {
      const hhId = hh.id || hh.household_id;
      if (hhId) hhMap[hhId] = hh;
    }

    const pets: any[] = [];
    for (const pet of allPets) {
      const hhId = pet.household_id || pet.householdId;
      const hh = hhId ? hhMap[hhId] : null;
      const hhLocationId = hh?.primary_location_id || hh?.location_id;
      if (locationId && hhLocationId !== locationId) continue;
      pets.push({
        id: pet.id,
        name: pet.name,
        breed: pet.breed || 'Unknown',
        species: pet.species || 'Dog',
        sex: pet.sex || '',
        weight: pet.weight || pet.weight_kg || '',
        dateOfBirth: pet.dateOfBirth || pet.date_of_birth || '',
        neutered: pet.neutered || pet.neutered_status || false,
        householdName: hh?.household_name || hh?.name || '',
        householdId: hhId || '',
        status: pet.status || pet.active === false ? 'inactive' : 'active',
        locationId: hhLocationId || '',
      });
    }

    return c.json({ pets });
  } catch (error) {
    console.error('Error fetching pets report:', error);
    return c.json({ error: 'Failed to fetch pets report' }, 500);
  }
});

app.get('/breeds', async (c) => {
  try {
    const user = c.get('user');
    const tenantId = getTenantId(user);

    const allPets = await getAllByPrefix(`customer:${tenantId}:pet:`);
    const breedMap: Record<string, { count: number; names: string[] }> = {};

    for (const pet of allPets) {
      const breed = pet.breed || 'Unknown';
      if (!breedMap[breed]) breedMap[breed] = { count: 0, names: [] };
      breedMap[breed].count++;
      breedMap[breed].names.push(pet.name);
    }

    const breeds = Object.entries(breedMap)
      .map(([breed, data]) => ({ breed, count: data.count, petNames: data.names.join(', ') }))
      .sort((a, b) => b.count - a.count);

    return c.json({ breeds });
  } catch (error) {
    console.error('Error fetching breeds report:', error);
    return c.json({ error: 'Failed to fetch breeds report' }, 500);
  }
});

app.get('/customers', async (c) => {
  try {
    const user = c.get('user');
    const tenantId = getTenantId(user);
    const locationId = c.req.query('location_id');

    const households = await getAllByPrefix(`customer:${tenantId}:household:`);
    const allPets = await getAllByPrefix(`customer:${tenantId}:pet:`);
    const allContacts = await getAllByPrefix(`customer:${tenantId}:contact:`);

    const petsByHh: Record<string, any[]> = {};
    for (const pet of allPets) {
      const hhId = pet.household_id || pet.householdId;
      if (hhId) {
        if (!petsByHh[hhId]) petsByHh[hhId] = [];
        petsByHh[hhId].push(pet);
      }
    }

    const contactsByHh: Record<string, any[]> = {};
    for (const contact of allContacts) {
      const hhId = contact.household_id || contact.householdId;
      if (hhId) {
        if (!contactsByHh[hhId]) contactsByHh[hhId] = [];
        contactsByHh[hhId].push(contact);
      }
    }

    const customers = households
      .filter(hh => !locationId || (hh.primary_location_id || hh.location_id) === locationId)
      .map(hh => {
        const hhId = hh.id || hh.household_id;
        const hhPets = petsByHh[hhId] || [];
        const hhContacts = contactsByHh[hhId] || [];
        const primary = hhContacts[0];
        return {
          id: hhId,
          householdName: hh.household_name || hh.name || '',
          primaryContact: primary?.name || [primary?.first_name, primary?.last_name].filter(Boolean).join(' ') || '',
          email: primary?.email || '',
          phone: primary?.phone || '',
          petCount: hhPets.length,
          petNames: hhPets.map((p: any) => p.name).join(', '),
          status: hh.status || 'active',
          locationId: hh.primary_location_id || hh.location_id || '',
          createdAt: hh.created_at || '',
        };
      });

    return c.json({ customers });
  } catch (error) {
    console.error('Error fetching customers report:', error);
    return c.json({ error: 'Failed to fetch customers report' }, 500);
  }
});

app.get('/attendance', async (c) => {
  try {
    const user = c.get('user');
    const tenantId = getTenantId(user);
    const locationId = c.req.query('location_id');
    const fromDate = c.req.query('from_date');
    const toDate = c.req.query('to_date');

    const allBookings = await getAllByPrefix(`daycare:booking:`);
    const bookings = allBookings.filter(b => typeof b === 'object' && b !== null && b.id && b.booking_date);
    const attendance = bookings
      .filter(b => {
        if (b.tenant_id && b.tenant_id !== tenantId) return false;
        if (locationId && b.location_id !== locationId) return false;
        if (fromDate && b.booking_date < fromDate) return false;
        if (toDate && b.booking_date > toDate) return false;
        return true;
      })
      .map(b => ({
        id: b.id,
        petName: b.pet_name || '',
        householdName: b.household_name || '',
        bookingDate: b.booking_date || '',
        serviceType: b.service_type || '',
        status: b.booking_status || b.status || '',
        checkedInAt: b.actual_check_in_time || b.checked_in_at || '',
        checkedOutAt: b.actual_check_out_time || b.checked_out_at || '',
        locationId: b.location_id || '',
        locationName: b.location_name || '',
      }));

    return c.json({ attendance });
  } catch (error) {
    console.error('Error fetching attendance report:', error);
    return c.json({ error: 'Failed to fetch attendance report' }, 500);
  }
});

app.get('/service-usage', async (c) => {
  try {
    const user = c.get('user');
    const tenantId = getTenantId(user);
    const fromDate = c.req.query('from_date');
    const toDate = c.req.query('to_date');
    const locationId = c.req.query('location_id');

    const dateFilter = (date: string) => {
      if (fromDate && date < fromDate) return false;
      if (toDate && date > toDate) return false;
      return true;
    };

    const allDaycare = await getAllByPrefix(`daycare:booking:`);
    const daycareBookings = allDaycare.filter(b => typeof b === 'object' && b !== null && b.id && b.booking_date && (!b.tenant_id || b.tenant_id === tenantId));
    const groomingAppts = await getAllByPrefix(`grooming-apt:${tenantId}:`);
    const overnightRes = await getAllByPrefix(`overnight:${tenantId}:reservation:`);
    const transportJobs = await getAllByPrefix(`transport_job:${tenantId}:`);

    const usage: any[] = [];

    for (const b of daycareBookings) {
      if (locationId && b.location_id !== locationId) continue;
      if (!dateFilter(b.booking_date || '')) continue;
      usage.push({
        date: b.booking_date,
        module: 'Daycare',
        serviceType: b.service_type || 'full_day',
        petName: b.pet_name || '',
        householdName: b.household_name || '',
        status: b.booking_status || b.status || '',
        locationId: b.location_id || '',
      });
    }

    for (const a of groomingAppts) {
      if (locationId && a.location_id !== locationId) continue;
      const date = a.date || a.appointment_date || '';
      if (!dateFilter(date)) continue;
      usage.push({
        date,
        module: 'Grooming',
        serviceType: a.service_name || a.service_type || '',
        petName: a.pet_name || '',
        householdName: a.customer_name || a.household_name || '',
        status: a.status || '',
        locationId: a.location_id || '',
      });
    }

    for (const r of overnightRes) {
      if (locationId && (r.locationId || r.location_id) !== locationId) continue;
      const rDate = r.startDate || r.start_date || r.check_in_date || '';
      if (!dateFilter(rDate)) continue;
      usage.push({
        date: rDate,
        module: 'Overnights',
        serviceType: 'overnight_stay',
        petName: r.petName || r.pet_name || '',
        householdName: r.customerName || r.customer_name || r.household_name || '',
        status: r.status || '',
        locationId: r.locationId || r.location_id || '',
      });
    }

    for (const j of transportJobs) {
      if (locationId && j.location_id !== locationId) continue;
      if (!dateFilter(j.service_date || '')) continue;
      usage.push({
        date: j.service_date,
        module: 'Transport',
        serviceType: j.direction || '',
        petName: j.pet_name || '',
        householdName: j.household_name || '',
        status: j.status || '',
        locationId: j.location_id || '',
      });
    }

    usage.sort((a, b) => (b.date || '').localeCompare(a.date || ''));

    return c.json({ usage });
  } catch (error) {
    console.error('Error fetching service usage report:', error);
    return c.json({ error: 'Failed to fetch service usage report' }, 500);
  }
});

app.get('/revenue', async (c) => {
  try {
    const user = c.get('user');
    const tenantId = getTenantId(user);
    const fromDate = c.req.query('from_date');
    const toDate = c.req.query('to_date');
    const locationId = c.req.query('location_id');

    const allInvoices = await getAllByPrefix(`invoice:`);
    const invoices = allInvoices.filter(inv => !inv.tenant_id || inv.tenant_id === tenantId);

    const filteredInvoices = invoices.filter(inv => {
      if (locationId && inv.location_id !== locationId) return false;
      const date = inv.issue_date || inv.created_at || '';
      if (fromDate && date < fromDate) return false;
      if (toDate && date > toDate) return false;
      return true;
    });

    const totalInvoiced = filteredInvoices.reduce((sum, inv) => sum + (inv.total || 0), 0);
    const totalPaid = filteredInvoices
      .filter(inv => inv.status === 'paid')
      .reduce((sum, inv) => sum + (inv.total || 0), 0);
    const totalOutstanding = filteredInvoices
      .filter(inv => ['issued', 'overdue', 'part_paid'].includes(inv.status))
      .reduce((sum, inv) => sum + ((inv.total || 0) - (inv.paid_amount || inv.amount_paid || 0)), 0);

    const revenueByModule: Record<string, number> = {};
    for (const inv of filteredInvoices) {
      if (inv.line_items) {
        for (const li of inv.line_items) {
          const mod = li.module || 'Other';
          revenueByModule[mod] = (revenueByModule[mod] || 0) + (li.total || 0);
        }
      }
    }

    const invoiceRows = filteredInvoices.map(inv => ({
      invoiceNumber: inv.invoice_number || '',
      householdName: inv.household_name || '',
      issueDate: inv.issue_date || '',
      dueDate: inv.due_date || '',
      status: inv.status || '',
      subtotal: inv.subtotal || 0,
      tax: inv.tax_total || 0,
      total: inv.total || 0,
      amountPaid: inv.paid_amount || inv.amount_paid || 0,
      balance: (inv.total || 0) - (inv.paid_amount || inv.amount_paid || 0),
      locationId: inv.location_id || '',
    }));

    return c.json({
      summary: { totalInvoiced, totalPaid, totalOutstanding, revenueByModule },
      invoices: invoiceRows,
    });
  } catch (error) {
    console.error('Error fetching revenue report:', error);
    return c.json({ error: 'Failed to fetch revenue report' }, 500);
  }
});

app.get('/cancellations', async (c) => {
  try {
    const user = c.get('user');
    const tenantId = getTenantId(user);
    const fromDate = c.req.query('from_date');
    const toDate = c.req.query('to_date');
    const locationId = c.req.query('location_id');

    const allDaycareBookings = await getAllByPrefix(`daycare:booking:`);
    const daycareBookings = allDaycareBookings.filter(b => typeof b === 'object' && b !== null && b.id && b.booking_date && (!b.tenant_id || b.tenant_id === tenantId));
    const cancelled = daycareBookings.filter(b => {
      const bStatus = b.booking_status || b.status;
      if (bStatus !== 'cancelled' && bStatus !== 'no_show') return false;
      if (locationId && b.location_id !== locationId) return false;
      if (fromDate && b.booking_date < fromDate) return false;
      if (toDate && b.booking_date > toDate) return false;
      return true;
    });

    const groomingAppts = await getAllByPrefix(`grooming-apt:${tenantId}:`);
    const cancelledGrooming = groomingAppts.filter(a => {
      if (a.status !== 'cancelled' && a.status !== 'no_show') return false;
      if (locationId && a.location_id !== locationId) return false;
      const date = a.date || a.appointment_date || '';
      if (fromDate && date < fromDate) return false;
      if (toDate && date > toDate) return false;
      return true;
    });

    const rows = [
      ...cancelled.map(b => ({
        date: b.booking_date || '',
        module: 'Daycare',
        petName: b.pet_name || '',
        householdName: b.household_name || '',
        status: b.booking_status || b.status || '',
        reason: b.cancellation_reason || b.cancel_reason || '',
        cancelledAt: b.cancelled_at || b.updated_at || '',
        locationId: b.location_id || '',
      })),
      ...cancelledGrooming.map(a => ({
        date: a.date || a.appointment_date || '',
        module: 'Grooming',
        petName: a.pet_name || '',
        householdName: a.customer_name || a.household_name || '',
        status: a.status || '',
        reason: a.cancellation_reason || '',
        cancelledAt: a.cancelled_at || a.updated_at || '',
        locationId: a.location_id || '',
      })),
    ].sort((a, b) => (b.date || '').localeCompare(a.date || ''));

    return c.json({ cancellations: rows });
  } catch (error) {
    console.error('Error fetching cancellations report:', error);
    return c.json({ error: 'Failed to fetch cancellations report' }, 500);
  }
});

app.get('/monthly-summary', async (c) => {
  try {
    const user = c.get('user');
    const tenantId = getTenantId(user);
    const month = c.req.query('month');
    const locationId = c.req.query('location_id');

    if (!month) return c.json({ error: 'month parameter required (YYYY-MM)' }, 400);

    const monthStart = `${month}-01`;
    const [y, m] = month.split('-').map(Number);
    const nextMonth = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`;
    const monthEnd = `${nextMonth}-01`;

    const households = await getAllByPrefix(`customer:${tenantId}:household:`);
    const allPets = await getAllByPrefix(`customer:${tenantId}:pet:`);
    const allDaycare = await getAllByPrefix(`daycare:booking:`);
    const daycareBookings = allDaycare.filter(b => typeof b === 'object' && b !== null && b.id && b.booking_date && (!b.tenant_id || b.tenant_id === tenantId));
    const groomingAppts = await getAllByPrefix(`grooming-apt:${tenantId}:`);
    const overnightRes = await getAllByPrefix(`overnight:${tenantId}:reservation:`);
    const transportJobs = await getAllByPrefix(`transport_job:${tenantId}:`);

    const hhMap: Record<string, any> = {};
    for (const hh of households) {
      const hhId = hh.id || hh.household_id;
      if (hhId) hhMap[hhId] = hh;
    }

    const petMap: Record<string, any> = {};
    for (const pet of allPets) {
      const hhId = pet.household_id || pet.householdId;
      const hh = hhId ? hhMap[hhId] : null;
      if (locationId && (hh?.primary_location_id || hh?.location_id) !== locationId) continue;
      petMap[pet.id] = {
        petId: pet.id,
        petName: pet.name,
        breed: pet.breed || '',
        householdId: hhId || '',
        householdName: hh?.household_name || hh?.name || '',
        daycareDays: 0,
        groomingCount: 0,
        transportCount: 0,
        overnightNights: 0,
        totalEstimated: 0,
      };
    }

    for (const b of daycareBookings) {
      if (b.booking_date >= monthStart && b.booking_date < monthEnd && (b.booking_status || b.status) !== 'cancelled') {
        if (locationId && b.location_id !== locationId) continue;
        const petId = b.pet_id;
        if (petMap[petId]) {
          petMap[petId].daycareDays++;
          petMap[petId].totalEstimated += b.price || 0;
        }
      }
    }

    for (const a of groomingAppts) {
      const date = a.date || a.appointment_date || '';
      if (date >= monthStart && date < monthEnd && a.status !== 'cancelled') {
        if (locationId && a.location_id !== locationId) continue;
        const petId = a.pet_id;
        if (petMap[petId]) {
          petMap[petId].groomingCount++;
          petMap[petId].totalEstimated += a.price || 0;
        }
      }
    }

    for (const r of overnightRes) {
      const rDate = r.startDate || r.start_date || r.check_in_date || '';
      if (rDate >= monthStart && rDate < monthEnd && r.status !== 'cancelled') {
        if (locationId && (r.locationId || r.location_id) !== locationId) continue;
        const petId = r.petId || r.pet_id;
        if (petMap[petId]) {
          petMap[petId].overnightNights += r.totalNights || r.total_nights || 1;
          petMap[petId].totalEstimated += r.totalPrice || r.total_price || 0;
        }
      }
    }

    for (const j of transportJobs) {
      if (j.service_date >= monthStart && j.service_date < monthEnd && j.status !== 'cancelled') {
        if (locationId && j.location_id !== locationId) continue;
        const petId = j.pet_id;
        if (petMap[petId]) {
          petMap[petId].transportCount++;
        }
      }
    }

    const summaries = Object.values(petMap)
      .filter((s: any) => s.daycareDays > 0 || s.groomingCount > 0 || s.overnightNights > 0 || s.transportCount > 0)
      .sort((a: any, b: any) => a.petName.localeCompare(b.petName));

    return c.json({ month, summaries });
  } catch (error) {
    console.error('Error fetching monthly summary:', error);
    return c.json({ error: 'Failed to fetch monthly summary' }, 500);
  }
});

app.get('/bexio-export', async (c) => {
  try {
    const user = c.get('user');
    const tenantId = getTenantId(user);
    const fromDate = c.req.query('from_date');
    const toDate = c.req.query('to_date');

    const allInvoices = await getAllByPrefix(`invoice:`);
    const invoices = allInvoices.filter(inv => !inv.tenant_id || inv.tenant_id === tenantId);
    const filtered = invoices.filter(inv => {
      if (inv.status === 'void' || inv.status === 'draft') return false;
      const date = inv.issue_date || inv.created_at || '';
      if (fromDate && date < fromDate) return false;
      if (toDate && date > toDate) return false;
      return true;
    });

    const rows = filtered.map(inv => ({
      invoiceNumber: inv.invoice_number || '',
      contactName: inv.household_name || '',
      issueDate: inv.issue_date || '',
      dueDate: inv.due_date || '',
      currency: inv.currency || 'CHF',
      subtotal: inv.subtotal || 0,
      taxRate: inv.tax_rate || 0,
      taxAmount: inv.tax_total || 0,
      total: inv.total || 0,
      status: inv.status || '',
      reference: inv.reference || inv.id || '',
    }));

    return c.json({ rows });
  } catch (error) {
    console.error('Error fetching Bexio export:', error);
    return c.json({ error: 'Failed to fetch Bexio export' }, 500);
  }
});

export default app;
