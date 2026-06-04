---
name: repo-auth
description: >
  The canonical authentication and authorization pattern for the PawPilotPro
  codebase. This skill should be used whenever editing, adding, or reviewing any
  backend route, Hono middleware, Supabase client creation, JWT handling, or any
  code that reads a user's role or session. It encodes how auth MUST be done in
  this repo so that broken patterns (ANON_KEY validation, local token decoding,
  reading role from user_metadata) are never reintroduced.
---

# repo-auth — how authentication works in this codebase

The source of truth is **`settings_rbac.ts`** (the `SERVICE_ROLE_KEY` validation around
line 257). When in doubt, read it and replicate it. Do not invent a new pattern.

## The five rules (non-negotiable)

1. **Every backend route goes through the shared `requireAuth` middleware.** There is no
   per-module auth. If a route does not have the guard, it is a bug.
2. **Tokens are validated server-side with `SERVICE_ROLE_KEY`.** Create the Supabase
   client with the service-role key and validate via `supabase.auth.getUser(token)`.
   The `ANON_KEY` can only *decode* a JWT, not verify its signature — it MUST NEVER be
   used to validate a token. Any forged token would otherwise be accepted.
3. **Role comes from `app_metadata` only.** `user_metadata` is client-writable: a user can
   set their own role to `admin`. Read role exclusively from `app_metadata` (server-set).
4. **Fail fast. No fallbacks.** On auth failure, return `401` (or `503` on dependency
   failure) and log it. Never fall back to local Base64 decoding. Never silently degrade
   to `ANON_KEY` when `SERVICE_ROLE_KEY` is missing — throw on startup instead.
5. **One client-side `getAuthHeaders` utility.** Send the user's access token as the
   bearer. Never send `SUPABASE_ANON_KEY` as the `Authorization` value. Do not copy this
   function into modules — import the single shared utility.

## The middleware (replicate from settings_rbac.ts)

```ts
// shared server util — the ONLY auth entry point
export async function requireAuth(c, next) {
  const token = c.req.header('Authorization')?.replace('Bearer ', '');
  if (!token) return c.json({ error: 'unauthorized' }, 401);

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY); // service-role, not anon
  const { data, error } = await supabase.auth.getUser(token);    // verifies signature
  if (error || !data?.user) return c.json({ error: 'unauthorized' }, 401);

  c.set('user', data.user);
  c.set('role', data.user.app_metadata?.role ?? null); // app_metadata ONLY
  await next();
}
```

## Checklist before finishing any auth-touching change

- [ ] Route is wrapped in `requireAuth` (list which routes you added it to).
- [ ] No `ANON_KEY` anywhere in a validation path (`grep SUPABASE_ANON_KEY`).
- [ ] No local/Base64 token decoding as a fallback (`grep atob`, `grep Buffer.from`).
- [ ] Role read from `app_metadata`, never `user_metadata` (`grep user_metadata`).
- [ ] No silent degradation: missing `SERVICE_ROLE_KEY` throws, doesn't downgrade.
- [ ] A tampered-token request returns 401 (add/keep a smoke test asserting this).
- [ ] Client uses the single `getAuthHeaders`, sending the user access token.

## What this skill must never do

Do not weaken a guard to make a test pass. If a smoke test breaks after adding auth, the
fix is to authenticate the test correctly — not to remove or loosen `requireAuth`.
