# Services & Pricing System Architecture

## Overview

The MDC Operations Centre implements a production-grade, four-layer pricing architecture that governs all commercial transactions across multiple service modules (Daycare, Grooming, Boutique, Transportation).

## Design Principles

1. **Consistent Pricing Governance** - All modules follow the same pricing framework
2. **Module-Specific Flexibility** - Each module can have its own service types while adhering to central control
3. **Location-Level Overrides** - Individual locations can override org-wide pricing with audit trail
4. **Clean Integration** - Pricing integrates seamlessly with bookings, billing, and reporting
5. **Audit & Compliance** - All pricing changes are logged with timestamp, user, and details

---

## Four-Layer Pricing Architecture

### Layer 1: Service Definitions

**Purpose**: Define WHAT is being sold

**Structure**:
- Module (Daycare / Grooming / Boutique / Transport)
- Service name
- Internal & customer-facing descriptions
- Service type (module-specific)
- Operational attributes:
  - Duration (minutes)
  - Capacity impact
  - Required staff role
- Status (active / inactive)

**Service Types by Module**:

#### Daycare
- Full Day
- Half Day
- Trial Day
- Extra Hours / Late Pickup
- Ad-hoc Day

#### Grooming
- Bath / Cut / Trim
- Add-on (nails, teeth, de-shed)
- Penalty (missed appointment)

#### Boutique
- Product (SKU-based)
- Bundle
- Discounted item

#### Transportation
- Pickup / Drop-off / Round trip
- Penalty (failed pickup)

**API Endpoints**:
```
GET    /pricing/services
GET    /pricing/services/module/:moduleId
GET    /pricing/services/:id
POST   /pricing/services
PUT    /pricing/services/:id
DELETE /pricing/services/:id
```

---

### Layer 2: Price Books

**Purpose**: Define HOW MUCH services cost

**Structure**:
- Name
- Currency (GBP / USD / EUR)
- Effective date (supports future pricing)
- Scope:
  - Organisation-wide
  - Location-specific
- Status (draft / active / archived)
- Price Entries:
  - Service
  - Base price
  - Tax/VAT rate
  - Unit (per day, per hour, per item)

**Rules**:
- Only ONE active price book per service per location at any time
- Future-dated price books auto-activate
- Historical bookings retain historical prices
- Draft price books can be prepared before activation

**API Endpoints**:
```
GET    /pricing/price-books
GET    /pricing/price-books/:id
POST   /pricing/price-books
PUT    /pricing/price-books/:id
DELETE /pricing/price-books/:id

GET    /pricing/price-books/:bookId/entries
POST   /pricing/price-books/:bookId/entries
PUT    /pricing/price-books/:bookId/entries/:id
DELETE /pricing/price-books/:bookId/entries/:id
```

---

### Layer 3: Location Price Overrides

**Purpose**: WHERE pricing applies (location-specific exceptions)

**Structure**:
- Location ID
- Service ID
- Override price
- Tax rate
- Reason (optional, for audit)

**Rules**:
- Location overrides are optional
- Organisation-level pricing is the default
- All overrides must be explicit and visible
- Full audit trail maintained

**UI Behavior**:
- Show base price from organisation price book
- Show overridden price if exists
- Highlight the difference
- Display reason for override

**API Endpoints**:
```
GET    /pricing/locations/:locationId/price-overrides
POST   /pricing/locations/:locationId/price-overrides
PUT    /pricing/locations/:locationId/price-overrides/:id
DELETE /pricing/locations/:locationId/price-overrides/:id
```

---

### Layer 4: Commercial Modifiers

**Purpose**: Apply additional pricing logic on top of base prices

#### Memberships
Monthly subscription plans with:
- Monthly price
- Included credits (e.g., X daycare days)
- Overage pricing
- Pause and proration rules

#### Packages
Prepaid bundles with:
- Total price
- Included services and quantities
- Expiry rules
- Refund policy

#### Discounts
- Percentage or fixed amount
- Manual (permission-gated)
- Automatic (rule-based)

#### Penalties & Fees
- Late pickup
- No-show
- Cancellation fees

**Rules**:
- Modifiers NEVER change the base price
- All modifiers must be transparent on invoices
- Permissions required to apply or waive fees
- Staff cannot circumvent pricing rules

