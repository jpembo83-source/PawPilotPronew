import { createClient } from "npm:@supabase/supabase-js";
import type { Context, MiddlewareHandler } from "npm:hono";

export interface PortalUserCtx {
  authUserId: string;
  email: string;
  tenantId: string;
  customerId: string;
}

declare module "npm:hono" {
  interface ContextVariableMap {
    portalUser: PortalUserCtx;
  }
}

export const requirePortalUser: MiddlewareHandler = async (c: Context, next) => {
  const userTokenHeader = c.req.header("X-User-Token");
  if (!userTokenHeader?.startsWith("Bearer ")) return c.json({ error: "Missing user token" }, 401);
  const token = userTokenHeader.slice("Bearer ".length);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(supabaseUrl, serviceKey);

  const { data: userResp, error } = await admin.auth.getUser(token);
  if (error || !userResp.user) return c.json({ error: "Invalid session" }, 401);
  const u = userResp.user;

  if (u.user_metadata?.portal_user !== true) {
    return c.json({ error: "Not a portal account" }, 403);
  }

  const tenantId = u.user_metadata?.tenantId as string | undefined;
  const customerId = u.user_metadata?.customerId as string | undefined;
  if (!tenantId || !customerId) return c.json({ error: "Portal account not linked" }, 403);

  c.set("portalUser", {
    authUserId: u.id,
    email: u.email!,
    tenantId,
    customerId,
  });
  await next();
};
