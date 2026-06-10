export type Sex = "male" | "female" | "unknown";
export type NeuteredStatus = "neutered" | "intact" | "unknown";

/**
 * Pet — owner-facing wire shape. Backend stores snake_case (matching the
 * staff CRM); portal_routes.tsx::petToWire normalises to camelCase here.
 *
 * Field ownership:
 *  - All listed fields except teamBehaviourNotes / teamMedicalNotes are
 *    owner-editable via PATCH /portal/pets/:id.
 *  - teamBehaviourNotes + teamMedicalNotes are read-only on the portal —
 *    they hold staff's clinical/behavioural notes and surface as the
 *    "From the team" pane on PetDetailScreen.
 *  - Every chart field is optional in TypeScript so older pet records
 *    (pre-Phase B) don't fail validation; the UI treats absent values
 *    as "unset" and prompts the owner to fill them in.
 */
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
  /** Owner-added pets land in "pending_staff_review" until staff verifies. */
  verificationStatus?: "verified" | "pending_staff_review";
  /** True if the owner self-added this pet via the portal. */
  ownerAdded?: boolean;
  /**
   * True when an invoxia.devices row points at this pet — i.e. the pet
   * has a collar paired.  HomeScreen + PetDetail use this to decide
   * whether to show PulseHero (has tracker, render live HR) or the
   * TrackerUpsellCard ("get a tracker for [Pet]"). Defaults false on
   * older clients that don't read it, which is the safer side — the
   * upsell card just won't appear.
   */
  hasTracker?: boolean;

  // ---- Phase B: editable chart fields -------------------------------

  sex?: Sex;
  microchip?: string | null;
  colour?: string | null;
  neuteredStatus?: NeuteredStatus;
  feedingInstructions?: string | null;
  allergies?: string | null;
  vetName?: string | null;
  vetPhone?: string | null;
  vetAddress?: string | null;
  /** Owner's notes — editable. Shown in "From me" pane. */
  ownerNotes?: string | null;
  /** Staff's behavioural notes — read-only. Shown in "From the team" pane. */
  teamBehaviourNotes?: string | null;
  /** Staff's medical notes — read-only. Shown in "From the team" pane. */
  teamMedicalNotes?: string | null;
}

/** PATCH /portal/pets/:id body — backend enforces this allowlist. */
export interface PetPatch {
  name?: string;
  photo_url?: string | null;
  breed?: string;
  sex?: Sex;
  date_of_birth?: string;
  microchip?: string;
  weight_kg?: number | null;
  colour?: string;
  neutered_status?: NeuteredStatus;
  feeding_instructions?: string | null;
  allergies?: string | null;
  vet_name?: string | null;
  vet_phone?: string | null;
  vet_address?: string | null;
  owner_notes?: string | null;
}
