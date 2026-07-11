// Portal routes — public + portal-user-authed.
// Uses v2 KV schema. The portal user's `app_metadata` (server-set) carries
// `tenant_id` (matching v2's staff convention) + `household_id` for
// owner-scoped reads. app_metadata is the only source of these fields.

import { Hono } from "npm:hono";
import { z } from "npm:zod";
import { createClient } from "npm:@supabase/supabase-js";
import * as kv from "./kv_store.tsx";
import { internalError } from "./_shared/log.ts";
import { isLinkedPortalUser, withLinkedUser } from "./lib/portal_link.ts";
import { notify, PortalNotificationType } from "./lib/notify.ts";
import {
  isVisibleToOwner,
  listPetUpdatesForDay,
  mergeDayFeeds,
  ownerFacingText,
  withSignedPhotoUrls,
} from "./lib/pet_updates.ts";
import {
  decodeGalleryCursor,
  listApprovedGallery,
  listMomentsForDay,
} from "./lib/pet_updates_store.ts";
import {
  PET_PHOTOS_BUCKET,
  applyPetPhotoWrite,
  signPetPhotoUrl,
  signPetPhotoUrls,
  storedPetPhoto,
} from "./lib/pet_photos.ts";
// Phase 4 stage 2: every customer:* KV mutation is mirrored to Postgres.
// Non-fatal, loud-on-failure; KV stays authoritative (no read changes).
import { dualWriteCustomers, dwSet, dwDel, type CustomerDualWriteOp } from "./lib/customers_dualwrite.ts";

const portal = new Hono();

// ----- helpers ----------------------------------------------------------

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

interface PortalCtx {
  user: any;
  tenantId: string;
  householdId: string;
}

async function readPortalUser(c: any): Promise<PortalCtx | { error: string; status: number }> {
  const token = c.req.header("X-User-Token")?.replace("Bearer ", "");
  if (!token) return { error: "Missing user token", status: 401 };
  let user: any;
  try { user = await getUserFromToken(token); }
  catch { return { error: "Invalid session", status: 401 }; }
  // Authorization fields read app_metadata only (server-set, untamperable).
  const portalUser = user.app_metadata?.portal_user;
  if (portalUser !== true) return { error: "Not a portal account", status: 403 };
  // Phase E: staff can pause a household's portal access without nuking the
  // auth user or the portal_users link. The flag is checked here so every
  // authed portal endpoint rejects in lockstep — including endpoints
  // mounted from portal_bookings.ts which has its own copy of this guard.
  const suspended = user.app_metadata?.portal_suspended;
  if (suspended === true) {
    return { error: "Portal access is paused — contact your daycare", status: 403 };
  }
  const tenantId = user.app_metadata?.tenant_id;
  const householdId = user.app_metadata?.household_id;
  if (!tenantId || !householdId) return { error: "Portal account not linked", status: 403 };
  // Defense in depth: confirm the tenant/household claim against the
  // server-written portal_users link (created at accept-invite). A
  // spoofed tenant_id/household_id will not match. Households may have
  // several linked logins (one per invited contact).
  const link = (await kv.get(`portal_users:${tenantId}:${householdId}`)) as any;
  if (!isLinkedPortalUser(link, user.id)) {
    return { error: "Portal account not linked", status: 403 };
  }
  return { user, tenantId, householdId };
}

async function getPrimaryContact(tenantId: string, householdId: string, primaryContactId?: string) {
  if (primaryContactId) {
    const direct = await kv.get(`customer:${tenantId}:contact:${householdId}:${primaryContactId}`);
    if (direct) return direct;
  }
  const all = (await kv.getByPrefix(`customer:${tenantId}:contact:${householdId}:`)) as any[];
  return all.find((c: any) => c.is_primary) ?? all[0] ?? null;
}

// ----- public -----------------------------------------------------------

portal.get("/health", (c) => c.json({ ok: true, scope: "portal", ts: Date.now() }));

// Brand configuration — public so the login screen can theme before auth.
// Reads the same settings:org record the staff app writes (Organisation Settings → Brand Configuration).
portal.get("/branding", async (c) => {
  const org = (await kv.get("settings:org")) as any;
  if (!org) return c.json({});
  return c.json({
    name: (org.tradingName || org.name || "").trim(),
    primaryColor: typeof org.primaryColor === "string" ? org.primaryColor : null,
    secondaryColor: typeof org.secondaryColor === "string" ? org.secondaryColor : null,
    logoUrl: typeof org.logoUrl === "string" ? org.logoUrl : null,
    emailSenderName: typeof org.emailSenderName === "string" ? org.emailSenderName : null,
  });
});

// ----- accept-invite (creates the portal Auth user) --------------------

const acceptSchema = z.object({
  token: z.string().min(40),
  password: z.string().min(10).max(128),
});

portal.post("/auth/accept-invite", async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = acceptSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: parsed.error.format() }, 400);
  const { token, password } = parsed.data;

  // Find invite by scanning the prefix (tenantId is part of the key but the URL only has the token).
  const allInvites = (await kv.getByPrefix(`portal_invites:`)) as any[];
  const found = allInvites.find((i) => i.token === token);
  if (!found) return c.json({ error: "Invalid or expired link" }, 410);
  if (found.consumedAt) return c.json({ error: "Link already used" }, 410);
  if (new Date(found.expiresAt).getTime() < Date.now()) return c.json({ error: "Link expired" }, 410);

  const { tenantId, customerId: householdId, email } = found;
  if (!email) return c.json({ error: "Invite is missing an email — contact the daycare" }, 410);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(supabaseUrl, serviceKey);

  // Try to create; if email already exists, attach portal metadata to the existing user instead.
  let authUserId: string | null = null;
  let isExistingUser = false;
  const { data: created, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    // Security-bearing portal fields live in app_metadata ONLY (server-set,
    // untamperable).
    app_metadata: { portal_user: true, tenant_id: tenantId, household_id: householdId },
  });
  if (created?.user) {
    authUserId = created.user.id;
  } else {
    const msg = (error?.message ?? "").toLowerCase();
    if (msg.includes("already") && msg.includes("registered")) {
      // Find existing user by email (paginate — Supabase listUsers returns 50 by default)
      let page = 1;
      while (page < 20) {
        const { data: list, error: listErr } = await admin.auth.admin.listUsers({ page, perPage: 200 });
        if (listErr) return internalError(c, 'portal.acceptInvite', listErr);
        const match = list.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
        if (match) {
          isExistingUser = true;
          authUserId = match.id;
          // Merge metadata — do NOT overwrite password (preserves staff login).
          // Security-bearing portal fields are written to app_metadata ONLY
          // (server-set, untamperable).
          const mergedAppMeta = {
            ...(match.app_metadata ?? {}),
            portal_user: true,
            tenant_id: tenantId,
            household_id: householdId,
          };
          const { error: updErr } = await admin.auth.admin.updateUserById(match.id, {
            app_metadata: mergedAppMeta,
            email_confirm: true,
          });
          if (updErr) return internalError(c, 'portal.acceptInvite', updErr);
          break;
        }
        if (!list.users || list.users.length < 200) break;
        page++;
      }
      if (!authUserId) return c.json({ error: "Email already registered but user record could not be located" }, 500);
    } else {
      return internalError(c, 'portal.acceptInvite', error);
    }
  }

  // Merge into any existing link — a household can have several portal
  // logins (one per invited contact). Never overwrite: that used to
  // silently lock out the previously linked user.
  const existingLink = await kv.get(`portal_users:${tenantId}:${householdId}`);
  const mergedLink = withLinkedUser(existingLink, { tenantId, householdId }, authUserId!);
  mergedLink.notificationPrefs ??= { booking: true, vax: true, marketing: false };
  await kv.set(`portal_users:${tenantId}:${householdId}`, mergedLink);
  await kv.set(`portal_invites:${tenantId}:${token}`, { ...found, consumedAt: new Date().toISOString() });

  // For brand-new accounts, the password we just set works. For existing accounts, the password the
  // owner just typed is NOT their existing password — sign-in will fail. Tell them to use their
  // existing credentials in that case.
  if (isExistingUser) {
    return c.json({
      ok: true,
      reusedExistingAccount: true,
      message: "Your existing account now has portal access. Sign in with the password you already use for this email.",
    }, 200);
  }

  const { data: signIn, error: signInErr } = await admin.auth.signInWithPassword({ email, password });
  if (signInErr || !signIn.session) {
    return c.json({ ok: true, message: "Account created — please sign in" }, 200);
  }
  return c.json({
    ok: true,
    session: { accessToken: signIn.session.access_token, refreshToken: signIn.session.refresh_token },
  });
});

// ----- authed (portal user) --------------------------------------------

portal.get("/me", async (c) => {
  const auth = await readPortalUser(c);
  if ("error" in auth) return c.json({ error: auth.error }, auth.status as 401 | 403);
  return c.json({ authUserId: auth.user.id, householdId: auth.householdId, tenantId: auth.tenantId });
});

portal.get("/home", async (c) => {
  const auth = await readPortalUser(c);
  if ("error" in auth) return c.json({ error: auth.error }, auth.status as 401 | 403);
  const { tenantId, householdId } = auth;

  const household = (await kv.get(`customer:${tenantId}:household:${householdId}`)) as any;
  const contact = await getPrimaryContact(tenantId, householdId, household?.primary_contact_id);

  // Owner-submitted bookings live in portal_booking:{tenantId}:{id}
  // (Staff-created bookings in daycare:booking:* / overnight:booking:* aren't surfaced yet —
  //  that's a future enhancement; for now Home reflects the owner's own requests/confirmations.)
  const allOwnerBookings = ((await kv.getByPrefix(`portal_booking:${tenantId}:`)) as any[]).filter(
    (b) => b.householdId === householdId,
  );
  const now = Date.now();
  const upcoming = allOwnerBookings
    .filter((b) => b.status !== "cancelled" && b.status !== "declined")
    .filter((b) => new Date(b.startAt).getTime() >= now)
    .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime())
    .slice(0, 3);

  // Vaccinations expiring within 30 days
  const pets = (await kv.getByPrefix(`customer:${tenantId}:pet:${householdId}:`)) as any[];
  const petIds = pets.map((p) => p.id);
  const vaxArrays = await Promise.all(
    petIds.map((id) => kv.getByPrefix(`vaccination:${tenantId}:${id}:`)),
  );
  const allVax = vaxArrays.flat() as any[];
  const expiringSoon = allVax.filter((v) => {
    const exp = new Date(v.expires_at || v.expiresAt || 0).getTime();
    return exp > now && exp - now < 30 * 24 * 60 * 60 * 1000;
  });

  // Phase C — household documents with an expiry within 30 days (or already
  // expired — staff often forgets to chase, this surfaces it on the owner's
  // home so they renew before booking is blocked).
  const docs = (await kv.getByPrefix(`customer:${tenantId}:document:${householdId}:`)) as any[];
  const docsExpiring = docs
    .filter((d) => !!d.expiry_date)
    .map((d) => ({ d, t: new Date(d.expiry_date).getTime() }))
    .filter(({ t }) => !Number.isNaN(t) && t - now < 30 * 24 * 60 * 60 * 1000)
    .sort((a, b) => a.t - b.t)
    .map(({ d }) => ({
      id: d.id,
      name: d.name ?? d.file_name ?? "Document",
      documentType: d.document_type ?? "other",
      expiresAt: d.expiry_date,
    }));

  return c.json({
    greeting: {
      firstName: contact?.first_name ?? "there",
      tenantName: household?.name ?? "PawPilotPro",
    },
    upcoming,
    alerts: {
      vaxExpiring: expiringSoon.map((v) => ({
        petId: v.pet_id || v.petId,
        vaxType: v.vaccine_type || v.vaxType,
        expiresAt: v.expires_at || v.expiresAt,
      })),
      documentsExpiring: docsExpiring,
      pendingRequests: upcoming.filter((b) => b.status === "pending").length,
    },
  });
});

portal.get("/pets", async (c) => {
  const auth = await readPortalUser(c);
  if ("error" in auth) return c.json({ error: auth.error }, auth.status as 401 | 403);
  const { tenantId, householdId } = auth;
  const pets = (await kv.getByPrefix(`customer:${tenantId}:pet:${householdId}:`)) as any[];

  // Batch-fetch every Invoxia device bound to any pet on this household so
  // we can mark each pet's `hasTracker` correctly.  One query, regardless
  // of how many pets the household has — cheaper than per-pet lookups and
  // lets HomeScreen / PetsScreen drive the tracker upsell off the same
  // payload they already render.
  const petIds = pets.map((p) => p.id).filter(Boolean);
  let trackerByPetId: Record<string, boolean> = {};
  if (petIds.length > 0) {
    try {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const serviceKey  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
      const { data: devices } = await admin
        .schema("invoxia").from("devices")
        .select("id, pet_id")
        .in("pet_id", petIds);
      for (const d of (devices ?? []) as Array<{ id: number; pet_id: string }>) {
        if (d.pet_id) trackerByPetId[d.pet_id] = true;
      }
    } catch (e) {
      // Non-fatal — the upsell card just won't surface this turn.  Logged
      // so we can correlate with any invoxia sync issues.
      console.warn("[portal] hasTracker lookup failed", e);
    }
  }

  // Private bucket: resolve stored photo references (paths or legacy URLs)
  // to short-lived signed URLs in one storage round-trip.
  const photoByStored = await signPetPhotoUrls(pets.map((p) => storedPetPhoto(p)));

  const normalized = pets.map((p) => ({
    id: p.id,
    tenantId,
    customerId: householdId,
    name: p.name,
    breed: p.breed ?? "",
    dob: p.date_of_birth || p.dob || new Date(0).toISOString(),
    weightKg: p.weight_kg ?? p.weightKg ?? 0,
    photoUrl: photoByStored.get(storedPetPhoto(p) ?? "") ?? null,
    notes: p.notes ?? null,
    // Surface verification state so the UI can show owner-added pets as
    // "Pending team verification" and exclude them from booking selectors.
    verificationStatus: p.verification_status ?? "verified",
    ownerAdded: !!p.owner_added,
    // True when at least one invoxia.devices row points at this pet.
    // Drives the home-screen tracker upsell — if it's false we replace
    // PulseHero with the upsell card.
    hasTracker: !!trackerByPetId[p.id],
  }));
  return c.json({ pets: normalized });
});

