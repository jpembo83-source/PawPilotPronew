// UAT Seed Data Panel - Populate system with test data for UAT
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Checkbox } from '../../../components/ui/checkbox';
import { Label } from '../../../components/ui/label';
import { 
  Database, 
  Users, 
  Dog, 
  Calendar, 
  Loader2, 
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import { toast } from 'sonner';
import { getAuthHeaders } from '../../../../utils/supabase/authHeaders';
import { projectId } from '../../../../../utils/supabase/info';

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-fc003b23`;

// Test data definitions
const TEST_CUSTOMERS = [
  {
    name: 'Johnson Family',
    primary_contact_name: 'Sarah Johnson',
    email: 'sarah.johnson@example.com',
    phone: '+44 7700 900001',
    address: '123 Oak Street, London, SW1A 1AA',
    pets: [
      { name: 'Buddy', breed: 'Golden Retriever', species: 'dog', weight_kg: 32, gender: 'male', date_of_birth: '2020-03-15', notes: 'Very friendly, loves fetch' },
      { name: 'Daisy', breed: 'Cocker Spaniel', species: 'dog', weight_kg: 14, gender: 'female', date_of_birth: '2021-07-22', notes: 'Nervous around large dogs' },
    ],
  },
  {
    name: 'Chen Household',
    primary_contact_name: 'Mike Chen',
    email: 'mike.chen@example.com',
    phone: '+44 7700 900002',
    address: '456 Maple Avenue, London, E1 6AN',
    pets: [
      { name: 'Luna', breed: 'Siberian Husky', species: 'dog', weight_kg: 25, gender: 'female', date_of_birth: '2019-11-30', notes: 'High energy, needs exercise' },
    ],
  },
  {
    name: 'Wilson Family',
    primary_contact_name: 'Emma Wilson',
    email: 'emma.wilson@example.com',
    phone: '+44 7700 900003',
    address: '789 Pine Road, London, N1 9AG',
    pets: [
      { name: 'Max', breed: 'German Shepherd', species: 'dog', weight_kg: 38, gender: 'male', date_of_birth: '2018-05-10', notes: 'Well trained, good commands' },
    ],
  },
  {
    name: 'Smith Household',
    primary_contact_name: 'Tom Smith',
    email: 'tom.smith@example.com',
    phone: '+44 7700 900004',
    address: '321 Birch Lane, London, SE1 7PB',
    pets: [
      { name: 'Bella', breed: 'Labrador Retriever', species: 'dog', weight_kg: 28, gender: 'female', date_of_birth: '2022-01-05', notes: 'Young and playful' },
      { name: 'Rocky', breed: 'French Bulldog', species: 'dog', weight_kg: 12, gender: 'male', date_of_birth: '2020-09-18', notes: 'Monitor breathing in heat' },
    ],
  },
  {
    name: 'Garcia Family',
    primary_contact_name: 'Maria Garcia',
    email: 'maria.garcia@example.com',
    phone: '+44 7700 900005',
    address: '654 Cedar Court, London, W1K 5ED',
    pets: [
      { name: 'Charlie', breed: 'Beagle', species: 'dog', weight_kg: 11, gender: 'male', date_of_birth: '2021-04-12', notes: 'Food motivated, escape artist' },
    ],
  },
];

interface SeedProgress {
  customers: { total: number; done: number; status: 'pending' | 'running' | 'done' | 'error' };
  pets: { total: number; done: number; status: 'pending' | 'running' | 'done' | 'error' };
  bookings: { total: number; done: number; status: 'pending' | 'running' | 'done' | 'error' };
}

export function UATSeedPanel() {
  const [isSeeding, setIsSeeding] = useState(false);
  const [seedCustomers, setSeedCustomers] = useState(true);
  const [seedBookings, setSeedBookings] = useState(true);
  const [progress, setProgress] = useState<SeedProgress>({
    customers: { total: TEST_CUSTOMERS.length, done: 0, status: 'pending' },
    pets: { total: TEST_CUSTOMERS.reduce((sum, c) => sum + c.pets.length, 0), done: 0, status: 'pending' },
    bookings: { total: 0, done: 0, status: 'pending' },
  });

  const seedTestData = async () => {
    setIsSeeding(true);
    setProgress({
      customers: { total: TEST_CUSTOMERS.length, done: 0, status: 'pending' },
      pets: { total: TEST_CUSTOMERS.reduce((sum, c) => sum + c.pets.length, 0), done: 0, status: 'pending' },
      bookings: { total: 0, done: 0, status: 'pending' },
    });

    try {
      const headers = await getAuthHeaders();
      
      // First try the built-in seed endpoint (creates 3 households with pets)
      // Pass force: true to clear any stale/malformed test data and reseed fresh
      console.log('Calling built-in seed endpoint with force=true...');
      const seedRes = await fetch(`${API_BASE}/customers/seed-data`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ force: true }),
      });
      
      const seedResult = await seedRes.json();
      console.log('Seed endpoint response:', seedRes.status, seedResult);
      
      if (seedRes.ok) {
        toast.success(seedResult.message || 'Backend seed data created!');
        setProgress(p => ({
          ...p,
          customers: { ...p.customers, done: 3, status: 'done' },
          pets: { ...p.pets, done: 3, status: 'done' },
        }));
        setIsSeeding(false);
        return;
      }
      
      // If backend seed failed or already exists, try manual creation
      console.log('Backend seed failed or exists, trying manual creation...');
      const createdCustomers: { id: string; pets: { id: string; name: string }[] }[] = [];

      // Seed customers and pets
      if (seedCustomers) {
        setProgress(p => ({ ...p, customers: { ...p.customers, status: 'running' } }));
        
        for (const customer of TEST_CUSTOMERS) {
          try {
            // Create customer/household
            const customerRes = await fetch(`${API_BASE}/customers/households`, {
              method: 'POST',
              headers,
              body: JSON.stringify({
                name: customer.name,
                primary_contact_name: customer.primary_contact_name,
                email: customer.email,
                phone: customer.phone,
                address: customer.address,
              }),
            });

            if (!customerRes.ok) {
              const errorText = await customerRes.text();
              console.error('Failed to create customer:', customer.name, customerRes.status, errorText);
              continue;
            }
            
            const customerData = await customerRes.json();
            console.log('Created customer:', customer.name, customerData.id);
            const createdPets: { id: string; name: string }[] = [];
            
            setProgress(p => ({ ...p, customers: { ...p.customers, done: p.customers.done + 1 } }));
            setProgress(p => ({ ...p, pets: { ...p.pets, status: 'running' } }));

            // Create pets for this customer/household
            for (const pet of customer.pets) {
              try {
                const petRes = await fetch(`${API_BASE}/customers/households/${customerData.id}/pets`, {
                  method: 'POST',
                  headers,
                  body: JSON.stringify({
                    ...pet,
                    household_id: customerData.id,
                  }),
                });

                if (petRes.ok) {
                  const petData = await petRes.json();
                  console.log('Created pet:', pet.name, petData.id);
                  createdPets.push({ id: petData.id, name: pet.name });
                  setProgress(p => ({ ...p, pets: { ...p.pets, done: p.pets.done + 1 } }));
                } else {
                  const errorText = await petRes.text();
                  console.error('Failed to create pet:', pet.name, petRes.status, errorText);
                }
              } catch (petErr) {
                console.error('Error creating pet:', pet.name, petErr);
              }
            }

            createdCustomers.push({ id: customerData.id, pets: createdPets });
          } catch (customerErr) {
            console.error('Error creating customer:', customer.name, customerErr);
          }
        }

        setProgress(p => ({ 
          ...p, 
          customers: { ...p.customers, status: 'done' },
          pets: { ...p.pets, status: 'done' },
        }));
      }

      // Seed bookings
      if (seedBookings && createdCustomers.length > 0) {
        setProgress(p => ({ ...p, bookings: { ...p.bookings, status: 'running' } }));
        
        const today = new Date();
        let bookingCount = 0;

        for (const customer of createdCustomers) {
          for (const pet of customer.pets) {
            // Create bookings for next 5 weekdays
            for (let i = 0; i < 7; i++) {
              const date = new Date(today);
              date.setDate(date.getDate() + i);
              
              // Skip weekends
              if (date.getDay() === 0 || date.getDay() === 6) continue;
              
              // 50% chance of booking
              if (Math.random() > 0.5) continue;

              try {
                const bookingRes = await fetch(`${API_BASE}/daycare/bookings`, {
                  method: 'POST',
                  headers,
                  body: JSON.stringify({
                    household_id: customer.id,
                    pet_id: pet.id,
                    pet_name: pet.name,
                    service_type: 'full_day',
                    date: date.toISOString().split('T')[0],
                    planned_start_time: '08:00',
                    planned_end_time: '18:00',
                    booking_status: 'confirmed',
                  }),
                });

                if (bookingRes.ok) {
                  bookingCount++;
                  setProgress(p => ({ 
                    ...p, 
                    bookings: { ...p.bookings, done: bookingCount, total: Math.max(p.bookings.total, bookingCount) } 
                  }));
                } else {
                  console.error('Failed to create booking:', await bookingRes.text());
                }
              } catch (bookingErr) {
                console.error('Error creating booking:', bookingErr);
              }
            }
          }
        }

        setProgress(p => ({ ...p, bookings: { ...p.bookings, status: 'done' } }));
      }

      toast.success('Test data seeded successfully!');
    } catch (err: any) {
      console.error('Seed error:', err);
      toast.error(err.message || 'Failed to seed data');
    } finally {
      setIsSeeding(false);
    }
  };

  const StatusIcon = ({ status }: { status: 'pending' | 'running' | 'done' | 'error' }) => {
    switch (status) {
      case 'running': return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />;
      case 'done': return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'error': return <AlertTriangle className="h-4 w-4 text-red-500" />;
      default: return <div className="h-4 w-4 rounded-full bg-slate-200" />;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Database className="h-5 w-5 text-purple-500" />
          UAT Test Data
        </CardTitle>
        <CardDescription>
          Populate the system with realistic test data for User Acceptance Testing
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Options */}
        <div className="space-y-3">
          <Label className="text-sm font-medium">What to seed:</Label>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Checkbox 
                id="seed-customers" 
                checked={seedCustomers} 
                onCheckedChange={(c) => setSeedCustomers(c as boolean)}
                disabled={isSeeding}
              />
              <label htmlFor="seed-customers" className="text-sm flex items-center gap-2">
                <Users className="h-4 w-4 text-slate-500" />
                5 Test Customers with 7 Pets
              </label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox 
                id="seed-bookings" 
                checked={seedBookings} 
                onCheckedChange={(c) => setSeedBookings(c as boolean)}
                disabled={isSeeding}
              />
              <label htmlFor="seed-bookings" className="text-sm flex items-center gap-2">
                <Calendar className="h-4 w-4 text-slate-500" />
                Daycare Bookings (this week)
              </label>
            </div>
          </div>
        </div>

        {/* Progress */}
        {isSeeding && (
          <div className="space-y-2 p-4 bg-slate-50 rounded-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <StatusIcon status={progress.customers.status} />
                <span className="text-sm">Customers</span>
              </div>
              <span className="text-sm text-slate-600">{progress.customers.done}/{progress.customers.total}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <StatusIcon status={progress.pets.status} />
                <span className="text-sm">Pets</span>
              </div>
              <span className="text-sm text-slate-600">{progress.pets.done}/{progress.pets.total}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <StatusIcon status={progress.bookings.status} />
                <span className="text-sm">Bookings</span>
              </div>
              <span className="text-sm text-slate-600">{progress.bookings.done}</span>
            </div>
          </div>
        )}

        {/* Test Accounts Preview */}
        <div className="border rounded-lg p-4">
          <p className="text-sm font-medium mb-2">Test accounts that will be created:</p>
          <div className="text-xs text-slate-600 space-y-1">
            {TEST_CUSTOMERS.map(c => (
              <div key={c.name} className="flex items-center gap-2">
                <Dog className="h-3 w-3" />
                <span><strong>{c.name}</strong>: {c.pets.map(p => p.name).join(', ')}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <Button 
            onClick={seedTestData} 
            disabled={isSeeding || (!seedCustomers && !seedBookings)}
            className="flex-1"
          >
            {isSeeding ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Seeding...
              </>
            ) : (
              <>
                <Database className="h-4 w-4 mr-2" />
                Seed Test Data
              </>
            )}
          </Button>
        </div>

        <p className="text-xs text-slate-500">
          ⚠️ This creates real data in your database. Use only for testing purposes.
          <br />
          💡 Open browser DevTools (F12) → Console to see detailed progress.
        </p>
      </CardContent>
    </Card>
  );
}
