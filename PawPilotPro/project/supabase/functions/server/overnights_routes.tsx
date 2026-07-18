/**
 * Overnights Routes - Paw Pilot Pro
 * Server-side overnight boarding management with tenant isolation and auth
 */

import { Hono } from "npm:hono";
import { z } from "npm:zod";
import * as kv from "./kv_store.tsx";
import { requireAuth, AuthenticatedUser } from "./_shared/auth.ts";
import { internalError } from "./_shared/log.ts";
import {
  findFullNight,
  nightlyRateFor,
  occupiesNight,
  recordOvernightEvent,
  TERMINAL_OVERNIGHT_STATUSES,
} from "./lib/overnights_shared.ts";

const routes = new Hono();

// Every overnights route requires a validated user. requireAuth handles JWT
// validation server-side with SERVICE_ROLE_KEY; the ad-hoc ANON_KEY-validated
// getUserFromToken helper that used to live here has been removed.
routes.use('*', requireAuth);

// ============================================================================
// AUTH & TENANT HELPERS
// ============================================================================

function getUserInfo(user: AuthenticatedUser) {
  return {
    id: user.id,
    name: user.name,
    role: user.role,
  };
}

const recordEvent = recordOvernightEvent;

// ============================================================================
// VALIDATION SCHEMAS
// ============================================================================
// Zod-validated, whitelist-only bodies. Pricing fields (pricePerNight,
// totalPrice, priceLockedAt) and audit fields are NEVER accepted from the
// client — unknown keys are stripped, prices come from the location's
// configured rate, audit stamps from the authenticated user.

const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "expected YYYY-MM-DD");
const timeWindowSchema = z.object({
  start: z.string().regex(/^\d{2}:\d{2}$/, "expected HH:MM"),
  end: z.string().regex(/^\d{2}:\d{2}$/, "expected HH:MM"),
});

const reservationFields = {
  startDate: dateString,
  endDate: dateString,
  checkInWindow: timeWindowSchema.optional(),
  checkOutWindow: timeWindowSchema.optional(),
  sleepingAreaId: z.string().nullable().optional(),
  assignedCarerUserId: z.string().nullable().optional(),
  specialInstructions: z.string().max(2000).optional(),
  feedingInstructions: z.string().max(2000).optional(),
  medicationInstructions: z.string().max(2000).optional(),
  behaviourNotes: z.string().max(2000).optional(),
  requiresMedication: z.boolean().optional(),
  hasBehaviourConcerns: z.boolean().optional(),
  hasAllergies: z.boolean().optional(),
  requiresPickup: z.boolean().optional(),
  requiresDropOff: z.boolean().optional(),
};

const createReservationSchema = z
  .object({
    ...reservationFields,
    customerId: z.string().min(1),
    petId: z.string().min(1),
    householdId: z.string().min(1),
    locationId: z.string().min(1),
    // New reservations start pre-arrival; check-in/out have dedicated routes.
    status: z.enum(["booked", "confirmed"]).optional(),
    petName: z.string().max(200).optional(),
    customerName: z.string().max(200).optional(),
    daycareBookingId: z.string().optional(),
    currency: z.string().length(3).optional(),
  })
  .refine((d) => d.endDate > d.startDate, {
    message: "endDate must be after startDate",
    path: ["endDate"],
  });

const updateReservationSchema = z
  .object({
    ...reservationFields,
    startDate: dateString.optional(),
    endDate: dateString.optional(),
    // Check-in/check-out state changes go through their dedicated routes,
    // which enforce the safety checks; PUT can only move between pre-arrival
    // states, mark a no-show, promote to in_stay, or cancel.
    status: z.enum(["booked", "confirmed", "in_stay", "cancelled", "no_show"]).optional(),
    cancellationReason: z.string().max(1000).optional(),
  })
  .refine((d) => !d.startDate || !d.endDate || d.endDate > d.startDate, {
    message: "endDate must be after startDate",
    path: ["endDate"],
  });

const capacitySchema = z.object({
  locationId: z.string().min(1),
  maxOvernightCapacity: z.number().int().min(0),
  bufferSlots: z.number().int().min(0),
  pricePerNight: z.number().min(0).optional(),
}).refine((d) => d.bufferSlots <= d.maxOvernightCapacity, {
  message: "bufferSlots cannot exceed maxOvernightCapacity",
  path: ["bufferSlots"],
});

function validationError(c: any, result: { error: z.ZodError }) {
  const issue = result.error.issues[0];
  const path = issue?.path?.join(".");
  return c.json({ error: `Invalid request${path ? ` (${path})` : ""}: ${issue?.message ?? "validation failed"}` }, 400);
}

function nightCount(startDate: string, endDate: string): number {
  return Math.max(
    1,
    Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24)),
  );
}

async function checkConflictingAttendance(tenantId: string, petId: string, locationId: string): Promise<{ hasConflict: boolean; conflictType?: string }> {
  const daycareBookings = await kv.getByPrefix(`daycare:booking:`);
  const activeInDaycare = daycareBookings.find((b: any) =>
    b.pet_id === petId &&
    b.location_id === locationId &&
    (b.status === 'checked_in' || b.status === 'in_progress')
  );
  if (activeInDaycare) {
    return { hasConflict: true, conflictType: 'daycare' };
  }

  const overnightReservations = await kv.getByPrefix(`overnight:${tenantId}:reservation:`);
  const activeOvernight = overnightReservations.find((r: any) =>
    r.petId === petId &&
    r.locationId === locationId &&
    (r.status === 'checked_in' || r.status === 'in_stay')
  );
  if (activeOvernight) {
    return { hasConflict: true, conflictType: 'overnight' };
  }

  return { hasConflict: false };
}

// ============================================================================
// RESERVATIONS
// ============================================================================

