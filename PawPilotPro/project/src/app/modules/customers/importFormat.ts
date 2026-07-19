// Single source of truth for the bulk import/export workbook layout: template
// headers on the left, import field names (what the server's row schemas
// expect) on the right. The downloaded template, the upload parser
// (BulkImportPage) and the export writer (ExportPage) all derive from this,
// so the exported file always re-imports cleanly and the formats cannot
// drift apart.
export const IMPORT_SHEETS: Record<string, Record<string, string>> = {
  Households: {
    'Household Name': 'name',
    'External ID': 'external_id',
    'Status (active/inactive)': 'status',
    'VIP (Yes/No)': 'vip',
    'Payment Hold (Yes/No)': 'payment_hold',
    'Hold Reason': 'hold_reason',
    'Location': 'location',
    'Address': 'address',
    'Internal Notes': 'internal_notes',
  },
  Contacts: {
    'Household Name': 'household_name',
    'First Name': 'first_name',
    'Last Name': 'last_name',
    'Email': 'email',
    'Phone': 'phone',
    'Preferred Contact Method': 'preferred_contact_method',
    'Primary (Yes/No)': 'is_primary',
    'Emergency Contact (Yes/No)': 'is_emergency_contact',
    'Emergency Relationship': 'emergency_contact_relationship',
    'Marketing Consent (Yes/No)': 'marketing_consent',
    'SMS Consent (Yes/No)': 'sms_consent',
    'Email Consent (Yes/No)': 'email_consent',
  },
  Pets: {
    'Household Name': 'household_name',
    'Name': 'name',
    'Breed': 'breed',
    'Sex': 'sex',
    'Date of Birth (YYYY-MM-DD)': 'date_of_birth',
    'Weight (kg)': 'weight_kg',
    'Colour': 'colour',
    'Microchip': 'microchip',
    'Neutered Status (spayed/castrated/none)': 'neutered_status',
    'Medical Notes': 'medical_notes',
    'Behaviour Notes': 'behaviour_notes',
    'Allergies': 'allergies',
    'Feeding Instructions': 'feeding_instructions',
    'Vet Name': 'vet_name',
    'Vet Phone': 'vet_phone',
    'Vet Address': 'vet_address',
    'Vaccination Expiry (YYYY-MM-DD)': 'vaccination_expiry_date',
    'Daycare (Yes/No)': 'daycare_enrolled',
    'Grooming (Yes/No)': 'grooming_enrolled',
    'Transport (Yes/No)': 'transport_enrolled',
    'Overnights (Yes/No)': 'overnights_enrolled',
    'Needs Diaper (Yes/No)': 'needs_diaper',
  },
};

// One example row per sheet, keyed by template header. "Household Name" links
// rows across the three sheets. Yes/No cells left blank keep the existing
// value on update and use the default on create.
export const TEMPLATE_EXAMPLES: Record<string, Record<string, string | number>> = {
  Households: {
    'Household Name': 'Smith Family',
    'External ID': 'CRM-1042',
    'Status (active/inactive)': 'active',
    'VIP (Yes/No)': 'No',
    'Payment Hold (Yes/No)': 'No',
    'Hold Reason': '',
    'Location': '',
    'Address': '12 Acacia Avenue, London, SW1A 1AA',
    'Internal Notes': '',
  },
  Contacts: {
    'Household Name': 'Smith Family',
    'First Name': 'Jane',
    'Last Name': 'Smith',
    'Email': 'jane.smith@example.com',
    'Phone': '+44 7700 900123',
    'Preferred Contact Method': 'email',
    'Primary (Yes/No)': 'Yes',
    'Emergency Contact (Yes/No)': 'Yes',
    'Emergency Relationship': 'Owner',
    'Marketing Consent (Yes/No)': 'No',
    'SMS Consent (Yes/No)': 'Yes',
    'Email Consent (Yes/No)': 'Yes',
  },
  Pets: {
    'Household Name': 'Smith Family',
    'Name': 'Buddy',
    'Breed': 'Labrador Retriever',
    'Sex': 'Male',
    'Date of Birth (YYYY-MM-DD)': '2021-06-15',
    'Weight (kg)': 28,
    'Colour': 'Golden',
    'Microchip': '985112003456789',
    'Neutered Status (spayed/castrated/none)': 'castrated',
    'Medical Notes': 'Mild hip dysplasia — no stairs',
    'Behaviour Notes': 'Friendly with other dogs',
    'Allergies': 'Chicken',
    'Feeding Instructions': 'Half a cup of kibble, morning and evening',
    'Vet Name': 'Acme Veterinary Clinic',
    'Vet Phone': '+44 20 7946 0999',
    'Vet Address': '1 High Street, London',
    'Vaccination Expiry (YYYY-MM-DD)': '2026-11-30',
    'Daycare (Yes/No)': 'Yes',
    'Grooming (Yes/No)': 'No',
    'Transport (Yes/No)': 'No',
    'Overnights (Yes/No)': 'No',
    'Needs Diaper (Yes/No)': 'No',
  },
};

/**
 * Build a template-header-keyed row from import-field-keyed values, in the
 * sheet's canonical column order. Booleans render as Yes/No (the tri-state
 * the import parser reads back); null/undefined render as blank cells.
 */
export function toTemplateRow(
  sheetName: keyof typeof IMPORT_SHEETS,
  fields: Record<string, unknown>,
): Record<string, string | number> {
  const row: Record<string, string | number> = {};
  for (const [header, field] of Object.entries(IMPORT_SHEETS[sheetName])) {
    const value = fields[field];
    if (typeof value === 'boolean') row[header] = value ? 'Yes' : 'No';
    else if (typeof value === 'number' || typeof value === 'string') row[header] = value;
    else row[header] = '';
  }
  return row;
}
