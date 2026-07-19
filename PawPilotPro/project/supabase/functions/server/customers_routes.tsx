// Customer Management Routes - MDC Operations Centre
// Complete CRUD for households, contacts, pets, documents, activity timeline

import { Hono } from 'npm:hono';
import { z } from 'npm:zod';
import { createClient } from 'npm:@supabase/supabase-js';
import * as kv from './kv_store.tsx';
import { requireAuth, requireRole, AuthenticatedUser } from './_shared/auth.ts';
import { internalError, logError } from './_shared/log.ts';
import {
  movePetToHousehold,
  petScopedFlags,
  moveFlagToHousehold,
  petScopedDocuments,
  moveDocumentToHousehold,
  upcomingDaycareBookings,
  repointBookingHousehold,
  activeOvernightReservations,
  repointReservationHousehold,
  upcomingGroomingAppointments,
  repointGroomingHousehold,
} from './lib/pet_transfer.ts';
import { listHouseholds, HouseholdRecord, ContactRecord, PetRecord } from './lib/household_list.ts';
import { applyPetPhotoWrite, signPetPhotoUrl, storedPetPhoto, withSignedPetPhotos } from './lib/pet_photos.ts';
// Phase 4 stage 2: every customer:* KV mutation is mirrored to Postgres.
// Non-fatal, loud-on-failure; KV stays authoritative (no read changes).
import { dualWriteCustomers, dwSet, dwDel, type CustomerDualWriteOp } from './lib/customers_dualwrite.ts';
// Phase 4 stage 3: list/detail/search reads served from Postgres when the
// read_from_pg:customers flag is ON (KV otherwise), with shadow-read
// sampling proving response parity either way. Dual-write stays on; flipping
// the flag off is the rollback. See lib/customers_read_pg.ts for scope.
import {
  customersRead,
  pgGetHouseholdBundle,
  pgGetPet,
  pgListContacts,
  pgListHouseholds,
  pgListPets,
  pgLookup,
  type HouseholdBundle,
  type LookupResult,
} from './lib/customers_read_pg.ts';

const app = new Hono();

// Every route in this module requires a validated user. requireAuth runs
// before each handler and short-circuits with 401 on auth failure. The ad-hoc
// ANON_KEY-validated getUserFromToken helper that used to live here has been
// removed — auth is the shared middleware's job, route handlers just read the
// already-validated user from context.
app.use('*', requireAuth);

// ============================================================================
// UTILITIES
// ============================================================================

const generateId = (prefix: string) => {
  return `${prefix}-${crypto.randomUUID()}`;
};

// ============================================================================
// HOUSEHOLDS
// ============================================================================

// List households
app.get('/households', async (c) => {
  try {
    const user = c.get('user') as AuthenticatedUser;
    const tenantId = user.tenantId;

    const search = c.req.query('search');
    const status = c.req.query('status');
    const vip = c.req.query('vip');
    const payment_hold = c.req.query('payment_hold');
    const location_id = c.req.query('location_id');
    const sort = c.req.query('sort');
    const dir = c.req.query('dir');
    const limitParam = c.req.query('limit');
    const offsetParam = c.req.query('offset');

    // Pagination is opt-in so existing consumers that expect the full array
    // (export, grooming search, picker modals) keep working unchanged.
    const paginated = limitParam !== undefined || offsetParam !== undefined;
    const limit = Math.min(Math.max(parseInt(limitParam || '50', 10) || 50, 1), 200);
    const offset = Math.max(parseInt(offsetParam || '0', 10) || 0, 0);

    const query = {
      search,
      status,
      vip: vip === 'true',
      payment_hold: payment_hold === 'true',
      location_id,
      sort: sort === 'primary_contact' ? 'primary_contact' as const : 'name' as const,
      dir: dir === 'desc' ? 'desc' as const : 'asc' as const,
      limit: paginated ? limit : undefined,
      offset: paginated ? offset : undefined,
    };

    const { rows, total } = await customersRead<{ rows: unknown[]; total: number }>(
      'customers.listHouseholds',
      {
        // KV path: tenant-wide scans + in-memory filter/sort/page (unchanged).
        kv: async () => {
          // Fetch the tenant's households plus ALL contacts and pets in bulk
          // (avoids N+1 lookups; KV returns already-parsed objects).
          const allHouseholds = await kv.getByPrefix(`customer:${tenantId}:household:`) as HouseholdRecord[];
          const allContacts = await kv.getByPrefix(`customer:${tenantId}:contact:`) as ContactRecord[];
          const allPets = await kv.getByPrefix(`customer:${tenantId}:pet:`) as PetRecord[];
          return listHouseholds(allHouseholds, allContacts, allPets, query);
        },
        // PG path: indexed WHERE/ORDER BY/LIMIT + JOINed names (one RPC).
        pg: () => pgListHouseholds(tenantId, query),
      },
    );

    if (paginated) {
      // Same envelope shape as the messaging threads list.
      return c.json({ households: rows, total, limit, offset });
    }

    return c.json(rows);
  } catch (error: any) {
    return internalError(c, 'customers.listHouseholds', error);
  }
});

// ============================================================================
// DUPLICATE LOOKUP
// ============================================================================
// Lightweight, tenant-scoped lookup backing the non-blocking duplicate nudges
// in the contact/household create flows. Matching is normalised: emails are
// compared trimmed + lowercased; phones digits-only, with dial-code tolerance
// (equal, or both ≥10 digits and sharing the same trailing 10 — so
// "+44 7700 900123" matches "07700 900123"). Household names reuse the list
// endpoint's fuzzy behaviour (case-insensitive substring). This endpoint only
// ever informs a UI hint — it must never gate a create.

const normaliseEmail = (value: string) => value.trim().toLowerCase();
const normalisePhone = (value: string) => value.replace(/\D/g, '');

const phonesMatch = (a: string, b: string) => {
  if (!a || !b) return false;
  if (a === b) return true;
  return a.length >= 10 && b.length >= 10 && a.slice(-10) === b.slice(-10);
};

const LOOKUP_MAX_MATCHES = 5;

app.get('/lookup', async (c) => {
  try {
    const user = c.get('user') as AuthenticatedUser;
    const tenantId = user.tenantId;

    const email = normaliseEmail(c.req.query('email') ?? '');
    const phone = normalisePhone(c.req.query('phone') ?? '');
    const name = (c.req.query('name') ?? '').trim().toLowerCase();

    if (!email && !phone && !name) {
      return c.json({ contacts: [], households: [] });
    }

    const result = await customersRead<LookupResult>('customers.lookup', {
      // KV path: tenant-wide household + contact scans (unchanged).
      kv: async () => {
        const out: LookupResult = { contacts: [], households: [] };
        const households = await kv.getByPrefix(`customer:${tenantId}:household:`);
        const householdNameById = new Map<string, string>(
          households.map((h: Record<string, unknown>) => [String(h.id), (h.name as string) ?? 'Unnamed Household'])
        );

        if (email || phone) {
          const allContacts = await kv.getByPrefix(`customer:${tenantId}:contact:`);
          for (const contact of allContacts as Record<string, unknown>[]) {
            if (out.contacts.length >= LOOKUP_MAX_MATCHES) break;

            const matched: Array<'email' | 'phone'> = [];
            if (email && contact.email && normaliseEmail(String(contact.email)) === email) {
              matched.push('email');
            }
            if (phone && contact.phone && phonesMatch(normalisePhone(String(contact.phone)), phone)) {
              matched.push('phone');
            }
            if (matched.length === 0) continue;

            out.contacts.push({
              id: contact.id,
              first_name: contact.first_name,
              last_name: contact.last_name,
              email: contact.email,
              phone: contact.phone,
              household_id: contact.household_id,
              household_name: householdNameById.get(String(contact.household_id)) ?? 'Unnamed Household',
              matched,
            });
          }
        }

        if (name) {
          out.households = (households as Record<string, unknown>[])
            .filter((h) => typeof h.name === 'string' && h.name.toLowerCase().includes(name))
            .slice(0, LOOKUP_MAX_MATCHES)
            .map((h) => ({ id: String(h.id), name: String(h.name) }));
        }

        return out;
      },
      // PG path: indexed lookup RPC (service-role only).
      pg: () => pgLookup(tenantId, { email, phone, name }),
    });

    return c.json(result);
  } catch (error: any) {
    return internalError(c, 'customers.lookup', error);
  }
});

// Get single household
app.get('/households/:id', async (c) => {
  try {
    const user = c.get('user') as AuthenticatedUser;
    const tenantId = user.tenantId;
    const householdId = c.req.param('id');
    
    const bundle = await customersRead<HouseholdBundle | null>('customers.getHousehold', {
      // KV path: point read + 3 prefix scans (unchanged).
      kv: async () => {
        const household = await kv.get(`customer:${tenantId}:household:${householdId}`);
        if (!household) return null;
        // KV store returns already-parsed objects, not JSON strings
        const contacts = await kv.getByPrefix(`customer:${tenantId}:contact:${householdId}:`);
        const pets = await kv.getByPrefix(`customer:${tenantId}:pet:${householdId}:`);
        const documents = await kv.getByPrefix(`customer:${tenantId}:document:${householdId}:`);
        return { household, contacts, pets, documents };
      },
      // PG path: PK + household_id-indexed selects.
      pg: () => pgGetHouseholdBundle(tenantId, householdId),
    });

    if (!bundle) {
      return c.json({ error: 'Household not found' }, 404);
    }

    // Pet photos live in a private bucket — photo_url is minted (signed)
    // per response (AFTER path selection, so shadow diffs never see tokens);
    // the stored value is a storage path.
    return c.json({
      ...bundle.household,
      contacts: bundle.contacts,
      pets: await withSignedPetPhotos(bundle.pets as Record<string, unknown>[]),
      documents: bundle.documents,
    });
  } catch (error: any) {
    return internalError(c, 'customers.getHousehold', error);
  }
});

