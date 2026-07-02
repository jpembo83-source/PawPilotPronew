import { z } from "zod";

/**
 * Customers entity family — the FROZEN record contract for Phase 4.
 *
 * These schemas describe the canonical stored shape of each record: the shape
 * KV blobs carry today AND the shape the Postgres rows carry (migration
 * 20260611201256_phase4_customers_stage0.sql — column names match field names
 * 1:1). From the dual-write stage on, every server write to either store must
 * parse through these first; readers on both sides can rely on them.
 *
 * Conventions (ratified in docs/PHASE4_DATA_MIGRATION.md §7):
 *  - ids are TEXT, not UUID — staff CRUD mints "hh_…"/"con_…"/"pet_…"
 *    prefixed ids while the portal mints UUIDs. Never validate as .uuid().
 *  - tenant_id is required everywhere (single tenant today: demo-tenant-001).
 *  - Required-ness mirrors the table's NOT NULL columns; everything else is
 *    .nullish() because legacy KV blobs omit fields freely.
 *  - Denormalised name fields are dropped (drop-and-join, §7.7): notes and
 *    flags do NOT carry created_by_name in the contract even though old KV
 *    blobs have it — parsing strips it. customer_activities keeps
 *    created_by_name because its table retains the column (append-only feed,
 *    names are point-in-time by design).
 *  - No discriminated union on pets' owner_added/verification_status: staff
 *    verification later flips owner_added pets to "verified", so all
 *    combinations are legal in stored records. (Discriminated unions belong
 *    on request shapes — see schemas/booking.ts.)
 *
 * Timestamps are ISO datetime strings (server writes new Date().toISOString());
 * calendar dates (date_of_birth, expiry_date, …) are ISO date strings.
 */

/** TEXT primary/foreign keys — mixed "hh_…"/UUID formats, never .uuid(). */
const idSchema = z.string().min(1);
const isoDateTime = z.string().datetime();
/** Calendar date — "YYYY-MM-DD" (client-supplied; no time component). */
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "expected YYYY-MM-DD");

// ---- households — customer:{t}:household:{id} → public.households ---------

export const householdSchema = z.object({
  id: idSchema,
  tenant_id: z.string().min(1),
  external_id: z.string().nullish(),
  name: z.string().min(1),
  status: z.string().default("active"),
  vip: z.boolean().default(false),
  payment_hold: z.boolean().default(false),
  hold_reason: z.string().nullish(),
  hold_notes: z.string().nullish(),
  primary_location_id: idSchema.nullish(),
  primary_contact_id: idSchema.nullish(),
  /** Structured address object (jsonb column); legacy blobs may hold a bare string. */
  address: z.union([z.record(z.string(), z.unknown()), z.string()]).nullish(),
  internal_notes: z.string().nullish(),
  created_by: z.string().nullish(),
  created_at: isoDateTime,
  updated_at: isoDateTime,
});

// ---- contacts — customer:{t}:contact:{hh}:{id} → public.contacts ----------

export const contactSchema = z.object({
  id: idSchema,
  tenant_id: z.string().min(1),
  household_id: idSchema,
  first_name: z.string().min(1),
  last_name: z.string().min(1),
  email: z.string().nullish(),
  phone: z.string().nullish(),
  preferred_contact_method: z.string().nullish(),
  is_primary: z.boolean().default(false),
  is_emergency_contact: z.boolean().default(false),
  emergency_contact_relationship: z.string().nullish(),
  marketing_consent: z.boolean().default(false),
  sms_consent: z.boolean().default(false),
  email_consent: z.boolean().default(false),
  created_at: isoDateTime,
  updated_at: isoDateTime,
});

// ---- pets — customer:{t}:pet:{hh}:{id} → public.pets -----------------------

export const petVerificationStatusEnum = z.enum([
  "verified",
  "pending_staff_review",
  "rejected",
]);

export const petSchema = z.object({
  id: idSchema,
  tenant_id: z.string().min(1),
  household_id: idSchema,
  name: z.string().min(1),
  photo_url: z.string().nullish(),
  breed: z.string().nullish(),
  sex: z.string().nullish(),
  date_of_birth: isoDate.nullish(),
  age_years: z.number().nullish(),
  microchip: z.string().nullish(),
  weight_kg: z.number().nullish(),
  colour: z.string().nullish(),
  address: z.union([z.record(z.string(), z.unknown()), z.string()]).nullish(),
  neutered_status: z.string().nullish(),
  behaviour_notes: z.string().nullish(),
  medical_notes: z.string().nullish(),
  feeding_instructions: z.string().nullish(),
  allergies: z.string().nullish(),
  vet_name: z.string().nullish(),
  vet_phone: z.string().nullish(),
  vet_address: z.string().nullish(),
  vaccination_status: z.string().default("unknown"),
  vaccination_expiry_date: isoDate.nullish(),
  daycare_enrolled: z.boolean().default(false),
  grooming_enrolled: z.boolean().default(false),
  transport_enrolled: z.boolean().default(false),
  overnights_enrolled: z.boolean().default(false),
  active: z.boolean().default(true),
  /** True when the owner self-added the pet via the portal. */
  owner_added: z.boolean().default(false),
  /** Booking creation rejects anything but "verified" (portal_bookings.ts). */
  verification_status: petVerificationStatusEnum.default("verified"),
  created_at: isoDateTime,
  updated_at: isoDateTime,
});

