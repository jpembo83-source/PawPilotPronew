/**
 * UAT Seed Data Script
 * Populates Paw Pilot Pro with realistic test data for UAT
 * 
 * Usage: npx ts-node scripts/seed-test-data.ts
 * Or via npm script: npm run seed:test
 */

const API_BASE = process.env.VITE_SUPABASE_URL 
  ? `${process.env.VITE_SUPABASE_URL}/functions/v1/make-server-fc003b23`
  : 'https://ruahrxkfgfyshuxykiay.supabase.co/functions/v1/make-server-fc003b23';

// Test user credentials (should exist in Supabase Auth)
const TEST_USER_EMAIL = process.env.TEST_USER_EMAIL || 'test@pawpilotpro.com';
const TEST_USER_PASSWORD = process.env.TEST_USER_PASSWORD || 'TestPassword123!';

// ============================================
// TEST DATA DEFINITIONS
// ============================================

const TEST_CUSTOMERS = [
  {
    name: 'Johnson Family',
    primary_contact: 'Sarah Johnson',
    email: 'sarah.johnson@example.com',
    phone: '+44 7700 900001',
    address: '123 Oak Street, London, SW1A 1AA',
    pets: [
      {
        name: 'Buddy',
        species: 'dog',
        breed: 'Golden Retriever',
        date_of_birth: '2020-03-15',
        weight_kg: 32,
        gender: 'male',
        neutered: true,
        color: 'Golden',
        microchip_number: 'GB123456789012345',
        vaccinations: [
          { type: 'Rabies', date: '2025-06-01', expiry: '2026-06-01' },
          { type: 'DHPP', date: '2025-08-15', expiry: '2026-08-15' },
          { type: 'Bordetella', date: '2025-09-01', expiry: '2026-03-01' },
        ],
        notes: 'Very friendly, loves to play fetch',
        behaviour_flags: [],
        medical_flags: [],
      },
      {
        name: 'Daisy',
        species: 'dog',
        breed: 'Cocker Spaniel',
        date_of_birth: '2021-07-22',
        weight_kg: 14,
        gender: 'female',
        neutered: true,
        color: 'Black and Tan',
        microchip_number: 'GB123456789012346',
        vaccinations: [
          { type: 'Rabies', date: '2025-07-01', expiry: '2026-07-01' },
          { type: 'DHPP', date: '2025-07-01', expiry: '2026-07-01' },
        ],
        notes: 'Can be nervous around large dogs',
        behaviour_flags: ['nervous'],
        medical_flags: [],
      },
    ],
  },
  {
    name: 'Chen Household',
    primary_contact: 'Mike Chen',
    email: 'mike.chen@example.com',
    phone: '+44 7700 900002',
    address: '456 Maple Avenue, London, E1 6AN',
    pets: [
      {
        name: 'Luna',
        species: 'dog',
        breed: 'Siberian Husky',
        date_of_birth: '2019-11-30',
        weight_kg: 25,
        gender: 'female',
        neutered: true,
        color: 'Black and White',
        microchip_number: 'GB123456789012347',
        vaccinations: [
          { type: 'Rabies', date: '2025-04-01', expiry: '2026-04-01' },
          { type: 'DHPP', date: '2026-02-01', expiry: '2026-02-14' }, // Expiring soon!
        ],
        notes: 'High energy, needs lots of exercise',
        behaviour_flags: ['high_energy'],
        medical_flags: [],
      },
    ],
  },
  {
    name: 'Wilson Family',
    primary_contact: 'Emma Wilson',
    email: 'emma.wilson@example.com',
    phone: '+44 7700 900003',
    address: '789 Pine Road, London, N1 9AG',
    pets: [
      {
        name: 'Max',
        species: 'dog',
        breed: 'German Shepherd',
        date_of_birth: '2018-05-10',
        weight_kg: 38,
        gender: 'male',
        neutered: true,
        color: 'Black and Tan',
        microchip_number: 'GB123456789012348',
        vaccinations: [
          { type: 'Rabies', date: '2025-01-15', expiry: '2026-01-15' }, // Expired!
          { type: 'DHPP', date: '2025-03-01', expiry: '2026-03-01' },
          { type: 'Bordetella', date: '2025-09-20', expiry: '2026-03-20' },
        ],
        notes: 'Well trained, good with commands',
        behaviour_flags: [],
        medical_flags: ['hip_dysplasia'],
      },
    ],
  },
  {
    name: 'Smith Household',
    primary_contact: 'Tom Smith',
    email: 'tom.smith@example.com',
    phone: '+44 7700 900004',
    address: '321 Birch Lane, London, SE1 7PB',
    pets: [
      {
        name: 'Bella',
        species: 'dog',
        breed: 'Labrador Retriever',
        date_of_birth: '2022-01-05',
        weight_kg: 28,
        gender: 'female',
        neutered: false,
        color: 'Chocolate',
        microchip_number: 'GB123456789012349',
        vaccinations: [
          { type: 'Rabies', date: '2025-08-01', expiry: '2026-08-01' },
          { type: 'DHPP', date: '2025-08-01', expiry: '2026-08-01' },
          { type: 'Bordetella', date: '2025-10-01', expiry: '2026-04-01' },
        ],
        notes: 'Young and playful, still learning manners',
        behaviour_flags: ['excitable'],
        medical_flags: [],
      },
      {
        name: 'Rocky',
        species: 'dog',
        breed: 'French Bulldog',
        date_of_birth: '2020-09-18',
        weight_kg: 12,
        gender: 'male',
        neutered: true,
        color: 'Fawn',
        microchip_number: 'GB123456789012350',
        vaccinations: [
          { type: 'Rabies', date: '2025-05-01', expiry: '2026-05-01' },
          { type: 'DHPP', date: '2025-05-01', expiry: '2026-05-01' },
        ],
        notes: 'Snores loudly, monitor breathing in hot weather',
        behaviour_flags: [],
        medical_flags: ['brachycephalic'],
      },
    ],
  },
  {
    name: 'Garcia Family',
    primary_contact: 'Maria Garcia',
    email: 'maria.garcia@example.com',
    phone: '+44 7700 900005',
    address: '654 Cedar Court, London, W1K 5ED',
    pets: [
      {
        name: 'Charlie',
        species: 'dog',
        breed: 'Beagle',
        date_of_birth: '2021-04-12',
        weight_kg: 11,
        gender: 'male',
        neutered: true,
        color: 'Tricolor',
        microchip_number: 'GB123456789012351',
        vaccinations: [
          { type: 'Rabies', date: '2025-06-15', expiry: '2026-06-15' },
          { type: 'DHPP', date: '2025-06-15', expiry: '2026-06-15' },
          { type: 'Bordetella', date: '2025-08-01', expiry: '2026-02-01' }, // Expired!
        ],
        notes: 'Food motivated, can be a escape artist',
        behaviour_flags: ['food_guarder'],
        medical_flags: [],
      },
    ],
  },
];

