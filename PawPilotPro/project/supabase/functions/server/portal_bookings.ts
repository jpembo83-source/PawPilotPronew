// Portal booking requests — owner submits, staff approves/declines.
// Uses portal_booking:{tenantId}:{id} namespace (independent of v2's per-service booking
// schemas) so the owner self-service flow doesn't collide with existing daycare/overnight/
// grooming/transport modules. Staff approval can later promote an entry into a real
// service-specific booking record.

import { Hono } from "npm:hono";
import { z } from "npm:zod";
import { createClient } from "npm:@supabase/supabase-js";
import * as kv from "./kv_store.tsx";
import { isLinkedPortalUser } from "./lib/portal_link.ts";
import { notify, getOwnerEmail, getOwnerName } from "./lib/notify.ts";
import { bookingReceivedEmail } from "./lib/email_templates/booking_received.ts";
import { bookingConfirmedEmail } from "./lib/email_templates/booking_confirmed.ts";
import { bookingDeclinedEmail } from "./lib/email_templates/booking_declined.ts";
import { storedPetPhoto } from "./lib/pet_photos.ts";
import { nightlyRateFor, recordOvernightEvent } from "./lib/overnights_shared.ts";

const PORTAL_BASE_URL = Deno.env.get("PORTAL_BASE_URL") ?? "http://localhost:5175";

const bookings = new Hono();

// ----- auth helpers (same pattern as portal_invites / portal_routes) -----

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

async function readStaff(c: any) {
  const token = c.req.header("X-User-Token")?.replace("Bearer ", "");
  if (!token) return null;
  try {
    const user = await getUserFromToken(token);
    // Staff-side endpoints: require a server-set staff role (app_metadata).
    // A portal customer's valid token must not reach approve/decline/capacity.
    if (!STAFF_ROLES.has(user.app_metadata?.role)) return null;
    return { user, tenantId: getTenantId(user) };
  } catch { return null; }
}

interface PortalCtx { user: any; tenantId: string; householdId: string }

async function readPortalUser(c: any): Promise<PortalCtx | { error: string; status: number }> {
  const token = c.req.header("X-User-Token")?.replace("Bearer ", "");
  if (!token) return { error: "Missing user token", status: 401 };
  let user: any;
  try { user = await getUserFromToken(token); }
  catch { return { error: "Invalid session", status: 401 }; }
  // Authorization fields read app_metadata only (server-set, untamperable).
  const portalUser = user.app_metadata?.portal_user;
  if (portalUser !== true) return { error: "Not a portal account", status: 403 };
  // Phase E: staff-controlled pause. Same guard as portal_routes.tsx.
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

// ----- schemas ----------------------------------------------------------

const serviceEnum = z.enum(["daycare", "grooming", "overnights", "transport"]);

const serviceRequestSchema = z
  .object({
    service: serviceEnum,
    petIds: z.array(z.string()).min(1).max(10),
    startAt: z.string().datetime(),
    endAt: z.string().datetime(),
  })
  .refine((d) => new Date(d.endAt).getTime() > new Date(d.startAt).getTime(), {
    message: "endAt must be after startAt",
    path: ["endAt"],
  });

// Discriminated body — single OR bundle (see shared/schemas/booking.ts for
// the canonical definition; this is the runtime-side mirror).
const newBookingSchema = z.union([
  z
    .object({
      service: serviceEnum,
      petIds: z.array(z.string()).min(1).max(10),
      startAt: z.string().datetime(),
      endAt: z.string().datetime(),
      notes: z.string().max(500).nullable().optional(),
      requestId: z.string().uuid(),
      // Optional for back-compat — older clients (pre-StepLocation) won't send
      // this and the staff queue can still assign a location at confirmation.
      locationId: z.string().nullable().optional(),
    })
    .refine((d) => new Date(d.endAt).getTime() > new Date(d.startAt).getTime(), {
      message: "endAt must be after startAt",
      path: ["endAt"],
    }),
  z.object({
    bundle: z.array(serviceRequestSchema).min(2).max(4),
    notes: z.string().max(500).nullable().optional(),
    requestId: z.string().uuid(),
    locationId: z.string().nullable().optional(),
  }),
]);

/**
 * Day-key for the (pet, service, date) dedupe lookup.  We bucket by the
 * START DATE in the local-ish UTC sense — owners booking 09:00-17:00 and
 * 14:00-18:00 on the same day are still "the same day" and must be
 * collapsed into one request.  Using UTC midnight is fine for MDC since
 * Zürich is UTC+1/+2 and a request crossing midnight UTC for them would
 * already be the next day they're actually booking for.
 */
export function dayKeyOf(iso: string): string {
  return iso.slice(0, 10); // YYYY-MM-DD
}

/**
 * Returns the first PENDING-or-CONFIRMED existing booking that conflicts
 * with `incoming` (same pet, same service, same date).  Cancelled and
 * declined bookings don't conflict — owners can re-request after a decline.
 *
 * Excludes any booking whose id appears in `excludeIds` so dedupe within
 * a single bundle submission (the parent and its children share dates
 * with each other) doesn't false-positive against itself.
 */
export function findSameDayConflict(
  existing: any[],
  incoming: { service: string; petIds: string[]; startAt: string },
  excludeIds: Set<string> = new Set(),
): any | null {
  const incomingDay = dayKeyOf(incoming.startAt);
  for (const b of existing) {
    if (excludeIds.has(b.id)) continue;
    if (!b.status || b.status === "cancelled" || b.status === "declined") continue;
    if (b.service !== incoming.service) continue;
    if (!b.startAt) continue;
    if (dayKeyOf(b.startAt) !== incomingDay) continue;
    const overlap = (b.petIds ?? []).some((pid: string) => incoming.petIds.includes(pid));
    if (overlap) return b;
  }
  return null;
}

// ----- OWNER endpoints (mounted under /make-server-fc003b23/portal) -----

bookings.get("/portal/bookings", async (c) => {
  const auth = await readPortalUser(c);
  if ("error" in auth) return c.json({ error: auth.error }, auth.status as 401 | 403);
  const { tenantId, householdId } = auth;
  const scope = c.req.query("scope") ?? "upcoming";

  // Owner list view: hide bundle children. The parent represents the bundle —
  // tapping into it shows all children. This keeps the upcoming list calm
  // (one card per booking-or-bundle) instead of showing the same bundle as
  // three rows (daycare + transport + grooming).
  const all = ((await kv.getByPrefix(`portal_booking:${tenantId}:`)) as any[])
    .filter((b) => b.householdId === householdId)
    .filter((b) => b.kind !== "bundle_child");
  const now = Date.now();
  const filtered = scope === "past"
    ? all.filter((b) => new Date(b.endAt).getTime() < now || b.status === "cancelled" || b.status === "declined")
        .sort((a, b) => new Date(b.startAt).getTime() - new Date(a.startAt).getTime())
    : all.filter((b) => new Date(b.endAt).getTime() >= now && b.status !== "cancelled" && b.status !== "declined")
        .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());
  return c.json({ bookings: filtered });
});

bookings.get("/portal/bookings/:id", async (c) => {
  const auth = await readPortalUser(c);
  if ("error" in auth) return c.json({ error: auth.error }, auth.status as 401 | 403);
  const { tenantId, householdId } = auth;
  const id = c.req.param("id");
  const b = (await kv.get(`portal_booking:${tenantId}:${id}`)) as any;
  if (!b || b.householdId !== householdId) return c.json({ error: "Not found" }, 404);
  // If this is a bundle parent, hydrate children so the detail screen can
  // render line items (Daycare 9-5, Transport 9am pickup, Grooming 11am).
  let children: any[] | undefined;
  if (b.kind === "bundle_parent" && Array.isArray(b.childIds)) {
    const childRecords = await Promise.all(
      b.childIds.map((cid: string) => kv.get(`portal_booking:${tenantId}:${cid}`)),
    );
    children = childRecords.filter(Boolean) as any[];
  }
  return c.json({ booking: b, children });
});

