# View As - Usage Examples

This document demonstrates how to properly integrate View As protection into your components to ensure actions are disabled in View As mode.

## Basic Usage

### 1. Disable Button Actions

```tsx
import { useViewAsProtection } from './modules/view-as/useViewAsProtection';

function BookingForm() {
  const { isReadOnly, checkAction } = useViewAsProtection();

  const handleSave = async () => {
    // Check if action is allowed before proceeding
    const allowed = await checkAction('create_booking');
    if (!allowed) return;

    // Proceed with save
    await saveBooking();
  };

  return (
    <Button 
      onClick={handleSave}
      disabled={isReadOnly} // Visually disable in View As mode
    >
      Save Booking
    </Button>
  );
}
```

### 2. Protect Action Handlers

```tsx
import { useViewAsProtection } from './modules/view-as/useViewAsProtection';

function CustomerActions() {
  const { protectAction } = useViewAsProtection();

  // Wrap the action with protection
  const handleUpdateCustomer = protectAction(
    'update_customer',
    async (customerId: string, data: any) => {
      await updateCustomer(customerId, data);
      toast.success('Customer updated');
    }
  );

  return (
    <Button onClick={() => handleUpdateCustomer('123', { name: 'Updated' })}>
      Update Customer
    </Button>
  );
}
```

### 3. Conditional Rendering

```tsx
import { useViewAsProtection } from './modules/view-as/useViewAsProtection';

function MessagingPanel() {
  const { isViewingAs } = useViewAsProtection();

  return (
    <div>
      {/* Show compose UI only if not in View As mode */}
      {!isViewingAs && (
        <MessageComposer />
      )}

      {/* Always show message list */}
      <MessageList />

      {/* Show warning when in View As */}
      {isViewingAs && (
        <Alert variant="warning">
          You are viewing messages in read-only mode
        </Alert>
      )}
    </div>
  );
}
```

### 4. Form Submission Protection

```tsx
import { useViewAsProtection } from './modules/view-as/useViewAsProtection';

function PricingForm() {
  const { isReadOnly, checkAction } = useViewAsProtection();

  const onSubmit = async (data: FormData) => {
    // Validate action before submission
    if (!await checkAction('update_pricing')) {
      return;
    }

    await updatePricing(data);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <Input {...register('price')} disabled={isReadOnly} />
      <Button type="submit" disabled={isReadOnly}>
        Save Changes
      </Button>
    </form>
  );
}
```

### 5. Dropdown Menu Protection

```tsx
import { useViewAsProtection } from './modules/view-as/useViewAsProtection';

function UserActionsMenu() {
  const { isReadOnly } = useViewAsProtection();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger>Actions</DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem disabled={isReadOnly}>
          Edit User
        </DropdownMenuItem>
        <DropdownMenuItem disabled={isReadOnly}>
          Delete User
        </DropdownMenuItem>
        <DropdownMenuItem>
          View Details {/* Always allowed */}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

### 6. API Call Protection (Zustand Store)

```tsx
// In your Zustand store
import { useViewAsProtection } from './modules/view-as/useViewAsProtection';

