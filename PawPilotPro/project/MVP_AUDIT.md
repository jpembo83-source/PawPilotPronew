# MVP Audit Report: Paw Pilot Pro

**Date:** 2026-02-07  
**Purpose:** Distinguish production-ready functionality from development-only functionality and define a clean MVP scope.

---

## 1) Core Production-Critical Features

These are the **absolute minimum features** required for a dog care business to operate:

### ✅ Customer/Household Management
**Status: PRODUCTION-READY**

| Component | Status | Notes |
|-----------|--------|-------|
| Household list & search | ✅ Complete | Full filtering, search, pagination |
| Create household | ✅ Complete | Full form with validation |
| Edit household | ✅ Complete | All fields editable |
| View household details | ✅ Complete | Comprehensive detail page |
| Contact management | ✅ Complete | Add/edit/delete contacts |
| Multiple contacts per household | ✅ Complete | Primary/secondary roles |
| Notes & timeline | ✅ Complete | Activity logging functional |

**Files:** `src/app/modules/customers/`

### ✅ Pet Profiles
**Status: PRODUCTION-READY**

| Component | Status | Notes |
|-----------|--------|-------|
| Pet profile creation | ✅ Complete | Full pet data entry |
| Pet profile editing | ✅ Complete | All fields |
| Photo upload | ✅ Complete | With storage |
| Vaccination records | ✅ Complete | Document management |
| Medical notes | ✅ Complete | Flags and alerts |
| Behaviour notes | ✅ Complete | Caution flags |

**Files:** `src/app/modules/customers/pages/PetProfilePage.tsx`, `src/app/modules/customers/components/`

### ✅ Daycare Attendance/Check-in
**Status: PRODUCTION-READY**

| Component | Status | Notes |
|-----------|--------|-------|
| Dashboard with stats | ✅ Complete | Real-time metrics |
| Check-in flow | ✅ Complete | With validation & warnings |
| Check-out flow | ✅ Complete | Full process |
| Attendance tracking | ✅ Complete | Daily view |
| Booking management | ✅ Complete | Create/edit/cancel |
| Capacity tracking | ✅ Complete | Per-location |
| Vaccination validation | ✅ Complete | Blocks check-in when needed |
| Handover notes | ✅ Complete | At check-in/out |

**Files:** `src/app/modules/daycare/`

### ⚠️ Basic Billing/Invoicing
**Status: PARTIAL - MVP FUNCTIONAL**

| Component | Status | Notes |
|-----------|--------|-------|
| Invoice list view | ✅ Complete | With filtering |
| Invoice creation | ✅ Complete | Basic flow |
| Invoice overview | ✅ Complete | Dashboard stats |
| Payment recording | ❌ Placeholder | "Coming soon" message |
| Subscriptions | ❌ Placeholder | "Coming soon" message |
| Credits & Refunds | ❌ Placeholder | "Coming soon" message |
| Fees & Adjustments | ❌ Placeholder | "Coming soon" message |
| Exports | ❌ Placeholder | "Coming soon" message |

**MVP Scope:** Invoice Overview + Invoice List are functional. Other tabs can be hidden.

**Files:** `src/app/modules/billing/Billing.tsx`

### ⚠️ Messaging/Communication
**Status: PARTIAL - Framework Ready**

| Component | Status | Notes |
|-----------|--------|-------|
| Thread list UI | ✅ Complete | Full inbox interface |
| Conversation view | ✅ Complete | Message display |
| Compose modal | ✅ Complete | UI complete |
| Context panel | ✅ Complete | Customer info sidebar |
| Backend integration | ⚠️ Needs work | API stubs present |

**MVP Scope:** UI is production-quality. May need integration testing before launch.

**Files:** `src/app/modules/messaging/`

### ✅ Staff Management Basics
**Status: PRODUCTION-READY**

| Component | Status | Notes |
|-----------|--------|-------|
| Team directory | ✅ Complete | List all staff |
| Staff profiles | ✅ Complete | Edit profiles |
| Role management | ✅ Complete | RBAC integrated |
| Policy acknowledgements | ✅ Complete | Full compliance system |
| Rota creation | ✅ Complete | Shift scheduling |

**Files:** `src/app/modules/staff/`

---

