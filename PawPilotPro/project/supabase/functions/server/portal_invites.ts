// Staff-callable portal admin endpoints — send invite / view activity / revoke.
// Uses v2 KV schema: customer:{tenantId}:household:{id}, customer:{tenantId}:contact:{householdId}:{contactId}.
// Mirrors v2's auth pattern (read X-User-Token + getTenantId) instead of the simplified requireAuth context.

import { Hono } from "npm:hono";
import { createClient } from "npm:@supabase/supabase-js";
import * as kv from "./kv_store.tsx";
import { getEmailSender } from "./lib/email.ts";
import { inviteEmail } from "./lib/email_templates/invite.ts";
import { notify, getOwnerEmail, getOwnerName } from "./lib/notify.ts";
import { vaxApprovedEmail } from "./lib/email_templates/vax_approved.ts";
import { vaxRejectedEmail } from "./lib/email_templates/vax_rejected.ts";
import { internalError, logError } from "./_shared/log.ts";

const PORTAL_BASE_URL = Deno.env.get("PORTAL_BASE_URL") ?? "http://localhost:5175";

const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

const invites = new Hono();

async function getUserFromToken(token: string) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  // Token validation uses SERVICE_ROLE_KEY (repo rule: ANON_KEY never
  // validates JWTs). Fail fast if it is missing rather than degrade.
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!serviceKey) throw new Error("Auth service unavailable");
  const supabase = createClient(supabaseUrl, serviceKey);
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) throw new Error("Invalid or expired token");
  return user;
}

function getTenantId(user: any): string {
  // app_metadata only (server-set, untamperable).
  return user.app_metadata?.tenant_id || user.id;
}

const STAFF_ROLES = new Set(["admin", "manager", "assistant_manager", "staff"]);

async function readAuth(c: any) {
  const token = c.req.header("X-User-Token")?.replace("Bearer ", "");
  if (!token) return null;
  try {
    const user = await getUserFromToken(token);
    // These are staff-side admin endpoints. Role comes from app_metadata
    // (server-set) — a portal customer holds a valid auth token but has no
    // staff role, and must not reach invite/approve/revoke/reset actions.
    if (!STAFF_ROLES.has(user.app_metadata?.role)) return null;
    return { user, tenantId: getTenantId(user) };
  } catch {
    return null;
  }
}

async function getPrimaryContact(tenantId: string, householdId: string, primaryContactId?: string) {
  if (primaryContactId) {
    const direct = await kv.get(`customer:${tenantId}:contact:${householdId}:${primaryContactId}`);
    if (direct) return direct;
  }
  const all = (await kv.getByPrefix(`customer:${tenantId}:contact:${householdId}:`)) as any[];
  return all.find((c: any) => c.is_primary) ?? all[0] ?? null;
}

invites.post("/customers/:customerId/portal-invite", async (c) => {
  const auth = await readAuth(c);
  if (!auth) return c.json({ error: "Unauthorized" }, 401);
  const { tenantId } = auth;
  const householdId = c.req.param("customerId");

  const household = (await kv.get(`customer:${tenantId}:household:${householdId}`)) as any;
  if (!household) return c.json({ error: "Household not found", tenantId, householdId }, 404);

  const existingLink = await kv.get(`portal_users:${tenantId}:${householdId}`);
  if (existingLink) return c.json({ error: "Household already has portal access" }, 409);

  const contact = await getPrimaryContact(tenantId, householdId, household.primary_contact_id);
  if (!contact?.email) {
    return c.json({ error: "Household has no contact with an email address — add a primary contact first" }, 400);
  }

  const token = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
  const expiresAt = new Date(Date.now() + TWENTY_FOUR_HOURS_MS).toISOString();
  await kv.set(`portal_invites:${tenantId}:${token}`, {
    customerId: householdId,
    tenantId,
    token,
    email: contact.email,
    contactName: `${contact.first_name ?? ""} ${contact.last_name ?? ""}`.trim(),
    createdBy: auth.user.id,
    createdAt: new Date().toISOString(),
    expiresAt,
    consumedAt: null,
  });

  const portalBase = Deno.env.get("PORTAL_BASE_URL") ?? "http://localhost:5175";
  const acceptUrl = `${portalBase}/accept-invite?token=${token}`;
  const tenantName = household.name ?? "PawPilotPro";

  try {
    const { subject, html, text } = inviteEmail({
      ownerName: contact.first_name || "there",
      tenantName,
      acceptUrl,
      expiresInHours: 24,
    });
    await getEmailSender().send({ to: contact.email, subject, html, text });
  } catch (e) {
    logError("portal_invites.inviteEmail.failed", e, { householdId });
    return c.json(
      { ok: true, expiresAt, emailWarning: "Email delivery skipped — share the link manually.", acceptUrl },
      200,
    );
  }

  return c.json({ ok: true, expiresAt });
});

