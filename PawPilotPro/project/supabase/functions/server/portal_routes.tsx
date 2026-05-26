import { Hono } from "npm:hono";
import { z } from "npm:zod";
import { createClient } from "npm:@supabase/supabase-js";
import * as kv from "./kv_store.tsx";
import { requirePortalUser } from "./portal_auth.ts";

const portal = new Hono();

// Public health check — no auth.
portal.get("/health", (c) => c.json({ ok: true, scope: "portal", ts: Date.now() }));

// Authed echo — proves the middleware chain works end-to-end.
portal.get("/me", requirePortalUser, (c) => {
  const u = c.get("portalUser");
  return c.json({ authUserId: u.authUserId, customerId: u.customerId, tenantId: u.tenantId });
});

const acceptSchema = z.object({
  token: z.string().min(40),
  password: z.string().min(10).max(128),
});

// Public — invite-token-gated, creates the portal Auth user
portal.post("/auth/accept-invite", async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = acceptSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: parsed.error.format() }, 400);
  const { token, password } = parsed.data;

  // Find the invite by scanning prefix (tenantId is part of the key but not in URL)
  const allInvites = await kv.getAllByPrefix(`portal_invites:`);
  const found = (allInvites as any[]).find(i => i.token === token);
  if (!found) return c.json({ error: "Invalid or expired link" }, 410);
  if (found.consumedAt) return c.json({ error: "Link already used" }, 410);
  if (new Date(found.expiresAt).getTime() < Date.now()) return c.json({ error: "Link expired" }, 410);

  const { tenantId, customerId } = found;
  const customer = (await kv.get(`customers:${tenantId}:${customerId}`)) as any;
  if (!customer) return c.json({ error: "Customer record missing" }, 410);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(supabaseUrl, serviceKey);

  const { data: created, error } = await admin.auth.admin.createUser({
    email: customer.primaryEmail,
    password,
    email_confirm: true,
    user_metadata: { portal_user: true, tenantId, customerId },
  });
  if (error || !created.user) return c.json({ error: error?.message ?? "Account creation failed" }, 500);

  await kv.set(`portal_users:${tenantId}:${customerId}`, {
    authUserId: created.user.id,
    customerId,
    tenantId,
    notificationPrefs: { booking: true, vax: true, marketing: false },
    createdAt: new Date().toISOString(),
  });
  await kv.set(`portal_invites:${tenantId}:${token}`, { ...found, consumedAt: new Date().toISOString() });

  const { data: signIn, error: signInErr } = await admin.auth.signInWithPassword({
    email: customer.primaryEmail,
    password,
  });
  if (signInErr || !signIn.session) {
    return c.json({ ok: true, message: "Account created — please sign in" }, 200);
  }

  return c.json({
    ok: true,
    session: { accessToken: signIn.session.access_token, refreshToken: signIn.session.refresh_token },
  });
});

export default portal;
