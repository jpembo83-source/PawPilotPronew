import { Hono } from "npm:hono";
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js";
import * as kv from "./kv_store.tsx";
import {
  getUserFromRequest,
  requireAuth,
  requirePermission,
  logAudit,
  getAuditLogs,
  UserContext
} from "./settings_rbac.ts";
import { internalError } from "./_shared/log.ts";
import {
  TENANT_ASSETS_BUCKET,
  buildHeaderImagePath,
  canManageLocationHeader,
  clampHeaderStrength,
  normalizeFocalPoint,
  validateHeaderImageUpload,
  withSignedHeaderImage,
  withSignedHeaderImages,
  type HeaderImageSigner,
} from "./lib/location_header.ts";

const routes = new Hono();

// --- Tenant assets storage (location header images) ---
// Service role for storage; ANON_KEY is never an acceptable fallback.
let assetsAdmin: SupabaseClient | null = null;
function getAssetsAdmin(): SupabaseClient {
  if (assetsAdmin) return assetsAdmin;
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) {
    throw new Error("[app_routes] SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
  }
  assetsAdmin = createClient(url, key, { auth: { persistSession: false } });
  return assetsAdmin;
}

// PRIVATE bucket, ensured on first use (same pattern as moments/vax buckets).
let tenantAssetsEnsured = false;
async function ensureTenantAssetsBucket(): Promise<void> {
  if (tenantAssetsEnsured) return;
  const admin = getAssetsAdmin();
  const { data: buckets } = await admin.storage.listBuckets();
  if (!buckets?.some((b: { name: string }) => b.name === TENANT_ASSETS_BUCKET)) {
    await admin.storage.createBucket(TENANT_ASSETS_BUCKET, { public: false });
  }
  tenantAssetsEnsured = true;
}

const signHeaderImage: HeaderImageSigner = async (bucket, path, ttl) => {
  const { data } = await getAssetsAdmin().storage.from(bucket).createSignedUrl(path, ttl);
  return data?.signedUrl ?? null;
};

// --- Audit Logs ---

routes.get("/settings/audit-logs", requireAuth, async (c) => {
  try {
    const section = c.req.query('section');
    const limit = parseInt(c.req.query('limit') || '100');
    
    const logs = await getAuditLogs(section as any, limit);
    return c.json(logs);
  } catch (e: any) {
    return internalError(c, 'app.auditLogs', e);
  }
});

// --- Permission Templates ---
// Server-persisted in KV: localStorage is never the source of truth for
// security data. The five system templates are seeded once when the tenant
// has none; user-created templates are CRUD-able by admin/manager (enforced
// by requirePermission('users', …)). A template assigned to a user is
// referenced by app_metadata.templateId, which usePermissions resolves
// against this list — so what is stored here is what actually gates the UI.

interface TemplatePermission {
  module: string;
  action: string;
  flags?: string[];
}

interface PermissionTemplateRecord {
  id: string;
  name: string;
  description: string;
  permissions: TemplatePermission[];
  isSystem: boolean;
  created_at: string;
  updated_at: string;
  created_by?: string;
  updated_by?: string;
}

const templateKey = (tenantId: string, id: string) =>
  `settings:${tenantId}:permission_template:${id}`;
const templatePrefix = (tenantId: string) =>
  `settings:${tenantId}:permission_template:`;

