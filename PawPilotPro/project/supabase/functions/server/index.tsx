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
import { requireAuth, requirePermission, UserContext } from "./settings_rbac.ts";

const app = new Hono();

// Enable logger
app.use('*', logger(console.log));

// Enable CORS
app.use(
  "/*",
  cors({
    origin: "*",
    allowHeaders: ["Content-Type", "Authorization", "X-User-Token", "X-Tenant-Id"],
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
  }),
);

// Setup Supabase Admin Client
// CRITICAL: Must use SERVICE_ROLE_KEY for JWT validation - ANON key cannot validate user tokens
const supabaseUrl = Deno.env.get("SUPABASE_URL");
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

console.log("[Server Init] Environment check:");
console.log("[Server Init] SUPABASE_URL:", supabaseUrl ? "✓ SET" : "✗ MISSING");
console.log("[Server Init] SUPABASE_SERVICE_ROLE_KEY:", supabaseServiceKey ? "✓ SET" : "✗ MISSING");
console.log("[Server Init] SUPABASE_ANON_KEY:", Deno.env.get("SUPABASE_ANON_KEY") ? "✓ SET" : "✗ MISSING");

// Check if we have the required credentials
if (!supabaseUrl || !supabaseServiceKey) {
  console.error("[Server Init] ⚠️ CRITICAL: Missing required environment variables!");
  console.error("[Server Init] The backend CANNOT validate JWT tokens without SUPABASE_SERVICE_ROLE_KEY");
  console.error("[Server Init] All authenticated endpoints will fail with 401 errors");
  console.error("[Server Init] Please configure these secrets in your Supabase project settings");
}

const getSupabase = () => {
  // Fallback to ANON key only as last resort (will not work for JWT validation)
  const url = supabaseUrl || "https://ruahrxkfgfyshuxykiay.supabase.co";
  const key = supabaseServiceKey || Deno.env.get("SUPABASE_ANON_KEY") || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ1YWhyeGtmZ2Z5c2h1eHlraWF5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY4NDUxMTcsImV4cCI6MjA4MjQyMTExN30.gG65FbgAYdrjbLAgKJRscIGwbcHwyuEAGa5M_o_fYeU";
  
  if (!supabaseServiceKey) {
    console.warn("[getSupabase] ⚠️ WARNING: Using ANON key fallback - JWT validation will FAIL");
  }
  
  return createClient(url, key);
};

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

// Test POST endpoint (no auth required)
app.post("/make-server-fc003b23/test-post", async (c) => {
  console.log('[TEST-POST] Request received!');
  const body = await c.req.json().catch(() => ({}));
  console.log('[TEST-POST] Body:', body);
  return c.json({ success: true, received: body });
});

// Check environment configuration
app.get("/make-server-fc003b23/check-env", (c) => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const hasServiceKey = !!Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const hasAnonKey = !!Deno.env.get("SUPABASE_ANON_KEY");
  const hasDbUrl = !!Deno.env.get("SUPABASE_DB_URL");
  
  // Get the actual keys (first 20 chars only for security)
  const serviceKeyPreview = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.substring(0, 20) + "...";
  const anonKeyPreview = Deno.env.get("SUPABASE_ANON_KEY")?.substring(0, 20) + "...";
  
  return c.json({ 
    supabaseUrl,
    hasServiceKey,
    hasAnonKey,
    hasDbUrl,
    serviceKeyPreview: hasServiceKey ? serviceKeyPreview : "NOT SET",
    anonKeyPreview: hasAnonKey ? anonKeyPreview : "NOT SET",
    expectedUrl: "https://ruahrxkfgfyshuxykiay.supabase.co",
    message: hasServiceKey 
      ? "✓ All environment variables are properly configured!"
      : "✗ SUPABASE_SERVICE_ROLE_KEY is missing - running in development mode"
  });
});

