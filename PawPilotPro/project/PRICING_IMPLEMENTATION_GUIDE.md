# MDC Operations Centre - Pricing System Implementation Guide

## ✅ Implementation Complete

Your production-grade Services & Pricing system has been fully implemented according to your architecture specification. All components are operational and ready to use.

---

## 🏗️ Architecture Overview

### Four-Layer Pricing Model

1. **Service Definition** - What is being sold
2. **Price Book** - How much it costs
3. **Location Overrides** - Where-specific pricing
4. **Commercial Modifiers** - Memberships, packages, penalties

---

## 📁 File Structure

### Backend (Supabase Edge Functions)
```
/supabase/functions/server/
├── index.tsx                  # ✅ Main server (pricing routes integrated)
├── pricing_routes.tsx         # ✅ Complete pricing API (all CRUD operations)
├── app_routes.tsx            # ✅ Organisation & location routes
└── kv_store.tsx              # 🔒 Protected - KV database utilities
```

### Frontend Store
```
/src/app/modules/pricing/
├── store.ts                  # ✅ Zustand store with all pricing logic
└── seed-data.ts              # ✅ Sample data utility for testing
```

### UI Components
```
/src/app/modules/settings/
├── pages/
│   └── ServicesAndPricing.tsx           # ✅ Main pricing page with tabs
└── components/pricing/
    ├── ServiceCatalogue.tsx             # ✅ Service CRUD (module-aware)
    ├── PriceBooks.tsx                   # ✅ Price book management + entries
    ├── MembershipsAndPackages.tsx       # ✅ Commercial modifiers
    ├── PricingAuditLog.tsx              # ✅ Audit trail viewer
    ├── LocationPricingOverrides.tsx     # ✅ Location-level price overrides
    └── SeedDataButton.tsx               # ✅ One-click sample data seeding
```

---

## 🚀 Quick Start

### 1. Seed Sample Data

Navigate to **Settings → Services & Pricing** and click **"Seed Sample Data"**.

This will create:
- **17 services** across all modules (Daycare, Grooming, Boutique, Transport)
- **1 active price book** with complete pricing
- **3 membership plans** (Essential, Premium, Ultimate)
- **3 prepaid packages** (10-day, 20-day, Spa Day)

### 2. Explore the System

#### Service Catalogue Tab
- View services grouped by module
- Create/edit/delete services
- Define operational attributes (duration, capacity impact, staff roles)
- Set service status (active/inactive)

#### Price Books Tab
- Create multiple price books (draft, active, archived)
- Define scope (organisation-wide or location-specific)
- Set effective dates for future pricing
- Manage price entries for each service
- **Click the £ icon** to manage price entries

#### Memberships & Packages Tab
- Create monthly membership plans with included credits
- Define overage pricing and pause rules
- Create prepaid packages with expiry rules
- Set refund policies

#### Audit Log Tab
- View all pricing changes with timestamps
- Track who made changes and why
- See detailed change history

---

## 📊 Service Types by Module

### Daycare
- Full Day / Half Day / Trial Day
- Extra Hours / Late Pickup
- Ad-hoc Day

### Grooming
- Bath / Cut / Trim
- Add-ons (nails, teeth, de-shed)
- Penalties (missed appointments)

### Boutique
- Products (SKU-based)
- Bundles
- Discounted Items

### Transportation
- Pickup / Drop-off / Round Trip
- Penalties (failed pickup)

---

## 🔧 API Endpoints

All pricing endpoints are prefixed with:
```
https://{projectId}.supabase.co/functions/v1/make-server-fc003b23/pricing
```

### Services
- `GET /services` - List all services
- `GET /services/module/:moduleId` - Filter by module
- `GET /services/:id` - Get single service
- `POST /services` - Create service
- `PUT /services/:id` - Update service
- `DELETE /services/:id` - Delete service

### Price Books
- `GET /price-books` - List all price books
- `POST /price-books` - Create price book
- `PUT /price-books/:id` - Update price book
- `DELETE /price-books/:id` - Delete price book (and all entries)

### Price Book Entries
- `GET /price-books/:bookId/entries` - List entries
- `POST /price-books/:bookId/entries` - Create entry
- `PUT /price-books/:bookId/entries/:id` - Update entry
- `DELETE /price-books/:bookId/entries/:id` - Delete entry