// Mirrors the templates the client previously seeded into localStorage —
// same ids, so existing app_metadata.templateId assignments keep resolving.
const SYSTEM_TEMPLATES: Omit<PermissionTemplateRecord, 'created_at' | 'updated_at'>[] = [
  {
    id: 'tpl-handler',
    name: 'Daycare Handler',
    description: 'Standard access for daycare staff. Can check-in dogs and view bookings.',
    permissions: [
      { module: 'dashboard', action: 'view' },
      { module: 'daycare', action: 'view' },
      { module: 'daycare', action: 'update' },
      { module: 'customers', action: 'view' },
      { module: 'incidents', action: 'view' },
      { module: 'incidents', action: 'create' },
    ],
    isSystem: true,
  },
  {
    id: 'tpl-groomer',
    name: 'Groomer',
    description: 'Access to grooming appointments and schedule.',
    permissions: [
      { module: 'dashboard', action: 'view' },
      { module: 'grooming', action: 'view' },
      { module: 'grooming', action: 'update' },
      { module: 'customers', action: 'view' },
      { module: 'incidents', action: 'view' },
      { module: 'incidents', action: 'create' },
    ],
    isSystem: true,
  },
  {
    id: 'tpl-driver',
    name: 'Driver',
    description: 'Access to Transportation module only.',
    permissions: [
      { module: 'dashboard', action: 'view' },
      { module: 'transport', action: 'view' },
      { module: 'transport', action: 'update' },
      { module: 'customers', action: 'view' },
      { module: 'incidents', action: 'view' },
      { module: 'incidents', action: 'create' },
    ],
    isSystem: true,
  },
  {
    id: 'tpl-frontdesk',
    name: 'Front Desk',
    description: 'Full operational access excluding finance settings.',
    permissions: [
      { module: 'dashboard', action: 'view' },
      { module: 'daycare', action: 'view' },
      { module: 'daycare', action: 'create' },
      { module: 'daycare', action: 'update' },
      { module: 'grooming', action: 'view' },
      { module: 'grooming', action: 'create' },
      { module: 'grooming', action: 'update' },
      { module: 'customers', action: 'view' },
      { module: 'customers', action: 'create' },
      { module: 'customers', action: 'update' },
      { module: 'messages', action: 'view' },
      { module: 'messages', action: 'create' },
      { module: 'incidents', action: 'view' },
      { module: 'incidents', action: 'create' },
      { module: 'incidents', action: 'update' },
    ],
    isSystem: true,
  },
  {
    id: 'tpl-finance',
    name: 'Finance Viewer',
    description: 'Read-only access to billing and financial records.',
    permissions: [
      { module: 'dashboard', action: 'view' },
      { module: 'billing', action: 'view' },
      { module: 'billing', action: 'export' },
      { module: 'invoices', action: 'view' },
      { module: 'payments', action: 'view' },
    ],
    isSystem: true,
  },
];

const TEMPLATE_ACTIONS = new Set(['view', 'create', 'update', 'delete', 'export', 'approve']);

/** Validate a template payload down to exactly the fields we persist —
 *  request bodies are never spread into stored records wholesale. */
function parseTemplateBody(
  body: unknown,
): { name: string; description: string; permissions: TemplatePermission[] } | null {
  if (typeof body !== 'object' || body === null) return null;
  const b = body as Record<string, unknown>;
  const name = typeof b.name === 'string' ? b.name.trim() : '';
  if (!name) return null;
  const description = typeof b.description === 'string' ? b.description.trim() : '';
  if (!Array.isArray(b.permissions)) return null;
  const permissions: TemplatePermission[] = [];
  for (const raw of b.permissions) {
    if (typeof raw !== 'object' || raw === null) return null;
    const p = raw as Record<string, unknown>;
    if (typeof p.module !== 'string' || !p.module.trim()) return null;
    if (typeof p.action !== 'string' || !TEMPLATE_ACTIONS.has(p.action)) return null;
    const perm: TemplatePermission = { module: p.module.trim(), action: p.action };
    if (Array.isArray(p.flags) && p.flags.every((f) => typeof f === 'string')) {
      perm.flags = p.flags as string[];
    }
    permissions.push(perm);
  }
  return { name, description, permissions };
}

/** List a tenant's templates, seeding the system set exactly once. */
async function listPermissionTemplates(tenantId: string): Promise<PermissionTemplateRecord[]> {
  const existing = (await kv.getByPrefix(templatePrefix(tenantId))) as PermissionTemplateRecord[];
  if (existing && existing.length > 0) {
    return existing.sort((a, b) => a.name.localeCompare(b.name));
  }
  const now = new Date().toISOString();
  const seeded = SYSTEM_TEMPLATES.map((t) => ({ ...t, created_at: now, updated_at: now }));
  await kv.mset(
    seeded.map((t) => templateKey(tenantId, t.id)),
    seeded,
  );
  return seeded;
}

routes.get(
  "/settings/permission-templates",
  requireAuth,
  requirePermission('users', 'view'),
  async (c) => {
    try {
      const user = c.get('user') as UserContext;
      const templates = await listPermissionTemplates(user.tenantId);
      return c.json(templates);
    } catch (e: any) { return internalError(c, 'app.listPermissionTemplates', e); }
  },
);