portal.get("/pets/:id", async (c) => {
  const auth = await readPortalUser(c);
  if ("error" in auth) return c.json({ error: auth.error }, auth.status as 401 | 403);
  const { tenantId, householdId } = auth;
  const id = c.req.param("id");
  const pet = (await kv.get(`customer:${tenantId}:pet:${householdId}:${id}`)) as any;
  if (!pet) return c.json({ error: "Not found" }, 404);
  const vax = (await kv.getByPrefix(`vaccination:${tenantId}:${id}:`)) as any[];

  // Mirror /portal/pets: enrich the single-pet response with hasTracker so
  // PetDetail can swap the Pulse / Whereabouts surfaces for the upsell
  // card without a second request.
  let hasTracker = false;
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
    const { data: device } = await admin
      .schema("invoxia").from("devices")
      .select("id").eq("pet_id", id).maybeSingle();
    hasTracker = !!device?.id;
  } catch (e) {
    console.warn("[portal] hasTracker single-pet lookup failed", e);
  }

  const wire = await petToWire(pet, tenantId, householdId) as any;
  wire.hasTracker = hasTracker;

  return c.json({
    pet: wire,
    vaccinations: vax.map((v) => ({
      id: v.id,
      tenantId,
      petId: id,
      vaxType: v.vaccination_type || v.vaccine_type || v.vaxType,
      certificateUrl: v.document_id || v.certificate_url || v.certificateUrl || "",
      issuedAt: v.date_administered || v.issued_at || v.issuedAt,
      expiresAt: v.next_due_date || v.expires_at || v.expiresAt,
      boosterDueAt: v.booster_due_at || v.boosterDueAt || null,
      approvedBy: v.created_by || v.approved_by || null,
      approvedAt: v.created_at || v.approved_at || null,
    })),
  });
});

// Today feed — a pet's updates for one day (defaults to today). Read-only:
// owners consume, staff produce. Ownership is enforced by key construction
// (the pet must exist under this tenant+household), and moment photos are
// served via short-lived signed URLs from the private bucket.
portal.get("/pets/:id/updates", async (c) => {
  try {
    const auth = await readPortalUser(c);
    if ("error" in auth) return c.json({ error: auth.error }, auth.status as 401 | 403);
    const { tenantId, householdId } = auth;
    const id = c.req.param("id");

    const pet = (await kv.get(`customer:${tenantId}:pet:${householdId}:${id}`)) as any;
    if (!pet) return c.json({ error: "Not found" }, 404);

    const date = c.req.query("date") || new Date().toISOString().split("T")[0];
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

    // Merge the legacy KV feed (check-in/out events, pre-gate moments) with
    // Postgres moments, then apply the curation gate: owners ONLY ever see
    // approved updates — pending/rejected photos never get a signed URL here.
    const [kvRows, pgRows] = await Promise.all([
      listPetUpdatesForDay(tenantId, id, date),
      listMomentsForDay(admin, tenantId, id, date),
    ]);
    const updates = mergeDayFeeds(kvRows, pgRows).filter(isVisibleToOwner);

    let wire: Array<import("./lib/pet_updates.ts").PetUpdate & { photo_url?: string }> = updates;
    if (updates.some((u) => u.photo_path)) {
      wire = await withSignedPhotoUrls(admin, updates);
    }

    // Strip server-internal fields from the owner-facing payload.
    return c.json({
      date,
      updates: wire.map((u) => ({
        id: u.id,
        type: u.type,
        text: ownerFacingText(u),
        photoUrl: u.photo_url ?? null,
        createdAt: u.created_at,
      })),
    });
  } catch (error) {
    return internalError(c, "portal.petUpdates", error);
  }
});

// Gallery — every APPROVED photo moment for the caller's household across
// time (optionally one pet), keyset-paginated, newest first. The status
// filter lives in listApprovedGallery: signed URLs are only ever minted for
// approved rows, so the curation gate holds at the data layer, not the UI.
portal.get("/gallery", async (c) => {
  try {
    const auth = await readPortalUser(c);
    if ("error" in auth) return c.json({ error: auth.error }, auth.status as 401 | 403);
    const { tenantId, householdId } = auth;

    const petId = c.req.query("pet_id") || undefined;
    const rawCursor = c.req.query("cursor");
    const cursor = rawCursor ? decodeGalleryCursor(rawCursor) : undefined;
    if (rawCursor && !cursor) return c.json({ error: "Invalid cursor" }, 400);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

    // Scope is the caller's own household from app_metadata — a pet_id only
    // narrows within it, it can never widen the scope.
    const page = await listApprovedGallery(admin, tenantId, {
      householdId,
      petId,
      cursor: cursor ?? undefined,
    });
    const signed = await withSignedPhotoUrls(admin, page.items);
    return c.json({
      items: signed
        .filter((u) => u.photo_url)
        .map((u) => ({
          id: u.id,
          petId: u.pet_id,
          petName: u.pet_name,
          text: ownerFacingText(u),
          photoUrl: u.photo_url ?? null,
          createdAt: u.created_at,
        })),
      nextCursor: page.nextCursor,
    });
  } catch (error) {
    return internalError(c, "portal.gallery", error);
  }
});

// Download manifest — signed URLs for every approved photo (household or one
// pet), for client-side "download all" / save-to-camera-roll. Returning a
// manifest instead of a server-built zip keeps edge-function CPU/memory flat
// (spec §6.4); the client fetches each file itself.
const GALLERY_DOWNLOAD_MAX = 500;

portal.get("/gallery/download", async (c) => {
  try {
    const auth = await readPortalUser(c);
    if ("error" in auth) return c.json({ error: auth.error }, auth.status as 401 | 403);
    const { tenantId, householdId } = auth;
    const petId = c.req.query("pet_id") || undefined;

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

    const all: import("./lib/pet_updates.ts").PetUpdate[] = [];
    let cursor: string | undefined;
    while (all.length < GALLERY_DOWNLOAD_MAX) {
      const page = await listApprovedGallery(admin, tenantId, {
        householdId,
        petId,
        cursor: cursor ? decodeGalleryCursor(cursor) ?? undefined : undefined,
        limit: 100,
      });
      all.push(...page.items);
      if (!page.nextCursor) break;
      cursor = page.nextCursor;
    }
    const capped = all.slice(0, GALLERY_DOWNLOAD_MAX);

    const signed = await withSignedPhotoUrls(admin, capped);
    return c.json({
      files: signed
        .filter((u) => u.photo_url)
        .map((u) => {
          const ext = u.photo_path?.split(".").pop() ?? "jpg";
          const day = u.created_at.split("T")[0];
          return {
            name: `${u.pet_name || "pet"}-${day}-${u.id}.${ext}`,
            url: u.photo_url,
            createdAt: u.created_at,
            petName: u.pet_name,
          };
        }),
      truncated: all.length >= GALLERY_DOWNLOAD_MAX,
    });
  } catch (error) {
    return internalError(c, "portal.galleryDownload", error);
  }
});

// Shared serializer — keeps the pet shape the portal returns consistent
// across GET /portal/pets (list), GET /portal/pets/:id (detail), and the
// PATCH response below. Read tolerantly (snake_case OR camelCase) since
// older records pre-date the v2 schema; write only snake_case.
// Async because photoUrl is minted here: the pet-photos bucket is private,
// so the wire shape carries a short-lived signed URL, never a stored one.
async function petToWire(pet: any, tenantId: string, householdId: string) {
  return {
    id: pet.id,
    tenantId,
    customerId: householdId,
    name: pet.name,
    breed: pet.breed ?? "",
    sex: pet.sex ?? "unknown",
    dob: pet.date_of_birth || pet.dob || new Date(0).toISOString(),
    weightKg: pet.weight_kg ?? pet.weightKg ?? 0,
    photoUrl: await signPetPhotoUrl(storedPetPhoto(pet)),
    microchip: pet.microchip ?? null,
    colour: pet.colour ?? pet.color ?? null,
    neuteredStatus: pet.neutered_status ?? "unknown",
    feedingInstructions: pet.feeding_instructions ?? null,
    allergies: pet.allergies ?? null,
    vetName: pet.vet_name ?? null,
    vetPhone: pet.vet_phone ?? null,
    vetAddress: pet.vet_address ?? null,
    ownerNotes: pet.owner_notes ?? null,
    teamBehaviourNotes: pet.behaviour_notes ?? null,
    teamMedicalNotes: pet.medical_notes ?? null,
    notes: pet.notes ?? null,
    verificationStatus: pet.verification_status ?? "verified",
    ownerAdded: !!pet.owner_added,
  };
}

// PATCH /portal/pets/:id — owner-editable allowlist. Staff fields
// (behaviour_notes, medical_notes, vaccination_status, *_enrolled, active,
// internal-only flags) are explicitly excluded so the staff CRM record
// remains the source of truth for clinical/operational data.
const petPatchSchema = z.object({
  name: z.string().trim().min(1).max(60).optional(),
  // .or(z.literal("")) matches the empty-string pattern every other field
  // on this schema uses — without it, the moment any client sends "" to
  // unset a photo (mirroring the breed/microchip/etc convention) the
  // request 400s with a confusing "Invalid url" zod message.
  // max(2048): signed URLs (which a client may echo back) carry a token and
  // routinely exceed the old 500-char cap; applyPetPhotoWrite reduces them
  // to the storage path before anything is persisted.
  photo_url: z.string().trim().url().max(2048).nullable().optional().or(z.literal("")),
  breed: z.string().trim().max(80).optional().or(z.literal("")),
  sex: z.enum(["male", "female", "unknown"]).optional(),
  date_of_birth: z.string().trim().max(40).optional().or(z.literal("")),
  microchip: z.string().trim().max(40).optional().or(z.literal("")),
  weight_kg: z.number().nonnegative().max(200).nullable().optional(),
  colour: z.string().trim().max(60).optional().or(z.literal("")),
  neutered_status: z.enum(["neutered", "intact", "unknown"]).optional(),
  feeding_instructions: z.string().trim().max(2000).nullable().optional().or(z.literal("")),
  allergies: z.string().trim().max(1000).nullable().optional().or(z.literal("")),
  vet_name: z.string().trim().max(120).nullable().optional().or(z.literal("")),
  vet_phone: z.string().trim().max(40).nullable().optional().or(z.literal("")),
  vet_address: z.string().trim().max(500).nullable().optional().or(z.literal("")),
  owner_notes: z.string().trim().max(2000).nullable().optional().or(z.literal("")),
});

portal.patch("/pets/:id", async (c) => {
  const auth = await readPortalUser(c);
  if ("error" in auth) return c.json({ error: auth.error }, auth.status as 401 | 403);
  const { tenantId, householdId, user } = auth;
  const id = c.req.param("id");

  const existing = (await kv.get(`customer:${tenantId}:pet:${householdId}:${id}`)) as any;
  if (!existing) return c.json({ error: "Not found" }, 404);

  const body = await c.req.json().catch(() => null);
  const parsed = petPatchSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: parsed.error.format() }, 400);
  const d = parsed.data;

  // Empty-string → null normalisation (the staff app stores null for "unset").
  const nullable = (v: any) => (v === undefined ? undefined : v === "" ? null : v);

  const fieldsTouched: string[] = [];
  const apply: any = {};
  for (const [k, v] of Object.entries(d)) {
    if (v === undefined) continue;
    apply[k] = nullable(v);
    fieldsTouched.push(k);
  }
  if (fieldsTouched.length === 0) {
    return c.json({ error: "No changes" }, 400);
  }

  const updated = {
    ...existing,
    ...apply,
    updated_at: new Date().toISOString(),
    // Audit trail — surfaces "what did the owner just change?" on the staff side.
    last_edited_by_owner_at: new Date().toISOString(),
    last_edited_by_owner_id: user.id,
    last_edited_by_owner_fields: fieldsTouched,
  };
  // Photo writes persist as a storage path (photo_path), never a URL —
  // signed/public URLs echoed by clients are reduced here.
  if ("photo_url" in apply) applyPetPhotoWrite(updated, apply.photo_url);
  await kv.set(`customer:${tenantId}:pet:${householdId}:${id}`, updated);
  await dualWriteCustomers([dwSet(`customer:${tenantId}:pet:${householdId}:${id}`, updated)]);

  return c.json({ ok: true, pet: await petToWire(updated, tenantId, householdId) });
});

// ----- Owner: vax certificate upload -----------------------------------

const MAX_VAX_BYTES = 10 * 1024 * 1024;
const ALLOWED_VAX_MIME = new Set(["application/pdf", "image/jpeg", "image/png"]);
const VAX_BUCKET = "vax-uploads";

async function ensureVaxBucket(admin: any) {
  try {
    const { data: buckets } = await admin.storage.listBuckets();
    if (buckets?.some((b: any) => b.name === VAX_BUCKET)) return;
    await admin.storage.createBucket(VAX_BUCKET, { public: false });
  } catch (e) {
    console.warn("ensureVaxBucket:", e);
  }
}

// ----- Vet share — read-only links scoped to a single pet ---------------
// Owner taps "Share with vet" → we generate a one-way share token, store it,
// return a URL. Vet opens the URL (no account), sees a clean read-only view
// of timeline + insights. Owner can revoke from "manage shares".

interface VetShare {
  token: string;
  tenantId: string;
  householdId: string;
  petId: string;
  vetEmail?: string;
  vetName?: string;
  note?: string;
  createdAt: string;
  expiresAt: string;          // 90 days default
  revokedAt?: string;
  lastOpenedAt?: string;
  openCount: number;
}

function newShareToken(): string {
  // 22-char URL-safe base64 of 16 random bytes
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

portal.post("/pets/:id/vet-shares", async (c) => {
  const auth = await readPortalUser(c);
  if ("error" in auth) return c.json({ error: auth.error }, auth.status as 401 | 403);
  const { tenantId, householdId } = auth;
  const petId = c.req.param("id");

  const pet = (await kv.get(`customer:${tenantId}:pet:${householdId}:${petId}`)) as any;
  if (!pet) return c.json({ error: "Not your pet" }, 403);

  const body = await c.req.json().catch(() => ({}));
  const vetEmail = typeof body.vetEmail === "string" ? body.vetEmail.trim() : undefined;
  const vetName  = typeof body.vetName  === "string" ? body.vetName.trim()  : undefined;
  const note     = typeof body.note     === "string" ? body.note.trim()     : undefined;

  const token = newShareToken();
  const share: VetShare = {
    token,
    tenantId,
    householdId,
    petId,
    vetEmail: vetEmail || undefined,
    vetName: vetName || undefined,
    note: note || undefined,
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 90 * 86_400_000).toISOString(),
    openCount: 0,
  };
  // Owner-side index by pet for the manage-shares view
  await kv.set(`vet_share:${tenantId}:${petId}:${token}`, share);
  // Lookup-by-token index for the public open endpoint
  await kv.set(`vet_share_by_token:${token}`, share);

  const portalBase = Deno.env.get("PORTAL_BASE_URL") ?? "https://portal.pawpilotpro.com";
  return c.json({
    ok: true,
    share,
    url: `${portalBase}/vet/${token}`,
  });
});

