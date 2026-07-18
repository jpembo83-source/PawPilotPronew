// ============================================================================
// SEED ROUTE GUARD — sample-data endpoints must not be reachable in production
// ============================================================================
// Repo rule (CLAUDE.md): no debug/seed routes in code paths reachable in
// production; seeding is CLI-first, gated by SEED_ENABLED. Module sample-data
// seed endpoints answer 404 unless SEED_ENABLED=true is explicitly set on the
// environment — the same flag that gates the bootstrap seed-admin endpoint in
// index.tsx. Runs after the global requireAuth, before any role gate, so a
// production caller learns nothing about the route's existence.

import { Context } from "npm:hono";
import { logWarn } from "./log.ts";

export async function requireSeedEnabled(c: Context, next: () => Promise<void>) {
  if (Deno.env.get("SEED_ENABLED") !== "true") {
    logWarn("seed.blocked", { method: c.req.method, path: c.req.path });
    return c.json({ error: "not_found" }, 404);
  }
  await next();
}