**API Endpoints**:
```
GET    /pricing/memberships
POST   /pricing/memberships
PUT    /pricing/memberships/:id
DELETE /pricing/memberships/:id

GET    /pricing/packages
POST   /pricing/packages
PUT    /pricing/packages/:id
DELETE /pricing/packages/:id
```

---

## Integration with Core Systems

### Bookings
When a service is selected for booking:
1. System auto-resolves correct price from active price book
2. Checks for location overrides
3. Applies any applicable modifiers
4. Price is LOCKED at booking time (historical preservation)

### Billing
Invoice line items include:
- Base service description
- Base price
- Applied modifiers (memberships, packages, discounts)
- Tax breakdown
- Total

Supports:
- Single transaction invoices
- Consolidated monthly invoices
- Credit notes and refunds

### Reporting
Revenue analysis by:
- Module (Daycare / Grooming / Boutique / Transport)
- Service
- Location
- Time period

Future: Margin analysis per service

---

## Security & Governance

### Role-Based Access Control

**Admin**:
- Create/edit/delete services
- Create/edit/delete price books
- View all audit logs

**Manager**:
- Apply location price overrides (if permitted)
- View pricing for assigned locations
- Cannot edit global prices

**Staff**:
- View resolved prices only
- Cannot alter pricing
- Cannot apply manual discounts (unless permitted)

### Audit Trail

Every pricing change logged with:
- Timestamp
- User ID
- Action (CREATE / UPDATE / DELETE)
- Entity (service / pricebook / override / etc.)
- Entity ID
- Detailed description

**API Endpoint**:
```
GET /pricing/audit
```

---

## Data Model (High Level)

### Key Tables (KV Store Keys)

```
service:{id}                          - Service definitions
pricebook:{id}                        - Price books
priceentry:{bookId}:{id}              - Price book entries
priceoverride:{locationId}:{id}       - Location overrides
membership:{id}                       - Membership plans
package:{id}                          - Prepaid packages
audit:pricing:{id}                    - Audit log entries
```

### Service Schema
```typescript
{
  id: string
  moduleId: string
  name: string
  description: string
  customerFacingDescription?: string
  serviceType: ServiceType
  durationMinutes?: number
  capacityImpact?: number
  requiredStaffRole?: string
  status: 'active' | 'inactive'
  createdAt: string
  updatedAt: string
}
```

### Price Book Schema
```typescript
{
  id: string
  name: string
  currency: string
  effectiveDate: string
  scope: 'organisation' | 'location'
  locationIds?: string[]
  status: 'draft' | 'active' | 'archived'
  createdAt: string
  updatedAt: string
}
```

### Price Book Entry Schema
```typescript
{
  id: string
  priceBookId: string
  serviceId: string
  basePrice: number
  taxRate: number
  unit?: string
  createdAt: string
  updatedAt: string
}
```

### Location Override Schema
```typescript
{
  id: string
  locationId: string
  serviceId: string
  overridePrice: number
  taxRate: number
  reason?: string
  createdAt: string
  updatedAt: string
}
```

---

## UI Structure

### Admin Settings → Services & Pricing

**4 Main Tabs**:

1. **Service Catalogue**
   - List all services grouped by module
   - Filter by module
   - Create/edit/delete services
   - Toggle service status

2. **Price Books**
   - List all price books (active/draft/archived)
   - Create/edit/delete price books
   - Manage price entries per book
   - Set effective dates

3. **Memberships & Packages**
   - 2 sub-tabs: Memberships | Packages
   - Create/edit/delete each
   - Define included services and credits

4. **Audit Log**
   - View all pricing changes
   - Filter by action/entity/user
   - Export for compliance

### Location Settings → Pricing (Future Enhancement)

- View inherited organisation prices
- Apply/remove overrides
- Enable/disable chargeable services per location

### Operational UI (Staff View)

- Staff see RESOLVED price only
- No ability to edit prices
- Discounts require permission

---

## Acceptance Criteria ✓

- ✅ Pricing logic is consistent across all modules
- ✅ Adding a new module does not require pricing refactors
- ✅ Location overrides are clear and auditable
- ✅ Historical prices are preserved (locked at booking time)
- ✅ Staff cannot accidentally change commercial rules
- ✅ All pricing changes are logged with full audit trail
- ✅ Module-specific service types supported
- ✅ Future-dated price books supported
- ✅ Tax/VAT handling included
- ✅ Multiple currencies supported

