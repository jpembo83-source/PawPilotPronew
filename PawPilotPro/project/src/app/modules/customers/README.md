# Customers Module

**A comprehensive household-first customer management system for the MDC Operations Centre.**

## Overview

The Customers module provides complete customer relationship management with a household-first approach, supporting multiple contacts, pets, documents, and compliance tracking. It integrates seamlessly with all operational modules (Daycare, Grooming, Overnights, Transportation) and enforces strict role-based access controls.

## Architecture

### Core Principles

1. **Household-First Model**: Customers are organised as households, not individual contacts
2. **Multi-Pet Support**: Each household can have multiple pets with individual profiles
3. **Document Compliance**: Track vaccinations, waivers, and other documents with expiry management
4. **Role-Based Security**: Strict permission controls for personal, financial, and medical data
5. **Location Awareness**: All operations respect location permissions and module enablement
6. **Activity Tracking**: Complete timeline of all pet interactions across modules

### Data Model

```
Household (1)
├── Contacts (many)
│   ├── Primary Contact
│   ├── Additional Contacts
│   └── Communication Preferences
├── Addresses (many)
│   ├── Home Address
│   ├── Pickup/Dropoff Address
│   └── Access Instructions
├── Pets (many)
│   ├── Basic Info (name, breed, sex, DOB)
│   ├── Care Profile
│   │   ├── Feeding Instructions
│   │   ├── Medications
│   │   ├── Allergies & Restrictions
│   │   ├── Medical Notes (permission gated)
│   │   └── Behaviour Notes (permission gated)
│   ├── Documents
│   │   ├── Vaccinations
│   │   ├── Waivers
│   │   └── Other Documents
│   ├── Activities / Timeline
│   │   ├── Daycare Visits
│   │   ├── Grooming Appointments
│   │   ├── Overnight Stays
│   │   ├── Transport Events
│   │   └── Incidents
│   └── Flags & Alerts
│       ├── Medical Alerts
│       ├── Behaviour Warnings
│       ├── Document Expired
│       └── Check-in Blockers
├── Internal Notes (permission gated)
└── Status Flags
    ├── VIP
    ├── Payment Hold
    └── Booking Hold
```

## User Interface

### Pages

#### 1. Customers List (`/customers`)
- Search and filter households
- View summary cards with alerts
- Quick actions for creating bookings
- Location-scoped results

**Features:**
- Full-text search across households, contacts, pets
- Filters: status, VIP, holds, document alerts
- Visual indicators for VIP status, holds, and alerts
- Click to navigate to household detail

#### 2. Household Detail (`/customers/:householdId`)
Tabbed interface with:

**Overview Tab**
- Contacts summary
- Address information
- Pets grid with alerts
- Quick actions (book daycare, grooming, overnights, transport)
- Active alerts banner

**Contacts Tab**
- List all household contacts
- Add/edit contacts
- Set primary contact
- Manage communication preferences

**Pets Tab**
- List all pets
- View pet status and alerts
- Click through to pet profile

**Messages Tab**
- View communication history
- Send messages using templates
- Integration with Communications module

**Bookings & Visits Tab**
- Complete booking history
- Daycare, Grooming, Overnights, Transport
- Filter by date and module

**Billing Tab** (permission required)
- Invoices and payments
- Outstanding balance
- Payment history
- Integration with Billing module

**Notes & Flags Tab** (permission required)
- Internal notes
- Active flags and alerts
- Hold management

#### 3. Pet Profile (`/customers/pets/:petId`)
Tabbed interface with:

**Overview Tab**
- Basic information
- Veterinarian details
- Emergency contacts
- Feeding instructions
- Medications
- Allergies (highlighted)

**Documents Tab**
- Upload and manage documents
- Track expiry dates
- Status indicators (valid, expiring, expired)
- Download documents

**Care Profile Tab**
- Feeding instructions
- Medications and dosages
- Allergies and restrictions
- Medical notes (permission gated)
- Behaviour and handling notes (permission gated)

**Timeline Tab**
- Complete activity history
- All module interactions
- Incidents and notes
- Chronological feed

## Role-Based Access Control

### Permission Levels

#### Personal Data Access
Required for viewing:
- Contact details (email, phone)
- Home addresses
- Emergency contacts

**Roles with access:** Admin, Manager, Staff (limited), Front Desk

#### Financial Data Access
Required for viewing:
- Invoices and payments
- Outstanding balance
- Payment history
- Credits

**Roles with access:** Admin, Manager

#### Medical/Incident Data Access
Required for viewing:
- Medical notes
- Behaviour notes
- Incident reports
- Medication details

**Roles with access:** Admin, Manager, Overnight Lead

### Driver Access (Limited View)
Drivers have restricted access to:
- Customer name (limited)
- Pickup/dropoff addresses only
- Access instructions
- Pet name (pets being transported only)
- Emergency contact (limited)

Drivers **cannot** access:
- Full contact details
- Billing information
- Medical notes
- Other pets
- Full household information

## Module Integration