// Generate bookings for this week and next
function generateBookings(customerId: string, petId: string, petName: string) {
  const bookings = [];
  const today = new Date();
  
  // Create bookings for the next 7 days
  for (let i = 0; i < 7; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() + i);
    
    // Skip weekends for some pets
    if (date.getDay() === 0 || date.getDay() === 6) continue;
    
    // Random chance of booking
    if (Math.random() > 0.4) {
      bookings.push({
        customer_id: customerId,
        pet_id: petId,
        pet_name: petName,
        service_type: 'daycare',
        date: date.toISOString().split('T')[0],
        planned_start_time: '08:00',
        planned_end_time: '18:00',
        status: i === 0 ? 'checked_in' : 'confirmed',
      });
    }
  }
  
  return bookings;
}

// ============================================
// SEED FUNCTIONS
// ============================================

async function seedCustomersAndPets(authToken: string) {
  console.log('\n📋 Seeding customers and pets...');
  
  for (const customer of TEST_CUSTOMERS) {
    try {
      // Create customer/household
      const customerRes = await fetch(`${API_BASE}/customers`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'X-User-Token': authToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: customer.name,
          primary_contact_name: customer.primary_contact,
          email: customer.email,
          phone: customer.phone,
          address: customer.address,
        }),
      });
      
      if (!customerRes.ok) {
        console.log(`  ⚠️  Customer ${customer.name} may already exist or failed`);
        continue;
      }
      
      const customerData = await customerRes.json();
      console.log(`  ✅ Created customer: ${customer.name}`);
      
      // Create pets
      for (const pet of customer.pets) {
        const petRes = await fetch(`${API_BASE}/pets`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'X-User-Token': authToken,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            ...pet,
            customer_id: customerData.id,
            household_id: customerData.id,
          }),
        });
        
        if (petRes.ok) {
          console.log(`    🐕 Created pet: ${pet.name} (${pet.breed})`);
        } else {
          console.log(`    ⚠️  Pet ${pet.name} failed`);
        }
      }
    } catch (err) {
      console.log(`  ❌ Error with ${customer.name}:`, err);
    }
  }
}

