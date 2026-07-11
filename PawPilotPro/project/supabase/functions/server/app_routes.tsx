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