// Debug endpoint to check KV store user profiles
app.get("/make-server-fc003b23/debug-users", async (c) => {
  try {
    console.log('[Debug Users] Fetching all user profiles from KV store');
    
    const allUsersRaw = await kv.getByPrefix('user:demo-tenant-001:profile:');
    console.log('[Debug Users] Found', allUsersRaw.length, 'user profiles');
    
    const users = allUsersRaw.map((item, index) => {
      try {
        // Check if already an object
        if (typeof item === 'object' && item !== null) {
          console.log(`[Debug Users] User ${index} (already object):`, item);
          return item;
        }
        // If string, parse it
        const parsed = JSON.parse(item);
        console.log(`[Debug Users] User ${index} (parsed):`, parsed);
        return parsed;
      } catch (e) {
        console.error('[Debug Users] Failed to parse user:', e);
        return { error: 'Failed to parse', raw: item };
      }
    });
    
    return c.json({
      count: users.length,
      users,
      rawCount: allUsersRaw.length,
    });
  } catch (err: any) {
    console.error('[Debug Users] Error:', err);
    return c.json({ error: err.message }, 500);
  }
});

// Debug endpoint to compare Supabase Auth users vs KV store
app.get("/make-server-fc003b23/debug-auth-users", async (c) => {
  try {
    const supabase = getSupabase();
    
    // Get all users from Supabase Auth
    const { data: { users: authUsers }, error } = await supabase.auth.admin.listUsers();
    if (error) {
      return c.json({ error: error.message }, 500);
    }
    
    // Get all user profiles from KV store
    const kvUsersRaw = await kv.getByPrefix('user:demo-tenant-001:profile:');
    const kvUsers = kvUsersRaw.map(item => {
      if (typeof item === 'object' && item !== null) return item;
      try { return JSON.parse(item); } catch { return null; }
    }).filter(u => u !== null);
    
    // Compare
    const authUserIds = authUsers.map(u => u.id);
    const kvUserIds = kvUsers.map((u: any) => u.id);
    
    const inAuthNotKv = authUsers.filter(u => !kvUserIds.includes(u.id));
    const inKvNotAuth = kvUsers.filter((u: any) => !authUserIds.includes(u.id));
    
    return c.json({
      authUsersCount: authUsers.length,
      kvUsersCount: kvUsers.length,
      authUsers: authUsers.map(u => ({
        id: u.id,
        email: u.email,
        role: u.user_metadata?.role,
        name: u.user_metadata?.name,
        tenant_id: u.user_metadata?.tenant_id || u.user_metadata?.tenantId,
      })),
      kvUsers: kvUsers,
      inAuthNotKv: inAuthNotKv.map(u => ({
        id: u.id,
        email: u.email,
        role: u.user_metadata?.role,
        name: u.user_metadata?.name,
      })),
      inKvNotAuth: inKvNotAuth,
    });
  } catch (err: any) {
    console.error('[Debug Auth Users] Error:', err);
    return c.json({ error: err.message }, 500);
  }
});

