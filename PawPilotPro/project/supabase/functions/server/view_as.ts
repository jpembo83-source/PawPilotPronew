// View As Backend - MDC Operations Centre
// Allows authorised users to safely view the platform as another user would see it

import { Hono } from 'npm:hono';
import * as kv from './kv_store.tsx';
import { requireAuth } from './_shared/auth.ts';

const app = new Hono();

// Every view-as (impersonation) route requires a validated user.
app.use('*', requireAuth);

// --- Utility Functions ---

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

function getCurrentTimestamp(): string {
  return new Date().toISOString();
}

function createAuditLog(sessionId: string, viewerId: string, viewAsId: string, action: string, details?: any) {
  return kv.set(`view_as:audit:${generateId()}`, {
    id: generateId(),
    session_id: sessionId,
    viewer_user_id: viewerId,
    view_as_user_id: viewAsId,
    action,
    details,
    timestamp: getCurrentTimestamp(),
  });
}

// --- Validation Functions ---

async function canViewAsUser(viewerRole: string, targetUserId: string, viewerLocations: string[]): Promise<boolean> {
  // Admin can view as anyone except other admins
  if (viewerRole === 'admin') {
    const targetUser = await kv.get(`user:${targetUserId}`);
    return targetUser && targetUser.role !== 'admin';
  }

  // Manager can view as staff they manage (in their locations)
  if (viewerRole === 'manager') {
    const targetUser = await kv.get(`user:${targetUserId}`);
    if (!targetUser) return false;
    
    // Can only view staff/assistant manager
    if (!['staff', 'assistant_manager'].includes(targetUser.role)) {
      return false;
    }

    // Must share at least one location
    const targetLocations = targetUser.locations || [];
    return targetLocations.some((loc: string) => viewerLocations.includes(loc));
  }

  return false;
}

// --- Start View As Session ---

app.post('/start', async (c) => {
  const data = await c.req.json();
  const { view_as_user_id, reason } = data;

  // Identity always comes from the verified JWT, never from the request body
  const jwtUser = c.get('user') as { id: string };
  const viewer_user_id = jwtUser.id;

  // Get viewer details
  const viewer = await kv.get(`user:${viewer_user_id}`);
  if (!viewer) {
    return c.json({ error: 'Viewer user not found' }, 404);
  }

  // Get target user details
  const targetUser = await kv.get(`user:${view_as_user_id}`);
  if (!targetUser) {
    return c.json({ error: 'Target user not found' }, 404);
  }

  // Validate permission to view as target user
  const canView = await canViewAsUser(viewer.role, view_as_user_id, viewer.locations || []);
  if (!canView) {
    await createAuditLog('blocked', viewer_user_id, view_as_user_id, 'session_blocked', { reason: 'Insufficient permissions' });
    return c.json({ error: 'You do not have permission to view as this user' }, 403);
  }

  // End any existing active session for this viewer
  const existingSessions = await kv.getByPrefix(`view_as:session:active:${viewer_user_id}:`);
  for (const session of existingSessions || []) {
    await kv.del(`view_as:session:active:${viewer_user_id}:${session.id}`);
    await kv.set(`view_as:session:${session.id}`, {
      ...session,
      ended_at: getCurrentTimestamp(),
      is_active: false,
    });
  }

  // Create new session
  const sessionId = generateId();
  const session = {
    id: sessionId,
    viewer_user_id,
    viewer_user_name: viewer.name,
    viewer_role: viewer.role,
    view_as_user_id,
    view_as_user_name: targetUser.name,
    view_as_user_role: targetUser.role,
    started_at: getCurrentTimestamp(),
    reason,
    is_active: true,
  };

  await kv.set(`view_as:session:${sessionId}`, session);
  await kv.set(`view_as:session:active:${viewer_user_id}:${sessionId}`, session);

  // Audit log
  await createAuditLog(sessionId, viewer_user_id, view_as_user_id, 'session_started', { reason });

  // Return target user's full context
  return c.json({
    session,
    target_user: {
      id: targetUser.id,
      name: targetUser.name,
      email: targetUser.email,
      role: targetUser.role,
      locations: targetUser.locations || [],
      permissions: targetUser.permissions || [],
      enabled_modules: targetUser.enabled_modules || [],
    },
  }, 201);
});

