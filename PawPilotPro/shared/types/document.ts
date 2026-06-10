/**
 * Household document — owner-uploaded OR staff-uploaded. The portal
 * exposes both via GET /portal/documents; only `uploadedByOwner: true`
 * rows can be deleted from the portal side.
 *
 * Storage paths starting with "#placeholder-" indicate a document the
 * staff app created without actually uploading the bytes (a known gap
 * in customers_routes.tsx — the file goes to KV metadata, never to
 * the bucket). The portal's download endpoint surfaces a clear 410 in
 * that case rather than failing with a storage error.
 */

export type DocumentType =
  | "waiver"
  | "insurance"
  | "vet_records"
  | "photo_id"
  | "medical"
  | "other";

/** Types an owner is allowed to upload from the portal. */
export const OWNER_UPLOADABLE_DOCUMENT_TYPES: DocumentType[] = [
  "insurance",
  "vet_records",
  "photo_id",
  "other",
];

export interface Document {
  id: string;
  name: string;
  documentType: DocumentType;
  fileName: string | null;
  fileSize: number;
  mimeType: string | null;
  /** ISO date — null when the doc has no expiry concept (e.g. waivers). */
  expiresAt: string | null;
  uploadedAt: string | null;
  uploadedByOwner: boolean;
  petId: string | null;
  notes: string | null;
}

export interface DocumentsResponse {
  documents: Document[];
}

/** Summary item for Home alerts — emitted by /portal/home alongside vax. */
export interface DocumentAlert {
  id: string;
  name: string;
  documentType: DocumentType;
  expiresAt: string;
}
