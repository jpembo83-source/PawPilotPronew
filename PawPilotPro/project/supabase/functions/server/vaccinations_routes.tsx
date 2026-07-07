import { Hono } from 'npm:hono';
import * as kv from './kv_store.tsx';
import { requireAuth, AuthenticatedUser } from './_shared/auth.ts';
import { internalError } from './_shared/log.ts';
import { updatePetVaccinationStatus } from './lib/vaccination_status.ts';

const app = new Hono();

// Every vaccinations route requires a validated user. requireAuth handles JWT
// validation server-side with SERVICE_ROLE_KEY. The local getUserFromAuth
// helper that used to live here decoded the JWT with `atob` WITHOUT signature
// verification — accepting any forged token — and has been removed.
// Scoped to this module's prefix — mounted at "/", so '*' would intercept
// portal routes that use their own auth.
app.use('/make-server-fc003b23/pets/*', requireAuth);

// Type definitions
type VaccinationType =
  | 'dhpp'
  | 'rabies'
  | 'bordetella'
  | 'leptospirosis'
  | 'canine_influenza'
  | 'lyme'
  | 'other';

interface VaccinationRecord {
  id: string;
  tenant_id: string;
  pet_id: string;
  vaccination_type: VaccinationType;
  vaccination_name?: string;
  date_administered: string;
  next_due_date?: string;
  batch_number?: string;
  manufacturer?: string;
  vet_clinic_name?: string;
  vet_clinic_phone?: string;
  administering_vet?: string;
  notes?: string;
  document_id?: string;
  created_by: string;
  created_by_name?: string;
  created_at: string;
  updated_at: string;
}

// Find a pet within the authenticated user's tenant. kv.getByPrefix returns
// PARSED JSONB values — the previous implementation JSON.parse()d them (which
// throws on an object, 500ing every route in this file) and scanned the
// unscoped `customer:` prefix, which would have crossed tenants.
async function findPet(tenantId: string, petId: string): Promise<any | null> {
  const pets = (await kv.getByPrefix(`customer:${tenantId}:pet:`)) as any[];
  return pets.find((p) => p && p.id === petId) ?? null;
}

// GET /pets/:petId/vaccinations - List all vaccinations for a pet
app.get('/make-server-fc003b23/pets/:petId/vaccinations', async (c) => {
  try {
    const user = c.get('user') as AuthenticatedUser;
    const tenantId = user.tenantId;
    const petId = c.req.param('petId');

    const pet = await findPet(tenantId, petId);
    if (!pet) {
      return c.json({ error: 'Pet not found' }, 404);
    }

    const vaccinations = (await kv.getByPrefix(
      `vaccination:${tenantId}:${petId}:`,
    )) as VaccinationRecord[];

    // Sort by date_administered (newest first)
    vaccinations.sort((a, b) =>
      new Date(b.date_administered).getTime() - new Date(a.date_administered).getTime()
    );

    return c.json({ vaccinations });
  } catch (error: any) {
    console.error('Error fetching vaccinations:', error);
    return internalError(c, 'vaccinations.getPetsPetIdVaccinations', error);
  }
});

// POST /pets/:petId/vaccinations - Create a new vaccination record
app.post('/make-server-fc003b23/pets/:petId/vaccinations', async (c) => {
  try {
    const user = c.get('user') as AuthenticatedUser;
    const tenantId = user.tenantId;
    const petId = c.req.param('petId');
    const body = await c.req.json();

    const pet = await findPet(tenantId, petId);
    if (!pet) {
      return c.json({ error: 'Pet not found' }, 404);
    }

    // Validate required fields
    if (!body.vaccination_type || !body.date_administered) {
      return c.json({
        error: 'Missing required fields: vaccination_type, date_administered'
      }, 400);
    }

    // If type is 'other', require vaccination_name
    if (body.vaccination_type === 'other' && !body.vaccination_name) {
      return c.json({
        error: 'vaccination_name is required when vaccination_type is "other"'
      }, 400);
    }

    const vaccinationId = crypto.randomUUID();
    const now = new Date().toISOString();

    const vaccination: VaccinationRecord = {
      id: vaccinationId,
      tenant_id: tenantId,
      pet_id: petId,
      vaccination_type: body.vaccination_type,
      vaccination_name: body.vaccination_name,
      date_administered: body.date_administered,
      next_due_date: body.next_due_date,
      batch_number: body.batch_number,
      manufacturer: body.manufacturer,
      vet_clinic_name: body.vet_clinic_name,
      vet_clinic_phone: body.vet_clinic_phone,
      administering_vet: body.administering_vet,
      notes: body.notes,
      document_id: body.document_id,
      created_by: user?.id || 'system',
      created_by_name: user?.name,
      created_at: now,
      updated_at: now,
    };

    // Save vaccination record
    await kv.set(`vaccination:${tenantId}:${petId}:${vaccinationId}`, vaccination);

    // Update pet's overall vaccination status
    await updatePetVaccinationStatus(petId, tenantId);

    // Create activity event
    const activityId = crypto.randomUUID();
    const activity = {
      id: activityId,
      tenant_id: tenantId,
      household_id: pet.household_id,
      pet_id: petId,
      activity_type: 'vaccination_added',
      title: `Vaccination Added: ${body.vaccination_type === 'other' ? body.vaccination_name : body.vaccination_type}`,
      description: `Added vaccination record for ${body.vaccination_type}`,
      metadata: {
        vaccination_id: vaccinationId,
        vaccination_type: body.vaccination_type,
      },
      occurred_at: now,
      created_by: user?.id,
      created_by_name: user?.name,
      created_at: now,
    };
    await kv.set(`customer:${tenantId}:activity:${activityId}`, activity);

    return c.json({ vaccination }, 201);
  } catch (error: any) {
    console.error('Error creating vaccination:', error);
    return internalError(c, 'vaccinations.postPetsPetIdVaccinations', error);
  }
});