bookings.post("/portal/bookings", async (c) => {
  const auth = await readPortalUser(c);
  if ("error" in auth) return c.json({ error: auth.error }, auth.status as 401 | 403);
  const { tenantId, householdId, user } = auth;

  const body = await c.req.json().catch(() => null);
  const parsed = newBookingSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: parsed.error.format() }, 400);
  const data = parsed.data as any;

  // Idempotency works on both single + bundle: same requestId → return what's
  // already there.
  const allRecords = (await kv.getByPrefix(`portal_booking:${tenantId}:`)) as any[];
  const existing = allRecords.find((b) => b.requestId === data.requestId);
  if (existing) return c.json({ booking: existing, deduped: true });

  const now = new Date().toISOString();
  const tenant = (await kv.get(`customer:${tenantId}:household:${householdId}`)) as any;
  const email = await getOwnerEmail(tenantId, householdId);
  const ownerName = await getOwnerName(tenantId, householdId);

  // -------------------------------------------------------------------
  // BUNDLE path — write parent + N children, fire one "received" notify
  // -------------------------------------------------------------------
  if (Array.isArray(data.bundle)) {
    // Collect all unique petIds across children for verification + name lookup.
    const allPetIds = Array.from(new Set(data.bundle.flatMap((b: any) => b.petIds)));
    const petRecords = await Promise.all(
      allPetIds.map((pid) => kv.get(`customer:${tenantId}:pet:${householdId}:${pid}`)),
    );
    if (petRecords.some((p) => !p)) return c.json({ error: "Invalid pet selection" }, 403);
    // Owner-added pets sit in 'pending_staff_review' until staff confirms
    // identity. They cannot be booked. The portal UI filters them out in
    // StepPets, but a request bypassing that UI (curl, replay) would slip
    // through. Reject here so the staff queue never sees a booking that
    // references a not-yet-verified pet.
    const unverified = petRecords.find(
      (p: any) => p && p.verification_status && p.verification_status !== "verified",
    );
    if (unverified) {
      return c.json(
        { error: `${(unverified as any).name ?? "That pet"} is awaiting team verification — bookings open after that.` },
        409,
      );
    }
    const petNameById: Record<string, string> = {};
    petRecords.forEach((p: any) => { if (p) petNameById[p.id] = p.name; });

    // Sanity: each child's window must be in the future (mirrors the single check).
    for (const line of data.bundle) {
      if (new Date(line.startAt).getTime() < Date.now()) {
        return c.json({ error: "Every bundle line's startAt must be in the future" }, 400);
      }
    }

    // Same-day conflict check across the bundle. A bundle whose lines all
    // sit on the same day is fine — the bundle IS the request. But if one
    // of the bundle lines collides with a SEPARATE existing booking for
    // the same pet+service+date, the owner is double-booking and we
    // reject.  excludeIds intentionally empty: bundle children don't exist
    // in `allRecords` yet at this point.
    for (const line of data.bundle) {
      const dup = findSameDayConflict(allRecords, {
        service: line.service,
        petIds: line.petIds,
        startAt: line.startAt,
      });
      if (dup) {
        const petName = petNameById[line.petIds[0]] ?? "That pet";
        return c.json(
          {
            error: `${petName} already has a ${line.service} request for ${dayKeyOf(line.startAt)} (#${(dup.id as string).slice(0, 8)}). Cancel that one first or pick another day.`,
            conflictingBookingId: dup.id,
          },
          409,
        );
      }
    }

    const parentId = crypto.randomUUID();
    const childIds: string[] = [];
    const services: string[] = [];

    for (const line of data.bundle) {
      const childId = crypto.randomUUID();
      childIds.push(childId);
      services.push(line.service);
      const child = {
        id: childId,
        tenantId,
        householdId,
        kind: "bundle_child" as const,
        parentBookingId: parentId,
        service: line.service,
        petIds: line.petIds,
        petNames: line.petIds.map((id: string) => petNameById[id]).filter(Boolean),
        startAt: line.startAt,
        endAt: line.endAt,
        locationId: data.locationId ?? null,
        status: "pending" as const,
        notes: data.notes ?? null,
        ownerSubmitted: true,
        requestId: data.requestId, // shared — staff can correlate
        submittedBy: user.id,
        createdAt: now,
        updatedAt: now,
      };
      await kv.set(`portal_booking:${tenantId}:${childId}`, child);
    }

    // Parent represents the bundle as a single thing to the owner + staff.
    // startAt/endAt span the whole bundle so list-sort + upcoming filter work
    // without any special-casing.
    const bundleStart = data.bundle
      .map((l: any) => new Date(l.startAt).getTime())
      .reduce((a: number, b: number) => Math.min(a, b));
    const bundleEnd = data.bundle
      .map((l: any) => new Date(l.endAt).getTime())
      .reduce((a: number, b: number) => Math.max(a, b));

    const parent = {
      id: parentId,
      tenantId,
      householdId,
      kind: "bundle_parent" as const,
      childIds,
      services, // ["daycare","transport"], in input order
      service: services[0], // primary — for back-compat with code that reads .service
      petIds: allPetIds,
      petNames: allPetIds.map((id) => petNameById[id]).filter(Boolean),
      startAt: new Date(bundleStart).toISOString(),
      endAt: new Date(bundleEnd).toISOString(),
      locationId: data.locationId ?? null,
      status: "pending" as const,
      notes: data.notes ?? null,
      ownerSubmitted: true,
      requestId: data.requestId,
      submittedBy: user.id,
      createdAt: now,
      updatedAt: now,
    };
    await kv.set(`portal_booking:${tenantId}:${parentId}`, parent);

    await notify({
      tenantId,
      householdId,
      type: "booking.received",
      payload: { bookingId: parentId, service: services[0], startAt: parent.startAt, services },
      link: `/bookings/${parentId}`,
      email: email ? {
        to: email,
        ...bookingReceivedEmail({
          ownerName,
          tenantName: tenant?.name ?? "PawPilotPro",
          service: services[0],
          startAt: parent.startAt,
          bookingUrl: `${PORTAL_BASE_URL}/bookings/${parentId}`,
        }),
      } : undefined,
    });

    return c.json({ booking: parent });
  }

  // -------------------------------------------------------------------
  // SINGLE path — unchanged behaviour, written without a kind field so
  // older list queries / staff tools that pre-date Phase D keep working.
  // -------------------------------------------------------------------
  const pets = await Promise.all(
    data.petIds.map((pid: string) => kv.get(`customer:${tenantId}:pet:${householdId}:${pid}`)),
  );
  if (pets.some((p) => !p)) return c.json({ error: "Invalid pet selection" }, 403);
  // Same verification gate as the bundle path — reject bookings for pets
  // that are still pending_staff_review even if the client bypassed StepPets.
  const unverifiedSingle = pets.find(
    (p: any) => p && p.verification_status && p.verification_status !== "verified",
  );
  if (unverifiedSingle) {
    return c.json(
      { error: `${(unverifiedSingle as any).name ?? "That pet"} is awaiting team verification — bookings open after that.` },
      409,
    );
  }
  if (new Date(data.startAt).getTime() < Date.now()) {
    return c.json({ error: "startAt must be in the future" }, 400);
  }

  // Same-day conflict check — see findSameDayConflict above.
  const conflict = findSameDayConflict(allRecords, {
    service: data.service,
    petIds: data.petIds,
    startAt: data.startAt,
  });
  if (conflict) {
    const conflictPet =
      pets.find((p: any) => (conflict.petIds ?? []).includes(p?.id))?.name ?? "That pet";
    return c.json(
      {
        error: `${conflictPet} already has a ${data.service} request for ${dayKeyOf(data.startAt)} (#${(conflict.id as string).slice(0, 8)}). Cancel that one first or pick another day.`,
        conflictingBookingId: conflict.id,
      },
      409,
    );
  }

  const id = crypto.randomUUID();
  const booking = {
    id,
    tenantId,
    householdId,
    service: data.service,
    petIds: data.petIds,
    petNames: pets.map((p: any) => p.name).filter(Boolean),
    startAt: data.startAt,
    endAt: data.endAt,
    locationId: data.locationId ?? null,
    status: "pending" as const,
    notes: data.notes ?? null,
    ownerSubmitted: true,
    requestId: data.requestId,
    submittedBy: user.id,
    createdAt: now,
    updatedAt: now,
  };
  await kv.set(`portal_booking:${tenantId}:${id}`, booking);

  await notify({
    tenantId,
    householdId,
    type: "booking.received",
    payload: { bookingId: id, service: data.service, startAt: data.startAt },
    link: `/bookings/${id}`,
    email: email ? {
      to: email,
      ...bookingReceivedEmail({
        ownerName,
        tenantName: tenant?.name ?? "PawPilotPro",
        service: data.service,
        startAt: data.startAt,
        bookingUrl: `${PORTAL_BASE_URL}/bookings/${id}`,
      }),
    } : undefined,
  });

  return c.json({ booking });
});