// Create household
app.post('/households', requireRole('admin', 'manager', 'assistant_manager'), async (c) => {
  try {
    const user = c.get('user') as AuthenticatedUser;
    const tenantId = user.tenantId;
    const userId = user.id;
    
    const body = await c.req.json();
    
    if (!body.name) {
      return c.json({ error: 'Household name is required' }, 400);
    }
    
    const household = {
      id: generateId('hh'),
      tenant_id: tenantId,
      external_id: body.external_id,
      name: body.name,
      status: body.status || 'active',
      vip: body.vip || false,
      payment_hold: body.payment_hold || false,
      hold_reason: body.hold_reason,
      hold_notes: body.hold_notes,
      primary_location_id: body.primary_location_id,
      address: body.address,
      internal_notes: body.internal_notes,
      created_by: userId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    
    await kv.set(`customer:${tenantId}:household:${household.id}`, household);
    
    // Create activity event
    const activity = {
      id: generateId('act'),
      household_id: household.id,
      activity_type: 'household_created',
      title: 'Household Created',
      description: `Household "${household.name}" was created`,
      occurred_at: new Date().toISOString(),
      created_by: userId,
    };
    await kv.set(`customer:${tenantId}:activity:${household.id}:${activity.id}`, activity);

    await dualWriteCustomers([
      dwSet(`customer:${tenantId}:household:${household.id}`, household),
      dwSet(`customer:${tenantId}:activity:${household.id}:${activity.id}`, activity),
    ]);

    return c.json(household);
  } catch (error: any) {
    return internalError(c, 'customers.createHousehold', error);
  }
});

// Update household
app.put('/households/:id', requireRole('admin', 'manager', 'assistant_manager'), async (c) => {
  try {
    const user = c.get('user') as AuthenticatedUser;
    const tenantId = user.tenantId;
    const userId = user.id;
    const householdId = c.req.param('id');
    
    const existing = await kv.get(`customer:${tenantId}:household:${householdId}`);
    if (!existing) {
      return c.json({ error: 'Household not found' }, 404);
    }
    
    const body = await c.req.json();
    // KV store returns already-parsed objects, not JSON strings
    const householdData = existing;
    
    const updated = {
      ...householdData,
      ...body,
      id: householdId,
      tenant_id: tenantId,
      created_by: householdData.created_by,
      created_at: householdData.created_at,
      updated_at: new Date().toISOString(),
    };
    
    await kv.set(`customer:${tenantId}:household:${householdId}`, updated);
    
    // Create activity event
    const activity = {
      id: generateId('act'),
      household_id: householdId,
      activity_type: 'household_updated',
      title: 'Household Updated',
      description: `Household "${updated.name}" was updated`,
      occurred_at: new Date().toISOString(),
      created_by: userId,
    };
    await kv.set(`customer:${tenantId}:activity:${householdId}:${activity.id}`, activity);

    await dualWriteCustomers([
      dwSet(`customer:${tenantId}:household:${householdId}`, updated),
      dwSet(`customer:${tenantId}:activity:${householdId}:${activity.id}`, activity),
    ]);

    return c.json(updated);
  } catch (error: any) {
    return internalError(c, 'customers.updateHousehold', error);
  }
});

// Delete household
app.delete('/households/:id', requireRole('admin', 'manager'), async (c) => {
  try {
    const user = c.get('user') as AuthenticatedUser;
    const tenantId = user.tenantId;
    const householdId = c.req.param('id');
    
    const existing = await kv.get(`customer:${tenantId}:household:${householdId}`);
    if (!existing) {
      return c.json({ error: 'Household not found' }, 404);
    }
    
    // KV store returns already-parsed objects, not JSON strings
    const householdData = existing;
    
    // Postgres mirror of every customer:* delete below, applied as ONE
    // transaction at the end (multi-key flow — must not partially apply).
    const dw: CustomerDualWriteOp[] = [];

    // Delete all related data for this household
    // 1. Delete all contacts
    const contacts = await kv.getByPrefix(`customer:${tenantId}:contact:${householdId}:`);
    // KV store returns already-parsed objects, not JSON strings
    for (const contact of contacts) {
      await kv.del(`customer:${tenantId}:contact:${householdId}:${contact.id}`);
      dw.push(dwDel(`customer:${tenantId}:contact:${householdId}:${contact.id}`));
    }

    // 2. Delete all pets
    const pets = await kv.getByPrefix(`customer:${tenantId}:pet:${householdId}:`);
    // KV store returns already-parsed objects, not JSON strings
    for (const pet of pets) {
      await kv.del(`customer:${tenantId}:pet:${householdId}:${pet.id}`);
      dw.push(dwDel(`customer:${tenantId}:pet:${householdId}:${pet.id}`));
    }

    // 3. Delete all daycare bookings
    const daycareBookings = await kv.getByPrefix(`daycare:booking:`);
    for (const booking of daycareBookings) {
      if (booking.household_id === householdId) {
        await kv.del(`daycare:booking:${booking.id}`);
      }
    }

    // 4. Delete all grooming appointments
    const groomingApts = await kv.getByPrefix(`grooming-apt:${tenantId}:`);
    for (const apt of groomingApts) {
      if (apt.household_id === householdId) {
        await kv.del(`grooming-apt:${tenantId}:${apt.id}`);
      }
    }

    // 5. Delete all transport jobs
    const transportJobs = await kv.getByPrefix(`transport_job:${tenantId}:`);
    for (const job of transportJobs) {
      if (job.household_id === householdId) {
        await kv.del(`transport_job:${tenantId}:${job.id}`);
      }
    }

    // 6. Delete all overnight reservations
    const overnightReservations = await kv.getByPrefix(`overnight:${tenantId}:reservation:`);
    for (const reservation of overnightReservations) {
      if (reservation.householdId === householdId) {
        await kv.del(`overnight:${tenantId}:reservation:${reservation.id}`);
      }
    }

    // 7. Delete all documents
    const documents = await kv.getByPrefix(`customer:${tenantId}:document:${householdId}:`);
    // KV store returns already-parsed objects, not JSON strings
    for (const doc of documents) {
      await kv.del(`customer:${tenantId}:document:${householdId}:${doc.id}`);
      dw.push(dwDel(`customer:${tenantId}:document:${householdId}:${doc.id}`));
    }
    
    // 8. Delete all notes
    const notes = await kv.getByPrefix(`customer:${tenantId}:household:${householdId}:note:`);
    // KV store returns already-parsed objects, not JSON strings
    for (const note of notes) {
      await kv.del(`customer:${tenantId}:household:${householdId}:note:${note.id}`);
      dw.push(dwDel(`customer:${tenantId}:household:${householdId}:note:${note.id}`));
    }
    
    // 9. Delete all flags
    const flags = await kv.getByPrefix(`customer:${tenantId}:household:${householdId}:flag:`);
    // KV store returns already-parsed objects, not JSON strings
    for (const flag of flags) {
      await kv.del(`customer:${tenantId}:household:${householdId}:flag:${flag.id}`);
      dw.push(dwDel(`customer:${tenantId}:household:${householdId}:flag:${flag.id}`));
    }
    
    // 10. Delete all activity events
    const activities = await kv.getByPrefix(`customer:${tenantId}:activity:`);
    // KV store returns already-parsed objects, not JSON strings
    for (const activity of activities) {
      if (activity.household_id === householdId) {
        await kv.del(`customer:${tenantId}:activity:${activity.id}`);
        dw.push(dwDel(`customer:${tenantId}:activity:${activity.id}`));
      }
    }

    // 11. Finally, delete the household itself
    await kv.del(`customer:${tenantId}:household:${householdId}`);
    dw.push(dwDel(`customer:${tenantId}:household:${householdId}`));

    await dualWriteCustomers(dw);

    return c.json({ message: `Household "${householdData.name}" deleted successfully` });
  } catch (error: any) {
    return internalError(c, 'customers.deleteHousehold', error);
  }
});

// ============================================================================
// CONTACTS
// ============================================================================

// List contacts for a household
app.get('/households/:household_id/contacts', async (c) => {
  try {
    const user = c.get('user') as AuthenticatedUser;
    const tenantId = user.tenantId;
    const householdId = c.req.param('household_id');

    const contacts = await customersRead<unknown[]>('customers.listContacts', {
      // KV store returns already-parsed objects, not JSON strings
      kv: () => kv.getByPrefix(`customer:${tenantId}:contact:${householdId}:`),
      pg: () => pgListContacts(tenantId, householdId),
    });

    return c.json(contacts);
  } catch (error: any) {
    return internalError(c, 'customers.listContacts', error);
  }
});

// Create contact
app.post('/households/:household_id/contacts', requireRole('admin', 'manager', 'assistant_manager'), async (c) => {
  try {
    const user = c.get('user') as AuthenticatedUser;
    const tenantId = user.tenantId;
    const userId = user.id;
    const householdId = c.req.param('household_id');
    
    const body = await c.req.json();
    
    if (!body.first_name || !body.last_name) {
      return c.json({ error: 'First name and last name are required' }, 400);
    }
    
    const contact = {
      id: generateId('con'),
      tenant_id: tenantId,
      household_id: householdId,
      first_name: body.first_name,
      last_name: body.last_name,
      email: body.email,
      phone: body.phone,
      preferred_contact_method: body.preferred_contact_method,
      is_primary: body.is_primary || false,
      is_emergency_contact: body.is_emergency_contact || false,
      emergency_contact_relationship: body.emergency_contact_relationship,
      marketing_consent: body.marketing_consent || false,
      sms_consent: body.sms_consent || false,
      email_consent: body.email_consent || false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    
    await kv.set(`customer:${tenantId}:contact:${householdId}:${contact.id}`, contact);

    // Multi-key flow: contact (+ household pointer) mirror in one transaction.
    const dw: CustomerDualWriteOp[] = [
      dwSet(`customer:${tenantId}:contact:${householdId}:${contact.id}`, contact),
    ];

    // If this is primary contact, update household
    if (contact.is_primary) {
      const household = await kv.get(`customer:${tenantId}:household:${householdId}`);
      if (household) {
        // KV store returns already-parsed objects, not JSON strings
        const householdData = household;
        householdData.primary_contact_id = contact.id;
        householdData.updated_at = new Date().toISOString();
        await kv.set(`customer:${tenantId}:household:${householdId}`, householdData);
        dw.push(dwSet(`customer:${tenantId}:household:${householdId}`, householdData));
      }
    }

    // Create activity event
    const activity = {
      id: generateId('act'),
      household_id: householdId,
      activity_type: 'contact_added',
      title: 'Contact Added',
      description: `Contact "${contact.first_name} ${contact.last_name}" was added`,
      occurred_at: new Date().toISOString(),
      created_by: userId,
    };
    await kv.set(`customer:${tenantId}:activity:${householdId}:${activity.id}`, activity);
    dw.push(dwSet(`customer:${tenantId}:activity:${householdId}:${activity.id}`, activity));

    await dualWriteCustomers(dw);

    return c.json(contact);
  } catch (error: any) {
    return internalError(c, 'customers.createContact', error);
  }
});

// Update contact
app.put('/contacts/:id', requireRole('admin', 'manager', 'assistant_manager'), async (c) => {
  try {
    const user = c.get('user') as AuthenticatedUser;
    const tenantId = user.tenantId;
    const contactId = c.req.param('id');
    
    const body = await c.req.json();
    
    // Find the contact
    const allContacts = await kv.getByPrefix(`customer:${tenantId}:contact:`);
    // KV store returns already-parsed objects, not JSON strings
    const existingContact = allContacts.find((c: any) => {
      return c.id === contactId;
    });
    
    if (!existingContact) {
      return c.json({ error: 'Contact not found' }, 404);
    }
    
    // KV store returns already-parsed objects, not JSON strings
    const contactData = existingContact;
    const householdId = contactData.household_id;
    
    const updated = {
      ...contactData,
      ...body,
      id: contactId,
      tenant_id: tenantId,
      household_id: householdId,
      created_at: contactData.created_at,
      updated_at: new Date().toISOString(),
    };
    
    // Primary-contact flip is THE multi-key flow: unsets + household pointer +
    // the promoted contact mirror to Postgres as one transaction. Op order
    // matters (unsets before the promotion) — the partial unique index
    // contacts_one_primary_per_household_uq is evaluated per statement.
    const dw: CustomerDualWriteOp[] = [];

    // If this became primary contact, unset any other primary contacts in the household
    if (updated.is_primary && !contactData.is_primary) {
      // Find all contacts in this household
      const householdContacts = await kv.getByPrefix(`customer:${tenantId}:contact:${householdId}:`);

      // Unset is_primary for all other contacts
      // KV store returns already-parsed objects, not JSON strings
      for (const contact of householdContacts) {
        if (contact.id !== contactId && contact.is_primary) {
          contact.is_primary = false;
          contact.updated_at = new Date().toISOString();
          await kv.set(`customer:${tenantId}:contact:${householdId}:${contact.id}`, contact);
          dw.push(dwSet(`customer:${tenantId}:contact:${householdId}:${contact.id}`, contact));
        }
      }

      // Update household primary_contact_id
      const household = await kv.get(`customer:${tenantId}:household:${householdId}`);
      if (household) {
        // KV store returns already-parsed objects, not JSON strings
        const householdData = household;
        householdData.primary_contact_id = contactId;
        householdData.updated_at = new Date().toISOString();
        await kv.set(`customer:${tenantId}:household:${householdId}`, householdData);
        dw.push(dwSet(`customer:${tenantId}:household:${householdId}`, householdData));
      }
    }

    await kv.set(`customer:${tenantId}:contact:${householdId}:${contactId}`, updated);
    dw.push(dwSet(`customer:${tenantId}:contact:${householdId}:${contactId}`, updated));

    await dualWriteCustomers(dw);

    return c.json(updated);
  } catch (error: any) {
    return internalError(c, 'customers.updateContact', error);
  }
});

// Delete contact
app.delete('/contacts/:id', requireRole('admin', 'manager'), async (c) => {
  try {
    const user = c.get('user') as AuthenticatedUser;
    const tenantId = user.tenantId;
    const contactId = c.req.param('id');
    
    // Find the contact
    const allContacts = await kv.getByPrefix(`customer:${tenantId}:contact:`);
    // KV store returns already-parsed objects, not JSON strings
    const existingContact = allContacts.find((c: any) => {
      return c.id === contactId;
    });
    
    if (!existingContact) {
      return c.json({ error: 'Contact not found' }, 404);
    }
    
    // KV store returns already-parsed objects, not JSON strings
    const contactData = existingContact;
    const householdId = contactData.household_id;
    
    // Check if this is the primary contact
    if (contactData.is_primary) {
      return c.json({ error: 'Cannot delete primary contact. Set another contact as primary first.' }, 400);
    }
    
    await kv.del(`customer:${tenantId}:contact:${householdId}:${contactId}`);

    await dualWriteCustomers([
      dwDel(`customer:${tenantId}:contact:${householdId}:${contactId}`),
    ]);

    return c.json({ success: true });
  } catch (error: any) {
    return internalError(c, 'customers.deleteContact', error);
  }
});

// ============================================================================
// PETS
// ============================================================================

// List pets for a household
app.get('/households/:household_id/pets', async (c) => {
  try {
    const user = c.get('user') as AuthenticatedUser;
    const tenantId = user.tenantId;
    const householdId = c.req.param('household_id');

    const pets = await customersRead<Record<string, unknown>[]>('customers.listPets', {
      kv: () => kv.getByPrefix(`customer:${tenantId}:pet:${householdId}:`) as Promise<Record<string, unknown>[]>,
      pg: () => pgListPets(tenantId, householdId),
    });

    // photo_url is signed at response time (private bucket), after path
    // selection so shadow diffs never see signed-URL tokens.
    return c.json(await withSignedPetPhotos(pets));
  } catch (error: any) {
    return internalError(c, 'customers.listPets', error);
  }
});

// Get single pet
app.get('/pets/:id', async (c) => {
  try {
    const user = c.get('user') as AuthenticatedUser;
    const tenantId = user.tenantId;
    const petId = c.req.param('id');

    const pet = await customersRead<Record<string, unknown> | null>('customers.getPet', {
      // KV path: tenant-wide pet scan to find one id (unchanged).
      kv: async () => {
        const allPets = await kv.getByPrefix(`customer:${tenantId}:pet:`);
        const existingPet = (allPets as Record<string, unknown>[]).find((p) => p.id === petId);
        return existingPet ?? null;
      },
      // PG path: primary-key lookup.
      pg: () => pgGetPet(tenantId, petId),
    });

    if (!pet) {
      return c.json({ error: 'Pet not found' }, 404);
    }

    const [wire] = await withSignedPetPhotos([pet]);
    return c.json(wire);
  } catch (error: any) {
    return internalError(c, 'customers.getPet', error);
  }
});

// Create pet
app.post('/households/:household_id/pets', requireRole('admin', 'manager', 'assistant_manager'), async (c) => {
  try {
    const user = c.get('user') as AuthenticatedUser;
    const tenantId = user.tenantId;
    const userId = user.id;
    const householdId = c.req.param('household_id');
    
    const body = await c.req.json();
    
    if (!body.name) {
      return c.json({ error: 'Pet name is required' }, 400);
    }
    
    // applyPetPhotoWrite (below) normalises the photo onto photo_path —
    // bucket references are stored as storage paths, never URLs.
    const pet = {
      id: generateId('pet'),
      tenant_id: tenantId,
      household_id: householdId,
      name: body.name,
      breed: body.breed,
      sex: body.sex,
      date_of_birth: body.date_of_birth,
      age_years: body.age_years,
      microchip: body.microchip,
      weight_kg: body.weight_kg,
      colour: body.colour,
      address: body.address,
      neutered_status: body.neutered_status,
      behaviour_notes: body.behaviour_notes,
      medical_notes: body.medical_notes,
      feeding_instructions: body.feeding_instructions,
      allergies: body.allergies,
      vet_name: body.vet_name,
      vet_phone: body.vet_phone,
      vet_address: body.vet_address,
      vaccination_status: body.vaccination_status || 'unknown',
      vaccination_expiry_date: body.vaccination_expiry_date,
      daycare_enrolled: body.daycare_enrolled || false,
      grooming_enrolled: body.grooming_enrolled || false,
      transport_enrolled: body.transport_enrolled || false,
      overnights_enrolled: body.overnights_enrolled || false,
      active: body.active !== undefined ? body.active : true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    applyPetPhotoWrite(pet, body.photo_path ?? body.photo_url);

    await kv.set(`customer:${tenantId}:pet:${householdId}:${pet.id}`, pet);

    // Create activity event
    const activity = {
      id: generateId('act'),
      household_id: householdId,
      pet_id: pet.id,
      activity_type: 'pet_added',
      title: 'Pet Added',
      description: `Pet "${pet.name}" was added`,
      occurred_at: new Date().toISOString(),
      created_by: userId,
    };
    await kv.set(`customer:${tenantId}:activity:${householdId}:${activity.id}`, activity);

    await dualWriteCustomers([
      dwSet(`customer:${tenantId}:pet:${householdId}:${pet.id}`, pet),
      dwSet(`customer:${tenantId}:activity:${householdId}:${activity.id}`, activity),
    ]);

    return c.json({ ...pet, photo_url: await signPetPhotoUrl(storedPetPhoto(pet)) });
  } catch (error: any) {
    return internalError(c, 'customers.createPet', error);
  }
});

// Update pet
app.put('/pets/:id', requireRole('admin', 'manager', 'assistant_manager'), async (c) => {
  try {
    const user = c.get('user') as AuthenticatedUser;
    const tenantId = user.tenantId;
    const petId = c.req.param('id');
    
    const body = await c.req.json();
    
    // Find the pet
    const allPets = await kv.getByPrefix(`customer:${tenantId}:pet:`);
    const existingPet = allPets.find((p: any) => {
      return p.id === petId;
    });
    
    if (!existingPet) {
      return c.json({ error: 'Pet not found' }, 404);
    }
    
    const petData = existingPet;
    const householdId = petData.household_id;
    
    const updated = {
      ...petData,
      ...body,
      id: petId,
      tenant_id: tenantId,
      household_id: householdId,
      created_at: petData.created_at,
      updated_at: new Date().toISOString(),
    };
    // Photo writes persist as a storage path (photo_path), never a URL —
    // clients echo back the signed URL the upload endpoint returned, and a
    // photo_url of null/'' clears photo_path too (remove-photo flow).
    if ('photo_path' in body || 'photo_url' in body || 'photoUrl' in body) {
      const incoming = 'photo_path' in body
        ? body.photo_path
        : ('photo_url' in body ? body.photo_url : body.photoUrl);
      applyPetPhotoWrite(updated, incoming);
    }

    await kv.set(`customer:${tenantId}:pet:${householdId}:${petId}`, updated);
    
    // Create activity event for pet update
    const activity = {
      id: generateId('activity'),
      tenant_id: tenantId,
      household_id: householdId,
      pet_id: petId,
      activity_type: 'pet_updated',
      title: 'Pet Profile Updated',
      description: `Pet "${updated.name}" profile was updated`,
      occurred_at: new Date().toISOString(),
      created_by: user.id,
      created_by_name: user.user_metadata?.full_name || user.email,
      created_at: new Date().toISOString(),
    };
    await kv.set(`customer:${tenantId}:activity:${activity.id}`, activity);

    await dualWriteCustomers([
      dwSet(`customer:${tenantId}:pet:${householdId}:${petId}`, updated),
      dwSet(`customer:${tenantId}:activity:${activity.id}`, activity),
    ]);

    return c.json({ ...updated, photo_url: await signPetPhotoUrl(storedPetPhoto(updated)) });
  } catch (error: any) {
    return internalError(c, 'customers.updatePet', error);
  }
});

// Transfer pet to another household (dog rehomed / adopted by a new family).
// The pet id is stable, so pet-keyed history (vaccinations, pet updates,
// incident pet-index) follows automatically. This route rewrites everything
// that embeds the household: the pet record (household in key AND value),
// pet-scoped flags and documents, and FUTURE service records — daycare,
// overnight, grooming routes all resolve the pet via the record's household
// id, so leaving those stale would break their pet lookups. Past/finished
// visits, invoices, and old timeline entries stay with the old family: that
// history (and its billing) happened under them.
app.post('/pets/:id/transfer', requireRole('admin', 'manager'), async (c) => {
  try {
    const user = c.get('user') as AuthenticatedUser;
    const tenantId = user.tenantId;
    const petId = c.req.param('id');

    const parsed = z.object({ to_household_id: z.string().min(1) }).safeParse(await c.req.json());
    if (!parsed.success) {
      return c.json({ error: 'to_household_id is required' }, 400);
    }
    const toHouseholdId = parsed.data.to_household_id;

    const allPets = await kv.getByPrefix(`customer:${tenantId}:pet:`);
    const pet = (allPets as Record<string, any>[]).find((p) => p?.id === petId);
    if (!pet) {
      return c.json({ error: 'Pet not found' }, 404);
    }
    const fromHouseholdId = pet.household_id as string;
    if (fromHouseholdId === toHouseholdId) {
      return c.json({ error: 'Pet already belongs to this household' }, 400);
    }

    const toHousehold = await kv.get(`customer:${tenantId}:household:${toHouseholdId}`) as Record<string, any> | null;
    if (!toHousehold) {
      return c.json({ error: 'Destination household not found' }, 404);
    }
    const fromHousehold = await kv.get(`customer:${tenantId}:household:${fromHouseholdId}`) as Record<string, any> | null;

    const now = new Date().toISOString();
    const today = now.split('T')[0];
    const dw: CustomerDualWriteOp[] = [];

    // 1. The pet record — household id lives in the key, so this is a move.
    const movedPet = movePetToHousehold(pet, toHouseholdId, now);
    await kv.set(`customer:${tenantId}:pet:${toHouseholdId}:${petId}`, movedPet);
    await kv.del(`customer:${tenantId}:pet:${fromHouseholdId}:${petId}`);
    // del before set: the PG mirror upserts by legacy_kv_key, and ops apply
    // in order inside one transaction.
    dw.push(dwDel(`customer:${tenantId}:pet:${fromHouseholdId}:${petId}`));
    dw.push(dwSet(`customer:${tenantId}:pet:${toHouseholdId}:${petId}`, movedPet));

    // 2. Pet-scoped flags (bite history etc.) follow the dog; household-wide
    // flags (payment_hold, vip) stay with the old family.
    const flagRecords = await kv.getByPrefix(`customer:${tenantId}:household:${fromHouseholdId}:flag:`);
    const flagsToMove = petScopedFlags(flagRecords as Record<string, any>[], petId);
    for (const flag of flagsToMove) {
      const moved = moveFlagToHousehold(flag, toHouseholdId, now);
      await kv.set(`customer:${tenantId}:household:${toHouseholdId}:flag:${flag.id}`, moved);
      await kv.del(`customer:${tenantId}:household:${fromHouseholdId}:flag:${flag.id}`);
      dw.push(dwDel(`customer:${tenantId}:household:${fromHouseholdId}:flag:${flag.id}`));
      dw.push(dwSet(`customer:${tenantId}:household:${toHouseholdId}:flag:${flag.id}`, moved));
    }

    // 3. Pet-scoped documents (vaccination certs) follow; household documents
    // (waiver) stay.
    const docRecords = await kv.getByPrefix(`customer:${tenantId}:document:${fromHouseholdId}:`);
    const docsToMove = petScopedDocuments(docRecords as Record<string, any>[], petId);
    for (const doc of docsToMove) {
      const moved = moveDocumentToHousehold(doc, toHouseholdId);
      await kv.set(`customer:${tenantId}:document:${toHouseholdId}:${doc.id}`, moved);
      await kv.del(`customer:${tenantId}:document:${fromHouseholdId}:${doc.id}`);
      dw.push(dwDel(`customer:${tenantId}:document:${fromHouseholdId}:${doc.id}`));
      dw.push(dwSet(`customer:${tenantId}:document:${toHouseholdId}:${doc.id}`, moved));
    }

    // 4. Future daycare bookings — check-in and billing resolve contacts and
    // the pet through booking.household_id.
    const bookingRecords = (await kv.getByPrefix('daycare:booking:'))
      .filter((b: any) => b && typeof b === 'object' && b.id && b.pet_id)
      .filter((b: any) => !b.tenant_id || b.tenant_id === tenantId);
    const bookingsToMove = upcomingDaycareBookings(bookingRecords as Record<string, any>[], petId, today);
    for (const booking of bookingsToMove) {
      const moved = repointBookingHousehold(booking, toHouseholdId, toHousehold.name as string, now);
      await kv.set(`daycare:booking:${booking.id}`, moved);
      // Keep the per-household index keys consistent with the move.
      await kv.set(`daycare:booking:household:${toHouseholdId}:${booking.id}`, booking.id);
      await kv.del(`daycare:booking:household:${fromHouseholdId}:${booking.id}`);
    }

    // 5. Overnight reservations that have not ended (incl. in-stay).
    const reservationRecords = await kv.getByPrefix(`overnight:${tenantId}:reservation:`);
    const reservationsToMove = activeOvernightReservations(reservationRecords as Record<string, any>[], petId, today);
    for (const reservation of reservationsToMove) {
      const moved = repointReservationHousehold(reservation, toHouseholdId, now);
      await kv.set(`overnight:${tenantId}:reservation:${reservation.id}`, moved);
    }

    // 6. Upcoming grooming appointments.
    const groomingRecords = await kv.getByPrefix(`grooming-apt:${tenantId}:`);
    const groomingToMove = upcomingGroomingAppointments(groomingRecords as Record<string, any>[], petId, today);
    for (const appointment of groomingToMove) {
      const moved = repointGroomingHousehold(appointment, toHouseholdId, toHousehold.name as string, now);
      await kv.set(`grooming-apt:${tenantId}:${appointment.id}`, moved);
    }

    // 7. Photo/note moments (Postgres pet_updates) — the portal gallery is
    // gated by household_id, so the dog's photo history must follow it to the
    // new family (and stop showing in the old family's portal). Best-effort:
    // a failure is logged, never blocks the transfer (KV is authoritative).
    try {
      const url = Deno.env.get('SUPABASE_URL');
      const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
      if (!url || !key) {
        throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.');
      }
      const admin = createClient(url, key, { auth: { persistSession: false } });
      const { error } = await admin
        .from('pet_updates')
        .update({ household_id: toHouseholdId })
        .eq('tenant_id', tenantId)
        .eq('pet_id', petId);
      if (error) throw new Error(`${error.code ?? 'pg_error'}: ${error.message}`);
    } catch (err) {
      logError('customers.transferPet.petUpdatesMove', err, { petId });
    }

    // 8. Pending vaccination review-queue items carry householdId in the value.
    const vaxQueue = await kv.getByPrefix(`vax_review_queue:${tenantId}:`);
    for (const item of (vaxQueue as Record<string, any>[]).filter((q) => q?.petId === petId)) {
      await kv.set(`vax_review_queue:${tenantId}:${item.id}`, { ...item, householdId: toHouseholdId });
    }

    // 9. One activity on each household's timeline (household-scoped key form
    // — the one GET /households/:id/activity reads).
    const outActivity = {
      id: generateId('act'),
      tenant_id: tenantId,
      household_id: fromHouseholdId,
      pet_id: petId,
      activity_type: 'pet_transferred_out',
      title: 'Pet Moved Out',
      description: `"${pet.name}" moved to ${toHousehold.name} (flags and history transferred)`,
      occurred_at: now,
      created_by: user.id,
      created_at: now,
    };
    const inActivity = {
      id: generateId('act'),
      tenant_id: tenantId,
      household_id: toHouseholdId,
      pet_id: petId,
      activity_type: 'pet_transferred_in',
      title: 'Pet Moved In',
      description: `"${pet.name}" joined from ${fromHousehold?.name || 'another household'} (flags and history transferred)`,
      occurred_at: now,
      created_by: user.id,
      created_at: now,
    };
    await kv.set(`customer:${tenantId}:activity:${fromHouseholdId}:${outActivity.id}`, outActivity);
    await kv.set(`customer:${tenantId}:activity:${toHouseholdId}:${inActivity.id}`, inActivity);
    dw.push(dwSet(`customer:${tenantId}:activity:${fromHouseholdId}:${outActivity.id}`, outActivity));
    dw.push(dwSet(`customer:${tenantId}:activity:${toHouseholdId}:${inActivity.id}`, inActivity));

    await dualWriteCustomers(dw);

    return c.json({
      success: true,
      pet: { ...movedPet, photo_url: await signPetPhotoUrl(storedPetPhoto(movedPet)) },
      moved: {
        flags: flagsToMove.length,
        documents: docsToMove.length,
        daycare_bookings: bookingsToMove.length,
        overnight_reservations: reservationsToMove.length,
        grooming_appointments: groomingToMove.length,
      },
    });
  } catch (error: any) {
    return internalError(c, 'customers.transferPet', error);
  }
});

// ============================================================================
// ACTIVITY TIMELINE
// ============================================================================

app.get('/households/:household_id/activity', async (c) => {
  try {
    const user = c.get('user') as AuthenticatedUser;
    const tenantId = user.tenantId;
    const householdId = c.req.param('household_id');
    
    const activities = await kv.getByPrefix(`customer:${tenantId}:activity:${householdId}:`);
    
    // Sort by occurred_at descending
    activities.sort((a: any, b: any) => 
      new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime()
    );
    
    return c.json(activities);
  } catch (error: any) {
    return internalError(c, 'customers.activityTimeline', error);
  }
});

// ============================================================================
// DOCUMENTS
// ============================================================================

// List documents for a household
app.get('/households/:household_id/documents', async (c) => {
  try {
    const user = c.get('user') as AuthenticatedUser;
    const tenantId = user.tenantId;
    const householdId = c.req.param('household_id');
    
    console.log('[List Documents] Searching with tenant:', tenantId, 'household:', householdId);
    
    // DEBUG: Check if documents exist with different tenant IDs
    const allDocs = await kv.getByPrefix(`customer:`);
    const householdDocs = allDocs.filter((d: any) => {
      try {
        return d.household_id === householdId && d.document_type;
      } catch {
        return false;
      }
    });
    
    console.log('[List Documents DEBUG] Found', householdDocs.length, 'documents for household across all tenants');
    householdDocs.forEach((d: any) => {
      console.log('  - Document:', d.document_name, 'tenant_id:', d.tenant_id, 'household_id:', d.household_id);
    });
    
    const documents = await kv.getByPrefix(`customer:${tenantId}:document:${householdId}:`);
    
    console.log('[List Documents] Found', documents.length, 'documents with correct tenant isolation');
    
    return c.json({ documents });
  } catch (error: any) {
    return internalError(c, 'customers.listDocuments', error);
  }
});

// Create document metadata (actual file upload happens client-side to storage)
app.post('/households/:household_id/documents', requireRole('admin', 'manager', 'assistant_manager'), async (c) => {
  try {
    const user = c.get('user') as AuthenticatedUser;
    const tenantId = user.tenantId;
    const userId = user.id;
    const userName = user.name || userId;
    const householdId = c.req.param('household_id');
    
    // Handle both JSON and FormData
    const contentType = c.req.header('Content-Type') || '';
    let body: any;
    
    if (contentType.includes('multipart/form-data')) {
      // FormData upload
      const formData = await c.req.formData();
      const file = formData.get('file') as File;
      
      if (!file) {
        return c.json({ error: 'No file provided' }, 400);
      }
      
      // TODO: Upload to Supabase Storage
      // For now, store metadata with placeholder path
      body = {
        document_type: formData.get('document_type'),
        name: formData.get('name') || file.name,
        file_name: file.name,
        storage_path: `#placeholder-${file.name}`,
        file_size: file.size,
        mime_type: file.type,
        expiry_date: formData.get('expiry_date') || undefined,
        notes: formData.get('notes') || undefined,
        pet_id: formData.get('pet_id') || undefined,
      };
    } else {
      // JSON upload
      body = await c.req.json();
    }
    
    const document = {
      id: generateId('doc'),
      tenant_id: tenantId,
      household_id: householdId,
      pet_id: body.pet_id || undefined,
      document_type: body.document_type || 'other',
      name: body.name,
      file_name: body.file_name,
      storage_path: body.storage_path,
      file_size: body.file_size || 0,
      mime_type: body.mime_type || 'application/octet-stream',
      expiry_date: body.expiry_date || undefined,
      notes: body.notes || undefined,
      uploaded_by: userId,
      uploaded_at: new Date().toISOString(),
    };
    
    await kv.set(`customer:${tenantId}:document:${householdId}:${document.id}`, document);
    
    // Create activity event
    const activityId = generateId('act');
    const now = new Date().toISOString();
    const activity = {
      id: activityId,
      tenant_id: tenantId,
      household_id: householdId,
      pet_id: body.pet_id || undefined,
      activity_type: 'document_uploaded',
      title: 'Document Uploaded',
      description: `Document "${document.name}" was uploaded`,
      occurred_at: now,
      created_by: userId,
      created_by_name: userName,
      created_at: now,
    };
    await kv.set(`customer:${tenantId}:activity:${activityId}`, activity);

    await dualWriteCustomers([
      dwSet(`customer:${tenantId}:document:${householdId}:${document.id}`, document),
      dwSet(`customer:${tenantId}:activity:${activityId}`, activity),
    ]);

    return c.json({ document }, 201);
  } catch (error: any) {
    return internalError(c, 'customers.createDocument', error);
  }
});

// Delete document
app.delete('/households/:household_id/documents/:id', requireRole('admin', 'manager'), async (c) => {
  try {
    const user = c.get('user') as AuthenticatedUser;
    const tenantId = user.tenantId;
    const householdId = c.req.param('household_id');
    const documentId = c.req.param('id');
    
    // Try to delete the document
    await kv.del(`customer:${tenantId}:document:${householdId}:${documentId}`);

    await dualWriteCustomers([
      dwDel(`customer:${tenantId}:document:${householdId}:${documentId}`),
    ]);

    // Note: Actual file deletion from storage should be handled separately

    return c.json({ success: true });
  } catch (error: any) {
    return internalError(c, 'customers.deleteDocument', error);
  }
});

// ============================================================================
// DOCUMENT ALERTS
// ============================================================================

app.get('/document-alerts', async (c) => {
  try {
    const user = c.get('user') as AuthenticatedUser;
    const tenantId = user.tenantId;
    
    const documents = await kv.getByPrefix(`customer:${tenantId}:document:`);
    const households = await kv.getByPrefix(`customer:${tenantId}:household:`);
    const pets = await kv.getByPrefix(`customer:${tenantId}:pet:`);
    
    const householdMap = new Map(households.map((h: any) => {
      return [h.id, h];
    }));
    
    const petMap = new Map(pets.map((p: any) => {
      return [p.id, p];
    }));
    
    const alerts: any[] = [];
    const now = new Date();
    
    documents.forEach((d: any) => {
      
      if (d.expiry_date) {
        const expiryDate = new Date(d.expiry_date);
        const daysUntilExpiry = Math.floor((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        
        const household = householdMap.get(d.household_id);
        const pet = d.pet_id ? petMap.get(d.pet_id) : null;
        
        if (daysUntilExpiry < 0) {
          alerts.push({
            household_id: d.household_id,
            household_name: household?.name,
            pet_id: d.pet_id,
            pet_name: pet?.name,
            alert_type: 'expired',
            document_type: d.document_type,
            expiry_date: d.expiry_date,
            days_until_expiry: daysUntilExpiry,
          });
        } else if (daysUntilExpiry <= 30) {
          alerts.push({
            household_id: d.household_id,
            household_name: household?.name,
            pet_id: d.pet_id,
            pet_name: pet?.name,
            alert_type: 'expiring_soon',
            document_type: d.document_type,
            expiry_date: d.expiry_date,
            days_until_expiry: daysUntilExpiry,
          });
        }
      }
    });
    
    return c.json(alerts);
  } catch (error: any) {
    return internalError(c, 'customers.documentAlerts', error);
  }
});

// ============================================================================
// SEED DATA - Initialize sample households for testing
// ============================================================================

app.post('/seed-data', requireRole('admin', 'manager'), async (c) => {
  try {
    const user = c.get('user') as AuthenticatedUser;
    const tenantId = user.tenantId;
    const userId = user.id;
    console.log('[Seed] TenantId:', tenantId, 'UserId:', userId);
    
    // Check if force reseed requested (clears existing test data)
    const body = await c.req.json().catch(() => ({}));
    const forceReseed = body.force === true;
    console.log('[Seed] Force:', forceReseed);
    
    // Check if data already exists
    const existing = await kv.getByPrefix(`customer:${tenantId}:household:`);
    console.log('[Seed] Existing households:', existing.length);
    if (existing && existing.length > 0 && !forceReseed) {
      return c.json({ message: 'Sample data already exists', count: existing.length, hint: 'Pass { "force": true } to clear and reseed' });
    }
    
    // If force reseed, clear all existing customer data for this tenant
    if (forceReseed && existing.length > 0) {
      console.log(`[Seed] Force reseed: clearing ${existing.length} existing households`);
      const clearOps: CustomerDualWriteOp[] = [];
      for (const household of existing) {
        // Delete contacts
        const contacts = await kv.getByPrefix(`customer:${tenantId}:contact:${household.id}:`);
        for (const contact of contacts) {
          await kv.del(`customer:${tenantId}:contact:${household.id}:${contact.id}`);
          clearOps.push(dwDel(`customer:${tenantId}:contact:${household.id}:${contact.id}`));
        }
        // Delete pets
        const pets = await kv.getByPrefix(`customer:${tenantId}:pet:${household.id}:`);
        for (const pet of pets) {
          await kv.del(`customer:${tenantId}:pet:${household.id}:${pet.id}`);
          clearOps.push(dwDel(`customer:${tenantId}:pet:${household.id}:${pet.id}`));
        }
        // Delete household
        await kv.del(`customer:${tenantId}:household:${household.id}`);
        clearOps.push(dwDel(`customer:${tenantId}:household:${household.id}`));
      }
      await dualWriteCustomers(clearOps);
      console.log('[Seed] Cleared existing data');
    }
    
    // Create sample households - using `name` field to match create/list API
    const households = [
      {
        id: generateId('hh'),
        name: 'The Smith Family',
        primary_contact_name: 'John Smith',
        email: 'smiths@example.com',
        phone: '555-0101',
        address: '123 Main St, Springfield, IL 62701',
        status: 'active',
        vip: true,
        payment_method: 'credit_card',
        payment_hold: false,
        preferred_location_id: null,
        internal_notes: 'VIP customer - premium service',
        tags: ['vip', 'long-term'],
        tenant_id: tenantId,
        created_by: userId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: generateId('hh'),
        name: 'The Johnson Family',
        primary_contact_name: 'Sarah Johnson',
        email: 'johnsons@example.com',
        phone: '555-0102',
        address: '456 Oak Ave, Springfield, IL 62702',
        status: 'active',
        vip: false,
        payment_method: 'bank_transfer',
        payment_hold: false,
        preferred_location_id: null,
        internal_notes: 'Regular customer',
        tags: ['daycare'],
        tenant_id: tenantId,
        created_by: userId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: generateId('hh'),
        name: 'The Williams Family',
        primary_contact_name: 'Mike Williams',
        email: 'williams@example.com',
        phone: '555-0103',
        address: '789 Pine Rd, Springfield, IL 62703',
        status: 'active',
        vip: false,
        payment_method: 'cash',
        payment_hold: false,
        preferred_location_id: null,
        internal_notes: 'New customer',
        tags: ['grooming', 'overnights'],
        tenant_id: tenantId,
        created_by: userId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];
    
    // Save households and create contacts/pets
    const seedOps: CustomerDualWriteOp[] = [];
    for (const household of households) {
      await kv.set(`customer:${tenantId}:household:${household.id}`, household);
      seedOps.push(dwSet(`customer:${tenantId}:household:${household.id}`, household));
      
      // Create primary contact
      const contact = {
        id: generateId('cnt'),
        household_id: household.id,
        first_name: household.primary_contact_name.split(' ')[0],
        last_name: household.primary_contact_name.split(' ')[1] || '',
        relationship: 'owner',
        email: household.email,
        phone: household.phone,
        is_primary: true,
        is_emergency_contact: true,
        can_pickup: true,
        notes: '',
        tenant_id: tenantId,
        created_by: userId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      
      await kv.set(`customer:${tenantId}:contact:${household.id}:${contact.id}`, contact);
      seedOps.push(dwSet(`customer:${tenantId}:contact:${household.id}:${contact.id}`, contact));

      // Update household with primary contact
      household.primary_contact_id = contact.id;
      await kv.set(`customer:${tenantId}:household:${household.id}`, household);
      seedOps.push(dwSet(`customer:${tenantId}:household:${household.id}`, household));
      
      // Create sample pets
      const petNames = household.name.includes('Smith') 
        ? ['Max', 'Bella']
        : household.name.includes('Johnson')
        ? ['Charlie']
        : ['Luna', 'Cooper'];
      
      for (const petName of petNames) {
        const pet = {
          id: generateId('pet'),
          household_id: household.id,
          name: petName,
          species: 'Dog',
          breed: ['Golden Retriever', 'Labrador', 'German Shepherd'][Math.floor(Math.random() * 3)],
          gender: Math.random() > 0.5 ? 'male' : 'female',
          date_of_birth: new Date(Date.now() - Math.random() * 315360000000).toISOString().split('T')[0],
          color: ['Golden', 'Black', 'Brown', 'White'][Math.floor(Math.random() * 4)],
          weight: Math.floor(Math.random() * 30) + 20,
          microchip: `CHIP${Math.random().toString(36).substring(7).toUpperCase()}`,
          spayed_neutered: Math.random() > 0.3,
          status: 'active',
          medical_conditions: [],
          allergies: [],
          medications: [],
          dietary_needs: '',
          behavioral_notes: '',
          emergency_contact: contact.id,
          vet_name: 'Springfield Veterinary Clinic',
          vet_phone: '555-0200',
          photo_url: null,
          tags: [],
          tenant_id: tenantId,
          created_by: userId,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        
        await kv.set(`customer:${tenantId}:pet:${household.id}:${pet.id}`, pet);
        seedOps.push(dwSet(`customer:${tenantId}:pet:${household.id}:${pet.id}`, pet));
        console.log('[Seed] Created pet:', pet.name, 'for household:', household.name);
        
        // Create daycare bookings for this pet (today and next 3 weekdays)
        const today = new Date();
        for (let i = 0; i < 5; i++) {
          const bookingDate = new Date(today);
          bookingDate.setDate(bookingDate.getDate() + i);
          
          // Skip weekends
          if (bookingDate.getDay() === 0 || bookingDate.getDay() === 6) continue;
          
          const booking = {
            id: generateId('bkg'),
            tenant_id: tenantId,
            household_id: household.id,
            pet_id: pet.id,
            pet_name: pet.name,
            service_type: 'full_day',
            booking_date: bookingDate.toISOString().split('T')[0],
            date: bookingDate.toISOString().split('T')[0], // Keep both for compatibility
            planned_start_time: '08:00',
            planned_end_time: '18:00',
            booking_status: 'confirmed',
            check_in_status: 'not_checked_in',
            location_id: 'default',
            created_by: userId,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };
          
          // Use same key format as daycare_routes.tsx (no tenant prefix for bookings)
          await kv.set(`daycare:booking:${booking.id}`, booking);
          console.log('[Seed] Created booking for', pet.name, 'on', booking.date);
        }
      }
    }
    
    await dualWriteCustomers(seedOps);

    // Verify data was created
    const verify = await kv.getByPrefix(`customer:${tenantId}:household:`);
    const bookings = await kv.getByPrefix(`daycare:booking:`);
    console.log('[Seed] COMPLETE - Created', households.length, 'households,', bookings.length, 'bookings. Verified:', verify.length, 'in KV');
    
    return c.json({
      message: 'Sample data created successfully',
      households: households.length,
      bookings: bookings.length,
      verified: verify.length,
      tenantId: tenantId,
    });
  } catch (error: any) {
    return internalError(c, 'customers.seedData', error);
  }
});

// ============================================================================
// IMPORT/EXPORT ROUTES
// ============================================================================

// The import template is generated client-side by BulkImportPage (SheetJS),
// so there is no template route here.

// Bulk import households / contacts / pets.
// The client (BulkImportPage) parses the workbook locally and posts plain JSON
// rows keyed by field name, each carrying its spreadsheet row number so errors
// point back at the user's file. Rows are validated individually — a bad row
// becomes an error entry, never a failed request. All writes are staged and
// flushed only after the whole file is processed; a dry run stages but never
// flushes, so it touches nothing.

const IMPORT_MAX_ROWS = 2000;

// Workbook cells arrive as strings ("Yes", "28", "") or occasionally numbers.
// These normalisers use z.custom so the failure messages read like spreadsheet
// feedback, not schema internals, and stay stable across zod versions.
const importCell = (v: unknown): string => (v === null || v === undefined ? '' : String(v).trim());
const importOptional = z.preprocess((v) => {
  const s = importCell(v);
  return s === '' ? undefined : s;
}, z.string().optional());
const importRequired = z.preprocess(importCell, z.string().min(1, 'required'));
// Tri-state: "Yes"→true, "No"→false, blank→undefined (keep the existing value
// on update, fall back to the field's default on create).
const importYesNo = z.preprocess((v) => {
  const s = importCell(v).toLowerCase();
  if (s === '') return undefined;
  if (['yes', 'y', 'true', '1'].includes(s)) return true;
  if (['no', 'n', 'false', '0'].includes(s)) return false;
  return s;
}, z.custom<boolean | undefined>((v) => v === undefined || typeof v === 'boolean', { message: 'expected Yes or No' }));
const importDate = z.preprocess((v) => {
  const s = importCell(v);
  return s === '' ? undefined : s;
}, z.custom<string | undefined>(
  (v) => v === undefined || (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)),
  { message: 'expected YYYY-MM-DD' },
));
const importNumber = z.preprocess((v) => {
  const s = importCell(v);
  return s === '' ? undefined : Number(s.replace(',', '.'));
}, z.custom<number | undefined>(
  (v) => v === undefined || (typeof v === 'number' && Number.isFinite(v)),
  { message: 'expected a number' },
));
const importChoice = (...values: string[]) => z.preprocess((v) => {
  const s = importCell(v).toLowerCase();
  return s === '' ? undefined : s;
}, z.custom<string | undefined>(
  (v) => v === undefined || values.includes(v as string),
  { message: `expected one of: ${values.join(', ')}` },
));

const importHouseholdRowSchema = z.object({
  row: z.number(),
  name: importRequired,
  external_id: importOptional,
  status: importChoice('active', 'inactive'),
  vip: importYesNo,
  payment_hold: importYesNo,
  hold_reason: importOptional,
  location: importOptional,
  address: importOptional,
  internal_notes: importOptional,
});

const importContactRowSchema = z.object({
  row: z.number(),
  household_name: importRequired,
  first_name: importRequired,
  last_name: importRequired,
  email: importOptional,
  phone: importOptional,
  preferred_contact_method: importOptional,
  is_primary: importYesNo,
  is_emergency_contact: importYesNo,
  emergency_contact_relationship: importOptional,
  marketing_consent: importYesNo,
  sms_consent: importYesNo,
  email_consent: importYesNo,
});

const importPetRowSchema = z.object({
  row: z.number(),
  household_name: importRequired,
  name: importRequired,
  breed: importOptional,
  sex: importOptional,
  date_of_birth: importDate,
  weight_kg: importNumber,
  colour: importOptional,
  microchip: importOptional,
  neutered_status: importChoice('spayed', 'castrated', 'none'),
  medical_notes: importOptional,
  behaviour_notes: importOptional,
  allergies: importOptional,
  feeding_instructions: importOptional,
  vet_name: importOptional,
  vet_phone: importOptional,
  vet_address: importOptional,
  vaccination_expiry_date: importDate,
  daycare_enrolled: importYesNo,
  grooming_enrolled: importYesNo,
  transport_enrolled: importYesNo,
  overnights_enrolled: importYesNo,
});

const importBodySchema = z.object({
  dry_run: z.boolean().default(true),
  households: z.array(z.unknown()).default([]),
  contacts: z.array(z.unknown()).default([]),
  pets: z.array(z.unknown()).default([]),
});

app.post('/import', requireRole('admin', 'manager'), async (c) => {
  try {
    const user = c.get('user') as AuthenticatedUser;
    const tenantId = user.tenantId;
    const userId = user.id;

    const body = importBodySchema.safeParse(await c.req.json().catch(() => null));
    if (!body.success) {
      return c.json({ error: 'Invalid import payload' }, 400);
    }
    const { dry_run, households: householdRows, contacts: contactRows, pets: petRows } = body.data;

    const totalRows = householdRows.length + contactRows.length + petRows.length;
    if (totalRows === 0) {
      return c.json({ error: 'No data rows found in the Households, Contacts, or Pets sheets' }, 400);
    }
    if (totalRows > IMPORT_MAX_ROWS) {
      return c.json({ error: `Too many rows (${totalRows}) — the limit is ${IMPORT_MAX_ROWS} per import` }, 400);
    }

    const errors: Array<{ row: number; entity: string; field: string; message: string }> = [];
    const summary = {
      totalRows,
      households: { created: 0, updated: 0, errors: 0 },
      contacts: { created: 0, updated: 0, errors: 0 },
      pets: { created: 0, updated: 0, errors: 0 },
    };
    const rowNumberOf = (raw: unknown): number => {
      const n = (raw as Record<string, unknown>)?.row;
      return typeof n === 'number' ? n : 0;
    };
    const collectIssues = (entity: string, raw: unknown, issues: Array<{ path: Array<string | number>; message: string }>) => {
      for (const issue of issues) {
        errors.push({ row: rowNumberOf(raw), entity, field: issue.path.join('.') || '(row)', message: issue.message });
      }
    };

    // Staged writes, keyed by KV key so re-touching a record replaces the
    // earlier staged version instead of writing twice.
    const staged = new Map<string, unknown>();
    const now = new Date().toISOString();

    const stageActivity = (householdId: string, petId: string | undefined, type: string, title: string, description: string) => {
      const activity = {
        id: generateId('act'),
        household_id: householdId,
        ...(petId ? { pet_id: petId } : {}),
        activity_type: type,
        title,
        description,
        occurred_at: now,
        created_by: userId,
      };
      staged.set(`customer:${tenantId}:activity:${householdId}:${activity.id}`, activity);
    };

    // Location names resolve against Settings → Locations (location:{id}).
    const locations = await kv.getByPrefix('location:');
    const locationsByName = new Map<string, string>();
    for (const loc of locations) {
      if (loc?.name && loc?.id) locationsByName.set(String(loc.name).toLowerCase(), String(loc.id));
    }

    // ---- households ----
    const existingHouseholds = (await kv.getByPrefix(`customer:${tenantId}:household:`)).filter((h: Record<string, unknown>) => !h.deleted_at);
    const householdsByName = new Map<string, Record<string, unknown>>();
    const householdsByExternalId = new Map<string, Record<string, unknown>>();
    const indexHousehold = (h: Record<string, unknown>) => {
      if (h.name) householdsByName.set(String(h.name).toLowerCase(), h);
      if (h.external_id) householdsByExternalId.set(String(h.external_id), h);
    };
    existingHouseholds.forEach(indexHousehold);

    for (const raw of householdRows) {
      const parsed = importHouseholdRowSchema.safeParse(raw);
      if (!parsed.success) {
        summary.households.errors++;
        collectIssues('household', raw, parsed.error.issues);
        continue;
      }
      const rowData = parsed.data;

      let locationId: string | undefined;
      if (rowData.location) {
        locationId = locationsByName.get(rowData.location.toLowerCase());
        if (!locationId) {
          summary.households.errors++;
          errors.push({
            row: rowData.row,
            entity: 'household',
            field: 'location',
            message: `Location "${rowData.location}" not found — it must match a name in Settings → Locations exactly`,
          });
          continue;
        }
      }

      const match =
        (rowData.external_id && householdsByExternalId.get(rowData.external_id)) ||
        householdsByName.get(rowData.name.toLowerCase());

      if (match) {
        const updated = {
          ...match,
          name: rowData.name,
          external_id: rowData.external_id ?? match.external_id,
          status: rowData.status ?? match.status,
          vip: rowData.vip ?? match.vip,
          payment_hold: rowData.payment_hold ?? match.payment_hold,
          hold_reason: rowData.hold_reason ?? match.hold_reason,
          primary_location_id: locationId ?? match.primary_location_id,
          address: rowData.address ?? match.address,
          internal_notes: rowData.internal_notes ?? match.internal_notes,
          updated_at: now,
        };
        staged.set(`customer:${tenantId}:household:${updated.id}`, updated);
        indexHousehold(updated);
        summary.households.updated++;
      } else {
        const household = {
          id: generateId('hh'),
          tenant_id: tenantId,
          external_id: rowData.external_id,
          name: rowData.name,
          status: rowData.status ?? 'active',
          vip: rowData.vip ?? false,
          payment_hold: rowData.payment_hold ?? false,
          hold_reason: rowData.hold_reason,
          primary_location_id: locationId,
          address: rowData.address,
          internal_notes: rowData.internal_notes,
          created_by: userId,
          created_at: now,
          updated_at: now,
        };
        staged.set(`customer:${tenantId}:household:${household.id}`, household);
        stageActivity(household.id, undefined, 'household_created', 'Household Created', `Household "${household.name}" was created by bulk import`);
        indexHousehold(household);
        summary.households.created++;
      }
    }

    const resolveHousehold = (name: string) => householdsByName.get(name.toLowerCase());
    const householdNotFound = (entity: 'contact' | 'pet', row: number, name: string) => {
      summary[entity === 'contact' ? 'contacts' : 'pets'].errors++;
      errors.push({
        row,
        entity,
        field: 'household_name',
        message: `Household "${name}" not found — add it to the Households sheet or check the spelling`,
      });
    };

    // ---- contacts ----
    const existingContacts = (await kv.getByPrefix(`customer:${tenantId}:contact:`)).filter((ct: Record<string, unknown>) => !ct.deleted_at);
    const contactsByHousehold = new Map<string, Array<Record<string, unknown>>>();
    const indexContact = (ct: Record<string, unknown>) => {
      const list = contactsByHousehold.get(String(ct.household_id)) ?? [];
      list.push(ct);
      contactsByHousehold.set(String(ct.household_id), list);
    };
    existingContacts.forEach(indexContact);
    const findContact = (householdId: string, rowData: { email?: string; first_name: string; last_name: string }) => {
      const list = contactsByHousehold.get(householdId) ?? [];
      if (rowData.email) {
        const byEmail = list.find((ct) => ct.email && String(ct.email).toLowerCase() === rowData.email!.toLowerCase());
        if (byEmail) return byEmail;
      }
      return list.find((ct) =>
        String(ct.first_name ?? '').toLowerCase() === rowData.first_name.toLowerCase() &&
        String(ct.last_name ?? '').toLowerCase() === rowData.last_name.toLowerCase());
    };

    for (const raw of contactRows) {
      const parsed = importContactRowSchema.safeParse(raw);
      if (!parsed.success) {
        summary.contacts.errors++;
        collectIssues('contact', raw, parsed.error.issues);
        continue;
      }
      const rowData = parsed.data;
      const household = resolveHousehold(rowData.household_name);
      if (!household) {
        householdNotFound('contact', rowData.row, rowData.household_name);
        continue;
      }
      const householdId = String(household.id);
      const match = findContact(householdId, rowData);
      let contact: Record<string, unknown>;
      if (match) {
        contact = {
          ...match,
          first_name: rowData.first_name,
          last_name: rowData.last_name,
          email: rowData.email ?? match.email,
          phone: rowData.phone ?? match.phone,
          preferred_contact_method: rowData.preferred_contact_method ?? match.preferred_contact_method,
          is_primary: rowData.is_primary ?? match.is_primary,
          is_emergency_contact: rowData.is_emergency_contact ?? match.is_emergency_contact,
          emergency_contact_relationship: rowData.emergency_contact_relationship ?? match.emergency_contact_relationship,
          marketing_consent: rowData.marketing_consent ?? match.marketing_consent,
          sms_consent: rowData.sms_consent ?? match.sms_consent,
          email_consent: rowData.email_consent ?? match.email_consent,
          updated_at: now,
        };
        Object.assign(match, contact);
        summary.contacts.updated++;
      } else {
        contact = {
          id: generateId('con'),
          tenant_id: tenantId,
          household_id: householdId,
          first_name: rowData.first_name,
          last_name: rowData.last_name,
          email: rowData.email,
          phone: rowData.phone,
          preferred_contact_method: rowData.preferred_contact_method,
          is_primary: rowData.is_primary ?? false,
          is_emergency_contact: rowData.is_emergency_contact ?? false,
          emergency_contact_relationship: rowData.emergency_contact_relationship,
          marketing_consent: rowData.marketing_consent ?? false,
          sms_consent: rowData.sms_consent ?? false,
          email_consent: rowData.email_consent ?? false,
          created_at: now,
          updated_at: now,
        };
        indexContact(contact);
        stageActivity(householdId, undefined, 'contact_added', 'Contact Added', `Contact "${rowData.first_name} ${rowData.last_name}" was added by bulk import`);
        summary.contacts.created++;
      }
      staged.set(`customer:${tenantId}:contact:${householdId}:${contact.id}`, contact);

      // Mirror the single-contact routes: a primary contact is recorded on the
      // household and any other primary in the household is unset.
      if (rowData.is_primary) {
        for (const other of contactsByHousehold.get(householdId) ?? []) {
          if (other.id !== contact.id && other.is_primary) {
            other.is_primary = false;
            other.updated_at = now;
            staged.set(`customer:${tenantId}:contact:${householdId}:${other.id}`, other);
          }
        }
        household.primary_contact_id = contact.id;
        household.updated_at = now;
        staged.set(`customer:${tenantId}:household:${householdId}`, household);
      }
    }

    // ---- pets ----
    const existingPets = (await kv.getByPrefix(`customer:${tenantId}:pet:`)).filter((p: Record<string, unknown>) => !p.deleted_at);
    const petsByHousehold = new Map<string, Array<Record<string, unknown>>>();
    const indexPet = (p: Record<string, unknown>) => {
      const list = petsByHousehold.get(String(p.household_id)) ?? [];
      list.push(p);
      petsByHousehold.set(String(p.household_id), list);
    };
    existingPets.forEach(indexPet);

    for (const raw of petRows) {
      const parsed = importPetRowSchema.safeParse(raw);
      if (!parsed.success) {
        summary.pets.errors++;
        collectIssues('pet', raw, parsed.error.issues);
        continue;
      }
      const rowData = parsed.data;
      const household = resolveHousehold(rowData.household_name);
      if (!household) {
        householdNotFound('pet', rowData.row, rowData.household_name);
        continue;
      }
      const householdId = String(household.id);
      const match = (petsByHousehold.get(householdId) ?? []).find(
        (p) => String(p.name ?? '').toLowerCase() === rowData.name.toLowerCase(),
      );
      let pet: Record<string, unknown>;
      if (match) {
        pet = {
          ...match,
          name: rowData.name,
          breed: rowData.breed ?? match.breed,
          sex: rowData.sex ?? match.sex,
          date_of_birth: rowData.date_of_birth ?? match.date_of_birth,
          weight_kg: rowData.weight_kg ?? match.weight_kg,
          colour: rowData.colour ?? match.colour,
          microchip: rowData.microchip ?? match.microchip,
          neutered_status: rowData.neutered_status ?? match.neutered_status,
          medical_notes: rowData.medical_notes ?? match.medical_notes,
          behaviour_notes: rowData.behaviour_notes ?? match.behaviour_notes,
          allergies: rowData.allergies ?? match.allergies,
          feeding_instructions: rowData.feeding_instructions ?? match.feeding_instructions,
          vet_name: rowData.vet_name ?? match.vet_name,
          vet_phone: rowData.vet_phone ?? match.vet_phone,
          vet_address: rowData.vet_address ?? match.vet_address,
          vaccination_expiry_date: rowData.vaccination_expiry_date ?? match.vaccination_expiry_date,
          daycare_enrolled: rowData.daycare_enrolled ?? match.daycare_enrolled,
          grooming_enrolled: rowData.grooming_enrolled ?? match.grooming_enrolled,
          transport_enrolled: rowData.transport_enrolled ?? match.transport_enrolled,
          overnights_enrolled: rowData.overnights_enrolled ?? match.overnights_enrolled,
          updated_at: now,
        };
        Object.assign(match, pet);
        summary.pets.updated++;
      } else {
        pet = {
          id: generateId('pet'),
          tenant_id: tenantId,
          household_id: householdId,
          name: rowData.name,
          breed: rowData.breed,
          sex: rowData.sex,
          date_of_birth: rowData.date_of_birth,
          weight_kg: rowData.weight_kg,
          colour: rowData.colour,
          microchip: rowData.microchip,
          neutered_status: rowData.neutered_status,
          medical_notes: rowData.medical_notes,
          behaviour_notes: rowData.behaviour_notes,
          allergies: rowData.allergies,
          feeding_instructions: rowData.feeding_instructions,
          vet_name: rowData.vet_name,
          vet_phone: rowData.vet_phone,
          vet_address: rowData.vet_address,
          vaccination_expiry_date: rowData.vaccination_expiry_date,
          vaccination_status: 'unknown',
          daycare_enrolled: rowData.daycare_enrolled ?? false,
          grooming_enrolled: rowData.grooming_enrolled ?? false,
          transport_enrolled: rowData.transport_enrolled ?? false,
          overnights_enrolled: rowData.overnights_enrolled ?? false,
          active: true,
          created_at: now,
          updated_at: now,
        };
        indexPet(pet);
        stageActivity(householdId, String(pet.id), 'pet_added', 'Pet Added', `Pet "${rowData.name}" was added by bulk import`);
        summary.pets.created++;
      }
      staged.set(`customer:${tenantId}:pet:${householdId}:${pet.id}`, pet);
    }

    // ---- flush ----
    if (!dry_run && staged.size > 0) {
      const keys = [...staged.keys()];
      const CHUNK = 500;
      for (let i = 0; i < keys.length; i += CHUNK) {
        const slice = keys.slice(i, i + CHUNK);
        await kv.mset(slice, slice.map((k) => staged.get(k)));
      }
      // Mirror the whole import to Postgres in one transaction.
      await dualWriteCustomers(
        keys.map((k) => dwSet(k, staged.get(k) as Record<string, unknown>)),
      );
    }

    // success reflects "the file was processed", not "every row was clean" —
    // row problems are reported in errors/summary. In apply mode, valid rows
    // are imported and bad rows are skipped with their errors listed.
    return c.json({ success: true, dry_run, summary, errors });
  } catch (error: any) {
    return internalError(c, 'customers.importCustomers', error);
  }
});

// Export customers to XLSX
app.get('/export', async (c) => {
  try {
    const user = c.get('user') as AuthenticatedUser;
    const tenantId = user.tenantId;
    
    // Get query parameters for filtering and options
    const search = c.req.query('search') || '';
    const status = c.req.query('status') || '';
    const location = c.req.query('location') || '';
    const vip = c.req.query('vip');
    const paymentHold = c.req.query('paymentHold');
    const documentAlerts = c.req.query('documentAlerts');
    const includeInactive = c.req.query('includeInactive') === 'true';
    const includeContacts = c.req.query('includeContacts') === 'true';
    const includePets = c.req.query('includePets') === 'true';
    const includeDocuments = c.req.query('includeDocuments') === 'true';
    
    // Fetch all households
    const allHouseholds = await kv.getByPrefix(`customer:${tenantId}:household:`);
    let households = allHouseholds
      .filter((item: any) => !item.deleted_at);
    
    // Apply filters
    if (!includeInactive) {
      households = households.filter((h: any) => h.status === 'active');
    }
    if (status) {
      households = households.filter((h: any) => h.status === status);
    }
    if (location) {
      households = households.filter((h: any) => h.location === location);
    }
    if (vip !== undefined) {
      const vipFilter = vip === 'true';
      households = households.filter((h: any) => h.is_vip === vipFilter);
    }
    if (paymentHold !== undefined) {
      const holdFilter = paymentHold === 'true';
      households = households.filter((h: any) => h.payment_hold === holdFilter);
    }
    if (documentAlerts !== undefined) {
      const alertFilter = documentAlerts === 'true';
      households = households.filter((h: any) => h.document_alerts === alertFilter);
    }
    if (search) {
      const searchLower = search.toLowerCase();
      households = households.filter((h: any) => {
        return (
          h.household_name?.toLowerCase().includes(searchLower) ||
          h.primary_contact_name?.toLowerCase().includes(searchLower) ||
          h.primary_contact_email?.toLowerCase().includes(searchLower) ||
          h.primary_contact_phone?.toLowerCase().includes(searchLower)
        );
      });
    }
    
    // Prepare data for sheets
    const householdRows = [];
    const contactRows = [];
    const petRows = [];
    
    // Process each household
    for (const household of households) {
      // Add household row
      householdRows.push({
        'Household ID': household.id,
        'Household Name': household.household_name,
        'Status': household.status,
        'Location': household.location || '',
        'VIP': household.is_vip ? 'Yes' : 'No',
        'Payment Hold': household.payment_hold ? 'Yes' : 'No',
        'Primary Contact': household.primary_contact_name || '',
        'Primary Email': household.primary_contact_email || '',
        'Primary Phone': household.primary_contact_phone || '',
        'Created': new Date(household.created_at).toISOString().split('T')[0],
      });
      
      // Fetch and add contacts
      if (includeContacts) {
        const contacts = await kv.getByPrefix(`customer:${tenantId}:household:${household.id}:contact:`);
        contacts.forEach((contact: any) => {
          if (!contact.deleted_at) {
            contactRows.push({
              'Contact ID': contact.id,
              'Household ID': household.id,
              'Household Name': household.household_name,
              'Name': `${contact.first_name} ${contact.last_name}`,
              'Email': contact.email || '',
              'Phone': contact.phone || '',
              'Type': contact.contact_type || '',
              'Relationship': contact.relationship || '',
              'Primary': contact.is_primary ? 'Yes' : 'No',
              'Emergency': contact.is_emergency ? 'Yes' : 'No',
              'Billing': contact.is_billing ? 'Yes' : 'No',
            });
          }
        });
      }
      
      // Fetch and add pets
      if (includePets) {
        const pets = await kv.getByPrefix(`customer:${tenantId}:household:${household.id}:pet:`);
        pets.forEach((pet: any) => {
          if (!pet.deleted_at) {
            petRows.push({
              'Pet ID': pet.id,
              'Household ID': household.id,
              'Household Name': household.household_name,
              'Name': pet.name,
              'Species': pet.species || '',
              'Breed': pet.breed || '',
              'Sex': pet.sex || '',
              'Age': pet.age_years ? `${pet.age_years} years` : '',
              'Weight': pet.weight_lbs ? `${pet.weight_lbs} lbs` : '',
              'Color': pet.color || '',
              'Microchip': pet.microchip_number || '',
              'Fixed': pet.is_neutered_spayed ? 'Yes' : 'No',
              'Medical Notes': pet.medical_notes || '',
              'Behavioral Notes': pet.behavioral_notes || '',
              'Active': pet.is_active ? 'Yes' : 'No',
            });
          }
        });
      }
    }
    
    // Generate CSV format (simple implementation)
    // For a full Excel implementation, you'd use a library like 'xlsx' from npm:
    // However, in Deno environment, we'll create a simple tab-separated format
    
    let csvContent = '';
    
    // Households sheet
    csvContent += '=== HOUSEHOLDS ===\n';
    if (householdRows.length > 0) {
      const headers = Object.keys(householdRows[0]);
      csvContent += headers.join('\t') + '\n';
      householdRows.forEach(row => {
        csvContent += headers.map(h => row[h] || '').join('\t') + '\n';
      });
    }
    csvContent += '\n\n';
    
    // Contacts sheet
    if (includeContacts && contactRows.length > 0) {
      csvContent += '=== CONTACTS ===\n';
      const headers = Object.keys(contactRows[0]);
      csvContent += headers.join('\t') + '\n';
      contactRows.forEach(row => {
        csvContent += headers.map(h => row[h] || '').join('\t') + '\n';
      });
      csvContent += '\n\n';
    }
    
    // Pets sheet
    if (includePets && petRows.length > 0) {
      csvContent += '=== PETS ===\n';
      const headers = Object.keys(petRows[0]);
      csvContent += headers.join('\t') + '\n';
      petRows.forEach(row => {
        csvContent += headers.map(h => row[h] || '').join('\t') + '\n';
      });
    }
    
    // Return as downloadable file
    const blob = new Blob([csvContent], { type: 'application/vnd.ms-excel' });
    const arrayBuffer = await blob.arrayBuffer();
    
    return new Response(arrayBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.ms-excel',
        'Content-Disposition': `attachment; filename="customers-export-${new Date().toISOString().split('T')[0]}.xls"`,
      },
    });
  } catch (error: any) {
    return internalError(c, 'customers.exportCustomers', error);
  }
});

// ============================================================================
// HOUSEHOLD NOTES
// ============================================================================

// List household notes
app.get('/households/:id/notes', async (c) => {
  try {
    const user = c.get('user') as AuthenticatedUser;
    const tenantId = user.tenantId;
    const householdId = c.req.param('id');
    
    // Verify household belongs to tenant
    const household = await kv.get(`customer:${tenantId}:household:${householdId}`);
    if (!household) {
      return c.json({ error: 'Household not found' }, 404);
    }
    
    // Get all notes for household (excluding soft-deleted)
    const allNotes = await kv.getByPrefix(`customer:${tenantId}:household:${householdId}:note:`);
    let notes = allNotes
      .filter((note: any) => !note.deleted_at);
    
    // Get pet associations for each note
    const notesWithPets = await Promise.all(notes.map(async (note: any) => {
      const petLinks = await kv.getByPrefix(`customer:${tenantId}:note:${note.id}:pet:`);
      const petIds = petLinks.map((link: any) => link.pet_id);
      return { ...note, pet_ids: petIds };
    }));
    
    // Sort: pinned first, then by created_at desc
    notesWithPets.sort((a, b) => {
      if (a.is_pinned && !b.is_pinned) return -1;
      if (!a.is_pinned && b.is_pinned) return 1;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
    
    return c.json(notesWithPets);
  } catch (error: any) {
    return internalError(c, 'customers.listNotes', error);
  }
});

// Create household note
app.post('/households/:id/notes', requireRole('admin', 'manager', 'assistant_manager'), async (c) => {
  try {
    const user = c.get('user') as AuthenticatedUser;
    const tenantId = user.tenantId;
    const userId = user.id;
    const householdId = c.req.param('id');
    
    // Verify household belongs to tenant
    const household = await kv.get(`customer:${tenantId}:household:${householdId}`);
    if (!household) {
      return c.json({ error: 'Household not found' }, 404);
    }
    
    const body = await c.req.json();
    const { title, content, category, visibility = 'internal', is_pinned = false, pet_ids = [] } = body;
    
    // Validate required fields
    if (!content || !category) {
      return c.json({ error: 'Content and category are required' }, 400);
    }
    
    // Validate category
    const validCategories = ['general', 'behaviour', 'medical', 'billing', 'transport', 'grooming', 'overnight'];
    if (!validCategories.includes(category)) {
      return c.json({ error: 'Invalid category' }, 400);
    }
    
    // Validate visibility
    if (visibility !== 'internal' && visibility !== 'customer') {
      return c.json({ error: 'Invalid visibility' }, 400);
    }
    
    const noteId = generateId('note');
    const now = new Date().toISOString();
    
    const note = {
      id: noteId,
      tenant_id: tenantId,
      household_id: householdId,
      title: title || null,
      content,
      category,
      visibility,
      is_pinned,
      created_by: userId,
      created_by_name: user.user_metadata?.full_name || user.email,
      created_at: now,
      updated_at: now,
    };
    
    // Save note
    await kv.set(`customer:${tenantId}:household:${householdId}:note:${noteId}`, note);

    // Note + link mirror in one transaction (note first — links FK onto it).
    const dw: CustomerDualWriteOp[] = [
      dwSet(`customer:${tenantId}:household:${householdId}:note:${noteId}`, note),
    ];

    // Save pet associations if provided
    if (pet_ids && pet_ids.length > 0) {
      for (const petId of pet_ids) {
        // Verify pet belongs to household
        const pet = await kv.get(`customer:${tenantId}:pet:${petId}`);
        if (pet) {
          if (pet.household_id === householdId) {
            await kv.set(
              `customer:${tenantId}:note:${noteId}:pet:${petId}`,
              { tenant_id: tenantId, note_id: noteId, pet_id: petId }
            );
            dw.push(dwSet(
              `customer:${tenantId}:note:${noteId}:pet:${petId}`,
              { tenant_id: tenantId, note_id: noteId, pet_id: petId },
            ));
          }
        }
      }
    }

    await dualWriteCustomers(dw);

    // Return note with pet_ids
    const noteWithPets = { ...note, pet_ids };

    return c.json(noteWithPets, 201);
  } catch (error: any) {
    return internalError(c, 'customers.createNote', error);
  }
});

// Update household note
app.patch('/notes/:id', requireRole('admin', 'manager', 'assistant_manager'), async (c) => {
  try {
    const user = c.get('user') as AuthenticatedUser;
    const tenantId = user.tenantId;
    const userId = user.id;
    const noteId = c.req.param('id');
    
    // Find the note (search across all households)
    const allNotes = await kv.getByPrefix(`customer:${tenantId}:household:`);
    let note: any = null;
    let noteKey = '';
    
    for (const tempNote of allNotes) {
      if (tempNote.id === noteId) {
        note = tempNote;
        noteKey = `customer:${tenantId}:household:${tempNote.household_id}:note:${noteId}`;
        break;
      }
    }
    
    if (!note || note.deleted_at) {
      return c.json({ error: 'Note not found' }, 404);
    }
    
    // Role gate enforced by requireRole on this route (admin/manager/assistant
    // manager). Author-level granularity is the follow-up permission matrix.
    const body = await c.req.json();
    const { title, content, category, visibility, is_pinned, pet_ids } = body;
    
    // Update fields
    if (title !== undefined) note.title = title || null;
    if (content !== undefined) note.content = content;
    if (category !== undefined) {
      const validCategories = ['general', 'behaviour', 'medical', 'billing', 'transport', 'grooming', 'overnight'];
      if (!validCategories.includes(category)) {
        return c.json({ error: 'Invalid category' }, 400);
      }
      note.category = category;
    }
    if (visibility !== undefined) {
      if (visibility !== 'internal' && visibility !== 'customer') {
        return c.json({ error: 'Invalid visibility' }, 400);
      }
      note.visibility = visibility;
    }
    if (is_pinned !== undefined) note.is_pinned = is_pinned;
    note.updated_at = new Date().toISOString();
    
    // Save updated note
    await kv.set(noteKey, note);

    // Note + link rewrites mirror in one transaction (deletes before adds).
    const dw: CustomerDualWriteOp[] = [dwSet(noteKey, note)];

    // Update pet associations if provided
    if (pet_ids !== undefined) {
      // Delete existing associations
      const existingLinks = await kv.getByPrefix(`customer:${tenantId}:note:${noteId}:pet:`);
      for (const linkData of existingLinks) {
        await kv.del(`customer:${tenantId}:note:${noteId}:pet:${linkData.pet_id}`);
        dw.push(dwDel(`customer:${tenantId}:note:${noteId}:pet:${linkData.pet_id}`));
      }

      // Add new associations
      if (pet_ids.length > 0) {
        for (const petId of pet_ids) {
          const pet = await kv.get(`customer:${tenantId}:pet:${petId}`);
          if (pet) {
            if (pet.household_id === note.household_id) {
              await kv.set(
                `customer:${tenantId}:note:${noteId}:pet:${petId}`,
                { tenant_id: tenantId, note_id: noteId, pet_id: petId }
              );
              dw.push(dwSet(
                `customer:${tenantId}:note:${noteId}:pet:${petId}`,
                { tenant_id: tenantId, note_id: noteId, pet_id: petId },
              ));
            }
          }
        }
      }
    }

    await dualWriteCustomers(dw);
    
    // Get current pet_ids
    const petLinks = await kv.getByPrefix(`customer:${tenantId}:note:${noteId}:pet:`);
    const currentPetIds = petLinks.map((link: any) => link.pet_id);
    
    return c.json({ ...note, pet_ids: currentPetIds });
  } catch (error: any) {
    return internalError(c, 'customers.updateNote', error);
  }
});

// Delete household note (soft delete)
app.delete('/notes/:id', requireRole('admin', 'manager'), async (c) => {
  try {
    const user = c.get('user') as AuthenticatedUser;
    const tenantId = user.tenantId;
    const userId = user.id;
    const noteId = c.req.param('id');
    
    // Find the note
    const allNotes = await kv.getByPrefix(`customer:${tenantId}:household:`);
    let note: any = null;
    let noteKey = '';
    
    for (const tempNote of allNotes) {
      if (tempNote.id === noteId) {
        note = tempNote;
        noteKey = `customer:${tenantId}:household:${tempNote.household_id}:note:${noteId}`;
        break;
      }
    }
    
    if (!note || note.deleted_at) {
      return c.json({ error: 'Note not found' }, 404);
    }
    
    // Soft delete
    note.deleted_at = new Date().toISOString();
    note.deleted_by = userId;
    
    await kv.set(noteKey, note);

    await dualWriteCustomers([dwSet(noteKey, note)]);

    return c.json({ message: 'Note deleted successfully' });
  } catch (error: any) {
    return internalError(c, 'customers.deleteNote', error);
  }
});

// ============================================================================
// HOUSEHOLD FLAGS
// ============================================================================

// List household flags
app.get('/households/:id/flags', async (c) => {
  try {
    const user = c.get('user') as AuthenticatedUser;
    const tenantId = user.tenantId;
    const householdId = c.req.param('id');
    
    // Verify household belongs to tenant
    const household = await kv.get(`customer:${tenantId}:household:${householdId}`);
    if (!household) {
      return c.json({ error: 'Household not found' }, 404);
    }
    
    // Get all flags for household
    const allFlags = await kv.getByPrefix(`customer:${tenantId}:household:${householdId}:flag:`);
    
    // Sort by created_at desc
    allFlags.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    
    return c.json(allFlags);
  } catch (error: any) {
    return internalError(c, 'customers.listFlags', error);
  }
});

// Create or update household flag
app.post('/households/:id/flags', requireRole('admin', 'manager', 'assistant_manager'), async (c) => {
  try {
    const user = c.get('user') as AuthenticatedUser;
    const tenantId = user.tenantId;
    const userId = user.id;
    const householdId = c.req.param('id');
    
    // Verify household belongs to tenant
    const householdStr = await kv.get(`customer:${tenantId}:household:${householdId}`);
    if (!householdStr) {
      return c.json({ error: 'Household not found' }, 404);
    }
    
    const body = await c.req.json();
    const { flag_key, severity, is_active = true, reason, pet_id } = body;
    
    console.log('Extracted pet_id:', pet_id, 'Type:', typeof pet_id, 'Truthy:', !!pet_id);
    
    // Validate required fields
    if (!flag_key || !severity) {
      return c.json({ error: 'Flag key and severity are required' }, 400);
    }
    
    // Validate flag_key
    const validKeys = ['vip', 'behaviour_caution', 'medical_caution', 'payment_hold', 'transport_instructions', 'grooming_restrictions', 'overnight_restrictions'];
    if (!validKeys.includes(flag_key)) {
      return c.json({ error: 'Invalid flag key' }, 400);
    }
    
    // Validate severity
    if (!['info', 'warn', 'block'].includes(severity)) {
      return c.json({ error: 'Invalid severity' }, 400);
    }
    
    // If pet_id provided, verify it belongs to household
    // Check for truthy value AND not empty string
    if (pet_id && pet_id !== '') {
      console.log(`Validating pet_id: ${pet_id}`);
      const petKey = `customer:${tenantId}:pet:${householdId}:${pet_id}`;
      console.log(`Looking up pet with key: ${petKey}`);
      const pet = await kv.get(petKey);
      if (!pet) {
        console.error(`Pet not found for pet_id: ${pet_id}`);
        return c.json({ error: 'Pet not found' }, 404);
      }
      if (pet.household_id !== householdId) {
        return c.json({ error: 'Pet does not belong to this household' }, 400);
      }
    }
    
    const flagId = generateId('flag');
    const now = new Date().toISOString();
    
    const flag = {
      id: flagId,
      tenant_id: tenantId,
      household_id: householdId,
      pet_id: pet_id || null,
      flag_key,
      severity,
      is_active,
      reason: reason || null,
      created_by: userId,
      created_by_name: user.user_metadata?.full_name || user.email,
      created_at: now,
      updated_at: now,
    };
    
    // Save flag
    await kv.set(`customer:${tenantId}:household:${householdId}:flag:${flagId}`, flag);

    // Multi-key flow (flag + household sync + activity): one PG transaction.
    const dw: CustomerDualWriteOp[] = [
      dwSet(`customer:${tenantId}:household:${householdId}:flag:${flagId}`, flag),
    ];

    // Sync with household fields for VIP and payment_hold
    const household = householdStr;
    if (flag_key === 'vip') {
      household.vip = is_active;
      await kv.set(`customer:${tenantId}:household:${householdId}`, household);
      dw.push(dwSet(`customer:${tenantId}:household:${householdId}`, household));
    } else if (flag_key === 'payment_hold') {
      household.payment_hold = is_active;
      if (reason) {
        household.hold_reason = reason;
      }
      await kv.set(`customer:${tenantId}:household:${householdId}`, household);
      dw.push(dwSet(`customer:${tenantId}:household:${householdId}`, household));
    }
    
    // Create activity event for flag
    const flagLabel = flag_key.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    const activity = {
      id: generateId('activity'),
      tenant_id: tenantId,
      household_id: householdId,
      pet_id: pet_id || null,
      activity_type: 'flag_added',
      title: `Flag Added: ${flagLabel}`,
      description: reason || `${flagLabel} flag was ${is_active ? 'activated' : 'deactivated'}`,
      metadata: {
        flag_key,
        severity,
        is_active,
      },
      occurred_at: now,
      created_by: userId,
      created_by_name: user.user_metadata?.full_name || user.email,
      created_at: now,
    };
    await kv.set(`customer:${tenantId}:activity:${activity.id}`, activity);
    dw.push(dwSet(`customer:${tenantId}:activity:${activity.id}`, activity));

    await dualWriteCustomers(dw);

    return c.json(flag, 201);
  } catch (error: any) {
    return internalError(c, 'customers.createFlag', error);
  }
});

// Update household flag
app.patch('/flags/:id', requireRole('admin', 'manager', 'assistant_manager'), async (c) => {
  try {
    const user = c.get('user') as AuthenticatedUser;
    const tenantId = user.tenantId;
    const flagId = c.req.param('id');
    
    // Find the flag
    const allFlags = await kv.getByPrefix(`customer:${tenantId}:household:`);
    let flag: any = null;
    let flagKey = '';
    
    for (const tempFlag of allFlags) {
      if (tempFlag.id === flagId && tempFlag.flag_key) {  // flag_key exists means it's a flag, not a note
        flag = tempFlag;
        flagKey = `customer:${tenantId}:household:${tempFlag.household_id}:flag:${flagId}`;
        break;
      }
    }
    
    if (!flag) {
      return c.json({ error: 'Flag not found' }, 404);
    }
    
    const body = await c.req.json();
    const { severity, is_active, reason } = body;
    
    // Update fields
    if (severity !== undefined) {
      if (!['info', 'warn', 'block'].includes(severity)) {
        return c.json({ error: 'Invalid severity' }, 400);
      }
      flag.severity = severity;
    }
    if (is_active !== undefined) flag.is_active = is_active;
    if (reason !== undefined) flag.reason = reason || null;
    flag.updated_at = new Date().toISOString();
    
    // Save updated flag
    await kv.set(flagKey, flag);

    // Multi-key flow (flag + activity + household sync): one PG transaction.
    const dw: CustomerDualWriteOp[] = [dwSet(flagKey, flag)];

    // Create activity event for flag update
    const flagLabel = flag.flag_key.split('_').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    const now = new Date().toISOString();
    const activity = {
      id: generateId('activity'),
      tenant_id: tenantId,
      household_id: flag.household_id,
      pet_id: flag.pet_id || null,
      activity_type: 'flag_updated',
      title: `Flag Updated: ${flagLabel}`,
      description: flag.is_active ? `${flagLabel} flag updated` : `${flagLabel} flag deactivated`,
      metadata: {
        flag_key: flag.flag_key,
        severity: flag.severity,
        is_active: flag.is_active,
      },
      occurred_at: now,
      created_by: user.id,
      created_by_name: user.user_metadata?.full_name || user.email,
      created_at: now,
    };
    await kv.set(`customer:${tenantId}:activity:${activity.id}`, activity);
    dw.push(dwSet(`customer:${tenantId}:activity:${activity.id}`, activity));

    // Sync with household fields for VIP and payment_hold
    if (flag.flag_key === 'vip' || flag.flag_key === 'payment_hold') {
      const householdStr = await kv.get(`customer:${tenantId}:household:${flag.household_id}`);
      if (householdStr) {
        if (flag.flag_key === 'vip') {
          householdStr.vip = flag.is_active;
        } else if (flag.flag_key === 'payment_hold') {
          householdStr.payment_hold = flag.is_active;
          if (flag.reason) {
            householdStr.hold_reason = flag.reason;
          }
        }
        await kv.set(`customer:${tenantId}:household:${flag.household_id}`, householdStr);
        dw.push(dwSet(`customer:${tenantId}:household:${flag.household_id}`, householdStr));
      }
    }

    await dualWriteCustomers(dw);

    return c.json(flag);
  } catch (error: any) {
    return internalError(c, 'customers.updateFlag', error);
  }
});

// Delete household flag
app.delete('/flags/:id', requireRole('admin', 'manager'), async (c) => {
  try {
    const user = c.get('user') as AuthenticatedUser;
    const tenantId = user.tenantId;
    const flagId = c.req.param('id');
    
    // Find the flag
    const allFlags = await kv.getByPrefix(`customer:${tenantId}:household:`);
    let flag: any = null;
    let flagKey = '';
    
    for (const flagObjObj of allFlags) {
      // KV store returns already-parsed objects, not JSON strings
      // KV store returns already-parsed objects, not JSON strings
      const tempFlag = flagObjObj;
      if (tempFlag.id === flagId && tempFlag.flag_key) {
        flag = tempFlag;
        flagKey = `customer:${tenantId}:household:${tempFlag.household_id}:flag:${flagId}`;
        break;
      }
    }
    
    if (!flag) {
      return c.json({ error: 'Flag not found' }, 404);
    }
    
    // Delete flag
    await kv.del(flagKey);

    // Multi-key flow (flag delete + activity + household sync): one PG transaction.
    const dw: CustomerDualWriteOp[] = [dwDel(flagKey)];

    // Create activity event for flag removal
    const flagLabel = flag.flag_key.split('_').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    const now = new Date().toISOString();
    const activity = {
      id: generateId('activity'),
      tenant_id: tenantId,
      household_id: flag.household_id,
      pet_id: flag.pet_id || null,
      activity_type: 'flag_removed',
      title: `Flag Removed: ${flagLabel}`,
      description: flag.reason ? `${flagLabel} flag removed. Previous reason: ${flag.reason}` : `${flagLabel} flag was removed`,
      metadata: {
        flag_key: flag.flag_key,
        severity: flag.severity,
        was_active: flag.is_active,
      },
      occurred_at: now,
      created_by: user.id,
      created_by_name: user.user_metadata?.full_name || user.email,
      created_at: now,
    };
    await kv.set(`customer:${tenantId}:activity:${activity.id}`, activity);
    dw.push(dwSet(`customer:${tenantId}:activity:${activity.id}`, activity));

    // Sync with household fields for VIP and payment_hold
    if (flag.flag_key === 'vip' || flag.flag_key === 'payment_hold') {
      const householdDaDataa = await kv.get(`customer:${tenantId}:household:${flag.household_id}`);
      if (householdDaDataa) {
        // KV store returns already-parsed objects, not JSON strings
        // KV store returns already-parsed objects, not JSON strings
        const household = householdDaDataa;
        if (flag.flag_key === 'vip') {
          household.vip = false;
        } else if (flag.flag_key === 'payment_hold') {
          household.payment_hold = false;
        }
        await kv.set(`customer:${tenantId}:household:${flag.household_id}`, household);
        dw.push(dwSet(`customer:${tenantId}:household:${flag.household_id}`, household));
      }
    }

    await dualWriteCustomers(dw);

    return c.json({ message: 'Flag deleted successfully' });
  } catch (error: any) {
    return internalError(c, 'customers.deleteFlag', error);
  }
});

// ============================================================================
// TIMELINE / ACTIVITY EVENTS
// ============================================================================

// Clear all flags and timeline events (for fresh start)
app.delete('/clear-timeline-data', requireRole('admin', 'manager'), async (c) => {
  try {
    const user = c.get('user') as AuthenticatedUser;
    const tenantId = user.tenantId;
    
    console.log(`[Clear Timeline Data] Clearing all flags and activities for tenant ${tenantId}`);

    // Bulk clear is a multi-key flow: mirror every del/set in one PG transaction.
    const dw: CustomerDualWriteOp[] = [];

    // Delete all flags
    const allFlags = await kv.getByPrefix(`customer:${tenantId}:`);
    const flagKeys = [];
    for (const item of allFlags) {
      // KV store returns already-parsed objects, not JSON strings
      const parsed = item;
      if (parsed.flag_key) { // It's a flag
        const household_id = parsed.household_id;
        const flag_id = parsed.id;
        flagKeys.push(`customer:${tenantId}:household:${household_id}:flag:${flag_id}`);
      }
    }
    
    if (flagKeys.length > 0) {
      await kv.mdel(flagKeys);
      for (const key of flagKeys) dw.push(dwDel(key));
      console.log(`[Clear Timeline Data] Deleted ${flagKeys.length} flags`);
    }
    
    // Delete all activities
    const allActivities = await kv.getByPrefix(`customer:${tenantId}:activity:`);
    const activityKeys = allActivities.map((item: any) => {
      // KV store returns already-parsed objects, not JSON strings
      const parsed = item;
      return `customer:${tenantId}:activity:${parsed.id}`;
    });
    
    if (activityKeys.length > 0) {
      await kv.mdel(activityKeys);
      for (const key of activityKeys) dw.push(dwDel(key));
      console.log(`[Clear Timeline Data] Deleted ${activityKeys.length} activities`);
    }
    
    // Delete all notes
    const allNotes = await kv.getByPrefix(`customer:${tenantId}:`);
    const noteKeys = [];
    for (const item of allNotes) {
      // KV store returns already-parsed objects, not JSON strings
      const parsed = item;
      if (parsed.category && parsed.content) { // It's a note
        const household_id = parsed.household_id;
        const note_id = parsed.id;
        noteKeys.push(`customer:${tenantId}:household:${household_id}:note:${note_id}`);
      }
    }
    
    if (noteKeys.length > 0) {
      await kv.mdel(noteKeys);
      for (const key of noteKeys) dw.push(dwDel(key));
      console.log(`[Clear Timeline Data] Deleted ${noteKeys.length} notes`);
    }
    
    // Reset VIP and payment_hold flags on all households
    const allHouseholds = await kv.getByPrefix(`customer:${tenantId}:household:`);
    for (const householdObjObj of allHouseholds) {
      // KV store returns already-parsed objects, not JSON strings
      // KV store returns already-parsed objects, not JSON strings
      const household = householdObjObj;
      if (household.vip || household.payment_hold) {
        household.vip = false;
        household.payment_hold = false;
        await kv.set(`customer:${tenantId}:household:${household.id}`, household);
        dw.push(dwSet(`customer:${tenantId}:household:${household.id}`, household));
      }
    }

    await dualWriteCustomers(dw);

    return c.json({
      message: 'All flags, activities, and notes cleared successfully',
      deleted: {
        flags: flagKeys.length,
        activities: activityKeys.length,
        notes: noteKeys.length
      }
    });
  } catch (error: any) {
    return internalError(c, 'customers.clearTimelineData', error);
  }
});

// Get timeline events for a pet
app.get('/pets/:petId/timeline', async (c) => {
  try {
    const user = c.get('user') as AuthenticatedUser;
    const tenantId = user.tenantId;
    const petId = c.req.param('petId');
    
    // Verify pet exists
    const allPets = await kv.getByPrefix(`customer:${tenantId}:pet:`);
    let pet: any = null;
    
    for (const petObj of allPets) {
      // KV store returns already-parsed objects, not JSON strings
      const tempPet = petObj;
      if (tempPet.id === petId) {
        pet = tempPet;
        break;
      }
    }
    
    if (!pet) {
      return c.json({ error: 'Pet not found' }, 404);
    }
    
    const householdId = pet.household_id;
    
    // Get all activity events for this pet
    const allEvents = await kv.getByPrefix(`customer:${tenantId}:activity:`);
    const petEvents = allEvents
      // KV store returns already-parsed objects, not JSON strings
      .map((event: any) => event)
      .filter(event => {
        // Include events specifically for this pet
        if (event.pet_id === petId) return true;
        
        // Include household-level events (null pet_id) that belong to this household
        if (!event.pet_id && event.household_id === householdId) {
          // Include household-level flag events (flag_added, flag_removed, flag_updated)
          if (event.activity_type && event.activity_type.includes('flag')) return true;
        }
        
        return false;
      })
      .map(event => ({
        ...event,
        timeline_type: 'activity',
        timeline_date: event.occurred_at,
      }));
    
    // Get all notes for this household
    const allNotes = await kv.getByPrefix(`customer:${tenantId}:household:${householdId}:note:`);
    const petNotes = allNotes
      // KV store returns already-parsed objects, not JSON strings
      .map((note: any) => note)
      .filter(note => {
        // Include notes that are linked to this specific pet
        if (!note.deleted_at) {
          if (note.pet_ids && note.pet_ids.length > 0) {
            return note.pet_ids.includes(petId);
          }
        }
        return false;
      })
      .map(note => ({
        ...note,
        timeline_type: 'note',
        timeline_date: note.created_at,
      }));
    
    // Get all flags for this household
    const allFlags = await kv.getByPrefix(`customer:${tenantId}:household:${householdId}:flag:`);
    const petFlags = allFlags
      // KV store returns already-parsed objects, not JSON strings
      .map((flag: any) => flag)
      .filter(flag => {
        // Include flags specifically for this pet
        if (flag.pet_id === petId) return true;
        
        // Include household-level flags (null pet_id)
        if (!flag.pet_id) return true;
        
        return false;
      })
      .map(flag => ({
        ...flag,
        timeline_type: 'flag',
        timeline_date: flag.created_at,
      }));
    
    // Daycare visits — derived from the pet's attended bookings, the same
    // source the profile's "Recent Visits" stat counts. Check-in/check-out
    // never wrote activity-feed events, so without this merge a visit shows
    // in the stats but never in the timeline.
    const allBookings = await kv.getByPrefix('daycare:booking:');
    const visitItems: any[] = [];
    for (const booking of allBookings) {
      if (booking.pet_id !== petId) continue;
      const attended =
        booking.check_in_status === 'checked_in' ||
        booking.check_in_status === 'checked_out' ||
        booking.booking_status === 'completed';
      if (!attended) continue;

      const checkinAt = booking.actual_check_in_time || booking.booking_date;
      if (checkinAt) {
        visitItems.push({
          id: `${booking.id}-checkin`,
          household_id: booking.household_id,
          pet_id: booking.pet_id,
          activity_type: 'daycare_checkin',
          title: 'Daycare check-in',
          description: booking.handover_notes || undefined,
          occurred_at: checkinAt,
          created_by_name: booking.checked_in_by_name || undefined,
          timeline_type: 'activity',
          timeline_date: checkinAt,
        });
      }
      if (booking.actual_check_out_time) {
        visitItems.push({
          id: `${booking.id}-checkout`,
          household_id: booking.household_id,
          pet_id: booking.pet_id,
          activity_type: 'daycare_checkout',
          title: 'Daycare check-out',
          description: booking.checkout_notes || undefined,
          occurred_at: booking.actual_check_out_time,
          created_by_name: booking.checked_out_by_name || undefined,
          timeline_type: 'activity',
          timeline_date: booking.actual_check_out_time,
        });
      }
    }

    // Combine all timeline items and sort by date descending
    const timelineItems = [...petEvents, ...petNotes, ...petFlags, ...visitItems]
      .sort((a, b) => new Date(b.timeline_date).getTime() - new Date(a.timeline_date).getTime());

    return c.json(timelineItems);
  } catch (error: any) {
    return internalError(c, 'customers.petTimeline', error);
  }
});

// Create activity event
app.post('/activity', async (c) => {
  try {
    const user = c.get('user') as AuthenticatedUser;
    const tenantId = user.tenantId;
    const userId = user.id;
    
    const body = await c.req.json();
    const { 
      household_id, 
      pet_id, 
      activity_type, 
      title, 
      description, 
      metadata, 
      source_id,
      source_module,
      occurred_at 
    } = body;
    
    // Validate required fields
    if (!household_id || !activity_type || !title) {
      return c.json({ error: 'Missing required fields' }, 400);
    }
    
    // Verify household exists
    const householdStr = await kv.get(`customer:${tenantId}:household:${household_id}`);
    if (!householdStr) {
      return c.json({ error: 'Household not found' }, 404);
    }
    
    // If pet_id provided, verify it exists
    if (pet_id) {
      const allPets = await kv.getByPrefix(`customer:${tenantId}:pet:${household_id}:`);
      const petExists = allPets.some(petObj => {
        // KV store returns already-parsed objects, not JSON strings
        const pet = petObj;
        return pet.id === pet_id;
      });
      
      if (!petExists) {
        return c.json({ error: 'Pet not found' }, 404);
      }
    }
    
    const activityId = generateId('activity');
    const now = new Date().toISOString();
    
    const activity = {
      id: activityId,
      tenant_id: tenantId,
      household_id,
      pet_id: pet_id || null,
      activity_type,
      title,
      description: description || null,
      metadata: metadata || {},
      source_id: source_id || null,
      source_module: source_module || null,
      occurred_at: occurred_at || now,
      created_by: userId,
      created_by_name: user.user_metadata?.full_name || user.email,
      created_at: now,
    };
    
    // Save activity
    await kv.set(`customer:${tenantId}:activity:${activityId}`, activity);

    await dualWriteCustomers([
      dwSet(`customer:${tenantId}:activity:${activityId}`, activity),
    ]);

    return c.json(activity, 201);
  } catch (error: any) {
    return internalError(c, 'customers.createActivity', error);
  }
});

export default app;