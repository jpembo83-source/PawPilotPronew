# Settings RBAC Implementation

## Overview

This document describes the comprehensive Role-Based Access Control (RBAC) implementation for the Settings menu in the MDC Operations Centre.

## Governance Principles

### Core Ownership Model

- **Admins own:** System integrity, compliance, financial risk, and platform-wide behaviour
- **Managers own:** People, locations, pricing, and day-to-day operational execution  
- **Managers must never:** Break compliance, alter financial system rules, or affect system-wide stability

## Architecture

### Frontend Components

1. **Permission Types** (`/types/permissions.ts`)
   - Complete access control matrix for all settings sections
   - Role-specific permissions (Admin, Manager, Assistant Manager, Staff)
   - Scope qualifiers (all, assigned, operational, none)
   - Risk level classification

2. **RBAC Utilities** (`/utils/rbac.ts`)
   - `hasSettingsPermission()` - Check user permissions
   - `getAccessibleSections()` - Get sections user can view
   - `getSectionAccess()` - Get detailed access info
   - `canManageUser()` - Check user management permissions
   - `filterLocationsByAccess()` - Filter locations by access

3. **UI Components** (`/components/PermissionGuard.tsx`)
   - `<PermissionGuard>` - Conditionally render based on permissions
   - `<RestrictedField>` - Wrapper for restricted form fields
   - `<SectionAccessBadge>` - Show user's access level
   - `<PermissionInfo>` - Display restrictions and guidance

4. **Audit Logging** (`/components/AuditLogViewer.tsx`)
   - View all settings changes with before/after snapshots
   - Filter by role, action, section
   - Detailed change inspection

### Backend Enforcement

1. **RBAC Middleware** (`/supabase/functions/server/settings_rbac.ts`)
   - `requireAuth()` - Verify JWT and extract user
   - `requirePermission()` - Enforce permissions on routes
   - `logAudit()` - Comprehensive audit logging
   - `getAuditLogs()` - Retrieve audit history

2. **API Routes** (`/supabase/functions/server/app_routes.tsx`)
   - All settings routes protected with RBAC middleware
   - Location filtering based on user access
   - Audit logging on all mutations

## Settings Access Matrix

### 1. Organisation

| Role | View | Edit | Create | Delete | Scope |
|------|------|------|--------|--------|-------|
| Admin | ✅ | ✅ | ➖ | ➖ | All |
| Manager | ✅ | ➖ | ➖ | ➖ | None (read-only) |
| Asst. Manager | ➖ | ➖ | ➖ | ➖ | None |
| Staff | ➖ | ➖ | ➖ | ➖ | None |

**Risk Level:** Critical  
**Manager Restrictions:** Organisation settings are structural and legal, not operational

---

### 2. Modules

| Role | View | Edit | Create | Delete | Scope |
|------|------|------|--------|--------|-------|
| Admin | ✅ | ✅ | ➖ | ➖ | All |
| Manager | ✅ | ✅ | ➖ | ➖ | Assigned locations |
| Asst. Manager | ✅ | ➖ | ➖ | ➖ | Assigned locations |
| Staff | ➖ | ➖ | ➖ | ➖ | None |

**Risk Level:** High  
**Manager Restrictions:**
- Can only enable/disable modules per assigned location
- Cannot enable modules not already globally enabled by Admin

---

### 3. Locations

| Role | View | Edit | Create | Delete | Scope |
|------|------|------|--------|--------|-------|
| Admin | ✅ | ✅ | ✅ | ✅ | All |
| Manager | ✅ | ✅ | ➖ | ➖ | Assigned locations |
| Asst. Manager | ✅ | ➖ | ➖ | ➖ | Assigned locations |
| Staff | ➖ | ➖ | ➖ | ➖ | None |

**Risk Level:** High  
**Manager Restrictions:**
- Can only edit assigned locations
- Can edit: opening hours, capacity, contact details
- Cannot edit: legal fields, tax fields, location deletion

**Operational Fields (Manager can edit):**
- name, phone, email, timezone, capacity, enabledModules

**Restricted Fields (Admin only):**
- legalName, taxId, registrationNumber, address (legal)

