// Client-side waiver status derivation (v1).
//
// The server's /document-alerts endpoint only generates 'expired' and
// 'expiring_soon' alerts from documents that exist — it never produces
// 'missing' alerts (the DocumentAlert type defines the value, but nothing
// emits it). Until the server does, "missing waiver" is derived client-side
// from the household's document list.
//
// Rule: a household is missing a waiver when it has no non-expired document
// of type 'waiver'. A waiver without an expiry date counts as valid here.
// KNOWN DISCREPANCY: daycare check-in (validateCheckIn in daycare_routes.tsx)
// treats a waiver without an expiry date as 'missing' — align these when the
// server-side 'missing' alert is built.

import type { PetDocument } from './types';

export function hasValidWaiver(documents: PetDocument[]): boolean {
  const now = new Date();
  return documents.some(
    d =>
      d.document_type === 'waiver' &&
      (!d.expiry_date || new Date(d.expiry_date) >= now),
  );
}