// --- End View As Session ---

app.post('/end', async (c) => {
  const data = await c.req.json();
  const { session_id } = data;

  // Identity always comes from the verified JWT
  const jwtUser = c.get('user') as { id: string };
  const viewer_user_id = jwtUser.id;

  const session = await kv.get(`view_as:session:${session_id}`);
  if (!session) {
    return c.json({ error: 'Session not found' }, 404);
  }

  if (session.viewer_user_id !== viewer_user_id) {
    return c.json({ error: 'Unauthorized' }, 403);
  }

  // End session
  const updated = {
    ...session,
    ended_at: getCurrentTimestamp(),
    is_active: false,
  };

  await kv.set(`view_as:session:${session_id}`, updated);
  await kv.del(`view_as:session:active:${viewer_user_id}:${session_id}`);

  // Audit log
  await createAuditLog(session_id, viewer_user_id, session.view_as_user_id, 'session_ended');

  return c.json({ success: true, session: updated });
});

// --- Get Active Session ---

app.get('/active/:viewer_user_id', async (c) => {
  // Always use the authenticated user's identity; ignore the path param to prevent IDOR
  const jwtUser = c.get('user') as { id: string };
  const viewerId = jwtUser.id;
  const sessions = await kv.getByPrefix(`view_as:session:active:${viewerId}:`);
  
  if (!sessions || sessions.length === 0) {
    return c.json(null);
  }

  return c.json(sessions[0]);
});

// --- Block Mutation (Validation Endpoint) ---

app.post('/validate-action', async (c) => {
  const data = await c.req.json();
  const { session_id, action_type } = data;

  const session = await kv.get(`view_as:session:${session_id}`);
  if (!session || !session.is_active) {
    return c.json({ allowed: true }); // Not in view-as mode
  }

  // All mutations are blocked
  const mutationActions = ['create', 'update', 'delete', 'approve', 'send', 'export'];
  const isBlocked = mutationActions.some(m => action_type.toLowerCase().includes(m));

  if (isBlocked) {
    await createAuditLog(session_id, session.viewer_user_id, session.view_as_user_id, 'action_blocked', { action_type });
  }

  return c.json({ allowed: !isBlocked, reason: isBlocked ? 'This action is disabled in View As mode' : null });
});

// --- Get Sessions (for audit) ---

app.get('/sessions', async (c) => {
  const sessions = await kv.getByPrefix('view_as:session:');
  const filtered = (sessions || []).filter((s: any) => !s.id.includes(':active:'));
  const sorted = filtered.sort(
    (a: any, b: any) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime()
  );
  return c.json(sorted);
});

// --- Get Audit Logs ---

app.get('/audit-logs', async (c) => {
  const logs = await kv.getByPrefix('view_as:audit:');
  const sorted = (logs || []).sort(
    (a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
  return c.json(sorted);
});

// --- Seed Data ---

app.post('/seed', async (c) => {
  // Create sample users if they don't exist
  await kv.set('user:admin-1', {
    id: 'admin-1',
    name: 'Admin User',
    email: 'admin@mdc.com',
    role: 'admin',
    locations: ['loc1', 'loc2', 'loc3'],
    permissions: ['*'],
    enabled_modules: ['daycare', 'grooming', 'boutique', 'transport', 'overnights'],
  });

  await kv.set('user:manager-1', {
    id: 'manager-1',
    name: 'Sarah Manager',
    email: 'sarah@mdc.com',
    role: 'manager',
    locations: ['loc1'],
    permissions: ['booking.view', 'booking.create', 'customer.view', 'reports.view'],
    enabled_modules: ['daycare', 'grooming'],
  });

  await kv.set('user:staff-1', {
    id: 'staff-1',
    name: 'John Staff',
    email: 'john@mdc.com',
    role: 'staff',
    locations: ['loc1'],
    permissions: ['booking.view', 'customer.view'],
    enabled_modules: ['daycare'],
  });

  return c.json({ success: true, message: 'View As seed data created' });
});

export default app;
