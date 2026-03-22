# Reordering System Architecture

## Visual Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         USER INTERFACE                               │
│                                                                       │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  List Item 1                                          [⋮]     │  │
│  │  ├─ Move list up       ← ReorderMenuItems component          │  │
│  │  └─ Move list down                                            │  │
│  └──────────────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  List Item 2                                          [⋮]     │  │
│  └──────────────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  List Item 3                                          [⋮]     │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                       │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ User clicks "Move list up"
                                    ↓
┌─────────────────────────────────────────────────────────────────────┐
│                      FRONTEND - useReorder Hook                      │
│                                                                       │
│  1. Find current item in array                                       │
│  2. Validate boundaries (not first/last)                             │
│  3. Create copy of array for rollback                                │
│  4. OPTIMISTIC UPDATE:                                               │
│     - Swap items in local state                                      │
│     - Update sort_order values                                       │
│     - UI updates INSTANTLY ⚡                                        │
│  5. Call API in background                                           │
│                                                                       │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ POST /reorder/{feature}
                                    │ { item_id, direction }
                                    ↓
┌─────────────────────────────────────────────────────────────────────┐
│                    BACKEND - reorder_routes.tsx                      │
│                                                                       │
│  1. Validate authentication                                          │
│  2. Check RBAC permissions                                           │
│  3. Fetch all items from KV store                                    │
│  4. Apply scope filter (if needed)                                   │
│  5. Sort by sort_order                                               │
│  6. Find current and target items                                    │
│  7. ATOMIC SWAP:                                                     │
│     - Swap sort_order values                                         │
│     - Update timestamps                                              │
│     - Save both items to KV                                          │
│  8. Create audit log (if not personal)                               │
│  9. Return success response                                          │
│                                                                       │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                    ┌───────────────┴────────────────┐
                    │                                 │
                    ↓ Success                         ↓ Failure
┌─────────────────────────────────┐   ┌─────────────────────────────────┐
│  FRONTEND - Success Path         │   │  FRONTEND - Failure Path         │
│                                  │   │                                  │
│  1. Optimistic update already    │   │  1. ROLLBACK optimistic update   │
│     visible (no flash!)          │   │  2. Restore original array       │
│  2. Optional: refetch from       │   │  3. Show error toast             │
│     server for latest state      │   │  4. User sees original order     │
│  3. Call onSuccess callback      │   │                                  │
│                                  │   │                                  │
└─────────────────────────────────┘   └─────────────────────────────────┘
```

---

## Data Model

### Before Reorder
```typescript
[
  { id: 'A', name: 'Item A', sort_order: 1 },
  { id: 'B', name: 'Item B', sort_order: 2 },  ← User clicks "Move list up"
  { id: 'C', name: 'Item C', sort_order: 3 },
]
```

### After Reorder (Move B up)
```typescript
[
  { id: 'B', name: 'Item B', sort_order: 1 },  ← Swapped to position 1
  { id: 'A', name: 'Item A', sort_order: 2 },  ← Swapped to position 2
  { id: 'C', name: 'Item C', sort_order: 3 },
]
```

**Only 2 items modified!** This is efficient and atomic.

---

## State Flow Diagram

```
                    ┌─────────────────────┐
                    │   Initial State     │
                    │  [A(1), B(2), C(3)] │
                    └──────────┬──────────┘
                               │
                User clicks    │
               "Move B up"     │
                               ↓
                    ┌─────────────────────┐
                    │  Optimistic Update  │
                    │  [B(1), A(2), C(3)] │ ← UI INSTANTLY updates
                    └──────────┬──────────┘
                               │
                               │ API call in progress...
                               │
                      ┌────────┴────────┐
                      │                 │
               Success│                 │Failure
                      ↓                 ↓
        ┌─────────────────────┐   ┌─────────────────────┐
        │   Server Confirms   │   │   Rollback State    │
        │  [B(1), A(2), C(3)] │   │  [A(1), B(2), C(3)] │
        │  (already visible)  │   │  + Error toast      │
        └─────────────────────┘   └─────────────────────┘
