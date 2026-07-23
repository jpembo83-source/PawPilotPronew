// ============================================================================
// SHARED AUTH MIDDLEWARE — the ONE auth entry point for every backend route
// ============================================================================
// Validates the user's access token server-side with SERVICE_ROLE_KEY via
// supabase.auth.getUser() (verifies the JWT signature). Reads role exclusively
// from app_metadata (server-set, untamperable from the client). No fallbacks.
// No local/Base64 decoding. No ANON_KEY validation. No silent degradation.
//
// See docs/remediation-prompt-book.md item 1B.1 and .claude/skills/repo-auth.

import { Context } from "npm:hono";
import { createClient } from "npm:@supabase/supabase-js";
import { logWarn } from "./log.ts";

export type Role = 'admin' | 'manager' | 'assistant_manager' | 'staff';

const VALID_ROLES = ['admin', 'manager', 'assistant_manager', 'staff'] as const;

/**
 * Resolve the STAFF role from app_metadata, or null when this token must not
 * reach staff routes. Pure — unit-tested in
 * tests/unit/staff-role-guard.test.ts.
 *
 * The invariant: staff access requires a valid, server-set staff role.
 * Customer portal accounts are created WITHOUT a role (portal accept-invite
 * sets only portal_user/tenant/household), so they are rejected here — a
 * missing role must never default to 'staff' (repo rule: fail fast, no auth
 * fallbacks); that default is what let customer logins reach staff endpoints.
 * Note portal_user itself is NOT a reject signal: a staff member who also
 * accepted a portal invite (dual account) carries portal_user AND a real
 * role, and keeps staff access.
 */
export function resolveStaffRole(
  appMetadata: Record<string, unknown> | null | undefined,
): Role | null {
  const role = appMetadata?.role;
  return typeof role === 'string' && (VALID_ROLES as readonly string[]).includes(role)
    ? (role as Role)
    : null;
}

export interface AuthenticatedUser {
  id: string;
  role: Role;
  locationIds: string[];
  email: string;
  name: string;
  /**
   * Tenant the request operates within. Sourced exclusively from app_metadata
   * (server-set, untamperable) via `metaField`. Falls back to user.id when no
   * tenant is set (matches existing route behaviour). Do NOT use this for
   * cross-tenant authorisation without a server-side check.
   */
  tenantId: string;
  /**
   * Raw user_metadata (client-writable). Surfaced here so legacy route code
   * that reads display fields like `user.user_metadata?.full_name` keeps
   * type-checking — but treat anything in here as UNTRUSTED. Never read role
   * or any other security-bearing field from this bag; use `role` (sourced
   * from app_metadata) instead.
   */
  user_metadata?: {
    name?: string;
    full_name?: string;
    [key: string]: unknown;
  };
  /**
   * Raw app_metadata (server-set, untamperable from the client). Surfaced
   * here so legacy route code that reads `user.app_metadata?.role` keeps
   * type-checking after the validator returns AuthenticatedUser.
   */
  app_metadata?: {
    role?: string;
    [key: string]: unknown;
  };
}

