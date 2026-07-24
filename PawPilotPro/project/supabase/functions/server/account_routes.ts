// My Account routes — SELF-SERVICE ONLY.
//
// Every route here operates exclusively on the AUTHENTICATED user
// (c.get('user'), attached by the shared requireAuth middleware). There are
// no :id params anywhere — a user can never read or edit anyone else's
// account through this module.
//
// Security-bearing fields (role, permissions, tenant, locations) are
// server-set in app_metadata and are NOT touchable here:
//  - PATCH /profile passes through sanitizeProfileUpdate (name/phone only)
//    and writes name to user_metadata (display-only bag).
//  - Prefs live in a plain user-prefs KV record that grants nothing.
//  - Password changes verify the CURRENT password first (credentials grant),
//    then update via the admin API for the caller's own id.
//
// Avatar photos go to the PRIVATE tenant-assets bucket under a
// tenant-prefixed path and are served via short-lived signed URLs, exactly
// like location header images (lib/location_header.ts) and pet moments.

import { Hono } from "npm:hono";
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js";
import * as kv from "./kv_store.tsx";
import { requireAuth } from "./_shared/auth.ts";
import { internalError, logWarn } from "./_shared/log.ts";
import { TENANT_ASSETS_BUCKET } from "./lib/location_header.ts";
import {
  AVATAR_SIGNED_URL_TTL_SECONDS,
  buildAvatarPath,
  mergeAccountPrefs,
  normalizeAccountPrefs,
  sanitizeProfileUpdate,
  userPrefsKey,
  userProfileKey,
  validateAvatarUpload,
  validatePasswordChange,
} from "./lib/my_account.ts";

const app = new Hono();

// Every account route requires a validated user (SERVICE_ROLE_KEY JWT
// validation; role from app_metadata only — see _shared/auth.ts).
app.use("*", requireAuth);

// Service role for storage + admin user updates; ANON_KEY is never an
// acceptable fallback — fail fast instead (repo rule: no auth fallbacks).
let admin: SupabaseClient | null = null;
function getAdmin(): SupabaseClient {
  if (admin) return admin;
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) {
    throw new Error("[account_routes] SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
  }
  admin = createClient(url, key, { auth: { persistSession: false } });
  return admin;
}

// PRIVATE bucket, ensured on first use (same pattern as app_routes.tsx).
let tenantAssetsEnsured = false;
async function ensureTenantAssetsBucket(): Promise<void> {
  if (tenantAssetsEnsured) return;
  const client = getAdmin();
  const { data: buckets } = await client.storage.listBuckets();
  if (!buckets?.some((b: { name: string }) => b.name === TENANT_ASSETS_BUCKET)) {
    await client.storage.createBucket(TENANT_ASSETS_BUCKET, { public: false });
  }
  tenantAssetsEnsured = true;
}

async function signAvatarUrl(path: unknown): Promise<string | null> {
  if (typeof path !== "string" || !path.trim()) return null;
  const { data } = await getAdmin().storage
    .from(TENANT_ASSETS_BUCKET)
    .createSignedUrl(path.trim(), AVATAR_SIGNED_URL_TTL_SECONDS);
  return data?.signedUrl ?? null;
}

type ProfileRecord = Record<string, unknown>;

/** The caller's own Team-Directory profile record, or a minimal one derived
 *  from the authenticated token (role from app_metadata via requireAuth). */
async function loadOwnProfile(
  tenantId: string,
  user: { id: string; email: string; name: string; role: string },
): Promise<ProfileRecord> {
  const existing = (await kv.get(userProfileKey(tenantId, user.id))) as ProfileRecord | undefined;
  if (existing && typeof existing === "object") return existing;
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role, // server-set (app_metadata) — never from the request
    isActive: true,
    phone: "",
    createdAt: new Date().toISOString(),
  };
}

// --- Read own account ---------------------------------------------------

app.get("/me", async (c) => {
  try {
    const user = c.get("user");
    const [profile, prefsRaw] = await Promise.all([
      loadOwnProfile(user.tenantId, user),
      kv.get(userPrefsKey(user.tenantId, user.id)),
    ]);
    return c.json({
      profile: {
        id: user.id,
        name: typeof profile.name === "string" && profile.name ? profile.name : user.name,
        email: user.email,
        phone: typeof profile.phone === "string" ? profile.phone : "",
        role: user.role,
      },
      avatarUrl: await signAvatarUrl(profile.avatar_path),
      prefs: normalizeAccountPrefs(prefsRaw),
    });
  } catch (e) {
    return internalError(c, "account.me", e);
  }
});

// --- Profile (own name + phone) -----------------------------------------

