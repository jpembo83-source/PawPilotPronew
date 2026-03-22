# Route & API Audit Log
**Started:** 2026-02-07 08:44 UTC
**Status:** In Progress

## Audit Scope
1. Backend route path mismatches (like the customers/export issue)
2. Frontend API calls not matching backend routes
3. Missing error handling
4. Auth header inconsistencies
5. Tenant isolation gaps

## Findings

### Issue #1: Customers Export/Import Routes ✅ FIXED
- **Problem:** Routes defined as `/customers/export` but mounted at `/customers`, creating `/customers/customers/export`
- **Fix:** Changed to `/export`, `/import`, `/import/template`
- **Status:** Fixed and deployed

---
*Audit in progress...*

### Issue #2: Missing Tenant Isolation ⚠️ IDENTIFIED
Multiple backend routes lack tenant isolation in KV keys:

| File | KV Calls | Tenant Refs | Priority |
|------|----------|-------------|----------|
| billing_routes.tsx | 45 | 1 | Medium (complex) |
| incidents_routes.tsx | 39 | 0 | Medium |
| policies_routes.tsx | 39 | 0 | Medium |
| pricing_approvals_routes.tsx | 44 | 0 | Low |
| pricing_routes.tsx | 34 | 0 | Low |
| reorder_routes.tsx | 6 | 0 | Low |
| app_routes.tsx | 11 | 0 | Low |

**Note:** These files need tenant-prefixed KV keys (e.g., `${tenantId}:invoice:` instead of `invoice:`). This is a data isolation issue but lower priority for MVP since currently single-tenant.

---

### Issue #3: Missing X-User-Token in API Modules ✅ FIXED
Multiple frontend API modules were missing the `X-User-Token` header, which would cause 401 authentication errors.

**Files fixed:**
- `billing-finance-settings/api.ts` ✅
- `integrations-settings/api.ts` ✅
- `communications-settings/api.ts` ✅
- `data-compliance/api.ts` ✅
- `system/api.ts` ✅
- `services-pricing/store.ts` ✅
- `services-pricing/stores/approvals-store.ts` ✅

**Fix:** Added dynamic `getAuthHeaders()` function that fetches the current session token instead of using a static headers object.

---

### Issue #4: Safe API Utilities Created ✅
Created `/src/app/utils/api.ts` with helpers for safe JSON parsing:
- `parseErrorResponse()` - Safely parses error responses (handles non-JSON)
- `safeParseJson()` - Safely parses JSON with error handling
- `safeFetch()` - Wrapper for fetch with consistent error handling

---

## Summary of Changes

| Category | Count | Status |
|----------|-------|--------|
| Route path fixes | 3 | ✅ Fixed |
| Missing auth headers | 7 files | ✅ Fixed |
| Tenant isolation gaps | 7 files | ⚠️ Identified (lower priority) |
| JSON parsing improvements | 1 utility | ✅ Created |

---

**Audit completed:** 2026-02-07 09:44 UTC