portal.get("/pets/:id/vet-shares", async (c) => {
  const auth = await readPortalUser(c);
  if ("error" in auth) return c.json({ error: auth.error }, auth.status as 401 | 403);
  const { tenantId, householdId } = auth;
  const petId = c.req.param("id");
  const pet = (await kv.get(`customer:${tenantId}:pet:${householdId}:${petId}`)) as any;
  if (!pet) return c.json({ error: "Not your pet" }, 403);

  const shares = (await kv.getByPrefix(`vet_share:${tenantId}:${petId}:`)) as VetShare[];
  const portalBase = Deno.env.get("PORTAL_BASE_URL") ?? "https://portal.pawpilotpro.com";
  return c.json({
    shares: shares.map((s) => ({
      ...s,
      url: `${portalBase}/vet/${s.token}`,
      active: !s.revokedAt && new Date(s.expiresAt).getTime() > Date.now(),
    })),
  });
});

portal.delete("/pets/:id/vet-shares/:token", async (c) => {
  const auth = await readPortalUser(c);
  if ("error" in auth) return c.json({ error: auth.error }, auth.status as 401 | 403);
  const { tenantId, householdId } = auth;
  const petId = c.req.param("id");
  const token = c.req.param("token");

  const pet = (await kv.get(`customer:${tenantId}:pet:${householdId}:${petId}`)) as any;
  if (!pet) return c.json({ error: "Not your pet" }, 403);

  const share = (await kv.get(`vet_share:${tenantId}:${petId}:${token}`)) as VetShare | null;
  if (!share) return c.json({ error: "Share not found" }, 404);

  share.revokedAt = new Date().toISOString();
  await kv.set(`vet_share:${tenantId}:${petId}:${token}`, share);
  await kv.set(`vet_share_by_token:${token}`, share);
  return c.json({ ok: true });
});

// PUBLIC — no portal auth. Vet opens this with just the token.
// Mounted under the main app (not under portal/) so we don't accidentally
// require X-User-Token. We still mount it within this file for cohesion.
portal.get("/vet/:token", async (c) => {
  const token = c.req.param("token");
  const share = (await kv.get(`vet_share_by_token:${token}`)) as VetShare | null;
  if (!share) return c.json({ error: "Link not found" }, 404);
  if (share.revokedAt) return c.json({ error: "This link has been revoked by the owner" }, 410);
  if (new Date(share.expiresAt).getTime() < Date.now()) return c.json({ error: "This link has expired" }, 410);

  const { tenantId, householdId, petId } = share;
  const pet = (await kv.get(`customer:${tenantId}:pet:${householdId}:${petId}`)) as any;
  if (!pet) return c.json({ error: "Pet record unavailable" }, 410);

  // Record the open
  share.openCount = (share.openCount ?? 0) + 1;
  share.lastOpenedAt = new Date().toISOString();
  await kv.set(`vet_share_by_token:${token}`, share);
  await kv.set(`vet_share:${tenantId}:${petId}:${token}`, share);

  // Pull a vet-friendly compact view: pet summary + last 90 days of biometrics
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  const { data: device } = await admin.schema("invoxia").from("devices")
    .select("id, name").eq("pet_id", petId).maybeSingle();
  let entityIds: number[] = [];
  if (device?.id) {
    const { data: ents } = await admin.schema("invoxia").from("entities")
      .select("id").eq("device_id", device.id);
    entityIds = (ents ?? []).map((e: any) => e.id);
  }

  const fromIso = new Date(Date.now() - 90 * 86_400_000).toISOString().slice(0, 10);
  const { data: dailyHr } = entityIds.length
    ? await admin.schema("invoxia").from("daily_health")
        .select("date, hr_avg").in("entity_id", entityIds)
        .gte("date", fromIso).order("date", { ascending: true })
    : { data: [] as any[] };

  const vax = (await kv.getByPrefix(`vaccination:${tenantId}:${petId}:`)) as any[];

  return c.json({
    pet: {
      name: pet.name,
      breed: pet.breed,
      sex: pet.sex,
      neutered_status: pet.neutered_status,
      date_of_birth: pet.date_of_birth || pet.dob,
      weight_kg: pet.weight_kg ?? pet.weightKg,
      microchip: pet.microchip,
      colour: pet.colour ?? pet.color,
      vet_name: pet.vet_name,
      vet_phone: pet.vet_phone,
      allergies: pet.allergies,
      feeding_instructions: pet.feeding_instructions,
      medical_notes: pet.medical_notes,
      behaviour_notes: pet.behaviour_notes,
    },
    vaccinations: vax.map((v) => ({
      type: v.vaccination_type || v.vaccine_type || v.vaxType,
      issuedAt: v.date_administered || v.issued_at || v.issuedAt,
      expiresAt: v.next_due_date || v.expires_at || v.expiresAt,
    })),
    biometrics: {
      hrDaily: (dailyHr ?? []).map((h: any) => ({ date: h.date, bpm: h.hr_avg })),
      window: { from: fromIso, to: new Date().toISOString().slice(0, 10) },
    },
    sharedBy: {
      vetName: share.vetName ?? null,
      note: share.note ?? null,
      createdAt: share.createdAt,
      expiresAt: share.expiresAt,
    },
  });
});

// ----- Pet Insights ------------------------------------------------------
// Rule-based narrative generator. Reads recent biometrics + bookings +
// vaccinations + pet profile, computes trends/anomalies, emits human-readable
// "insight" objects that the owner-facing UI can render as cards. This is
// the "Invoxia shows a number, we explain what it means" layer.

interface PetInsight {
  id: string;
  generatedAt: string;
  category:
    | "health"        // resting HR / RR / HRV signals
    | "wellness"      // overall mood/activity composite
    | "behavior"      // patterns from booking-biometric correlation
    | "activity"      // exercise, walks, daycare engagement
    | "preventive"    // vax due, dental, weight changes
    | "tracker"       // device health (battery, sync, coverage)
    | "celebration";  // birthday, milestones, good news
  severity: "good" | "info" | "watch" | "concern";
  title: string;
  narrative: string;
  actionable?: string;
  data?: Record<string, any>;
}

// Resting HR norms (bpm). Source: AAHA, AKC published ranges. Lower bound by
// age/breed too — for v1 we use the dog general norm and breed adjustments
// for very large or very small. Refine later as we collect baselines.
function expectedHrRange(weightKg: number | null): { low: number; high: number } {
  if (!weightKg || weightKg <= 0) return { low: 60, high: 100 };
  if (weightKg < 9)  return { low: 70, high: 130 }; // small breed
  if (weightKg > 27) return { low: 60, high: 90 };  // large breed
  return { low: 60, high: 100 };                    // medium
}

function avg(xs: number[]): number {
  if (xs.length === 0) return 0;
  let s = 0;
  for (const x of xs) s += x;
  return s / xs.length;
}

function pct(n: number, denom: number): number {
  if (!denom) return 0;
  return ((n - denom) / denom) * 100;
}

function ago(iso: string | null | undefined): string {
  if (!iso) return "recently";
  const t = new Date(iso).getTime();
  const days = Math.round((Date.now() - t) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.round(days / 7)} weeks ago`;
  return `${Math.round(days / 30)} months ago`;
}

function daysUntil(iso: string): number {
  return Math.round((new Date(iso).getTime() - Date.now()) / 86_400_000);
}

portal.get("/pets/:id/insights", async (c) => {
  const auth = await readPortalUser(c);
  if ("error" in auth) return c.json({ error: auth.error }, auth.status as 401 | 403);
  const { tenantId, householdId } = auth;
  const petId = c.req.param("id");

  const pet = (await kv.get(`customer:${tenantId}:pet:${householdId}:${petId}`)) as any;
  if (!pet) return c.json({ error: "Not your pet" }, 403);

  const petName: string = pet.name ?? "Your dog";
  const weightKg: number | null = pet.weight_kg ?? pet.weightKg ?? null;
  const dob: string | null = pet.date_of_birth ?? pet.dob ?? null;

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  // Map PPP pet → invoxia.device → invoxia.entity to find biometric records
  const { data: device } = await admin.schema("invoxia").from("devices")
    .select("id, last_synced_at").eq("pet_id", petId).maybeSingle();
  let entityIds: number[] = [];
  if (device?.id) {
    const { data: ents } = await admin.schema("invoxia").from("entities")
      .select("id").eq("device_id", device.id);
    entityIds = (ents ?? []).map((e: any) => e.id);
  }

  const now = Date.now();
  const fromDay30 = new Date(now - 30 * 86_400_000).toISOString().slice(0, 10);

  // Pull data in parallel
  const [{ data: dailyHr }, { data: lifeReports }, { data: lowBattery }, { data: stays }] =
    await Promise.all([
      entityIds.length
        ? admin.schema("invoxia").from("daily_health")
            .select("entity_id, date, hr_avg")
            .in("entity_id", entityIds)
            .gte("date", fromDay30)
            .order("date", { ascending: false })
            .limit(60)
        : Promise.resolve({ data: [] as any[] }),
      entityIds.length
        ? admin.schema("invoxia").from("life_reports")
            .select("entity_id, recorded_at, msg")
            .in("entity_id", entityIds)
            .gte("recorded_at", new Date(now - 14 * 86_400_000).toISOString())
            .order("recorded_at", { ascending: false })
            .limit(14)
        : Promise.resolve({ data: [] as any[] }),
      device?.id
        ? admin.schema("invoxia").from("status_snapshots")
            .select("device_id, taken_at, battery")
            .eq("device_id", device.id)
            .lt("battery", 25)
            .gte("taken_at", new Date(now - 7 * 86_400_000).toISOString())
            .limit(20)
        : Promise.resolve({ data: [] as any[] }),
      device?.id
        ? admin.schema("invoxia").from("stays")
            .select("device_id, started_at, duration_sec")
            .eq("device_id", device.id)
            .gte("started_at", new Date(now - 14 * 86_400_000).toISOString())
            .limit(100)
        : Promise.resolve({ data: [] as any[] }),
    ]);

  const vax = (await kv.getByPrefix(`vaccination:${tenantId}:${petId}:`)) as any[];
  const bookings = ((await kv.getByPrefix(`portal_booking:${tenantId}:`)) as any[])
    .filter((b) => b.householdId === householdId)
    .filter((b) => (Array.isArray(b.petIds) ? b.petIds.includes(petId) : b.petId === petId));

  const insights: PetInsight[] = [];

  // ---- RULE 1: Resting HR trend (7d vs 30d) -----------------------------
  const hrPoints = (dailyHr ?? []).filter((h) => typeof h.hr_avg === "number");
  if (hrPoints.length >= 7) {
    const last7  = hrPoints.slice(0, 7).map((h) => h.hr_avg as number);
    const last30 = hrPoints.map((h) => h.hr_avg as number);
    const avg7  = avg(last7);
    const avg30 = avg(last30);
    const delta = pct(avg7, avg30);
    const range = expectedHrRange(weightKg);
    const inRange = avg7 >= range.low && avg7 <= range.high;

    if (Math.abs(delta) >= 5) {
      const direction = delta > 0 ? "higher" : "lower";
      const sev: PetInsight["severity"] =
        !inRange ? "watch" : Math.abs(delta) > 12 ? "watch" : "info";
      const interpretation =
        delta < 0
          ? `${petName} has been calmer than usual — possibly more rest, less stress, or a steady routine.`
          : `${petName} has been more active or had elevated stress. Worth noting if combined with reduced play or appetite.`;
      insights.push({
        id: `hr-trend-7d`,
        generatedAt: new Date().toISOString(),
        category: "health",
        severity: sev,
        title: `Resting heart rate trending ${direction}`,
        narrative: `${petName}'s 7-day average is ${Math.round(avg7)} bpm vs a 30-day baseline of ${Math.round(avg30)} bpm (${delta > 0 ? "+" : ""}${delta.toFixed(1)}%). ${interpretation}`,
        actionable: !inRange ? `Range is outside typical ${range.low}-${range.high} bpm for this size dog — mention at next vet visit if it persists.` : undefined,
        data: { avg7, avg30, delta, range, baselineDays: 30 },
      });
    } else if (Math.abs(delta) < 2 && inRange) {
      insights.push({
        id: `hr-steady`,
        generatedAt: new Date().toISOString(),
        category: "wellness",
        severity: "good",
        title: `Heart rate steady`,
        narrative: `${petName}'s resting HR has been stable at around ${Math.round(avg7)} bpm — a sign of good cardiovascular consistency.`,
        data: { avg7, avg30 },
      });
    }
  }

  // ---- RULE 2: Vaccinations due soon ------------------------------------
  for (const v of vax) {
    const expIso = v.next_due_date || v.expires_at || v.expiresAt;
    if (!expIso) continue;
    const days = daysUntil(expIso);
    if (days < 0) {
      insights.push({
        id: `vax-expired-${v.id}`,
        generatedAt: new Date().toISOString(),
        category: "preventive",
        severity: "concern",
        title: `${(v.vaccination_type || v.vaxType || "Vaccination").toString().toUpperCase()} has expired`,
        narrative: `Expired ${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"} ago. Many daycares (and ours) require current vaccinations before booking.`,
        actionable: `Book a vet visit to renew.`,
        data: { vaxId: v.id, expiresAt: expIso },
      });
    } else if (days <= 30) {
      insights.push({
        id: `vax-due-${v.id}`,
        generatedAt: new Date().toISOString(),
        category: "preventive",
        severity: days <= 7 ? "watch" : "info",
        title: `${(v.vaccination_type || v.vaxType || "Vaccination").toString().toUpperCase()} due soon`,
        narrative: `Due in ${days} day${days === 1 ? "" : "s"}. Renewing early avoids any booking gaps.`,
        actionable: `Book a vet visit.`,
        data: { vaxId: v.id, expiresAt: expIso, daysUntil: days },
      });
    }
  }

  // ---- RULE 3: Booking-biometric correlation (recent grooming/overnight)
  const recentBookings = bookings
    .filter((b) => b.startAt && Math.abs(now - new Date(b.startAt).getTime()) < 14 * 86_400_000)
    .filter((b) => b.status !== "cancelled" && b.status !== "declined");
  for (const b of recentBookings) {
    const bookingTs = new Date(b.startAt).getTime();
    const isPast = bookingTs < now;
    if (!isPast) continue;
    // Find HR readings on the same day + the day after the booking
    const sameDay = hrPoints.find((h) =>
      new Date(h.date).toDateString() === new Date(bookingTs).toDateString(),
    );
    const baseline = avg(hrPoints.slice(0, 14).map((h) => h.hr_avg as number));
    if (!sameDay || !baseline) continue;
    const delta = pct(sameDay.hr_avg as number, baseline);
    if (Math.abs(delta) < 4) continue;
    const service = (b.serviceType ?? "appointment").toString();
    const isGroom = /groom/i.test(service);
    const isOvernight = /overnight|board|kennel/i.test(service);
    let label = service;
    if (isGroom) label = "grooming visit";
    else if (isOvernight) label = "overnight stay";
    insights.push({
      id: `booking-hr-${b.id}`,
      generatedAt: new Date().toISOString(),
      category: "behavior",
      severity: "info",
      title: `Heart rate ${delta > 0 ? "elevated" : "dipped"} on ${label} day`,
      narrative: `${petName}'s resting HR on the day of the ${label} (${new Date(bookingTs).toLocaleDateString("en-GB", { weekday: "long" })}) was ${Math.round(sameDay.hr_avg as number)} bpm — ${delta > 0 ? "+" : ""}${delta.toFixed(0)}% vs her 2-week baseline of ${Math.round(baseline)} bpm. ${delta > 0 ? "Typical for many dogs — most return to baseline within 24-48h." : "She seems to have had a relaxed day."}`,
      data: { bookingId: b.id, sameDayHr: sameDay.hr_avg, baseline, delta },
    });
  }

  // ---- RULE 4: Activity pattern (parse life_reports for "X hours") -------
  const hoursToday = parseLifeReportHours((lifeReports ?? [])[0]?.msg);
  const hoursLastWeek = (lifeReports ?? []).slice(1, 8)
    .map((r) => parseLifeReportHours(r.msg))
    .filter((n): n is number => n != null);
  if (hoursToday != null && hoursLastWeek.length >= 3) {
    const avgPast = avg(hoursLastWeek);
    const delta = pct(hoursToday, avgPast);
    if (delta <= -25) {
      insights.push({
        id: `activity-drop`,
        generatedAt: new Date().toISOString(),
        category: "activity",
        severity: "watch",
        title: `Activity is lower than usual`,
        narrative: `${petName} has logged ${hoursToday.toFixed(1)} h of activity today vs her ${avgPast.toFixed(1)} h weekly average. Could just be a rest day — but worth noticing if combined with reduced appetite or play.`,
        actionable: `Watch for other signs of low energy over the next 1-2 days.`,
        data: { hoursToday, avgWeek: avgPast, delta },
      });
    } else if (delta >= 30) {
      insights.push({
        id: `activity-up`,
        generatedAt: new Date().toISOString(),
        category: "activity",
        severity: "good",
        title: `Active day for ${petName}`,
        narrative: `${hoursToday.toFixed(1)} h of activity today — ${delta.toFixed(0)}% above her weekly average. Looks like a great day out.`,
        data: { hoursToday, avgWeek: avgPast, delta },
      });
    }
  }

  // ---- RULE 5: Tracker battery pattern ----------------------------------
  if ((lowBattery?.length ?? 0) >= 3) {
    insights.push({
      id: `tracker-battery`,
      generatedAt: new Date().toISOString(),
      category: "tracker",
      severity: "info",
      title: `Tracker battery has been running low`,
      narrative: `${lowBattery!.length} low-battery alerts in the last 7 days. The collar drains faster in cold weather or with heavy GPS tracking.`,
      actionable: `Try charging overnight so it's full by morning daycare drop-off.`,
      data: { lowReadingsLast7Days: lowBattery!.length },
    });
  }

  // ---- RULE 6: Tracker offline / no data --------------------------------
  if (device && device.last_synced_at) {
    const sinceSync = (now - new Date(device.last_synced_at).getTime()) / 3_600_000;
    if (sinceSync > 6) {
      insights.push({
        id: `tracker-offline`,
        generatedAt: new Date().toISOString(),
        category: "tracker",
        severity: "watch",
        title: `Tracker hasn't synced in ${Math.round(sinceSync)} h`,
        narrative: `Usually we hear from Meg's collar every few minutes. Long gaps usually mean weak cellular signal, very low battery, or the collar is off.`,
        actionable: `If she's home, bring the collar near the charger and check the indicator light.`,
        data: { hoursSinceSync: sinceSync },
      });
    }
  }

  // ---- RULE 7: Birthday coming up ---------------------------------------
  if (dob) {
    const birth = new Date(dob);
    if (!Number.isNaN(birth.getTime())) {
      const thisYearBday = new Date(now);
      thisYearBday.setMonth(birth.getMonth(), birth.getDate());
      thisYearBday.setHours(0, 0, 0, 0);
      let nextBday = thisYearBday;
      if (thisYearBday.getTime() < now) {
        nextBday = new Date(thisYearBday);
        nextBday.setFullYear(thisYearBday.getFullYear() + 1);
      }
      const days = Math.ceil((nextBday.getTime() - now) / 86_400_000);
      if (days >= 0 && days <= 14) {
        const nextAge = nextBday.getFullYear() - birth.getFullYear();
        insights.push({
          id: `birthday`,
          generatedAt: new Date().toISOString(),
          category: "celebration",
          severity: "good",
          title: days === 0
            ? `🎉 It's ${petName}'s birthday!`
            : `${petName}'s birthday in ${days} day${days === 1 ? "" : "s"}`,
          narrative: days === 0
            ? `${petName} is turning ${nextAge} today. Maybe a special walk or a new toy?`
            : `${petName} will be ${nextAge} on ${nextBday.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}.`,
          data: { dob, nextAge },
        });
      }
    }
  }

  // ---- RULE 8: Data coverage celebration --------------------------------
  if (hrPoints.length >= 14 && insights.length < 4) {
    insights.push({
      id: `data-coverage`,
      generatedAt: new Date().toISOString(),
      category: "wellness",
      severity: "good",
      title: `Building a strong health baseline`,
      narrative: `We've captured ${hrPoints.length} days of heart-rate data — enough to spot trends early. The more consistent the data, the earlier we can flag changes.`,
      data: { hrDays: hrPoints.length },
    });
  }

  // Sort by severity (concern → watch → info → good)
  const sev: Record<PetInsight["severity"], number> = { concern: 0, watch: 1, info: 2, good: 3 };
  insights.sort((a, b) => sev[a.severity] - sev[b.severity]);

  return c.json({
    pet_id: petId,
    generatedAt: new Date().toISOString(),
    count: insights.length,
    insights,
  });
});