// -----------------------------------------------------------------------
// POST /portal/quote — Estimate-mode pricing for the booking review screen
// -----------------------------------------------------------------------
// v1 is intentionally NOT a binding price. The staff side already has the
// real pricing engine at pricing_routes.tsx /pricing/resolve (lines 365-477):
// that endpoint pulls in price books, location overrides, membership credits,
// and per-entry tax. The owner-facing portal can't replicate the full
// machinery yet — no membership ledger, no multi-dog discount plumbing, no
// VIP household flag, no late-pickup fees, no per-tenant currency. So this
// handler returns a snapshot keyed off the bare service KV record and
// surfaces every uncertainty as a plain-English caveat. The portal review
// screen renders that estimate + caveats verbatim, and staff still reconcile
// the final number when they approve the request.
//
// Staff-side source of truth for "real" pricing: pricing_routes.tsx /resolve.
// If/when the owner needs binding totals, the right move is to extract a
// helper from that handler and call it here rather than fork the logic.
// -----------------------------------------------------------------------

const quoteRequestSchema = z.object({
  items: z
    .array(
      z
        .object({
          service: serviceEnum,
          petIds: z.array(z.string()).min(1).max(10),
          startAt: z.string().datetime(),
          endAt: z.string().datetime(),
        })
        .refine((d) => new Date(d.endAt).getTime() > new Date(d.startAt).getTime(), {
          message: "endAt must be after startAt",
          path: ["endAt"],
        }),
    )
    .min(1)
    .max(4),
  locationId: z.string().nullable().optional(),
});

type QuoteService = "daycare" | "grooming" | "overnights" | "transport";

// Resolve a service KV record for an owner-facing module name. The staff
// side stores services under two slightly different shapes:
//   - service:{id}            (pricing_routes.tsx, has .basePrice + .taxRate)
//   - pricing:service:{id}    (daycare_routes.tsx line 716, has .base_price + .tax_rate)
// Owner requests come in keyed by module ("daycare"), not by service id, so
// we scan both prefixes and pick the first record whose .module or .type
// matches the requested module name. Returns null when nothing usable is
// found — the caller emits a "price not set" caveat for that line.
async function findServiceForModule(
  module: QuoteService,
): Promise<{ basePrice: number | null; taxRate: number | null; name: string | null } | null> {
  // Owner module "overnights" maps to staff service type prefix "daycare_overnight"
  // (see project/src/app/modules/services-pricing/types.ts). Treat as a fallback.
  const moduleAliases: Record<QuoteService, string[]> = {
    daycare: ["daycare"],
    grooming: ["grooming"],
    overnights: ["overnights", "overnight", "daycare_overnight"],
    transport: ["transport"],
  };
  const aliases = moduleAliases[module];

  const matchesModule = (svc: any): boolean => {
    if (!svc || typeof svc !== "object") return false;
    if (svc.isActive === false) return false; // skip retired services
    const mod = String(svc.module ?? "").toLowerCase();
    const typ = String(svc.type ?? "").toLowerCase();
    return aliases.some((a) => mod === a || typ === a || typ.startsWith(a + "_"));
  };

  const extract = (svc: any) => {
    const basePrice =
      typeof svc.basePrice === "number"
        ? svc.basePrice
        : typeof svc.base_price === "number"
        ? svc.base_price
        : null;
    const taxRate =
      typeof svc.taxRate === "number"
        ? svc.taxRate
        : typeof svc.tax_rate === "number"
        ? svc.tax_rate
        : null;
    return { basePrice, taxRate, name: svc.name ?? null };
  };

  // Look at the canonical prefix first (matches pricing_routes /resolve).
  const primary = ((await kv.getByPrefix("service:")) as any[]).filter(matchesModule);
  if (primary.length > 0) return extract(primary[0]);

  // Then the legacy daycare prefix.
  const legacy = ((await kv.getByPrefix("pricing:service:")) as any[]).filter(matchesModule);
  if (legacy.length > 0) return extract(legacy[0]);

  return null;
}

function daysSpanned(startAt: string, endAt: string): number {
  const start = new Date(startAt);
  const end = new Date(endAt);
  // Count distinct calendar days the window touches: a 9am-5pm same-day
  // booking is 1 day, a Friday→Monday overnight is 4 days. Math.max(1, …)
  // guards against same-instant requests slipping through.
  const startDay = Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate());
  const endDay = Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate());
  const diffDays = Math.floor((endDay - startDay) / (1000 * 60 * 60 * 24)) + 1;
  return Math.max(1, diffDays);
}

function serviceDisplayName(service: QuoteService, fallback?: string | null): string {
  if (fallback && typeof fallback === "string" && fallback.trim().length > 0) return fallback;
  const map: Record<QuoteService, string> = {
    daycare: "Daycare",
    grooming: "Grooming",
    overnights: "Overnight",
    transport: "Transport",
  };
  return map[service];
}