// Hono module augmentation — makes `c.get('user')` and `c.set('user', …)`
// type-check as AuthenticatedUser across every route module without any of
// them needing to import or declare the type themselves. The augmentation
// must match the import specifier route files actually use, which is the
// npm-prefixed form below.
declare module "npm:hono" {
  interface ContextVariableMap {
    user: AuthenticatedUser;
  }
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

// Fail fast. ANON_KEY can decode a JWT but cannot verify its signature, so
// degrading to it would let any forged token through. If the operator has not
// configured a service role, the function must refuse to start.
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error(
    '[auth] SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for JWT validation. ' +
    'Refusing to start with broken auth. Set both in the Supabase project secrets.'
  );
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

/**
 * Read a security-bearing metadata field from app_metadata ONLY (server-set,
 * untamperable from the client). user_metadata is never consulted: the
 * production backfill mirrored every user's security fields into
 * app_metadata and all server writers write app_metadata directly.
 */
export function metaField<T = unknown>(
  user: {
    app_metadata?: Record<string, unknown> | null;
  },
  field: string,
): T | undefined {
  const appValue = user.app_metadata?.[field];
  return appValue === null ? undefined : (appValue as T | undefined);
}

/**
 * Extract the bearer token from the `Authorization` header. The legacy
 * `X-User-Token` header is intentionally NOT read here: the shared client
 * `getAuthHeaders` puts the user's access token in `Authorization`, so there is
 * exactly one place a route ever has to look.
 */
function extractBearerToken(c: Context): string | null {
  const header = c.req.header('Authorization');
  const token = header?.replace(/^Bearer\s+/i, '').trim();
  return token && token.length > 0 ? token : null;
}

/**
 * Validate a user's access token and return their authenticated profile, or
 * null on any failure. No fallbacks — if signature verification fails or the
 * token is missing, this returns null and the caller short-circuits.
 */
export async function validateUserToken(c: Context): Promise<AuthenticatedUser | null> {
  const token = extractBearerToken(c);
  if (!token) return null;

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) return null;

  const u = data.user;
  // Role MUST come from app_metadata. user_metadata is client-writable, so
  // reading role from there lets users self-promote. See 1B.3 for the migration
  // that ensures every existing user has app_metadata.role set.
  const appMetadata = (u.app_metadata ?? {}) as AuthenticatedUser['app_metadata'] & Record<string, unknown>;
  const userMetadata = (u.user_metadata ?? {}) as AuthenticatedUser['user_metadata'] & Record<string, unknown>;

  // Customer portal accounts and role-less tokens are rejected outright —
  // a valid signature alone does not make a token a STAFF token.
  const role = resolveStaffRole(appMetadata);
  if (role === null) {
    logWarn('auth.staff_access_denied', {
      userId: u.id,
      portalUser: appMetadata?.portal_user === true,
      hasRole: typeof appMetadata?.role === 'string',
      method: c.req.method,
      path: c.req.path,
    });
    return null;
  }

  // Tenant and locations are authorization-bearing: read from app_metadata
  // only (via metaField). user_metadata is never consulted.
  const tenantId =
    metaField<string>(u, 'tenant_id') ??
    metaField<string>(u, 'tenantId') ??
    u.id;

  return {
    id: u.id,
    role,
    locationIds: metaField<string[]>(u, 'locationIds') ?? [],
    email: u.email ?? '',
    name: (userMetadata?.name as string) ?? u.email ?? 'Unknown',
    tenantId,
    user_metadata: userMetadata,
    app_metadata: appMetadata,
  };
}

/**
 * Hono middleware. Validates the bearer token, attaches the authenticated user
 * to context as `user`, and continues. Returns 401 on any failure — no retries,
 * no fallbacks, no local decoding.
 */
export async function requireAuth(c: Context, next: () => Promise<void>) {
  const user = await validateUserToken(c);
  if (!user) {
    return c.json({ error: 'unauthorized' }, 401);
  }
  c.set('user', user);
  await next();
}

/**
 * Hono middleware factory: only the given roles get past this point.
 * Must be registered AFTER `requireAuth` — it reads the already-verified user
 * from context (role sourced from app_metadata by validateUserToken). If no
 * user is present the request is treated as unauthenticated (401), never
 * fail-open. On a role miss the client gets a generic 403 + correlation ID;
 * who was denied what is logged server-side only.
 */
export function requireRole(...allowed: Role[]) {
  return async (c: Context, next: () => Promise<void>) => {
    const user = c.get('user') as AuthenticatedUser | undefined;
    if (!user) {
      return c.json({ error: 'unauthorized' }, 401);
    }
    if (!allowed.includes(user.role)) {
      const correlationId = crypto.randomUUID();
      logWarn('rbac.role_denied', {
        correlationId,
        userId: user.id,
        role: user.role,
        allowed,
        method: c.req.method,
        path: c.req.path,
      });
      return c.json({ error: 'forbidden', correlationId }, 403);
    }
    await next();
  };
}
