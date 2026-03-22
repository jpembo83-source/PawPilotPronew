# Reordering System

Production-grade list prioritisation control for the MDC Operations Centre.

## Overview

This system provides a consistent, safe, and auditable way to reorder items in lists across the platform using "Move list up" and "Move list down" actions via context menus (⋮).

**British English throughout. Fully database-backed. Server-side enforced.**

---

## Components

### `ReorderMenuItems`

Reusable context menu items for list reordering.

```tsx
import { ReorderMenuItems } from '@/components/reordering/ReorderMenuItems';

<DropdownMenu>
  <DropdownMenuTrigger>⋮</DropdownMenuTrigger>
  <DropdownMenuContent>
    <ReorderMenuItems
      currentIndex={index}
      totalItems={items.length}
      onMoveUp={() => handleReorder(item.id, 'up')}
      onMoveDown={() => handleReorder(item.id, 'down')}
      canReorder={hasPermission('reorder')}
    />
    <DropdownMenuSeparator />
    {/* Other menu items */}
  </DropdownMenuContent>
</DropdownMenu>
```

**Props:**
- `currentIndex` - Current item's position (0-based)
- `totalItems` - Total items in list
- `onMoveUp` - Callback for move up action
- `onMoveDown` - Callback for move down action
- `isReordering` - Loading state (optional)
- `canReorder` - Permission check (optional)
- `labels` - Custom labels (optional)

---

### `useReorder` Hook

Client-side reordering logic with optimistic updates and rollback.

```tsx
import { useReorder } from '@/components/reordering/useReorder';

const { reorder, isReordering } = useReorder({
  endpoint: '/api/dashboard/widgets/reorder',
  getAuthToken: async () => {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token || '';
  },
  onSuccess: () => refetchWidgets(),
});

// In your handler:
await reorder(widget.id, 'up', widgets, setWidgets);
```

**Features:**
- Optimistic UI updates
- Automatic rollback on failure
- Toast notifications
- Loading states

---

## Backend API

### Endpoints

All reorder endpoints follow the pattern:
```
POST /make-server-fc003b23/reorder/{feature}
```

**Available endpoints:**
- `/reorder/dashboard/widgets` - Personal dashboard widgets
- `/reorder/dashboard/quick-links` - Personal quick links
- `/reorder/services` - Global services list (admin only)
- `/reorder/policies` - Organisational policies
- `/reorder/message-templates` - Message templates
- `/reorder/operational-rules` - Operational rules

### Request

```json
{
  "item_id": "widget_123",
  "direction": "up" | "down"
}
```

### Response

```json
{
  "success": true,
  "message": "Order updated successfully",
  "item": { ... },
  "swapped_with": { ... },
  "old_position": 2,
  "new_position": 1
}
```

### Error Responses

```json
{
  "error": "Item is already at the top of the list"
}
```

---

## Data Model

Every ordered item MUST include a `sort_order` field:

```typescript
interface OrderedItem {
  id: string;
  sort_order: number;  // 1-based, lower = higher priority
  // ... other fields
}
```

**Rules:**
- Lower numbers = higher priority
- No duplicate sort_order values
- Sequential (1, 2, 3, ...)

---

## Permissions

### RBAC Levels

**Admin**
- `reorder_global` - Can reorder organisation-wide lists
- `reorder_location` - Can reorder location-scoped lists
- `reorder_personal` - Can reorder personal lists

**Manager**
- `reorder_location` - Can reorder location-scoped lists
- `reorder_personal` - Can reorder personal lists

**Staff**
- `reorder_personal` - Can reorder only personal lists

**Enforcement:**
- All permissions validated server-side
- No client-side permission bypass possible

---

## Audit Logging

For non-personal lists, all reorder actions are logged:

```typescript
{
  id: "audit_...",
  entity_type: "dashboard_widget",
  entity_id: "widget_123",
  action: "reorder",
  user_id: "user_456",
  user_name: "John Smith",
  user_role: "manager",
  changes: {
    old_position: 2,
    new_position: 1
  },
  timestamp: "2024-01-15T10:30:00Z"
}
```

**Query audit logs:**
```
GET /make-server-fc003b23/reorder/audit?entity_type=dashboard_widget&limit=50
```

---

## Implementation Guide

### 1. Add sort_order to your data model

```typescript
interface MyItem {
  id: string;
  name: string;
  sort_order: number;  // Add this
  created_at: string;
  updated_at: string;
}
```

### 2. Initialise sort_order on creation

```typescript
const newItem = {
  id: generateId('item'),
  name: 'My Item',
  sort_order: existingItems.length + 1,  // Next position
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};
```

### 3. Always display sorted by sort_order

```typescript
const sortedItems = items.sort((a, b) => a.sort_order - b.sort_order);
```

### 4. Add reordering to your UI

```tsx
import { ReorderMenuItems } from '@/components/reordering/ReorderMenuItems';
import { useReorder } from '@/components/reordering/useReorder';

const { reorder, isReordering } = useReorder({
  endpoint: `/make-server-fc003b23/reorder/my-feature`,
  getAuthToken: getToken,
  onSuccess: refetch,
});

{sortedItems.map((item, index) => (
  <div key={item.id}>
    <DropdownMenu>
      <DropdownMenuTrigger>⋮</DropdownMenuTrigger>
      <DropdownMenuContent>
        <ReorderMenuItems
          currentIndex={index}
          totalItems={sortedItems.length}
          onMoveUp={() => reorder(item.id, 'up', sortedItems, setItems)}
          onMoveDown={() => reorder(item.id, 'down', sortedItems, setItems)}
          isReordering={isReordering}
        />
      </DropdownMenuContent>
    </DropdownMenu>
  </div>
))}
```

### 5. Register backend endpoint (if needed)

Edit `/supabase/functions/server/reorder_routes.tsx`:

```typescript
app.post('/my-feature', createReorderEndpoint({
  kvPrefix: 'my_feature:',
  requiredPermission: 'reorder_global',
  entityType: 'my_feature_item',
  isPersonal: false,
}));
```

---

## Edge Cases

### Concurrent reordering
- Server uses atomic KV operations
- Race conditions safely resolved
- Last write wins

### Filtered lists
- Reordering operates on full underlying list
- Filters are view-only

### Locked items
- System items can be marked non-reorderable
- Check `isLocked` flag before rendering controls

### Deleted items
- Gaps in sort_order are acceptable
- No need to renumber on delete

---

## Testing Checklist

- [ ] Items display in sort_order ascending
- [ ] "Move list up" disabled when first
- [ ] "Move list down" disabled when last
- [ ] Optimistic update appears immediately
- [ ] Rollback works on API failure
- [ ] Order persists after page refresh
- [ ] Permissions enforced (try as different roles)
- [ ] Audit log created for non-personal lists
- [ ] Concurrent edits don't corrupt order
- [ ] Toast appears on error

---

## Accessibility

- ✅ Keyboard accessible (Tab to menu, Enter to activate)
- ✅ Screen reader labels ("Move list up", "Move list down")
- ✅ Disabled states clearly communicated
- ✅ No drag-and-drop required

---

## Performance

- **Optimistic updates** - UI feels instant
- **No full refetch** - Only updates affected items
- **Atomic operations** - No race conditions
- **Minimal payload** - Only IDs and direction sent

---

## Support

For issues or questions:
1. Check this README
2. Review existing implementations (Dashboard Widgets, Quick Links)
3. Check audit logs for debugging
4. Consult platform documentation

---

**Version:** 1.0.0  
**Last Updated:** December 2024
