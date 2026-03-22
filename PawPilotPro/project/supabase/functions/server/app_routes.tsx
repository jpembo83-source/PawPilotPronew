import { Hono } from "npm:hono";
import * as kv from "./kv_store.tsx";
import { 
  getUserFromRequest, 
  requireAuth, 
  requirePermission, 
  logAudit,
  getAuditLogs,
  UserContext 
} from "./settings_rbac.ts";

const routes = new Hono();

// --- Audit Logs ---

routes.get("/settings/audit-logs", requireAuth, async (c) => {
  try {
    const section = c.req.query('section');
    const limit = parseInt(c.req.query('limit') || '100');
    
    const logs = await getAuditLogs(section as any, limit);
    return c.json(logs);
  } catch (e: any) { 
    console.error('Error fetching audit logs:', e);
    return c.json({error: e.message}, 500); 
  }
});

// --- Organisation Settings ---

routes.get("/organisation", requireAuth, requirePermission('organisation', 'view'), async (c) => {
  try {
    const org = await kv.get("settings:org");
    return c.json(org || {});
  } catch (e: any) { return c.json({error: e.message}, 500); }
});

routes.put("/organisation", requireAuth, requirePermission('organisation', 'update'), async (c) => {
  try {
    const user = c.get('user') as UserContext;
    const body = await c.req.json();
    const before = await kv.get("settings:org");
    
    await kv.set("settings:org", body);
    
    // Audit log
    await logAudit(user, 'organisation', 'update', {
      before,
      after: body,
      metadata: { fields: Object.keys(body) }
    }, c);
    
    return c.json(body);
  } catch (e: any) { return c.json({error: e.message}, 500); }
});

// --- Global Modules ---

routes.get("/settings/global-modules", requireAuth, requirePermission('modules', 'view'), async (c) => {
  try {
    const modules = await kv.get("settings:global-modules");
    return c.json(modules || { globalEnabledModules: ['daycare', 'grooming'] });
  } catch (e: any) { return c.json({error: e.message}, 500); }
});

routes.put("/settings/global-modules", requireAuth, requirePermission('modules', 'update'), async (c) => {
  try {
    const user = c.get('user') as UserContext;
    const body = await c.req.json();
    const before = await kv.get("settings:global-modules");
    
    await kv.set("settings:global-modules", body);
    
    // Audit log
    await logAudit(user, 'modules', 'update', {
      before,
      after: body,
      metadata: { action: 'toggle-global-modules' }
    }, c);
    
    return c.json(body);
  } catch (e: any) { return c.json({error: e.message}, 500); }
});

// --- Locations ---

routes.get("/locations", requireAuth, requirePermission('locations', 'view'), async (c) => {
  try {
    console.log('[GET /locations] ==========================================');
    console.log('[GET /locations] Request received');
    
    const user = c.get('user') as UserContext;
    console.log('[GET /locations] User from context:', user);
    console.log('[GET /locations] User role:', user?.role);
    console.log('[GET /locations] User email:', user?.email);
    
    const entries = await kv.getByPrefix("location:");
    console.log('[GET /locations] Found', entries.length, 'total locations in DB');
    
    // Filter by user's location access if not admin
    if (user.role !== 'admin') {
      console.log('[GET /locations] Non-admin user, filtering by locationIds:', user.locationIds);
      const filtered = entries.filter((loc: any) => 
        user.locationIds.includes(loc.id)
      );
      console.log('[GET /locations] Returning', filtered.length, 'filtered locations');
      return c.json(filtered);
    }
    
    console.log('[GET /locations] Admin user, returning all', entries.length, 'locations');
    return c.json(entries);
  } catch (e: any) { 
    console.error('[GET /locations] Error:', e.message);
    console.error('[GET /locations] Stack:', e.stack);
    return c.json({error: e.message}, 500); 
  }
});

routes.post("/locations", requireAuth, requirePermission('locations', 'create'), async (c) => {
  try {
    console.log('[POST /locations] Request received');
    const user = c.get('user') as UserContext;
    console.log('[POST /locations] User from context:', user);
    const body = await c.req.json();
    console.log('[POST /locations] Request body:', body);
    const id = body.id || crypto.randomUUID();
    const item = { ...body, id };
    
    await kv.set(`location:${id}`, item);
    
    // Audit log
    await logAudit(user, 'locations', 'create', {
      resourceId: id,
      after: item,
      metadata: { name: item.name }
    }, c);
    
    console.log('[POST /locations] Location created successfully:', id);
    return c.json(item);
  } catch (e: any) { 
    console.error('[POST /locations] Error:', e.message);
    return c.json({error: e.message}, 500); 
  }
});

routes.put("/locations/:id", requireAuth, requirePermission('locations', 'update'), async (c) => {
  try {
    const user = c.get('user') as UserContext;
    const id = c.req.param("id");
    const body = await c.req.json();
    
    // Check location access for non-admins
    if (user.role !== 'admin' && !user.locationIds.includes(id)) {
      return c.json({ error: 'Forbidden: You do not have access to this location' }, 403);
    }
    
    const existing = await kv.get(`location:${id}`);
    if (!existing) return c.json({error: "Not found"}, 404);
    
    const updated = { ...existing, ...body };
    await kv.set(`location:${id}`, updated);
    
    // Audit log
    await logAudit(user, 'locations', 'update', {
      resourceId: id,
      before: existing,
      after: updated,
      metadata: { fields: Object.keys(body) }
    }, c);
    
    return c.json(updated);
  } catch (e: any) { return c.json({error: e.message}, 500); }
});

routes.delete("/locations/:id", requireAuth, requirePermission('locations', 'delete'), async (c) => {
  try {
    const user = c.get('user') as UserContext;
    const id = c.req.param("id");
    const existing = await kv.get(`location:${id}`);
    
    await kv.del(`location:${id}`);
    
    // Audit log
    await logAudit(user, 'locations', 'delete', {
      resourceId: id,
      before: existing,
      metadata: { name: existing?.name }
    }, c);
    
    return c.json({success: true});
  } catch (e: any) { return c.json({error: e.message}, 500); }
});

export default routes;