import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import { createClient } from "npm:@supabase/supabase-js";
import * as kv from "./kv_store.tsx";
import appRoutes from "./app_routes.tsx";
import pricingRoutes from "./pricing_routes.tsx";
import overnightsRoutes from "./overnights_routes.tsx";
import pricingApprovalsRoutes from "./pricing_approvals_routes.tsx";
import customersRoutes from "./customers_routes.tsx";
import messagingRoutes from "./messaging.ts";
import operationalRulesRoutes from "./operational_rules.ts";
import communicationsSettingsRoutes from "./communications_settings.ts";
import billingFinanceSettingsRoutes from "./billing_finance_settings.ts";
import dataComplianceRoutes from "./data_compliance.ts";
import integrationsSettingsRoutes from "./integrations_settings.ts";
import systemRoutes from "./system.ts";
import viewAsRoutes from "./view_as.ts";
import billingRoutes from "./billing_routes.tsx";
import policiesRoutes from "./policies_routes.tsx";
import incidentsRoutes from "./incidents_routes.tsx";
import daycareRoutes from "./daycare_routes.tsx";
import reorderRoutes from "./reorder_routes.tsx";
import petPhotoUploadRoutes from "./pet_photo_upload.tsx";
import staffRoutes from "./staff_routes_new.tsx";
import vaccinationsRoutes from "./vaccinations_routes.tsx";
import transportRoutes from "./transport_routes.tsx";
import groomingRoutes from "./grooming_routes.tsx";
import reportsRoutes from "./reports_routes.tsx";
import calendarRoutes from "./calendar_routes.tsx";
import portalRoutes from "./portal_routes.tsx";
import portalInvites from "./portal_invites.ts";
import portalBookings from "./portal_bookings.ts";
import { requireAuth, requirePermission, UserContext } from "./settings_rbac.ts";

const app = new Hono();

// Enable logger
app.use('*', logger(console.log));

// Enable CORS — explicit origin allowlist, never "*".
// Extend via ALLOWED_ORIGINS (comma-separated) in Edge Function secrets.
const ALLOWED_ORIGINS = new Set(
  [
    "https://mdc.pawpilotpro.com",
    "http://localhost:5173",
    ...(Deno.env.get("ALLOWED_ORIGINS")?.split(",").map((o) => o.trim()) ?? []),
  ].filter(Boolean),
);

app.use(
  "/*",
  cors({
    origin: (origin) => (ALLOWED_ORIGINS.has(origin) ? origin : null),
    allowHeaders: ["Content-Type", "Authorization", "X-User-Token", "X-Tenant-Id"],
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
  }),
);

// Setup Supabase Admin Client
// CRITICAL: Must use SERVICE_ROLE_KEY for JWT validation — ANON key cannot validate user tokens.
// Fail fast on missing config: ANON is NEVER an acceptable fallback for privileged operations.
const supabaseUrl = Deno.env.get("SUPABASE_URL");
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

console.log("[Server Init] Environment check:");
console.log("[Server Init] SUPABASE_URL:", supabaseUrl ? "✓ SET" : "✗ MISSING");
console.log("[Server Init] SUPABASE_SERVICE_ROLE_KEY:", supabaseServiceKey ? "✓ SET" : "✗ MISSING");

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error(
    "[Server Init] SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required. " +
    "Refusing to start with broken auth. Configure both in the Supabase project secrets."
  );
}

const getSupabase = () => createClient(supabaseUrl, supabaseServiceKey);

// Health check
app.get("/make-server-fc003b23/health", (c) => {
  return c.json({ status: "ok" });
});

// Initialize storage buckets on startup
(async () => {
  try {
    const supabase = getSupabase();
    const bucketName = 'make-fc003b23-pet-photos';
    
    // Check if bucket exists
    const { data: buckets } = await supabase.storage.listBuckets();
    const bucketExists = buckets?.some(bucket => bucket.name === bucketName);
    
    if (!bucketExists) {
      console.log('[Storage Init] Creating pet photos bucket...');
      const { error } = await supabase.storage.createBucket(bucketName, {
        public: true,
        fileSizeLimit: 5242880, // 5MB
        allowedMimeTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
        // Disable RLS to allow public uploads from authenticated users
        // The bucket is public for reading, but we handle upload permissions via auth
      });
      
      if (error) {
        // Ignore "already exists" error (409)
        if (error.statusCode === '409' || error.message?.includes('already exists')) {
          console.log('[Storage Init] ✓ Pet photos bucket already exists (concurrent creation)');
        } else {
          console.error('[Storage Init] Failed to create bucket:', error);
        }
      } else {
        console.log('[Storage Init] ✓ Pet photos bucket created successfully');
      }
    } else {
      console.log('[Storage Init] ✓ Pet photos bucket already exists');
    }
    
    // Note: Storage policies must be configured in Supabase Dashboard
    // Required policy for authenticated uploads:
    // CREATE POLICY "Authenticated users can upload"
    // ON storage.objects FOR INSERT
    // TO authenticated
    // WITH CHECK (bucket_id = 'make-fc003b23-pet-photos');
    
  } catch (error) {
    console.error('[Storage Init] Error initializing storage:', error);
  }
})();