### Daycare
- Booking creation from customer profile
- Attendance history in timeline
- Check-in blockers based on document status

### Grooming
- Appointment booking
- Service history
- Grooming notes

### Overnights
- Reservation creation
- Nightly care logs in timeline
- Check-in/out tracking

### Transportation
- Pickup/dropoff address management
- Access instructions for drivers
- Transport events in timeline

### Boutique
- Purchase history (when billing permission granted)

### Messaging
- Send messages to contacts
- Message history
- Template support

### Incidents
- Incident creation
- Incident history
- Link to pet profile

## Data Flow

### Creating a Customer
1. Create household
2. Add primary contact
3. Add additional contacts (optional)
4. Add home address
5. Add pets
6. Upload documents for each pet
7. Complete care profiles

### Check-In Flow
1. Select customer/pet
2. System checks:
   - Pet status (active, not banned)
   - Document expiry (vaccinations)
   - Active flags (blockers)
3. If all checks pass → allow check-in
4. If blocked → display blocking reason
5. Create activity record in timeline

### Document Expiry Workflow
1. System checks document expiry dates daily
2. Updates status:
   - Valid: More than 30 days to expiry
   - Expiring Soon: 30 days or less to expiry
   - Expired: Past expiry date
3. Creates alert flag for expired documents
4. Blocks check-in/booking (configurable by rules)
5. Sends notification to household (if enabled)

## API Endpoints

### Households
- `GET /customers/households` - List with filters
- `GET /customers/households/:id` - Get household detail
- `POST /customers/households` - Create household
- `PUT /customers/households/:id` - Update household
- `DELETE /customers/households/:id` - Delete household

### Contacts
- `GET /customers/households/:householdId/contacts` - List contacts
- `POST /customers/contacts` - Create contact
- `PUT /customers/contacts/:id` - Update contact
- `DELETE /customers/contacts/:id` - Delete contact
- `POST /customers/households/:householdId/contacts/:contactId/set-primary` - Set primary

### Pets
- `GET /customers/households/:householdId/pets` - List pets
- `GET /customers/pets/:petId/profile` - Get pet profile
- `POST /customers/pets` - Create pet
- `PUT /customers/pets/:id` - Update pet
- `DELETE /customers/pets/:id` - Delete pet

### Care Profiles
- `GET /customers/pets/:petId/care-profile` - Get care profile
- `PUT /customers/pets/:petId/care-profile` - Update care profile

### Documents
- `GET /customers/pets/:petId/documents` - List documents
- `POST /customers/documents` - Upload document
- `PUT /customers/documents/:id` - Update document
- `DELETE /customers/documents/:id` - Delete document

### Activities
- `GET /customers/pets/:petId/activities` - Get timeline
- `POST /customers/activities` - Create activity

### Flags
- `GET /customers/pets/:petId/flags` - List flags
- `POST /customers/flags` - Create flag
- `POST /customers/flags/:id/resolve` - Resolve flag
- `DELETE /customers/flags/:id` - Delete flag

## Usage Examples

### Creating a Household
```typescript
const household = await createHousehold({
  householdName: 'Smith Family',
  status: 'active',
  isVIP: false,
  hasPaymentHold: false,
  hasBookingHold: false,
});
```

### Adding a Pet
```typescript
const pet = await createPet({
  householdId: household.id,
  name: 'Max',
  breed: 'Golden Retriever',
  sex: 'male',
  dateOfBirth: '2020-05-15',
  status: 'active',
  photos: [],
  primaryPhotoIndex: 0,
});
```

### Uploading a Document
```typescript
const document = await uploadDocument({
  petId: pet.id,
  householdId: household.id,
  documentType: 'vaccination',
  documentName: 'Rabies Vaccination 2024',
  fileUrl: 'https://...',
  fileName: 'rabies-2024.pdf',
  fileSize: 123456,
  expiryDate: '2025-05-15',
  status: 'valid',
});
```

## Testing

Use the "Seed Demo Data" button to create sample households for testing:
- 3 households with different statuses
- Multiple contacts per household
- Multiple pets with different statuses
- Realistic data for UK operations

## Future Enhancements

1. **Client Portal Integration**
   - Contact portal permissions
   - Self-service booking
   - Document uploads
   - Payment processing

2. **Advanced Document Management**
   - OCR for vaccination certificates
   - Automatic expiry reminders
   - Bulk upload support

3. **Communication Templates**
   - Pre-built message templates
   - Automated reminders
   - Multi-channel support (email, SMS, WhatsApp)

4. **Analytics Dashboard**
   - Customer lifetime value
   - Visit frequency
   - Document compliance rates
   - VIP customer insights

5. **Marketing Integration**
   - Segmentation based on visit history
   - Targeted campaigns
   - Loyalty programs
   - Referral tracking

## British English Standards

This module follows British English conventions:
- "Colour" not "Color"
- "Behaviour" not "Behavior"
- "Organisation" not "Organization"
- Date format: DD/MM/YYYY
- Phone numbers: UK format (e.g., 07700 900123)
- Postcodes: UK format (e.g., SW1A 1AA)
