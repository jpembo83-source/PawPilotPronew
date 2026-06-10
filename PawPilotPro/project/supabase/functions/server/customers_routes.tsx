// Customer Management Routes - MDC Operations Centre
// Complete CRUD for households, contacts, pets, documents, activity timeline

import { Hono } from 'npm:hono';
import * as kv from './kv_store.tsx';
import { requireAuth, AuthenticatedUser } from './_shared/auth.ts';
import { internalError } from './_shared/log.ts';

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
    
    console.log('[List Households] Starting fetch for tenantId:', tenantId);
    
    // Get query params
    const search = c.req.query('search');
    const status = c.req.query('status');
    const vip = c.req.query('vip');
    const payment_hold = c.req.query('payment_hold');
    const location_id = c.req.query('location_id');
    
    console.log('[List Households] Filters:', { search, status, vip, payment_hold, location_id });
    
    // Get all households for tenant
    const allHouseholds = await kv.getByPrefix(`customer:${tenantId}:household:`);
    
    console.log('[List Households] Raw households from KV:', allHouseholds.length);
    console.log('[List Households] First household type:', typeof allHouseholds[0]);
    // KV store returns already-parsed objects, not JSON strings
    let households = allHouseholds;
    
    // Fetch ALL contacts and pets for this tenant in bulk (optimization to avoid N+1 queries)
    const allContacts = await kv.getByPrefix(`customer:${tenantId}:contact:`);
    const allPets = await kv.getByPrefix(`customer:${tenantId}:pet:`);
    
    console.log('[List Households] Contacts:', allContacts.length, 'Pets:', allPets.length);
    
    // Parse and group by household_id for fast lookup
    const contactsByHousehold = new Map<string, any[]>();
    const petsByHousehold = new Map<string, any[]>();
    
    // KV store returns already-parsed objects, not JSON strings
    allContacts.forEach((contact: any) => {
      const householdId = contact.household_id;
      if (!contactsByHousehold.has(householdId)) {
        contactsByHousehold.set(householdId, []);
      }
      contactsByHousehold.get(householdId)!.push(contact);
    });
    
    // KV store returns already-parsed objects, not JSON strings
    allPets.forEach((pet: any) => {
      const householdId = pet.household_id;
      if (!petsByHousehold.has(householdId)) {
        petsByHousehold.set(householdId, []);
      }
      petsByHousehold.get(householdId)!.push(pet);
    });
    
    // Apply filters
    if (search) {
      const searchLower = search.toLowerCase();
      households = households.filter((h: any) => {
        // Search in household name
        if (h.name?.toLowerCase().includes(searchLower)) {
          return true;
        }
        
        // Search in contact information
        const householdContacts = contactsByHousehold.get(h.id) || [];
        const contactMatch = householdContacts.some((c: any) => 
          c.first_name?.toLowerCase().includes(searchLower) ||
          c.last_name?.toLowerCase().includes(searchLower) ||
          c.email?.toLowerCase().includes(searchLower) ||
          c.phone?.toLowerCase().includes(searchLower)
        );
        if (contactMatch) {
          return true;
        }
        
        // Search in pet names
        const householdPets = petsByHousehold.get(h.id) || [];
        const petMatch = householdPets.some((p: any) => 
          p.name?.toLowerCase().includes(searchLower)
        );
        if (petMatch) {
          return true;
        }
        
        return false;
      });
    }
    
    if (status) {
      households = households.filter((h: any) => h.status === status);
    }
    
    if (vip === 'true') {
      households = households.filter((h: any) => h.vip === true);
    }
    
    if (payment_hold === 'true') {
      households = households.filter((h: any) => h.payment_hold === true);
    }
    
    if (location_id) {
      households = households.filter((h: any) => h.primary_location_id === location_id);
    }
    
    // Enrich households with contact and pet counts (now done in-memory, much faster)
    const enriched = households.map((household: any) => {
      const householdContacts = contactsByHousehold.get(household.id) || [];
      const householdPets = petsByHousehold.get(household.id) || [];
      const primaryContact = householdContacts.find((c: any) => c.id === household.primary_contact_id);
      
      return {
        ...household,
        contacts_count: householdContacts.length,
        pets_count: householdPets.length,
        primary_contact: primaryContact || null,
      };
    });
    
    console.log('[List Households] After enrichment:', enriched.length, 'households');
    if (enriched.length > 0) {
      console.log('[List Households] First enriched household:', {
        id: enriched[0].id,
        name: enriched[0].name,
        contacts_count: enriched[0].contacts_count,
        pets_count: enriched[0].pets_count
      });
    }
    
    return c.json(enriched);
  } catch (error: any) {
    return internalError(c, 'customers.listHouseholds', error);
  }
});