routes.get("/reservations", async (c) => {
  try {
    const user = c.get('user') as AuthenticatedUser;
    const tenantId = user.tenantId;
    const locationId = c.req.query("locationId");
    const startDate = c.req.query("startDate");
    const endDate = c.req.query("endDate");
    
    let reservations = await kv.getByPrefix(`overnight:${tenantId}:reservation:`);
    
    // Filter by location
    if (locationId) {
      reservations = reservations.filter((r: any) => r.locationId === locationId);
    }
    
    // Filter by date range
    if (startDate || endDate) {
      reservations = reservations.filter((r: any) => {
        const rStart = new Date(r.startDate);
        const rEnd = new Date(r.endDate);
        
        if (startDate) {
          const filterStart = new Date(startDate);
          if (rEnd < filterStart) return false;
        }
        
        if (endDate) {
          const filterEnd = new Date(endDate);
          if (rStart > filterEnd) return false;
        }
        
        return true;
      });
    }
    
    return c.json(reservations);
  } catch (e: any) {
    return internalError(c, 'overnights.getReservations', e);
  }
});

routes.post("/reservations", async (c) => {
  try {
    const user = c.get('user') as AuthenticatedUser;
    const tenantId = user.tenantId;
    const userInfo = getUserInfo(user);
    const parsed = createReservationSchema.safeParse(await c.req.json());
    if (!parsed.success) return validationError(c, parsed);
    const body = parsed.data;

    // Bookings must leave the emergency buffer free; only on-site transitions
    // (daycare→overnight) may spend it.
    const fullNight = await findFullNight({
      tenantId,
      locationId: body.locationId,
      startDate: body.startDate,
      endDate: body.endDate,
      useBuffer: false,
    });
    if (fullNight) {
      return c.json({ error: `Fully booked for the night of ${fullNight.date} (capacity ${fullNight.capacity})` }, 409);
    }

    const totalNights = nightCount(body.startDate, body.endDate);

    // The location's configured nightly rate is authoritative — the client
    // can't set the price. Lock it onto the reservation at creation.
    const pricePerNight = await nightlyRateFor(tenantId, body.locationId);

    const now = new Date().toISOString();
    const reservation = {
      ...body,
      id: crypto.randomUUID(),
      totalNights,
      pricePerNight,
      totalPrice: pricePerNight * totalNights,
      priceLockedAt: now,
      status: body.status || 'confirmed',
      requiresMedication: body.requiresMedication ?? false,
      hasBehaviourConcerns: body.hasBehaviourConcerns ?? false,
      hasAllergies: body.hasAllergies ?? false,
      requiresPickup: body.requiresPickup ?? false,
      requiresDropOff: body.requiresDropOff ?? false,
      tenant_id: tenantId,
      createdAt: now,
      createdBy: userInfo.name,
      updatedAt: now,
      updatedBy: userInfo.name,
    };

    await kv.set(`overnight:${tenantId}:reservation:${reservation.id}`, reservation);
    
    await recordEvent(tenantId, reservation.id, 'created', userInfo.id, userInfo.name, {
      petId: reservation.petId,
      locationId: reservation.locationId,
      startDate: reservation.startDate,
      endDate: reservation.endDate,
    });
    
    return c.json(reservation);
  } catch (e: any) {
    return internalError(c, 'overnights.postReservations', e);
  }
});

routes.put("/reservations/:id", async (c) => {
  try {
    const user = c.get('user') as AuthenticatedUser;
    const tenantId = user.tenantId;
    const userInfo = getUserInfo(user);
    const id = c.req.param("id");
    const parsed = updateReservationSchema.safeParse(await c.req.json());
    if (!parsed.success) return validationError(c, parsed);
    const body = parsed.data;

    const existing = await kv.get(`overnight:${tenantId}:reservation:${id}`) as any;
    if (!existing) return c.json({ error: "Reservation not found" }, 404);

    const now = new Date().toISOString();
    const updated: any = {
      ...existing,
      ...body,
      updatedAt: now,
      updatedBy: userInfo.name,
    };

    // Date changes re-price from the LOCKED nightly rate (never re-resolved)
    // and must still fit capacity for the new range.
    const datesChanged = updated.startDate !== existing.startDate || updated.endDate !== existing.endDate;
    if (datesChanged) {
      if (updated.endDate <= updated.startDate) {
        return c.json({ error: "Invalid request (endDate): endDate must be after startDate" }, 400);
      }
      if (!TERMINAL_OVERNIGHT_STATUSES.has(updated.status)) {
        const fullNight = await findFullNight({
          tenantId,
          locationId: existing.locationId,
          startDate: updated.startDate,
          endDate: updated.endDate,
          excludeReservationId: id,
          useBuffer: false,
        });
        if (fullNight) {
          return c.json({ error: `Fully booked for the night of ${fullNight.date} (capacity ${fullNight.capacity})` }, 409);
        }
      }
      updated.totalNights = nightCount(updated.startDate, updated.endDate);
      updated.totalPrice = (existing.pricePerNight ?? 0) * updated.totalNights;
    }

    // Cancellation stamps are server-set, not client-supplied.
    if (body.status === 'cancelled' && existing.status !== 'cancelled') {
      updated.cancelledAt = now;
      updated.cancelledBy = userInfo.name;
    }

    await kv.set(`overnight:${tenantId}:reservation:${id}`, updated);

    if (body.status && body.status !== existing.status) {
      await recordEvent(tenantId, id, body.status === 'cancelled' ? 'cancelled' : 'status_changed', userInfo.id, userInfo.name, {
        from: existing.status,
        to: body.status,
        ...(body.cancellationReason ? { reason: body.cancellationReason } : {}),
      });
    }

    return c.json(updated);
  } catch (e: any) {
    return internalError(c, 'overnights.putReservationsId', e);
  }
});

// ============================================================================
// CHECK-IN / CHECK-OUT
// ============================================================================