// Sync endpoint to create KV store profiles for Auth users that are missing them
app.post("/make-server-fc003b23/sync-users", async (c) => {
  try {
    const supabase = getSupabase();
    const tenantId = 'demo-tenant-001';
    
    console.log('[Sync Users] Starting user sync for tenant:', tenantId);
    
    // Get all users from Supabase Auth
    const { data: { users: authUsers }, error: authError } = await supabase.auth.admin.listUsers();
    if (authError) {
      console.error('[Sync Users] Failed to fetch auth users:', authError);
      return c.json({ error: authError.message }, 500);
    }
    
    console.log('[Sync Users] Found', authUsers.length, 'auth users');
    
    // Get all user profiles from KV store
    const kvUsersRaw = await kv.getByPrefix(`user:${tenantId}:profile:`);
    const kvUsers = kvUsersRaw.map(item => {
      if (typeof item === 'object' && item !== null) return item;
      try { return JSON.parse(item); } catch { return null; }
    }).filter(u => u !== null);
    
    const kvUserIds = kvUsers.map((u: any) => u.id);
    console.log('[Sync Users] Found', kvUsers.length, 'KV store profiles');
    
    // Find users that need KV profiles
    const usersNeedingProfiles = authUsers.filter(u => !kvUserIds.includes(u.id));
    console.log('[Sync Users] Found', usersNeedingProfiles.length, 'users needing KV profiles');
    
    const syncResults = [];
    
    for (const authUser of usersNeedingProfiles) {
      try {
        const userId = authUser.id;
        const metadata = authUser.user_metadata || {};
        
        // Parse name
        const fullName = metadata.name || authUser.email?.split('@')[0] || 'Unknown User';
        const nameParts = fullName.split(' ');
        const firstName = nameParts[0] || '';
        const lastName = nameParts.slice(1).join(' ') || '';
        
        // Create KV store profile
        const userProfile = {
          id: userId,
          email: authUser.email || '',
          first_name: firstName,
          last_name: lastName,
          name: fullName,
          role: metadata.role || 'staff',
          phone: metadata.phone || '',
          isActive: true,
          createdAt: authUser.created_at,
          lastLogin: authUser.last_sign_in_at || null,
          updatedAt: new Date().toISOString(),
          locationIds: ['all'],
          permissions: [],
        };
        
        await kv.set(`user:${tenantId}:profile:${userId}`, userProfile);
        console.log('[Sync Users] Created KV profile for user:', userId, authUser.email);
        
        // Update Auth metadata to include tenant_id if missing
        const currentTenantId = metadata.tenant_id || metadata.tenantId;
        if (!currentTenantId) {
          await supabase.auth.admin.updateUserById(userId, {
            user_metadata: {
              ...metadata,
              tenant_id: tenantId,
              tenantId: tenantId,
            },
          });
          console.log('[Sync Users] Updated Auth metadata with tenant_id for user:', userId);
        }
        
        syncResults.push({
          userId,
          email: authUser.email,
          status: 'success',
          actions: ['created_kv_profile', !currentTenantId ? 'updated_tenant_id' : null].filter(Boolean),
        });
      } catch (err: any) {
        console.error('[Sync Users] Failed to sync user:', authUser.id, err);
        syncResults.push({
          userId: authUser.id,
          email: authUser.email,
          status: 'error',
          error: err.message,
        });
      }
    }
    
    return c.json({
      success: true,
      totalAuthUsers: authUsers.length,
      totalKvUsers: kvUsers.length,
      usersSynced: usersNeedingProfiles.length,
      syncResults,
    });
  } catch (err: any) {
    console.error('[Sync Users] Error:', err);
    return c.json({ error: err.message }, 500);
  }
});

// Test auth endpoint to debug JWT validation
app.get("/make-server-fc003b23/test-auth", async (c) => {
  try {
    // Read from X-User-Token header (where the actual user JWT is)
    const xUserToken = c.req.header('X-User-Token');
    console.log('[test-auth] X-User-Token header present:', !!xUserToken);
    
    if (!xUserToken || !xUserToken.startsWith('Bearer ')) {
      return c.json({ error: 'No X-User-Token header' }, 401);
    }
    
    const token = xUserToken.split(' ')[1];
    console.log('[test-auth] Token length:', token?.length);
    console.log('[test-auth] Token (first 50 chars):', token?.substring(0, 50));
    
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    
    console.log('[test-auth] Backend Supabase URL:', supabaseUrl);
    console.log('[test-auth] Has service key:', !!supabaseServiceKey);
    
    // DEVELOPMENT MODE: If SERVICE_ROLE_KEY is not available, decode JWT payload without validation
    if (!supabaseServiceKey) {
      console.warn('[test-auth] ⚠️ DEVELOPMENT MODE: No SERVICE_ROLE_KEY - decoding JWT without validation');
      
      try {
        // Decode JWT payload (without signature verification)
        const parts = token.split('.');
        if (parts.length !== 3) {
          return c.json({ error: 'Invalid JWT format' }, 401);
        }
        
        const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
        console.log('[test-auth] Decoded JWT payload:', payload);
        
        return c.json({ 
          success: true,
          developmentMode: true,
          user: {
            id: payload.sub,
            email: payload.email,
            role: payload.user_metadata?.role,
            metadata: payload.user_metadata
          }
        });
      } catch (decodeError) {
        console.error('[test-auth] Failed to decode JWT:', decodeError);
        return c.json({ error: 'Failed to decode JWT' }, 401);
      }
    }
    
    // PRODUCTION MODE: Validate JWT with Supabase
    const supabase = getSupabase();
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error) {
      console.log('[test-auth] Error:', error);
      return c.json({ 
        error: 'Auth failed', 
        message: error.message,
        details: error,
        backendUrl: supabaseUrl
      }, 401);
    }
    
    if (!user) {
      return c.json({ error: 'No user' }, 401);
    }
    
    return c.json({ 
      success: true,
      user: {
        id: user.id,
        email: user.email,
        role: user.user_metadata?.role,
        metadata: user.user_metadata
      }
    });
  } catch (err: any) {
    console.error('[test-auth] Exception:', err);
    return c.json({ error: err.message }, 500);
  }
});

