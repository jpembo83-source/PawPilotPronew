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

// Batched home payload — greeting + upcoming bookings + alerts
portal.get("/home", requirePortalUser, async (c) => {
  const u = c.get("portalUser");
  const customer = (await kv.get(`customers:${u.tenantId}:${u.customerId}`)) as any;
  const tenant = (await kv.get(`tenants:${u.tenantId}`)) as any;

  const allBookings = (await kv.getAllByPrefix(`bookings:${u.tenantId}:`)) as any[];
  const now = Date.now();
  const upcoming = allBookings
    .filter(
      (b) =>
        b.customerId === u.customerId &&
        new Date(b.startAt).getTime() >= now &&
        b.status !== "cancelled",
    )
    .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime())
    .slice(0, 3);

  const pets = ((await kv.getAllByPrefix(`pets:${u.tenantId}:`)) as any[]).filter(
    (p) => p.customerId === u.customerId,
  );
  const petIds = new Set(pets.map((p) => p.id));
  const vax = ((await kv.getAllByPrefix(`vaccinations:${u.tenantId}:`)) as any[]).filter((v) =>
    petIds.has(v.petId),
  );
  const expiringSoon = vax.filter((v) => {
    const dt = new Date(v.expiresAt).getTime();
    return dt > now && dt - now < 30 * 24 * 60 * 60 * 1000;
  });

  return c.json({
    greeting: {
      firstName: customer?.primaryContactName?.split(" ")[0] ?? "there",
      tenantName: tenant?.name ?? "PawPilotPro",
    },
    upcoming,
    alerts: {
      vaxExpiring: expiringSoon.map((v) => ({
        petId: v.petId,
        vaxType: v.vaxType,
        expiresAt: v.expiresAt,
      })),
      pendingRequests: upcoming.filter((b) => b.status === "pending").length,
    },
  });
});

// Pet list — owner sees only their household's pets
portal.get("/pets", requirePortalUser, async (c) => {
  const u = c.get("portalUser");
  const list = ((await kv.getAllByPrefix(`pets:${u.tenantId}:`)) as any[]).filter(
    (p) => p.customerId === u.customerId,
  );
  return c.json({ pets: list });
});

// Pet detail + vaccinations
portal.get("/pets/:id", requirePortalUser, async (c) => {
  const u = c.get("portalUser");
  const id = c.req.param("id");
  const pet = (await kv.get(`pets:${u.tenantId}:${id}`)) as any;
  if (!pet || pet.customerId !== u.customerId) return c.json({ error: "Not found" }, 404);
  const vax = ((await kv.getAllByPrefix(`vaccinations:${u.tenantId}:`)) as any[]).filter(
    (v) => v.petId === id,
  );
  return c.json({ pet, vaccinations: vax });
});

// Request edit — emails staff in Phase 6; for now just persists the request
portal.post("/pets/:id/edit-request", requirePortalUser, async (c) => {
  const u = c.get("portalUser");
  const id = c.req.param("id");
  const body = await c.req.json().catch(() => null);
  if (!body?.note || typeof body.note !== "string") return c.json({ error: "note required" }, 400);
  const pet = (await kv.get(`pets:${u.tenantId}:${id}`)) as any;
  if (!pet || pet.customerId !== u.customerId) return c.json({ error: "Not found" }, 404);
  const reqId = crypto.randomUUID();
  await kv.set(`portal_edit_requests:${u.tenantId}:${reqId}`, {
    id: reqId,
    petId: id,
    customerId: u.customerId,
    note: body.note,
    submittedAt: new Date().toISOString(),
    status: "open",
  });
  return c.json({ ok: true, id: reqId });
});

export default portal;