// Development endpoint to seed admin user
app.post("/make-server-fc003b23/seed-admin", async (c) => {
  try {
    // Bootstrap-only endpoint. Creating an admin with a known password must not
    // be reachable in production — gate it behind an explicit env flag (the
    // canonical path is the CLI backfill script, not an HTTP route).
    if (Deno.env.get("SEED_ENABLED") !== "true") {
      return c.json({ error: "not_found" }, 404);
    }

    // Never hardcode the bootstrap credential — require it from the environment.
    const seedEmail = Deno.env.get("SEED_ADMIN_EMAIL");
    const seedPassword = Deno.env.get("SEED_ADMIN_PASSWORD");
    if (!seedEmail || !seedPassword) {
      console.error("[Seed Admin] SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD not set; refusing to seed");
      return c.json({ error: "seed_unavailable" }, 503);
    }

    const supabase = getSupabase();

    // Check if admin already exists
    const { data: { users }, error: listError } = await supabase.auth.admin.listUsers();
    if (listError) {
      console.error("List users error:", listError);
      return c.json({ error: listError.message }, 500);
    }

    const existingAdmin = users?.find(u => u.email === seedEmail);
    if (existingAdmin) {
      console.log("Admin user already exists");

      // Check if admin has tenant_id, if not, update it
      if (!existingAdmin.user_metadata?.tenant_id && !existingAdmin.user_metadata?.tenantId) {
        console.log("Admin exists but missing tenant_id, updating...");
        const { error: updateError } = await supabase.auth.admin.updateUserById(
          existingAdmin.id,
          {
            // Role lives in app_metadata (server-set, untamperable). The
            // user_metadata mirror is retained as a transitional copy and
            // will be dropped once 1B.3 cleanup completes.
            app_metadata: {
              ...(existingAdmin.app_metadata ?? {}),
              role: 'manager',
            },
            user_metadata: {
              ...existingAdmin.user_metadata,
              role: 'manager',
              name: 'System Administrator',
              tenant_id: 'demo-tenant-001',
              tenantId: 'demo-tenant-001',
              locationIds: ['all'],
              permissions: []
            }
          }
        );

        if (updateError) {
          console.error("Update admin error:", updateError);
        } else {
          console.log("Admin user updated with tenant_id");
        }
      }

      // Always ensure profile exists in KV store for existing admin
      const userProfile = {
        id: existingAdmin.id,
        email: existingAdmin.email,
        name: existingAdmin.user_metadata?.name || 'System Administrator',
        role: existingAdmin.app_metadata?.role || 'manager',
        locationIds: existingAdmin.user_metadata?.locationIds || ['all'],
        permissions: existingAdmin.user_metadata?.permissions || [],
        isActive: true,
        phone: existingAdmin.user_metadata?.phone || '',
        createdAt: existingAdmin.created_at,
        updatedAt: new Date().toISOString(),
        lastLogin: null,
      };

      await kv.set(`user:demo-tenant-001:profile:${existingAdmin.id}`, userProfile);
      console.log('[Seed Admin] Saved/updated existing admin profile to KV store');

      return c.json({
        message: "Admin user already exists",
        email: seedEmail,
        alreadyExists: true,
        profile: userProfile
      });
    }

    // Create admin user with tenant_id
    const { data, error } = await supabase.auth.admin.createUser({
      email: seedEmail,
      password: seedPassword,
      email_confirm: true,
      // Role is the security-bearing field — it lives in app_metadata so the
      // client cannot self-promote via supabase.auth.updateUser.
      app_metadata: { role: 'manager' },
      user_metadata: {
        name: 'System Administrator',
        tenant_id: 'demo-tenant-001',
        tenantId: 'demo-tenant-001',
        locationIds: ['all'],
        permissions: []
      }
    });

    if (error) {
      console.error("Create admin error:", error);
      return c.json({ error: error.message }, 400);
    }
    
    // Also save to KV store for staff management integration
    const userProfile = {
      id: data.user.id,
      email: data.user.email,
      name: 'System Administrator',
      role: 'manager',
      locationIds: ['all'],
      permissions: [],
      isActive: true,
      phone: '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lastLogin: null,
    };
    
    await kv.set(`user:demo-tenant-001:profile:${data.user.id}`, userProfile);
    console.log('[Seed Admin] Saved admin profile to KV store');

    console.log("Admin user created successfully");
    return c.json({
      message: "Admin user created successfully",
      email: seedEmail,
      user: data.user
    });
  } catch (err: any) {
    console.error("Server error:", err);
    return c.json({ error: err.message }, 500);
  }
});