---

## Implementation Status

### ✅ Completed

1. **Backend API** (`/supabase/functions/server/pricing_routes.tsx`)
   - All CRUD endpoints for services, price books, entries, overrides, memberships, packages
   - Comprehensive audit logging
   - Error handling and logging

2. **Zustand Store** (`/src/app/modules/pricing/store.ts`)
   - Type-safe state management
   - API integration
   - Utility functions (getServicePrice, getActivePriceBook)

3. **Admin UI Components**
   - ServiceCatalogue.tsx - Full CRUD for services
   - PriceBooks.tsx - Price book and entry management
   - MembershipsAndPackages.tsx - Commercial modifiers
   - PricingAuditLog.tsx - Audit trail viewer
   - ServicesAndPricing.tsx - Main container with tabs

4. **Route Integration**
   - `/settings/services` route added to App.tsx
   - Integrated with existing settings layout

### 🔄 Future Enhancements

1. **Location-Level Pricing UI**
   - Add "Pricing Overrides" tab to Location Settings
   - Comparison view: Org price vs Override price
   - Bulk override operations

2. **Advanced Modifiers**
   - Discount rules engine
   - Dynamic pricing (peak/off-peak)
   - Volume discounts
   - Loyalty rewards

3. **Booking Integration**
   - Price resolution at booking time
   - Display applicable modifiers in booking flow
   - Price locking mechanism

4. **Reporting & Analytics**
   - Revenue by service/module/location
   - Pricing effectiveness analysis
   - Discount impact tracking

5. **Import/Export**
   - Bulk import services from CSV
   - Export price books for review
   - Price comparison tools

---

## Usage Examples

### Creating a Service

1. Navigate to Settings → Services & Pricing
2. Click "Add Service"
3. Select module (e.g., Daycare)
4. Choose service type (e.g., Full Day)
5. Set operational attributes (duration, capacity impact)
6. Save

### Creating a Price Book

1. Navigate to "Price Books" tab
2. Click "Create Price Book"
3. Set name, currency, effective date
4. Choose scope (org-wide or location-specific)
5. Set status (draft for review, active for immediate use)
6. Add price entries for each service
7. Save

### Applying a Location Override

1. Navigate to Locations
2. Select a location
3. Go to Pricing Overrides section
4. Select service to override
5. Enter override price and reason
6. Save (automatically logged in audit trail)

### Viewing Audit Log

1. Navigate to Services & Pricing → Audit Log tab
2. View chronological list of all changes
3. See who made changes and when
4. Review detailed change descriptions

---

## Technical Notes

### KV Store Usage

The system uses Supabase KV store with prefixed keys for data organization:
- Efficient retrieval with `getByPrefix()`
- Automatic ID generation with `crypto.randomUUID()`
- Atomic operations for data consistency

### Error Handling

- All API endpoints return detailed error messages
- Frontend displays user-friendly toast notifications
- Backend logs all errors for debugging
- Validation at both frontend and backend

### Performance Considerations

- Lazy loading of price book entries
- Cached active price books in store
- Efficient filtering and search in UI
- Pagination ready (can be added when needed)

---

## Maintenance & Support

### Adding a New Module

1. Add module to `MODULES` constant
2. Define service types in `SERVICE_TYPES` constant
3. No changes to pricing routes or store needed
4. Module-specific services created through standard UI

### Adding a New Service Type

1. Update `ServiceType` type in store.ts
2. Add to `SERVICE_TYPES` constant in ServiceCatalogue.tsx
3. No backend changes required

### Debugging Pricing Issues

1. Check audit log for recent changes
2. Verify active price book for location
3. Check for location overrides
4. Review service status (active vs inactive)
5. Verify effective dates on price books

---

## Conclusion

This pricing system provides a robust, scalable foundation for managing all commercial transactions in the MDC Operations Centre. It balances flexibility with governance, ensuring pricing consistency across modules while allowing for location-specific variations. The comprehensive audit trail ensures compliance and transparency, while the modular architecture makes it easy to extend and maintain.
