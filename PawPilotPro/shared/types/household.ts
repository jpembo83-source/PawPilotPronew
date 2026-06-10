/**
 * Household + Contact types shared between the staff app and the portal.
 *
 * The staff app stores these with snake_case keys in KV under
 *   customer:{tenantId}:household:{householdId}
 *   customer:{tenantId}:contact:{householdId}:{contactId}
 *
 * The portal API normalises to the same shape (snake_case) so both apps
 * read/write a single canonical schema — see project/supabase/functions/server/
 * portal_routes.tsx for the GET/PATCH/POST/DELETE handlers that emit these.
 */

export interface Household {
  /** Stable household id (also embedded in the kv key). */
  id: string;
  /** Display name as captured by staff (e.g. "The Smith Family"). */
  name: string;
  /** Single freeform address line as stored on the staff side. */
  address: string;
  /** Id of the contact currently marked primary, or null if none assigned. */
  primary_contact_id: string | null;
}

export type PreferredContactMethod = "email" | "phone" | "sms";

export interface Contact {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  preferred_contact_method: PreferredContactMethod | null;
  is_primary: boolean;
  is_emergency_contact: boolean;
  /** Free text — "Partner", "Dog walker", "Mum", etc. */
  emergency_contact_relationship: string | null;
  marketing_consent: boolean;
  sms_consent: boolean;
  email_consent: boolean;
}

/** Response shape for GET /portal/household. */
export interface HouseholdResponse {
  household: Household;
  contacts: Contact[];
}

/** PATCH /portal/household — server enforces this allowlist. */
export interface HouseholdPatch {
  address?: string | null;
}

/** POST /portal/contacts — required first_name + last_name, everything else optional. */
export type ContactCreate = Pick<Contact, "first_name" | "last_name"> &
  Partial<Omit<Contact, "id" | "first_name" | "last_name">>;

/** PATCH /portal/contacts/{id} — all fields optional. */
export type ContactPatch = Partial<Omit<Contact, "id">>;

/** POST /portal/pets — owner-requested new pet add. */
export interface NewPetRequest {
  name: string;
  photo_url?: string | null;
  breed?: string;
  sex?: "male" | "female" | "unknown";
  dob?: string;
  microchip?: string;
  weight_kg?: number | null;
  neutered?: boolean;
  colour?: string;
}
