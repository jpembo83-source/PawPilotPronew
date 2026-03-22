# Pricing System - Pre-Launch Checklist

## ✅ Backend Integration

### Server Routes
- [x] Pricing routes imported in `/supabase/functions/server/index.tsx`
- [x] Routes mounted at `/make-server-fc003b23/pricing`
- [x] CORS enabled for all pricing endpoints
- [x] Error logging configured

### API Endpoints
Test each endpoint is responding:

```bash
# Health check
curl https://{projectId}.supabase.co/functions/v1/make-server-fc003b23/health

# Get services (should return empty array initially)
curl -H "Authorization: Bearer {publicAnonKey}" \
  https://{projectId}.supabase.co/functions/v1/make-server-fc003b23/pricing/services
```

---

## ✅ Frontend Store

### Zustand Store Configuration
- [x] API URL correctly constructed with projectId
- [x] Authorization headers include publicAnonKey
- [x] All CRUD methods implemented for:
  - [x] Services
  - [x] Price Books
  - [x] Price Book Entries
  - [x] Location Overrides
  - [x] Memberships
  - [x] Packages
- [x] Utility methods working:
  - [x] `getServicePrice()`
  - [x] `getActivePriceBook()`

---

## ✅ UI Components

### Service Catalogue
- [x] Module filter working
- [x] Services grouped by module
- [x] Create service dialog functional
- [x] Edit service dialog functional
- [x] Delete service confirmation
- [x] Service type dropdown populated correctly
- [x] Icons displayed (Dog, Scissors, ShoppingBag, Car)

### Price Books
- [x] List view shows all price books
- [x] Status badges (draft/active/archived)
- [x] Create price book dialog
- [x] Edit price book dialog
- [x] Delete confirmation
- [x] Price book entries dialog opens
- [x] Can add/edit/delete entries
- [x] Service dropdown shows active services

### Memberships & Packages
- [x] Tabs switch between memberships and packages
- [x] Create membership dialog
- [x] Create package dialog
- [x] Included credits/services display
- [x] Edit and delete functionality

### Pricing Audit Log
- [x] Displays all pricing changes
- [x] Action icons display correctly
- [x] Color-coded action badges
- [x] Timestamp formatting
- [x] Scrollable table

### Seed Data Button
- [x] Button visible on Services & Pricing page
- [x] Seed confirmation dialog
- [x] Clear data confirmation dialog
- [x] Loading states work
- [x] Success/error toasts display

---

## ✅ Data Integrity

### Service Creation
Test creating a service in each module:
- [ ] Daycare service created successfully
- [ ] Grooming service created successfully
- [ ] Boutique service created successfully
- [ ] Transport service created successfully

### Price Book Flow
- [ ] Create price book (draft status)
- [ ] Add price entries to book
- [ ] Activate price book
- [ ] Verify only one active book per location
- [ ] Test future-dated price book

### Location Overrides
- [ ] Create a test location
- [ ] Apply price override for a service
- [ ] Verify base price vs override price display
- [ ] Check difference calculation
- [ ] Test reason field in audit log

### Memberships
- [ ] Create membership with included credits
- [ ] Verify overage pricing calculation
- [ ] Test pause rules text
- [ ] Check monthly price display

### Packages
- [ ] Create package with multiple services
- [ ] Set expiry date
- [ ] Toggle refundable status
- [ ] Verify price display

---

## ✅ Integration Tests

### Price Resolution
```typescript
// Test in browser console after seeding data:

const store = usePricingStore.getState();

// 1. Get base price
const basePrice = store.getServicePrice(serviceId);
console.log('Base price:', basePrice);

// 2. Get price with location
const locationPrice = store.getServicePrice(serviceId, locationId);
console.log('Location price:', locationPrice);

// 3. Check for active price book
const activePriceBook = store.getActivePriceBook();
console.log('Active price book:', activePriceBook);
```

### Audit Trail
After making changes, verify audit log:
- [ ] Create action logged
- [ ] Update action logged
- [ ] Delete action logged
- [ ] Timestamp accurate
- [ ] Details descriptive

---

## ✅ Error Handling

### Network Errors
- [ ] Toast notifications on API failures
- [ ] Console logs include error details
- [ ] UI doesn't crash on error
- [ ] Loading states reset after error

### Validation
- [ ] Required fields enforced
- [ ] Number inputs validated
- [ ] Negative prices prevented
- [ ] Empty names prevented

### Confirmations
- [ ] Delete confirmations prevent accidents
- [ ] Confirmation dialogs are clear
- [ ] Cancel buttons work