function parseLifeReportHours(msg: string | null | undefined): number | null {
  if (!msg) return null;
  // Matches "X hours and Y minutes" or "X hours" (Invoxia phrasing)
  const m1 = msg.match(/(\d+)\s*hours?\s*(?:and)?\s*(\d+)?\s*minutes?/i);
  if (m1) {
    const h = parseInt(m1[1]!, 10);
    const min = m1[2] ? parseInt(m1[2], 10) : 0;
    return h + min / 60;
  }
  const m2 = msg.match(/(\d+)\s*hours?/i);
  if (m2) return parseInt(m2[1]!, 10);
  return null;
}

// ----- Unified Pet Health Timeline --------------------------------------
// Single chronological feed combining tracker biometrics, bookings (owner +
// staff-side), vaccinations, incidents, and Invoxia life-reports for one
// pet. This is the view Invoxia cannot offer — they don't have booking,
// vaccination, or staff-note context.

interface TimelineEvent {
  id: string;
  ts: string;                          // ISO timestamp
  category:
    | "biometric"    // HR, RR, HRV daily summary
    | "booking"      // daycare/grooming/overnight/transport (staff or owner)
    | "vaccination"
    | "incident"
    | "stay"         // location cluster (when Meg was at a place)
    | "life_report"  // Invoxia's daily prose
    | "device"       // battery low / sync issue / new tracker pairing
    | "note";        // staff or owner note
  type: string;                        // category-specific subtype
  title: string;
  subtitle?: string;
  data?: Record<string, any>;
  severity?: "info" | "warning" | "error" | "success";
}

portal.get("/pets/:id/timeline", async (c) => {
  const auth = await readPortalUser(c);
  if ("error" in auth) return c.json({ error: auth.error }, auth.status as 401 | 403);
  const { tenantId, householdId } = auth;
  const petId = c.req.param("id");

  // Validate ownership
  const pet = (await kv.get(`customer:${tenantId}:pet:${householdId}:${petId}`)) as any;
  if (!pet) return c.json({ error: "Not your pet" }, 403);

  const from = c.req.query("from"); // ISO date — default 60 days ago
  const to   = c.req.query("to");   // ISO date — default today + 7 days
  const fromTs = from ? new Date(from).getTime() : Date.now() - 60 * 86_400_000;
  const toTs   = to   ? new Date(to).getTime()   : Date.now() + 7 * 86_400_000;
  const inRange = (iso: string | null | undefined) => {
    if (!iso) return false;
    const t = new Date(iso).getTime();
    return Number.isFinite(t) && t >= fromTs && t <= toTs;
  };

  const events: TimelineEvent[] = [];

  // --- 1. Pet creation event (always shown if in range) ------------------
  if (pet?.created_at && inRange(pet.created_at)) {
    events.push({
      id: `pet-created-${petId}`,
      ts: pet.created_at,
      category: "note",
      type: "pet_created",
      title: `${pet.name} joined PawPilotPro`,
      subtitle: pet.breed ? `${pet.breed}` : undefined,
      severity: "success",
    });
  }

  // --- 2. Vaccinations ---------------------------------------------------
  const vaxRecords = (await kv.getByPrefix(`vaccination:${tenantId}:${petId}:`)) as any[];
  for (const v of vaxRecords) {
    const issued = v.date_administered || v.issued_at || v.issuedAt;
    if (inRange(issued)) {
      events.push({
        id: `vax-issued-${v.id}`,
        ts: issued,
        category: "vaccination",
        type: "issued",
        title: `${(v.vaccination_type || v.vaccine_type || v.vaxType || "Vaccination").toString().toUpperCase()} given`,
        subtitle: v.veterinarian ? `Vet: ${v.veterinarian}` : undefined,
        data: { vaccinationId: v.id },
        severity: "success",
      });
    }
    const expires = v.next_due_date || v.expires_at || v.expiresAt;
    if (inRange(expires)) {
      const expTs = new Date(expires).getTime();
      const past = expTs < Date.now();
      events.push({
        id: `vax-exp-${v.id}`,
        ts: expires,
        category: "vaccination",
        type: past ? "expired" : "due",
        title: past
          ? `${(v.vaccination_type || v.vaxType || "Vaccination").toString().toUpperCase()} expired`
          : `${(v.vaccination_type || v.vaxType || "Vaccination").toString().toUpperCase()} due for renewal`,
        data: { vaccinationId: v.id },
        severity: past ? "error" : "warning",
      });
    }
  }

  // --- 3. Bookings — both owner-side + staff-side -----------------------
  // Owner-submitted (portal_booking:*) keyed by household
  const ownerBookings = (await kv.getByPrefix(`portal_booking:${tenantId}:`) as any[])
    .filter((b) => b.householdId === householdId)
    .filter((b) => Array.isArray(b.petIds) ? b.petIds.includes(petId) : (b.petId === petId));
  for (const b of ownerBookings) {
    if (inRange(b.startAt)) {
      events.push({
        id: `pb-${b.id}`,
        ts: b.startAt,
        category: "booking",
        type: b.serviceType || "service",
        title: `${b.serviceType ? cap(b.serviceType) : "Booking"} — ${b.status ?? "scheduled"}`,
        subtitle: b.notes,
        data: { bookingId: b.id, source: "portal" },
        severity: b.status === "cancelled" || b.status === "declined" ? "warning" : "info",
      });
    }
  }

  // Staff-side bookings live under per-service prefixes. Filter by pet_id.
  const STAFF_BOOKING_PREFIXES: Array<[string, string]> = [
    ["daycare:booking:", "daycare"],
    ["overnight:booking:", "overnight"],
    ["grooming:booking:", "grooming"],
    ["transport:booking:", "transport"],
  ];
  for (const [prefix, service] of STAFF_BOOKING_PREFIXES) {
    const all = (await kv.getByPrefix(prefix)) as any[];
    for (const b of all) {
      if (b.tenant_id && b.tenant_id !== tenantId) continue;
      const matchesPet =
        b.pet_id === petId ||
        b.petId === petId ||
        (Array.isArray(b.pet_ids) && b.pet_ids.includes(petId)) ||
        (Array.isArray(b.pets) && b.pets.some((p: any) => p === petId || p?.id === petId));
      if (!matchesPet) continue;
      const ts = b.start_at || b.booking_date || b.created_at;
      if (!inRange(ts)) continue;
      events.push({
        id: `sb-${service}-${b.id}`,
        ts,
        category: "booking",
        type: service,
        title: `${cap(service)} ${b.status ?? "scheduled"}`,
        subtitle: b.notes ?? b.service_type ?? b.kennel_id ?? undefined,
        data: { bookingId: b.id, source: "staff", service },
        severity: b.status === "cancelled" ? "warning" : "info",
      });
    }
  }

  // --- 4. Incidents ------------------------------------------------------
  const incidents = (await kv.getByPrefix(`incident:main:`)) as any[];
  for (const i of incidents) {
    if (i.tenant_id && i.tenant_id !== tenantId) continue;
    const matchesPet =
      i.pet_id === petId ||
      (Array.isArray(i.pet_ids) && i.pet_ids.includes(petId)) ||
      (Array.isArray(i.pets) && i.pets.some((p: any) => p === petId || p?.id === petId));
    if (!matchesPet) continue;
    const ts = i.occurred_at || i.created_at;
    if (!inRange(ts)) continue;
    events.push({
      id: `inc-${i.id}`,
      ts,
      category: "incident",
      type: i.category || "incident",
      title: i.title || `Incident — ${i.severity ?? "logged"}`,
      subtitle: i.description?.slice(0, 140),
      data: { incidentId: i.id, severity: i.severity },
      severity: i.severity === "high" || i.severity === "critical" ? "error"
              : i.severity === "medium" ? "warning"
              : "info",
    });
  }

  // --- 5. Invoxia biometric & device data (Postgres) ---------------------
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  const fromIso = new Date(fromTs).toISOString();
  const toIso   = new Date(toTs).toISOString();

  const [{ data: dailyHR }, { data: lifeReports }, { data: stays }, { data: lowBattery }, { data: device }] =
    await Promise.all([
      admin.schema("invoxia").from("daily_health")
        .select("entity_id, date, hr_avg")
        .gte("date", fromIso.slice(0, 10))
        .lte("date", toIso.slice(0, 10))
        .order("date", { ascending: false })
        .limit(120),
      admin.schema("invoxia").from("life_reports")
        .select("entity_id, recorded_at, type, msg")
        .gte("recorded_at", fromIso)
        .lte("recorded_at", toIso)
        .order("recorded_at", { ascending: false })
        .limit(120),
      admin.schema("invoxia").from("stays")
        .select("device_id, started_at, ended_at, lat, lng, duration_sec, point_count")
        .gte("started_at", fromIso)
        .lte("started_at", toIso)
        .order("started_at", { ascending: false })
        .limit(40),
      admin.schema("invoxia").from("status_snapshots")
        .select("device_id, taken_at, battery, raw")
        .gte("taken_at", fromIso)
        .lte("taken_at", toIso)
        .lt("battery", 20)
        .order("taken_at", { ascending: false })
        .limit(20),
      admin.schema("invoxia").from("devices")
        .select("id, name, pet_id, invoxia_created_at, last_synced_at")
        .eq("pet_id", petId)
        .maybeSingle(),
    ]);

  // The entity link between PawPilotPro pet and Invoxia entity goes through
  // devices.pet_id → devices.id → entities.device_id. Pull the entity once.
  let entityIds: number[] = [];
  if (device?.id) {
    const { data: ents } = await admin.schema("invoxia").from("entities")
      .select("id").eq("device_id", device.id);
    entityIds = (ents ?? []).map((e: any) => e.id);
  }
  const inEntity = (eid: number | null | undefined) => eid != null && entityIds.includes(eid);

  for (const h of dailyHR ?? []) {
    if (!inEntity(h.entity_id)) continue;
    const hr = Math.round(h.hr_avg ?? 0);
    events.push({
      id: `hr-${h.entity_id}-${h.date}`,
      ts: `${h.date}T20:00:00Z`, // surface as evening summary
      category: "biometric",
      type: "daily_hr",
      title: `Resting heart rate: ${hr} bpm`,
      subtitle: hr === 0 ? undefined
        : hr < 50 ? "Below typical range — review with vet if persistent"
        : hr > 100 ? "Above typical range — note if active before reading"
        : "Within normal range for dogs",
      data: { hr_avg: h.hr_avg, date: h.date },
      severity: hr === 0 ? "info" : (hr < 50 || hr > 100) ? "warning" : "success",
    });
  }

  for (const r of lifeReports ?? []) {
    if (!inEntity(r.entity_id)) continue;
    events.push({
      id: `lr-${r.entity_id}-${r.recorded_at}`,
      ts: r.recorded_at,
      category: "life_report",
      type: r.type ?? "status",
      title: "Daily activity report",
      subtitle: r.msg,
      data: { msg: r.msg },
    });
  }

  for (const s of stays ?? []) {
    if (device?.id && s.device_id !== device.id) continue;
    const min = Math.round((s.duration_sec ?? 0) / 60);
    if (min < 30) continue; // skip noise
    events.push({
      id: `stay-${s.device_id}-${s.started_at}`,
      ts: s.started_at,
      category: "stay",
      type: "location_cluster",
      title: `Stay at one location: ${min} min`,
      subtitle: `${s.lat?.toFixed(4)}, ${s.lng?.toFixed(4)}`,
      data: s,
    });
  }

  for (const b of lowBattery ?? []) {
    if (device?.id && b.device_id !== device.id) continue;
    events.push({
      id: `bat-${b.device_id}-${b.taken_at}`,
      ts: b.taken_at,
      category: "device",
      type: "low_battery",
      title: `Tracker battery low: ${b.battery}%`,
      subtitle: "Charge the collar to keep tracking continuous",
      severity: b.battery < 10 ? "error" : "warning",
    });
  }

  if (device?.invoxia_created_at && inRange(device.invoxia_created_at)) {
    events.push({
      id: `dev-paired-${device.id}`,
      ts: device.invoxia_created_at,
      category: "device",
      type: "paired",
      title: `Tracker activated`,
      subtitle: device.name ?? undefined,
      severity: "success",
    });
  }

  // --- 6. Sort + group + return -----------------------------------------
  events.sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime());

  // Group by yyyy-mm-dd for the UI
  const byDay: Record<string, TimelineEvent[]> = {};
  for (const e of events) {
    const day = e.ts.slice(0, 10);
    (byDay[day] ??= []).push(e);
  }
  const days = Object.entries(byDay)
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([date, items]) => ({ date, items }));

  return c.json({
    pet_id: petId,
    from: fromIso, to: toIso,
    total: events.length,
    days,
  });
});

