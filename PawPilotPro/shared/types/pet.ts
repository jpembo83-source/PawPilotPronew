export interface Pet {
  id: string;
  tenantId: string;
  customerId: string;
  name: string;
  breed: string;
  dob: string; // ISO date
  weightKg: number;
  photoUrl: string | null;
  notes: string | null;
}
