# View As Feature - MDC Operations Centre

## Overview

The "View As" capability allows authorised users to safely view the platform exactly as another user would see it, for troubleshooting, support, training, and access validation — without compromising security or data integrity.

This is **NOT user impersonation**. It is:
- ✅ Controlled and permission-gated
- ✅ Read-only (no data mutations)
- ✅ Fully auditable
- ✅ Reversible at any time
- ✅ Clearly indicated with persistent banner

## Access Control

| Role | Permissions |
|------|-------------|
| **Admin** | Can view as any user except other Admins |
| **Manager** | Can view as Staff/Assistant Managers they manage (in their locations only) |
| **Staff/Assistant Manager** | No access to View As |

## Core Principles

1. **View-Only**: All create/update/delete actions are disabled
2. **True Representation**: UI matches target user's permissions exactly
3. **No Privilege Escalation**: Viewer cannot see what target cannot see
4. **Clear Indication**: Orange banner always visible when active
5. **Server-Side Enforcement**: All validation happens server-side

## Usage

### Starting a View As Session

```tsx
import { ViewAsButton } from '../modules/view-as';

// In your user list or user detail page:
<ViewAsButton 
  targetUserId={user.id}
  targetUserName={user.name}
  targetUserRole={user.role}
  disabled={!user.isActive}
/>
```

### Protecting Actions in Your Components

```tsx
import { useViewAsProtection } from '../modules/view-as/useViewAsProtection';

function MyComponent() {
  const { checkAction, isReadOnly } = useViewAsProtection();

  const handleSave = async () => {
    // Check if action is allowed
    const allowed = await checkAction('update_booking');
    if (!allowed) return; // Action blocked - toast shown automatically

    // Proceed with save
    await saveData();
  };

  return (
    <Button 
      onClick={handleSave}
      disabled={isReadOnly} // Disable button in View As mode
    >
      Save Changes
    </Button>
  );
}
```

### Protecting Callbacks

```tsx
import { useViewAsProtection } from '../modules/view-as/useViewAsProtection';

function MyComponent() {
  const { protectAction } = useViewAsProtection();

  // Wrap your action handler
  const handleDelete = protectAction('delete_customer', async (id: string) => {
    await deleteCustomer(id);
    toast.success('Customer deleted');
  });

  return (
    <Button onClick={() => handleDelete(customerId)}>
      Delete
    </Button>
  );
}
```

### Checking View As State

```tsx
import { useViewAs } from '../../context/ViewAsContext';

function MyComponent() {
  const { isViewingAs, session, targetUser } = useViewAs();

  if (isViewingAs) {
    return (
      <div className="bg-orange-50 p-4">
        <p>You are viewing as {targetUser?.name}</p>
        <p>All actions are disabled</p>
      </div>
    );
  }

  // Normal rendering
}
```

## Backend Integration

The backend automatically handles View As sessions:

### Request Flow

1. Frontend includes `view_as_user_id` in context
2. Backend validates permissions using target user's permissions
3. Backend blocks any mutation requests
4. All actions attributed to viewer in audit logs

### Server-Side Enforcement

```typescript
// Backend automatically validates:
app.post('/bookings', async (c) => {
  const { view_as_user_id } = c.req.headers;
  
  if (view_as_user_id) {
    // Mutation blocked automatically
    return c.json({ error: 'Mutations not allowed in View As mode' }, 403);
  }
  
  // Normal processing
});
```

## Monitoring & Audit

### View Active Sessions

Navigate to: **Settings → Users & Access → View As**

- See all currently active View As sessions
- Review session history
- Full audit trail of all actions

### Audit Log Entries

Every View As session logs:
- Who initiated it (viewer)
- Target user
- Start/end timestamps
- Reason (optional but recommended)
- All blocked action attempts

## Security Features

### Automatic Protections

- ✅ Cannot perform create/update/delete operations
- ✅ Cannot approve workflows
- ✅ Cannot send messages
- ✅ Cannot process billing/payments
- ✅ Cannot export data
- ✅ Cannot access System menu
- ✅ Server-side validation of all requests

### Visual Indicators

- Persistent orange banner at top (non-dismissable)
- "Exit View As" button always visible
- Disabled action buttons show tooltip explaining why

### Automatic Session Cleanup

- Sessions end automatically when viewer logs out
- Optional timeout (configurable)
- Manual exit always available

## Integration Points

### With Role-Based Access Control

View As respects all role and permission restrictions:

```typescript
// Target user has role: 'staff'
// Target user has permissions: ['booking.view', 'customer.view']
// Target user has locations: ['loc1']

// When viewing as this user:
// - Can only see bookings/customers at loc1
// - Cannot create/edit anything
// - Cannot see modules they don't have access to
```

### With Module Enablement

Navigation menu adapts to target user's enabled modules:

```typescript
// Target user has enabled_modules: ['daycare', 'grooming']

// When viewing as this user:
// - Only Daycare and Grooming appear in navigation
// - Other modules are hidden
```

### With Location Scoping

Data visibility matches target user's location access:

```typescript
// Target user assigned to: ['Location A']

// When viewing as this user:
// - Can only see data for Location A
// - Location selector shows only Location A
// - Cross-location queries return filtered results
```

## Best Practices

### When to Use View As

✅ **Good Use Cases:**
- Troubleshooting "I can't see X" issues
- Validating new permission templates
- Training and onboarding support
- Access audit and compliance verification

❌ **Avoid:**
- Performing actions on behalf of users (use proper delegation)
- Bypassing approval workflows
- Accessing data you shouldn't see

### Providing Reasons

Always provide a reason when starting a View As session:

```
Good reasons:
- "Troubleshooting permission issue - ticket #1234"
- "Training new manager Sarah on reporting access"
- "Validating Staff template permissions"

Avoid:
- Leaving blank
- Generic "testing"
```

### Duration

- Keep sessions short (< 15 minutes recommended)
- Exit immediately after investigation
- Don't leave sessions running unattended

## API Reference

### `useViewAs()` Hook

```typescript
const {
  isViewingAs,      // boolean - true if in View As mode
  session,          // ViewAsSession | null - current session
  targetUser,       // ViewAsUser | null - user being viewed as
  startViewAs,      // (userId, reason?) => Promise<void>
  endViewAs,        // () => Promise<void>
  validateAction,   // (actionType) => Promise<boolean>
  isLoading,        // boolean
  error,            // string | null
} = useViewAs();
```

### `useViewAsProtection()` Hook

```typescript
const {
  isViewingAs,      // boolean
  isReadOnly,       // boolean (alias for isViewingAs)
  checkAction,      // (actionType) => Promise<boolean>
  protectAction,    // (actionType, callback) => protectedCallback
} = useViewAsProtection();
```

## Troubleshooting

### "Cannot start View As session"

**Cause:** Insufficient permissions or target user is an Admin

**Solution:** 
- Admins cannot view as other Admins
- Managers can only view users they manage in their locations
- Ensure target user is active

### Actions not blocking properly

**Cause:** Component not using protection hooks

**Solution:** Add `useViewAsProtection()` hook to your component

### Banner not showing

**Cause:** ViewAsProvider not wrapping app or banner not in Layout

**Solution:** Verify ViewAsProvider wraps app and ViewAsBanner is in Layout

### Session persists after logout

**Cause:** Session cleanup not triggered

**Solution:** Sessions auto-clear on logout; can also manually exit

## Testing

### Seed Test Data

```typescript
import { seedData } from '../modules/view-as/api';

await seedData();
// Creates:
// - admin-1 (Admin User)
// - manager-1 (Sarah Manager)
// - staff-1 (John Staff)
```

### Manual Testing Checklist

- [ ] Admin can view as Manager
- [ ] Admin can view as Staff
- [ ] Admin cannot view as another Admin
- [ ] Manager can view as Staff in their location
- [ ] Manager cannot view as Staff in other locations
- [ ] Banner appears when session starts
- [ ] All mutation buttons are disabled
- [ ] Attempting action shows error toast
- [ ] Exit View As returns to normal mode
- [ ] Session appears in audit log
- [ ] Navigation menu reflects target user's modules
- [ ] Data filtered to target user's locations

## Example: Complete Integration

```tsx
import { ViewAsButton } from '../modules/view-as';
import { useViewAsProtection } from '../modules/view-as/useViewAsProtection';
import { useViewAs } from '../../context/ViewAsContext';

function UserDetailPage({ userId }: { userId: string }) {
  const { isViewingAs, targetUser } = useViewAs();
  const { checkAction, isReadOnly } = useViewAsProtection();
  const [user, setUser] = useState<User | null>(null);

  const handleUpdateUser = async (data: Partial<User>) => {
    // Protection check
    const allowed = await checkAction('update_user');
    if (!allowed) return;

    await updateUser(userId, data);
    toast.success('User updated');
  };

  return (
    <div>
      {/* Show who we're viewing as */}
      {isViewingAs && (
        <Alert variant="warning">
          Viewing as: {targetUser?.name} ({targetUser?.role})
        </Alert>
      )}

      {/* User details */}
      <UserForm 
        user={user}
        onSave={handleUpdateUser}
        readonly={isReadOnly} // Disable form in View As mode
      />

      {/* View As button */}
      {!isViewingAs && (
        <ViewAsButton
          targetUserId={user.id}
          targetUserName={user.name}
          targetUserRole={user.role}
        />
      )}
    </div>
  );
}
```

## Support

For issues or questions about View As:
1. Check audit logs in Settings → Users & Access → View As
2. Verify user permissions and role assignments
3. Review server logs for validation errors
4. Contact platform administrators
