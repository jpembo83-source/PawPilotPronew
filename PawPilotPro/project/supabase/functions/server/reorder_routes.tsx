// Reorder Routes - MDC Operations Centre
// Production-grade reordering API with RBAC enforcement and audit logging
// British English throughout

import { Hono } from 'npm:hono';
import { createClient } from 'npm:@supabase/supabase-js';
import * as kv from './kv_store.tsx';

const app = new Hono();

// ============================================================================
// TYPES
// ============================================================================

interface ReorderRequest {
  item_id: string;
  direction: 'up' | 'down';
}

interface OrderedItem {
  id: string;
  sort_order: number;
  [key: string]: any;
}

interface ReorderConfig {
  /** KV prefix for fetching items (e.g., 'dashboard:widget:') */
  kvPrefix: string;
  /** Scope filter (e.g., user_id, location_id, organisation_id) */
  scope?: {
    key: string;
    value: string;
  };
  /** Required permission action */
  requiredPermission: string;
  /** Entity type for audit logging */
  entityType: string;
  /** Whether this is a personal list (no audit logging) */
  isPersonal?: boolean;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

const getSupabase = () => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing Supabase credentials');
  }
  
  return createClient(supabaseUrl, supabaseServiceKey);
};

const getUserFromToken = async (authHeader: string | null) => {
  if (!authHeader?.startsWith('Bearer ')) {
    throw new Error('Missing or invalid Authorization header');
  }
  
  const token = authHeader.substring(7);
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
  
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase credentials');
  }
  
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  
  const { data: { user }, error } = await supabase.auth.getUser();
  
  if (error || !user) {
    console.error('Token validation error:', error);
    throw new Error('Unauthorised: Invalid token');
  }
  
  return {
    id: user.id,
    email: user.email!,
    name: user.user_metadata?.name || user.email!,
    role: user.user_metadata?.role || 'staff',
    locationIds: user.user_metadata?.locationIds || [],
  };
};

const hasPermission = (userRole: string, action: string): boolean => {
  const permissions: Record<string, string[]> = {
    admin: ['reorder_global', 'reorder_location', 'reorder_personal'],
    manager: ['reorder_location', 'reorder_personal'],
    assistant_manager: ['reorder_personal'],
    staff: ['reorder_personal'],
  };
  
  return permissions[userRole]?.includes(action) || false;
};