export const useBookingStore = create<BookingState>((set) => ({
  bookings: [],
  
  createBooking: async (data: BookingData) => {
    // Note: In stores, you should check on the component side before calling
    // Or pass a validation callback
    const response = await fetch('/api/bookings', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    
    if (!response.ok) throw new Error('Failed to create booking');
    
    const booking = await response.json();
    set((state) => ({ bookings: [...state.bookings, booking] }));
  },
}));

// In component:
function BookingComponent() {
  const { createBooking } = useBookingStore();
  const { protectAction } = useViewAsProtection();

  const handleCreate = protectAction('create_booking', createBooking);

  return <Button onClick={() => handleCreate(data)}>Create</Button>;
}
```

### 7. Batch Actions Protection

```tsx
import { useViewAsProtection } from './modules/view-as/useViewAsProtection';

function BulkActions() {
  const { isReadOnly, checkAction } = useViewAsProtection();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const handleBulkDelete = async () => {
    // Check before proceeding
    if (!await checkAction('delete_customers')) {
      return;
    }

    await deleteCustomers(selectedIds);
    setSelectedIds([]);
  };

  return (
    <div>
      <Checkbox 
        disabled={isReadOnly}
        checked={selectedIds.includes(id)}
        onCheckedChange={handleSelect}
      />
      <Button 
        onClick={handleBulkDelete}
        disabled={isReadOnly || selectedIds.length === 0}
      >
        Delete Selected
      </Button>
    </div>
  );
}
```

### 8. Navigation Restrictions

```tsx
import { useViewAsProtection } from './modules/view-as/useViewAsProtection';
import { useNavigate } from 'react-router-dom';

function Navigation() {
  const { isViewingAs } = useViewAsProtection();
  const navigate = useNavigate();

  return (
    <nav>
      <NavLink to="/dashboard">Dashboard</NavLink>
      <NavLink to="/bookings">Bookings</NavLink>
      
      {/* Hide System menu when in View As mode */}
      {!isViewingAs && (
        <NavLink to="/settings/system">System</NavLink>
      )}
      
      {/* Show Finance only if not viewing as */}
      {!isViewingAs && (
        <NavLink to="/billing">Billing</NavLink>
      )}
    </nav>
  );
}
```

## Action Type Conventions

Use consistent action type strings across your application:

```typescript
// Create operations
'create_booking'
'create_customer'
'create_message'

// Update operations
'update_booking'
'update_pricing'
'update_customer'

// Delete operations
'delete_booking'
'delete_customer'

// Special actions
'approve_pricing'
'send_message'
'export_data'
'process_payment'
```

## Best Practices

1. **Always check before mutating data**: Use `checkAction()` or `protectAction()` before any create/update/delete operation.

2. **Disable UI elements**: Set `disabled={isReadOnly}` on buttons, inputs, and form controls.

3. **Visual feedback**: Show warnings or badges when in View As mode.

4. **Server-side enforcement**: Never rely solely on client-side protection. The backend must also validate.

5. **Consistent protection**: Protect all mutation paths - forms, buttons, API calls, bulk actions.

6. **User experience**: Show clear messages explaining why actions are disabled.

## Complete Component Example

```tsx
import { useState } from 'react';
import { useViewAsProtection } from './modules/view-as/useViewAsProtection';
import { Button } from './components/ui/button';
import { Input } from './components/ui/input';
import { Alert } from './components/ui/alert';
import { toast } from 'sonner';

function CompleteExample() {
  const { isViewingAs, isReadOnly, checkAction } = useViewAsProtection();
  const [formData, setFormData] = useState({ name: '', email: '' });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Check action before proceeding
    if (!await checkAction('create_customer')) {
      return;
    }

    try {
      await createCustomer(formData);
      toast.success('Customer created successfully');
      setFormData({ name: '', email: '' });
    } catch (error) {
      toast.error('Failed to create customer');
    }
  };

  return (
    <div className="space-y-4">
      {/* Show warning banner */}
      {isViewingAs && (
        <Alert variant="warning">
          You are in View As mode. All actions are disabled.
        </Alert>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          placeholder="Name"
          value={formData.name}
          onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
          disabled={isReadOnly}
        />
        
        <Input
          type="email"
          placeholder="Email"
          value={formData.email}
          onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
          disabled={isReadOnly}
        />

        <div className="flex gap-2">
          <Button type="submit" disabled={isReadOnly}>
            Create Customer
          </Button>
          
          <Button
            type="button"
            variant="outline"
            onClick={() => setFormData({ name: '', email: '' })}
            disabled={isReadOnly}
          >
            Clear Form
          </Button>
        </div>
      </form>
    </div>
  );
}
```

## Testing View As Mode

To test your View As implementation:

1. Go to Settings → Users & Access Control → View As tab
2. Click "Seed Data" to create test users
3. Click "View As" on any user in the Users list
4. Navigate through the application and verify:
   - All create/update/delete buttons are disabled
   - Forms show as read-only
   - Action attempts show error toasts
   - Orange banner is visible at all times
5. Click "Exit View As" to return to normal mode
