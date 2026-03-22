import React from 'react';
import { Pet } from '../../types';
import { Card, CardContent, CardHeader, CardTitle } from '../../../../components/ui/card';
import { Badge } from '../../../../components/ui/badge';
import { 
  Dog, 
  Phone, 
  MapPin, 
  Heart,
  AlertTriangle,
  Pill
} from 'lucide-react';
import { useCustomerStore } from '../../store';
import { useSettingsStore } from '../../../settings/store';

interface PetOverviewTabProps {
  pet: Pet;
}

export function PetOverviewTab({ pet }: PetOverviewTabProps) {
  const { globalEnabledModules } = useSettingsStore();
  const { currentHouseholdDetail } = useCustomerStore();
  
  if (!pet) {
    return <div>No pet data available</div>;
  }
  
  // Get primary contact from household
  const primaryContact = currentHouseholdDetail?.contacts?.find(c => c.is_primary);
  
  // Build address string from primary contact
  const buildAddress = () => {
    if (!primaryContact) return null;
    
    const parts = [
      primaryContact.address_line1,
      primaryContact.address_line2,
      primaryContact.address_city,
      primaryContact.address_postcode,
      primaryContact.address_country,
    ].filter(Boolean);
    
    return parts.length > 0 ? parts.join(', ') : null;
  };
  
  const address = buildAddress();
  
  // Define service enrollment mapping
  const services = [
    { id: 'daycare', label: 'Daycare', enrolled: pet.daycare_enrolled },
    { id: 'grooming', label: 'Grooming', enrolled: pet.grooming_enrolled },
    { id: 'transport', label: 'Transport', enrolled: pet.transport_enrolled },
    { id: 'overnights', label: 'Overnights', enrolled: pet.overnights_enrolled },
  ];
  
  // Filter services based on globally enabled modules
  const enabledServices = services.filter(service => 
    globalEnabledModules.includes(service.id)
  );
  
  return (
    <div className="space-y-4">
      {/* Basic Information - Two columns */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Basic Information</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="grid grid-cols-2 gap-x-8 gap-y-2.5">
            {pet.breed && (
              <div>
                <p className="text-xs text-slate-600 mb-0.5">Breed</p>
                <p className="font-medium text-sm">{pet.breed}</p>
              </div>
            )}
            {pet.sex && (
              <div>
                <p className="text-xs text-slate-600 mb-0.5">Sex</p>
                <p className="font-medium text-sm capitalize">{pet.sex.replace('_', ' ')}</p>
              </div>
            )}
            {pet.date_of_birth && (
              <div>
                <p className="text-xs text-slate-600 mb-0.5">Date of Birth</p>
                <p className="font-medium text-sm">
                  {new Date(pet.date_of_birth).toLocaleDateString('en-GB', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric'
                  })}
                </p>
              </div>
            )}
            {pet.weight_kg && (
              <div>
                <p className="text-xs text-slate-600 mb-0.5">Weight</p>
                <p className="font-medium text-sm">{pet.weight_kg} kg</p>
              </div>
            )}
            {pet.colour && (
              <div>
                <p className="text-xs text-slate-600 mb-0.5">Colour</p>
                <p className="font-medium text-sm">{pet.colour}</p>
              </div>
            )}
            {pet.neutered_status && pet.neutered_status !== 'none' && (
              <div>
                <p className="text-xs text-slate-600 mb-0.5">Neutered/Spayed</p>
                <p className="font-medium text-sm capitalize">{pet.neutered_status}</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Primary Contact Address - Full width */}
      {address && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Home Address</CardTitle>
              {pet.transport_enrolled && (
                <Badge variant="outline" className="text-xs">
                  Transport Pickup/Dropoff
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex items-start gap-2 text-sm">
              <MapPin className="h-4 w-4 text-slate-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm">{address}</p>
                {primaryContact && (
                  <p className="text-xs text-slate-500 mt-1">
                    Primary contact: {primaryContact.first_name} {primaryContact.last_name}
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
      
      {/* Service Enrollment - Full width */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Service Enrollment</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex flex-wrap gap-2">
            {enabledServices.map(service => (
              <Badge key={service.id} variant={service.enrolled ? 'default' : 'secondary'}>
                {service.label} {service.enrolled ? '✓' : '✗'}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>
      
      {/* Vet and Care Information - Two columns */}
      <div className="grid grid-cols-2 gap-4">
        {/* Vet Information */}
        {(pet.vet_name || pet.vet_phone || pet.vet_address) && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Veterinarian</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2.5 pt-0">
              {pet.vet_name && (
                <div>
                  <p className="text-xs text-slate-600 mb-0.5">Practice Name</p>
                  <p className="font-medium text-sm">{pet.vet_name}</p>
                </div>
              )}
              {pet.vet_phone && (
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="h-3.5 w-3.5 text-slate-400" />
                  <span>{pet.vet_phone}</span>
                </div>
              )}
              {pet.vet_address && (
                <div className="flex items-start gap-2 text-sm">
                  <MapPin className="h-3.5 w-3.5 text-slate-400 mt-0.5" />
                  <span>{pet.vet_address}</span>
                </div>
              )}
            </CardContent>
          </Card>
        )}
        
        {/* Care Information */}
        {(pet.feeding_instructions || pet.behaviour_notes || pet.medical_notes) && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Care Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2.5 pt-0">
              {pet.feeding_instructions && (
                <div>
                  <p className="text-xs text-slate-600 mb-0.5">Feeding Instructions</p>
                  <p className="text-sm whitespace-pre-wrap">{pet.feeding_instructions}</p>
                </div>
              )}
              {pet.behaviour_notes && (
                <div>
                  <p className="text-xs text-slate-600 mb-0.5">Behaviour Notes</p>
                  <p className="text-sm whitespace-pre-wrap">{pet.behaviour_notes}</p>
                </div>
              )}
              {pet.medical_notes && (
                <div>
                  <p className="text-xs text-slate-600 mb-0.5">Medical Notes</p>
                  <p className="text-sm whitespace-pre-wrap">{pet.medical_notes}</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
      
      {/* Allergies */}
      {pet.allergies && (
        <Card className="border-amber-200 bg-amber-50">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <CardTitle className="text-amber-900 text-base">Allergies & Restrictions</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-sm text-amber-900 whitespace-pre-wrap">{pet.allergies}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}