---

## ✅ User Experience

### Visual Feedback
- [ ] Loading spinners show during operations
- [ ] Success toasts after create/update/delete
- [ ] Error toasts with helpful messages
- [ ] Disabled states during loading

### Navigation
- [ ] Tabs switch smoothly
- [ ] Dialogs open and close properly
- [ ] Table rows clickable where appropriate
- [ ] Buttons have clear labels

### Responsiveness
- [ ] Tables scroll on small screens
- [ ] Dialogs fit on mobile
- [ ] Buttons accessible on touch devices

---

## ✅ Performance

### Data Loading
- [ ] Services load on page mount
- [ ] Price books load on page mount
- [ ] Location overrides load when location selected
- [ ] Audit log loads only on Audit tab

### Optimization
- [ ] No unnecessary re-fetches
- [ ] State updates are batched
- [ ] Large lists paginated or virtualized (if needed)

---

## ✅ Security & Governance

### Permissions (Future)
- [ ] Admin can create services
- [ ] Manager can view services
- [ ] Staff can only view resolved prices

### Audit Compliance
- [ ] All changes tracked
- [ ] User attribution working
- [ ] Timestamps accurate
- [ ] Cannot delete audit entries

---

## 🚀 Launch Sequence

### Step 1: Seed Sample Data
1. Navigate to Settings → Services & Pricing
2. Click "Seed Sample Data"
3. Verify 17 services created
4. Verify 1 price book created
5. Verify 3 memberships created
6. Verify 3 packages created

### Step 2: Test Each Tab
1. **Service Catalogue Tab:**
   - Filter by each module
   - Edit a service
   - Verify changes saved

2. **Price Books Tab:**
   - Open price entries (£ icon)
   - Edit a price entry
   - Verify change in audit log

3. **Memberships & Packages Tab:**
   - Switch between tabs
   - Edit a membership
   - Edit a package

4. **Audit Log Tab:**
   - Verify all your changes are logged
   - Check timestamps are recent
   - Verify action types correct

### Step 3: Location Override Test
1. Go to Settings → Locations
2. Create or select a location
3. In Location Settings, apply a price override
4. Verify base vs override prices display
5. Check audit log for override creation

### Step 4: Integration Test
1. Navigate to a booking/scheduling page
2. Select a service
3. Verify price displays correctly
4. If location-aware, check location price applies

---

## 🐛 Known Issues & Fixes

### Issue: "Cannot read property 'map' of undefined"
**Cause:** State not initialized
**Fix:** Ensure fetchServices() is called before rendering

### Issue: Price book entries not showing
**Cause:** Not fetched for the specific book
**Fix:** Call fetchPriceBookEntries(bookId) when opening entries dialog

### Issue: Audit log shows "system" as user
**Cause:** No user context passed to backend
**Fix:** In future, pass actual userId from auth context

### Issue: Icons not displaying
**Cause:** lucide-react import issue
**Fix:** Verified all icons exist in lucide-react v0.487.0

---

## 📊 Success Metrics

After launch, track:
- [ ] Number of services created
- [ ] Number of active price books
- [ ] Percentage of locations with overrides
- [ ] Membership signup rate
- [ ] Package purchase rate
- [ ] Audit log entries per day

---

## 📞 Rollback Plan

If critical issues arise:

1. **Disable New Pricing Features:**
   - Comment out pricing routes in backend
   - Hide pricing UI components
   - Revert to previous pricing logic

2. **Data Backup:**
   - Export all pricing data via API
   - Store in safe location
   - Document state for restoration

3. **Communication:**
   - Notify team of rollback
   - Document issues encountered
   - Plan fix and redeployment

---

## ✅ Final Checklist

Before going live:

- [ ] All backend routes tested
- [ ] All UI components functional
- [ ] Seed data successfully creates sample data
- [ ] Clear data successfully removes all data
- [ ] Audit log tracking all changes
- [ ] Error handling working
- [ ] Success/error toasts displaying
- [ ] Location overrides functional
- [ ] Integration with booking system tested
- [ ] Team trained on new features
- [ ] Documentation shared with team
- [ ] Rollback plan documented

---

## 🎉 You're Ready!

Once all items are checked, your pricing system is production-ready.

**First Action:** Click "Seed Sample Data" to populate your system with realistic test data.

**Remember:** This is a governance-critical system. Always verify changes in a test environment first.

---

*Checklist Version: 1.0.0*
*Last Updated: December 28, 2025*
