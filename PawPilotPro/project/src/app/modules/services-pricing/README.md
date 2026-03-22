# Services & Pricing System

## Overview

The Services & Pricing system is the **single source of truth** for all pricing in the MDC Operations Centre. It implements a 4-layer architecture that provides:

- Service catalogue (what we sell)
- Price books (how much it costs)
- Location overrides (location-specific pricing)
- Commercial modifiers (memberships, packages, discounts, fees)

**CRITICAL RULE**: No service pricing may be hardcoded anywhere else in the application. All pricing must be resolved through this system.

---

## Architecture

### Layer 1: Service Catalogue

**Purpose**: Define what services are offered

**Data Model**: `Service`

- Services are module-aware (Daycare, Grooming/Spa, Boutique, Transportation)
- Each service has operational attributes:
  - `durationMinutes`: How long the service takes (for grooming)
  - `bufferMinutes`: Cleanup/prep time between services
  - `capacityImpact`: How many "slots" this uses (for daycare)
  - `frequencyTiers`: For frequency-based pricing (e.g., daycare 1-2 days vs 4-5 days per week)

**Seeded Services**:

**Daycare**:
- Daycare – By hour
- Daycare – Half day
- Daycare – Full day (with 3 frequency tiers)
- Daycare – Overnight

**Grooming/Spa**:
- Pawdicure ("Get nailed")
- Oral care ("Kiss me now")
- Full programme ("Date night")
- Wash & Blow ("Down & dirty")
- The look ("Insta ready")
- Medicinal Bath ("Don't let the itch be a b*tch")
- Add-on ("Polaroid memory")

---

### Layer 2: Price Books

**Purpose**: Define pricing that is effective-dated and versioned

**Data Model**: `PriceBook` with `PriceBookEntry[]`

- Price books are effective-dated (from/to)
- Only one price book can be active at a time
- Can be organisation-wide or location-specific
- Each entry defines:
  - Base price
  - Unit (fixed, per_hour, per_day, per_month)
  - Tax category and rate
  - Optional frequency tier reference

**Seeded Price Book**:
- Name: "My Dog Company Baseline"
- Currency: CHF
- Effective immediately
- Contains all daycare and grooming/spa pricing with exact CHF amounts as specified

---

### Layer 3: Location Overrides

**Purpose**: Allow location-specific pricing that overrides the base price book

**Data Model**: `LocationPriceOverride`

- Overrides are service-specific and optionally frequency-tier-specific
- Includes audit fields (who created, when, reason)
- Can be approved by managers (if permission-gated)

**Resolution Logic**:
1. Check for location override first
2. Fall back to price book entry
3. Apply tax

---

### Layer 4: Commercial Modifiers

#### Memberships

**Purpose**: Define subscription plans with monthly pricing and credits/access

**Data Model**: `MembershipPlan`

**Seeded Plans**:
1. **Plan 01: "Split my social"** — 8 half Daycare Days — CHF 493/month
2. **Plan 02: "Stayin in contact"** — 5 full Daycare Days — CHF 473/month
3. **Plan 03: "Fun on the regular"** — 10 full Daycare Days — CHF 897/month
4. **Plan 04: "Zurich Socialite"** — 15 full Daycare Days — CHF 1255/month
5. **Plan 05: "Fear of missing out"** — Everyday access — CHF 1605/month (unlimited)

**Access Types**:
- `credits`: Monthly allocation of credits (e.g., 10 full days)
- `unlimited`: Unlimited access (subject to capacity and booking)

#### Multi-Dog Rules

**Purpose**: Define household discounts for multi-dog memberships

**Data Model**: `MultiDogRule`

**Seeded Rule**:
- Second dog gets 50% off membership
- Applies to all membership plans
- Configurable (not hardcoded)

#### Packages

**Purpose**: Bundle multiple services together at a package price

**Data Model**: `ServicePackage`

#### Fee Rules

**Purpose**: Define fees for late pickup, cancellations, no-shows, etc.

**Data Model**: `FeeRule`

- Can be waived (with permission check)
- Triggered by conditions (e.g., >15 minutes late)

#### Discount Rules

**Purpose**: Define promotional codes and automatic discounts

**Data Model**: `DiscountRule`

- Can require approval
- Can require discount code
- Time-limited

---

## Price Resolution Flow

When a booking is created, the system resolves pricing via the `resolvePrice` API endpoint:

**Input** (`PriceResolutionRequest`):
```typescript
{
  serviceId: string;
  locationId: string;
  frequencyTierId?: string;
  quantity: number;
  date: string; // For effective price book lookup
  membershipId?: string;
  discountCodes?: string[];
}
```

**Process**:
1. Find the service
2. Find active price book for the date
3. Find price entry (with frequency tier if applicable)
4. Check for location override
5. Apply membership credits (if applicable)
6. Apply discounts
7. Calculate tax
8. Return resolved line item