---

### 4. Users & Access

| Role | View | Edit | Create | Delete | Scope |
|------|------|------|--------|--------|-------|
| Admin | ✅ | ✅ | ✅ | ✅ | All |
| Manager | ✅ | ✅ | ✅ | ✅ | Assigned locations |
| Asst. Manager | ✅ | ➖ | ➖ | ➖ | Assigned locations |
| Staff | ➖ | ➖ | ➖ | ➖ | None |

**Risk Level:** Critical  
**Manager Restrictions:**
- Can only create/edit Staff and Assistant Manager users
- Cannot create Admin users
- Cannot edit system roles or permission templates
- Can only manage users for assigned locations

---

### 5. Services & Pricing

| Role | View | Edit | Create | Delete | Scope |
|------|------|------|--------|--------|-------|
| Admin | ✅ | ✅ | ✅ | ✅ | All |
| Manager | ✅ | ✅ | ✅ | ✅ | All |
| Asst. Manager | ✅ | ✅ | ✅ | ➖ | All |
| Staff | ✅ | ➖ | ➖ | ➖ | None |

**Risk Level:** High  
**Manager Access:** Full - Pricing is an operational responsibility owned by Managers. Can bypass approvals as explicitly allowed.  
**Assistant Manager:** Can submit pricing changes for approval only

---

### 6. Operations Rules

| Role | View | Edit | Create | Delete | Scope |
|------|------|------|--------|--------|-------|
| Admin | ✅ | ✅ | ✅ | ✅ | All |
| Manager | ✅ | ✅ | ✅ | ➖ | Operational only |
| Asst. Manager | ✅ | ➖ | ➖ | ➖ | Operational only |
| Staff | ✅ | ➖ | ➖ | ➖ | None |

**Risk Level:** High  
**Manager Restrictions:**
- Can edit: capacity limits, booking cut-offs, pickup windows
- Cannot edit: compliance rules, billing enforcement, data protection

**Operational Categories:**
- capacity, booking-cutoffs, pickup-windows, operating-hours, service-scheduling

**Compliance Categories (Admin only):**
- vaccination-requirements, incident-reporting, data-protection, billing-enforcement, document-requirements

---

### 7. Communications

| Role | View | Edit | Create | Delete | Scope |
|------|------|------|--------|--------|-------|
| Admin | ✅ | ✅ | ✅ | ✅ | All |
| Manager | ✅ | ✅ | ✅ | ✅ | Operational |
| Asst. Manager | ✅ | ➖ | ➖ | ➖ | Operational |
| Staff | ➖ | ➖ | ➖ | ➖ | None |

**Risk Level:** Medium  
**Manager Restrictions:**
- Can create/edit message templates
- Can configure SLAs for assigned locations
- Can enable/disable approved automations
- Cannot configure channels, providers, consent rules

---

### 8. Billing & Finance

| Role | View | Edit | Create | Delete | Scope |
|------|------|------|--------|--------|-------|
| Admin | ✅ | ✅ | ✅ | ➖ | All |
| Manager | ➖ | ➖ | ➖ | ➖ | None |
| Asst. Manager | ➖ | ➖ | ➖ | ➖ | None |
| Staff | ➖ | ➖ | ➖ | ➖ | None |

**Risk Level:** Critical  
**Admin Only:** Financial system configuration is Admin-only. Billing operations handled in Billing module only.

---

### 9. Data & Compliance

| Role | View | Edit | Create | Delete | Scope |
|------|------|------|--------|--------|-------|
| Admin | ✅ | ✅ | ✅ | ➖ | All |
| Manager | ✅ | ➖ | ➖ | ➖ | None (read-only) |
| Asst. Manager | ➖ | ➖ | ➖ | ➖ | None |
| Staff | ➖ | ➖ | ➖ | ➖ | None |

**Risk Level:** Critical  
**Manager Access:** Read-only optional. Compliance must remain centralised and tightly controlled. Can initiate GDPR requests only if explicitly granted.

---

### 10. Integrations