bookings.post("/portal/quote", async (c) => {
  const auth = await readPortalUser(c);
  if ("error" in auth) return c.json({ error: auth.error }, auth.status as 401 | 403);

  const body = await c.req.json().catch(() => null);
  const parsed = quoteRequestSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: parsed.error.format() }, 400);
  const { items, locationId } = parsed.data;

  // Round currency to 2 decimals. Backend authority on rounding so the
  // portal review screen and the staff-side reconciliation agree pixel-wise.
  const round2 = (n: number) => Math.round(n * 100) / 100;

  const FALLBACK_TAX_RATE = 0.081; // Swiss VAT 2024+: 8.1% (was 7.7% pre-2024).
  const TAX_FALLBACK_CAVEAT =
    "Tax shown at the standard 8.1% rate — staff will apply the exact rate for your services.";
  // MDC daycare pricing — half-day vs full-day. Until the staff Service
  // catalogue learns to model half/full separately, we hardcode here so the
  // owner sees the real number rather than the 0.00 that a missing KV price
  // produces.  When the catalogue grows variant pricing, drop these and
  // resolve via findServiceForModule().
  const MDC_DAYCARE_HALF_DAY_CHF = 69;
  const MDC_DAYCARE_FULL_DAY_CHF = 99;
  const HALF_DAY_MAX_HOURS = 5;
  const MEMBERSHIP_CAVEAT =
    "If you have a membership or eligible discount, credits may cover part of this.";
  const STAFF_CONFIRMS_CAVEAT = "Estimate · staff confirms the final price.";
  const CURRENCY_CAVEAT = "Currency may vary by location.";

  let usedTaxFallback = false;
  const lineItems: Array<{
    service: QuoteService;
    label: string;
    basePrice: number;
    quantity: number;
    subtotal: number;
    taxRate: number;
    taxAmount: number;
    total: number;
    priceSource: "service-kv" | "default" | "unknown";
    caveats: string[];
  }> = [];

  for (const item of items) {
    const lineCaveats: string[] = [];
    const svcRecord = await findServiceForModule(item.service as QuoteService);

    // Per-line duration in hours — used to pick half vs full-day rate.
    const lineHours =
      (new Date(item.endAt).getTime() - new Date(item.startAt).getTime()) / 3_600_000;
    const isHalfDay =
      item.service === "daycare" && lineHours > 0 && lineHours <= HALF_DAY_MAX_HOURS;

    // basePrice resolution.
    //
    // Daycare gets MDC's published half/full-day pricing baked in — this is
    // the rate that actually applies in practice and it's a worse owner
    // experience to surface 0.00 than to surface the standard rate with a
    // "staff confirms" caveat.  Half-day = drop+pickup window ≤ 5h.
    //
    // For grooming / overnights / transport we still defer to the service
    // KV record (no published flat rate). If nothing's there, surface "TBD"
    // rather than lying with a fabricated number.
    let basePrice = 0;
    let priceSource: "service-kv" | "mdc-published" | "default" | "unknown" = "unknown";

    if (item.service === "daycare") {
      basePrice = isHalfDay ? MDC_DAYCARE_HALF_DAY_CHF : MDC_DAYCARE_FULL_DAY_CHF;
      priceSource = "mdc-published";
    } else if (svcRecord && svcRecord.basePrice !== null) {
      basePrice = svcRecord.basePrice;
      priceSource = "service-kv";
    } else {
      // No price on file. We don't fall back to a hardcoded number for the
      // owner — that would silently lie. Show 0 + a caveat naming the service.
      basePrice = 0;
      priceSource = svcRecord ? "default" : "unknown";
      lineCaveats.push(
        `Price for ${serviceDisplayName(item.service as QuoteService, svcRecord?.name ?? null)} isn't set yet — the team will confirm.`,
      );
    }

    // taxRate resolution — flag a quote-level caveat the first time we fall back.
    let taxRate: number;
    if (svcRecord && svcRecord.taxRate !== null) {
      taxRate = svcRecord.taxRate;
    } else {
      taxRate = FALLBACK_TAX_RATE;
      usedTaxFallback = true;
    }

    // quantity — daycare/overnights scale with pets and days; grooming/transport
    // are one-shot per booking regardless of how many pets are listed (staff
    // bundles add-on pets at intake).
    const numberOfPets = item.petIds.length;
    let quantity = 1;
    let label = "";
    const svcLabel = serviceDisplayName(item.service as QuoteService, svcRecord?.name ?? null);
    if (item.service === "daycare" || item.service === "overnights") {
      const days = daysSpanned(item.startAt, item.endAt);
      quantity = numberOfPets * days;
      // Append the AM/PM/half/full hint so the owner can see WHY it's CHF
      // 69 vs CHF 99 in the line item without opening the full breakdown.
      const dayKindHint =
        item.service === "daycare" ? (isHalfDay ? " · half-day" : " · full-day") : "";
      if (numberOfPets > 1 || days > 1) {
        const dogsNoun = numberOfPets === 1 ? "dog" : "dogs";
        const daysNoun = days === 1 ? "day" : "days";
        label = `${svcLabel}${dayKindHint} · ${numberOfPets} ${dogsNoun} · ${days} ${daysNoun}`;
      } else {
        label = `${svcLabel}${dayKindHint} · 1 dog · 1 day`;
      }
    } else {
      // grooming / transport — single-shot.
      quantity = 1;
      label =
        numberOfPets === 1
          ? `${svcLabel} · ${numberOfPets} dog`
          : `${svcLabel} · ${numberOfPets} dogs`;
    }

    const subtotal = round2(basePrice * quantity);
    const taxAmount = round2(subtotal * taxRate);
    const total = round2(subtotal + taxAmount);

    lineItems.push({
      service: item.service as QuoteService,
      label,
      basePrice: round2(basePrice),
      quantity,
      subtotal,
      taxRate,
      taxAmount,
      total,
      priceSource,
      caveats: lineCaveats,
    });
  }

  // Aggregate totals.
  const subtotal = round2(lineItems.reduce((acc, li) => acc + li.subtotal, 0));
  const taxAmount = round2(lineItems.reduce((acc, li) => acc + li.taxAmount, 0));
  const total = round2(subtotal + taxAmount);

  // Quote-level caveats. Always include the "staff confirms" + membership
  // notes; add the tax fallback note only when at least one line needed it
  // (don't nag the owner when everything resolved cleanly). Currency caveat
  // fires when a locationId was specified — multi-location tenants may sell
  // in different currencies and the v1 portal can't yet model that.
  const caveats: string[] = [STAFF_CONFIRMS_CAVEAT, MEMBERSHIP_CAVEAT];
  if (usedTaxFallback) caveats.push(TAX_FALLBACK_CAVEAT);
  if (locationId) caveats.push(CURRENCY_CAVEAT);

  // 15-minute expiry — the snapshot, not a contract. Portal must re-quote.
  const quoteExpiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

  return c.json({
    lineItems,
    subtotal,
    taxAmount,
    total,
    currency: "CHF",
    caveats,
    quoteExpiresAt,
    estimate: true as const,
  });
});

bookings.post("/portal/bookings/:id/cancel", async (c) => {
  const auth = await readPortalUser(c);
  if ("error" in auth) return c.json({ error: auth.error }, auth.status as 401 | 403);
  const { tenantId, householdId } = auth;
  const id = c.req.param("id");
  const b = (await kv.get(`portal_booking:${tenantId}:${id}`)) as any;
  if (!b || b.householdId !== householdId) return c.json({ error: "Not found" }, 404);
  if (b.status !== "pending") return c.json({ error: "Only pending bookings can be cancelled" }, 409);
  if (b.kind === "bundle_child") {
    return c.json({ error: "Cancel the whole bundle from its parent" }, 409);
  }
  const stamp = new Date().toISOString();
  const updated = { ...b, status: "cancelled", updatedAt: stamp, statusChangedAt: stamp };
  await kv.set(`portal_booking:${tenantId}:${id}`, updated);

  // Atomic bundle: cancel cascades to all children.
  if (b.kind === "bundle_parent" && Array.isArray(b.childIds)) {
    await Promise.all(
      b.childIds.map(async (cid: string) => {
        const child = (await kv.get(`portal_booking:${tenantId}:${cid}`)) as any;
        if (child) {
          await kv.set(`portal_booking:${tenantId}:${cid}`, {
            ...child,
            status: "cancelled",
            updatedAt: stamp,
            statusChangedAt: stamp,
          });
        }
      }),
    );
  }
  return c.json({ booking: updated });
});

