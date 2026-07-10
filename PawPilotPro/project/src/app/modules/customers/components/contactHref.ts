/**
 * Builds a dialler-safe tel: value from a display-formatted phone number.
 * Keeps an existing international prefix, converts the 00 prefix to +, and
 * swaps a national trunk 0 for the organisation dial code — the same
 * convention AddContactModal's `${organisation.dialCode} ...` placeholder
 * advertises for stored numbers.
 */
export function phoneHref(phone: string, dialCode: string): string {
  const cleaned = phone.replace(/[^\d+]/g, '');
  if (cleaned.startsWith('+')) return cleaned;
  if (cleaned.startsWith('00')) return `+${cleaned.slice(2)}`;
  if (cleaned.startsWith('0')) return `${dialCode}${cleaned.slice(1)}`;
  return `${dialCode}${cleaned}`;
}