// PUT /pets/:petId/vaccinations/:vaccinationId - Update a vaccination record
app.put('/make-server-fc003b23/pets/:petId/vaccinations/:vaccinationId', async (c) => {
  try {
    const user = c.get('user') as AuthenticatedUser;
    const tenantId = user.tenantId;
    const petId = c.req.param('petId');
    const vaccinationId = c.req.param('vaccinationId');
    const body = await c.req.json();

    const pet = await findPet(tenantId, petId);
    if (!pet) {
      return c.json({ error: 'Pet not found' }, 404);
    }

    // Get existing vaccination (point read — the key is exact)
    const vaccinationKey = `vaccination:${tenantId}:${petId}:${vaccinationId}`;
    const existing = (await kv.get(vaccinationKey)) as VaccinationRecord | null;
    if (!existing) {
      return c.json({ error: 'Vaccination record not found' }, 404);
    }

    // Update vaccination
    const updated: VaccinationRecord = {
      ...existing,
      vaccination_type: body.vaccination_type ?? existing.vaccination_type,
      vaccination_name: body.vaccination_name ?? existing.vaccination_name,
      date_administered: body.date_administered ?? existing.date_administered,
      next_due_date: body.next_due_date ?? existing.next_due_date,
      batch_number: body.batch_number ?? existing.batch_number,
      manufacturer: body.manufacturer ?? existing.manufacturer,
      vet_clinic_name: body.vet_clinic_name ?? existing.vet_clinic_name,
      vet_clinic_phone: body.vet_clinic_phone ?? existing.vet_clinic_phone,
      administering_vet: body.administering_vet ?? existing.administering_vet,
      notes: body.notes ?? existing.notes,
      document_id: body.document_id ?? existing.document_id,
      updated_at: new Date().toISOString(),
    };

    await kv.set(vaccinationKey, updated);

    // Update pet's overall vaccination status
    await updatePetVaccinationStatus(petId, tenantId);

    // Create activity event
    const activityId = crypto.randomUUID();
    const now = new Date().toISOString();
    const activity = {
      id: activityId,
      tenant_id: tenantId,
      household_id: pet.household_id,
      pet_id: petId,
      activity_type: 'vaccination_updated',
      title: `Vaccination Updated: ${updated.vaccination_type === 'other' ? updated.vaccination_name : updated.vaccination_type}`,
      description: `Updated vaccination record`,
      metadata: {
        vaccination_id: vaccinationId,
        vaccination_type: updated.vaccination_type,
      },
      occurred_at: now,
      created_by: user?.id,
      created_by_name: user?.name,
      created_at: now,
    };
    await kv.set(`customer:${tenantId}:activity:${activityId}`, activity);

    return c.json({ vaccination: updated });
  } catch (error: any) {
    console.error('Error updating vaccination:', error);
    return internalError(c, 'vaccinations.putPetsPetIdVaccinationsVaccinationId', error);
  }
});

// DELETE /pets/:petId/vaccinations/:vaccinationId - Delete a vaccination record
app.delete('/make-server-fc003b23/pets/:petId/vaccinations/:vaccinationId', async (c) => {
  try {
    const user = c.get('user') as AuthenticatedUser;
    const tenantId = user.tenantId;
    const petId = c.req.param('petId');
    const vaccinationId = c.req.param('vaccinationId');

    const pet = await findPet(tenantId, petId);
    if (!pet) {
      return c.json({ error: 'Pet not found' }, 404);
    }

    // Get existing vaccination (point read — the key is exact)
    const vaccinationKey = `vaccination:${tenantId}:${petId}:${vaccinationId}`;
    const existing = (await kv.get(vaccinationKey)) as VaccinationRecord | null;
    if (!existing) {
      return c.json({ error: 'Vaccination record not found' }, 404);
    }

    // Delete vaccination
    await kv.del(vaccinationKey);

    // Update pet's overall vaccination status
    await updatePetVaccinationStatus(petId, tenantId);

    // Create activity event
    const activityId = crypto.randomUUID();
    const now = new Date().toISOString();
    const activity = {
      id: activityId,
      tenant_id: tenantId,
      household_id: pet.household_id,
      pet_id: petId,
      activity_type: 'vaccination_updated',
      title: `Vaccination Deleted`,
      description: `Deleted vaccination record for ${existing.vaccination_type}`,
      metadata: {
        vaccination_id: vaccinationId,
        vaccination_type: existing.vaccination_type,
      },
      occurred_at: now,
      created_by: user?.id,
      created_by_name: user?.name,
      created_at: now,
    };
    await kv.set(`customer:${tenantId}:activity:${activityId}`, activity);

    return c.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting vaccination:', error);
    return internalError(c, 'vaccinations.deletePetsPetIdVaccinationsVaccinationId', error);
  }
});

export default app;