// ---- customer_documents — customer:{t}:document:{hh}:{id} ------------------

export const customerDocumentSchema = z.object({
  id: idSchema,
  tenant_id: z.string().min(1),
  household_id: idSchema,
  pet_id: idSchema.nullish(),
  document_type: z.string().default("other"),
  name: z.string().nullish(),
  file_name: z.string().nullish(),
  /** Storage object path; "#placeholder-…" marks metadata-only records. */
  storage_path: z.string().nullish(),
  file_size: z.number().int().nonnegative().default(0),
  mime_type: z.string().default("application/octet-stream"),
  expiry_date: isoDate.nullish(),
  notes: z.string().nullish(),
  uploaded_by: z.string().nullish(),
  uploaded_at: isoDateTime,
});

// ---- household_notes — customer:{t}:household:{hh}:note:{id} ---------------

export const noteCategoryEnum = z.enum([
  "general",
  "behaviour",
  "medical",
  "billing",
  "transport",
  "grooming",
  "overnight",
]);

export const noteVisibilityEnum = z.enum(["internal", "customer"]);

export const householdNoteSchema = z.object({
  id: idSchema,
  tenant_id: z.string().min(1),
  household_id: idSchema,
  title: z.string().nullish(),
  content: z.string().min(1),
  category: noteCategoryEnum,
  visibility: noteVisibilityEnum.default("internal"),
  is_pinned: z.boolean().default(false),
  created_by: z.string().nullish(),
  created_at: isoDateTime,
  updated_at: isoDateTime,
  /** Soft delete — notes are hidden, never hard-deleted. */
  deleted_at: isoDateTime.nullish(),
});

// ---- note_pets — customer:{t}:note:{noteId}:pet:{petId} --------------------

export const notePetLinkSchema = z.object({
  note_id: idSchema,
  pet_id: idSchema,
  /** KV link blobs carry tenant_id; the join table derives it via the note. */
  tenant_id: z.string().nullish(),
});

// ---- household_flags — customer:{t}:household:{hh}:flag:{id} ---------------

export const flagKeyEnum = z.enum([
  "vip",
  "behaviour_caution",
  "medical_caution",
  "payment_hold",
  "transport_instructions",
  "grooming_restrictions",
  "overnight_restrictions",
]);

export const flagSeverityEnum = z.enum(["info", "warn", "block"]);

export const householdFlagSchema = z.object({
  id: idSchema,
  tenant_id: z.string().min(1),
  household_id: idSchema,
  pet_id: idSchema.nullish(),
  flag_key: flagKeyEnum,
  severity: flagSeverityEnum,
  is_active: z.boolean().default(true),
  reason: z.string().nullish(),
  created_by: z.string().nullish(),
  created_at: isoDateTime,
  updated_at: isoDateTime,
});

// ---- customer_activities — customer:{t}:activity:{hh}:{id} -----------------
// (a second legacy key variant customer:{t}:activity:{id} exists; the record
// shape is identical and always carries household_id, which is what matters)

export const customerActivitySchema = z.object({
  id: idSchema,
  tenant_id: z.string().min(1),
  household_id: idSchema,
  pet_id: idSchema.nullish(),
  activity_type: z.string().min(1),
  title: z.string().min(1),
  description: z.string().nullish(),
  occurred_at: isoDateTime,
  created_by: z.string().nullish(),
  /** Point-in-time actor name — the one denormalised name kept (append-only feed). */
  created_by_name: z.string().nullish(),
});

export type Household = z.infer<typeof householdSchema>;
export type Contact = z.infer<typeof contactSchema>;
export type PetRecord = z.infer<typeof petSchema>;
export type CustomerDocument = z.infer<typeof customerDocumentSchema>;
export type HouseholdNote = z.infer<typeof householdNoteSchema>;
export type NotePetLink = z.infer<typeof notePetLinkSchema>;
export type HouseholdFlag = z.infer<typeof householdFlagSchema>;
export type CustomerActivity = z.infer<typeof customerActivitySchema>;
export type PetVerificationStatus = z.infer<typeof petVerificationStatusEnum>;
export type FlagKey = z.infer<typeof flagKeyEnum>;
export type FlagSeverity = z.infer<typeof flagSeverityEnum>;