function cap(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

// ----- Invoxia BLE bridge ingest ---------------------------------------
// The portal iOS app's Tracker screen captures raw BLE packets from the
// dog's Biotracker collar and batch-uploads them here. The packets are
// landed raw (opaque hex) in invoxia.ble_packets for later decoding.

const blePacketSchema = z.object({
  device_serial: z.string().nullable().optional(),
  device_name:   z.string().nullable().optional(),
  packets: z.array(z.object({
    char: z.string().min(8).max(64),
    hex:  z.string().regex(/^[0-9a-fA-F]*$/),
    at:   z.number().int().positive(),
  })).max(500),
});

// ----- "Find my dog" — force a fresh GPS sync --------------------------
// Fires the invoxia-sync edge function with mode=positions so Invoxia's
// latest /api/v2/positions is pulled in immediately rather than waiting
// for the next 5-minute cron tick.  Returns immediately — the client
// polls /whereabouts on a 5s interval to surface any new pings as they
// land in Supabase.  This is the Invoxia-app "Locate" button equivalent.
portal.post("/pets/:id/locate", async (c) => {
  const auth = await readPortalUser(c);
  if ("error" in auth) return c.json({ error: auth.error }, auth.status as 401 | 403);
  const { tenantId, householdId } = auth;
  const petId = c.req.param("id");

  const pet = await kv.get(`customer:${tenantId}:pet:${householdId}:${petId}`);
  if (!pet) return c.json({ error: "Not your pet" }, 403);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const cronSecret  = Deno.env.get("INVOXIA_CRON_SECRET");
  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  // Guard: must have a linked tracker.
  const { data: device } = await admin.schema("invoxia").from("devices")
    .select("id, name").eq("pet_id", petId).maybeSingle();
  if (!device?.id) {
    return c.json({ error: "No tracker linked to this pet" }, 404);
  }

  // Fire the sync function — service role key is sufficient if the cron
  // secret isn't set in this function's env.
  const triggerAuth = cronSecret ? `Bearer ${cronSecret}` : `Bearer ${serviceKey}`;
  const syncUrl = `${supabaseUrl}/functions/v1/invoxia-sync`;

  // Background-fire: don't block the response.  The Deno runtime keeps the
  // task alive until completion.  Most syncs finish in 2–6 s.
  const triggeredAt = new Date().toISOString();
  fetch(syncUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: triggerAuth },
    body: JSON.stringify({ mode: "positions" }),
  })
    .then((r) => r.ok
      ? console.log(`[locate] sync triggered for device ${device.id} (HTTP ${r.status})`)
      : r.text().then((t) => console.warn(`[locate] sync HTTP ${r.status}: ${t.slice(0, 200)}`)))
    .catch((e) => console.warn("[locate] sync trigger failed", e?.message ?? e));

  // Audit ping for staff so they can see "owner pinged the collar at HH:MM".
  try {
    await kv.set(`audit:locate:${tenantId}:${petId}:${triggeredAt}`, {
      tenantId, householdId, petId, deviceId: device.id,
      triggeredBy: auth.user?.email ?? auth.user?.id ?? "owner",
      at: triggeredAt,
    });
  } catch { /* non-fatal */ }

  return c.json({
    ok: true,
    deviceId: device.id,
    deviceName: device.name,
    triggeredAt,
    suggestedPollSec: 5,
    maxDurationSec: 60,
  });
});

// ----- Owner-side pet photo upload -------------------------------------
// Lets the household update the pet's hero photo from the portal.  Writes
// to the same Storage bucket the staff app uses (make-fc003b23-pet-photos),
// then updates the pet KV record so staff dashboards see the new photo
// the next time they reload — same key used by every staff read path, so
// no extra propagation work needed.
portal.post("/pets/:id/photo", async (c) => {
  const auth = await readPortalUser(c);
  if ("error" in auth) return c.json({ error: auth.error }, auth.status as 401 | 403);
  const { tenantId, householdId } = auth;
  const petId = c.req.param("id");

  const pet = await kv.get(`customer:${tenantId}:pet:${householdId}:${petId}`);
  if (!pet) return c.json({ error: "Not your pet" }, 403);

  let form: FormData;
  try { form = await c.req.formData(); }
  catch { return c.json({ error: "Expected multipart/form-data" }, 400); }

  const file = form.get("file");
  if (!(file instanceof File)) return c.json({ error: "Missing file" }, 400);
  if (!file.type.startsWith("image/")) return c.json({ error: "File must be an image" }, 400);
  if (file.size > 8 * 1024 * 1024)    return c.json({ error: "Image must be < 8 MB" }, 400);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  // Stable filename per pet so consecutive uploads overwrite — no orphans,
  // no stale cache (we cache-bust on the client with ?v=Date.now() instead).
  const extFromType = file.type.split("/")[1]?.replace("jpeg", "jpg") ?? "jpg";
  const safeExt = ["jpg", "png", "webp", "heic", "heif"].includes(extFromType) ? extFromType : "jpg";
  const filePath = `pet-photos/${tenantId}/${petId}.${safeExt}`;

  const buffer = new Uint8Array(await file.arrayBuffer());

  const { error: upErr } = await admin.storage
    .from(PET_PHOTOS_BUCKET)
    .upload(filePath, buffer, {
      contentType: file.type,
      cacheControl: "3600",
      upsert: true,
    });
  if (upErr) {
    return internalError(c, 'portal.petPhotoUpload', upErr);
  }

  // Persist on the canonical pet record — staff reads use the same key.
  //
  // The bucket is private, so the record stores the STORAGE PATH
  // (photo_path); every read path mints a fresh signed URL from it. The
  // legacy photo_url/photoUrl fields are cleared so no stale public URL can
  // shadow the new photo (petToWire and staff readers resolve via
  // storedPetPhoto, which prefers photo_path). Cache-busting is free now:
  // each mint carries a fresh token, so ?v= is no longer needed.
  const updatedPet = applyPetPhotoWrite(
    {
      ...pet,
      updated_at: new Date().toISOString(),
      photo_updated_by: "owner",
      photo_updated_at: new Date().toISOString(),
    },
    filePath,
  );
  await kv.set(`customer:${tenantId}:pet:${householdId}:${petId}`, updatedPet);
  await dualWriteCustomers([dwSet(`customer:${tenantId}:pet:${householdId}:${petId}`, updatedPet)]);

  // Optional audit ping for the staff team — tells them a household updated
  // a photo without requiring them to diff KV manually.
  try {
    const now = new Date().toISOString();
    await kv.set(`audit:photo:${tenantId}:${petId}:${now}`, {
      tenantId, householdId, petId,
      updatedBy: auth.user?.email ?? auth.user?.id ?? "owner",
      at: now,
      photoPath: filePath,
    });
  } catch { /* non-fatal */ }

  return c.json({ ok: true, photoUrl: await signPetPhotoUrl(filePath) });
});

portal.post("/pets/:id/tracker/ble", async (c) => {
  const auth = await readPortalUser(c);
  if ("error" in auth) return c.json({ error: auth.error }, auth.status as 401 | 403);
  const { tenantId, householdId } = auth;
  const petId = c.req.param("id");

  // Validate the caller actually owns this pet.
  const pet = await kv.get(`customer:${tenantId}:pet:${householdId}:${petId}`);
  if (!pet) return c.json({ error: "Not your pet" }, 403);

  let body: z.infer<typeof blePacketSchema>;
  try { body = blePacketSchema.parse(await c.req.json()); }
  catch { return c.json({ error: "Invalid payload" }, 400); }

  if (body.packets.length === 0) return c.json({ ok: true, inserted: 0 });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  const rows = body.packets.map((p) => ({
    device_serial: body.device_serial ?? null,
    pet_id:        petId,
    tenant_id:     tenantId,
    household_id:  householdId,
    char_uuid:     p.char.toUpperCase(),
    hex:           p.hex.toLowerCase(),
    received_at:   new Date(p.at).toISOString(),
  }));

  const { error, count } = await admin
    .schema("invoxia").from("ble_packets")
    .insert(rows, { count: "exact" });
  if (error) return internalError(c, 'portal.trackerBle', error);
  return c.json({ ok: true, inserted: count ?? rows.length });
});

portal.get("/pets/:id/tracker/status", async (c) => {
  const auth = await readPortalUser(c);
  if ("error" in auth) return c.json({ error: auth.error }, auth.status as 401 | 403);
  const { tenantId, householdId } = auth;
  const petId = c.req.param("id");

  const pet = await kv.get(`customer:${tenantId}:pet:${householdId}:${petId}`);
  if (!pet) return c.json({ error: "Not your pet" }, 403);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  const { data, error } = await admin
    .schema("invoxia").from("ble_capture_status")
    .select("*")
    .eq("pet_id", petId)
    .maybeSingle();
  if (error) return internalError(c, 'portal.trackerStatus', error);
  return c.json({ pet_id: petId, status: data ?? null });
});