### Location Price Overrides
- `GET /locations/:locationId/price-overrides` - List overrides
- `POST /locations/:locationId/price-overrides` - Create override
- `PUT /locations/:locationId/price-overrides/:id` - Update override
- `DELETE /locations/:locationId/price-overrides/:id` - Delete override

### Memberships
- `GET /memberships` - List all memberships
- `POST /memberships` - Create membership
- `PUT /memberships/:id` - Update membership
- `DELETE /memberships/:id` - Delete membership

### Packages
- `GET /packages` - List all packages
- `POST /packages` - Create package
- `PUT /packages/:id` - Update package
- `DELETE /packages/:id` - Delete package

### Audit Log
- `GET /audit` - Get full pricing audit trail

---

## 💡 Key Features

### ✅ Consistent Pricing Governance
- Single source of truth for all pricing
- Module-specific flexibility while maintaining consistency
- Clear hierarchy: Base Price → Location Override → Applied Modifiers

### ✅ Location-Level Overrides
- Override base prices at specific locations
- Automatic difference calculation and visualization
- Audit trail with reasons for changes
- Clear UI showing base vs override prices

### ✅ Commercial Modifiers
**Memberships:**
- Monthly subscription plans
- Included service credits
- Overage pricing rules
- Pause and proration policies

**Packages:**
- Prepaid bundles
- Expiry rules (in days)
- Refund policies
- Multi-service bundles

### ✅ Complete Audit Trail
- Every pricing change is logged
- Timestamps, user, and detailed descriptions
- Filterable by action type and entity
- Essential for compliance and governance

### ✅ Future-Dated Pricing
- Create price books with future effective dates
- Support for price transitions
- Historical pricing preserved

---

## 🔐 Security & Governance

### Permission Levels

**Admin:**
- Create/edit services
- Create/manage price books
- Create memberships and packages
- View audit logs

**Manager:**
- Apply location price overrides (if permitted)
- View pricing
- View audit logs

**Staff:**
- View resolved pricing only
- Cannot modify pricing

---

## 🎯 Usage Examples

### Example 1: Creating a New Service

```typescript
import { usePricingStore } from './modules/pricing/store';

const store = usePricingStore.getState();

await store.createService({
  moduleId: 'grooming',
  name: 'Premium Spa Package',
  description: 'Luxury grooming experience with aromatherapy',
  customerFacingDescription: 'Pamper your pup with our premium spa treatment',
  serviceType: 'grooming-cut',
  durationMinutes: 180,
  requiredStaffRole: 'Senior Groomer',
  status: 'active',
});
```

### Example 2: Getting a Service Price

```typescript
// Get base price
const basePrice = store.getServicePrice(serviceId);

// Get price with location override
const locationPrice = store.getServicePrice(serviceId, locationId);
```

### Example 3: Creating a Location Override

```typescript
await store.createLocationOverride(locationId, {
  serviceId: 'service-123',
  overridePrice: 45.00,
  taxRate: 20,
  reason: 'Higher rent and operating costs in this area',
});
```

---

## 📈 Data Model

### Service
```typescript
{
  id: string;
  moduleId: string;
  name: string;
  description: string;
  customerFacingDescription?: string;
  serviceType: ServiceType;
  durationMinutes?: number;
  capacityImpact?: number;
  requiredStaffRole?: string;
  status: 'active' | 'inactive';
}
```

### Price Book
```typescript
{
  id: string;
  name: string;
  currency: string;
  effectiveDate: string;
  scope: 'organisation' | 'location';
  locationIds?: string[];
  status: 'draft' | 'active' | 'archived';
}
```

### Price Book Entry
```typescript
{
  id: string;
  priceBookId: string;
  serviceId: string;
  basePrice: number;
  taxRate: number;
  unit?: string;
}
```

### Location Price Override
```typescript
{
  id: string;
  locationId: string;
  serviceId: string;
  overridePrice: number;
  taxRate: number;
  reason?: string;
}
```

