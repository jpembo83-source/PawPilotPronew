// Phase 4 / Customers — STAGE 3 read cutover: Postgres row → KV wire shape.
//
// The KV read path serves stored blobs verbatim, so its wire shape is "the
// frozen contract (shared/schemas/customers.ts) with optional fields ABSENT
// rather than null". These serialisers rebuild exactly that shape from a
// Postgres row: contract fields only, null/absent optionals omitted,
// timestamps re-rendered as `new Date().toISOString()` strings (the only
// format KV blobs ever carried — verified against prod, zero exceptions).
//
// Pure module (no imports) so tests/unit can exercise it without Deno.

export type WireRecord = Record<string, unknown>;
type Row = Record<string, unknown>;

/** Postgres timestamptz text ('…+00:00') → the blobs' toISOString format. */
export function toWireTimestamp(value: unknown): string | null {
  if (typeof value !== "string" || value === "") return null;
  const t = new Date(value).getTime();
  return Number.isNaN(t) ? null : new Date(t).toISOString();
}

/** Set obj[field] only when the value is present (KV blobs omit, never null). */
function put(obj: WireRecord, field: string, value: unknown): void {
  if (value !== null && value !== undefined && value !== "") obj[field] = value;
}

function putTs(obj: WireRecord, field: string, value: unknown): void {
  put(obj, field, toWireTimestamp(value));
}

/** Required columns pass through as-is (NOT NULL in the table). */
function putRequired(obj: WireRecord, field: string, value: unknown): void {
  obj[field] = value;
}

export function toWireHousehold(row: Row): WireRecord {
  const out: WireRecord = {};
  putRequired(out, "id", row.id);
  putRequired(out, "tenant_id", row.tenant_id);
  put(out, "external_id", row.external_id);
  putRequired(out, "name", row.name);
  putRequired(out, "status", row.status);
  putRequired(out, "vip", row.vip);
  putRequired(out, "payment_hold", row.payment_hold);
  put(out, "hold_reason", row.hold_reason);
  put(out, "hold_notes", row.hold_notes);
  put(out, "primary_location_id", row.primary_location_id);
  put(out, "primary_contact_id", row.primary_contact_id);
  put(out, "address", row.address);
  put(out, "internal_notes", row.internal_notes);
  put(out, "created_by", row.created_by);
  putTs(out, "created_at", row.created_at);
  putTs(out, "updated_at", row.updated_at);
  return out;
}

export function toWireContact(row: Row): WireRecord {
  const out: WireRecord = {};
  putRequired(out, "id", row.id);
  putRequired(out, "tenant_id", row.tenant_id);
  putRequired(out, "household_id", row.household_id);
  putRequired(out, "first_name", row.first_name);
  putRequired(out, "last_name", row.last_name);
  put(out, "email", row.email);
  put(out, "phone", row.phone);
  put(out, "preferred_contact_method", row.preferred_contact_method);
  putRequired(out, "is_primary", row.is_primary);
  putRequired(out, "is_emergency_contact", row.is_emergency_contact);
  put(out, "emergency_contact_relationship", row.emergency_contact_relationship);
  putRequired(out, "marketing_consent", row.marketing_consent);
  putRequired(out, "sms_consent", row.sms_consent);
  putRequired(out, "email_consent", row.email_consent);
  putTs(out, "created_at", row.created_at);
  putTs(out, "updated_at", row.updated_at);
  return out;
}

export function toWirePet(row: Row): WireRecord {
  const out: WireRecord = {};
  putRequired(out, "id", row.id);
  putRequired(out, "tenant_id", row.tenant_id);
  putRequired(out, "household_id", row.household_id);
  putRequired(out, "name", row.name);
  put(out, "photo_url", row.photo_url);
  put(out, "photo_path", row.photo_path);
  put(out, "breed", row.breed);
  put(out, "sex", row.sex);
  put(out, "date_of_birth", row.date_of_birth);
  put(out, "age_years", row.age_years);
  put(out, "microchip", row.microchip);
  put(out, "weight_kg", row.weight_kg);
  put(out, "colour", row.colour);
  put(out, "address", row.address);
  put(out, "neutered_status", row.neutered_status);
  put(out, "behaviour_notes", row.behaviour_notes);
  put(out, "medical_notes", row.medical_notes);
  put(out, "feeding_instructions", row.feeding_instructions);
  put(out, "allergies", row.allergies);
  put(out, "vet_name", row.vet_name);
  put(out, "vet_phone", row.vet_phone);
  put(out, "vet_address", row.vet_address);
  putRequired(out, "vaccination_status", row.vaccination_status);
  put(out, "vaccination_expiry_date", row.vaccination_expiry_date);
  putRequired(out, "daycare_enrolled", row.daycare_enrolled);
  putRequired(out, "grooming_enrolled", row.grooming_enrolled);
  putRequired(out, "transport_enrolled", row.transport_enrolled);
  putRequired(out, "overnights_enrolled", row.overnights_enrolled);
  putRequired(out, "active", row.active);
  putRequired(out, "owner_added", row.owner_added);
  putRequired(out, "verification_status", row.verification_status);
  putTs(out, "created_at", row.created_at);
  putTs(out, "updated_at", row.updated_at);
  return out;
}

export function toWireDocument(row: Row): WireRecord {
  const out: WireRecord = {};
  putRequired(out, "id", row.id);
  putRequired(out, "tenant_id", row.tenant_id);
  putRequired(out, "household_id", row.household_id);
  put(out, "pet_id", row.pet_id);
  putRequired(out, "document_type", row.document_type);
  put(out, "name", row.name);
  put(out, "file_name", row.file_name);
  put(out, "storage_path", row.storage_path);
  putRequired(out, "file_size", row.file_size);
  putRequired(out, "mime_type", row.mime_type);
  put(out, "expiry_date", row.expiry_date);
  put(out, "notes", row.notes);
  put(out, "uploaded_by", row.uploaded_by);
  putTs(out, "uploaded_at", row.uploaded_at);
  return out;
}
