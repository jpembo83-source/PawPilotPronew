export type VaxStatus = "current" | "expiring" | "expired";
export type VaxType = "rabies" | "dhpp" | "bordetella" | "leptospirosis" | "influenza" | "other";

export interface Vaccination {
  id: string;
  tenantId: string;
  petId: string;
  vaxType: VaxType;
  certificateUrl: string;
  issuedAt: string; // ISO
  expiresAt: string; // ISO
  boosterDueAt: string | null;
  approvedBy: string | null;
  approvedAt: string | null;
}
