# Dashboard Widget Audit

**Date:** 2026-02-07  
**Status:** Audit Complete

---

## Summary

| Status | Count |
|--------|-------|
| ✅ Fully Functional | 7 widgets |
| ⚠️ Placeholder/Stub | 8 widgets |
| 🔄 Duplicate | 0 (none - both dog widgets serve different purposes) |

---

## Widget Status Detail

### ✅ FULLY FUNCTIONAL (7)

| Widget ID | Name | Description | Data Source |
|-----------|------|-------------|-------------|
| `quick_links` | Quick Links | Fast actions (check-in, book, etc.) | Modals with backend calls |
| `todays_dogs` | Today's Dogs | Dogs currently ON SITE with quick checkout | Daycare store (real-time) |
| `todays_daycare_dogs` | Today's Daycare Dogs | Full list with search, filters, status | Daycare store |
| `weekly_activity` | Weekly Activity | Bar chart of bookings this week | Daycare store |
| `occupancy` | Live Occupancy | Real-time capacity vs check-ins | Attendance + Locations |
| `driver_status` | Transport | Today's transport jobs | Transport store |
| `documents` | Alerts & Flags | Vaccination, waiver, behaviour alerts | Daycare bookings |

### ⚠️ PLACEHOLDER / NOT FUNCTIONAL (8)

| Widget ID | Name | Issue | Recommendation |
|-----------|------|-------|----------------|
| `revenue` | Revenue Snapshot | Uses fake data, TODO comments | **REMOVE** until billing backend exists |
| `communications` | Communications | "Coming soon" message | **REMOVE** until messaging implemented |
| `ops_summary` | Today's Operations | PlaceholderWidget | **REMOVE** - overlaps with other widgets |
| `capacity_risk` | Capacity & Risk | PlaceholderWidget | **REMOVE** until forecasting exists |
| `memberships` | Memberships | PlaceholderWidget | **REMOVE** until memberships module |
| `incidents` | Incidents | PlaceholderWidget | **REMOVE** until incidents backend |
| `no_shows` | No-Shows | PlaceholderWidget | **REMOVE** for now |
| `staff` | Staff Coverage | PlaceholderWidget | **REMOVE** until staff scheduling |

---

## Quick Action Modals Status

### ✅ Functional Modals
| Modal | Status | Notes |
|-------|--------|-------|
| QuickCheckInModal | ✅ Works | Full validation, warnings, handover notes |
| QuickCheckOutModal | ✅ Works | With time selection |
| QuickBookModal | ✅ Works | Customer search, pet selection, booking |
| QuickTransportModal | ✅ Works | Creates transport jobs |

### ⚠️ Placeholder Modals
| Modal | Status | Notes |
|-------|--------|-------|
| QuickMessageModal | ⚠️ Stub | Messaging not implemented |
| QuickIncidentModal | ⚠️ Stub | "Coming soon" message |
| QuickDocumentModal | ⚠️ Stub | Document upload not implemented |
| QuickOvernightCheckInModal | ⚠️ Stub | "Coming soon" message |
| QuickBoutiqueSaleModal | ⚠️ Stub | Boutique not implemented |

---

## Duplicate Analysis

### `todays_dogs` vs `todays_daycare_dogs`

**NOT duplicates** - they serve different purposes:

| Widget | Purpose | Size | Use Case |
|--------|---------|------|----------|
| `todays_dogs` | Quick glance at who's HERE NOW | Medium | Receptionist quick check |
| `todays_daycare_dogs` | Full management list | Large | Full day management |

**Recommendation:** Keep both. They're complementary.

---

## Missing Widgets (Recommended Additions)

### Priority 1 - Should Add

| Widget | Description | Why Needed |
|--------|-------------|------------|
| `grooming_today` | Today's grooming appointments | Grooming is a core module |
| `overnights_today` | Current overnight guests | Overnights is a core module |

### Priority 2 - Nice to Have

| Widget | Description | Why Useful |
|--------|-------------|------------|
| `upcoming_pickups` | Dogs due for pickup in next 2 hours | Helps staff prepare |
| `late_arrivals` | Expected dogs not yet checked in | Reduces no-shows |

---

## Recommended Changes

### Remove These Widgets (8)

```typescript
// Remove from constants.ts WIDGETS array:
- 'ops_summary'      // Redundant with other widgets
- 'capacity_risk'    // No backend
- 'revenue'          // Fake data
- 'memberships'      // No backend
- 'communications'   // No backend
- 'incidents'        // No backend
- 'no_shows'         // No backend  
- 'staff'            // No backend
```

### Keep These Widgets (7)

```typescript
// Keep in constants.ts:
- 'quick_links'
- 'todays_dogs'
- 'todays_daycare_dogs'
- 'weekly_activity'
- 'occupancy'
- 'driver_status'
- 'documents'
```

### Add These Widgets (2)

```typescript
// Add to constants.ts:
{
  id: 'grooming_today',
  title: "Today's Grooming",
  description: 'Grooming appointments for today',
  icon: Scissors,
  defaultSize: 'medium',
  category: 'operational'
},
{
  id: 'overnights_today',
  title: "Overnight Guests",
  description: 'Current and expected overnight boarders',
  icon: Moon,
  defaultSize: 'medium',
  category: 'operational'
}
```

### Update Quick Links

Remove non-functional quick actions:
- ❌ `message` - Messaging not implemented
- ❌ `incident` - Incidents not implemented
- ❌ `document` - Document upload not implemented
- ❌ `boutique` - Boutique not implemented

Keep only functional actions:
- ✅ `check-in`
- ✅ `book`
- ✅ `transport`
- ✅ `check-out`
- ✅ `overnight-checkin` (if we build the modal)

---

## Final Widget Configuration

### After Cleanup

```typescript
export const WIDGETS: WidgetDefinition[] = [
  { id: 'quick_links', title: 'Quick Links', ... },
  { id: 'todays_dogs', title: "Today's Dogs", ... },
  { id: 'weekly_activity', title: 'Weekly Activity', ... },
  { id: 'todays_daycare_dogs', title: "Today's Daycare Dogs", ... },
  { id: 'occupancy', title: 'Live Occupancy', ... },
  { id: 'documents', title: 'Alerts & Flags', ... },
  { id: 'driver_status', title: 'Transport', ... },
  { id: 'grooming_today', title: "Today's Grooming", ... },  // NEW
  { id: 'overnights_today', title: 'Overnight Guests', ... }, // NEW
];

export const DEFAULT_WIDGETS_BY_ROLE: Record<string, string[]> = {
  admin: WIDGETS.map(w => w.id),
  manager: ['quick_links', 'todays_dogs', 'weekly_activity', 'todays_daycare_dogs', 'occupancy', 'documents', 'driver_status', 'grooming_today', 'overnights_today'],
  staff: ['quick_links', 'todays_dogs', 'weekly_activity', 'occupancy', 'documents', 'driver_status']
};
```

---

## Implementation Priority

1. **Now:** Remove placeholder widgets and broken quick actions
2. **Now:** Add `grooming_today` widget (we have the backend)
3. **Now:** Add `overnights_today` widget (we have the backend)
4. **Later:** Re-add other widgets when their backends are ready