const generateId = (prefix: string) => `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

/**
 * Core reordering logic with atomic swap
 * Returns updated items or throws error
 */
const performReorder = async (
  itemId: string,
  direction: 'up' | 'down',
  config: ReorderConfig
): Promise<{ items: OrderedItem[]; swappedWith: OrderedItem }> => {
  // Fetch all items with prefix
  const allItemsData = await kv.getByPrefix(config.kvPrefix);
  let items: OrderedItem[] = Array.isArray(allItemsData) ? allItemsData : [];

  // Apply scope filter if specified
  if (config.scope) {
    items = items.filter(item => item[config.scope!.key] === config.scope!.value);
  }

  // Sort by sort_order
  items.sort((a, b) => a.sort_order - b.sort_order);

  // Find current item
  const currentIndex = items.findIndex(item => item.id === itemId);
  if (currentIndex === -1) {
    throw new Error('Item not found in list');
  }

  // Boundary validation
  if (direction === 'up' && currentIndex === 0) {
    throw new Error('Item is already at the top of the list');
  }
  if (direction === 'down' && currentIndex === items.length - 1) {
    throw new Error('Item is already at the bottom of the list');
  }

  // Calculate target index
  const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;

  // Get items to swap
  const currentItem = items[currentIndex];
  const targetItem = items[targetIndex];

  // Swap sort_order values atomically
  const currentSortOrder = currentItem.sort_order;
  const targetSortOrder = targetItem.sort_order;

  currentItem.sort_order = targetSortOrder;
  targetItem.sort_order = currentSortOrder;

  currentItem.updated_at = new Date().toISOString();
  targetItem.updated_at = new Date().toISOString();

  // Persist both items atomically
  await kv.set(`${config.kvPrefix}${currentItem.id}`, currentItem);
  await kv.set(`${config.kvPrefix}${targetItem.id}`, targetItem);

  // Re-sort after swap
  items.sort((a, b) => a.sort_order - b.sort_order);

  return { items, swappedWith: targetItem };
};

/**
 * Create audit log entry for reorder action
 */
const createAuditLog = async (
  user: any,
  entityType: string,
  itemId: string,
  oldPosition: number,
  newPosition: number
) => {
  const auditId = generateId('audit');
  const auditEntry = {
    id: auditId,
    entity_type: entityType,
    entity_id: itemId,
    action: 'reorder',
    user_id: user.id,
    user_name: user.name,
    user_role: user.role,
    changes: {
      old_position: oldPosition,
      new_position: newPosition,
    },
    timestamp: new Date().toISOString(),
  };

  await kv.set(`audit:reorder:${auditId}`, auditEntry);
};

// ============================================================================
// GENERIC REORDER ENDPOINT
// ============================================================================

/**
 * Generic reorder endpoint
 * Can be used by any feature that needs list reordering
 */
const createReorderEndpoint = (config: ReorderConfig) => {
  return async (c: any) => {
    try {
      const user = await getUserFromToken(c.req.header('Authorization'));

      // Permission check
      if (!hasPermission(user.role, config.requiredPermission)) {
        return c.json({ error: 'Access denied: insufficient permissions to reorder' }, 403);
      }

      const body = await c.req.json() as ReorderRequest;
      const { item_id, direction } = body;

      // Validation
      if (!item_id || !direction) {
        return c.json({ error: 'Missing required fields: item_id and direction' }, 400);
      }

      if (direction !== 'up' && direction !== 'down') {
        return c.json({ error: 'Invalid direction: must be "up" or "down"' }, 400);
      }

      // Get original item for audit logging
      const originalItem = await kv.get(`${config.kvPrefix}${item_id}`) as OrderedItem | null;
      if (!originalItem) {
        return c.json({ error: 'Item not found' }, 404);
      }

      const oldPosition = originalItem.sort_order;

      // Perform atomic reorder
      const { items, swappedWith } = await performReorder(item_id, direction, config);

      // Find new position
      const updatedItem = items.find(item => item.id === item_id);
      const newPosition = updatedItem?.sort_order || oldPosition;

      // Audit logging (skip for personal lists)
      if (!config.isPersonal) {
        await createAuditLog(user, config.entityType, item_id, oldPosition, newPosition);
      }

      return c.json({
        success: true,
        message: 'Order updated successfully',
        item: updatedItem,
        swapped_with: swappedWith,
        old_position: oldPosition,
        new_position: newPosition,
      });

    } catch (error: any) {
      console.error(`Reorder error (${config.entityType}):`, error);
      return c.json(
        { error: error.message || 'Failed to reorder item' },
        error.message.includes('Unauthorised') ? 401 : 500
      );
    }
  };
};

// ============================================================================
// FEATURE-SPECIFIC ENDPOINTS
// ============================================================================

// Dashboard Widgets (personal)
app.post('/dashboard/widgets', createReorderEndpoint({
  kvPrefix: 'dashboard:widget:user:',
  requiredPermission: 'reorder_personal',
  entityType: 'dashboard_widget',
  isPersonal: true,
}));

// Quick Links (personal)
app.post('/dashboard/quick-links', createReorderEndpoint({
  kvPrefix: 'dashboard:quick_link:user:',
  requiredPermission: 'reorder_personal',
  entityType: 'quick_link',
  isPersonal: true,
}));

// Services (global - admin only)
app.post('/services', createReorderEndpoint({
  kvPrefix: 'pricing:service:',
  requiredPermission: 'reorder_global',
  entityType: 'service',
  isPersonal: false,
}));

// Policies (organisational)
app.post('/policies', createReorderEndpoint({
  kvPrefix: 'policies:policy:',
  requiredPermission: 'reorder_global',
  entityType: 'policy',
  isPersonal: false,
}));

// Message Templates (organisational)
app.post('/message-templates', createReorderEndpoint({
  kvPrefix: 'messaging:template:',
  requiredPermission: 'reorder_global',
  entityType: 'message_template',
  isPersonal: false,
}));

// Operational Rules (organisational)
app.post('/operational-rules', createReorderEndpoint({
  kvPrefix: 'operational_rule:',
  requiredPermission: 'reorder_global',
  entityType: 'operational_rule',
  isPersonal: false,
}));

// ============================================================================
// AUDIT QUERY ENDPOINT
// ============================================================================

app.get('/audit', async (c) => {
  try {
    const user = await getUserFromToken(c.req.header('Authorization'));

    // Only admins and managers can view audit logs
    if (user.role !== 'admin' && user.role !== 'manager') {
      return c.json({ error: 'Access denied' }, 403);
    }

    const entityType = c.req.query('entity_type');
    const entityId = c.req.query('entity_id');
    const limit = parseInt(c.req.query('limit') || '50');

    let auditLogs = await kv.getByPrefix('audit:reorder:') as any[] | null;
    auditLogs = Array.isArray(auditLogs) ? auditLogs : [];

    // Filter by entity type
    if (entityType) {
      auditLogs = auditLogs.filter(log => log.entity_type === entityType);
    }

    // Filter by entity ID
    if (entityId) {
      auditLogs = auditLogs.filter(log => log.entity_id === entityId);
    }

    // Sort by timestamp descending
    auditLogs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    // Apply limit
    auditLogs = auditLogs.slice(0, limit);

    return c.json(auditLogs);

  } catch (error: any) {
    console.error('Audit query error:', error);
    return c.json(
      { error: error.message || 'Failed to retrieve audit logs' },
      error.message.includes('Unauthorised') ? 401 : 500
    );
  }
});

export default app;