```

---

## Permission Matrix

```
┌──────────────────┬─────────────┬────────────────┬─────────────────┐
│                  │   Personal  │   Location     │     Global      │
│                  │    Lists    │     Lists      │     Lists       │
├──────────────────┼─────────────┼────────────────┼─────────────────┤
│  Staff           │     ✅      │       ❌       │       ❌        │
│                  │             │                │                 │
│  Assistant Mgr   │     ✅      │       ❌       │       ❌        │
│                  │             │                │                 │
│  Manager         │     ✅      │       ✅       │       ❌        │
│                  │             │                │                 │
│  Admin           │     ✅      │       ✅       │       ✅        │
│                  │             │                │                 │
└──────────────────┴─────────────┴────────────────┴─────────────────┘

Examples:
  Personal: Dashboard widgets, Quick links
  Location: Location-specific services
  Global:   Organisation-wide policies, templates
```

---

## Request/Response Flow

### Request
```http
POST /make-server-fc003b23/reorder/services
Authorization: Bearer <token>
Content-Type: application/json

{
  "item_id": "service_123",
  "direction": "up"
}
```

### Response (Success)
```json
{
  "success": true,
  "message": "Order updated successfully",
  "item": {
    "id": "service_123",
    "name": "Dog Daycare",
    "sort_order": 2,
    "updated_at": "2024-12-30T10:30:00Z"
  },
  "swapped_with": {
    "id": "service_456",
    "name": "Dog Grooming",
    "sort_order": 3,
    "updated_at": "2024-12-30T10:30:00Z"
  },
  "old_position": 3,
  "new_position": 2
}
```

### Response (Failure - At Boundary)
```json
{
  "error": "Item is already at the top of the list"
}
```

### Response (Failure - Permission Denied)
```json
{
  "error": "Access denied: insufficient permissions to reorder"
}
```

---

## Audit Log Structure

For non-personal lists, every reorder action is logged:

```json
{
  "id": "audit_1735559400000_abc123",
  "entity_type": "service",
  "entity_id": "service_123",
  "action": "reorder",
  "user_id": "user_456",
  "user_name": "Jane Smith",
  "user_role": "admin",
  "changes": {
    "old_position": 3,
    "new_position": 2
  },
  "timestamp": "2024-12-30T10:30:00Z"
}
```

**Stored at:** `kv_store_fc003b23` → `audit:reorder:{audit_id}`

**Query:** `GET /make-server-fc003b23/reorder/audit?entity_type=service&limit=50`

---

## Component Architecture

```
/src/app/components/reordering/
│
├── ReorderMenuItems.tsx          ← UI Component
│   └── Props:
│       ├── currentIndex          (0-based position)
│       ├── totalItems            (array length)
│       ├── onMoveUp()            (callback)
│       ├── onMoveDown()          (callback)
│       ├── isReordering          (loading state)
│       └── canReorder            (permission check)
│
├── useReorder.ts                 ← Logic Hook
│   └── Returns:
│       ├── reorder(id, direction, items, setItems)
│       └── isReordering          (boolean)
│
├── index.ts                      ← Exports
│
├── README.md                     ← Full documentation
├── IMPLEMENTATION_EXAMPLES.md    ← 6 practical examples
└── ARCHITECTURE.md               ← This file
```

---

## Backend Architecture

```
/supabase/functions/server/
│
├── reorder_routes.tsx            ← Reordering API
│   │
│   ├── Types
│   │   ├── ReorderRequest        { item_id, direction }
│   │   ├── OrderedItem           { id, sort_order, ... }
│   │   └── ReorderConfig         { kvPrefix, scope, ... }
│   │
│   ├── Helpers
│   │   ├── getUserFromToken()    ← Auth validation
│   │   ├── hasPermission()       ← RBAC check
│   │   ├── performReorder()      ← Core swap logic
│   │   └── createAuditLog()      ← Audit entry
│   │
│   ├── Generic Endpoint
│   │   └── createReorderEndpoint(config)  ← Factory
│   │
│   ├── Feature Endpoints
│   │   ├── POST /dashboard/widgets
│   │   ├── POST /dashboard/quick-links
│   │   ├── POST /services
│   │   ├── POST /policies
│   │   ├── POST /message-templates
│   │   └── POST /operational-rules
│   │
│   └── Audit Query
│       └── GET /audit
│
└── index.tsx                     ← Mount routes
    └── app.route("/make-server-fc003b23/reorder", reorderRoutes)