## 2) Production-Ready but Non-Critical Features

These work but **aren't needed day one**:

### ✅ Dashboard with Widgets
**Status: PRODUCTION-READY** - Can go live, nice-to-have

- Customizable widget grid
- Quick actions bar
- Policies alert banner
- Dog details panel
- Real-time stats

### ✅ Grooming Module
**Status: PRODUCTION-READY** - Full salon management

- Appointments dashboard
- Queue management
- Groomer assignments
- Service types

### ✅ Transportation Module
**Status: PRODUCTION-READY** - Full transport ops

- Jobs management
- Route planning
- Vehicle management
- Driver dashboard

### ✅ Incidents Module
**Status: PRODUCTION-READY** - Full incident tracking

- Create incidents
- Severity/category tracking
- Audit trail
- Export functionality

### ✅ Policies Portal
**Status: PRODUCTION-READY** - Staff compliance

- Policy management (manager view)
- Policy acknowledgements (staff view)
- Compliance reporting
- Export audit trail

### ⚠️ Packages & Memberships
**Status: MOSTLY COMPLETE**

- Package dashboard functional
- Credit packs working
- Some UI polish needed

### ⚠️ Overnights/Boarding
**Status: PARTIAL**

- Tonight's boarders view ✅
- Reservations list ✅
- Care logs view ❌ (shows "Coming soon")
- Capacity management ❌ (shows "Coming soon")

### ⚠️ Capacity Dashboard
**Status: RECENTLY ADDED**

- New module at `/capacity`
- Basic functionality present
- Needs verification

---

## 3) In Development / Incomplete

### ❌ Billing Module - Incomplete Tabs

**Location:** `src/app/modules/billing/Billing.tsx`

| Tab | Status | Line |
|-----|--------|------|
| Payments | ❌ Placeholder | L78-89 |
| Subscriptions | ❌ Placeholder | L90-101 |
| Credits & Refunds | ❌ Placeholder | L102-113 |
| Fees & Adjustments | ❌ Placeholder | L114-125 |
| Exports | ❌ Placeholder | L126-137 |
| Settings | ❌ Placeholder | L138-148 |

### ❌ Overnights Module - Incomplete Tabs

**Location:** `src/app/modules/overnights/pages/OvernightsPage.tsx`

| View | Status | Line |
|------|--------|------|
| Care Logs | ❌ "Coming soon" | L313 |
| Capacity Management | ❌ "Coming soon" | L322 |

### ❌ Dashboard Quick Action Modals

**Location:** `src/app/modules/dashboard/components/modals/`

| Modal | Status |
|-------|--------|
| QuickDocumentModal.tsx | ❌ "Coming soon" |
| QuickBoutiqueSaleModal.tsx | ❌ "Coming soon" |
| QuickTransportModal.tsx | ❌ "Coming soon" |
| QuickOvernightCheckInModal.tsx | ❌ "Coming soon" |
| QuickIncidentModal.tsx | ❌ "Coming soon" |

### ❌ Communications Settings - Incomplete Modals

**Location:** `src/app/modules/communications-settings/components/modals/`

| Modal | Status |
|-------|--------|
| TemplateBuilderDialog.tsx | ❌ "Coming soon" |
| SLADialog.tsx | ❌ "Coming soon" |
| AutomationRuleDialog.tsx | ❌ "Coming soon" |

### ❌ Boutique Module
**Status: COMPLETELY PLACEHOLDER**

- Route exists: `/boutique`
- Shows: `<PlaceholderModule title="Boutique & POS" />`
- No functionality

**Location:** `src/app/App.tsx:101`

---

## 4) Dev-Only / Internal / Remove for Production

### 🔴 Debug Routes (MUST REMOVE)

| Route | Component | Purpose |
|-------|-----------|---------|
| `/debug-kv` | KVDebug | KV store inspection |
| `/debug-customer` | CustomerDebug | Customer data diagnostics |

**Files to modify:**
- `src/app/App.tsx` - Lines 37-38 (imports), 118-119 (routes)
- `src/app/debug/KVDebug.tsx` - DELETE or move to dev-only
- `src/app/debug/CustomerDebug.tsx` - DELETE or move to dev-only

### 🔴 Seed Data Buttons (MUST REMOVE/HIDE)