// ----- Whereabouts (cloud GPS) -----------------------------------------
// Pulls from invoxia.positions + invoxia.stays — populated by the cron-driven
// invoxia-sync function every 5 minutes.  Owner sees where the collar's been
// even when BLE isn't connected.  This is the "cloud is source-of-truth, BLE
// is the live overlay" story made concrete.
portal.get("/pets/:id/whereabouts", async (c) => {
  const auth = await readPortalUser(c);
  if ("error" in auth) return c.json({ error: auth.error }, auth.status as 401 | 403);
  const { tenantId, householdId } = auth;
  const petId = c.req.param("id");

  const pet = await kv.get(`customer:${tenantId}:pet:${householdId}:${petId}`);
  if (!pet) return c.json({ error: "Not your pet" }, 403);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  const { data: device } = await admin.schema("invoxia").from("devices")
    .select("id, name, status, config").eq("pet_id", petId).maybeSingle();

  if (!device?.id) {
    return c.json({
      pet_id: petId, lastSeen: null, positions: [], stays: [], coverage: "no_device",
      deviceStatus: null,
    });
  }

  // Latest device status summary — battery, charging, online/offline,
  // operator, alerts.  Backed by invoxia.device_status_summary which the
  // cron writes a fresh row to on every sync.
  const { data: statusSummary } = await admin.schema("invoxia").from("device_status_summary")
    .select("battery_pct, charging, state, last_synced_at, last_position_at, low_battery_alert, offline_alert")
    .eq("device_id", device.id)
    .maybeSingle();

  // The device row itself carries the carrier (Soracom, etc.) and the
  // subscription end-date inside the JSONB `status` blob.
  const status = (device.status ?? {}) as Record<string, any>;
  const config = (device.config ?? {}) as Record<string, any>;

  // Last 48h of pings.
  const sinceIso = new Date(Date.now() - 48 * 3_600_000).toISOString();
  const { data: positions } = await admin.schema("invoxia").from("positions")
    .select("recorded_at, lat, lng, precision_m, method")
    .eq("device_id", device.id)
    .gte("recorded_at", sinceIso)
    .order("recorded_at", { ascending: false })
    .limit(300);

  // Last 7d of stays — places lingered at, deduped by the cron.
  const sinceStays = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const { data: stays } = await admin.schema("invoxia").from("stays")
    .select("started_at, ended_at, lat, lng, point_count, duration_sec")
    .eq("device_id", device.id)
    .gte("started_at", sinceStays)
    .order("started_at", { ascending: false })
    .limit(50);

  // Absolute latest position regardless of how stale.
  const { data: latest } = await admin.schema("invoxia").from("positions")
    .select("recorded_at, lat, lng, precision_m, method")
    .eq("device_id", device.id)
    .order("recorded_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return c.json({
    pet_id: petId,
    deviceName: device.name ?? null,
    lastSeen: latest ? {
      lat: Number(latest.lat),
      lng: Number(latest.lng),
      accuracy_m: latest.precision_m,
      recorded_at: latest.recorded_at,
      method: latest.method,
    } : null,
    positions: (positions ?? []).map((p: any) => ({
      ts: p.recorded_at,
      lat: Number(p.lat),
      lng: Number(p.lng),
      accuracy_m: p.precision_m,
    })),
    stays: (stays ?? []).map((s: any) => ({
      startedAt: s.started_at,
      endedAt:   s.ended_at,
      durationSec: s.duration_sec ?? 0,
      pointCount: s.point_count ?? 0,
      lat: Number(s.lat),
      lng: Number(s.lng),
    })),
    coverage: positions?.length ? "live" : "stale",
    deviceStatus: {
      battery_pct: statusSummary?.battery_pct ?? status.battery ?? null,
      charging:    statusSummary?.charging   ?? status.charging ?? null,
      state:       statusSummary?.state      ?? status.state    ?? "unknown",
      lowBattery:  !!statusSummary?.low_battery_alert,
      offline:     !!statusSummary?.offline_alert,
      lastSyncedAt: statusSummary?.last_synced_at ?? null,
      network:      status.network_operator ?? config.network ?? null,
      subscriptionEnds: status.sub_end_date ?? null,
    },
  });
});

// ----- Activity (cloud-derived) ----------------------------------------
// Surfaces what the collar's cellular link has logged: today's activity hours,
// health session count + duration, plus a 14-day HR window we can chart.  All
// derived from invoxia.life_reports + invoxia.daily_health.
portal.get("/pets/:id/activity", async (c) => {
  const auth = await readPortalUser(c);
  if ("error" in auth) return c.json({ error: auth.error }, auth.status as 401 | 403);
  const { tenantId, householdId } = auth;
  const petId = c.req.param("id");

  const pet = await kv.get(`customer:${tenantId}:pet:${householdId}:${petId}`);
  if (!pet) return c.json({ error: "Not your pet" }, 403);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  const { data: device } = await admin.schema("invoxia").from("devices")
    .select("id").eq("pet_id", petId).maybeSingle();

  if (!device?.id) {
    return c.json({ pet_id: petId, today: null, hrSeries: [], lastActivity: null, lastHealth: null, reports: [] });
  }

  const { data: ents } = await admin.schema("invoxia").from("entities")
    .select("id, last_health_at, last_activity_at").eq("device_id", device.id);
  const entityIds = (ents ?? []).map((e: any) => e.id);

  if (entityIds.length === 0) {
    return c.json({ pet_id: petId, today: null, hrSeries: [], lastActivity: null, lastHealth: null, reports: [] });
  }

  const { data: reports } = await admin.schema("invoxia").from("life_reports")
    .select("recorded_at, msg, type")
    .in("entity_id", entityIds)
    .order("recorded_at", { ascending: false })
    .limit(7);

  function parseHours(s: string | null | undefined): number | null {
    if (!s) return null;
    const m = s.match(/(\d+)\s*hours?\s+today/i);
    return m ? Number(m[1]) : null;
  }
  function parseSessions(s: string | null | undefined): { count: number; minutes: number } | null {
    if (!s) return null;
    const m = s.match(/(\d+)\s+health\s+sessions?\s+totaling\s+(\d+)\s*minutes?/i);
    return m ? { count: Number(m[1]), minutes: Number(m[2]) } : null;
  }

  const todaysMsg = reports?.[0]?.msg ?? null;

  const fromIso = new Date(Date.now() - 14 * 86_400_000).toISOString().slice(0, 10);
  const { data: dailyHealth } = await admin.schema("invoxia").from("daily_health")
    .select("date, hr_avg")
    .in("entity_id", entityIds)
    .gte("date", fromIso)
    .order("date", { ascending: true });

  const mostRecentEnt = (ents ?? []).reduce((acc: any, e: any) => {
    if (!acc) return e;
    const a = new Date(acc.last_activity_at ?? 0).getTime();
    const b = new Date(e.last_activity_at ?? 0).getTime();
    return b > a ? e : acc;
  }, null);

  return c.json({
    pet_id: petId,
    today: todaysMsg ? {
      activeHours: parseHours(todaysMsg),
      sessions:    parseSessions(todaysMsg),
      reportAt:    reports![0].recorded_at,
    } : null,
    hrSeries: (dailyHealth ?? []).map((d: any) => ({ date: d.date, hr_avg: d.hr_avg })),
    lastActivity: mostRecentEnt?.last_activity_at ?? null,
    lastHealth:   mostRecentEnt?.last_health_at   ?? null,
    reports: (reports ?? []).map((r: any) => ({
      ts: r.recorded_at, msg: r.msg, type: r.type,
    })),
  });
});

portal.post("/vax", async (c) => {
  const auth = await readPortalUser(c);
  if ("error" in auth) return c.json({ error: auth.error }, auth.status as 401 | 403);
  const { tenantId, householdId } = auth;

  const form = await c.req.formData();
  const file = form.get("file");
  const metaRaw = form.get("meta");
  if (!(file instanceof File)) return c.json({ error: "file required" }, 400);
  if (file.size > MAX_VAX_BYTES) return c.json({ error: "file too large (max 10MB)" }, 413);
  if (!ALLOWED_VAX_MIME.has(file.type)) return c.json({ error: "PDF, JPG, or PNG only" }, 415);
  if (typeof metaRaw !== "string") return c.json({ error: "meta required" }, 400);

  let meta: any;
  try { meta = JSON.parse(metaRaw); } catch { return c.json({ error: "meta must be JSON" }, 400); }
  const petId = meta?.petId;
  if (!petId || typeof petId !== "string") return c.json({ error: "meta.petId required" }, 400);

  const pet = await kv.get(`customer:${tenantId}:pet:${householdId}:${petId}`);
  if (!pet) return c.json({ error: "Not your pet" }, 403);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(supabaseUrl, serviceKey);
  await ensureVaxBucket(admin);

  const id = crypto.randomUUID();
  const ext = (file.name.split(".").pop() ?? "bin").toLowerCase().replace(/[^a-z0-9]/g, "");
  const path = `tenant/${tenantId}/pets/${petId}/vax/${id}.${ext}`;

  const { error: upErr } = await admin.storage.from(VAX_BUCKET).upload(path, file, {
    contentType: file.type,
    upsert: false,
  });
  if (upErr) return internalError(c, 'portal.vaxUpload', upErr);

  await kv.set(`vax_review_queue:${tenantId}:${id}`, {
    id,
    tenantId,
    petId,
    petName: (pet as any).name ?? null,
    householdId,
    storagePath: path,
    mimeType: file.type,
    fileSize: file.size,
    proposedVaxType: typeof meta.vaxType === "string" ? meta.vaxType : null,
    proposedIssuedAt: typeof meta.issuedAt === "string" ? meta.issuedAt : null,
    proposedExpiresAt: typeof meta.expiresAt === "string" ? meta.expiresAt : null,
    proposedNotes: typeof meta.notes === "string" ? meta.notes : null,
    submittedAt: new Date().toISOString(),
    status: "pending",
  });

  return c.json({ ok: true, id });
});

// ----- Notifications -----------------------------------------------------

portal.get("/notifications", async (c) => {
  const auth = await readPortalUser(c);
  if ("error" in auth) return c.json({ error: auth.error }, auth.status as 401 | 403);
  const { tenantId, householdId } = auth;
  const all = ((await kv.getByPrefix(`notification:${tenantId}:${householdId}:`)) as any[])
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 50);
  return c.json({ notifications: all });
});

portal.post("/notifications/:id/read", async (c) => {
  const auth = await readPortalUser(c);
  if ("error" in auth) return c.json({ error: auth.error }, auth.status as 401 | 403);
  const { tenantId, householdId } = auth;
  const id = c.req.param("id");
  const key = `notification:${tenantId}:${householdId}:${id}`;
  const item = (await kv.get(key)) as any;
  if (!item) return c.json({ error: "Not found" }, 404);
  await kv.set(key, { ...item, readAt: new Date().toISOString() });
  return c.json({ ok: true });
});

portal.post("/notifications/read-all", async (c) => {
  const auth = await readPortalUser(c);
  if ("error" in auth) return c.json({ error: auth.error }, auth.status as 401 | 403);
  const { tenantId, householdId } = auth;
  const all = (await kv.getByPrefix(`notification:${tenantId}:${householdId}:`)) as any[];
  const now = new Date().toISOString();
  const unread = all.filter((n) => !n.readAt);
  await Promise.all(
    unread.map((n) => kv.set(`notification:${tenantId}:${householdId}:${n.id}`, { ...n, readAt: now })),
  );
  return c.json({ ok: true, marked: unread.length });
});

// ----- Account ----------------------------------------------------------

portal.get("/account", async (c) => {
  const auth = await readPortalUser(c);
  if ("error" in auth) return c.json({ error: auth.error }, auth.status as 401 | 403);
  const { tenantId, householdId } = auth;
  const household = (await kv.get(`customer:${tenantId}:household:${householdId}`)) as any;
  const contact = await getPrimaryContact(tenantId, householdId, household?.primary_contact_id);
  const link = (await kv.get(`portal_users:${tenantId}:${householdId}`)) as any;
  const name = contact ? `${contact.first_name ?? ""} ${contact.last_name ?? ""}`.trim() : "";
  return c.json({
    profile: {
      name: name || household?.name || "",
      email: contact?.email ?? auth.user.email ?? "",
      phone: contact?.phone ?? "",
    },
    notificationPrefs: link?.notificationPrefs ?? { booking: true, vax: true, marketing: false },
  });
});

const prefsSchema = z.object({
  notificationPrefs: z.object({
    booking: z.boolean(),
    vax: z.boolean(),
    marketing: z.boolean().optional(),
  }),
});

portal.patch("/account", async (c) => {
  const auth = await readPortalUser(c);
  if ("error" in auth) return c.json({ error: auth.error }, auth.status as 401 | 403);
  const { tenantId, householdId } = auth;
  const body = await c.req.json().catch(() => null);
  const parsed = prefsSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: parsed.error.format() }, 400);
  const link = (await kv.get(`portal_users:${tenantId}:${householdId}`)) as any;
  await kv.set(`portal_users:${tenantId}:${householdId}`, {
    ...(link ?? { householdId, tenantId, createdAt: new Date().toISOString() }),
    notificationPrefs: parsed.data.notificationPrefs,
  });
  return c.json({ ok: true, notificationPrefs: parsed.data.notificationPrefs });
});

portal.post("/pets/:id/edit-request", async (c) => {
  const auth = await readPortalUser(c);
  if ("error" in auth) return c.json({ error: auth.error }, auth.status as 401 | 403);
  const { tenantId, householdId } = auth;
  const id = c.req.param("id");
  const body = await c.req.json().catch(() => null);
  if (!body?.note || typeof body.note !== "string") return c.json({ error: "note required" }, 400);
  const requestNote = body.note.trim().slice(0, 2000);
  if (!requestNote) return c.json({ error: "note required" }, 400);
  const pet = (await kv.get(`customer:${tenantId}:pet:${householdId}:${id}`)) as
    | { name?: string }
    | null;
  if (!pet) return c.json({ error: "Not found" }, 404);
  const reqId = crypto.randomUUID();
  const now = new Date().toISOString();
  await kv.set(`portal_edit_requests:${tenantId}:${reqId}`, {
    id: reqId,
    petId: id,
    householdId,
    note: requestNote,
    submittedAt: now,
    status: "open",
  });

  // Surface the request where staff actually work: as a household note in
  // the same KV shape the staff Customer Detail → Notes tab reads, linked
  // to the pet. The portal_edit_requests record above has no consumer yet
  // (kept for a future dedicated queue); without this note the owner's
  // "staff will review" promise was a dead letter.
  const noteId = crypto.randomUUID();
  const editRequestNote = {
    id: noteId,
    tenant_id: tenantId,
    household_id: householdId,
    title: `Profile edit request: ${pet.name ?? "pet"} (portal)`,
    content:
      `The owner asked for a profile update via the pet portal:\n\n"${requestNote}"\n\n` +
      `Apply the change on the pet's profile, then let them know.`,
    category: "general",
    visibility: "internal",
    is_pinned: false,
    created_by: "portal",
    created_by_name: "Pet portal",
    created_at: now,
    updated_at: now,
  };
  const editRequestLink = { tenant_id: tenantId, note_id: noteId, pet_id: id };
  await kv.set(`customer:${tenantId}:household:${householdId}:note:${noteId}`, editRequestNote);
  await kv.set(`customer:${tenantId}:note:${noteId}:pet:${id}`, editRequestLink);
  // Note + link mirror in one transaction (note first — the link FKs onto it).
  await dualWriteCustomers([
    dwSet(`customer:${tenantId}:household:${householdId}:note:${noteId}`, editRequestNote),
    dwSet(`customer:${tenantId}:note:${noteId}:pet:${id}`, editRequestLink),
  ]);

  return c.json({ ok: true, id: reqId });
});

