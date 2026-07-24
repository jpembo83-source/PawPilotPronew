// Helpers for household saved addresses (named transport pickup/drop-off
// points). Client-side twin of the validation in
// shared/schemas/household_addresses.ts — keep limits in sync.

import type { Household, HouseholdContact, SavedAddress } from './types';

export const MAX_SAVED_ADDRESSES = 20;

/** One-line display/driver-navigation string for a saved address. */
export function formatSavedAddress(address: SavedAddress): string {
  return [address.line1, address.line2, address.city, address.postcode, address.country]
    .filter(Boolean)
    .join(', ');
}

/**
 * Derive a "Home" entry from what the household already has on file — the
 * primary contact's address (the one transport historically used), falling
 * back to the household address. Returns null when neither exists. This is
 * the no-migration seed: households that never saved a list still get their
 * existing address offered as "Home".
 */
export function deriveHomeAddress(
  household: Pick<Household, 'address'> | null | undefined,
  contacts: HouseholdContact[] | null | undefined
): SavedAddress | null {
  const primary = contacts?.find(c => c.is_primary) ?? contacts?.[0];
  if (primary?.address_line1) {
    return {
      id: 'derived-home',
      label: 'Home',
      line1: primary.address_line1,
      line2: primary.address_line2,
      city: primary.address_city,
      postcode: primary.address_postcode,
      country: primary.address_country,
    };
  }
  const hhAddress = household?.address;
  if (hhAddress?.line1) {
    return {
      id: 'derived-home',
      label: 'Home',
      line1: hhAddress.line1,
      line2: hhAddress.line2,
      city: hhAddress.city,
      postcode: hhAddress.postcode,
      country: hhAddress.country,
    };
  }
  return null;
}

/**
 * The list to show: the persisted saved addresses when a record exists —
 * including an empty one (deliberately cleared lists stay cleared) —
 * otherwise the derived "Home" seed (or nothing when no address is on file).
 */
export function effectiveSavedAddresses(
  household: Pick<Household, 'address' | 'saved_addresses'> | null | undefined,
  contacts: HouseholdContact[] | null | undefined
): SavedAddress[] {
  if (household?.saved_addresses) return household.saved_addresses;
  const home = deriveHomeAddress(household, contacts);
  return home ? [home] : [];
}

/** Client-side twin of savedAddressSchema — returns an error message or null. */
export function validateSavedAddress(address: SavedAddress): string | null {
  if (!address.label.trim()) return 'Each address needs a label (e.g. Home, Office, Vet)';
  if (address.label.trim().length > 40) return 'Labels are limited to 40 characters';
  if (!address.line1.trim()) return 'Each address needs at least the first line';
  if (address.line1.trim().length > 200) return 'Address line 1 is limited to 200 characters';
  return null;
}