| Location | Component | Button Text |
|----------|-----------|-------------|
| Billing → Invoices | Invoices.tsx:76 | "Seed Data" |
| Settings → Integrations | IntegrationsSettingsPage.tsx:56 | "Seed Data" |
| Settings → System | SystemPage.tsx:81 | "Seed Data" |
| Settings → Data Compliance | DataCompliancePage.tsx:42 | "Seed Data" |
| View As Management | ViewAsManagement.tsx:73 | "Seed Data" |

### 🔴 Debug Endpoints (Backend)

**Location:** `supabase/functions/server/index.tsx`

| Endpoint | Line | Purpose |
|----------|------|---------|
| `/debug-users` | ~175 | List KV user profiles |
| `/debug-auth-users` | ~195 | Compare Auth vs KV |
| `/sync-users` | ~225 | Sync user profiles |
| `/test-auth` | ~275 | JWT validation test |
| `/seed-admin` | ~375 | Create admin user |
| `/test-post` | ~125 | Test endpoint |
| `/check-env` | ~145 | Environment check |

**Location:** `supabase/functions/server/customers_routes.tsx`

| Endpoint | Line | Purpose |
|----------|------|---------|
| `/debug/kv-keys` | 2475 | KV inspection |
| `/debug/all-customers` | 2541 | List all data |
| `/debug/delete-all` | 2571 | Delete all data |

### 🔴 Clear Data Page (DANGEROUS)

- **Route:** `/customers/clear-data`
- **Component:** `ClearDataPage.tsx`
- **Risk:** Deletes all timeline data
- **Action:** REMOVE from routes, hide from UI

### 🔴 Seed Data Backend Endpoints

| Route | File |
|-------|------|
| `/billing-finance/seed` | billing_finance_settings.ts:789 |
| `/integrations/seed` | integrations_settings.ts:510 |
| `/view-as/seed` | view_as.ts:219 |
| `/data-compliance/seed` | data_compliance.ts:516 |
| `/system/seed` | system.ts:554 |

### 🟡 Console.log Statements (158 total)

Files with console.log that should be cleaned up:
```
src/app/debug/CustomerDebug.tsx
src/app/debug/KVDebug.tsx
src/app/modules/dashboard/components/modals/PhotoUploadModal.tsx
src/app/modules/dashboard/components/modals/QuickNoteModal.tsx
src/app/modules/customers/pages/CustomersPage.tsx
src/app/modules/customers/pages/HouseholdDetailPage.tsx
src/app/modules/customers/components/DocumentManager.tsx
src/app/modules/transport/pages/RoutePlanner.tsx
src/app/modules/transport/pages/JobDetail.tsx
src/app/modules/transport/pages/VehicleManager.tsx
src/app/modules/daycare/pages/DaycareCheckIn.tsx
src/app/modules/staff/pages/StaffPage.tsx
src/app/modules/policies/pages/PoliciesManagementPage.tsx
```

### 🟡 Hardcoded Location IDs

Files with hardcoded `loc_main`, `loc_north`, `loc_south`:
- `src/app/modules/customers/pages/ExportPage.tsx`
- `src/app/modules/staff/pages/RotasTab.tsx`

**Action:** Replace with dynamic location lookup from settings store

### 🟡 UAT Seed Panel

**Location:** `src/app/modules/system/components/UATSeedPanel.tsx`
- Provides bulk test data seeding
- Should be behind feature flag or removed

---

## 5) MVP Navigation Proposal

### Recommended Sidebar for MVP

```
CORE (Always visible):
├── Dashboard
├── Customers
├── Messages
├── Billing (Overview + Invoices only)
├── Staff
├── Incidents
└── Settings (for managers/admins)

OPTIONAL MODULES (enable per business):
├── Daycare ← RECOMMENDED FOR LAUNCH
├── Grooming
├── Transport
├── Overnights (hide incomplete tabs)
└── Packages

HIDE FROM MVP:
├── Boutique (placeholder only)
├── Capacity (verify first)
└── Policies (move to Staff tab)
```

### Sidebar Configuration Changes

**File:** `src/app/modules/settings/constants/modules.ts`

Current core modules are good. Consider:
1. Move Capacity to optional (needs verification)
2. Remove Boutique from available modules until built
3. Policies can stay as staff-facing feature