```

---

## Sequence Diagram

```
User         Frontend                    Backend                    KV Store
 │              │                           │                           │
 │─click─────→  │                           │                           │
 │              │                           │                           │
 │              │─optimistic update────────>│                           │
 │              │  (UI shows new order)     │                           │
 │              │                           │                           │
 │              │─POST /reorder───────────→ │                           │
 │              │  {item_id, direction}     │                           │
 │              │                           │                           │
 │              │                           │─validate auth───────────→ │
 │              │                           │                           │
 │              │                           │←user data───────────────  │
 │              │                           │                           │
 │              │                           │─check permission          │
 │              │                           │  (RBAC)                   │
 │              │                           │                           │
 │              │                           │─fetch items─────────────→ │
 │              │                           │                           │
 │              │                           │←items───────────────────  │
 │              │                           │                           │
 │              │                           │─sort, find, validate      │
 │              │                           │                           │
 │              │                           │─atomic swap─────────────→ │
 │              │                           │  save 2 items             │
 │              │                           │                           │
 │              │                           │←success─────────────────  │
 │              │                           │                           │
 │              │                           │─create audit log────────→ │
 │              │                           │  (if not personal)        │
 │              │                           │                           │
 │              │←response─────────────────  │                           │
 │              │  {success, item, ...}     │                           │
 │              │                           │                           │
 │              │─onSuccess()               │                           │
 │              │  (optional refetch)       │                           │
 │              │                           │                           │
 │←done─────────│                           │                           │
 │              │                           │                           │
