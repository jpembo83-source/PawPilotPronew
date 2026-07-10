import React, { useState } from 'react';
import { HouseholdDetailView } from '../../types';
import type { HouseholdContact } from '../../types';
import { Card, CardContent, CardHeader, CardTitle } from '../../../../components/ui/card';
import { Button } from '../../../../components/ui/button';
import { Badge } from '../../../../components/ui/badge';
import { Avatar, AvatarFallback } from '../../../../components/ui/avatar';
import { Plus, EnvelopeSimple, Phone, Star } from '@phosphor-icons/react';
import { AddContactModal } from '../modals/AddContactModal';
import { ContactLink } from '../ContactLink';
import { EditContactModal } from '../modals/EditContactModal';
import { useCustomerStore } from '../../store';
import { toast } from 'sonner';

interface ContactsTabProps {
  household: HouseholdDetailView;
}

export function ContactsTab({ household }: ContactsTabProps) {
  const { contacts = [] } = household || {};
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingContact, setEditingContact] = useState<HouseholdContact | null>(null);
  const { updateContact, fetchHouseholdDetail } = useCustomerStore();

  const handleSetAsPrimary = async (contact: HouseholdContact, e: React.MouseEvent) => {
    e.stopPropagation();
    
    try {
      // Update this contact to be primary
      await updateContact(contact.id, { is_primary: true });
      
      // Refresh household to get updated contacts
      await fetchHouseholdDetail(household.id);
      
      toast.success(`${contact.first_name} ${contact.last_name} set as primary contact`);
    } catch (error: any) {
      console.error('Failed to set primary contact:', error);
      toast.error('Failed to set primary contact');
    }
  };

  const handleEdit = (contact: HouseholdContact, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingContact(contact);
  };
  
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Household Contacts</CardTitle>
            <Button onClick={() => setShowAddModal(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Contact
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {contacts.map(contact => {
              // Construct display name from first_name and last_name
              const displayName = `${contact.first_name} ${contact.last_name}`;
              const initials = `${contact.first_name[0]}${contact.last_name[0]}`.toUpperCase();
              
              return (
                <div
                  key={contact.id}
                  className="flex items-start gap-4 p-4 border rounded-lg hover:bg-slate-50 transition-colors"
                >
                  <Avatar className="h-12 w-12">
                    <AvatarFallback>{initials}</AvatarFallback>
                  </Avatar>
                  
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-semibold">{displayName}</h3>
                      {contact.is_primary && (
                        <Badge className="gap-1 bg-yellow-100 text-yellow-800 border-yellow-200">
                          <Star className="h-3 w-3 fill-yellow-600" />
                          Primary
                        </Badge>
                      )}
                      {contact.is_emergency_contact && (
                        <Badge variant="secondary">
                          Emergency Contact
                        </Badge>
                      )}
                      {contact.emergency_contact_relationship && (
                        <Badge variant="outline" className="capitalize">
                          {contact.emergency_contact_relationship}
                        </Badge>
                      )}
                    </div>
                    
                    <div className="space-y-1 text-sm text-slate-600">
                      {contact.email && (
                        <div className="flex items-center gap-2">
                          <EnvelopeSimple className="h-4 w-4" />
                          <ContactLink kind="email" value={contact.email} contactName={displayName} />
                        </div>
                      )}
                      {contact.phone && (
                        <div className="flex items-center gap-2">
                          <Phone className="h-4 w-4" />
                          <ContactLink kind="phone" value={contact.phone} contactName={displayName} />
                        </div>
                      )}
                    </div>
                    
                    <div className="mt-3 flex gap-2">
                      {contact.email_consent && (
                        <Badge variant="outline" className="text-xs">Email ✓</Badge>
                      )}
                      {contact.sms_consent && (
                        <Badge variant="outline" className="text-xs">SMS ✓</Badge>
                      )}
                      {contact.marketing_consent && (
                        <Badge variant="outline" className="text-xs">Marketing ✓</Badge>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex gap-2">
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={(e) => handleEdit(contact, e)}
                    >
                      Edit
                    </Button>
                    {!contact.is_primary && (
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={(e) => handleSetAsPrimary(contact, e)}
                      >
                        Set as Primary
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
            
            {contacts.length === 0 && (
              <div className="text-center py-12 text-slate-400">
                <p>No contacts added yet</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <AddContactModal
        open={showAddModal}
        onClose={() => setShowAddModal(false)}
        householdId={household.id}
      />

      {editingContact && (
        <EditContactModal
          open={!!editingContact}
          onClose={() => setEditingContact(null)}
          contact={editingContact}
          householdId={household.id}
        />
      )}
    </div>
  );
}