**Output** (`PriceResolutionResponse`):
```typescript
{
  lineItem: ResolvedLineItem; // Locked pricing
  availableCredits?: number;
  creditsAfterBooking?: number;
}
```

**CRITICAL**: The resolved line item is **locked** to the booking. Historical bookings always show the price that was resolved at booking time, not recalculated prices.

---

## Integration Points

### Booking Flows

**Daycare Bookings**:
- When creating a booking, call `resolvePrice` with the selected service and quantity
- Lock the resolved line item to the booking
- Track membership credits used

**Grooming Appointments**:
- Resolve pricing for each service and add-on
- Lock to appointment
- Support for add-ons (e.g., Polaroid memory)

### Invoicing

- Invoices use the locked line items from bookings
- **Never recalculate prices** — always use the locked values
- Apply any late fees or waivers as separate line items

### Membership Management

- Track credit usage per customer per month
- Support pause/unpause
- Support proration (where enabled)
- Automatically apply multi-dog discounts

---

## Security & Governance

### Role-Based Access Control

**Admin**:
- Create/edit services
- Create/activate price books
- Create membership plans
- Configure multi-dog rules
- Create fee and discount rules

**Manager**:
- Create location overrides (if explicitly permitted)
- View all pricing data

**Staff**:
- View pricing (read-only)
- Cannot modify any pricing

### Audit Trail

All changes are recorded with:
- Timestamp
- User who made the change
- Before/after values (for updates)

Location overrides include:
- Reason for override
- Approval fields (who/when)

---

## Seeding Data

Run the seed button in the UI or call the `/pricing/seed` endpoint to populate:
- All daycare and grooming/spa services
- "My Dog Company Baseline" price book with CHF pricing
- All 5 membership plans
- Second dog 50% discount rule

This creates a production-ready pricing system immediately.

---

## Acceptance Criteria

✅ No screen displays any price that is not sourced from the database  
✅ All seed services and membership plans exist and appear in UI  
✅ Booking screens correctly pull and lock pricing  
✅ Location overrides work and are audited  
✅ Membership credits behave correctly  
✅ "Everyday access" plan works as unlimited (subject to capacity/booking)  
✅ Multi-dog discounts are configurable  
✅ Historical pricing remains on historical bookings/invoices  

---

## API Endpoints

### Services
- `GET /pricing/services` - List all services
- `POST /pricing/services` - Create service (Admin)
- `PUT /pricing/services/:id` - Update service (Admin)
- `DELETE /pricing/services/:id` - Delete service (Admin)

### Price Books
- `GET /pricing/price-books` - List all price books
- `POST /pricing/price-books` - Create price book (Admin)
- `PUT /pricing/price-books/:id` - Update price book (Admin)

### Memberships
- `GET /pricing/memberships` - List all membership plans
- `POST /pricing/memberships` - Create membership (Admin)
- `PUT /pricing/memberships/:id` - Update membership (Admin)

### Location Overrides
- `GET /pricing/location-overrides?locationId={id}` - Get overrides for location
- `POST /pricing/location-overrides` - Create override (Admin/Manager)
- `PUT /pricing/location-overrides/:id` - Update override (Admin/Manager)
- `DELETE /pricing/location-overrides/:id` - Delete override (Admin)

### Multi-Dog Rules
- `GET /pricing/multi-dog-rules` - List all rules
- `POST /pricing/multi-dog-rules` - Create rule (Admin)
- `PUT /pricing/multi-dog-rules/:id` - Update rule (Admin)

### Fee Rules
- `GET /pricing/fee-rules` - List all fee rules
- `POST /pricing/fee-rules` - Create fee rule (Admin)
- `PUT /pricing/fee-rules/:id` - Update fee rule (Admin)

### Discount Rules
- `GET /pricing/discount-rules` - List all discount rules
- `POST /pricing/discount-rules` - Create discount rule (Admin)
- `PUT /pricing/discount-rules/:id` - Update discount rule (Admin)

### Price Resolution
- `POST /pricing/resolve` - Resolve price for a booking (used by all booking flows)

### Seed Data
- `POST /pricing/seed` - Seed all baseline data (Admin)

---

## Future Enhancements

1. **Dynamic Pricing**: Time-of-day, day-of-week pricing rules
2. **Seasonal Pricing**: Holiday surcharges
3. **Volume Discounts**: Automatic discounts for bulk purchases
4. **Loyalty Programs**: Points accumulation and redemption
5. **Package Builder**: UI to create custom packages
6. **Price Book Scheduling**: Auto-activate future price books
7. **A/B Price Testing**: Test different price points
8. **Revenue Forecasting**: Based on membership plans and booking trends