| Role | View | Edit | Create | Delete | Scope |
|------|------|------|--------|--------|-------|
| Admin | ✅ | ✅ | ✅ | ✅ | All |
| Manager | ➖ | ➖ | ➖ | ➖ | None |
| Asst. Manager | ➖ | ➖ | ➖ | ➖ | None |
| Staff | ➖ | ➖ | ➖ | ➖ | None |

**Risk Level:** Critical  
**Admin Only:** Integrations are high-risk and system-wide

---

### 11. Dashboard Config

| Role | View | Edit | Create | Delete | Scope |
|------|------|------|--------|--------|-------|
| Admin | ✅ | ✅ | ✅ | ➖ | All |
| Manager | ✅ | ✅ | ➖ | ➖ | Assigned locations |
| Asst. Manager | ✅ | ➖ | ➖ | ➖ | Assigned locations |
| Staff | ➖ | ➖ | ➖ | ➖ | None |

**Risk Level:** Medium  
**Manager Restrictions:**
- Can configure dashboards for assigned locations
- Can control what staff see
- Cannot alter global defaults

---

### 12. System

| Role | View | Edit | Create | Delete | Scope |
|------|------|------|--------|--------|-------|
| Admin | ✅ | ✅ | ✅ | ➖ | All |
| Manager | ➖ | ➖ | ➖ | ➖ | None |
| Asst. Manager | ➖ | ➖ | ➖ | ➖ | None |
| Staff | ➖ | ➖ | ➖ | ➖ | None |

**Risk Level:** Critical  
**Admin Only:** System settings are never delegated. Includes feature flags, background jobs, security controls, maintenance mode.

---

## Enforcement Strategy

### Multi-Layer Protection

1. **UI Layer** - Components conditionally render based on permissions
2. **Navigation Layer** - Menu items filtered by role
3. **Route Layer** - React Router guards check authentication
4. **API Layer** - Server-side middleware enforces all permissions
5. **Audit Layer** - All changes logged with full context

### Server-Side Enforcement

All API routes are protected with:

```typescript
routes.put("/organisation", 
  requireAuth, 
  requirePermission('organisation', 'update'), 
  async (c) => {
    // ... implementation
  }
);
```

### Audit Logging

Every settings change is logged with:
- User ID, name, role
- Section and action
- Resource ID
- Before/after state
- Timestamp
- IP address and user agent

## Usage Examples

### Check Permission in Component

```typescript
import { hasSettingsPermission } from '../utils/rbac';

const canEdit = hasSettingsPermission(
  user.role,
  'locations',
  'update',
  {
    locationId: location.id,
    userLocationIds: user.locationIds,
  }
);
```

### Guard UI Element

```typescript
import { PermissionGuard } from '../components/PermissionGuard';

<PermissionGuard section="organisation" action="update">
  <button onClick={handleSave}>Save Changes</button>
</PermissionGuard>
```

### Restrict Form Field

```typescript
import { RestrictedField } from '../components/PermissionGuard';

<RestrictedField 
  fieldName="taxId" 
  section="locations"
  readOnlyView={<span>{location.taxId}</span>}
>
  <input name="taxId" value={location.taxId} onChange={handleChange} />
</RestrictedField>
```

## Testing Checklist

- [ ] Admin can access all sections
- [ ] Manager cannot access Billing, Integrations, System
- [ ] Manager can only edit assigned locations
- [ ] Manager cannot edit restricted location fields
- [ ] Manager cannot create Admin users
- [ ] Assistant Manager has read-only for most sections
- [ ] Staff cannot access Settings
- [ ] All mutations are audited
- [ ] Audit logs show before/after state
- [ ] API returns 403 for unauthorized actions
- [ ] UI hides unauthorized sections
- [ ] Permission checks work with location context

## Future Enhancements

1. Custom role builder for organisations
2. Granular field-level permissions
3. Time-based access controls
4. Delegation workflows
5. Approval chains for high-risk changes
6. Real-time audit alerts
7. Permission diff viewer
8. Bulk permission changes

## British English Throughout

All code, comments, and documentation use British English spelling (e.g., "Organisation" not "Organization", "Colour" not "Color").