// Get single household
app.get('/households/:id', async (c) => {
  try {
    const user = c.get('user') as AuthenticatedUser;
    const tenantId = user.tenantId;
    const householdId = c.req.param('id');
    
    const household = await kv.get(`customer:${tenantId}:household:${householdId}`);
    
    if (!household) {
      return c.json({ error: 'Household not found' }, 404);
    }
    
    // KV store returns already-parsed objects, not JSON strings
    const householdData = household;
    
    // Get related data
    const contacts = await kv.getByPrefix(`customer:${tenantId}:contact:${householdId}:`);
    const pets = await kv.getByPrefix(`customer:${tenantId}:pet:${householdId}:`);
    const documents = await kv.getByPrefix(`customer:${tenantId}:document:${householdId}:`);
    
    // KV store returns already-parsed objects, not JSON strings
    return c.json({
      ...householdData,
      contacts: contacts,
      pets: pets,
      documents: documents,
    });
  } catch (error: any) {
    return internalError(c, 'customers.getHousehold', error);
  }
});

// Create household
app.post('/households', async (c) => {
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
    
    return c.json(household);
  } catch (error: any) {
    return internalError(c, 'customers.createHousehold', error);
  }
});

// Update household
app.put('/households/:id', async (c) => {
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
    
    return c.json(updated);
  } catch (error: any) {
    return internalError(c, 'customers.updateHousehold', error);
  }
});

// Delete household
app.delete('/households/:id', async (c) => {
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
    
    // Delete all related data for this household
    // 1. Delete all contacts
    const contacts = await kv.getByPrefix(`customer:${tenantId}:contact:${householdId}:`);
    // KV store returns already-parsed objects, not JSON strings
    for (const contact of contacts) {
      await kv.del(`customer:${tenantId}:contact:${householdId}:${contact.id}`);
    }
    
    // 2. Delete all pets
    const pets = await kv.getByPrefix(`customer:${tenantId}:pet:${householdId}:`);
    // KV store returns already-parsed objects, not JSON strings
    for (const pet of pets) {
      await kv.del(`customer:${tenantId}:pet:${householdId}:${pet.id}`);
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
    }
    
    // 8. Delete all notes
    const notes = await kv.getByPrefix(`customer:${tenantId}:household:${householdId}:note:`);
    // KV store returns already-parsed objects, not JSON strings
    for (const note of notes) {
      await kv.del(`customer:${tenantId}:household:${householdId}:note:${note.id}`);
    }
    
    // 9. Delete all flags
    const flags = await kv.getByPrefix(`customer:${tenantId}:household:${householdId}:flag:`);
    // KV store returns already-parsed objects, not JSON strings
    for (const flag of flags) {
      await kv.del(`customer:${tenantId}:household:${householdId}:flag:${flag.id}`);
    }
    
    // 10. Delete all activity events
    const activities = await kv.getByPrefix(`customer:${tenantId}:activity:`);
    // KV store returns already-parsed objects, not JSON strings
    for (const activity of activities) {
      if (activity.household_id === householdId) {
        await kv.del(`customer:${tenantId}:activity:${activity.id}`);
      }
    }
    
    // 11. Finally, delete the household itself
    await kv.del(`customer:${tenantId}:household:${householdId}`);
    
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
    
    const contacts = await kv.getByPrefix(`customer:${tenantId}:contact:${householdId}:`);
    
    // KV store returns already-parsed objects, not JSON strings
    return c.json(contacts);
  } catch (error: any) {
    return internalError(c, 'customers.listContacts', error);
  }
});

// Create contact
app.post('/households/:household_id/contacts', async (c) => {
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
    
    // If this is primary contact, update household
    if (contact.is_primary) {
      const household = await kv.get(`customer:${tenantId}:household:${householdId}`);
      if (household) {
        // KV store returns already-parsed objects, not JSON strings
        const householdData = household;
        householdData.primary_contact_id = contact.id;
        householdData.updated_at = new Date().toISOString();
        await kv.set(`customer:${tenantId}:household:${householdId}`, householdData);
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
    
    return c.json(contact);
  } catch (error: any) {
    return internalError(c, 'customers.createContact', error);
  }
});

// Update contact
app.put('/contacts/:id', async (c) => {
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
      }
    }
    
    await kv.set(`customer:${tenantId}:contact:${householdId}:${contactId}`, updated);
    
    return c.json(updated);
  } catch (error: any) {
    return internalError(c, 'customers.updateContact', error);
  }
});

