// waiverStatus: client-side "missing waiver" derivation (v1).
import { describe, it, expect } from 'vitest';
import { hasValidWaiver } from '../../src/app/modules/customers/waiverStatus';
import type { PetDocument } from '../../src/app/modules/customers/types';

const doc = (overrides: Partial<PetDocument>): PetDocument => ({
  id: 'doc-1',
  tenant_id: 't-1',
  household_id: 'hh-1',
  document_type: 'waiver',
  name: 'Waiver',
  file_name: 'waiver.pdf',
  storage_path: '#',
  file_size: 100,
  mime_type: 'application/pdf',
  uploaded_by: 'u-1',
  uploaded_at: '2026-01-01T00:00:00Z',
  ...overrides,
});

const inFuture = new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString();
const inPast = new Date(Date.now() - 24 * 3600 * 1000).toISOString();

describe('hasValidWaiver', () => {
  it('is false for an empty document list', () => {
    expect(hasValidWaiver([])).toBe(false);
  });

  it('is false when only non-waiver documents exist', () => {
    expect(hasValidWaiver([doc({ document_type: 'vaccination', expiry_date: inFuture })])).toBe(false);
  });

  it('is true for a waiver with a future expiry', () => {
    expect(hasValidWaiver([doc({ expiry_date: inFuture })])).toBe(true);
  });

  it('is false when the only waiver is expired', () => {
    expect(hasValidWaiver([doc({ expiry_date: inPast })])).toBe(false);
  });

  it('counts a waiver without an expiry date as valid (v1 rule)', () => {
    expect(hasValidWaiver([doc({ expiry_date: undefined })])).toBe(true);
  });

  it('is true when a valid waiver sits alongside an expired one', () => {
    expect(
      hasValidWaiver([doc({ expiry_date: inPast }), doc({ id: 'doc-2', expiry_date: inFuture })]),
    ).toBe(true);
  });
});