### Membership
```typescript
{
  id: string;
  name: string;
  description: string;
  monthlyPrice: number;
  includedCredits: Array<{
    serviceId: string;
    quantity: number;
  }>;
  overagePricing: Array<{
    serviceId: string;
    price: number;
  }>;
  pauseRules?: string;
  prorationRules?: string;
  status: 'active' | 'inactive';
}
```

### Package
```typescript
{
  id: string;
  name: string;
  description: string;
  price: number;
  includedServices: Array<{
    serviceId: string;
    quantity: number;
  }>;
  expiryDays?: number;
  isRefundable: boolean;
  status: 'active' | 'inactive';
}
```

---

## 🔄 Integration Points

### Bookings System
When creating a booking:
1. Select service → System resolves correct price
2. Check for location override
3. Check for active membership credits
4. Check for available package credits
5. Lock price at booking time

### Billing System
On invoice generation:
1. Include base service with locked price
2. Show applied modifiers (membership discount, package usage)
3. Calculate tax breakdown
4. Generate line items with audit trail

### Reporting
Available metrics:
- Revenue by module
- Revenue by service
- Revenue by location
- Membership vs. pay-as-you-go split
- Package utilization rates
- Price override impact analysis

---

## 🧪 Testing

### Manual Testing
1. Use **Seed Sample Data** button to populate test data
2. Create a location with enabled modules
3. Apply location price overrides
4. Create test bookings with different pricing scenarios

### Programmatic Testing
```typescript
import { seedPricingSystem, clearAllPricingData } from './modules/pricing/seed-data';

// Populate test data
await seedPricingSystem();

// Run your tests...

// Clean up
await clearAllPricingData();
```

---

## 🐛 Troubleshooting

### Issue: Prices not showing
**Solution:** Ensure you have:
1. Created services
2. Created an active price book
3. Added price entries to the price book

### Issue: Location override not applying
**Solution:** Check that:
1. The override exists for the specific location and service
2. The location is active
3. You're passing the correct `locationId` to `getServicePrice()`

### Issue: Audit log empty
**Solution:** Audit entries are created automatically on all create/update/delete operations. If empty, ensure the backend is properly logging changes in `pricing_routes.tsx`.

---

## 📝 Next Steps

### Phase 1: Core Operations (Complete ✅)
- ✅ Service catalogue
- ✅ Price books and entries
- ✅ Location overrides
- ✅ Memberships and packages
- ✅ Audit logging

### Phase 2: Integration (Your Next Steps)
- [ ] Integrate with booking system
- [ ] Integrate with billing/invoicing
- [ ] Build customer-facing service selection UI
- [ ] Add membership management for customers
- [ ] Package credit tracking and deduction

### Phase 3: Advanced Features
- [ ] Automated price book activation on effective date
- [ ] Price change notifications
- [ ] Revenue forecasting based on pricing
- [ ] Dynamic pricing rules (seasonal, demand-based)
- [ ] Multi-currency support
- [ ] Discount codes and promotions

---

## 🤝 Support

### Architecture Documentation
See `/PRICING_ARCHITECTURE.md` for the complete pricing architecture specification.

### Code Structure
- **Backend:** `/supabase/functions/server/pricing_routes.tsx`
- **Frontend Store:** `/src/app/modules/pricing/store.ts`
- **UI Components:** `/src/app/modules/settings/components/pricing/`
- **Seed Data:** `/src/app/modules/pricing/seed-data.ts`

### Common Patterns

#### Creating a new pricing entity:
```typescript
const entity = await store.createXxx({ ...data });
```

#### Updating an entity:
```typescript
await store.updateXxx(id, { ...partialData });
```

#### Deleting an entity:
```typescript
await store.deleteXxx(id);
```

#### Fetching data:
```typescript
await store.fetchXxxs(); // Populates store state
const items = store.xxxs; // Access from state
```

---

## 🎉 Success!

Your pricing system is now fully operational and production-ready. The architecture supports:
- **Multi-module pricing** (Daycare, Grooming, Boutique, Transport)
- **Multi-location operations** with overrides
- **Commercial flexibility** (memberships, packages)
- **Complete governance** (audit trail, permissions)
- **Future scalability** (additional modules, features)

**Start by clicking "Seed Sample Data" in Settings → Services & Pricing!**

---

*Last Updated: December 28, 2025*
*Version: 1.0.0*
