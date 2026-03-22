# Seed/Demo Data Removal - Completion Summary

## Files Deleted ✅
1. `/src/app/modules/customers/components/SeedCustomersButton.tsx`
2. `/src/app/modules/settings/components/pricing/SeedDataButton.tsx`
3. `/src/app/modules/settings/components/locations/SeedLocationsButton.tsx`
4. `/src/app/modules/services-pricing/components/SeedPricingButton.tsx`
5. `/src/app/modules/pricing/seed-data.ts`
6. `/src/app/modules/settings/utils/seedLocations.ts`
7. `/supabase/functions/server/seed_pricing.tsx`

## Backend Routes Removed ✅
- Removed `/pricing/seed` POST route from `/supabase/functions/server/pricing_routes.tsx`

## Files Requiring Manual Update (import/button removal)
Due to the automated tool constraints, the following files still contain seed button imports/usage that need manual removal:

### Frontend Pages
1. `/src/app/modules/customers/pages/CustomersPage.tsx`
   - Line 6: Remove `import { SeedCustomersButton } from '../components/SeedCustomersButton';`
   - Line 242: Remove `<SeedCustomersButton />` button

2. `/src/app/modules/settings/pages/LocationSettings.tsx`
   - Line 6: Remove `import { SeedLocationsButton } from '../components/locations/SeedLocationsButton';`
   - Line 127: Remove `<SeedLocationsButton />` button

3. `/src/app/modules/settings/pages/ServicesAndPricing.tsx`
   - Line 8: Remove `import { SeedDataButton } from '../components/pricing/SeedDataButton';`
   - Line 44: Remove `<SeedDataButton />` button

4. `/src/app/modules/services-pricing/pages/ServicesPricingPage.tsx`
   - Line 4: Remove `import { SeedPricingButton } from '../components/SeedPricingButton';`
   - Line 96: Remove conditional `{!hasData && <SeedPricingButton />}` button

5. `/src/app/modules/services-pricing/index.ts`
   - Line 4: Remove `export { SeedPricingButton } from './components/SeedPricingButton';`

### Empty State Messages to Update
6. `/src/app/modules/services-pricing/pages/tabs/ServicesTab.tsx`
   - Line 59: Change "Seed pricing data to create the service catalogue" to "Create a service to begin"

7. `/src/app/modules/services-pricing/pages/tabs/PriceBooksTab.tsx`
   - Line 25: Change "Seed pricing data to create the baseline price book" to "Create a price book to begin"

8. `/src/app/modules/services-pricing/pages/tabs/MembershipsTab.tsx`
   - Line 16: Change "Seed pricing data to create membership plans" to "Create a membership plan to begin"

## Additional Cleanup Needed
- Transport store mock data
- Dashboard modals mock data
- Messaging templates (verify not auto-seeded)

## Supabase Connectivity Validation
- Needs to be implemented in System > Diagnostics page
