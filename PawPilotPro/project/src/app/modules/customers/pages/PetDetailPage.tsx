import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router';
import { useCustomerStore } from '../store';
import { useCurrency } from '../../../utils/currency';
import {
  ArrowLeft,
  Dog,
  PencilSimple,
  Check,
  X,
  Warning,
  CalendarBlank,
  Pulse,
  FileText,
  Stethoscope,
} from '@phosphor-icons/react';
import { Button } from '../../../components/ui/button';
import { Badge } from '../../../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../../components/ui/tabs';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../../../components/ui/card';
import { Skeleton } from '../../../components/ui/skeleton';

import { useBackNavigation } from '../../../components/BackButton';
export function PetDetailPage() {
  const { petId } = useParams<{ petId: string }>();
  const navigate = useNavigate();
  const { fetchPetById, isLoading, error } = useCustomerStore();
  const [pet, setPet] = useState<any>(null);
  const [activeTab, setActiveTab] = useState('profile');
  // History-aware: returns to wherever staff came from (search, inbox,
  // household…); the household page is only the deep-link fallback.
  const goBack = useBackNavigation(
    pet?.household_id ? `/customers/${pet.household_id}` : '/customers',
  );

  useEffect(() => {
    if (petId && petId !== 'new') {
      fetchPetById(petId).then(setPet).catch(console.error);
    }
  }, [petId]);

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!pet) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="py-12 text-center">
            <Warning className="h-12 w-12 text-slate-300 mx-auto mb-4" />
            <h3 className="font-semibold text-slate-900 mb-2">Pet not found</h3>
            <p className="text-slate-600 mb-4">
              This pet doesn't exist or you don't have permission to view it.
            </p>
            {error && (
              <p className="text-sm text-slate-500 mb-4 font-mono">
                Error: {error}
              </p>
            )}
            <Button onClick={goBack}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Customers
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={goBack}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>

          <div className="h-24 w-24 rounded-lg bg-slate-200 flex items-center justify-center">
            <Dog className="h-12 w-12 text-slate-400" />
          </div>

          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-3xl font-bold">{pet.name}</h1>
              <Badge variant={pet.active ? 'default' : 'destructive'}>
                {pet.active ? 'active' : 'inactive'}
              </Badge>
            </div>

            <div className="space-y-1 text-sm text-slate-600">
              {pet.breed && <p>{pet.breed}</p>}
              {pet.sex && <p className="capitalize">Sex: {pet.sex}</p>}
              {pet.date_of_birth && (
                <p>
                  Born: {new Date(pet.date_of_birth).toLocaleDateString('en-GB')}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            <PencilSimple className="h-4 w-4 mr-2" />
            Edit Pet
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600 mb-1">Weight</p>
                <p className="text-2xl font-bold">
                  {pet.weight_kg ? `${pet.weight_kg}kg` : '—'}
                </p>
              </div>
              <Pulse className="h-8 w-8 text-slate-400" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600 mb-1">Microchip</p>
                <p className="text-xs font-mono">
                  {pet.microchip ? pet.microchip.slice(0, 12) + '...' : 'None'}
                </p>
              </div>
              <FileText className="h-8 w-8 text-slate-400" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600 mb-1">Bookings</p>
                <p className="text-2xl font-bold">0</p>
              </div>
              <CalendarBlank className="h-8 w-8 text-slate-400" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600 mb-1">Vaccinations</p>
                <p className="text-sm font-medium capitalize">
                  {pet.vaccination_status || 'Unknown'}
                </p>
              </div>
              <Stethoscope className="h-8 w-8 text-slate-400" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="care">Care Instructions</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="bookings">Bookings</TabsTrigger>
          <TabsTrigger value="activity">Pulse</TabsTrigger>
        </TabsList>

        <TabsContent value="profile">
          <div className="grid grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Basic Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="text-sm font-medium text-slate-600">Name</p>
                  <p className="text-base">{pet.name}</p>
                </div>
                {pet.breed && (
                  <div>
                    <p className="text-sm font-medium text-slate-600">Breed</p>
                    <p className="text-base">{pet.breed}</p>
                  </div>
                )}
                {pet.sex && (
                  <div>
                    <p className="text-sm font-medium text-slate-600">Sex</p>
                    <p className="text-base capitalize">{pet.sex}</p>
                  </div>
                )}
                {pet.date_of_birth && (
                  <div>
                    <p className="text-sm font-medium text-slate-600">Date of Birth</p>
                    <p className="text-base">
                      {new Date(pet.date_of_birth).toLocaleDateString('en-GB')}
                    </p>
                  </div>
                )}
                {pet.weight_kg && (
                  <div>
                    <p className="text-sm font-medium text-slate-600">Weight</p>
                    <p className="text-base">{pet.weight_kg} kg</p>
                  </div>
                )}
                {pet.colour && (
                  <div>
                    <p className="text-sm font-medium text-slate-600">Colour/Markings</p>
                    <p className="text-base">{pet.colour}</p>
                  </div>
                )}
                {pet.microchip && (
                  <div>
                    <p className="text-sm font-medium text-slate-600">Microchip Number</p>
                    <p className="text-base font-mono">{pet.microchip}</p>
                  </div>
                )}
                {pet.neutered_status && pet.neutered_status !== 'none' && (
                  <div>
                    <p className="text-sm font-medium text-slate-600">Neutered/Spayed</p>
                    <p className="text-base capitalize">{pet.neutered_status}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {pet.address && (pet.address.line1 || pet.address.city || pet.address.postcode) && (
              <Card>
                <CardHeader>
                  <CardTitle>Pet Address</CardTitle>
                </CardHeader>
                <CardContent className="space-y-1">
                  {pet.address.line1 && <p>{pet.address.line1}</p>}
                  {pet.address.line2 && <p>{pet.address.line2}</p>}
                  {(pet.address.city || pet.address.postcode) && (
                    <p>
                      {pet.address.city && pet.address.city}
                      {pet.address.city && pet.address.postcode && ', '}
                      {pet.address.postcode && pet.address.postcode}
                    </p>
                  )}
                  {pet.address.country && <p>{pet.address.country}</p>}
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle>Service Enrolment</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Daycare</span>
                  <Badge variant={pet.daycare_enrolled ? 'default' : 'secondary'}>
                    {pet.daycare_enrolled ? 'Enrolled' : 'Not Enrolled'}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Grooming</span>
                  <Badge variant={pet.grooming_enrolled ? 'default' : 'secondary'}>
                    {pet.grooming_enrolled ? 'Enrolled' : 'Not Enrolled'}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Transport</span>
                  <Badge variant={pet.transport_enrolled ? 'default' : 'secondary'}>
                    {pet.transport_enrolled ? 'Enrolled' : 'Not Enrolled'}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Overnights</span>
                  <Badge variant={pet.overnights_enrolled ? 'default' : 'secondary'}>
                    {pet.overnights_enrolled ? 'Enrolled' : 'Not Enrolled'}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="care">
          <div className="space-y-6">
            {pet.feeding_instructions && (
              <Card>
                <CardHeader>
                  <CardTitle>Feeding Instructions</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-slate-700 whitespace-pre-wrap">
                    {pet.feeding_instructions}
                  </p>
                </CardContent>
              </Card>
            )}

            {pet.allergies && (
              <Card>
                <CardHeader>
                  <CardTitle>Allergies</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-slate-700 whitespace-pre-wrap">{pet.allergies}</p>
                </CardContent>
              </Card>
            )}

            {pet.behaviour_notes && (
              <Card>
                <CardHeader>
                  <CardTitle>
                    Behaviour Notes
                    <Badge variant="outline" className="ml-2">Staff Only</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-slate-700 whitespace-pre-wrap">
                    {pet.behaviour_notes}
                  </p>
                </CardContent>
              </Card>
            )}

            {pet.medical_notes && (
              <Card>
                <CardHeader>
                  <CardTitle>
                    Medical Notes
                    <Badge variant="outline" className="ml-2">Staff Only</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-slate-700 whitespace-pre-wrap">
                    {pet.medical_notes}
                  </p>
                </CardContent>
              </Card>
            )}

            {(pet.vet_name || pet.vet_phone || pet.vet_address) && (
              <Card>
                <CardHeader>
                  <CardTitle>Veterinary Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {pet.vet_name && (
                    <div>
                      <p className="text-sm font-medium text-slate-600">Practice Name</p>
                      <p className="text-base">{pet.vet_name}</p>
                    </div>
                  )}
                  {pet.vet_phone && (
                    <div>
                      <p className="text-sm font-medium text-slate-600">Phone</p>
                      <p className="text-base">{pet.vet_phone}</p>
                    </div>
                  )}
                  {pet.vet_address && (
                    <div>
                      <p className="text-sm font-medium text-slate-600">Address</p>
                      <p className="text-base whitespace-pre-wrap">{pet.vet_address}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="documents">
          <Card>
            <CardHeader>
              <CardTitle>Documents</CardTitle>
              <CardDescription>
                Vaccination records, waivers, and other documents
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12 text-slate-400">
                <FileText className="h-12 w-12 mx-auto mb-2 text-slate-300" />
                <p>No documents uploaded yet</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="bookings">
          <Card>
            <CardHeader>
              <CardTitle>Booking ClockCounterClockwise</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12 text-slate-400">
                <CalendarBlank className="h-12 w-12 mx-auto mb-2 text-slate-300" />
                <p>No bookings yet</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="activity">
          <Card>
            <CardHeader>
              <CardTitle>Pulse Timeline</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12 text-slate-400">
                <Pulse className="h-12 w-12 mx-auto mb-2 text-slate-300" />
                <p>No activity yet</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}