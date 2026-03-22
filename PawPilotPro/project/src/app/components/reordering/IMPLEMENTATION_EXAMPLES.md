# Reordering System - Implementation Examples

This document provides practical examples of implementing the reordering system in various parts of the MDC Operations Centre.

---

## Example 1: Simple List with Context Menu

### Scenario
A list of services where Admins can reorder items.

```tsx
import React from 'react';
import { MoreVertical } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { ReorderMenuItems, useReorder } from '@/components/reordering';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/utils/supabase/client';

interface Service {
  id: string;
  name: string;
  sort_order: number;
  // ... other fields
}

export function ServicesList() {
  const { hasPermission } = useAuth();
  const [services, setServices] = React.useState<Service[]>([]);
  
  // Reorder hook
  const { reorder, isReordering } = useReorder({
    endpoint: `https://${projectId}.supabase.co/functions/v1/make-server-fc003b23/reorder/services`,
    getAuthToken: async () => {
      const { data } = await supabase.auth.getSession();
      return data.session?.access_token || '';
    },
    onSuccess: () => {
      // Optionally refetch from server
      fetchServices();
    },
  });
  
  // Fetch services
  const fetchServices = async () => {
    // Your fetch logic
    const data = await fetch('...');
    const json = await data.json();
    setServices(json.sort((a, b) => a.sort_order - b.sort_order));
  };
  
  React.useEffect(() => {
    fetchServices();
  }, []);
  
  const canReorder = hasPermission('services', 'reorder');
  
  // Always sort by sort_order
  const sortedServices = [...services].sort((a, b) => a.sort_order - b.sort_order);

  return (
    <div className="space-y-2">
      {sortedServices.map((service, index) => (
        <div key={service.id} className="flex items-center justify-between p-4 border rounded">
          <div>
            <h3>{service.name}</h3>
            <p className="text-sm text-slate-500">Position: {service.sort_order}</p>
          </div>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {/* Reorder menu items */}
              <ReorderMenuItems
                currentIndex={index}
                totalItems={sortedServices.length}
                onMoveUp={() => reorder(service.id, 'up', sortedServices, setServices)}
                onMoveDown={() => reorder(service.id, 'down', sortedServices, setServices)}
                isReordering={isReordering}
                canReorder={canReorder}
              />
              
              <DropdownMenuSeparator />
              
              {/* Other menu items */}
              <DropdownMenuItem>Edit</DropdownMenuItem>
              <DropdownMenuItem className="text-red-600">Delete</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ))}
    </div>
  );
}
```

---

## Example 2: Dashboard Widgets (Personal List)

### Scenario
User's personal dashboard widgets that they can reorder.

```tsx
import React from 'react';
import { ReorderMenuItems, useReorder } from '@/components/reordering';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/utils/supabase/client';
import { projectId } from '@/utils/supabase/info';

interface DashboardWidget {
  id: string;
  user_id: string;
  widget_type: string;
  sort_order: number;
  settings: any;
}

export function DashboardWidgetsManager() {
  const { user } = useAuth();
  const [widgets, setWidgets] = React.useState<DashboardWidget[]>([]);
  
  const { reorder, isReordering } = useReorder({
    endpoint: `https://${projectId}.supabase.co/functions/v1/make-server-fc003b23/reorder/dashboard/widgets`,
    getAuthToken: async () => {
      const { data } = await supabase.auth.getSession();
      return data.session?.access_token || '';
    },
    onSuccess: () => {
      // No need to refetch - optimistic update already applied
      console.log('Widget order updated successfully');
    },
    errorMessage: 'Failed to reorder dashboard widgets',
  });
  
  const sortedWidgets = [...widgets].sort((a, b) => a.sort_order - b.sort_order);
  
  return (
    <div className="grid grid-cols-2 gap-4">
      {sortedWidgets.map((widget, index) => (
        <div key={widget.id} className="relative">
          {/* Widget content */}
          <WidgetCard widget={widget} />
          
          {/* Context menu in top-right corner */}
          <div className="absolute top-2 right-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <ReorderMenuItems
                  currentIndex={index}
                  totalItems={sortedWidgets.length}
                  onMoveUp={() => reorder(widget.id, 'up', sortedWidgets, setWidgets)}
                  onMoveDown={() => reorder(widget.id, 'down', sortedWidgets, setWidgets)}
                  isReordering={isReordering}
                  canReorder={true} // Always true for personal widgets
                />
                <DropdownMenuSeparator />
                <DropdownMenuItem>Configure</DropdownMenuItem>
                <DropdownMenuItem className="text-red-600">Remove</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      ))}
    </div>
  );
}
```

---

## Example 3: Policies List (Organisational Level)

### Scenario
Organisation-wide policies that Admins and Managers can reorder. Includes audit logging.

```tsx
import React from 'react';
import { Shield } from 'lucide-react';
import { ReorderMenuItems, useReorder } from '@/components/reordering';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/utils/supabase/client';
import { projectId } from '@/utils/supabase/info';

