# Final Seed/Demo Data Cleanup Instructions

## COMPLETED ✅

###Files Successfully Deleted:
1. `/src/app/modules/customers/components/SeedCustomersButton.tsx`
2. `/src/app/modules/settings/components/pricing/SeedDataButton.tsx`
3. `/src/app/modules/settings/components/locations/SeedLocationsButton.tsx`
4. `/src/app/modules/services-pricing/components/SeedPricingButton.tsx`
5. `/src/app/modules/pricing/seed-data.ts`
6. `/src/app/modules/settings/utils/seedLocations.ts`
7. `/supabase/functions/server/seed_pricing.tsx`

### Backend Routes Removed:
- ✅ Removed `/pricing/seed` POST route from pricing_routes.tsx

### CustomerPage Cleaned:
- ✅ Removed import and button usage

## REMAINING MANUAL TASKS

To complete the cleanup, manually edit these files:

### 1. `/src/app/modules/settings/pages/LocationSettings.tsx`

**Line 6 - DELETE THIS LINE:**
```typescript
import { SeedLocationsButton } from '../components/locations/SeedLocationsButton';
```

**Lines 126-128 - REPLACE WITH:**
```typescript
        <Button onClick={handleOpenCreate} className="bg-primary hover:bg-primary/90">
          <Plus className="h-4 w-4 mr-2" />
          Add Location
        </Button>
```

### 2. `/src/app/modules/settings/pages/ServicesAndPricing.tsx`

**Line 8 - DELETE THIS LINE:**
```typescript
import { SeedDataButton } from '../components/pricing/SeedDataButton';
```

**Line 44 - DELETE THIS LINE:**
```typescript
        <SeedDataButton />
```

### 3. `/src/app/modules/services-pricing/pages/ServicesPricingPage.tsx`

**Line 4 - DELETE THIS LINE:**
```typescript
import { SeedPricingButton } from '../components/SeedPricingButton';
```

**Line 96 - DELETE THIS LINE:**
```typescript
          {!hasData && <SeedPricingButton />}
```

### 4. `/src/app/modules/services-pricing/index.ts`

**Line 4 - DELETE THIS LINE:**
```typescript
export { SeedPricingButton } from './components/SeedPricingButton';
```

### 5. Update Empty State Messages

**`/src/app/modules/services-pricing/pages/tabs/ServicesTab.tsx` Line 59:**
```typescript
// CHANGE FROM:
Seed pricing data to create the service catalogue
// TO:
Create your first service to begin building your service catalogue
```

**`/src/app/modules/services-pricing/pages/tabs/PriceBooksTab.tsx` Line 25:**
```typescript
// CHANGE FROM:
Seed pricing data to create the baseline price book
// TO:
Create a price book to establish your pricing structure
```

**`/src/app/modules/services-pricing/pages/tabs/MembershipsTab.tsx` Line 16:**
```typescript
// CHANGE FROM:
Seed pricing data to create membership plans
// TO:
Create a membership plan to offer recurring services
```

### 6. Remove Mock Data from Transport Module

**`/src/app/modules/transport/store.ts`**

Lines 89-97 (DELETE MOCK_VEHICLES array and generateRequests function):
- Remove const MOCK_VEHICLES
- Remove const generateRequests
- In the store, change line 113 from `vehicles: MOCK_VEHICLES` to `vehicles: []`
- Change line 114 from `requests: generateRequests()` to `requests: []`
- Remove the `initMockData` function (lines 214)
- Remove `initMockData: () => void` from the interface (line 86)

### 7. Update Dashboard Modal Mock Data Comments

In the following files, change the mock data arrays to empty arrays and add proper data fetching:

**`/src/app/modules/dashboard/components/modals/QuickCheckOutModal.tsx` Line 20:**
```typescript
// REPLACE:
const checkedInPets = [
  { id: '1', name: 'Max', householdName: 'Smith Family', isLatePickup: true },
  ...
];

// WITH:
const [checkedInPets, setCheckedInPets] = useState<any[]>([]);

// TODO: Fetch from API
useEffect(() => {
  // fetchCheckedInPets();
}, []);
```

**`/src/app/modules/dashboard/components/modals/QuickOvernightCheckInModal.tsx` Line 20:**
```typescript
// REPLACE mock array WITH empty state and TODO for API
const [reservations, setReservations] = useState<any[]>([]);
// TODO: Fetch from API
```

**`/src/app/modules/dashboard/components/modals/QuickBoutiqueSaleModal.tsx` Line 28:**
```typescript
// REPLACE products array WITH empty state and TODO for API
const [products, setProducts] = useState<any[]>([]);
// TODO: Fetch from API
```

**`/src/app/modules/dashboard/widgets/RevenueSnapshot.tsx` Line 8:**
Keep the generateData function but add a comment that this should be replaced with real API data:
```typescript
// TODO: Replace with actual revenue data from API
const generateData = (days: number) => {
```

## VERIFICATION

After completing these manual edits:

1. Run `npm run build` to ensure no import errors
2. Check the browser console for any missing import errors
3. Verify all pages load without errors
4. Confirm no "seed" or "demo" buttons appear in the UI

## NEXT STEPS

After cleanup is verified:
1. Implement Supabase connectivity validation in System > Diagnostics
2. Test empty states show proper CTAs
3. Verify all data persists to and loads from Supabase correctly