// The caller's OWN assigned template — requireAuth only, no id parameter, so
// every role (staff included) can resolve the template that gates their UI
// without being able to enumerate or probe anyone else's.
routes.get("/settings/my-permission-template", requireAuth, async (c) => {
  try {
    const user = c.get('user') as UserContext;
    const templateId = user.app_metadata?.templateId;
    if (typeof templateId !== 'string' || !templateId) {
      return c.json(null);
    }
    const template = await kv.get(templateKey(user.tenantId, templateId));
    return c.json(template ?? null);
  } catch (e: any) { return internalError(c, 'app.myPermissionTemplate', e); }
});

routes.post(
  "/settings/permission-templates",
  requireAuth,
  requirePermission('users', 'create'),
  async (c) => {
    try {
      const user = c.get('user') as UserContext;
      const parsed = parseTemplateBody(await c.req.json());
      if (!parsed) {
        return c.json({ error: 'name and a valid permissions array are required' }, 400);
      }
      // Seed first so a fresh tenant can't collide with a system template id later.
      await listPermissionTemplates(user.tenantId);
      const now = new Date().toISOString();
      const template: PermissionTemplateRecord = {
        id: crypto.randomUUID(),
        ...parsed,
        isSystem: false,
        created_at: now,
        updated_at: now,
        created_by: user.id,
      };
      await kv.set(templateKey(user.tenantId, template.id), template);

      await logAudit(user, 'users', 'create', {
        resourceId: template.id,
        after: template,
        metadata: { resource: 'permission_template', name: template.name },
      }, c);

      return c.json(template, 201);
    } catch (e: any) { return internalError(c, 'app.createPermissionTemplate', e); }
  },
);

routes.put(
  "/settings/permission-templates/:id",
  requireAuth,
  requirePermission('users', 'update'),
  async (c) => {
    try {
      const user = c.get('user') as UserContext;
      const id = c.req.param('id');
      if (!id) return c.json({ error: 'Template not found' }, 404);
      const existing = (await kv.get(templateKey(user.tenantId, id))) as PermissionTemplateRecord | null;
      if (!existing) {
        return c.json({ error: 'Template not found' }, 404);
      }
      const parsed = parseTemplateBody(await c.req.json());
      if (!parsed) {
        return c.json({ error: 'name and a valid permissions array are required' }, 400);
      }
      // id and isSystem are server-controlled; a client can never flip them.
      const updated: PermissionTemplateRecord = {
        ...existing,
        ...parsed,
        id: existing.id,
        isSystem: existing.isSystem,
        updated_at: new Date().toISOString(),
        updated_by: user.id,
      };
      await kv.set(templateKey(user.tenantId, id), updated);

      await logAudit(user, 'users', 'update', {
        resourceId: id,
        before: existing,
        after: updated,
        metadata: { resource: 'permission_template', name: updated.name },
      }, c);

      return c.json(updated);
    } catch (e: any) { return internalError(c, 'app.updatePermissionTemplate', e); }
  },
);

routes.delete(
  "/settings/permission-templates/:id",
  requireAuth,
  requirePermission('users', 'delete'),
  async (c) => {
    try {
      const user = c.get('user') as UserContext;
      const id = c.req.param('id');
      if (!id) return c.json({ error: 'Template not found' }, 404);
      const existing = (await kv.get(templateKey(user.tenantId, id))) as PermissionTemplateRecord | null;
      if (!existing) {
        return c.json({ error: 'Template not found' }, 404);
      }
      if (existing.isSystem) {
        return c.json({ error: 'System templates cannot be deleted' }, 403);
      }
      // Never orphan an assignment: a template still gating users stays.
      const profiles = (await kv.getByPrefix(`user:${user.tenantId}:profile:`)) as Array<
        Record<string, unknown>
      >;
      const assigned = (profiles ?? []).filter((p) => p?.templateId === id);
      if (assigned.length > 0) {
        return c.json(
          { error: `Template is assigned to ${assigned.length} user(s) — reassign them first` },
          409,
        );
      }
      await kv.del(templateKey(user.tenantId, id));

      await logAudit(user, 'users', 'delete', {
        resourceId: id,
        before: existing,
        metadata: { resource: 'permission_template', name: existing.name },
      }, c);

      return c.json({ success: true });
    } catch (e: any) { return internalError(c, 'app.deletePermissionTemplate', e); }
  },
);