```

---

## Key Design Decisions

### 1. Why Optimistic Updates?
**Answer:** Users expect instant feedback. Waiting for the server feels sluggish.

**Trade-off:** Must handle rollback if server fails (we do this automatically).

---

### 2. Why Swap Instead of Absolute Positioning?
**Answer:** Swapping is:
- Safer (can't accidentally create gaps)
- Simpler (only 2 items change)
- More predictable (always move exactly 1 position)
- Atomic (no complex renumbering logic)

**Trade-off:** Can't jump multiple positions at once (could add "Move to top/bottom" later).

---

### 3. Why sort_order Instead of position?
**Answer:** More semantic. Makes it clear this is for ordering/priority, not spatial layout.

**Alternative names:** `priority_index`, `display_order`, `sequence`

---

### 4. Why Not Drag-and-Drop?
**Answer:** 
- Not accessible (keyboard users, screen readers)
- Mobile-unfriendly (imprecise touch targets)
- Complex implementation (collision detection, visual feedback)
- This is deliberate prioritisation, not spatial arrangement

**Note:** Drag-and-drop could be *added* as an alternative UI, but menu controls should always exist.

---

### 5. Why Server-Side Enforcement?
**Answer:** 
- Security (can't bypass permissions client-side)
- Consistency (single source of truth)
- Auditability (all actions logged)
- Multi-user safety (concurrent edits handled)

**Trade-off:** Network roundtrip required (mitigated with optimistic updates).

---

## Performance Characteristics

| Operation | Time | Notes |
|-----------|------|-------|
| Optimistic update | <10ms | Pure JavaScript |
| Network roundtrip | 100-300ms | Depends on connection |
| Server validation | <10ms | In-memory |
| KV fetch | 20-50ms | Remote datastore |
| KV write | 20-50ms | Per item (×2) |
| Total server time | <150ms | Typical |

**Perceived latency:** 0ms (optimistic update) ✨

---

## Error Scenarios

| Scenario | Client Behaviour | Server Response |
|----------|------------------|-----------------|
| Item not found | Rollback, toast error | 404 Not Found |
| Already at top | Rollback, toast error | 400 Bad Request |
| Already at bottom | Rollback, toast error | 400 Bad Request |
| No permission | Rollback, toast error | 403 Forbidden |
| Invalid token | Rollback, toast error | 401 Unauthorized |
| Network failure | Rollback, toast error | - |
| Server error | Rollback, toast error | 500 Internal Error |

**All scenarios safely handled with automatic rollback.**

---

## Testing Strategy

### Unit Tests (Components)
```typescript
describe('ReorderMenuItems', () => {
  it('disables "Move list up" when currentIndex is 0');
  it('disables "Move list down" when currentIndex is last');
  it('calls onMoveUp when clicked');
  it('shows loading state when isReordering=true');
  it('hides when canReorder=false');
});
```

### Unit Tests (Hook)
```typescript
describe('useReorder', () => {
  it('swaps items correctly');
  it('updates sort_order values');
  it('rolls back on API failure');
  it('shows toast on error');
  it('prevents concurrent reorders');
});
```

### Integration Tests (Backend)
```typescript
describe('POST /reorder/services', () => {
  it('requires authentication');
  it('checks RBAC permissions');
  it('swaps sort_order atomically');
  it('creates audit log');
  it('returns 400 if at boundary');
  it('handles concurrent requests safely');
});
```

### E2E Tests
```typescript
describe('Reordering Services', () => {
  it('allows admin to reorder services');
  it('prevents staff from reordering services');
  it('persists order after page refresh');
  it('shows error toast on network failure');
});
```

---

## Migration Guide

If you have existing lists without `sort_order`:

### Step 1: Add field
```typescript
interface MyItem {
  id: string;
  name: string;
  sort_order: number;  // Add this
}
```

### Step 2: Backfill existing data
```typescript
async function backfillSortOrder() {
  const items = await kv.getByPrefix('my_feature:');
  
  items.forEach((item, index) => {
    item.sort_order = index + 1;
    item.updated_at = new Date().toISOString();
    await kv.set(`my_feature:${item.id}`, item);
  });
}
```

### Step 3: Update creation logic
```typescript
const createItem = async (data: any) => {
  const existingItems = await fetchItems();
  
  const newItem = {
    id: generateId('item'),
    ...data,
    sort_order: existingItems.length + 1,  // Add this
    created_at: new Date().toISOString(),
  };
  
  await kv.set(`my_feature:${newItem.id}`, newItem);
};
```

---

## Future Enhancements

### Potential Features
- [ ] Drag-and-drop UI (in addition to menu)
- [ ] Bulk reordering (select multiple items)
- [ ] "Move to top" / "Move to bottom" shortcuts
- [ ] Undo/redo functionality
- [ ] Visual reorder history timeline
- [ ] Import/export ordering
- [ ] Auto-number gaps (optional compaction)
- [ ] Custom sort_order ranges (e.g., 10, 20, 30 for insertions)

**Note:** Current system is complete and production-ready. These are nice-to-haves.

---

## Comparison with Alternatives

| Approach | Pros | Cons |
|----------|------|------|
| **Our System (Swap)** | Simple, safe, atomic, accessible | Only moves 1 position at a time |
| Drag-and-drop | Visual, intuitive | Not accessible, mobile-unfriendly, complex |
| Absolute positioning | Can jump multiple positions | Fragile, can create gaps, hard to debug |
| Manual number entry | Maximum control | Error-prone, can duplicate, bad UX |

**Verdict:** Our system is the right choice for production operations software.

---

**Questions?** Check:
1. Main README: `/src/app/components/reordering/README.md`
2. Examples: `/src/app/components/reordering/IMPLEMENTATION_EXAMPLES.md`
3. Overview: `/REORDERING_SYSTEM.md`
4. This file: `/src/app/components/reordering/ARCHITECTURE.md`