// Development endpoint to seed admin user
app.post("/make-server-fc003b23/seed-admin", async (c) => {
  try {
    const supabase = getSupabase();
    
    // Check if admin already exists
    const { data: { users }, error: listError } = await supabase.auth.admin.listUsers();
    if (listError) {
      console.error("List users error:", listError);
      return c.json({ error: listError.message }, 500);
    }
    
    const existingAdmin = users?.find(u => u.email === 'admin@mdcoperations.com');
    if (existingAdmin) {
      console.log("Admin user already exists");
      
      // Check if admin has tenant_id, if not, update it
      if (!existingAdmin.user_metadata?.tenant_id && !existingAdmin.user_metadata?.tenantId) {
        console.log("Admin exists but missing tenant_id, updating...");
        const { data: updateData, error: updateError } = await supabase.auth.admin.updateUserById(
          existingAdmin.id,
          {
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
        role: existingAdmin.user_metadata?.role || 'manager',
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
        email: "admin@mdcoperations.com",
        alreadyExists: true,
        profile: userProfile
      });
    }
    
    // Create admin user with tenant_id
    const { data, error } = await supabase.auth.admin.createUser({
      email: 'admin@mdcoperations.com',
      password: 'Admin123!',
      email_confirm: true,
      user_metadata: { 
        role: 'manager',
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
      email: "admin@mdcoperations.com",
      user: data.user 
    });
  } catch (err: any) {
    console.error("Server error:", err);
    return c.json({ error: err.message }, 500);
  }
});

// --- User Management Routes ---

// Create User
app.post("/make-server-fc003b23/users", async (c) => {
  try {
    const supabase = getSupabase();
    const body = await c.req.json();
    const { email, password, role, name, locationIds, permissions, templateId, tenant_id, tenantId } = body;
    
    // Get tenant ID from body or token
    const finalTenantId = tenant_id || tenantId;

    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password: password || 'tempPass123!', // Require password or default
      email_confirm: true,
      user_metadata: { role, name, locationIds, permissions, templateId, tenant_id: finalTenantId, tenantId: finalTenantId }
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
        role: role || 'staff',
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
app.put("/make-server-fc003b23/users/:id", async (c) => {
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
    
    const metadataUpdates: any = {};
    if (body.role) metadataUpdates.role = body.role;
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
          role: body.role || data.user.user_metadata?.role || 'staff',
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
app.delete("/make-server-fc003b23/users/:id", async (c) => {
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
app.get("/make-server-fc003b23/users", async (c) => {
  try {
    const supabase = getSupabase();
    const { data: { users }, error } = await supabase.auth.admin.listUsers();
    
    if (error) return c.json({ error: error.message }, 400);
    
    const mappedUsers = users.map(u => ({
      id: u.id,
      email: u.email,
      name: u.user_metadata?.name || u.email,
      role: u.user_metadata?.role || 'staff',
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

export default app;