// --- Organisation Settings ---

routes.get("/organisation", requireAuth, requirePermission('organisation', 'view'), async (c) => {
  try {
    const org = await kv.get("settings:org");
    return c.json(org || {});
  } catch (e: any) { return internalError(c, 'app.getOrganisation', e); }
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
  } catch (e: any) { return internalError(c, 'app.updateOrganisation', e); }
});

// --- Global Modules ---

routes.get("/settings/global-modules", requireAuth, requirePermission('modules', 'view'), async (c) => {
  try {
    const modules = await kv.get("settings:global-modules");
    return c.json(modules || { globalEnabledModules: ['daycare', 'grooming'] });
  } catch (e: any) { return internalError(c, 'app.getGlobalModules', e); }
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
  } catch (e: any) { return internalError(c, 'app.updateGlobalModules', e); }
});

// --- Locations ---

routes.get("/locations", requireAuth, requirePermission('locations', 'view'), async (c) => {
  try {
    console.log('[GET /locations] ==========================================');
    console.log('[GET /locations] Request received');
    
    const user = c.get('user') as UserContext;

    const entries = await kv.getByPrefix("location:");
    console.log('[GET /locations] Found', entries.length, 'total locations in DB');
    
    // Filter by user's location access if not admin
    if (user.role !== 'admin') {
      console.log('[GET /locations] Non-admin user, filtering by locationIds:', user.locationIds);
      const filtered = entries.filter((loc: any) =>
        user.locationIds.includes(loc.id)
      );
      console.log('[GET /locations] Returning', filtered.length, 'filtered locations');
      // Header images live in the PRIVATE tenant-assets bucket — reads get
      // a short-lived signed headerImageUrl, never a public URL.
      return c.json(await withSignedHeaderImages(filtered as Record<string, unknown>[], signHeaderImage));
    }

    console.log('[GET /locations] Admin user, returning all', entries.length, 'locations');
    return c.json(await withSignedHeaderImages(entries as Record<string, unknown>[], signHeaderImage));
  } catch (e: any) {
    return internalError(c, 'app.listLocations', e);
  }
});

routes.post("/locations", requireAuth, requirePermission('locations', 'create'), async (c) => {
  try {
    console.log('[POST /locations] Request received');
    const user = c.get('user') as UserContext;
    const body = await c.req.json();
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
    return internalError(c, 'app.createLocation', e);
  }
});

routes.put("/locations/:id", requireAuth, requirePermission('locations', 'update'), async (c) => {
  try {
    const user = c.get('user') as UserContext;
    const id = c.req.param("id");
    if (!id) return c.json({ error: "Not found" }, 404);
    const body = await c.req.json();
    
    // Check location access for non-admins
    if (user.role !== 'admin' && !user.locationIds.includes(id)) {
      return c.json({ error: 'Forbidden: You do not have access to this location' }, 403);
    }
    
    const existing = await kv.get(`location:${id}`);
    if (!existing) return c.json({error: "Not found"}, 404);

    // Header image fields: the storage path is owned by the upload route —
    // a generic PUT can never point a location at an arbitrary object.
    // Strength/focal are normalised, everything derived is stripped.
    delete body.headerImagePath;
    delete body.headerImageUrl;
    if ('headerImageStrength' in body) body.headerImageStrength = clampHeaderStrength(body.headerImageStrength);
    if ('headerImageFocalPoint' in body) body.headerImageFocalPoint = normalizeFocalPoint(body.headerImageFocalPoint);

    const updated = { ...existing, ...body };
    await kv.set(`location:${id}`, updated);

    // Audit log
    await logAudit(user, 'locations', 'update', {
      resourceId: id,
      before: existing,
      after: updated,
      metadata: { fields: Object.keys(body) }
    }, c);

    return c.json(await withSignedHeaderImage(updated as Record<string, unknown>, signHeaderImage));
  } catch (e: any) { return internalError(c, 'app.updateLocation', e); }
});