routes.post("/check-in", async (c) => {
  try {
    const user = c.get('user') as AuthenticatedUser;
    const tenantId = user.tenantId;
    const userInfo = getUserInfo(user);
    const body = await c.req.json();
    const { reservationId, vaccinationValid, waiverSigned, behaviourWarningsAcknowledged, medicalWarningsAcknowledged, checkInNotes } = body;
    
    const reservation = await kv.get(`overnight:${tenantId}:reservation:${reservationId}`);
    if (!reservation) {
      return c.json({ error: "Reservation not found" }, 404);
    }
    
    // Enforce vaccination rule (blocker)
    if (!vaccinationValid) {
      return c.json({ error: "Cannot check in: Vaccinations are not valid or expired" }, 400);
    }
    
    // Enforce waiver requirement (blocker)
    if (!waiverSigned) {
      return c.json({ error: "Cannot check in: Waiver must be signed" }, 400);
    }
    
    // Enforce acknowledgements for flags
    if (reservation.hasBehaviourConcerns && !behaviourWarningsAcknowledged) {
      return c.json({ error: "Cannot check in: Behaviour warnings must be acknowledged" }, 400);
    }
    
    if ((reservation.requiresMedication || reservation.hasAllergies) && !medicalWarningsAcknowledged) {
      return c.json({ error: "Cannot check in: Medical warnings must be acknowledged" }, 400);
    }
    
    const conflict = await checkConflictingAttendance(tenantId, reservation.petId, reservation.locationId);
    if (conflict.hasConflict) {
      return c.json({ error: `Cannot check in: Pet already has an active ${conflict.conflictType} attendance. Please check out from ${conflict.conflictType} first.` }, 409);
    }
    
    const now = new Date().toISOString();
    const updated = {
      ...reservation,
      status: 'checked_in',
      actualCheckInTime: now,
      checkedInBy: userInfo.name,
      checkedInById: userInfo.id,
      checkInNotes,
      updatedAt: now,
      updatedBy: userInfo.name,
    };
    
    await kv.set(`overnight:${tenantId}:reservation:${reservationId}`, updated);
    
    await recordEvent(tenantId, reservationId, 'checked_in', userInfo.id, userInfo.name, {
      checkInNotes,
      vaccinationValid,
      waiverSigned,
    });
    
    return c.json(updated);
  } catch (e: any) {
    console.error("Check-in error:", e);
    return internalError(c, 'overnights.postCheckIn', e);
  }
});

routes.post("/check-out", async (c) => {
  try {
    const user = c.get('user') as AuthenticatedUser;
    const tenantId = user.tenantId;
    const userInfo = getUserInfo(user);
    const body = await c.req.json();
    const { reservationId, handedOverTo, checkOutNotes, nextVisitNotes } = body;
    
    const reservation = await kv.get(`overnight:${tenantId}:reservation:${reservationId}`);
    if (!reservation) {
      return c.json({ error: "Reservation not found" }, 404);
    }
    
    const now = new Date().toISOString();
    const updated = {
      ...reservation,
      status: 'checked_out',
      actualCheckOutTime: now,
      checkedOutBy: userInfo.name,
      checkedOutById: userInfo.id,
      billingRecalculationRequired: true,
      updatedAt: now,
      updatedBy: userInfo.name,
    };
    
    await kv.set(`overnight:${tenantId}:reservation:${reservationId}`, updated);
    
    if (checkOutNotes || nextVisitNotes) {
      const checkOutRecord = {
        id: crypto.randomUUID(),
        reservationId,
        petId: reservation.petId,
        handedOverTo,
        checkOutNotes,
        nextVisitNotes,
        checkedOutBy: userInfo.name,
        checkedOutById: userInfo.id,
        checkedOutAt: now,
        tenant_id: tenantId,
      };
      await kv.set(`overnight:${tenantId}:checkout:${checkOutRecord.id}`, checkOutRecord);
    }
    
    await recordEvent(tenantId, reservationId, 'checked_out', userInfo.id, userInfo.name, {
      handedOverTo,
      checkOutNotes,
      nextVisitNotes,
      billingRecalculationRequired: true,
    });
    
    return c.json(updated);
  } catch (e: any) {
    console.error("Check-out error:", e);
    return internalError(c, 'overnights.postCheckOut', e);
  }
});

// ============================================================================
// NIGHTLY CARE LOGS
// ============================================================================

routes.get("/care-logs", async (c) => {
  try {
    const user = c.get('user') as AuthenticatedUser;
    const tenantId = user.tenantId;
    const reservationId = c.req.query("reservationId");
    const date = c.req.query("date");
    
    let careLogs = await kv.getByPrefix(`overnight:${tenantId}:carelog:`);
    
    if (reservationId) {
      careLogs = careLogs.filter((cl: any) => cl.reservationId === reservationId);
    }
    
    if (date) {
      careLogs = careLogs.filter((cl: any) => cl.logDate === date);
    }
    
    return c.json(careLogs);
  } catch (e: any) {
    return internalError(c, 'overnights.getCareLogs', e);
  }
});

