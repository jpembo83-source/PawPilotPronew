/**
 * Contact Helper Utilities
 * Provides centralized functions for accessing and formatting contact information
 * across all modules (Transport, Daycare, Grooming, etc.)
 */

import { useCustomerStore } from '../modules/customers/store';
import type { HouseholdContact } from '../modules/customers/types';

/**
 * Get the primary contact for a household
 */
export function getPrimaryContact(contacts: HouseholdContact[]): HouseholdContact | undefined {
  return contacts.find(c => c.is_primary) || contacts[0];
}

/**
 * Get all emergency contacts for a household
 */
export function getEmergencyContacts(contacts: HouseholdContact[]): HouseholdContact[] {
  return contacts.filter(c => c.is_emergency_contact);
}

/**
 * Format contact name for display
 */
export function formatContactName(contact: HouseholdContact, format: 'full' | 'firstLast' | 'lastFirst' = 'full'): string {
  switch (format) {
    case 'firstLast':
      return `${contact.first_name} ${contact.last_name}`;
    case 'lastFirst':
      return `${contact.last_name}, ${contact.first_name}`;
    case 'full':
    default:
      return `${contact.first_name} ${contact.last_name}`;
  }
}

/**
 * Get contact's preferred communication method details
 */
export function getPreferredContactInfo(contact: HouseholdContact): {
  method: string;
  value: string;
} | null {
  switch (contact.preferred_contact_method) {
    case 'email':
      return contact.email ? { method: 'Email', value: contact.email } : null;
    case 'phone':
    case 'sms':
      return contact.phone ? { method: 'Phone', value: contact.phone } : null;
    default:
      // Fallback to email, then phone
      if (contact.email) return { method: 'Email', value: contact.email };
      if (contact.phone) return { method: 'Phone', value: contact.phone };
      return null;
  }
}

/**
 * Get all contact methods for a contact
 */
export function getAllContactMethods(contact: HouseholdContact): Array<{
  method: string;
  value: string;
  preferred: boolean;
}> {
  const methods: Array<{ method: string; value: string; preferred: boolean }> = [];
  
  if (contact.email) {
    methods.push({
      method: 'Email',
      value: contact.email,
      preferred: contact.preferred_contact_method === 'email',
    });
  }
  
  if (contact.phone) {
    methods.push({
      method: 'Phone',
      value: contact.phone,
      preferred: contact.preferred_contact_method === 'phone' || contact.preferred_contact_method === 'sms',
    });
  }
  
  return methods;
}

/**
 * Check if contact has given consent for a specific communication type
 */
export function hasConsentFor(contact: HouseholdContact, type: 'email' | 'sms' | 'marketing'): boolean {
  switch (type) {
    case 'email':
      return contact.email_consent;
    case 'sms':
      return contact.sms_consent;
    case 'marketing':
      return contact.marketing_consent;
    default:
      return false;
  }
}

/**
 * Get contact initials for avatar display
 */
export function getContactInitials(contact: HouseholdContact): string {
  const firstInitial = contact.first_name?.[0]?.toUpperCase() || '';
  const lastInitial = contact.last_name?.[0]?.toUpperCase() || '';
  return `${firstInitial}${lastInitial}`;
}

/**
 * React hook to get contacts for a household
 * Returns formatted contact data ready for use in components
 */
export function useHouseholdContacts(householdId: string) {
  const { currentHouseholdDetail, fetchHouseholdDetail } = useCustomerStore();
  
  const contacts = currentHouseholdDetail?.id === householdId 
    ? currentHouseholdDetail.contacts 
    : [];
  
  const primaryContact = getPrimaryContact(contacts);
  const emergencyContacts = getEmergencyContacts(contacts);
  
  return {
    contacts,
    primaryContact,
    emergencyContacts,
    hasContacts: contacts.length > 0,
    contactCount: contacts.length,
    emergencyContactCount: emergencyContacts.length,
    fetchContacts: () => fetchHouseholdDetail(householdId),
  };
}

/**
 * Format contact for display in transport/booking modules
 * Returns a standardized contact display object
 */
export function formatContactForModule(contact: HouseholdContact | undefined): {
  name: string;
  phone: string;
  email: string;
  isPrimary: boolean;
  isEmergency: boolean;
} {
  if (!contact) {
    return {
      name: 'No contact',
      phone: '',
      email: '',
      isPrimary: false,
      isEmergency: false,
    };
  }
  
  return {
    name: formatContactName(contact),
    phone: contact.phone || '',
    email: contact.email || '',
    isPrimary: contact.is_primary,
    isEmergency: contact.is_emergency_contact,
  };
}