// ----- Membership interest ------------------------------------------------
// Lead capture for the memberships screen. Writes a pinned household note in
// the exact KV shape the staff Customer Detail → Notes tab already reads, so
// the lead is visible to staff immediately with no new staff surface. A
// per-tier marker dedupes repeat requests server-side (the portal UI also
// guards per session); a fresh lead for the same tier is allowed again after
// 14 days so a genuinely renewed enquiry still gets through.
portal.post("/memberships/interest", async (c) => {
  const auth = await readPortalUser(c);
  if ("error" in auth) return c.json({ error: auth.error }, auth.status as 401 | 403);
  const { tenantId, householdId } = auth;

  const body = await c.req.json().catch(() => null);
  const tier =
    typeof body?.tier === "string" && body.tier.trim()
      ? body.tier.trim().slice(0, 80)
      : "general";

  const household = (await kv.get(`customer:${tenantId}:household:${householdId}`)) as
    | { name?: string }
    | null;
  if (!household) return c.json({ error: "Household not found" }, 404);

  const markerKey = `portal_membership_interest:${tenantId}:${householdId}:${tier}`;
  const existing = (await kv.get(markerKey)) as { submittedAt?: string } | null;
  const DEDUPE_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;
  if (
    existing?.submittedAt &&
    Date.now() - new Date(existing.submittedAt).getTime() < DEDUPE_WINDOW_MS
  ) {
    return c.json({ ok: true, duplicate: true });
  }

  const noteId = crypto.randomUUID();
  const now = new Date().toISOString();
  const subject = tier === "general" ? "memberships" : `the "${tier}" membership plan`;
  const membershipNote = {
    id: noteId,
    tenant_id: tenantId,
    household_id: householdId,
    title: tier === "general" ? "Membership enquiry (portal)" : `Membership enquiry: ${tier} (portal)`,
    content:
      `The owner asked about ${subject} from the pet portal. ` +
      `They've been told the team will get back to them within 2 working days, ` +
      `and that nothing has been purchased or charged.`,
    category: "billing",
    visibility: "internal",
    is_pinned: true,
    created_by: "portal",
    created_by_name: "Pet portal",
    created_at: now,
    updated_at: now,
  };
  await kv.set(`customer:${tenantId}:household:${householdId}:note:${noteId}`, membershipNote);
  await dualWriteCustomers([
    dwSet(`customer:${tenantId}:household:${householdId}:note:${noteId}`, membershipNote),
  ]);
  await kv.set(markerKey, { submittedAt: now, noteId });
  return c.json({ ok: true });
});

// =======================================================================
// PHASE A — Household self-service
// =======================================================================
// The portal must let owners edit their own household + contacts + add new
// pets, instead of forcing staff to do it on their behalf. Every endpoint
// here:
//   - reads tenantId/householdId from the portal session (not the URL),
//   - uses a strict field allowlist (no internal_notes / no flags / no holds),
//   - writes back to the same v2 kv key shape the staff app uses, so the
//     staff Customer Detail view sees the change instantly.

// ----- Household ---------------------------------------------------------

// Address is stored as a single freeform string on the staff side (see
// customers_routes.tsx line 271 → `address: body.address`). We preserve
// that shape rather than introducing a structured-address subschema.
const householdPatchSchema = z.object({
  address: z.string().trim().max(500).nullable().optional(),
});

portal.get("/household", async (c) => {
  const auth = await readPortalUser(c);
  if ("error" in auth) return c.json({ error: auth.error }, auth.status as 401 | 403);
  const { tenantId, householdId } = auth;

  const household = (await kv.get(`customer:${tenantId}:household:${householdId}`)) as any;
  if (!household) return c.json({ error: "Household not found" }, 404);

  const contacts = ((await kv.getByPrefix(`customer:${tenantId}:contact:${householdId}:`)) as any[])
    .sort((a, b) => {
      // Primary first, then emergency, then alpha.
      if (a.is_primary && !b.is_primary) return -1;
      if (!a.is_primary && b.is_primary) return 1;
      if (a.is_emergency_contact && !b.is_emergency_contact) return -1;
      if (!a.is_emergency_contact && b.is_emergency_contact) return 1;
      return (a.first_name ?? "").localeCompare(b.first_name ?? "");
    });

  return c.json({
    household: {
      id: household.id,
      name: household.name ?? "",
      address: household.address ?? "",
      primary_contact_id: household.primary_contact_id ?? null,
    },
    contacts: contacts.map((co) => ({
      id: co.id,
      first_name: co.first_name ?? "",
      last_name: co.last_name ?? "",
      email: co.email ?? "",
      phone: co.phone ?? "",
      preferred_contact_method: co.preferred_contact_method ?? null,
      is_primary: !!co.is_primary,
      is_emergency_contact: !!co.is_emergency_contact,
      emergency_contact_relationship: co.emergency_contact_relationship ?? null,
      marketing_consent: !!co.marketing_consent,
      sms_consent: !!co.sms_consent,
      email_consent: !!co.email_consent,
    })),
  });
});

portal.patch("/household", async (c) => {
  const auth = await readPortalUser(c);
  if ("error" in auth) return c.json({ error: auth.error }, auth.status as 401 | 403);
  const { tenantId, householdId } = auth;

  const body = await c.req.json().catch(() => null);
  const parsed = householdPatchSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: parsed.error.format() }, 400);

  const household = (await kv.get(`customer:${tenantId}:household:${householdId}`)) as any;
  if (!household) return c.json({ error: "Household not found" }, 404);

  // Allowlist apply — never spread the owner's body onto the staff record.
  const updated = {
    ...household,
    ...(parsed.data.address !== undefined ? { address: parsed.data.address } : {}),
    updated_at: new Date().toISOString(),
  };
  await kv.set(`customer:${tenantId}:household:${householdId}`, updated);
  await dualWriteCustomers([dwSet(`customer:${tenantId}:household:${householdId}`, updated)]);
  return c.json({
    ok: true,
    household: { id: updated.id, name: updated.name ?? "", address: updated.address ?? "" },
  });
});

// ----- Contacts ----------------------------------------------------------

// Strict allowlist — the owner can only set fields they "own" semantically.
// They can't set `is_primary: true` while also setting someone else's primary;
// the server handles the primary-swap atomically below.
const contactBaseSchema = z.object({
  first_name: z.string().trim().min(1).max(80),
  last_name: z.string().trim().min(1).max(80),
  email: z.string().trim().email().max(254).optional().or(z.literal("")),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  preferred_contact_method: z.enum(["email", "phone", "sms"]).nullable().optional(),
  is_primary: z.boolean().optional(),
  is_emergency_contact: z.boolean().optional(),
  emergency_contact_relationship: z.string().trim().max(80).nullable().optional(),
  marketing_consent: z.boolean().optional(),
  sms_consent: z.boolean().optional(),
  email_consent: z.boolean().optional(),
});

const contactPatchSchema = contactBaseSchema.partial();

// Returns the Postgres mirror ops for the flip so the caller can batch them
// with its own contact write into ONE transaction (multi-key flow). Demotions
// come first in the returned array — the partial unique index
// contacts_one_primary_per_household_uq is evaluated per statement.
async function setPrimaryContact(
  tenantId: string,
  householdId: string,
  newPrimaryId: string,
): Promise<CustomerDualWriteOp[]> {
  const dw: CustomerDualWriteOp[] = [];
  // Demote all other primaries first (the staff app enforces a single primary).
  const all = (await kv.getByPrefix(`customer:${tenantId}:contact:${householdId}:`)) as any[];
  await Promise.all(
    all
      .filter((c) => c.id !== newPrimaryId && c.is_primary)
      .map((c) => {
        const demoted = {
          ...c,
          is_primary: false,
          updated_at: new Date().toISOString(),
        };
        dw.push(dwSet(`customer:${tenantId}:contact:${householdId}:${c.id}`, demoted));
        return kv.set(`customer:${tenantId}:contact:${householdId}:${c.id}`, demoted);
      }),
  );
  const household = (await kv.get(`customer:${tenantId}:household:${householdId}`)) as any;
  if (household) {
    const updatedHousehold = {
      ...household,
      primary_contact_id: newPrimaryId,
      updated_at: new Date().toISOString(),
    };
    await kv.set(`customer:${tenantId}:household:${householdId}`, updatedHousehold);
    dw.push(dwSet(`customer:${tenantId}:household:${householdId}`, updatedHousehold));
  }
  return dw;
}

portal.post("/contacts", async (c) => {
  const auth = await readPortalUser(c);
  if ("error" in auth) return c.json({ error: auth.error }, auth.status as 401 | 403);
  const { tenantId, householdId } = auth;

  const body = await c.req.json().catch(() => null);
  const parsed = contactBaseSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: parsed.error.format() }, 400);
  const d = parsed.data;

  const id = crypto.randomUUID();
  const contact = {
    id,
    tenant_id: tenantId,
    household_id: householdId,
    first_name: d.first_name,
    last_name: d.last_name,
    email: d.email || null,
    phone: d.phone || null,
    preferred_contact_method: d.preferred_contact_method ?? null,
    is_primary: !!d.is_primary,
    is_emergency_contact: !!d.is_emergency_contact,
    emergency_contact_relationship: d.emergency_contact_relationship ?? null,
    marketing_consent: !!d.marketing_consent,
    sms_consent: !!d.sms_consent,
    email_consent: !!d.email_consent,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  await kv.set(`customer:${tenantId}:contact:${householdId}:${id}`, contact);

  // Mirror as ONE transaction. When the new contact is primary, the flip's
  // demotions must precede its insert (partial unique index, per-statement).
  const dw: CustomerDualWriteOp[] = [];
  if (contact.is_primary) dw.push(...(await setPrimaryContact(tenantId, householdId, id)));
  dw.push(dwSet(`customer:${tenantId}:contact:${householdId}:${id}`, contact));
  await dualWriteCustomers(dw);

  return c.json({ ok: true, contact });
});

portal.patch("/contacts/:id", async (c) => {
  const auth = await readPortalUser(c);
  if ("error" in auth) return c.json({ error: auth.error }, auth.status as 401 | 403);
  const { tenantId, householdId } = auth;
  const id = c.req.param("id");

  const existing = (await kv.get(`customer:${tenantId}:contact:${householdId}:${id}`)) as any;
  if (!existing) return c.json({ error: "Not found" }, 404);

  const body = await c.req.json().catch(() => null);
  const parsed = contactPatchSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: parsed.error.format() }, 400);
  const d = parsed.data;

  // Empty string → null normalisation for email/phone (the staff app stores null for "unset").
  const updated = {
    ...existing,
    ...(d.first_name !== undefined ? { first_name: d.first_name } : {}),
    ...(d.last_name !== undefined ? { last_name: d.last_name } : {}),
    ...(d.email !== undefined ? { email: d.email || null } : {}),
    ...(d.phone !== undefined ? { phone: d.phone || null } : {}),
    ...(d.preferred_contact_method !== undefined ? { preferred_contact_method: d.preferred_contact_method } : {}),
    ...(d.is_emergency_contact !== undefined ? { is_emergency_contact: d.is_emergency_contact } : {}),
    ...(d.emergency_contact_relationship !== undefined
      ? { emergency_contact_relationship: d.emergency_contact_relationship }
      : {}),
    ...(d.marketing_consent !== undefined ? { marketing_consent: d.marketing_consent } : {}),
    ...(d.sms_consent !== undefined ? { sms_consent: d.sms_consent } : {}),
    ...(d.email_consent !== undefined ? { email_consent: d.email_consent } : {}),
    ...(d.is_primary !== undefined ? { is_primary: d.is_primary } : {}),
    updated_at: new Date().toISOString(),
  };
  await kv.set(`customer:${tenantId}:contact:${householdId}:${id}`, updated);

  // Mirror as ONE transaction; demotions precede the promotion (see above).
  const dw: CustomerDualWriteOp[] = [];
  if (d.is_primary === true) dw.push(...(await setPrimaryContact(tenantId, householdId, id)));
  dw.push(dwSet(`customer:${tenantId}:contact:${householdId}:${id}`, updated));
  await dualWriteCustomers(dw);

  return c.json({ ok: true, contact: updated });
});

portal.delete("/contacts/:id", async (c) => {
  const auth = await readPortalUser(c);
  if ("error" in auth) return c.json({ error: auth.error }, auth.status as 401 | 403);
  const { tenantId, householdId } = auth;
  const id = c.req.param("id");

  const existing = (await kv.get(`customer:${tenantId}:contact:${householdId}:${id}`)) as any;
  if (!existing) return c.json({ error: "Not found" }, 404);
  if (existing.is_primary) {
    return c.json(
      { error: "Cannot delete the primary contact. Make someone else primary first." },
      409,
    );
  }
  await kv.del(`customer:${tenantId}:contact:${householdId}:${id}`);
  await dualWriteCustomers([dwDel(`customer:${tenantId}:contact:${householdId}:${id}`)]);
  return c.json({ ok: true });
});

// ----- Owner-requested new pet ------------------------------------------

// Owner-added pets are written to the same kv key shape as staff-added pets
// (so the staff Customer Detail view shows them immediately) but flagged with
// `owner_added: true` + `verification_status: 'pending_staff_review'`.
//
// Booking selectors filter on `verification_status: 'verified'` so an
// unverified pet can't be used for bookings until staff confirms identity /
// microchip. A side record at `portal_pet_verification:{tenantId}:{id}` lands
// in the same review queue pattern as the vax uploads.
const petAddSchema = z.object({
  name: z.string().trim().min(1).max(60),
  // max(2048): same signed-URL headroom as petPatchSchema above.
  photo_url: z.string().trim().url().max(2048).nullable().optional().or(z.literal("")),
  breed: z.string().trim().max(80).optional().or(z.literal("")),
  sex: z.enum(["male", "female", "unknown"]).optional(),
  dob: z.string().trim().max(40).optional().or(z.literal("")),
  microchip: z.string().trim().max(40).optional().or(z.literal("")),
  weight_kg: z.number().nonnegative().max(200).nullable().optional(),
  neutered: z.boolean().optional(),
  colour: z.string().trim().max(60).optional().or(z.literal("")),
});

// =======================================================================
// PHASE C — Document vault
// =======================================================================
// Owners can: list household docs (theirs + staff's), upload new ones,
// download via signed URL, delete their own. Storage uses the existing
// vax-uploads bucket with a separate prefix so we don't need a second
// bucket + ACL config — both are tenant-isolated under the same path
// structure (`tenant/{tenantId}/...`).
//
// The staff customers_routes.tsx documents POST currently doesn't
// actually upload the file (TODO/placeholder paths). The portal endpoint
// here DOES — so owner-uploaded docs work end-to-end today; staff-side
// real upload is a follow-up they can fix later.