routes.post("/care-logs", async (c) => {
  try {
    const user = c.get('user') as AuthenticatedUser;
    const tenantId = user.tenantId;
    const userInfo = getUserInfo(user);
    const body = await c.req.json();
    
    const careLog = {
      ...body,
      id: crypto.randomUUID(),
      tenant_id: tenantId,
      completedBy: userInfo.name,
      completedById: userInfo.id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    await kv.set(`overnight:${tenantId}:carelog:${careLog.id}`, careLog);
    
    return c.json(careLog);
  } catch (e: any) {
    return internalError(c, 'overnights.postCareLogs', e);
  }
});

routes.put("/care-logs/:id", async (c) => {
  try {
    const user = c.get('user') as AuthenticatedUser;
    const tenantId = user.tenantId;
    const userInfo = getUserInfo(user);
    const id = c.req.param("id");
    const body = await c.req.json();
    
    const existing = await kv.get(`overnight:${tenantId}:carelog:${id}`);
    if (!existing) return c.json({ error: "Care log not found" }, 404);
    
    const updated = {
      ...existing,
      ...body,
      updatedAt: new Date().toISOString(),
      updatedBy: userInfo.name,
    };
    
    await kv.set(`overnight:${tenantId}:carelog:${id}`, updated);
    return c.json(updated);
  } catch (e: any) {
    return internalError(c, 'overnights.putCareLogsId', e);
  }
});

// ============================================================================
// SLEEPING AREAS
// ============================================================================

routes.get("/sleeping-areas", async (c) => {
  try {
    const user = c.get('user') as AuthenticatedUser;
    const tenantId = user.tenantId;
    const locationId = c.req.query("locationId");
    
    let areas = await kv.getByPrefix(`overnight:${tenantId}:area:`);
    
    if (locationId) {
      areas = areas.filter((a: any) => a.locationId === locationId);
    }
    
    return c.json(areas);
  } catch (e: any) {
    return internalError(c, 'overnights.getSleepingAreas', e);
  }
});

routes.post("/sleeping-areas", async (c) => {
  try {
    const user = c.get('user') as AuthenticatedUser;
    const tenantId = user.tenantId;
    const userInfo = getUserInfo(user);
    const body = await c.req.json();
    
    const now = new Date().toISOString();
    const area = {
      ...body,
      id: body.id || crypto.randomUUID(),
      tenant_id: tenantId,
      createdAt: now,
      createdBy: userInfo.name,
      updatedAt: now,
      updatedBy: userInfo.name,
    };
    
    await kv.set(`overnight:${tenantId}:area:${area.id}`, area);
    return c.json(area);
  } catch (e: any) {
    return internalError(c, 'overnights.postSleepingAreas', e);
  }
});

routes.put("/sleeping-areas/:id", async (c) => {
  try {
    const user = c.get('user') as AuthenticatedUser;
    const tenantId = user.tenantId;
    const userInfo = getUserInfo(user);
    const id = c.req.param("id");
    const body = await c.req.json();
    
    const existing = await kv.get(`overnight:${tenantId}:area:${id}`);
    if (!existing) return c.json({ error: "Sleeping area not found" }, 404);
    
    const updated = {
      ...existing,
      ...body,
      updatedAt: new Date().toISOString(),
      updatedBy: userInfo.name,
    };
    
    await kv.set(`overnight:${tenantId}:area:${id}`, updated);
    return c.json(updated);
  } catch (e: any) {
    return internalError(c, 'overnights.putSleepingAreasId', e);
  }
});

// ============================================================================
// SHIFT HANDOVERS
// ============================================================================

routes.get("/handovers", async (c) => {
  try {
    const user = c.get('user') as AuthenticatedUser;
    const tenantId = user.tenantId;
    const locationId = c.req.query("locationId");
    const date = c.req.query("date");
    
    let handovers = await kv.getByPrefix(`overnight:${tenantId}:handover:`);
    
    if (locationId) {
      handovers = handovers.filter((h: any) => h.locationId === locationId);
    }
    
    if (date) {
      handovers = handovers.filter((h: any) => h.handoverDate === date);
    }
    
    return c.json(handovers);
  } catch (e: any) {
    return internalError(c, 'overnights.getHandovers', e);
  }
});

routes.post("/handovers", async (c) => {
  try {
    const user = c.get('user') as AuthenticatedUser;
    const tenantId = user.tenantId;
    const userInfo = getUserInfo(user);
    const body = await c.req.json();
    
    const handover = {
      ...body,
      id: crypto.randomUUID(),
      tenant_id: tenantId,
      handedOverBy: userInfo.name,
      handedOverById: userInfo.id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    await kv.set(`overnight:${tenantId}:handover:${handover.id}`, handover);
    return c.json(handover);
  } catch (e: any) {
    return internalError(c, 'overnights.postHandovers', e);
  }
});

routes.post("/handovers/:id/acknowledge", async (c) => {
  try {
    const user = c.get('user') as AuthenticatedUser;
    const tenantId = user.tenantId;
    const userInfo = getUserInfo(user);
    const id = c.req.param("id");
    
    const existing = await kv.get(`overnight:${tenantId}:handover:${id}`);
    if (!existing) return c.json({ error: "Handover not found" }, 404);
    
    const updated = {
      ...existing,
      acknowledgedBy: userInfo.name,
      acknowledgedById: userInfo.id,
      acknowledgedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    await kv.set(`overnight:${tenantId}:handover:${id}`, updated);
    return c.json(updated);
  } catch (e: any) {
    return internalError(c, 'overnights.postHandoversIdAcknowledge', e);
  }
});

// ============================================================================
// CAPACITY
// ============================================================================

routes.get("/capacity", async (c) => {
  try {
    const user = c.get('user') as AuthenticatedUser;
    const tenantId = user.tenantId;
    const locationId = c.req.query("locationId");
    
    if (!locationId) {
      return c.json({ error: "locationId required" }, 400);
    }
    
    const capacity = await kv.get(`overnight:${tenantId}:capacity:${locationId}`);
    return c.json(capacity || null);
  } catch (e: any) {
    return internalError(c, 'overnights.getCapacity', e);
  }
});

routes.post("/capacity", async (c) => {
  try {
    const user = c.get('user') as AuthenticatedUser;
    const tenantId = user.tenantId;
    const userInfo = getUserInfo(user);
    const parsed = capacitySchema.safeParse(await c.req.json());
    if (!parsed.success) return validationError(c, parsed);
    const { locationId, ...capacityData } = parsed.data;

    const now = new Date().toISOString();
    const capacity = {
      ...capacityData,
      locationId,
      isActive: true,
      tenant_id: tenantId,
      createdAt: now,
      createdBy: userInfo.name,
      updatedAt: now,
      updatedBy: userInfo.name,
    };
    
    await kv.set(`overnight:${tenantId}:capacity:${locationId}`, capacity);
    return c.json(capacity);
  } catch (e: any) {
    return internalError(c, 'overnights.postCapacity', e);
  }
});

routes.get("/capacity/snapshot", async (c) => {
  try {
    const user = c.get('user') as AuthenticatedUser;
    const tenantId = user.tenantId;
    const locationId = c.req.query("locationId");
    const date = c.req.query("date");
    
    if (!locationId || !date) {
      return c.json({ error: "locationId and date required" }, 400);
    }
    
    // Get capacity
    const capacity = await kv.get(`overnight:${tenantId}:capacity:${locationId}`);
    if (!capacity) {
      return c.json({ error: "Capacity not configured for this location" }, 404);
    }
    
    // Get reservations occupying this NIGHT ([start, end) — the check-out
    // day is a departure morning, not another night).
    const allReservations = await kv.getByPrefix(`overnight:${tenantId}:reservation:`);

    const activeReservations = allReservations.filter((r: any) => {
      if (r.locationId !== locationId) return false;
      if (TERMINAL_OVERNIGHT_STATUSES.has(r.status)) return false;
      return occupiesNight(r.startDate, r.endDate, date);
    });

    const maxCapacity = capacity.maxOvernightCapacity ?? 0;
    const bufferSlots = capacity.bufferSlots ?? 0;
    const effectiveCapacity = Math.max(0, maxCapacity - bufferSlots);
    const snapshot = {
      date,
      locationId,
      maxCapacity,
      bufferSlots,
      effectiveCapacity,
      currentOccupancy: activeReservations.length,
      // Bookable slots: buffer stays in reserve, same rule the booking
      // endpoint enforces.
      availableSlots: effectiveCapacity - activeReservations.length,
      reservations: activeReservations,
    };
    
    return c.json(snapshot);
  } catch (e: any) {
    return internalError(c, 'overnights.getCapacitySnapshot', e);
  }
});

// ============================================================================
// TONIGHT'S BOARDERS
// ============================================================================

routes.get("/tonights-boarders", async (c) => {
  try {
    const user = c.get('user') as AuthenticatedUser;
    const tenantId = user.tenantId;
    const locationId = c.req.query("locationId");
    const date = c.req.query("date") || new Date().toISOString().split('T')[0];
    
    if (!locationId) {
      return c.json({ error: "locationId required" }, 400);
    }
    
    // Get capacity
    const capacity = await kv.get(`overnight:${tenantId}:capacity:${locationId}`);
    const maxCapacity = capacity?.maxOvernightCapacity || 0;
    
    // Get active reservations staying tonight ([start, end) night semantics —
    // a dog checking out this morning is not one of tonight's boarders).
    const allReservations = await kv.getByPrefix(`overnight:${tenantId}:reservation:`);

    const activeReservations = allReservations.filter((r: any) => {
      if (r.locationId !== locationId) return false;
      if (r.status !== 'checked_in' && r.status !== 'in_stay') return false;
      return occupiesNight(r.startDate, r.endDate, date);
    });
    
    // Get care logs for tonight
    const allCareLogs = await kv.getByPrefix(`overnight:${tenantId}:carelog:`);
    const careLogsTonight = allCareLogs.filter((cl: any) => cl.logDate === date);
    
    // Build boarder summaries
    const boarders = activeReservations.map((r: any) => {
      const careLog = careLogsTonight.find((cl: any) => cl.reservationId === r.id);
      
      return {
        reservationId: r.id,
        petId: r.petId,
        petName: r.petName || "Unknown Pet",
        customerId: r.customerId,
        customerName: r.customerName || "Unknown Customer",
        sleepingAreaName: r.sleepingAreaId ? `Area ${r.sleepingAreaId}` : undefined,
        assignedCarerUserId: r.assignedCarerUserId,
        requiresMedication: r.requiresMedication,
        hasBehaviourConcerns: r.hasBehaviourConcerns,
        hasAllergies: r.hasAllergies,
        careLogCompleted: !!careLog,
        specialNotes: r.specialInstructions,
      };
    });
    
    // Count alerts
    const alertsCount = boarders.filter(b => 
      b.requiresMedication || b.hasBehaviourConcerns || b.hasAllergies
    ).length;
    
    const result = {
      date,
      locationId,
      totalInStay: boarders.length,
      maxCapacity,
      alertsCount,
      boarders,
    };
    
    return c.json(result);
  } catch (e: any) {
    console.error("Tonight's boarders error:", e);
    return internalError(c, 'overnights.getTonightsBoarders', e);
  }
});

// ============================================================================
// CARER ALLOCATION
// ============================================================================

routes.get("/carers", async (c) => {
  try {
    const user = c.get('user') as AuthenticatedUser;
    const tenantId = user.tenantId;
    const locationId = c.req.query("locationId");
    const date = c.req.query("date") || new Date().toISOString().split('T')[0];

    if (!locationId) {
      return c.json({ error: "locationId required" }, 400);
    }

    let carers = await kv.getByPrefix(`overnight:${tenantId}:carer:`);

    carers = carers.filter((cr: any) => cr.locationId === locationId);

    const allReservations = await kv.getByPrefix(`overnight:${tenantId}:reservation:`);

    const activeReservations = allReservations.filter((r: any) => {
      if (r.locationId !== locationId) return false;
      if (TERMINAL_OVERNIGHT_STATUSES.has(r.status)) return false;
      return occupiesNight(r.startDate, r.endDate, date);
    });

    const carersWithLoad = carers.map((cr: any) => {
      const assignedDogs = activeReservations.filter((r: any) => r.assignedCarerUserId === cr.userId);
      return {
        userId: cr.userId,
        name: cr.name,
        locationId: cr.locationId,
        maxCapacity: cr.maxCapacity || 6,
        currentLoad: assignedDogs.length,
        isOnRota: cr.isOnRota !== false,
        rotaPublished: cr.rotaPublished !== false,
        assignedReservationIds: assignedDogs.map((r: any) => r.id),
      };
    });

    return c.json(carersWithLoad);
  } catch (e: any) {
    return internalError(c, 'overnights.getCarers', e);
  }
});

routes.post("/assign-carer", async (c) => {
  try {
    const user = c.get('user') as AuthenticatedUser;
    const tenantId = user.tenantId;
    const userInfo = getUserInfo(user);
    const body = await c.req.json();
    const { stayId, carerId } = body;

    if (!stayId || !carerId) {
      return c.json({ error: "stayId and carerId are required" }, 400);
    }

    const reservation = await kv.get(`overnight:${tenantId}:reservation:${stayId}`);
    if (!reservation) {
      return c.json({ error: "Reservation not found" }, 404);
    }

    const carer = await kv.get(`overnight:${tenantId}:carer:${carerId}`);

    if (carer && !carer.isOnRota) {
      return c.json({ error: "Carer is not on the rota for this date" }, 400);
    }

    const allReservations = await kv.getByPrefix(`overnight:${tenantId}:reservation:`);
    const carerLoad = allReservations.filter((r: any) => {
      if (r.assignedCarerUserId !== carerId) return false;
      if (r.id === stayId) return false;
      if (TERMINAL_OVERNIGHT_STATUSES.has(r.status)) return false;
      return occupiesNight(r.startDate, r.endDate, reservation.startDate);
    }).length;

    const maxCapacity = carer?.maxCapacity || 6;
    if (carerLoad >= maxCapacity) {
      return c.json({ error: `Carer has reached maximum capacity (${maxCapacity})` }, 400);
    }

    const now = new Date().toISOString();
    const updated = {
      ...reservation,
      assignedCarerUserId: carerId,
      updatedAt: now,
      updatedBy: userInfo.name,
    };

    await kv.set(`overnight:${tenantId}:reservation:${stayId}`, updated);

    const event = {
      id: crypto.randomUUID(),
      stayId,
      eventType: 'carer_assigned',
      actorUserId: userInfo.id,
      actorName: userInfo.name,
      timestamp: now,
      metadata: { carerId, carerName: carer?.name || carerId },
    };
    await kv.set(`overnight:${tenantId}:event:${event.id}`, event);

    return c.json(updated);
  } catch (e: any) {
    return internalError(c, 'overnights.postAssignCarer', e);
  }
});

routes.put("/assign-carer/:stayId", async (c) => {
  try {
    const user = c.get('user') as AuthenticatedUser;
    const tenantId = user.tenantId;
    const userInfo = getUserInfo(user);
    const stayId = c.req.param("stayId");
    const body = await c.req.json();
    const { carerId } = body;

    if (!carerId) {
      return c.json({ error: "carerId is required" }, 400);
    }

    const reservation = await kv.get(`overnight:${tenantId}:reservation:${stayId}`);
    if (!reservation) {
      return c.json({ error: "Reservation not found" }, 404);
    }

    const previousCarerId = reservation.assignedCarerUserId;
    const carer = await kv.get(`overnight:${tenantId}:carer:${carerId}`);

    if (carer && !carer.isOnRota) {
      return c.json({ error: "Carer is not on the rota for this date" }, 400);
    }

    const allReservations = await kv.getByPrefix(`overnight:${tenantId}:reservation:`);
    const carerLoad = allReservations.filter((r: any) => {
      if (r.assignedCarerUserId !== carerId) return false;
      if (r.id === stayId) return false;
      if (TERMINAL_OVERNIGHT_STATUSES.has(r.status)) return false;
      return occupiesNight(r.startDate, r.endDate, reservation.startDate);
    }).length;

    const maxCapacity = carer?.maxCapacity || 6;
    if (carerLoad >= maxCapacity) {
      return c.json({ error: `Carer has reached maximum capacity (${maxCapacity})` }, 400);
    }

    const now = new Date().toISOString();
    const updated = {
      ...reservation,
      assignedCarerUserId: carerId,
      updatedAt: now,
      updatedBy: userInfo.name,
    };

    await kv.set(`overnight:${tenantId}:reservation:${stayId}`, updated);

    const event = {
      id: crypto.randomUUID(),
      stayId,
      eventType: 'carer_reassigned',
      actorUserId: userInfo.id,
      actorName: userInfo.name,
      timestamp: now,
      metadata: { previousCarerId, newCarerId: carerId, carerName: carer?.name || carerId },
    };
    await kv.set(`overnight:${tenantId}:event:${event.id}`, event);

    return c.json(updated);
  } catch (e: any) {
    return internalError(c, 'overnights.putAssignCarerStayId', e);
  }
});

// ============================================================================
// BILLING
// ============================================================================

routes.post("/calculate-billing", async (c) => {
  try {
    const user = c.get('user') as AuthenticatedUser;
    const tenantId = user.tenantId;
    const userInfo = getUserInfo(user);
    const body = await c.req.json();
    const { reservationId } = body;

    // Two modes: price an existing reservation by id, or PREVIEW a prospective
    // stay from raw fields (petId/locationId/startDate/endDate) before it's
    // created. The create dialog uses preview, so a missing id is not an error.
    let reservation: any;
    if (reservationId) {
      reservation = await kv.get(`overnight:${tenantId}:reservation:${reservationId}`);
      if (!reservation) {
        return c.json({ error: "Reservation not found" }, 404);
      }
    } else {
      if (!body.startDate || !body.endDate) {
        return c.json({ error: "startDate and endDate are required" }, 400);
      }
      reservation = {
        petId: body.petId,
        locationId: body.locationId,
        startDate: body.startDate,
        endDate: body.endDate,
        // Preview at the location's configured nightly rate.
        pricePerNight: await nightlyRateFor(tenantId, body.locationId),
        currency: body.currency || 'GBP',
      };
    }

    const startDate = new Date(reservation.startDate);
    const endDate = new Date(reservation.endDate);
    const totalNights = Math.max(1, Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)));
    const pricePerNight = reservation.pricePerNight || 0;
    const currency = reservation.currency || 'GBP';

    const lineItems: any[] = [];
    for (let i = 0; i < totalNights; i++) {
      const nightDate = new Date(startDate);
      nightDate.setDate(nightDate.getDate() + i);
      lineItems.push({
        description: `Overnight boarding - ${nightDate.toISOString().split('T')[0]}`,
        quantity: 1,
        unitPrice: pricePerNight,
        total: pricePerNight,
        date: nightDate.toISOString().split('T')[0],
      });
    }

    const subtotal = pricePerNight * totalNights;

    const allDaycareBookings = await kv.getByPrefix(`daycare:booking:`);
    const overlappingDaycareBookings = allDaycareBookings.filter((db: any) => {
      const dbPetId = db.pet_id || db.petId;
      const dbLocationId = db.location_id || db.locationId;
      if (dbPetId !== reservation.petId) return false;
      if (dbLocationId !== reservation.locationId) return false;
      // Overlap deduction applies to the stay's NIGHTS [start, end) — a
      // daycare booking on the check-out day is a separate service, not an
      // overlap (the dog left that morning).
      const dbDate = new Date(db.booking_date || db.date || db.bookingDate);
      return dbDate >= startDate && dbDate < endDate;
    });

    let daycareDeduction = 0;
    if (overlappingDaycareBookings.length > 0) {
      overlappingDaycareBookings.forEach((db: any) => {
        const deductionAmount = Math.min(db.price || 0, pricePerNight * 0.5);
        if (deductionAmount > 0) {
          daycareDeduction += deductionAmount;
          lineItems.push({
            description: `Daycare overlap adjustment - ${db.date || db.bookingDate}`,
            quantity: 1,
            unitPrice: -deductionAmount,
            total: -deductionAmount,
            date: db.date || db.bookingDate,
          });
        }
      });
    }

    const adjustedSubtotal = subtotal - daycareDeduction;
    const taxRate = 0.20;
    const tax = Math.round(adjustedSubtotal * taxRate * 100) / 100;
    const total = Math.round((adjustedSubtotal + tax) * 100) / 100;

    const billing = {
      reservationId,
      totalNights,
      pricePerNight,
      subtotal: adjustedSubtotal,
      tax,
      total,
      currency,
      lineItems,
      daycareOverlapDeduction: daycareDeduction,
    };

    const event = {
      id: crypto.randomUUID(),
      stayId: reservationId,
      eventType: 'billing_calculated',
      actorUserId: userInfo.id,
      actorName: userInfo.name,
      timestamp: new Date().toISOString(),
      metadata: { total, currency, totalNights },
    };
    await kv.set(`overnight:${tenantId}:event:${event.id}`, event);

    return c.json(billing);
  } catch (e: any) {
    return internalError(c, 'overnights.postCalculateBilling', e);
  }
});

// ============================================================================
// TRANSITIONS (Daycare <-> Overnight)
// ============================================================================

routes.post("/transition/daycare-to-overnight", async (c) => {
  try {
    const user = c.get('user') as AuthenticatedUser;
    const tenantId = user.tenantId;
    const userInfo = getUserInfo(user);
    const body = await c.req.json();
    const { petId, daycareBookingId, locationId, reservationId, assignedCarerUserId, specialInstructions } = body;
    
    if (!petId || !locationId) {
      return c.json({ error: "petId and locationId are required" }, 400);
    }
    
    if (daycareBookingId) {
      const daycareBooking = await kv.get(`daycare:booking:${daycareBookingId}`);
      if (daycareBooking && (daycareBooking.status === 'checked_in' || daycareBooking.status === 'in_progress')) {
        const now = new Date().toISOString();
        const updatedDaycare = {
          ...daycareBooking,
          status: 'checked_out',
          check_out_time: now,
          checkout_notes: 'Transitioned to overnight stay',
          updatedAt: now,
        };
        await kv.set(`daycare:booking:${daycareBookingId}`, updatedDaycare);
        
        const attendanceId = await kv.get(`daycare:attendance:booking:${daycareBookingId}`);
        if (attendanceId) {
          const attendance = await kv.get(`daycare:attendance:${attendanceId}`);
          if (attendance) {
            attendance.status = 'checked_out';
            attendance.check_out_time = now;
            await kv.set(`daycare:attendance:${attendanceId}`, attendance);
            await kv.del(`daycare:attendance:active:${locationId}:${attendanceId}`);
          }
        }
      }
    }
    
    const now = new Date().toISOString();
    let overnightReservation;
    
    if (reservationId) {
      overnightReservation = await kv.get(`overnight:${tenantId}:reservation:${reservationId}`);
      if (!overnightReservation) {
        return c.json({ error: "Overnight reservation not found" }, 404);
      }
      overnightReservation = {
        ...overnightReservation,
        status: 'checked_in',
        actualCheckInTime: now,
        checkedInBy: userInfo.name,
        checkedInById: userInfo.id,
        daycareBookingId,
        assignedCarerUserId: assignedCarerUserId || overnightReservation.assignedCarerUserId,
        updatedAt: now,
        updatedBy: userInfo.name,
      };
    } else {
      const today = new Date().toISOString().split('T')[0];
      const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];

      // A transitioning dog is already on site, so it may spend the
      // emergency buffer — but never exceed the hard maximum.
      const fullNight = await findFullNight({
        tenantId,
        locationId,
        startDate: today,
        endDate: tomorrow,
        useBuffer: true,
      });
      if (fullNight) {
        return c.json({ error: `No overnight capacity left tonight (maximum ${fullNight.capacity})` }, 409);
      }

      // Server-priced from the location's configured rate — a transition is
      // not a way around the price lock.
      const pricePerNight = await nightlyRateFor(tenantId, locationId);

      overnightReservation = {
        id: crypto.randomUUID(),
        petId,
        locationId,
        customerId: body.customerId || '',
        householdId: body.householdId || '',
        petName: body.petName || '',
        customerName: body.customerName || '',
        startDate: today,
        endDate: tomorrow,
        status: 'checked_in',
        actualCheckInTime: now,
        checkedInBy: userInfo.name,
        checkedInById: userInfo.id,
        daycareBookingId,
        assignedCarerUserId,
        specialInstructions: specialInstructions || '',
        requiresMedication: body.requiresMedication || false,
        hasBehaviourConcerns: body.hasBehaviourConcerns || false,
        hasAllergies: body.hasAllergies || false,
        pricePerNight,
        totalNights: 1,
        totalPrice: pricePerNight,
        currency: body.currency || 'GBP',
        priceLockedAt: now,
        requiresPickup: false,
        requiresDropOff: false,
        tenant_id: tenantId,
        createdAt: now,
        createdBy: userInfo.name,
        updatedAt: now,
        updatedBy: userInfo.name,
      };
    }
    
    await kv.set(`overnight:${tenantId}:reservation:${overnightReservation.id}`, overnightReservation);
    
    await recordEvent(tenantId, overnightReservation.id, 'transitioned_from_daycare', userInfo.id, userInfo.name, {
      daycareBookingId,
      petId,
      locationId,
      assignedCarerUserId,
    });
    
    return c.json(overnightReservation);
  } catch (e: any) {
    console.error("Daycare-to-overnight transition error:", e);
    return internalError(c, 'overnights.postTransitionDaycareToOvernight', e);
  }
});