// ----- STAFF endpoints (mounted under /make-server-fc003b23/portal-admin) -----

bookings.get("/portal-admin/pending-requests", async (c) => {
  const auth = await readStaff(c);
  if (!auth) return c.json({ error: "Unauthorized" }, 401);
  const { tenantId } = auth;

  // Staff queue: show ONE row per booking-or-bundle, never the raw children.
  // Bundle parents get inflated with their childRequests[] so the UI can
  // render the line items inside a single card.
  const all = ((await kv.getByPrefix(`portal_booking:${tenantId}:`)) as any[])
    .filter((b) => b.ownerSubmitted && b.status === "pending")
    .filter((b) => b.kind !== "bundle_child")
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  const enriched = await Promise.all(
    all.map(async (b) => {
      const h = await kv.get(`customer:${tenantId}:household:${b.householdId}`);
      const base = { ...b, householdName: (h as any)?.name ?? null };
      if (b.kind === "bundle_parent" && Array.isArray(b.childIds)) {
        const children = await Promise.all(
          b.childIds.map((cid: string) => kv.get(`portal_booking:${tenantId}:${cid}`)),
        );
        return { ...base, childRequests: children.filter(Boolean) };
      }
      return base;
    }),
  );
  return c.json({ requests: enriched });
});

// Lightweight pending counts for the Portal Inbox nav badge — the sidebar
// and mobile drawer poll this, so it must stay cheap: no household
// enrichment, no signed URLs, just the same "pending" filters the three
// queue GETs apply (/portal-admin/pending-requests above, /portal-admin/
// vax-queue and /portal-admin/pet-verifications in portal_invites.ts).
bookings.get("/portal-admin/inbox-counts", async (c) => {
  const auth = await readStaff(c);
  if (!auth) return c.json({ error: "Unauthorized" }, 401);
  const { tenantId } = auth;

  const [bookingsAll, vaxAll, petsAll] = await Promise.all([
    kv.getByPrefix(`portal_booking:${tenantId}:`),
    kv.getByPrefix(`vax_review_queue:${tenantId}:`),
    kv.getByPrefix(`portal_pet_verification:${tenantId}:`),
  ]);

  const pendingRequests = (bookingsAll as any[]).filter(
    (b) => b.ownerSubmitted && b.status === "pending" && b.kind !== "bundle_child",
  ).length;
  const vaxQueue = (vaxAll as any[]).filter((i) => i.status === "pending").length;
  const petVerifications = (petsAll as any[]).filter((i) => i.status === "pending").length;

  return c.json({
    pendingRequests,
    vaxQueue,
    petVerifications,
    total: pendingRequests + vaxQueue + petVerifications,
  });
});

// =======================================================================
// Capacity settings (staff-editable per-service daily caps)
// =======================================================================
// The snapshot endpoint below reads from settings:capacity:{tenantId}
// which is itself just a small Record<service, { daily }>. These two
// endpoints let staff view + edit those caps in one place. When the
// record is absent, falls back to DEFAULT_CAPS (30/10/8/12 matching the
// hardcoded daycare cap that existed before this work).

interface CapacityCap { daily: number }
type CapacityConfig = Record<string, CapacityCap>;

const SERVICE_KEYS: ReadonlyArray<keyof typeof DEFAULT_CAPS> = ["daycare", "overnights", "grooming", "transport"];

bookings.get("/portal-admin/settings/capacity", async (c) => {
  const auth = await readStaff(c);
  if (!auth) return c.json({ error: "Unauthorized" }, 401);
  const { tenantId } = auth;

  const stored = ((await kv.get(`settings:capacity:${tenantId}`)) as CapacityConfig | null) ?? {};
  // Always return ALL services with current + default values so the UI can
  // render a complete form even on a fresh tenant. defaults[] echoes what
  // the snapshot endpoint would fall back to per service — for daycare
  // that's the summed location capacity, not the legacy constant.
  const daycareDef = await daycareDefaultCap();
  const out: Record<string, { daily: number; isDefault: boolean; default: number }> = {};
  for (const svc of SERVICE_KEYS) {
    const def = svc === "daycare" ? daycareDef : DEFAULT_CAPS[svc];
    const cur = stored[svc]?.daily;
    out[svc] = {
      daily: typeof cur === "number" ? cur : def,
      isDefault: typeof cur !== "number",
      default: def,
    };
  }
  return c.json({ capacity: out });
});

bookings.put("/portal-admin/settings/capacity", async (c) => {
  const auth = await readStaff(c);
  if (!auth) return c.json({ error: "Unauthorized" }, 401);
  const { tenantId, user } = auth;

  const body = await c.req.json().catch(() => null);
  const incoming = body?.capacity;
  if (!incoming || typeof incoming !== "object") {
    return c.json({ error: "capacity object required" }, 400);
  }

  // Hard caps prevent fat-finger disasters — a daily cap of 100,000 isn't a
  // capacity setting, it's a typo. 500 is generous for a single location
  // (the existing default is 30); raise here if you genuinely operate more.
  const HARD_MAX = 500;
  const next: CapacityConfig = {};
  for (const svc of SERVICE_KEYS) {
    const raw = incoming[svc]?.daily;
    if (raw === undefined || raw === null || raw === "") continue; // unset → fall back to default
    const n = Number(raw);
    if (!Number.isFinite(n) || n < 0 || n > HARD_MAX) {
      return c.json({ error: `${svc} daily cap must be between 0 and ${HARD_MAX}` }, 400);
    }
    next[svc] = { daily: Math.round(n) };
  }

  await kv.set(`settings:capacity:${tenantId}`, {
    ...next,
    updated_at: new Date().toISOString(),
    updated_by: user.id,
  });

  return c.json({ ok: true });
});

// Capacity snapshot — given a list of (date, service) pairs (one per line
// item in the staff inbox), return how booked each one already is.
//
// Sources counted as "booked":
//   1. portal_booking rows with status='confirmed' overlapping the date —
//      both single bookings and bundle CHILDREN (parents have no service
//      window we'd want to count independently).
//   2. service-native staff records (daycare:booking:*, etc.) — these are
//      where staff-created bookings live BEFORE portal approval was a
//      concept. Both sources combined = "how many dogs are booked".
// Pending requests are NOT counted — they don't take capacity until staff
// confirms. The whole point of the snapshot is to inform that decision.
//
// Capacity is read from settings:capacity:{tenantId} when present,
// otherwise sensible defaults (30/10/8/12 for daycare/overnight/groom/
// transport — the same 30 the existing daycare endpoint hardcodes).
const DEFAULT_CAPS: Record<string, number> = {
  daycare: 30,
  overnights: 10,
  grooming: 8,
  transport: 12,
};

// The daycare default is NOT the constant above when locations are
// configured: it's the SUM of every location's capacity.maxDogs
// (Settings → Locations) — the same number the dashboard's All Locations
// view and the capacity planner show. The hardcoded 30 remains only as
// the last resort for a tenant with no location records. An explicit
// tenant-wide cap saved via settings:capacity:{tenantId} still wins.
const daycareDefaultCap = async (): Promise<number> => {
  const locations = (await kv.getByPrefix("location:")) as any[];
  const sum = (Array.isArray(locations) ? locations : []).reduce((acc: number, loc: any) => {
    const maxDogs = loc?.capacity?.maxDogs;
    return acc + (typeof maxDogs === "number" && maxDogs > 0 ? maxDogs : 0);
  }, 0);
  return sum > 0 ? sum : DEFAULT_CAPS.daycare;
};