// Delete contact
app.delete('/contacts/:id', async (c) => {
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
    
    const pets = await kv.getByPrefix(`customer:${tenantId}:pet:${householdId}:`);
    
    // KV store returns already-parsed objects, not JSON strings
    return c.json(pets);
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
    
    // Find the pet
    const allPets = await kv.getByPrefix(`customer:${tenantId}:pet:`);
    const existingPet = allPets.find((p: any) => {
      return p.id === petId;
    });
    
    if (!existingPet) {
      return c.json({ error: 'Pet not found' }, 404);
    }
    
    return c.json(existingPet);
  } catch (error: any) {
    return internalError(c, 'customers.getPet', error);
  }
});

// Create pet
app.post('/households/:household_id/pets', async (c) => {
  try {
    const user = c.get('user') as AuthenticatedUser;
    const tenantId = user.tenantId;
    const userId = user.id;
    const householdId = c.req.param('household_id');
    
    const body = await c.req.json();
    
    if (!body.name) {
      return c.json({ error: 'Pet name is required' }, 400);
    }
    
    const pet = {
      id: generateId('pet'),
      tenant_id: tenantId,
      household_id: householdId,
      name: body.name,
      photo_url: body.photo_url,
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
    
    return c.json(pet);
  } catch (error: any) {
    return internalError(c, 'customers.createPet', error);
  }
});

// Update pet
app.put('/pets/:id', async (c) => {
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
    
    return c.json(updated);
  } catch (error: any) {
    return internalError(c, 'customers.updatePet', error);
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
app.post('/households/:household_id/documents', async (c) => {
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
    
    return c.json({ document }, 201);
  } catch (error: any) {
    return internalError(c, 'customers.createDocument', error);
  }
});

// Delete document
app.delete('/households/:household_id/documents/:id', async (c) => {
  try {
    const user = c.get('user') as AuthenticatedUser;
    const tenantId = user.tenantId;
    const householdId = c.req.param('household_id');
    const documentId = c.req.param('id');
    
    // Try to delete the document
    await kv.del(`customer:${tenantId}:document:${householdId}:${documentId}`);
    
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

app.post('/seed-data', async (c) => {
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
      for (const household of existing) {
        // Delete contacts
        const contacts = await kv.getByPrefix(`customer:${tenantId}:contact:${household.id}:`);
        for (const contact of contacts) await kv.del(`customer:${tenantId}:contact:${household.id}:${contact.id}`);
        // Delete pets
        const pets = await kv.getByPrefix(`customer:${tenantId}:pet:${household.id}:`);
        for (const pet of pets) await kv.del(`customer:${tenantId}:pet:${household.id}:${pet.id}`);
        // Delete household
        await kv.del(`customer:${tenantId}:household:${household.id}`);
      }
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
    for (const household of households) {
      await kv.set(`customer:${tenantId}:household:${household.id}`, household);
      
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
      
      // Update household with primary contact
      household.primary_contact_id = contact.id;
      await kv.set(`customer:${tenantId}:household:${household.id}`, household);
      
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

// Download import template
app.get('/import/template', async (c) => {
  try {
    const user = c.get('user') as AuthenticatedUser;
    const tenantId = user.tenantId;
    
    // For now, return a simple message
    // In production, this would generate an Excel template using a library like xlsx
    return c.json({ 
      message: 'Template download not yet implemented',
      note: 'This will return an Excel file with columns: household_name, external_id, contact_first_name, contact_last_name, contact_email, contact_phone, pet_name, pet_breed, pet_species, etc.'
    });
  } catch (error: any) {
    return internalError(c, 'customers.templateDownload', error);
  }
});

// Import customers from XLSX
app.post('/import', async (c) => {
  try {
    const user = c.get('user') as AuthenticatedUser;
    const tenantId = user.tenantId;
    
    // For now, return a mock result
    // In production, this would:
    // 1. Parse the uploaded Excel file
    // 2. Validate each row
    // 3. If dry_run=true, return validation results only
    // 4. If dry_run=false, create/update records
    
    return c.json({
      success: true,
      summary: {
        totalRows: 0,
        households: { created: 0, updated: 0, errors: 0 },
        contacts: { created: 0, updated: 0, errors: 0 },
        pets: { created: 0, updated: 0, errors: 0 },
      },
      errors: [],
      message: 'Import functionality not yet implemented. This will parse Excel files and create/update customer records.'
    });
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
app.post('/households/:id/notes', async (c) => {
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
          }
        }
      }
    }
    
    // Return note with pet_ids
    const noteWithPets = { ...note, pet_ids };
    
    return c.json(noteWithPets, 201);
  } catch (error: any) {
    return internalError(c, 'customers.createNote', error);
  }
});

// Update household note
app.patch('/notes/:id', async (c) => {
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
    
    // Check permission: only author or admin can edit
    // For now, we allow all authenticated users (add permission check in production)
    
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
    
    // Update pet associations if provided
    if (pet_ids !== undefined) {
      // Delete existing associations
      const existingLinks = await kv.getByPrefix(`customer:${tenantId}:note:${noteId}:pet:`);
      for (const linkData of existingLinks) {
        await kv.del(`customer:${tenantId}:note:${noteId}:pet:${linkData.pet_id}`);
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
            }
          }
        }
      }
    }
    
    // Get current pet_ids
    const petLinks = await kv.getByPrefix(`customer:${tenantId}:note:${noteId}:pet:`);
    const currentPetIds = petLinks.map((link: any) => link.pet_id);
    
    return c.json({ ...note, pet_ids: currentPetIds });
  } catch (error: any) {
    return internalError(c, 'customers.updateNote', error);
  }
});

// Delete household note (soft delete)
app.delete('/notes/:id', async (c) => {
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
app.post('/households/:id/flags', async (c) => {
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
    
    // Sync with household fields for VIP and payment_hold
    const household = householdStr;
    if (flag_key === 'vip') {
      household.vip = is_active;
      await kv.set(`customer:${tenantId}:household:${householdId}`, household);
    } else if (flag_key === 'payment_hold') {
      household.payment_hold = is_active;
      if (reason) {
        household.hold_reason = reason;
      }
      await kv.set(`customer:${tenantId}:household:${householdId}`, household);
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
    
    return c.json(flag, 201);
  } catch (error: any) {
    return internalError(c, 'customers.createFlag', error);
  }
});

// Update household flag
app.patch('/flags/:id', async (c) => {
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
      }
    }
    
    return c.json(flag);
  } catch (error: any) {
    return internalError(c, 'customers.updateFlag', error);
  }
});

// Delete household flag
app.delete('/flags/:id', async (c) => {
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
      }
    }
    
    return c.json({ message: 'Flag deleted successfully' });
  } catch (error: any) {
    return internalError(c, 'customers.deleteFlag', error);
  }
});