routes.post("/transition/overnight-to-daycare", async (c) => {
  try {
    const user = c.get('user') as AuthenticatedUser;
    const tenantId = user.tenantId;
    const userInfo = getUserInfo(user);
    const body = await c.req.json();
    const { reservationId } = body;
    
    if (!reservationId) {
      return c.json({ error: "reservationId is required" }, 400);
    }
    
    const reservation = await kv.get(`overnight:${tenantId}:reservation:${reservationId}`);
    if (!reservation) {
      return c.json({ error: "Reservation not found" }, 404);
    }
    
    if (reservation.status !== 'checked_in' && reservation.status !== 'in_stay') {
      return c.json({ error: "Reservation must be checked in or in stay to transition to daycare" }, 400);
    }
    
    const now = new Date().toISOString();
    const today = new Date().toISOString().split('T')[0];
    
    const updatedReservation = {
      ...reservation,
      status: 'checked_out',
      actualCheckOutTime: now,
      checkedOutBy: userInfo.name,
      checkedOutById: userInfo.id,
      billingRecalculationRequired: true,
      updatedAt: now,
      updatedBy: userInfo.name,
    };
    await kv.set(`overnight:${tenantId}:reservation:${reservationId}`, updatedReservation);
    
    const daycareBookingId = `daycare-from-overnight-${crypto.randomUUID()}`;
    const daycareBooking = {
      id: daycareBookingId,
      pet_id: reservation.petId,
      pet_name: reservation.petName || '',
      customer_id: reservation.customerId || '',
      customer_name: reservation.customerName || '',
      household_id: reservation.householdId || '',
      location_id: reservation.locationId,
      date: today,
      status: 'confirmed',
      booking_type: 'full_day',
      notes: `Transitioned from overnight stay (reservation: ${reservationId})`,
      source_overnight_reservation_id: reservationId,
      created_at: now,
      updated_at: now,
      created_by: userInfo.name,
    };
    await kv.set(`daycare:booking:${daycareBookingId}`, daycareBooking);
    
    await recordEvent(tenantId, reservationId, 'transitioned_to_daycare', userInfo.id, userInfo.name, {
      daycareBookingId,
      petId: reservation.petId,
      locationId: reservation.locationId,
    });
    
    return c.json({ reservation: updatedReservation, daycareBooking });
  } catch (e: any) {
    console.error("Overnight-to-daycare transition error:", e);
    return internalError(c, 'overnights.postTransitionOvernightToDaycare', e);
  }
});