bookings.post("/portal-admin/capacity-snapshot", async (c) => {
  const auth = await readStaff(c);
  if (!auth) return c.json({ error: "Unauthorized" }, 401);
  const { tenantId } = auth;

  const body = await c.req.json().catch(() => null);
  const rawPairs = Array.isArray(body?.pairs) ? body.pairs : [];
  const pairs: Array<{ date: string; service: string }> = rawPairs
    .filter((p: any) => typeof p?.date === "string" && typeof p?.service === "string")
    .map((p: any) => ({ date: p.date.slice(0, 10), service: p.service }));
  if (pairs.length === 0) return c.json({ snapshots: {} });

  // Dedupe — the inbox often has the same (date, service) pair appearing
  // across many lines; one fetch each is plenty.
  const uniqueKey = (p: { date: string; service: string }) => `${p.date}|${p.service}`;
  const uniquePairs = new Map<string, { date: string; service: string }>();
  for (const p of pairs) uniquePairs.set(uniqueKey(p), p);

  // Capacity config — { daycare: { daily: N }, overnights: { daily: N }, ... }
  // Explicit tenant caps win; the daycare fallback is the summed location
  // capacity so the approval line agrees with the dashboard and planner.
  const capacityConfig =
    ((await kv.get(`settings:capacity:${tenantId}`)) as Record<string, { daily?: number }> | null) ?? {};
  const daycareDef = await daycareDefaultCap();
  const capFor = (svc: string): number =>
    capacityConfig[svc]?.daily ?? (svc === "daycare" ? daycareDef : DEFAULT_CAPS[svc]) ?? 30;

  // Pre-load all four service KVs once — the booking volume is moderate and
  // looping per pair is much cheaper than N round-trips.
  const [portalBookings, daycareBookings, overnightReservations, groomingApts, transportJobs] =
    await Promise.all([
      kv.getByPrefix(`portal_booking:${tenantId}:`),
      kv.getByPrefix(`daycare:booking:`),
      kv.getByPrefix(`overnight:${tenantId}:reservation:`),
      kv.getByPrefix(`grooming-apt:${tenantId}:`),
      kv.getByPrefix(`transport_job:${tenantId}:`),
    ]);

  function countBooked(date: string, service: string): number {
    let total = 0;

    // 1. Confirmed portal bookings (single + bundle CHILDREN — parents are
    //    aggregate views, not real bookings).
    for (const b of portalBookings as any[]) {
      if (!b || b.status !== "confirmed") continue;
      if (b.kind === "bundle_parent") continue;
      if (b.service !== service) continue;
      const start = (b.startAt ?? "").slice(0, 10);
      const end = (b.endAt ?? "").slice(0, 10);
      if (start && end && start <= date && date <= end) total++;
    }

    // 2. Service-native bookings.
    if (service === "daycare") {
      total += (daycareBookings as any[]).filter(
        (b) => b && (b.booking_date === date || b.date === date) && b.booking_status !== "cancelled",
      ).length;
    } else if (service === "overnights") {
      total += (overnightReservations as any[]).filter((r) => {
        if (!r) return false;
        const sd = r.startDate || r.start_date;
        const ed = r.endDate || r.end_date;
        return sd && ed && sd <= date && date <= ed && r.status !== "cancelled";
      }).length;
    } else if (service === "grooming") {
      total += (groomingApts as any[]).filter(
        (a) => a && (a.appointment_date === date || a.date === date) && a.status !== "cancelled",
      ).length;
    } else if (service === "transport") {
      total += (transportJobs as any[]).filter(
        (j) => j && (j.service_date === date || j.date === date) && j.status !== "cancelled",
      ).length;
    }

    return total;
  }

  const snapshots: Record<string, any> = {};
  for (const [key, { date, service }] of uniquePairs.entries()) {
    const booked = countBooked(date, service);
    const capacity = capFor(service);
    const available = Math.max(0, capacity - booked);
    const utilizationPercent = capacity > 0 ? Math.round((booked / capacity) * 100) : 0;
    const status: "available" | "limited" | "full" | "overbooked" =
      booked > capacity ? "overbooked"
      : available === 0 ? "full"
      : available <= 5 ? "limited"
      : "available";
    snapshots[key] = { date, service, booked, capacity, available, utilizationPercent, status };
  }

  return c.json({ snapshots });
});

// Approve / decline are polymorphic: when called on a bundle_parent they
// cascade to all children atomically, so staff still sees one button per
// request in the UI. Refusing on a bundle_child enforces "approve via the
// parent" — there's no per-line approval surface by design (atomic-only,
// as confirmed in roadmap planning).
async function applyStatusCascade(
  tenantId: string,
  parent: any,
  patch: (rec: any) => any,
): Promise<any> {
  // Children FIRST, parent LAST: if a child write fails the parent is still
  // pending, so /portal-admin/pending-requests shows the request again on
  // the next refresh and staff can retry. The opposite order can leave a
  // confirmed parent with one un-cascaded pending child — visible to nobody
  // and unrecoverable from the UI.
  const missingChildIds: string[] = [];
  if (parent.kind === "bundle_parent" && Array.isArray(parent.childIds)) {
    await Promise.all(
      parent.childIds.map(async (cid: string) => {
        const child = (await kv.get(`portal_booking:${tenantId}:${cid}`)) as any;
        if (!child) {
          missingChildIds.push(cid);
          return;
        }
        await kv.set(`portal_booking:${tenantId}:${cid}`, patch(child));
      }),
    );
    if (missingChildIds.length > 0) {
      // Loud warning in the function logs so operations can find and clean up
      // orphan parents instead of staring at a "confirmed" bundle that's
      // structurally short a line item.
      console.warn(
        `[portal_bookings] cascade on parent ${parent.id}: ${missingChildIds.length} orphan childIds skipped: ${missingChildIds.join(", ")}`,
      );
    }
  }
  const updated = patch(parent);
  await kv.set(`portal_booking:${tenantId}:${parent.id}`, updated);
  return updated;
}

/**
 * Replicate an approved portal daycare booking into the daycare:* keyspace
 * the capacity dashboard reads from.  This is the bridge between the
 * portal-side `portal_booking:*` records (which the daycare dashboard
 * doesn't know exist) and the staff-side `daycare:booking:*` records that
 * power tile counts, check-in flow, and capacity occupancy.
 *
 * Writes ONE daycare booking per pet on the portal record — the daycare
 * dashboard is one-pet-per-row, so a portal booking with 3 pets fans out
 * to 3 daycare:booking:* entries (matching how the staff app would have
 * recorded them if booked directly).
 *
 * Skips silently when:
 *   - service isn't daycare (overnights replicate into the overnights
 *     keyspace via replicatePortalToOvernights; grooming/transport have no
 *     daycare dashboard surface)
 *   - locationId is missing (capacity tile needs a location to count under)
 *   - we'd be overwriting a checked-in / checked-out record (re-approval
 *     after a status change shouldn't blow away staff's in-day work)
 *
 * Updates the per-location-per-date capacity counter so the tile reflects
 * the new occupancy immediately rather than waiting for the next cache miss.
 */