interface Policy {
  id: string;
  title: string;
  sort_order: number;
  category: string;
  is_mandatory: boolean;
  // ... other fields
}

export function PoliciesList() {
  const { user, hasPermission } = useAuth();
  const [policies, setPolicies] = React.useState<Policy[]>([]);
  
  const canReorder = hasPermission('policies', 'reorder') && 
                     ['admin', 'manager'].includes(user?.role || '');
  
  const { reorder, isReordering } = useReorder({
    endpoint: `https://${projectId}.supabase.co/functions/v1/make-server-fc003b23/reorder/policies`,
    getAuthToken: async () => {
      const { data } = await supabase.auth.getSession();
      return data.session?.access_token || '';
    },
    onSuccess: () => {
      // Policy reorder is audited server-side
      fetchPolicies();
    },
  });
  
  const sortedPolicies = [...policies].sort((a, b) => a.sort_order - b.sort_order);
  
  return (
    <div className="space-y-2">
      {sortedPolicies.map((policy, index) => (
        <div 
          key={policy.id} 
          className="flex items-center gap-3 p-4 border rounded hover:bg-slate-50"
        >
          {/* Priority indicator */}
          <div className="flex items-center justify-center w-8 h-8 rounded bg-slate-100 text-sm font-semibold">
            {index + 1}
          </div>
          
          <Shield className="h-5 w-5 text-slate-600" />
          
          <div className="flex-1">
            <h3 className="font-medium">{policy.title}</h3>
            <p className="text-sm text-slate-500">{policy.category}</p>
          </div>
          
          {policy.is_mandatory && (
            <Badge variant="destructive">Mandatory</Badge>
          )}
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <ReorderMenuItems
                currentIndex={index}
                totalItems={sortedPolicies.length}
                onMoveUp={() => reorder(policy.id, 'up', sortedPolicies, setPolicies)}
                onMoveDown={() => reorder(policy.id, 'down', sortedPolicies, setPolicies)}
                isReordering={isReordering}
                canReorder={canReorder}
              />
              <DropdownMenuSeparator />
              <DropdownMenuItem>View details</DropdownMenuItem>
              <DropdownMenuItem>Edit</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ))}
    </div>
  );
}
```

---

## Example 4: Message Templates (with Categories)

### Scenario
Message templates organized by category. Reordering applies within each category.

```tsx
import React from 'react';
import { ReorderMenuItems, useReorder } from '@/components/reordering';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/utils/supabase/client';
import { projectId } from '@/utils/supabase/info';

interface MessageTemplate {
  id: string;
  name: string;
  category: string;
  sort_order: number;
  content: string;
}

