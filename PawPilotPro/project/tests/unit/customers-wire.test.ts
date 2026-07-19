// Phase 4 stage 3: Postgres row → KV wire shape serialisers.
import { describe, it, expect } from 'vitest';
import {
  toWireContact,
  toWireDocument,
  toWireHousehold,
  toWirePet,
  toWireTimestamp,
} from '../../supabase/functions/server/lib/customers_wire';

describe('toWireTimestamp', () => {
  it('renders Postgres timestamptz text as the blobs toISOString format', () => {
    expect(toWireTimestamp('2026-01-11T19:14:23.202+00:00')).toBe('2026-01-11T19:14:23.202Z');
    expect(toWireTimestamp('2026-01-11T19:14:23.2+00:00')).toBe('2026-01-11T19:14:23.200Z');
    expect(toWireTimestamp('2026-01-11T19:14:23+00:00')).toBe('2026-01-11T19:14:23.000Z');
  });

  it('is null-safe on absent and malformed values', () => {
    expect(toWireTimestamp(null)).toBeNull();
    expect(toWireTimestamp(undefined)).toBeNull();
    expect(toWireTimestamp('')).toBeNull();
    expect(toWireTimestamp('not-a-date')).toBeNull();
  });
});

describe('toWireHousehold', () => {
  const row = {
    id: 'hh-1',
    tenant_id: 'demo-tenant-001',
    external_id: null,
    name: 'Pemberton',
    status: 'active',
    vip: false,
    payment_hold: false,
    hold_reason: null,
    hold_notes: null,
    primary_location_id: null,
    primary_contact_id: 'con-1',
    address: { line1: '1 High St' },
    internal_notes: null,
    created_by: 'user-1',
    created_at: '2026-01-11T19:14:23.202+00:00',
    updated_at: '2026-01-11T20:10:16.485+00:00',
    legacy_kv_key: 'customer:demo-tenant-001:household:hh-1',
  };

  it('emits contract fields, omits null optionals, converts timestamps', () => {
    expect(toWireHousehold(row)).toEqual({
      id: 'hh-1',
      tenant_id: 'demo-tenant-001',
      name: 'Pemberton',
      status: 'active',
      vip: false,
      payment_hold: false,
      primary_contact_id: 'con-1',
      address: { line1: '1 High St' },
      created_by: 'user-1',
      created_at: '2026-01-11T19:14:23.202Z',
      updated_at: '2026-01-11T20:10:16.485Z',
    });
  });

  it('never leaks legacy_kv_key or unknown columns', () => {
    const wire = toWireHousehold(row);
    expect(wire).not.toHaveProperty('legacy_kv_key');
  });
});

describe('toWireContact', () => {
  it('keeps required booleans even when false and omits null optionals', () => {
    const wire = toWireContact({
      id: 'con-1', tenant_id: 't', household_id: 'hh-1',
      first_name: 'Jason', last_name: 'Pemberton',
      email: null, phone: '07700 900123',
      preferred_contact_method: null,
      is_primary: false, is_emergency_contact: true,
      emergency_contact_relationship: null,
      marketing_consent: false, sms_consent: false, email_consent: false,
      created_at: '2026-01-11T19:14:23.202+00:00',
      updated_at: '2026-01-11T19:14:23.202+00:00',
    });
    expect(wire.is_primary).toBe(false);
    expect(wire.phone).toBe('07700 900123');
    expect(wire).not.toHaveProperty('email');
    expect(wire).not.toHaveProperty('preferred_contact_method');
  });
});

describe('toWirePet', () => {
  it('passes numerics through as numbers and calendar dates verbatim', () => {
    const wire = toWirePet({
      id: 'pet-1', tenant_id: 't', household_id: 'hh-1', name: 'Meg',
      photo_url: null, photo_path: 'pet-photos/t/pet-1.jpg',
      breed: 'Sprocker', sex: null, date_of_birth: '2021-05-04',
      age_years: 4.5, microchip: null, weight_kg: 18.2, colour: null,
      address: null, neutered_status: null, behaviour_notes: null,
      medical_notes: null, feeding_instructions: null, allergies: null,
      vet_name: null, vet_phone: null, vet_address: null,
      vaccination_status: 'unknown', vaccination_expiry_date: null,
      daycare_enrolled: true, grooming_enrolled: false,
      transport_enrolled: false, overnights_enrolled: false,
      active: true, owner_added: false, verification_status: 'verified',
      created_at: '2026-01-11T19:14:23.202+00:00',
      updated_at: '2026-01-11T19:14:23.202+00:00',
    });
    expect(wire.age_years).toBe(4.5);
    expect(wire.weight_kg).toBe(18.2);
    expect(wire.date_of_birth).toBe('2021-05-04');
    expect(wire.photo_path).toBe('pet-photos/t/pet-1.jpg');
    expect(wire).not.toHaveProperty('photo_url');
    expect(wire.daycare_enrolled).toBe(true);
  });
});

describe('toWireDocument', () => {
  it('keeps required defaults (file_size 0, mime type) and omits null pet_id', () => {
    const wire = toWireDocument({
      id: 'doc-1', tenant_id: 't', household_id: 'hh-1', pet_id: null,
      document_type: 'other', name: 'Vaccination card', file_name: 'card.pdf',
      storage_path: 'docs/card.pdf', file_size: 0,
      mime_type: 'application/octet-stream', expiry_date: '2026-09-01',
      notes: null, uploaded_by: 'user-1',
      uploaded_at: '2026-01-11T19:14:23.202+00:00',
    });
    expect(wire.file_size).toBe(0);
    expect(wire.mime_type).toBe('application/octet-stream');
    expect(wire.expiry_date).toBe('2026-09-01');
    expect(wire).not.toHaveProperty('pet_id');
  });
});