async function seedBookings(authToken: string) {
  console.log('\n📅 Seeding bookings...');
  
  // First, get all customers and pets
  const customersRes = await fetch(`${API_BASE}/customers`, {
    headers: {
      'Authorization': `Bearer ${authToken}`,
      'X-User-Token': authToken,
    },
  });
  
  if (!customersRes.ok) {
    console.log('  ❌ Could not fetch customers');
    return;
  }
  
  const customers = await customersRes.json();
  let bookingCount = 0;
  
  for (const customer of (customers.customers || customers || [])) {
    // Get pets for this customer
    const petsRes = await fetch(`${API_BASE}/customers/${customer.id}/pets`, {
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'X-User-Token': authToken,
      },
    });
    
    if (!petsRes.ok) continue;
    
    const pets = await petsRes.json();
    
    for (const pet of (pets.pets || pets || [])) {
      const bookings = generateBookings(customer.id, pet.id, pet.name);
      
      for (const booking of bookings) {
        const bookingRes = await fetch(`${API_BASE}/daycare/bookings`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'X-User-Token': authToken,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(booking),
        });
        
        if (bookingRes.ok) {
          bookingCount++;
        }
      }
    }
  }
  
  console.log(`  ✅ Created ${bookingCount} bookings`);
}

async function seedGroomingAppointments(authToken: string) {
  console.log('\n✂️ Seeding grooming appointments...');
  
  // Get customers/pets and create some grooming appointments
  const customersRes = await fetch(`${API_BASE}/customers`, {
    headers: {
      'Authorization': `Bearer ${authToken}`,
      'X-User-Token': authToken,
    },
  });
  
  if (!customersRes.ok) {
    console.log('  ❌ Could not fetch customers');
    return;
  }
  
  const customers = await customersRes.json();
  let appointmentCount = 0;
  const today = new Date();
  
  for (const customer of (customers.customers || customers || []).slice(0, 3)) {
    const petsRes = await fetch(`${API_BASE}/customers/${customer.id}/pets`, {
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'X-User-Token': authToken,
      },
    });
    
    if (!petsRes.ok) continue;
    const pets = await petsRes.json();
    
    for (const pet of (pets.pets || pets || []).slice(0, 1)) {
      const appointmentDate = new Date(today);
      appointmentDate.setDate(appointmentDate.getDate() + Math.floor(Math.random() * 7));
      
      const appointmentRes = await fetch(`${API_BASE}/grooming/appointments`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'X-User-Token': authToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          customer_id: customer.id,
          pet_id: pet.id,
          pet_name: pet.name,
          service_type: 'full_groom',
          date: appointmentDate.toISOString().split('T')[0],
          time: '10:00',
          duration_minutes: 90,
          status: 'confirmed',
          notes: 'Regular grooming appointment',
        }),
      });
      
      if (appointmentRes.ok) {
        appointmentCount++;
      }
    }
  }
  
  console.log(`  ✅ Created ${appointmentCount} grooming appointments`);
}

// ============================================
// MAIN EXECUTION
// ============================================

async function main() {
  console.log('🐾 Paw Pilot Pro - UAT Seed Data Script');
  console.log('========================================\n');
  console.log(`API Base: ${API_BASE}`);
  
  // For now, we'll need to pass in an auth token manually
  // In a real setup, this would authenticate via Supabase
  const authToken = process.env.AUTH_TOKEN;
  
  if (!authToken) {
    console.log('\n⚠️  No AUTH_TOKEN provided.');
    console.log('   To use this script:');
    console.log('   1. Log into Paw Pilot Pro in your browser');
    console.log('   2. Open DevTools > Application > Local Storage');
    console.log('   3. Find the Supabase session and copy the access_token');
    console.log('   4. Run: AUTH_TOKEN="your_token" npx ts-node scripts/seed-test-data.ts');
    console.log('\n   Or use the UI seed button (coming soon)');
    return;
  }
  
  try {
    await seedCustomersAndPets(authToken);
    await seedBookings(authToken);
    await seedGroomingAppointments(authToken);
    
    console.log('\n✅ Seed data complete!');
    console.log('\nTest accounts created:');
    TEST_CUSTOMERS.forEach(c => {
      console.log(`  - ${c.name}: ${c.pets.map(p => p.name).join(', ')}`);
    });
  } catch (err) {
    console.error('\n❌ Seed failed:', err);
  }
}

main();