invites.get("/customers/:customerId/portal-activity", async (c) => {
  const auth = await readAuth(c);
  if (!auth) return c.json({ error: "Unauthorized" }, 401);
  const { tenantId } = auth;
  const householdId = c.req.param("customerId");

  const link = (await kv.get(`portal_users:${tenantId}:${householdId}`)) as any;
  const allInvites = (await kv.getByPrefix(`portal_invites:${tenantId}:`)) as any[];
  const pending = allInvites.filter(
    (i) => i.customerId === householdId && !i.consumedAt && new Date(i.expiresAt) > new Date(),
  );

  // Phase E enrichment — surface auth-side facts (last sign-in, suspended)
  // so the staff portal-activity UI can show a real account-state picture
  // rather than "we sent an invite at some point".
  let lastSignInAt: string | null = null;
  let suspended = false;
  if (link?.authUserId) {
    try {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const admin = createClient(supabaseUrl, serviceKey);
      const { data: u } = await admin.auth.admin.getUserById(link.authUserId);
      lastSignInAt = (u?.user as any)?.last_sign_in_at ?? null;
      // app_metadata only (server-set).
      suspended = !!(u?.user as any)?.app_metadata?.portal_suspended;
    } catch (e) {
      console.warn("getUserById for portal-activity failed:", e);
    }
  }

  return c.json({ link, pendingInvites: pending, lastSignInAt, suspended });
});

// ----- Staff: vax review queue -----------------------------------------

const VAX_BUCKET = "vax-uploads";

invites.get("/vax-queue", async (c) => {
  const auth = await readAuth(c);
  if (!auth) return c.json({ error: "Unauthorized" }, 401);
  const { tenantId } = auth;

  const items = ((await kv.getByPrefix(`vax_review_queue:${tenantId}:`)) as any[])
    .filter((i) => i.status === "pending")
    .sort((a, b) => new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime());

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(supabaseUrl, serviceKey);

  const enriched = await Promise.all(
    items.map(async (i) => {
      const { data: signed } = await admin.storage.from(VAX_BUCKET).createSignedUrl(i.storagePath, 60 * 30);
      const household = await kv.get(`customer:${tenantId}:household:${i.householdId}`);
      return {
        ...i,
        viewUrl: signed?.signedUrl ?? null,
        householdName: (household as any)?.name ?? null,
      };
    }),
  );
  return c.json({ items: enriched });
});