// --- Location header image (dashboard banner) ---
// Cropped upload into the PRIVATE tenant-assets bucket under a
// tenant-prefixed path. Gated to the same permission as location edits
// (admin/manager); non-admins additionally must have access to the location.

routes.post("/locations/:id/header-image", requireAuth, requirePermission('locations', 'update'), async (c) => {
  try {
    const user = c.get('user') as UserContext;
    const id = c.req.param("id");
    if (!id) return c.json({ error: "Not found" }, 404);

    // Defence in depth alongside requirePermission — unit-tested mirror.
    if (!canManageLocationHeader(user.role)) {
      return c.json({ error: 'Forbidden' }, 403);
    }
    if (user.role !== 'admin' && !user.locationIds.includes(id)) {
      return c.json({ error: 'Forbidden: You do not have access to this location' }, 403);
    }

    const existing = await kv.get(`location:${id}`);
    if (!existing) return c.json({ error: "Not found" }, 404);

    const formData = await c.req.formData();
    const file = formData.get("file") as File | null;
    if (!file) return c.json({ error: "Missing file" }, 400);

    const check = validateHeaderImageUpload(file);
    if (!check.ok) return c.json({ error: check.error }, 400);

    const path = buildHeaderImagePath(user.tenantId, id, check.ext);
    if (!path) return c.json({ error: "Invalid tenant or location id" }, 400);

    await ensureTenantAssetsBucket();
    const buffer = new Uint8Array(await file.arrayBuffer());
    const { error: uploadError } = await getAssetsAdmin().storage
      .from(TENANT_ASSETS_BUCKET)
      .upload(path, buffer, { contentType: file.type, upsert: true });
    if (uploadError) {
      return internalError(c, 'app.uploadLocationHeaderImage', uploadError);
    }

    const updated = {
      ...(existing as Record<string, unknown>),
      headerImagePath: path,
      headerImageStrength: clampHeaderStrength(formData.get("strength") ?? (existing as any).headerImageStrength),
      headerImageFocalPoint: normalizeFocalPoint({
        x: formData.get("focalX") ?? (existing as any).headerImageFocalPoint?.x,
        y: formData.get("focalY") ?? (existing as any).headerImageFocalPoint?.y,
      }),
    };
    await kv.set(`location:${id}`, updated);

    await logAudit(user, 'locations', 'update', {
      resourceId: id,
      metadata: { action: 'set-header-image', path }
    }, c);

    return c.json(await withSignedHeaderImage(updated, signHeaderImage));
  } catch (e: any) { return internalError(c, 'app.uploadLocationHeaderImage', e); }
});

routes.delete("/locations/:id/header-image", requireAuth, requirePermission('locations', 'update'), async (c) => {
  try {
    const user = c.get('user') as UserContext;
    const id = c.req.param("id");
    if (!id) return c.json({ error: "Not found" }, 404);

    if (!canManageLocationHeader(user.role)) {
      return c.json({ error: 'Forbidden' }, 403);
    }
    if (user.role !== 'admin' && !user.locationIds.includes(id)) {
      return c.json({ error: 'Forbidden: You do not have access to this location' }, 403);
    }

    const existing = await kv.get(`location:${id}`) as Record<string, unknown> | null;
    if (!existing) return c.json({ error: "Not found" }, 404);

    const path = existing.headerImagePath;
    if (typeof path === 'string' && path) {
      // Best-effort object removal; the record is the source of truth.
      await getAssetsAdmin().storage.from(TENANT_ASSETS_BUCKET).remove([path]).catch(() => {});
    }

    const updated = { ...existing };
    delete updated.headerImagePath;
    delete updated.headerImageStrength;
    delete updated.headerImageFocalPoint;
    await kv.set(`location:${id}`, updated);

    await logAudit(user, 'locations', 'update', {
      resourceId: id,
      metadata: { action: 'remove-header-image' }
    }, c);

    return c.json({ ...updated, headerImageUrl: null });
  } catch (e: any) { return internalError(c, 'app.removeLocationHeaderImage', e); }
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
  } catch (e: any) { return internalError(c, 'app.deleteLocation', e); }
});

export default routes;