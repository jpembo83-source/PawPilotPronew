import { z } from "zod";

/**
 * Household saved addresses — named pickup/drop-off addresses ("Home",
 * "Office", "Vet") offered by the transport job dialog so staff never retype
 * a customer's address.
 *
 * Deliberately OUTSIDE the frozen Phase-4 customers contract
 * (schemas/customers.ts): the record lives in KV only, under its own
 * `customer_saved_addresses:{tenant}:{household}` key (one record per
 * household holding the whole list), is not dual-written to Postgres and is
 * invisible to the drift check. Additive by design — the household's primary
 * address and the primary contact's address fields keep working untouched;
 * when a household has no saved list, clients derive a "Home" entry from
 * those instead (no migration).
 *
 * The server keeps a runtime mirror of these schemas in
 * customers_routes.tsx — keep the two in sync.
 */

const idSchema = z.string().min(1);
const isoDateTime = z.string().datetime();

export const savedAddressSchema = z.object({
  id: idSchema,
  /** Display name — "Home", "Office", "Vet"… */
  label: z.string().trim().min(1).max(40),
  line1: z.string().trim().min(1).max(200),
  line2: z.string().max(200).nullish(),
  city: z.string().max(100).nullish(),
  postcode: z.string().max(20).nullish(),
  country: z.string().max(100).nullish(),
});

/** Bounded: a household keeps a handful of named addresses, not a gazetteer. */
export const savedAddressListSchema = z.array(savedAddressSchema).max(20);

/** PUT /households/:id/saved-addresses request body (replace-all semantics). */
export const savedAddressesUpdateSchema = z
  .object({ addresses: savedAddressListSchema })
  .strict();

/** Stored KV record — carries household_id so prefix scans can be mapped. */
export const householdSavedAddressesRecordSchema = z.object({
  tenant_id: z.string().min(1),
  household_id: idSchema,
  addresses: savedAddressListSchema,
  updated_at: isoDateTime,
});

export type SavedAddress = z.infer<typeof savedAddressSchema>;
export type SavedAddressesUpdate = z.infer<typeof savedAddressesUpdateSchema>;
export type HouseholdSavedAddressesRecord = z.infer<
  typeof householdSavedAddressesRecordSchema
>;
