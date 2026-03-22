import React, { useState, useEffect } from 'react';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Badge } from '../ui/badge';
import { Mail, Phone, Star, AlertCircle as AlertIcon } from 'lucide-react';
import { useCustomerStore } from '../../modules/customers/store';
import { formatContactName, getContactInitials } from '../../utils/contactHelpers';
import type { HouseholdContact } from '../../modules/customers/types';

interface ContactSelectorProps {
  householdId: string;
  value?: string; // Contact ID
  onChange: (contactId: string, contact: HouseholdContact | undefined) => void;
  label?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  filter?: 'primary' | 'emergency' | 'all';
  showContactDetails?: boolean;
}

export function ContactSelector({
  householdId,
  value,
  onChange,
  label = 'Contact',
  placeholder = 'Select contact',
  required = false,
  disabled = false,
  filter = 'all',
  showContactDetails = true,
}: ContactSelectorProps) {
  const { currentHouseholdDetail, fetchHouseholdDetail } = useCustomerStore();
  const [contacts, setContacts] = useState<HouseholdContact[]>([]);
  const [selectedContact, setSelectedContact] = useState<HouseholdContact | undefined>();

  // Fetch household contacts if not already loaded
  useEffect(() => {
    if (householdId && (!currentHouseholdDetail || currentHouseholdDetail.id !== householdId)) {
      fetchHouseholdDetail(householdId);
    }
  }, [householdId, currentHouseholdDetail, fetchHouseholdDetail]);

  // Update local contacts when household data changes
  useEffect(() => {
    if (currentHouseholdDetail && currentHouseholdDetail.id === householdId) {
      let filteredContacts = currentHouseholdDetail.contacts || [];
      
      // Apply filter
      switch (filter) {
        case 'primary':
          filteredContacts = filteredContacts.filter(c => c.is_primary);
          break;
        case 'emergency':
          filteredContacts = filteredContacts.filter(c => c.is_emergency_contact);
          break;
        case 'all':
        default:
          // No filter
          break;
      }
      
      setContacts(filteredContacts);
      
      // If there's only one contact and no value is set, auto-select it
      if (filteredContacts.length === 1 && !value) {
        const contact = filteredContacts[0];
        onChange(contact.id, contact);
      }
    }
  }, [currentHouseholdDetail, householdId, filter, value, onChange]);

  // Update selected contact when value changes
  useEffect(() => {
    if (value) {
      const contact = contacts.find(c => c.id === value);
      setSelectedContact(contact);
    } else {
      setSelectedContact(undefined);
    }
  }, [value, contacts]);

  const handleValueChange = (contactId: string) => {
    const contact = contacts.find(c => c.id === contactId);
    setSelectedContact(contact);
    onChange(contactId, contact);
  };

  if (contacts.length === 0) {
    return (
      <div className="space-y-2">
        {label && (
          <Label>
            {label}
            {required && <span className="text-red-500 ml-1">*</span>}
          </Label>
        )}
        <div className="text-sm text-slate-500 p-3 bg-slate-50 border border-slate-200 rounded-md">
          No contacts available for this household
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {label && (
        <Label>
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </Label>
      )}
      
      <Select value={value} onValueChange={handleValueChange} disabled={disabled}>
        <SelectTrigger>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {contacts.map(contact => {
            const initials = getContactInitials(contact);
            const name = formatContactName(contact);
            
            return (
              <SelectItem key={contact.id} value={contact.id}>
                <div className="flex items-center gap-2">
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-200 text-xs font-medium">
                    {initials}
                  </div>
                  <span>{name}</span>
                  {contact.is_primary && (
                    <Star className="h-3 w-3 text-yellow-500 fill-yellow-500" />
                  )}
                  {contact.is_emergency_contact && (
                    <AlertIcon className="h-3 w-3 text-red-500" />
                  )}
                </div>
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>

      {/* Display selected contact details */}
      {showContactDetails && selectedContact && (
        <div className="mt-3 p-3 bg-slate-50 border border-slate-200 rounded-md space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            {selectedContact.is_primary && (
              <Badge variant="default" className="text-xs gap-1">
                <Star className="h-3 w-3" />
                Primary
              </Badge>
            )}
            {selectedContact.is_emergency_contact && (
              <Badge variant="secondary" className="text-xs">
                Emergency
              </Badge>
            )}
          </div>
          
          <div className="space-y-1 text-sm">
            {selectedContact.email && (
              <div className="flex items-center gap-2 text-slate-600">
                <Mail className="h-3 w-3" />
                <span>{selectedContact.email}</span>
                {selectedContact.preferred_contact_method === 'email' && (
                  <Badge variant="outline" className="text-xs">Preferred</Badge>
                )}
              </div>
            )}
            {selectedContact.phone && (
              <div className="flex items-center gap-2 text-slate-600">
                <Phone className="h-3 w-3" />
                <span>{selectedContact.phone}</span>
                {(selectedContact.preferred_contact_method === 'phone' || 
                  selectedContact.preferred_contact_method === 'sms') && (
                  <Badge variant="outline" className="text-xs">Preferred</Badge>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