// --- User Management Routes ---

// Create User
app.post("/make-server-fc003b23/users", requireAuth, requirePermission('users', 'create'), async (c) => {
  try {
    const supabase = getSupabase();
    const caller = c.get('user') as UserContext;
    const body = await c.req.json();
    const { email, password, role, name, locationIds, permissions, templateId, tenant_id, tenantId } = body;

    // Never fall back to a guessable default password — require an explicit one.
    if (!password || typeof password !== "string" || password.length < 8) {
      return c.json({ error: "A password of at least 8 characters is required" }, 400);
    }

    // Role must not exceed the caller's own role
    const ROLE_RANK: Record<string, number> = { admin: 4, manager: 3, assistant_manager: 2, staff: 1 };
    const callerRank = ROLE_RANK[caller.role] ?? 0;
    const assignedRole = role && ROLE_RANK[role] !== undefined ? role : 'staff';
    if (ROLE_RANK[assignedRole] > callerRank) {
      return c.json({ error: 'You cannot assign a role higher than your own' }, 403);
    }

    // Get tenant ID from body (validated caller is already authenticated)
    const finalTenantId = tenant_id || tenantId;

    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      // Role lives in app_metadata (server-set, untamperable). Non-role
      // profile fields stay in user_metadata.
      app_metadata: { role: assignedRole },
      user_metadata: { name, locationIds, permissions, templateId, tenant_id: finalTenantId, tenantId: finalTenantId }
    });

    if (error) {
      console.error("Create User Error:", error);
      return c.json({ error: error.message }, 400);
    }
    
    // Also save to KV store for staff management integration
    if (finalTenantId && data.user) {
      const userProfile = {
        id: data.user.id,
        email: data.user.email,
        name: name || data.user.email,
        role: assignedRole,
        locationIds: locationIds || [],
        permissions: permissions || [],
        templateId,
        isActive: true,
        phone: body.phone || '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        lastLogin: null,
      };
      
      await kv.set(`user:${finalTenantId}:profile:${data.user.id}`, userProfile);
      console.log('[Create User] Saved user profile to KV store:', data.user.id);
    }

    return c.json(data.user);
  } catch (err: any) {
    console.error("Server Error:", err);
    return c.json({ error: err.message }, 500);
  }
});

// Update User
app.put("/make-server-fc003b23/users/:id", requireAuth, requirePermission('users', 'update'), async (c) => {
  try {
    const supabase = getSupabase();
    const id = c.req.param("id");
    const body = await c.req.json();
    
    const updates: any = {};
    if (body.password) updates.password = body.password;
    if (body.email) updates.email = body.email;
    if (body.isActive !== undefined) {
       if (body.isActive === false) {
         updates.ban_duration = "876000h"; // 100 years
       } else {
         updates.ban_duration = "none";
       }
    }

    // Role is the security-bearing field — write it to app_metadata so the
    // user cannot self-promote via supabase.auth.updateUser on the client.
    if (body.role) {
      const { data: existing } = await supabase.auth.admin.getUserById(id);
      updates.app_metadata = {
        ...(existing?.user?.app_metadata ?? {}),
        role: body.role,
      };
    }

    const metadataUpdates: any = {};
    if (body.name) metadataUpdates.name = body.name;
    if (body.locationIds) metadataUpdates.locationIds = body.locationIds;
    if (body.permissions) metadataUpdates.permissions = body.permissions;
    if (body.templateId !== undefined) metadataUpdates.templateId = body.templateId;

    if (Object.keys(metadataUpdates).length > 0) {
      updates.user_metadata = metadataUpdates;
    }

    const { data, error } = await supabase.auth.admin.updateUserById(id, updates);

    if (error) {
      console.error("Update User Error:", error);
      return c.json({ error: error.message }, 400);
    }
    
    // Also update KV store for staff management integration
    if (data.user) {
      const tenantId = data.user.user_metadata?.tenant_id || data.user.user_metadata?.tenantId;
      if (tenantId) {
        // Fetch existing profile
        const existingProfile = await kv.get(`user:${tenantId}:profile:${id}`);
        
        const userProfile = {
          ...(existingProfile || {}),
          id: data.user.id,
          email: body.email || data.user.email,
          name: body.name || data.user.user_metadata?.name || data.user.email,
          role: body.role || data.user.app_metadata?.role || 'staff',
          locationIds: body.locationIds || data.user.user_metadata?.locationIds || [],
          permissions: body.permissions || data.user.user_metadata?.permissions || [],
          templateId: body.templateId !== undefined ? body.templateId : data.user.user_metadata?.templateId,
          isActive: body.isActive !== undefined ? body.isActive : !data.user.banned_until,
          phone: body.phone || existingProfile?.phone || '',
          updatedAt: new Date().toISOString(),
          createdAt: existingProfile?.createdAt || new Date().toISOString(),
          lastLogin: existingProfile?.lastLogin || null,
        };
        
        await kv.set(`user:${tenantId}:profile:${id}`, userProfile);
        console.log('[Update User] Updated user profile in KV store:', id);
      }
    }

    return c.json(data.user);
  } catch (err: any) {
    console.error("Server Error:", err);
    return c.json({ error: err.message }, 500);
  }
});