app.patch("/profile", async (c) => {
  try {
    const user = c.get("user");
    const body = await c.req.json().catch(() => null);
    const parsed = sanitizeProfileUpdate(body);
    if (!parsed.ok) return c.json({ error: parsed.error }, 400);
    const { update } = parsed;

    // Display name lives in user_metadata (display-only bag) so AuthContext
    // keeps reading it from the session. app_metadata is never written here.
    if (update.name !== undefined) {
      const { data: existing, error: getError } = await getAdmin().auth.admin.getUserById(user.id);
      if (getError || !existing?.user) {
        return internalError(c, "account.updateProfile.getUser", getError);
      }
      const { error: updateError } = await getAdmin().auth.admin.updateUserById(user.id, {
        user_metadata: { ...(existing.user.user_metadata ?? {}), name: update.name },
      });
      if (updateError) {
        return internalError(c, "account.updateProfile.updateUser", updateError);
      }
    }

    // One edit, both places: sync the Team-Directory profile record so the
    // directory (staff_routes_new.tsx reads user:{tenant}:profile:*) stays
    // current with the same write.
    const profile = await loadOwnProfile(user.tenantId, user);
    const updated: ProfileRecord = {
      ...profile,
      ...(update.name !== undefined ? { name: update.name } : {}),
      ...(update.phone !== undefined ? { phone: update.phone } : {}),
      updatedAt: new Date().toISOString(),
    };
    await kv.set(userProfileKey(user.tenantId, user.id), updated);

    return c.json({
      ok: true,
      name: typeof updated.name === "string" ? updated.name : user.name,
      phone: typeof updated.phone === "string" ? updated.phone : "",
    });
  } catch (e) {
    return internalError(c, "account.updateProfile", e);
  }
});

// --- Avatar (own profile photo) -----------------------------------------

app.post("/avatar", async (c) => {
  try {
    const user = c.get("user");
    const formData = await c.req.formData();
    const file = formData.get("file") as File | null;
    if (!file) return c.json({ error: "Missing file" }, 400);

    const check = validateAvatarUpload(file);
    if (!check.ok) return c.json({ error: check.error }, 400);

    // Tenant prefix comes from the AUTHENTICATED user (app_metadata), the
    // object name from their own user id — nothing in the request picks the
    // destination, so an upload can never land in another tenant or user.
    const path = buildAvatarPath(user.tenantId, user.id, check.ext);
    if (!path) return c.json({ error: "Invalid account for avatar upload" }, 400);

    await ensureTenantAssetsBucket();
    const buffer = new Uint8Array(await file.arrayBuffer());
    const { error: uploadError } = await getAdmin().storage
      .from(TENANT_ASSETS_BUCKET)
      .upload(path, buffer, { contentType: file.type, upsert: true });
    if (uploadError) {
      return internalError(c, "account.uploadAvatar", uploadError);
    }

    const profile = await loadOwnProfile(user.tenantId, user);
    // A re-upload with a different extension would otherwise leave the old
    // object behind — remove it (best effort) before pointing at the new one.
    const oldPath = profile.avatar_path;
    if (typeof oldPath === "string" && oldPath && oldPath !== path) {
      await getAdmin().storage.from(TENANT_ASSETS_BUCKET).remove([oldPath]).catch(() => {});
    }
    await kv.set(userProfileKey(user.tenantId, user.id), {
      ...profile,
      avatar_path: path,
      updatedAt: new Date().toISOString(),
    });

    return c.json({ ok: true, avatarUrl: await signAvatarUrl(path) });
  } catch (e) {
    return internalError(c, "account.uploadAvatar", e);
  }
});

app.delete("/avatar", async (c) => {
  try {
    const user = c.get("user");
    const profile = await loadOwnProfile(user.tenantId, user);
    const path = profile.avatar_path;
    if (typeof path === "string" && path) {
      await getAdmin().storage.from(TENANT_ASSETS_BUCKET).remove([path]).catch(() => {});
    }
    const updated = { ...profile, updatedAt: new Date().toISOString() };
    delete (updated as Record<string, unknown>).avatar_path;
    await kv.set(userProfileKey(user.tenantId, user.id), updated);
    return c.json({ ok: true, avatarUrl: null });
  } catch (e) {
    return internalError(c, "account.removeAvatar", e);
  }
});

// --- Preferences (default location, theme, notifications) ---------------

app.put("/prefs", async (c) => {
  try {
    const user = c.get("user");
    const body = await c.req.json().catch(() => null);
    if (!body || typeof body !== "object") return c.json({ error: "Invalid body" }, 400);
    const stored = await kv.get(userPrefsKey(user.tenantId, user.id));
    const prefs = mergeAccountPrefs(stored, body);
    await kv.set(userPrefsKey(user.tenantId, user.id), {
      ...prefs,
      updatedAt: new Date().toISOString(),
    });
    return c.json({ ok: true, prefs });
  } catch (e) {
    return internalError(c, "account.updatePrefs", e);
  }
});

// --- Password (own account) ---------------------------------------------

app.post("/password", async (c) => {
  try {
    const user = c.get("user");
    const body = await c.req.json().catch(() => null);
    const parsed = validatePasswordChange(body);
    if (!parsed.ok) return c.json({ error: parsed.error }, 400);

    // Re-authenticate with the CURRENT password before changing anything.
    // This is a credentials grant (signInWithPassword), not JWT validation —
    // the service-role client is used and no session is persisted.
    const verifier = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    const { error: verifyError } = await verifier.auth.signInWithPassword({
      email: user.email,
      password: parsed.currentPassword,
    });
    if (verifyError) {
      logWarn("account.password.currentMismatch", { userId: user.id });
      return c.json({ error: "Current password is incorrect" }, 403);
    }

    // Self-scoped: the id comes from the validated token, never the body.
    const { error: updateError } = await getAdmin().auth.admin.updateUserById(user.id, {
      password: parsed.newPassword,
    });
    if (updateError) {
      return internalError(c, "account.password.update", updateError);
    }
    return c.json({ ok: true });
  } catch (e) {
    return internalError(c, "account.password", e);
  }
});

export default app;
