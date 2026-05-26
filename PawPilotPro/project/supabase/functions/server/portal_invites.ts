import { Hono } from "npm:hono";
import * as kv from "./kv_store.tsx";
import { requireAuth } from "./settings_rbac.ts";
import { getEmailSender } from "./lib/email.ts";
import { inviteEmail } from "./lib/email_templates/invite.ts";

const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

const invites = new Hono();

invites.post(
  "/customers/:customerId/portal-invite",
  requireAuth,
  async (c) => {
    const { customerId } = c.req.param();
    const user = c.get("user");
    const tenantId = user.tenantId;

    const customerKey = `customers:${tenantId}:${customerId}`;
    const customer = await kv.get(customerKey);
    if (!customer) return c.json({ error: "Customer not found" }, 404);

    const existingLink = await kv.get(`portal_users:${tenantId}:${customerId}`);
    if (existingLink) return c.json({ error: "Customer already has portal access" }, 409);

    const token = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
    const expiresAt = new Date(Date.now() + TWENTY_FOUR_HOURS_MS).toISOString();
    await kv.set(`portal_invites:${tenantId}:${token}`, {
      customerId,
      tenantId,
      token,
      createdBy: user.id,
      createdAt: new Date().toISOString(),
      expiresAt,
      consumedAt: null,
    });

    const portalBase = Deno.env.get("PORTAL_BASE_URL") ?? "https://portal.pawpilotpro.app";
    const acceptUrl = `${portalBase}/accept-invite?token=${token}`;

    const tenant = await kv.get(`tenants:${tenantId}`);
    const tenantName = (tenant as any)?.name ?? "PawPilotPro";

    try {
      const { subject, html, text } = inviteEmail({
        ownerName: (customer as any).primaryContactName ?? "there",
        tenantName,
        acceptUrl,
        expiresInHours: 24,
      });
      await getEmailSender().send({ to: (customer as any).primaryEmail, subject, html, text });
    } catch (e) {
      console.error("Invite email failed", e);
      return c.json({ ok: true, expiresAt, emailWarning: "Email could not be sent — share link manually", acceptUrl }, 200);
    }

    return c.json({ ok: true, expiresAt });
  },
);

invites.get(
  "/customers/:customerId/portal-activity",
  requireAuth,
  async (c) => {
    const { customerId } = c.req.param();
    const user = c.get("user");
    const link = await kv.get(`portal_users:${user.tenantId}:${customerId}`);
    const allInvites = await kv.getAllByPrefix(`portal_invites:${user.tenantId}:`);
    const pending = (allInvites as any[]).filter(
      i => i.customerId === customerId && !i.consumedAt && new Date(i.expiresAt) > new Date(),
    );
    return c.json({ link, pendingInvites: pending });
  },
);

invites.post(
  "/customers/:customerId/portal-revoke",
  requireAuth,
  async (c) => {
    const { customerId } = c.req.param();
    const user = c.get("user");
    const link = (await kv.get(`portal_users:${user.tenantId}:${customerId}`)) as any;
    if (!link) return c.json({ error: "No portal link" }, 404);
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const { createClient } = await import("npm:@supabase/supabase-js");
    const admin = createClient(supabaseUrl, serviceKey);
    await admin.auth.admin.updateUserById(link.authUserId, { ban_duration: "876000h" });
    await kv.del(`portal_users:${user.tenantId}:${customerId}`);
    return c.json({ ok: true });
  },
);

export default invites;