async function replicatePortalToDaycare(
  tenantId: string,
  rec: any,
  staffUser: { id?: string; name?: string },
): Promise<void> {
  const service = rec?.service;
  if (service !== "daycare") return;
  if (!rec.locationId) {
    console.warn(
      `[portal->daycare] approval skipped — portal_booking ${rec.id} has no locationId; ` +
      `the capacity dashboard cannot count it. Owner submitted before StepLocation was wired, ` +
      `or grooming/transport variant snuck through. Staff can manually book to backfill.`,
    );
    return;
  }
  const locationId = String(rec.locationId);

  // Resolve household + location for the denormalised fields the daycare
  // dashboard rows expect.
  const household = (await kv.get(`customer:${tenantId}:household:${rec.householdId}`)) as any;
  const householdName = household?.name ?? "Household";
  const location = (await kv.get(`location:${locationId}`)) as any;
  const locationName = location?.name ?? "Location";

  // Same MDC half/full-day published rates used in /portal/quote, so the
  // owner's estimate and the staff-side daycare row match without a
  // round-trip through services KV.
  const startTime = new Date(rec.startAt);
  const endTime = new Date(rec.endAt);
  const hours = (endTime.getTime() - startTime.getTime()) / 3_600_000;
  const isHalfDay = hours > 0 && hours <= 5;
  const basePrice = isHalfDay ? 69 : 99;
  const taxRate = 0.081;
  const totalPrice = Math.round(basePrice * (1 + taxRate) * 100) / 100;

  const bookingDate = rec.startAt.slice(0, 10); // YYYY-MM-DD
  const plannedStartTime = rec.startAt.slice(11, 16); // HH:MM
  const plannedEndTime = rec.endAt.slice(11, 16);

  // One daycare:booking per pet — that's the staff-side row shape.
  const petIds: string[] = Array.isArray(rec.petIds) ? rec.petIds : [];
  const now = new Date().toISOString();

  for (const petId of petIds) {
    const pet = (await kv.get(`customer:${tenantId}:pet:${rec.householdId}:${petId}`)) as any;
    if (!pet) {
      console.warn(`[portal->daycare] pet ${petId} not found for portal_booking ${rec.id}`);
      continue;
    }

    // Idempotency: stable id derived from the portal booking + pet so
    // re-approvals don't create duplicates.  Slice keeps the id short and
    // readable in the staff dashboard.
    const daycareBookingId = `daybook_pb_${rec.id.slice(0, 8)}_${petId.slice(0, 6)}`;

    // Don't trample mid-day staff work — if the same daycare record exists
    // and has progressed past 'not_checked_in', leave it alone.
    const existing = (await kv.get(`daycare:booking:${daycareBookingId}`)) as any;
    if (existing && existing.check_in_status && existing.check_in_status !== "not_checked_in") {
      console.log(`[portal->daycare] preserving in-progress record ${daycareBookingId}`);
      continue;
    }

    const daycareBooking = {
      id: daycareBookingId,
      tenantId, // for any future tenant-aware filters
      household_id: rec.householdId,
      household_name: householdName,
      pet_id: petId,
      pet_name: pet?.name ?? "Pet",
      // Storage path (or legacy URL) — staff read endpoints sign it at
      // response time; never persist a signed URL on the booking.
      pet_photo_url: storedPetPhoto(pet),
      location_id: locationId,
      location_name: locationName,
      service_id: "service_daycare_owner_portal",
      service_name: isHalfDay ? "Daycare half-day" : "Daycare full-day",
      service_type: "daycare",
      booking_date: bookingDate,
      planned_start_time: plannedStartTime,
      planned_end_time: plannedEndTime,
      booking_status: "confirmed" as const,
      check_in_status: "not_checked_in" as const,
      customer_notes: rec.notes ?? null,
      has_behaviour_flag: !!pet?.behaviour_notes,
      has_medical_flag: !!pet?.medical_notes,
      behaviour_notes: pet?.behaviour_notes ?? null,
      medical_notes: pet?.medical_notes ?? null,
      vaccination_status: pet?.vaccination_status ?? null,
      waiver_status: "unknown" as const,
      has_booking_hold: household?.booking_hold === true,
      has_payment_hold: household?.payment_hold === true,
      hold_reason: household?.hold_reason ?? null,
      base_price_locked: basePrice,
      tax_rate: taxRate,
      total_price: totalPrice,
      currency: "CHF",
      billing_line_item_ids: [] as string[],
      requires_transport: !!(rec.services ?? []).includes("transport"),
      source: "portal" as const, // staff can filter on this in the dashboard if useful
      portal_booking_id: rec.id, // back-pointer for tracing
      created_by_id: staffUser?.id ?? "portal-approver",
      created_by_name: staffUser?.name ?? "Portal approver",
      created_at: existing?.created_at ?? now,
      updated_at: now,
    };

    await kv.set(`daycare:booking:${daycareBookingId}`, daycareBooking);
    // Index keys mirror what the staff create handler writes — same lookup
    // patterns work from the dashboard list views.
    await kv.set(`daycare:booking:date:${locationId}:${bookingDate}:${daycareBookingId}`, daycareBookingId);
    await kv.set(`daycare:booking:pet:${petId}:${daycareBookingId}`, daycareBookingId);
    await kv.set(`daycare:booking:household:${rec.householdId}:${daycareBookingId}`, daycareBookingId);

    // Capacity counter — bump unless we were just overwriting our own
    // already-confirmed record (idempotent re-approval).
    if (!existing) {
      const capKey = `daycare:capacity:${locationId}:${bookingDate}`;
      const cap = ((await kv.get(capKey)) as any) ?? {
        id: `cap_${locationId}_${bookingDate}`,
        location_id: locationId,
        date: bookingDate,
        // 19 matches daycare_routes' FALLBACK_LOCATION_CAPACITY — a record
        // created at 30 here would flap to 19 on the next daycare read.
        max_capacity: location?.capacity?.maxDogs ?? 19,
        current_bookings: 0,
      };
      cap.current_bookings = (cap.current_bookings ?? 0) + 1;
      cap.available_slots = Math.max(0, (cap.max_capacity ?? 19) - cap.current_bookings);
      cap.is_full = cap.available_slots <= 0;
      cap.updated_at = now;
      await kv.set(capKey, cap);
    }
  }
}

/**
 * Replicate an approved portal OVERNIGHTS booking into the overnights
 * keyspace (overnight:{tenant}:reservation:*) — the records the Overnights
 * module's hub, check-in list, care logs, and capacity counts read. Without
 * this bridge a client-booked stay is invisible to the night-shift tooling.
 *
 * One reservation per pet (the module is one-dog-per-reservation), priced
 * server-side from the location's configured nightly rate. Idempotent ids
 * derived from the portal booking + pet, and re-approval never tramples a
 * reservation staff have already checked in.
 */