invites.post("/vax-queue/:id/approve", async (c) => {
  const auth = await readAuth(c);
  if (!auth) return c.json({ error: "Unauthorized" }, 401);
  const { tenantId, user } = auth;
  const id = c.req.param("id");

  const body = await c.req.json().catch(() => null);
  if (!body) return c.json({ error: "JSON body required" }, 400);
  const vaccinationType = body.vaccinationType ?? body.vaxType;
  const dateAdministered = body.dateAdministered ?? body.issuedAt;
  const nextDueDate = body.nextDueDate ?? body.expiresAt ?? null;
  if (!vaccinationType || !dateAdministered) {
    return c.json({ error: "vaccinationType and dateAdministered required" }, 400);
  }

  const entry = (await kv.get(`vax_review_queue:${tenantId}:${id}`)) as any;
  if (!entry || entry.status !== "pending") return c.json({ error: "Not found or already handled" }, 404);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(supabaseUrl, serviceKey);

  // Long-lived signed URL stored on the vaccination record (5 years)
  const { data: signed } = await admin.storage.from(VAX_BUCKET).createSignedUrl(entry.storagePath, 60 * 60 * 24 * 365 * 5);
  const documentId = signed?.signedUrl ?? entry.storagePath;

  const vaxId = crypto.randomUUID();
  const now = new Date().toISOString();
  await kv.set(`vaccination:${tenantId}:${entry.petId}:${vaxId}`, {
    id: vaxId,
    tenant_id: tenantId,
    pet_id: entry.petId,
    vaccination_type: vaccinationType,
    vaccination_name: body.vaccinationName ?? null,
    date_administered: dateAdministered,
    next_due_date: nextDueDate,
    batch_number: body.batchNumber ?? null,
    manufacturer: body.manufacturer ?? null,
    vet_clinic_name: body.vetClinicName ?? null,
    vet_clinic_phone: body.vetClinicPhone ?? null,
    administering_vet: body.administeringVet ?? null,
    notes: body.notes ?? entry.proposedNotes ?? null,
    document_id: documentId,
    created_by: user.id,
    created_by_name: user.email ?? null,
    created_at: now,
    updated_at: now,
  });

  await kv.set(`vax_review_queue:${tenantId}:${id}`, {
    ...entry,
    status: "approved",
    reviewedBy: user.id,
    reviewedAt: now,
    promotedTo: vaxId,
  });

  const email = await getOwnerEmail(tenantId, entry.householdId);
  const ownerName = await getOwnerName(tenantId, entry.householdId);
  const tenant = (await kv.get(`customer:${tenantId}:household:${entry.householdId}`)) as any;
  await notify({
    tenantId,
    householdId: entry.householdId,
    type: "vax.approved",
    payload: { petId: entry.petId, vaxType: vaccinationType, expiresAt: nextDueDate },
    link: `/pets/${entry.petId}`,
    email: email ? {
      to: email,
      ...vaxApprovedEmail({
        ownerName,
        tenantName: tenant?.name ?? "PawPilotPro",
        petName: entry.petName ?? "your pet",
        vaxType: vaccinationType,
        expiresAt: nextDueDate,
        portalUrl: `${PORTAL_BASE_URL}/pets/${entry.petId}`,
      }),
    } : undefined,
  });

  return c.json({ ok: true, vaccinationId: vaxId });
});

invites.post("/vax-queue/:id/reject", async (c) => {
  const auth = await readAuth(c);
  if (!auth) return c.json({ error: "Unauthorized" }, 401);
  const { tenantId, user } = auth;
  const id = c.req.param("id");
  const body = await c.req.json().catch(() => null);
  const reason = body?.reason;
  if (!reason || typeof reason !== "string" || reason.length < 3) {
    return c.json({ error: "reason required (min 3 chars)" }, 400);
  }
  const entry = (await kv.get(`vax_review_queue:${tenantId}:${id}`)) as any;
  if (!entry || entry.status !== "pending") return c.json({ error: "Not found or already handled" }, 404);
  await kv.set(`vax_review_queue:${tenantId}:${id}`, {
    ...entry,
    status: "rejected",
    reviewedBy: user.id,
    reviewedAt: new Date().toISOString(),
    rejectionReason: reason,
  });

  const email = await getOwnerEmail(tenantId, entry.householdId);
  const ownerName = await getOwnerName(tenantId, entry.householdId);
  const tenant = (await kv.get(`customer:${tenantId}:household:${entry.householdId}`)) as any;
  await notify({
    tenantId,
    householdId: entry.householdId,
    type: "vax.rejected",
    payload: { petId: entry.petId, reason },
    link: `/pets/${entry.petId}`,
    email: email ? {
      to: email,
      ...vaxRejectedEmail({
        ownerName,
        tenantName: tenant?.name ?? "PawPilotPro",
        petName: entry.petName ?? "your pet",
        reason,
        portalUrl: `${PORTAL_BASE_URL}/pets/${entry.petId}`,
      }),
    } : undefined,
  });

  return c.json({ ok: true });
});

// =======================================================================
// Phase E — portal account lifecycle
// =======================================================================
// Pause/resume is the soft action staff want most of the time (the
// household ghosted, hold their access; or there's a dispute, freeze
// while sorting). Revoke is the destructive last resort and intentionally
// stays available. Reset-password and resend handle the everyday "they
// forgot" / "the link expired" cases.

/**
 * Revoke (now corrected). Old behaviour banned the underlying auth user
 * for 100 years — but a portal owner might ALSO be a staff member
 * (accept-invite has an existing-account merge path), so banning would
 * accidentally kick them out of the staff app too. The corrected revoke:
 *   - removes portal_user metadata + clears any portal-side flags
 *   - deletes the portal_users link
 *   - leaves the auth user otherwise untouched
 * The user can still sign into other product areas they have access to.
 */
