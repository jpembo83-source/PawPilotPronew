import { Hono } from 'npm:hono';
import * as kv from './kv_store.tsx';
import { requireAuth, AuthenticatedUser } from './_shared/auth.ts';
import { internalError } from './_shared/log.ts';

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

// Helper to calculate vaccination status for a pet
async function calculatePetVaccinationStatus(petId: string, tenantId: string) {
  const vaccinationsData = await kv.getByPrefix(`vaccination:${tenantId}:${petId}:`);
  const vaccinations: VaccinationRecord[] = vaccinationsData.map((v: string) => JSON.parse(v));

  if (vaccinations.length === 0) {
    return {
      status: 'unknown' as const,
      expiry_date: undefined,
    };
  }

  // Find the earliest expiring vaccination
  const vaccinationsWithDueDate = vaccinations.filter(v => v.next_due_date);
  
  if (vaccinationsWithDueDate.length === 0) {
    return {
      status: 'unknown' as const,
      expiry_date: undefined,
    };
  }

  // Sort by next_due_date
  vaccinationsWithDueDate.sort((a, b) => 
    new Date(a.next_due_date!).getTime() - new Date(b.next_due_date!).getTime()
  );

  const earliestDueDate = vaccinationsWithDueDate[0].next_due_date!;
  const dueDate = new Date(earliestDueDate);
  const today = new Date();
  const thirtyDaysFromNow = new Date();
  thirtyDaysFromNow.setDate(today.getDate() + 30);

  let status: 'up_to_date' | 'expiring_soon' | 'expired';
  
  if (dueDate < today) {
    status = 'expired';
  } else if (dueDate <= thirtyDaysFromNow) {
    status = 'expiring_soon';
  } else {
    status = 'up_to_date';
  }

  return {
    status,
    expiry_date: earliestDueDate,
  };
}

// Update pet's vaccination status
async function updatePetVaccinationStatus(petId: string, tenantId: string) {
  // Find pet in customer database
  const petKeys = await kv.getByPrefix(`customer:${tenantId}:pet:`);
  const petStr = petKeys.find((p: string) => {
    const parsed = JSON.parse(p);
    return parsed.id === petId;
  });
  
  if (!petStr) {
    console.warn(`Pet ${petId} not found when updating vaccination status`);
    return;
  }

  const pet = JSON.parse(petStr);
  const { status, expiry_date } = await calculatePetVaccinationStatus(petId, tenantId);

  // Update pet record with new vaccination status
  const updatedPet = {
    ...pet,
    vaccination_status: status,
    vaccination_expiry_date: expiry_date,
    updated_at: new Date().toISOString(),
  };

  await kv.set(`customer:${tenantId}:pet:${pet.household_id}:${petId}`, updatedPet);
}

// GET /pets/:petId/vaccinations - List all vaccinations for a pet
app.get('/make-server-fc003b23/pets/:petId/vaccinations', async (c) => {
  try {
    const petId = c.req.param('petId');
    
    // Get tenant_id from pet record
    const petKeys = await kv.getByPrefix(`customer:`);
    const pet = petKeys.find((p: string) => {
      const parsed = JSON.parse(p);
      return parsed.id === petId;
    });
    
    if (!pet) {
      return c.json({ error: 'Pet not found' }, 404);
    }

    const petData = JSON.parse(pet);
    const tenantId = petData.tenant_id;

    // Get all vaccinations for this pet
    const vaccinationsData = await kv.getByPrefix(`vaccination:${tenantId}:${petId}:`);
    const vaccinations: VaccinationRecord[] = vaccinationsData.map((v: string) => JSON.parse(v));

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
    const petId = c.req.param('petId');
    const body = await c.req.json();
    
    // Get tenant_id from pet record
    const petKeys = await kv.getByPrefix(`customer:`);
    const petStr = petKeys.find((p: string) => {
      const parsed = JSON.parse(p);
      return parsed.id === petId;
    });
    
    if (!petStr) {
      return c.json({ error: 'Pet not found' }, 404);
    }

    const pet = JSON.parse(petStr);
    const tenantId = pet.tenant_id;

    // requireAuth has already validated the bearer token and attached the user.
    const user = c.get('user') as AuthenticatedUser;
    
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
    const petId = c.req.param('petId');
    const vaccinationId = c.req.param('vaccinationId');
    const body = await c.req.json();
    
    // Get tenant_id from pet record
    const petKeys = await kv.getByPrefix(`customer:`);
    const petStr = petKeys.find((p: string) => {
      const parsed = JSON.parse(p);
      return parsed.id === petId;
    });
    
    if (!petStr) {
      return c.json({ error: 'Pet not found' }, 404);
    }

    const pet = JSON.parse(petStr);
    const tenantId = pet.tenant_id;

    // Get existing vaccination
    const vaccinationKey = `vaccination:${tenantId}:${petId}:${vaccinationId}`;
    const vaccinationsData = await kv.getByPrefix(vaccinationKey);
    
    if (vaccinationsData.length === 0) {
      return c.json({ error: 'Vaccination record not found' }, 404);
    }

    const existing = JSON.parse(vaccinationsData[0]);

    // requireAuth has already validated the bearer token and attached the user.
    const user = c.get('user') as AuthenticatedUser;

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
    const petId = c.req.param('petId');
    const vaccinationId = c.req.param('vaccinationId');
    
    // Get tenant_id from pet record
    const petKeys = await kv.getByPrefix(`customer:`);
    const petStr = petKeys.find((p: string) => {
      const parsed = JSON.parse(p);
      return parsed.id === petId;
    });
    
    if (!petStr) {
      return c.json({ error: 'Pet not found' }, 404);
    }

    const pet = JSON.parse(petStr);
    const tenantId = pet.tenant_id;

    // Get existing vaccination
    const vaccinationKey = `vaccination:${tenantId}:${petId}:${vaccinationId}`;
    const vaccinationsData = await kv.getByPrefix(vaccinationKey);
    
    if (vaccinationsData.length === 0) {
      return c.json({ error: 'Vaccination record not found' }, 404);
    }

    const existing = JSON.parse(vaccinationsData[0]);

    // Delete vaccination
    await kv.del(vaccinationKey);

    // Update pet's overall vaccination status
    await updatePetVaccinationStatus(petId, tenantId);

    // requireAuth has already validated the bearer token and attached the user.
    const user = c.get('user') as AuthenticatedUser;

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