async function replicatePortalToOvernights(
  tenantId: string,
  rec: any,
  staffUser: { id?: string; name?: string },
): Promise<void> {
  if (rec?.service !== "overnights") return;
  if (!rec.locationId) {
    console.warn(
      `[portal->overnights] approval skipped — portal_booking ${rec.id} has no locationId; ` +
      `an overnight reservation needs a location. Staff can manually book to backfill.`,
    );
    return;
  }
  const locationId = String(rec.locationId);

  const household = (await kv.get(`customer:${tenantId}:household:${rec.householdId}`)) as any;
  const householdName = household?.name ?? "Household";

  const startDate = rec.startAt.slice(0, 10);
  let endDate = rec.endAt.slice(0, 10);
  if (endDate <= startDate) {
    // Same-day request — an overnight stay is at least one night.
    const next = new Date(`${startDate}T00:00:00Z`);
    next.setUTCDate(next.getUTCDate() + 1);
    endDate = next.toISOString().split("T")[0];
  }
  const totalNights = Math.max(
    1,
    Math.round((new Date(`${endDate}T00:00:00Z`).getTime() - new Date(`${startDate}T00:00:00Z`).getTime()) / 86_400_000),
  );
  const pricePerNight = await nightlyRateFor(tenantId, locationId);

  const petIds: string[] = Array.isArray(rec.petIds) ? rec.petIds : [];
  const now = new Date().toISOString();

  for (const petId of petIds) {
    const pet = (await kv.get(`customer:${tenantId}:pet:${rec.householdId}:${petId}`)) as any;
    if (!pet) {
      console.warn(`[portal->overnights] pet ${petId} not found for portal_booking ${rec.id}`);
      continue;
    }

    // Idempotency: stable id from portal booking + pet, so re-approvals
    // update in place instead of duplicating.
    const reservationId = `ovn_pb_${rec.id.slice(0, 8)}_${petId.slice(0, 6)}`;
    const key = `overnight:${tenantId}:reservation:${reservationId}`;

    // Don't trample a stay staff have already progressed.
    const existing = (await kv.get(key)) as any;
    if (existing && existing.status && existing.status !== "confirmed" && existing.status !== "booked") {
      console.log(`[portal->overnights] preserving in-progress reservation ${reservationId}`);
      continue;
    }

    const reservation = {
      id: reservationId,
      customerId: rec.householdId,
      petId,
      householdId: rec.householdId,
      startDate,
      endDate,
      // Standard arrival/departure windows — owners pick dates, not slots.
      checkInWindow: { start: "14:00", end: "18:00" },
      checkOutWindow: { start: "08:00", end: "11:00" },
      locationId,
      status: "confirmed",
      specialInstructions: rec.notes ?? undefined,
      requiresMedication: !!pet?.medical_notes,
      hasBehaviourConcerns: !!pet?.behaviour_notes,
      hasAllergies: !!pet?.allergy_notes,
      pricePerNight,
      totalNights,
      totalPrice: pricePerNight * totalNights,
      currency: "CHF",
      priceLockedAt: existing?.priceLockedAt ?? now,
      requiresPickup: false,
      requiresDropOff: false,
      petName: pet?.name ?? "Pet",
      customerName: householdName,
      source: "portal" as const,
      portal_booking_id: rec.id,
      tenant_id: tenantId,
      createdAt: existing?.createdAt ?? now,
      createdBy: existing?.createdBy ?? (staffUser?.name ?? "Portal approver"),
      updatedAt: now,
      updatedBy: staffUser?.name ?? "Portal approver",
    };

    await kv.set(key, reservation);
    if (!existing) {
      await recordOvernightEvent(
        tenantId,
        reservationId,
        "created",
        staffUser?.id ?? "portal-approver",
        staffUser?.name ?? "Portal approver",
        { petId, locationId, startDate, endDate, source: "portal", portalBookingId: rec.id },
      );
    }
  }
}

/** Route an approved portal booking into its service-native keyspace. */
async function replicatePortalBooking(
  tenantId: string,
  rec: any,
  staffUser: { id?: string; name?: string },
): Promise<void> {
  if (rec?.service === "daycare") return replicatePortalToDaycare(tenantId, rec, staffUser);
  if (rec?.service === "overnights") return replicatePortalToOvernights(tenantId, rec, staffUser);
}

bookings.post("/portal-admin/bookings/:id/approve", async (c) => {
  const auth = await readStaff(c);
  if (!auth) return c.json({ error: "Unauthorized" }, 401);
  const { tenantId, user } = auth;
  const id = c.req.param("id");
  const b = (await kv.get(`portal_booking:${tenantId}:${id}`)) as any;
  if (!b || b.status !== "pending") return c.json({ error: "Not found or already handled" }, 404);
  if (b.kind === "bundle_child") {
    return c.json({ error: "Approve via the bundle parent" }, 409);
  }
  const stamp = new Date().toISOString();
  const updated = await applyStatusCascade(tenantId, b, (rec) => ({
    ...rec,
    status: "confirmed",
    statusChangedAt: stamp,
    updatedAt: stamp,
    approvedBy: user.id,
  }));

  // -------------------------------------------------------------------
  // Replicate into the service-native keyspace the staff tooling reads:
  // daycare bookings → daycare:* (capacity dashboard, check-in flow),
  // overnights → overnight:{tenant}:reservation:* (overnights hub,
  // check-in list, care logs, capacity).  Per pet, per child if a bundle,
  // idempotent.  Errors here do NOT roll back the portal-side approval —
  // the owner still gets their "confirmed" status; staff can backfill
  // manually if the service-side write fails for any reason.
  // -------------------------------------------------------------------
  try {
    if (b.kind === "bundle_parent" && Array.isArray(b.childIds)) {
      // Per-child replication so each line item lands as its own service row.
      for (const cid of b.childIds) {
        const child = (await kv.get(`portal_booking:${tenantId}:${cid}`)) as any;
        if (child) {
          await replicatePortalBooking(tenantId, child, user);
        }
      }
    } else {
      await replicatePortalBooking(tenantId, updated, user);
    }
  } catch (e) {
    console.error("[portal->service] replication failed (non-fatal)", e);
  }

  const email = await getOwnerEmail(tenantId, b.householdId);
  const ownerName = await getOwnerName(tenantId, b.householdId);
  const tenant = (await kv.get(`customer:${tenantId}:household:${b.householdId}`)) as any;
  await notify({
    tenantId,
    householdId: b.householdId,
    type: "booking.confirmed",
    payload: { bookingId: id, service: b.service, startAt: b.startAt, services: b.services ?? undefined },
    link: `/bookings/${id}`,
    email: email ? {
      to: email,
      ...bookingConfirmedEmail({
        ownerName,
        tenantName: tenant?.name ?? "PawPilotPro",
        service: b.service,
        startAt: b.startAt,
        bookingUrl: `${PORTAL_BASE_URL}/bookings/${id}`,
      }),
    } : undefined,
  });

  return c.json({ booking: updated });
});

bookings.post("/portal-admin/bookings/:id/decline", async (c) => {
  const auth = await readStaff(c);
  if (!auth) return c.json({ error: "Unauthorized" }, 401);
  const { tenantId, user } = auth;
  const id = c.req.param("id");
  const body = await c.req.json().catch(() => null);
  const reason = body?.reason;
  if (!reason || typeof reason !== "string" || reason.length < 3) {
    return c.json({ error: "reason required (min 3 chars)" }, 400);
  }
  const b = (await kv.get(`portal_booking:${tenantId}:${id}`)) as any;
  if (!b || b.status !== "pending") return c.json({ error: "Not found or already handled" }, 404);
  if (b.kind === "bundle_child") {
    return c.json({ error: "Decline via the bundle parent" }, 409);
  }
  const stamp = new Date().toISOString();
  const updated = await applyStatusCascade(tenantId, b, (rec) => ({
    ...rec,
    status: "declined",
    declineReason: reason,
    statusChangedAt: stamp,
    updatedAt: stamp,
    declinedBy: user.id,
  }));

  const email = await getOwnerEmail(tenantId, b.householdId);
  const ownerName = await getOwnerName(tenantId, b.householdId);
  const tenant = (await kv.get(`customer:${tenantId}:household:${b.householdId}`)) as any;
  await notify({
    tenantId,
    householdId: b.householdId,
    type: "booking.declined",
    payload: { bookingId: id, reason },
    link: `/bookings/${id}`,
    email: email ? {
      to: email,
      ...bookingDeclinedEmail({
        ownerName,
        tenantName: tenant?.name ?? "PawPilotPro",
        service: b.service,
        startAt: b.startAt,
        reason,
        bookingUrl: `${PORTAL_BASE_URL}/bookings/${id}`,
      }),
    } : undefined,
  });

  return c.json({ booking: updated });
});

export default bookings;