invites.post("/customers/:customerId/portal-revoke", async (c) => {
  const auth = await readAuth(c);
  if (!auth) return c.json({ error: "Unauthorized" }, 401);
  const { tenantId } = auth;
  const householdId = c.req.param("customerId");

  const link = (await kv.get(`portal_users:${tenantId}:${householdId}`)) as any;
  if (!link) return c.json({ error: "No portal link" }, 404);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(supabaseUrl, serviceKey);

  try {
    const { data: u } = await admin.auth.admin.getUserById(link.authUserId);
    if (u?.user) {
      // Clear the portal flags from app_metadata (authoritative, server-set).
      const appMeta = { ...(u.user.app_metadata ?? {}) };
      delete (appMeta as any).portal_user;
      delete (appMeta as any).portal_suspended;
      // Keep tenant_id / household_id in metadata in case they're still
      // useful for staff sessions — they're only meaningful when paired
      // with portal_user:true on this code path.
      await admin.auth.admin.updateUserById(link.authUserId, { app_metadata: appMeta });
    }
  } catch (e) {
    console.warn("revoke: clearing portal metadata failed:", e);
  }

  await kv.del(`portal_users:${tenantId}:${householdId}`);
  return c.json({ ok: true });
});

/**
 * Pause — staff freezes portal access without unlinking anything. The
 * portal_user record + portal_users link stay intact, so a one-click
 * resume restores the household instantly.
 */
invites.post("/customers/:customerId/portal-pause", async (c) => {
  const auth = await readAuth(c);
  if (!auth) return c.json({ error: "Unauthorized" }, 401);
  const { tenantId } = auth;
  const householdId = c.req.param("customerId");

  const link = (await kv.get(`portal_users:${tenantId}:${householdId}`)) as any;
  if (!link) return c.json({ error: "No portal link" }, 404);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(supabaseUrl, serviceKey);

  const { data: u, error: getErr } = await admin.auth.admin.getUserById(link.authUserId);
  if (getErr || !u?.user) return c.json({ error: "Auth user lookup failed" }, 500);

  // Suspension is an authorization flag: write it to app_metadata
  // (authoritative, server-set) only.
  const appMeta = { ...(u.user.app_metadata ?? {}), portal_suspended: true };
  const { error: upErr } = await admin.auth.admin.updateUserById(link.authUserId, { app_metadata: appMeta });
  if (upErr) return internalError(c, "portal_invites.portalPause", upErr);
  return c.json({ ok: true, suspended: true });
});

invites.post("/customers/:customerId/portal-resume", async (c) => {
  const auth = await readAuth(c);
  if (!auth) return c.json({ error: "Unauthorized" }, 401);
  const { tenantId } = auth;
  const householdId = c.req.param("customerId");

  const link = (await kv.get(`portal_users:${tenantId}:${householdId}`)) as any;
  if (!link) return c.json({ error: "No portal link" }, 404);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(supabaseUrl, serviceKey);

  const { data: u, error: getErr } = await admin.auth.admin.getUserById(link.authUserId);
  if (getErr || !u?.user) return c.json({ error: "Auth user lookup failed" }, 500);

  // Clear the suspension flag from app_metadata (authoritative, server-set).
  const appMeta = { ...(u.user.app_metadata ?? {}) };
  delete (appMeta as any).portal_suspended;
  const { error: upErr } = await admin.auth.admin.updateUserById(link.authUserId, { app_metadata: appMeta });
  if (upErr) return internalError(c, "portal_invites.portalResume", upErr);
  return c.json({ ok: true, suspended: false });
});

/**
 * Resend invite. If a pending (unconsumed, unexpired) invite exists, we
 * keep the same token and just re-email it — the link the owner saved
 * earlier still works. If all invites are expired or consumed, we mint
 * a fresh token. Either way the response shape matches the original
 * portal-invite endpoint.
 */
