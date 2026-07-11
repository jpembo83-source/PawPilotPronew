// Pet vaccination status derivation — shared by the staff vaccinations API
// (vaccinations_routes.tsx) and the portal vax-queue approval
// (portal_invites.ts), so every writer of vaccination:{tenant}:{petId}:{id}
// records keeps the pet's snapshot fields (vaccination_status /
// vaccination_expiry_date) in sync. Those snapshot fields are what booking
// creation copies onto daycare/grooming records.
//
// kv.getByPrefix returns PARSED JSONB values (objects). The previous copy of
// this logic inside vaccinations_routes.tsx JSON.parse()d them — which throws
// on an object — so every route in that file 500'd and this recalc never ran.

import * as kv from "../kv_store.tsx";
// Phase 4 stage 2: customer:* KV mutations are mirrored to Postgres.
import { dualWriteCustomers, dwSet } from "./customers_dualwrite.ts";

export interface VaccinationStatusResult {
  status: "up_to_date" | "expiring_soon" | "expired" | "unknown";
  expiry_date?: string;
}

export async function calculatePetVaccinationStatus(
  petId: string,
  tenantId: string,
): Promise<VaccinationStatusResult> {
  const vaccinations = (await kv.getByPrefix(`vaccination:${tenantId}:${petId}:`)) as Array<{
    next_due_date?: string;
  }>;

  const withDueDate = vaccinations.filter((v) => v && v.next_due_date);
  if (withDueDate.length === 0) {
    return { status: "unknown", expiry_date: undefined };
  }

  withDueDate.sort(
    (a, b) => new Date(a.next_due_date!).getTime() - new Date(b.next_due_date!).getTime(),
  );

  const earliestDueDate = withDueDate[0].next_due_date!;
  const dueDate = new Date(earliestDueDate);
  const today = new Date();
  const thirtyDaysFromNow = new Date();
  thirtyDaysFromNow.setDate(today.getDate() + 30);

  let status: VaccinationStatusResult["status"];
  if (dueDate < today) {
    status = "expired";
  } else if (dueDate <= thirtyDaysFromNow) {
    status = "expiring_soon";
  } else {
    status = "up_to_date";
  }

  return { status, expiry_date: earliestDueDate };
}

/** Recompute and persist the pet's vaccination snapshot fields. Best-effort:
 *  a missing pet record is logged, never thrown — record writes must not fail
 *  because the snapshot could not be refreshed. */
export async function updatePetVaccinationStatus(petId: string, tenantId: string): Promise<void> {
  const pets = (await kv.getByPrefix(`customer:${tenantId}:pet:`)) as any[];
  const pet = pets.find((p) => p && p.id === petId);
  if (!pet) {
    console.warn(`[vaccination_status] pet ${petId} not found when updating vaccination status`);
    return;
  }

  const { status, expiry_date } = await calculatePetVaccinationStatus(petId, tenantId);
  const refreshed = {
    ...pet,
    vaccination_status: status,
    vaccination_expiry_date: expiry_date,
    updated_at: new Date().toISOString(),
  };
  await kv.set(`customer:${tenantId}:pet:${pet.household_id}:${petId}`, refreshed);
  await dualWriteCustomers([
    dwSet(`customer:${tenantId}:pet:${pet.household_id}:${petId}`, refreshed),
  ]);
}