// Delete User
app.delete("/make-server-fc003b23/users/:id", requireAuth, requirePermission('users', 'delete'), async (c) => {
  try {
    const supabase = getSupabase();
    const id = c.req.param("id");
    
    // Get user before deleting to get tenant ID
    const { data: userData } = await supabase.auth.admin.getUserById(id);
    const tenantId = userData?.user?.user_metadata?.tenant_id || userData?.user?.user_metadata?.tenantId;
    
    const { data, error } = await supabase.auth.admin.deleteUser(id);
    
    if (error) {
      return c.json({ error: error.message }, 400);
    }
    
    // Also delete from KV store
    if (tenantId) {
      await kv.del(`user:${tenantId}:profile:${id}`);
      console.log('[Delete User] Removed user profile from KV store:', id);
    }
    
    return c.json({ success: true });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// List Users
app.get("/make-server-fc003b23/users", requireAuth, requirePermission('users', 'view'), async (c) => {
  try {
    const supabase = getSupabase();
    const { data: { users }, error } = await supabase.auth.admin.listUsers();
    
    if (error) return c.json({ error: error.message }, 400);
    
    const mappedUsers = users.map(u => ({
      id: u.id,
      email: u.email,
      name: u.user_metadata?.name || u.email,
      role: u.app_metadata?.role || 'staff',
      locationIds: u.user_metadata?.locationIds || [],
      permissions: u.user_metadata?.permissions || [],
      templateId: u.user_metadata?.templateId,
      isActive: !u.banned_until,
      lastLogin: u.last_sign_in_at
    }));

    return c.json(mappedUsers);
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// --- Mount Additional Routes ---
app.route("/make-server-fc003b23", appRoutes);
app.route("/make-server-fc003b23/pricing", pricingRoutes);
app.route("/make-server-fc003b23/overnights", overnightsRoutes);
app.route("/make-server-fc003b23/pricing-approvals", pricingApprovalsRoutes);
app.route("/make-server-fc003b23/customers", customersRoutes);
app.route("/", messagingRoutes);
app.route("/", operationalRulesRoutes);
app.route("/", communicationsSettingsRoutes);
app.route("/make-server-fc003b23/billing-finance", billingFinanceSettingsRoutes);
app.route("/make-server-fc003b23/data-compliance", dataComplianceRoutes);
app.route("/make-server-fc003b23/integrations", integrationsSettingsRoutes);
app.route("/make-server-fc003b23/system", systemRoutes);
app.route("/make-server-fc003b23/view-as", viewAsRoutes);
app.route("/make-server-fc003b23/billing", billingRoutes);
app.route("/make-server-fc003b23/policies", policiesRoutes);
app.route("/make-server-fc003b23/incidents", incidentsRoutes);
app.route("/make-server-fc003b23/daycare", daycareRoutes);
app.route("/make-server-fc003b23/reorder", reorderRoutes);
app.route("/make-server-fc003b23/pet-photo-upload", petPhotoUploadRoutes);
app.route("/make-server-fc003b23/staff", staffRoutes);
app.route("/", vaccinationsRoutes);
app.route("/make-server-fc003b23/transport", transportRoutes);
app.route("/make-server-fc003b23/grooming", groomingRoutes);
app.route("/make-server-fc003b23/reports", reportsRoutes);
app.route("/make-server-fc003b23/calendar", calendarRoutes);
// Portal (owner app). These sub-apps carry their own auth: requirePortalUser
// for owner endpoints, staff-role checks for /portal-admin, and a
// SERVICE_ROLE_KEY bearer comparison for /portal/internal/tracker-event.
app.route("/make-server-fc003b23/portal", portalRoutes);
app.route("/make-server-fc003b23/portal-admin", portalInvites);
// portal_bookings contains BOTH /portal/* and /portal-admin/* endpoints, mount at root.
app.route("/make-server-fc003b23", portalBookings);

export default app;