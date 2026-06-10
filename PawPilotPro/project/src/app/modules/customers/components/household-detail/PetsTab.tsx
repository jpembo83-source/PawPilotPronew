import React, { useState } from 'react';
import { useNavigate } from 'react-router';
import { HouseholdDetailView, Pet } from '../../types';
import type { CustomerPackage } from '../../../packages/types';
import { Card, CardContent, CardHeader, CardTitle } from '../../../../components/ui/card';
import { Button } from '../../../../components/ui/button';
import { Badge } from '../../../../components/ui/badge';
import { Plus, Dog, ArrowSquareOut, Warning, ShieldWarning, Star, Prohibit, Truck, Scissors, House, Flag, Medal } from '@phosphor-icons/react';
import { CreatePetModal } from '../pets/CreatePetModal';
import { useCustomerStore } from '../../store';

interface PetsTabProps {
  household: HouseholdDetailView;
  memberships?: CustomerPackage[];
}

export function PetsTab({ household, memberships = [] }: PetsTabProps) {
  const navigate = useNavigate();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const { fetchHouseholdDetail, flags } = useCustomerStore();
  const { pets = [] } = household || {};
  
  const handlePetCreated = async (pet: Pet) => {
    // Refresh household data to get the new pet
    await fetchHouseholdDetail(household.id);
    setIsCreateModalOpen(false);
  };
  
  // Helper function to get flag icon
  const getFlagIcon = (key: string) => {
    switch (key) {
      case 'vip': return Star;
      case 'behaviour_caution': return Warning;
      case 'medical_caution': return ShieldWarning;
      case 'payment_hold': return Prohibit;
      case 'transport_instructions': return Truck;
      case 'grooming_restrictions': return Scissors;
      case 'overnight_restrictions': return House;
      default: return Flag;
    }
  };
  
  // Helper function to get severity colors
  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'info': return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'warn': return 'bg-amber-100 text-amber-800 border-amber-300';
      case 'block': return 'bg-red-100 text-red-800 border-red-300';
      default: return 'bg-slate-100 text-slate-800 border-slate-300';
    }
  };
  
  // Helper function to get flag label
  const getFlagLabel = (key: string) => {
    return key.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  };
  
  return (
    <>
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Pets</CardTitle>
              <Button onClick={() => setIsCreateModalOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Pet
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {memberships.length > 0 && (
              <div className="mb-4 space-y-2">
                {memberships.map(m => (
                  <div key={m.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl" style={{ background: 'var(--primary-tint)' }}>
                    <Medal size={16} style={{ color: 'var(--primary)', flexShrink: 0 }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold" style={{ color: 'var(--primary)' }}>{m.package_name}</p>
                      <p className="text-xs mt-0.5" style={{ color: 'var(--primary)', opacity: 0.8 }}>
                        {m.package_type === 'unlimited'
                          ? 'Unlimited'
                          : m.credits_remaining != null
                            ? `${m.credits_remaining} credit${m.credits_remaining !== 1 ? 's' : ''} remaining`
                            : null}
                        {m.expiry_date && ` · Expires ${new Date(m.expiry_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`}
                        {m.next_billing_date && ` · Renews ${new Date(m.next_billing_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`}
                      </p>
                    </div>
                    <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-white/60" style={{ color: 'var(--primary)' }}>Active</span>
                  </div>
                ))}
              </div>
            )}
            {pets.length === 0 ? (
              <div className="text-center py-12 text-slate-400">
                <Dog className="h-12 w-12 mx-auto mb-2 text-slate-300" />
                <p>No pets added yet</p>
              </div>
            ) : (
              <div className="space-y-4">
                {pets.map(pet => {
                  const petFlags = flags.filter(f => f.is_active && f.pet_id === pet.id);
                  const hasAlerts = petFlags.length > 0 || !pet.active;
                  
                  return (
                    <div
                      key={pet.id}
                      className="flex items-start gap-4 p-4 border rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
                      onClick={() => navigate(`/customers/pets/${pet.id}`)}
                    >
                      <div className="h-16 w-16 rounded-lg bg-slate-200 flex items-center justify-center overflow-hidden flex-shrink-0">
                        {pet.photo_url ? (
                          <img
                            src={pet.photo_url}
                            alt={pet.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <Dog className="h-8 w-8 text-slate-400" />
                        )}
                      </div>
                      
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="font-semibold text-lg">{pet.name}</h3>
                          {hasAlerts && (
                            <Warning className="h-5 w-5 text-red-500" />
                          )}
                        </div>
                        
                        <div className="space-y-1 text-sm text-slate-600">
                          {pet.breed && (
                            <p>
                              <span className="font-medium">Breed:</span> {pet.breed}
                            </p>
                          )}
                          {pet.sex && (
                            <p>
                              <span className="font-medium">Sex:</span>{' '}
                              <span className="capitalize">{pet.sex}</span>
                            </p>
                          )}
                          {pet.date_of_birth && (
                            <p>
                              <span className="font-medium">Date of Birth:</span>{' '}
                              {new Date(pet.date_of_birth).toLocaleDateString('en-GB')}
                            </p>
                          )}
                          {pet.microchip && (
                            <p>
                              <span className="font-medium">Microchip:</span> {pet.microchip}
                            </p>
                          )}
                        </div>
                        
                        <div className="mt-3 flex flex-wrap gap-2">
                          <Badge variant={pet.active ? 'default' : 'destructive'}>
                            {pet.active ? 'active' : 'inactive'}
                          </Badge>
                          {petFlags.map(flag => {
                            const IconComponent = getFlagIcon(flag.flag_key);
                            return (
                              <Badge 
                                key={flag.id}
                                className={`${getSeverityColor(flag.severity)} border`}
                                title={flag.reason || undefined}
                              >
                                <IconComponent className="h-3 w-3 mr-1" />
                                {getFlagLabel(flag.flag_key)}
                              </Badge>
                            );
                          })}
                        </div>
                        
                        {!pet.active && (
                          <div className="mt-3 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-800">
                            Pet is currently inactive
                          </div>
                        )}
                      </div>
                      
                      <Button variant="ghost" size="sm">
                        <ArrowSquareOut className="h-4 w-4" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      <CreatePetModal
        open={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onPetCreated={handlePetCreated}
        householdId={household.id}
      />
    </>
  );
}