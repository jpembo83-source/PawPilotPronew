import { Hono } from "npm:hono";
import { requirePortalUser } from "./portal_auth.ts";

const portal = new Hono();

// Public health check — no auth.
portal.get("/health", (c) => c.json({ ok: true, scope: "portal", ts: Date.now() }));

// Authed echo — proves the middleware chain works end-to-end.
portal.get("/me", requirePortalUser, (c) => {
  const u = c.get("portalUser");
  return c.json({ authUserId: u.authUserId, customerId: u.customerId, tenantId: u.tenantId });
});

export default portal;