invites.post("/customers/:customerId/portal-invite/resend", async (c) => {
  const auth = await readAuth(c);
  if (!auth) return c.json({ error: "Unauthorized" }, 401);
  const { tenantId } = auth;
  const householdId = c.req.param("customerId");

  const household = (await kv.get(`customer:${tenantId}:household:${householdId}`)) as any;
  if (!household) return c.json({ error: "Household not found" }, 404);

  // Same guard as the initial /portal-invite endpoint — refuse if the
  // household already has portal access. Without this guard, resending
  // generates a fresh accept-invite link the owner can click to overwrite
  // the existing portal_users link via the accept-invite handler. Almost
  // certainly not what staff meant by "resend". Use Reset password
  // instead for an active account.
  const existingLink = await kv.get(`portal_users:${tenantId}:${householdId}`);
  if (existingLink) {
    return c.json(
      { error: "Portal account is already active. Use Reset password to send them a sign-in link." },
      409,
    );
  }

  const contact = await getPrimaryContact(tenantId, householdId, household.primary_contact_id);
  if (!contact?.email) {
    return c.json({ error: "Household has no contact with an email address" }, 400);
  }

  const allInvites = (await kv.getByPrefix(`portal_invites:${tenantId}:`)) as any[];
  const pending = allInvites
    .filter((i) => i.customerId === householdId && !i.consumedAt && new Date(i.expiresAt) > new Date())
    .sort((a, b) => new Date(b.expiresAt).getTime() - new Date(a.expiresAt).getTime())[0];

  let inviteRecord: any;
  if (pending) {
    inviteRecord = pending;
  } else {
    const token = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
    const expiresAt = new Date(Date.now() + TWENTY_FOUR_HOURS_MS).toISOString();
    inviteRecord = {
      customerId: householdId,
      tenantId,
      token,
      email: contact.email,
      contactName: `${contact.first_name ?? ""} ${contact.last_name ?? ""}`.trim(),
      createdBy: auth.user.id,
      createdAt: new Date().toISOString(),
      expiresAt,
      consumedAt: null,
    };
    await kv.set(`portal_invites:${tenantId}:${inviteRecord.token}`, inviteRecord);
  }

  const portalBase = Deno.env.get("PORTAL_BASE_URL") ?? "http://localhost:5175";
  const acceptUrl = `${portalBase}/accept-invite?token=${inviteRecord.token}`;
  const tenantName = household.name ?? "PawPilotPro";

  try {
    const { subject, html, text } = inviteEmail({
      ownerName: contact.first_name || "there",
      tenantName,
      acceptUrl,
      expiresInHours: Math.max(
        1,
        Math.round((new Date(inviteRecord.expiresAt).getTime() - Date.now()) / 3_600_000),
      ),
    });
    await getEmailSender().send({ to: contact.email, subject, html, text });
  } catch (e) {
    logError("portal_invites.resendInviteEmail.failed", e, { householdId });
    return c.json(
      { ok: true, expiresAt: inviteRecord.expiresAt, emailWarning: "Email delivery skipped — share the link manually.", acceptUrl },
      200,
    );
  }

  return c.json({ ok: true, expiresAt: inviteRecord.expiresAt, reissued: !pending });
});

/**
 * Staff-triggered password reset. Sends the owner the standard Supabase
 * recovery email. The owner clicks the link → lands on /reset-password
 * (PORTAL_BASE_URL is the public Netlify URL) → sets a new password →
 * signs back in.
 *
 * Uses generateLink so we can specify the redirect URL — admin.auth's
 * resetPasswordForEmail equivalent isn't exposed on the admin client.
 */
invites.post("/customers/:customerId/portal-reset-password", async (c) => {
  const auth = await readAuth(c);
  if (!auth) return c.json({ error: "Unauthorized" }, 401);
  const { tenantId } = auth;
  const householdId = c.req.param("customerId");

  const link = (await kv.get(`portal_users:${tenantId}:${householdId}`)) as any;
  if (!link) return c.json({ error: "No portal link" }, 404);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(supabaseUrl, serviceKey);

  const { data: u, error: getErr } = await admin.auth.admin.getUserById(link.authUserId);
  if (getErr || !u?.user?.email) return c.json({ error: "Auth user lookup failed" }, 500);

  const portalBase = Deno.env.get("PORTAL_BASE_URL") ?? "http://localhost:5175";
  const { error: linkErr } = await admin.auth.admin.generateLink({
    type: "recovery",
    email: u.user.email,
    options: { redirectTo: `${portalBase}/reset-password` },
  });
  if (linkErr) return internalError(c, "portal_invites.portalResetPassword", linkErr);
  // Supabase delivers the recovery email itself when SMTP is configured
  // on the project; if not, the link is returned in the response — for
  // the MVP we don't surface that to staff (security). Tell them we sent
  // it and stop.
  return c.json({ ok: true });
});

export default invites;
