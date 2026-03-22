# RBAC (Role-Based Access Control) System

This document describes the permission system implemented in Paw Pilot Pro.

## Overview

The RBAC system provides granular control over what users can see and do in the application. It consists of:

1. **Roles** - Base access levels (Admin, Manager, Assistant Manager, Staff)
2. **Permission Templates** - Reusable sets of module permissions
3. **User Permissions** - Per-user overrides (optional)

## Permission Resolution Order

When checking if a user has permission, the system resolves in this order:

1. **Admin Bypass** - Admins always have full access
2. **User Overrides** - Direct permissions on the user object
3. **Template Permissions** - Permissions from assigned template
4. **Role Defaults** - Fallback permissions based on role

## Roles

### Admin
- Full system access across all locations
- Can manage all users, templates, and settings
- Cannot be restricted by templates

### Manager  
- Operational access to assigned locations
- Can manage Staff and Assistant Managers
- Can be restricted by templates

### Assistant Manager
- Similar to Manager but no delete permissions
- Cannot manage other users
- Can be restricted by templates

### Staff
- Basic operational access
- No settings or user management
- Fully defined by templates

## Permission Templates

Templates define module-level permissions with these actions:

| Action | Description |
|--------|-------------|
| `view` | Can see records |
| `create` | Can create new records |
| `update` | Can modify existing records |
| `delete` | Can remove records |
| `export` | Can export data |
| `approve` | Can approve actions (refunds, etc.) |

### System Templates

The system includes built-in templates:

- **Daycare Handler** - Check-in/out, view customers
- **Groomer** - Grooming appointments
- **Driver** - Transport routes only
- **Front Desk** - Full operational access
- **Finance Viewer** - Read-only billing access

Admins can edit system templates. Changes affect all users assigned to that template.

### Creating Custom Templates

1. Navigate to Settings → Users & Access → Roles & Templates
2. Click "New Template"
3. Name and describe the template
4. Select permissions in the matrix
5. Save

## Using Permissions in Code

### Check Single Permission

```tsx
import { usePermissions } from '../hooks/usePermissions';

function MyComponent() {
  const { hasPermission } = usePermissions();
  
  const canCreate = hasPermission('billing', 'create');
  
  return canCreate ? <CreateButton /> : null;
}
```

### Check Module Access

```tsx
const { canAccessModule } = usePermissions();

if (canAccessModule('billing')) {
  // User can see billing module
}
```

### Permission Gate Components

```tsx
import { PermissionGate, ModuleGate, AdminOnly } from '../components/PermissionGate';

// Gate single action
<PermissionGate module="invoices" action="delete">
  <DeleteInvoiceButton />
</PermissionGate>

// Gate entire module
<ModuleGate module="billing" showDeniedMessage>
  <BillingPage />
</ModuleGate>

// Admin-only content
<AdminOnly>
  <SystemSettings />
</AdminOnly>
```

### Check Multiple Permissions

```tsx
const { hasAllPermissions } = usePermissions();

const canManageInvoices = hasAllPermissions([
  { module: 'invoices', action: 'view' },
  { module: 'invoices', action: 'create' },
  { module: 'payments', action: 'create' }
]);
```

## Available Modules

| Module | Description |
|--------|-------------|
| `dashboard` | Main overview |
| `calendar` | Appointments |
| `customers` | Customer records |
| `daycare` | Daycare bookings |
| `grooming` | Grooming appointments |
| `transport` | Routes |
| `boutique` | Retail |
| `billing` | Invoicing |
| `invoices` | Invoice management |
| `payments` | Payments |
| `incidents` | Incident reports |
| `documents` | Document storage |
| `messages` | Communications |
| `reports` | Analytics |
| `staff` | Staff management |
| `memberships` | Memberships |
| `packages` | Service packages |
| `settings` | Configuration |

## UI Integration

### Sidebar Navigation

The sidebar automatically filters navigation items based on permissions. Users only see modules they can access.

### Action Buttons

Action buttons (Create, Edit, Delete) should check permissions:

```tsx
{canCreate ? (
  <Button onClick={onCreate}>Create</Button>
) : (
  <Button disabled title="No permission">
    <Lock className="h-4 w-4 mr-2" />
    Create
  </Button>
)}
```

### Tab Filtering

Filter tabs based on required permissions:

```tsx
const tabs = allTabs.filter(tab => {
  const requiredPerms = TAB_PERMISSIONS[tab.id];
  return requiredPerms.every(perm => 
    hasPermission(perm.module, perm.action)
  );
});
```

## Settings RBAC

Settings pages have their own RBAC layer with more granular control. See `src/app/modules/settings/types/permissions.ts` for the full access matrix.

## Best Practices

1. **Always check server-side** - UI hiding is not security; validate on the backend
2. **Use guards at entry points** - Wrap pages/modules with `ModuleGate`
3. **Hide vs disable** - Hide actions users will never need; disable actions they may get access to
4. **Show access level** - Display a badge showing the user's access level
5. **Audit sensitive actions** - Log who did what and when

## Backend Enforcement

While this document focuses on UI, remember:
- All API routes must validate permissions
- Use JWT claims to check role and permissions
- Log access attempts and denials
- Implement rate limiting per permission level