// ============================================================================
// EVENTS (Audit Trail)
// ============================================================================

routes.get("/events", async (c) => {
  try {
    const user = c.get('user') as AuthenticatedUser;
    const tenantId = user.tenantId;
    const stayId = c.req.query("stayId");
    
    let events = await kv.getByPrefix(`overnight:${tenantId}:event:`);
    
    if (stayId) {
      events = events.filter((e: any) => e.stayId === stayId);
    }
    
    events.sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    
    return c.json(events);
  } catch (e: any) {
    return internalError(c, 'overnights.getEvents', e);
  }
});

routes.post("/events", async (c) => {
  try {
    const user = c.get('user') as AuthenticatedUser;
    const tenantId = user.tenantId;
    const userInfo = getUserInfo(user);
    const body = await c.req.json();
    const { stayId, eventType, metadata } = body;
    
    if (!stayId || !eventType) {
      return c.json({ error: "stayId and eventType are required" }, 400);
    }
    
    const event = await recordEvent(tenantId, stayId, eventType, userInfo.id, userInfo.name, metadata);
    
    return c.json(event);
  } catch (e: any) {
    return internalError(c, 'overnights.postEvents', e);
  }
});

// ============================================================================
// STATS
// ============================================================================

routes.get("/stats", async (c) => {
  try {
    const user = c.get('user') as AuthenticatedUser;
    const tenantId = user.tenantId;
    const locationId = c.req.query("locationId");
    const date = c.req.query("date") || new Date().toISOString().split('T')[0];
    
    let reservations = await kv.getByPrefix(`overnight:${tenantId}:reservation:`);
    
    if (locationId) {
      reservations = reservations.filter((r: any) => r.locationId === locationId);
    }
    
    // Filter to reservations occupying this night ([start, end) semantics).
    const activeToday = reservations.filter((r: any) => occupiesNight(r.startDate, r.endDate, date));
    
    const stats = {
      date,
      locationId: locationId || 'all',
      total_reservations: activeToday.length,
      checked_in: activeToday.filter((r: any) => r.status === 'checked_in' || r.status === 'in_stay').length,
      checked_out: activeToday.filter((r: any) => r.status === 'checked_out').length,
      pending: activeToday.filter((r: any) => r.status === 'confirmed').length,
      cancelled: reservations.filter((r: any) => r.status === 'cancelled').length,
    };
    
    return c.json(stats);
  } catch (e: any) {
    return internalError(c, 'overnights.getStats', e);
  }
});

export default routes;