// ============================================================================
// TIMELINE / ACTIVITY EVENTS
// ============================================================================

// Clear all flags and timeline events (for fresh start)
app.delete('/clear-timeline-data', async (c) => {
  try {
    const user = c.get('user') as AuthenticatedUser;
    const tenantId = user.tenantId;
    
    console.log(`[Clear Timeline Data] Clearing all flags and activities for tenant ${tenantId}`);
    
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
      }
    }
    
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
    
    // Combine all timeline items and sort by date descending
    const timelineItems = [...petEvents, ...petNotes, ...petFlags]
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
    
    return c.json(activity, 201);
  } catch (error: any) {
    return internalError(c, 'customers.createActivity', error);
  }
});

// Debug route to inspect KV store data
app.get('/debug/kv-keys', async (c) => {
  try {
    const user = c.get('user') as AuthenticatedUser;
    const tenantId = user.tenantId;
    
    console.log('[Debug KV] Checking keys for tenant:', tenantId);
    
    // Get all customer-related keys
    const allCustomerData = await kv.getByPrefix(`customer:${tenantId}:`);
    
    console.log('[Debug KV] Total customer-related items:', allCustomerData.length);
    
    // Count by type
    const households = allCustomerData.filter((item: any) => item.id && item.name && item.status);
    const contacts = allCustomerData.filter((item: any) => item.household_id && item.first_name && item.last_name);
    const pets = allCustomerData.filter((item: any) => item.household_id && item.name && item.species);
    const documents = allCustomerData.filter((item: any) => item.document_type);
    const notes = allCustomerData.filter((item: any) => item.category && item.content);
    const flags = allCustomerData.filter((item: any) => item.flag_key);
    const activities = allCustomerData.filter((item: any) => item.activity_type);
    
    const summary = {
      total: allCustomerData.length,
      households: households.length,
      contacts: contacts.length,
      pets: pets.length,
      documents: documents.length,
      notes: notes.length,
      flags: flags.length,
      activities: activities.length,
    };
    
    console.log('[Debug KV] Summary:', summary);
    
    // Return first few items of each type
    return c.json({
      summary,
      sample_households: households.slice(0, 3).map((h: any) => ({
        id: h.id,
        name: h.name,
        status: h.status,
      })),
      sample_contacts: contacts.slice(0, 3).map((c: any) => ({
        id: c.id,
        household_id: c.household_id,
        name: `${c.first_name} ${c.last_name}`,
      })),
      sample_pets: pets.slice(0, 3).map((p: any) => ({
        id: p.id,
        household_id: p.household_id,
        name: p.name,
        species: p.species,
      })),
    });
  } catch (error: any) {
    return internalError(c, 'customers.debugKv', error);
  }
});

export default app;