import React from 'react';
import { useNavigate } from 'react-router';
import { Household, HouseholdContact, Pet, PetDocument } from '../../types';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../../../../components/ui/card';
import { Button } from '../../../../components/ui/button';
import { Badge } from '../../../../components/ui/badge';
import { Avatar, AvatarFallback } from '../../../../components/ui/avatar';
import {
  Dog,
  EnvelopeSimple,
  Phone,
  MapPin,
  Warning,
  FileDashed,
  Plus,
  ArrowSquareOut,
  Star
} from '@phosphor-icons/react';

interface OverviewTabProps {
  household: Household & { 
    contacts?: HouseholdContact[]; 
    pets?: Pet[]; 
    documents?: PetDocument[] 
  } | null;
}

export function OverviewTab({ household }: OverviewTabProps) {
  const navigate = useNavigate();
  
  if (!household) {
    return (
      <div className="text-center py-12 text-slate-400">
        <p>No household data available</p>
      </div>
    );
  }
  
  const { pets = [], contacts = [], documents = [], activities = [], activeFlags = [] } = household;

  // Get pets with alerts
  const petsWithAlerts = pets.filter(pet => {
    return !pet.active;
  });
  
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-6">
        {/* Contacts Summary */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Contacts</CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.preventDefault();
                  navigate(`/customers/${household.id}?tab=contacts`);
                }}
              >
                View All
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {contacts.slice(0, 3).map(contact => (
              <div key={contact.id} className="flex items-start gap-3">
                <Avatar>
                  <AvatarFallback>
                    {`${contact.first_name} ${contact.last_name}`.split(' ').map(n => n[0]).join('').toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-medium">{contact.first_name} {contact.last_name}</p>
                    {contact.is_primary && (
                      <Badge className="gap-1 bg-yellow-100 text-yellow-800 border-yellow-200 text-xs">
                        <Star className="h-3 w-3 fill-yellow-600" />
                        Primary
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-slate-600 capitalize">{contact.relationship}</p>
                  <div className="flex items-center gap-3 mt-2 text-sm text-slate-600">
                    <div className="flex items-center gap-1">
                      <EnvelopeSimple className="h-3 w-3" />
                      {contact.email}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 mt-1 text-sm text-slate-600">
                    <Phone className="h-3 w-3" />
                    {contact.phone}
                  </div>
                </div>
              </div>
            ))}
            {contacts.length === 0 && (
              <div className="text-center py-6 text-slate-400">
                <p>No contacts added</p>
              </div>
            )}
          </CardContent>
        </Card>
        
        {/* Pets Summary */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Pets</CardTitle>
                <CardDescription>{pets.length} pet{pets.length !== 1 ? 's' : ''}</CardDescription>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate(`/customers/${household.id}?tab=pets`)}
              >
                View All
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {pets.length === 0 ? (
              <div className="text-center py-6 text-slate-400">
                <Dog className="h-12 w-12 mx-auto mb-2 text-slate-300" />
                <p>No pets added</p>
              </div>
            ) : (
              <div className="space-y-3">
                {pets.slice(0, 3).map(pet => {
                  const hasAlerts = !pet.active;
                  
                  return (
                    <div
                      key={pet.id}
                      className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg cursor-pointer hover:bg-slate-100 transition-colors"
                      onClick={() => navigate(`/customers/pets/${pet.id}`)}
                    >
                      <div className="flex-shrink-0">
                        {pet.photo_url ? (
                          <img 
                            src={pet.photo_url} 
                            alt={pet.name}
                            className="w-12 h-12 rounded-lg object-cover"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-lg bg-slate-200 flex items-center justify-center">
                            <Dog className="h-6 w-6 text-slate-400" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold">{pet.name}</h3>
                          {hasAlerts && (
                            <Warning className="h-4 w-4 text-red-500" />
                          )}
                        </div>
                        <p className="text-sm text-slate-600">{pet.breed}</p>
                        <div className="flex items-center gap-2 mt-2">
                          <Badge
                            variant={pet.active ? 'default' : 'destructive'}
                            className="text-xs"
                          >
                            {pet.active ? 'active' : 'inactive'}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      
      {/* Active Alerts */}
      {petsWithAlerts.length > 0 && (
        <Card className="border-red-200 bg-red-50">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Warning className="h-5 w-5 text-red-600" />
              <CardTitle className="text-red-900">Active Alerts</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {petsWithAlerts.map(pet => {
                return (
                  <div key={pet.id} className="flex items-start gap-3 p-3 bg-white rounded-lg">
                    <Dog className="h-5 w-5 text-red-600 mt-0.5" />
                    <div className="flex-1">
                      <p className="font-medium text-red-900">{pet.name}</p>
                      <p className="text-sm text-red-700 mt-1">
                        Pet is inactive
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => navigate(`/customers/pets/${pet.id}`)}
                    >
                      <ArrowSquareOut className="h-4 w-4" />
                    </Button>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}