### What to Hide in Billing

Only show these tabs:
- Overview ✅
- Invoices ✅

Hide:
- Payments (placeholder)
- Subscriptions (placeholder)
- Credits (placeholder)
- Fees (placeholder)
- Exports (placeholder)
- Settings (redirect to Settings → Billing & Finance)

---

## 6) Immediate Actions

### Priority 1: Remove Debug/Dev Routes (Before Any User Testing)

```bash
# 1. Remove debug route imports from App.tsx
# Lines 37-38:
import { KVDebug } from './debug/KVDebug';
import { CustomerDebug } from './debug/CustomerDebug';

# Lines 118-119:
<Route path="debug-kv" element={<KVDebug />} />
<Route path="debug-customer" element={<CustomerDebug />} />

# 2. Remove or archive debug folder
mv src/app/debug src/app/debug.bak
```

### Priority 2: Hide Clear Data Page

```typescript
// In src/app/App.tsx, remove or comment out:
// Line ~109:
<Route path="customers/clear-data" element={<ClearDataPage />} />

// Also remove from src/app/modules/customers/index.ts export
```

### Priority 3: Add Feature Flag for Seed Buttons

```typescript
// Create src/app/config/featureFlags.ts
export const FEATURE_FLAGS = {
  SHOW_DEV_TOOLS: process.env.NODE_ENV === 'development',
  SHOW_SEED_BUTTONS: process.env.NODE_ENV === 'development',
  ENABLE_BOUTIQUE: false,
  ENABLE_CAPACITY_MODULE: false, // Until verified
};
```

Then wrap seed buttons:
```typescript
{FEATURE_FLAGS.SHOW_SEED_BUTTONS && (
  <Button onClick={seedData}>Seed Data</Button>
)}
```

### Priority 4: Hide Incomplete Billing Tabs

```typescript
// In src/app/modules/billing/Billing.tsx
// Modify tabs array to only show MVP-ready tabs:
const tabs = [
  { id: 'overview' as const, label: 'Overview', icon: LayoutDashboard },
  { id: 'invoices' as const, label: 'Invoices', icon: FileText },
  // Comment out or remove:
  // { id: 'payments' as const, ... },
  // { id: 'subscriptions' as const, ... },
  // etc.
];
```

### Priority 5: Hide Incomplete Overnights Tabs

```typescript
// In src/app/modules/overnights/pages/OvernightsPage.tsx
// Hide tabs that show "Coming soon":
// - Care Logs tab
// - Capacity tab
```

### Priority 6: Remove Boutique Route

```typescript
// In src/app/App.tsx, comment out:
// Line 101:
<Route path="boutique" element={<PlaceholderModule title="Boutique & POS" />} />

// Also update modules.ts to not include boutique in nav
```

### Priority 7: Clean Console Logs (Lower Priority)

Run before production:
```bash
# Find all console.log statements
grep -rn "console.log" src --include="*.tsx" --include="*.ts" > console_logs.txt

# Review and remove non-essential ones
# Keep error logging, remove debug logging
```

---

## Summary

| Category | Count | Action |
|----------|-------|--------|
| Debug routes to remove | 2 | IMMEDIATE |
| Seed buttons to hide | 6 | IMMEDIATE |
| Debug endpoints to remove | 10+ | BEFORE PRODUCTION |
| Placeholder modules to hide | 1 (Boutique) | IMMEDIATE |
| Incomplete tabs to hide | 8 | IMMEDIATE |
| Console.logs to clean | 158 | BEFORE PRODUCTION |
| Hardcoded values to fix | 2 files | LOW PRIORITY |

### MVP Launch Readiness

✅ **Ready for MVP:**
- Customer Management
- Pet Profiles
- Daycare (full)
- Staff Management
- Dashboard
- Grooming
- Transportation
- Incidents
- Basic Billing (Overview + Invoices)

⚠️ **Needs Work Before MVP:**
- Messaging (verify integration)
- Packages (verify completeness)
- Overnights (hide incomplete tabs)

❌ **Not Ready:**
- Boutique (placeholder only)
- Billing advanced features (6 placeholder tabs)
- Various "Coming soon" modals

---

*Report generated by MVP Audit Subagent*