const DOCS_BUCKET = "vax-uploads"; // shared bucket; docs/ prefix segregates
const MAX_DOC_BYTES = 15 * 1024 * 1024; // 15MB — enough for most insurance certs
const ALLOWED_DOC_MIME = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/heic",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

const OWNER_DOC_TYPES = new Set(["insurance", "vet_records", "photo_id", "other"]);

async function ensureDocsBucket(admin: any) {
  try {
    const { data: buckets } = await admin.storage.listBuckets();
    if (buckets?.some((b: any) => b.name === DOCS_BUCKET)) return;
    await admin.storage.createBucket(DOCS_BUCKET, { public: false });
  } catch (e) {
    console.warn("ensureDocsBucket:", e);
  }
}

portal.get("/documents", async (c) => {
  const auth = await readPortalUser(c);
  if ("error" in auth) return c.json({ error: auth.error }, auth.status as 401 | 403);
  const { tenantId, householdId } = auth;

  const docs = (await kv.getByPrefix(`customer:${tenantId}:document:${householdId}:`)) as any[];

  // Sort: expiring/expired first (action needed), then by upload date desc.
  const now = Date.now();
  const expiringWeight = (d: any): number => {
    if (!d.expiry_date) return Number.MAX_SAFE_INTEGER; // no expiry → bottom
    const t = new Date(d.expiry_date).getTime();
    if (Number.isNaN(t)) return Number.MAX_SAFE_INTEGER;
    return t - now; // most overdue first
  };

  const sorted = [...docs].sort((a, b) => {
    const w = expiringWeight(a) - expiringWeight(b);
    if (w !== 0) return w;
    return new Date(b.uploaded_at ?? 0).getTime() - new Date(a.uploaded_at ?? 0).getTime();
  });

  return c.json({
    documents: sorted.map((d) => ({
      id: d.id,
      name: d.name ?? d.file_name ?? "Untitled",
      documentType: d.document_type ?? "other",
      fileName: d.file_name ?? null,
      fileSize: d.file_size ?? 0,
      mimeType: d.mime_type ?? null,
      expiresAt: d.expiry_date ?? null,
      uploadedAt: d.uploaded_at ?? d.created_at ?? null,
      uploadedByOwner: !!d.owner_uploaded,
      petId: d.pet_id ?? null,
      notes: d.notes ?? null,
    })),
  });
});

portal.get("/documents/:id/download", async (c) => {
  const auth = await readPortalUser(c);
  if ("error" in auth) return c.json({ error: auth.error }, auth.status as 401 | 403);
  const { tenantId, householdId } = auth;
  const id = c.req.param("id");

  const doc = (await kv.get(`customer:${tenantId}:document:${householdId}:${id}`)) as any;
  if (!doc) return c.json({ error: "Not found" }, 404);
  // Placeholder paths from the (broken) staff-side POST aren't downloadable;
  // surface a clear error rather than a 500 from storage.
  if (!doc.storage_path || doc.storage_path.startsWith("#placeholder")) {
    return c.json({ error: "Document hasn't been uploaded to storage yet — contact your daycare" }, 410);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(supabaseUrl, serviceKey);
  const { data: signed, error } = await admin.storage
    .from(DOCS_BUCKET)
    .createSignedUrl(doc.storage_path, 60 * 30); // 30 min — long enough to view, short enough to expire
  if (error || !signed?.signedUrl) return internalError(c, 'portal.documentSignUrl', error ?? new Error('missing signed URL'));
  return c.json({ url: signed.signedUrl, expiresIn: 60 * 30 });
});

portal.post("/documents", async (c) => {
  const auth = await readPortalUser(c);
  if ("error" in auth) return c.json({ error: auth.error }, auth.status as 401 | 403);
  const { tenantId, householdId, user } = auth;

  const form = await c.req.formData();
  const file = form.get("file");
  const metaRaw = form.get("meta");
  if (!(file instanceof File)) return c.json({ error: "file required" }, 400);
  if (file.size > MAX_DOC_BYTES) return c.json({ error: "file too large (max 15MB)" }, 413);
  if (!ALLOWED_DOC_MIME.has(file.type)) {
    return c.json({ error: "PDF, JPG, PNG, HEIC, or DOC/DOCX only" }, 415);
  }
  if (typeof metaRaw !== "string") return c.json({ error: "meta required" }, 400);

  let meta: any;
  try { meta = JSON.parse(metaRaw); } catch { return c.json({ error: "meta must be JSON" }, 400); }

  const documentType = typeof meta.documentType === "string" && OWNER_DOC_TYPES.has(meta.documentType)
    ? meta.documentType
    : "other";
  const name = typeof meta.name === "string" && meta.name.trim()
    ? meta.name.trim().slice(0, 120)
    : file.name;
  const expiresAt = typeof meta.expiresAt === "string" && meta.expiresAt
    ? meta.expiresAt
    : null;
  const petId = typeof meta.petId === "string" && meta.petId ? meta.petId : null;
  const notes = typeof meta.notes === "string" ? meta.notes.slice(0, 500) : null;

  // If pet attribution given, verify the pet belongs to this household.
  if (petId) {
    const pet = await kv.get(`customer:${tenantId}:pet:${householdId}:${petId}`);
    if (!pet) return c.json({ error: "Pet not on this household" }, 403);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(supabaseUrl, serviceKey);
  await ensureDocsBucket(admin);

  const id = crypto.randomUUID();
  const ext = (file.name.split(".").pop() ?? "bin").toLowerCase().replace(/[^a-z0-9]/g, "");
  const storagePath = `tenant/${tenantId}/household/${householdId}/docs/${id}.${ext}`;

  const { error: upErr } = await admin.storage.from(DOCS_BUCKET).upload(storagePath, file, {
    contentType: file.type,
    upsert: false,
  });
  if (upErr) return internalError(c, 'portal.documentUpload', upErr);

  const now = new Date().toISOString();
  const doc = {
    id,
    tenant_id: tenantId,
    household_id: householdId,
    pet_id: petId,
    document_type: documentType,
    name,
    file_name: file.name,
    storage_path: storagePath,
    file_size: file.size,
    mime_type: file.type,
    expiry_date: expiresAt,
    notes,
    uploaded_by: user.id,
    uploaded_at: now,
    owner_uploaded: true,
  };
  await kv.set(`customer:${tenantId}:document:${householdId}:${id}`, doc);
  await dualWriteCustomers([dwSet(`customer:${tenantId}:document:${householdId}:${id}`, doc)]);

  return c.json({ ok: true, document: doc });
});

portal.delete("/documents/:id", async (c) => {
  const auth = await readPortalUser(c);
  if ("error" in auth) return c.json({ error: auth.error }, auth.status as 401 | 403);
  const { tenantId, householdId } = auth;
  const id = c.req.param("id");

  const doc = (await kv.get(`customer:${tenantId}:document:${householdId}:${id}`)) as any;
  if (!doc) return c.json({ error: "Not found" }, 404);
  if (!doc.owner_uploaded) {
    return c.json(
      { error: "Only documents you uploaded yourself can be deleted from here. Ask the team to remove staff documents." },
      403,
    );
  }

  // Best-effort storage delete — if it's a real path, clean it up.
  if (doc.storage_path && !doc.storage_path.startsWith("#placeholder")) {
    try {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const admin = createClient(supabaseUrl, serviceKey);
      await admin.storage.from(DOCS_BUCKET).remove([doc.storage_path]);
    } catch (e) {
      console.warn("doc delete: storage cleanup failed:", e);
    }
  }
  await kv.del(`customer:${tenantId}:document:${householdId}:${id}`);
  await dualWriteCustomers([dwDel(`customer:${tenantId}:document:${householdId}:${id}`)]);
  return c.json({ ok: true });
});

portal.post("/pets", async (c) => {
  const auth = await readPortalUser(c);
  if ("error" in auth) return c.json({ error: auth.error }, auth.status as 401 | 403);
  const { tenantId, householdId } = auth;

  const body = await c.req.json().catch(() => null);
  const parsed = petAddSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: parsed.error.format() }, 400);
  const d = parsed.data;

  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  // applyPetPhotoWrite: bucket references persist as photo_path, never a URL.
  const pet = applyPetPhotoWrite({
    id,
    tenant_id: tenantId,
    household_id: householdId,
    name: d.name,
    breed: d.breed || null,
    sex: d.sex ?? "unknown",
    date_of_birth: d.dob || null,
    microchip: d.microchip || null,
    weight_kg: d.weight_kg ?? null,
    neutered_status: d.neutered === true ? "neutered" : d.neutered === false ? "intact" : "unknown",
    colour: d.colour || null,
    owner_added: true,
    verification_status: "pending_staff_review",
    created_at: now,
    updated_at: now,
  }, d.photo_url || null);
  await kv.set(`customer:${tenantId}:pet:${householdId}:${id}`, pet);
  await dualWriteCustomers([
    dwSet(`customer:${tenantId}:pet:${householdId}:${id}`, pet as Record<string, unknown>),
  ]);
  await kv.set(`portal_pet_verification:${tenantId}:${id}`, {
    id,
    tenantId,
    householdId,
    petId: id,
    petName: d.name,
    submittedAt: now,
    status: "pending",
  });

  return c.json({ ok: true, pet });
});

/* --------------------------------------------------------------------- */
/* LOCATIONS — what daycare branches can owners book at?                  */
/* --------------------------------------------------------------------- */
/**
 * GET /portal/locations
 *
 * Returns the list of bookable locations for the authenticated owner's
 * tenant.  Locations are stored under `location:{id}` in the KV table
 * (staff-side schema, see app_routes.tsx).  We surface only what the
 * portal actually needs to render — id, name, address, dog rules (so
 * owners know which one fits their pet), capacity, and whether the
 * location is active.  Staff owns the source of truth; we just project
 * it.
 *
 * Filters out any `is_active === false` location so retired branches
 * don't show up in the wizard.
 */
portal.get("/locations", async (c) => {
  const auth = await readPortalUser(c);
  if ("error" in auth) return c.json({ error: auth.error }, auth.status as 401 | 403);
  const { tenantId } = auth;

  const all = (await kv.getByPrefix("location:")) as any[];
  const locations = all
    .filter((loc) => loc && typeof loc === "object")
    // location: prefix is shared across tenants today (MDC is the only paying
    // tenant), but defensively scope to this tenant so a future co-tenant
    // doesn't leak their branch list.
    .filter((loc) => !loc.tenantId || loc.tenantId === tenantId)
    .filter((loc) => loc.is_active !== false)
    .map((loc) => ({
      id: String(loc.id),
      name: loc.name ?? "Unnamed location",
      address: loc.address ?? null,
      // Dog rules — these may be encoded in different ways on the staff
      // side; surface whichever shape is present so owners see something
      // useful even if the field name changes.  rulesCopy is the
      // owner-facing one-liner; sizeRule + breedRule are structured
      // fallbacks.
      rulesCopy:
        loc.portal_rules_copy ??
        loc.rules_copy ??
        loc.dog_rules ??
        loc.notes ??
        null,
      sizeRule: loc.dog_size_rule ?? loc.size_rule ?? null,
      breedRule: loc.allowed_breeds ?? loc.breed_rule ?? null,
      capacity: typeof loc?.capacity?.maxDogs === "number" ? loc.capacity.maxDogs : null,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return c.json({ locations });
});

/* --------------------------------------------------------------------- */
/* INTERNAL — tracker event ingestion                                     */
/* --------------------------------------------------------------------- */
/**
 * POST /portal/internal/tracker-event
 *
 * Server-to-server only.  Authenticates by comparing the bearer token
 * to SUPABASE_SERVICE_ROLE_KEY — same key the detector edge function uses
 * to read the invoxia.* schema, so no extra credential needs distributing.
 *
 * Used by:
 *   - invoxia-event-detector  (cron-driven detector function — battery,
 *     online/offline, geofence as it lands)
 *   - ops + manual seeding via curl while the motion classifier is in
 *     flight ("paste these to see what zoomies looks like")
 *
 * Body shape (validated by trackerEventSchema):
 *   {
 *     "tenantId":    "...",
 *     "householdId": "...",
 *     "petId":       "...",
 *     "petName":     "Meg",
 *     "type":        "tracker.walk_started",
 *     "payload":     { "zoneName": "Home", "batteryPct": 12, ... }
 *   }
 *
 * The handler picks a sensible link target per event type so tapping the
 * notification jumps the owner straight to the relevant pet sub-screen
 * (whereabouts for geofence, pulse for activity, tracker for battery).
 */
const trackerEventTypeSchema = z.enum([
  "tracker.zone_left",
  "tracker.zone_entered",
  "tracker.walk_started",
  "tracker.walk_ended",
  "tracker.transport_started",
  "tracker.transport_ended",
  "tracker.zoomies",
  "tracker.battery_low",
  "tracker.battery_charged",
  "tracker.offline",
  "tracker.online",
]);

const trackerEventSchema = z.object({
  tenantId:    z.string().min(1),
  householdId: z.string().min(1),
  petId:       z.string().min(1).optional(),
  petName:     z.string().min(1).optional(),
  type:        trackerEventTypeSchema,
  payload:     z.record(z.string(), z.unknown()).optional(),
});

/** Choose where tapping this event in the drawer should send the owner. */
function linkForTrackerEvent(type: string, petId: string | undefined): string | null {
  if (!petId) return null;
  if (type.startsWith("tracker.zone_") || type === "tracker.walk_started" || type === "tracker.walk_ended") {
    return `/pets/${petId}/whereabouts`;
  }
  if (type === "tracker.zoomies" || type.startsWith("tracker.transport_")) {
    return `/pets/${petId}/pulse`;
  }
  // battery + offline/online live on the tracker status screen
  return `/pets/${petId}/tracker`;
}

portal.post("/internal/tracker-event", async (c) => {
  const auth = c.req.header("Authorization") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  // Constant-time-ish compare — the keys are long random tokens so a
  // straight string compare is fine; this is server-to-server traffic only.
  if (!serviceKey || auth !== `Bearer ${serviceKey}`) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const body = await c.req.json().catch(() => null);
  const parsed = trackerEventSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: parsed.error.format() }, 400);
  const { tenantId, householdId, petId, petName, type, payload } = parsed.data;

  await notify({
    tenantId,
    householdId,
    type: type as PortalNotificationType,
    payload: {
      petId: petId ?? null,
      petName: petName ?? null,
      ...(payload ?? {}),
    },
    link: linkForTrackerEvent(type, petId),
    // Email intentionally skipped — tracker events are too high-volume
    // for transactional email out of the gate.  Owners get the in-app
    // bell + (later, in Phase 2) native push.
  });

  return c.json({ ok: true });
});

export default portal;