export function MessageTemplatesList() {
  const { hasPermission } = useAuth();
  const [templates, setTemplates] = React.useState<MessageTemplate[]>([]);
  const [activeCategory, setActiveCategory] = React.useState('booking');
  
  const canReorder = hasPermission('messaging', 'manage_templates');
  
  const { reorder, isReordering } = useReorder({
    endpoint: `https://${projectId}.supabase.co/functions/v1/make-server-fc003b23/reorder/message-templates`,
    getAuthToken: async () => {
      const { data } = await supabase.auth.getSession();
      return data.session?.access_token || '';
    },
    onSuccess: () => {
      fetchTemplates();
    },
  });
  
  // Filter templates by active category
  const categoryTemplates = templates
    .filter(t => t.category === activeCategory)
    .sort((a, b) => a.sort_order - b.sort_order);
  
  return (
    <div>
      {/* Category tabs */}
      <Tabs value={activeCategory} onValueChange={setActiveCategory}>
        <TabsList>
          <TabsTrigger value="booking">Booking</TabsTrigger>
          <TabsTrigger value="reminder">Reminders</TabsTrigger>
          <TabsTrigger value="marketing">Marketing</TabsTrigger>
        </TabsList>
        
        <TabsContent value={activeCategory}>
          <div className="space-y-2">
            {categoryTemplates.map((template, index) => (
              <div key={template.id} className="flex items-center justify-between p-3 border rounded">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-mono text-slate-400">
                    #{index + 1}
                  </span>
                  <div>
                    <h4 className="font-medium">{template.name}</h4>
                    <p className="text-sm text-slate-500 truncate max-w-md">
                      {template.content}
                    </p>
                  </div>
                </div>
                
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <ReorderMenuItems
                      currentIndex={index}
                      totalItems={categoryTemplates.length}
                      onMoveUp={() => reorder(template.id, 'up', categoryTemplates, setTemplates)}
                      onMoveDown={() => reorder(template.id, 'down', categoryTemplates, setTemplates)}
                      isReordering={isReordering}
                      canReorder={canReorder}
                    />
                    <DropdownMenuSeparator />
                    <DropdownMenuItem>Edit</DropdownMenuItem>
                    <DropdownMenuItem>Duplicate</DropdownMenuItem>
                    <DropdownMenuItem className="text-red-600">Delete</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
```

---

## Example 5: Custom Backend Endpoint

### Scenario
You need to add reordering to a new feature.

#### Step 1: Update backend routes

Edit `/supabase/functions/server/reorder_routes.tsx`:

```typescript
// Add your endpoint
app.post('/my-feature', createReorderEndpoint({
  kvPrefix: 'my_feature:item:',
  requiredPermission: 'reorder_location', // or 'reorder_global', 'reorder_personal'
  entityType: 'my_feature_item',
  isPersonal: false, // true for personal lists (no audit log)
}));
```

#### Step 2: Update your data model

Ensure your items have `sort_order`:

```typescript
interface MyFeatureItem {
  id: string;
  name: string;
  sort_order: number;  // Add this!
  location_id?: string;
  created_at: string;
  updated_at: string;
}
```

#### Step 3: Initialize sort_order on creation

```typescript
const createItem = async (data: any) => {
  const existingItems = await fetchItems();
  
  const newItem: MyFeatureItem = {
    id: generateId('myitem'),
    name: data.name,
    sort_order: existingItems.length + 1, // Next position
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  
  await kv.set(`my_feature:item:${newItem.id}`, newItem);
  return newItem;
};
```

#### Step 4: Use in your component

```tsx
import { ReorderMenuItems, useReorder } from '@/components/reordering';

const { reorder, isReordering } = useReorder({
  endpoint: `https://${projectId}.supabase.co/functions/v1/make-server-fc003b23/reorder/my-feature`,
  getAuthToken: async () => {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token || '';
  },
  onSuccess: refetchItems,
});

// In your render:
<ReorderMenuItems
  currentIndex={index}
  totalItems={items.length}
  onMoveUp={() => reorder(item.id, 'up', items, setItems)}
  onMoveDown={() => reorder(item.id, 'down', items, setItems)}
  isReordering={isReordering}
  canReorder={hasPermission('my_feature', 'reorder')}
/>
```

---

## Example 6: With Scope (Location-specific)

### Scenario
Items that belong to a specific location.

#### Backend setup

```typescript
// Pass scope dynamically
app.post('/location-items/:locationId', async (c) => {
  const locationId = c.req.param('locationId');
  
  return createReorderEndpoint({
    kvPrefix: 'location:item:',
    scope: {
      key: 'location_id',
      value: locationId,
    },
    requiredPermission: 'reorder_location',
    entityType: 'location_item',
    isPersonal: false,
  })(c);
});
```

#### Frontend usage

```tsx
const { reorder, isReordering } = useReorder({
  endpoint: `https://${projectId}.supabase.co/functions/v1/make-server-fc003b23/reorder/location-items/${selectedLocationId}`,
  getAuthToken: async () => {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token || '';
  },
  onSuccess: refetchItems,
});
```

---

## Troubleshooting

### Items not reordering
- Check `sort_order` field exists on all items
- Verify items are sorted by `sort_order` before rendering
- Check permissions server-side
- Check browser console for errors

### Optimistic update not working
- Ensure `setItems` is the correct state setter
- Verify `items` array is in the correct order before calling `reorder`

### Concurrent reordering issues
- The system handles this automatically with atomic swaps
- Last operation wins

### Audit log not created
- Check `isPersonal: false` in backend config
- Verify user role has permission

---

## Best Practices

1. **Always sort by sort_order** before rendering
2. **Initialize sort_order** when creating new items
3. **Use optimistic updates** for instant feedback
4. **Handle rollback** gracefully (hook does this automatically)
5. **Check permissions** both client and server side
6. **Test with multiple users** to verify concurrent behaviour
7. **Use audit logs** for non-personal lists

---

## Performance Considerations

- ✅ Optimistic updates make reordering feel instant
- ✅ Only 2 items are updated per reorder (atomic swap)
- ✅ No full list refetch needed (unless you want latest server state)
- ✅ Minimal API payload (just ID and direction)

---

**Need help?** Check the main README or review existing implementations in Dashboard, Policies, or Messaging modules.
