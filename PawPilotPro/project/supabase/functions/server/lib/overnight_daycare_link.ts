// Overnight → check-out-morning daycare link: the kv-backed applier on top of
// overnight_daycare_semantics.ts. Creates the linked daycare booking when a
// reservation asks for it, and cancels it again when the reservation is
// cancelled. Mirrors the staff daycare create path's record + index + capacity
// writes (same shapes portal_bookings' daycare bridge replicates), priced as a
// normal PAYG daycare day from the pricing:service record.
//
// Both entry points are NON-FATAL: the overnight reservation is the primary
// record and is already written — a failed daycare leg logs loudly with a
// correlation ID and reports a warning instead of failing the request.

import * as kv from "../kv_store.tsx";
import { logError, logInfo, logWarn } from "../_shared/log.ts";
import { storedPetPhoto } from "./pet_photos.ts";
import {
  decideMorningDaycare,
  MORNING_DAYCARE_SERVICES,
  morningAfterDate,
  type MorningDaycareChoice,
} from "./overnight_daycare_semantics.ts";

export interface MorningDaycareResult {
  status: "created" | "skipped_duplicate" | "skipped_full" | "skipped_error";
  bookingId?: string;
  warning?: string;
}

interface LinkReservation {
  id: string;
  petId: string;
  householdId: string;
  locationId: string;
  endDate: string;
}

const FALLBACK_MAX_CAPACITY = 19; // daycare_routes' FALLBACK_LOCATION_CAPACITY

export async function createMorningAfterDaycare(
  tenantId: string,
  userInfo: { id: string; name: string },
  reservation: LinkReservation,
  choice: MorningDaycareChoice,
): Promise<MorningDaycareResult> {
  try {
    const { petId, householdId, locationId } = reservation;
    const date = morningAfterDate(reservation);
    const svc = MORNING_DAYCARE_SERVICES[choice];

    const pet = await kv.get(`customer:${tenantId}:pet:${householdId}:${petId}`);
    if (!pet) {
      logWarn("overnights.morningDaycare.petNotFound", { reservationId: reservation.id, petId });
      return {
        status: "skipped_error",
        warning: "The check-out morning daycare day could not be booked (pet profile not found).",
      };
    }
    const household = await kv.get(`customer:${tenantId}:household:${householdId}`);
    const location = await kv.get(`location:${locationId}`);

    // Same record filter as the staff create route: prefix scan hits index
    // keys (bare id strings) too — only real booking records count.
    const allBookingRecords = await kv.getByPrefix("daycare:booking:");
    const existingBookings = allBookingRecords.filter(
      (b: unknown): b is Record<string, unknown> =>
        !!b && typeof b === "object" && "id" in b && "pet_name" in b,
    );

    const capKey = `daycare:capacity:${locationId}:${date}`;
    const cap = await kv.get(capKey);
    const decision = decideMorningDaycare({
      existingBookings,
      capacity: {
        max_capacity: cap?.max_capacity ?? location?.capacity?.maxDogs ?? FALLBACK_MAX_CAPACITY,
        current_bookings: cap?.current_bookings ?? 0,
      },
      petId,
      petName: pet.name ?? "This dog",
      locationId,
      date,
      choice,
    });
    if (decision.outcome !== "create") {
      logInfo("overnights.morningDaycare.skipped", {
        reservationId: reservation.id,
        outcome: decision.outcome,
        date,
      });
      return {
        status: decision.outcome === "skip_duplicate" ? "skipped_duplicate" : "skipped_full",
        bookingId: decision.outcome === "skip_duplicate" ? decision.existingBookingId : undefined,
        warning: decision.warning,
      };
    }

    // Normal PAYG daycare pricing — same source and fallbacks as the staff
    // create route. No membership draw: staff can rebill through the daycare
    // dashboard if the household wants credits used.
    const service = await kv.get(`pricing:service:${svc.serviceId}`);
    const basePrice = service?.base_price || svc.fallbackPrice;
    const taxRate = service?.tax_rate || 0.077;

    // Waiver status stamped the same way the staff create route does.
    const householdDocs = await kv.getByPrefix(`customer:${tenantId}:document:`);
    const waiverDoc = householdDocs.find(
      (d: { household_id?: string; document_type?: string }) =>
        d.household_id === householdId && d.document_type === "waiver",
    );
    let waiverStatus: "valid" | "expiring_soon" | "expired" | "missing" = "missing";
    if (waiverDoc?.expiry_date) {
      const daysDiff = Math.floor(
        (new Date(waiverDoc.expiry_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
      );
      waiverStatus = daysDiff < 0 ? "expired" : daysDiff < 30 ? "expiring_soon" : "valid";
    }

    // Stable id per reservation+pet, portal-bridge style, so a retried create
    // can't mint two bookings for the same stay.
    const bookingId = `daybook_ovn_${reservation.id.slice(0, 8)}_${petId.slice(0, 6)}`;
    const now = new Date().toISOString();
    const booking = {
      id: bookingId,
      tenant_id: tenantId,
      household_id: householdId,
      household_name: household?.name ?? "Household",
      pet_id: petId,
      pet_name: pet.name ?? "Pet",
      pet_photo_url: storedPetPhoto(pet),
      location_id: locationId,
      location_name: location?.name ?? "Location",
      service_id: svc.serviceId,
      service_name: svc.serviceName,
      service_type: svc.serviceType,
      booking_date: date,
      planned_start_time: svc.start,
      planned_end_time: svc.end,
      booking_status: "confirmed" as const,
      check_in_status: "not_checked_in" as const,
      customer_notes: null,
      has_behaviour_flag: !!pet.behaviour_notes,
      has_medical_flag: !!pet.medical_notes,
      behaviour_notes: pet.behaviour_notes ?? null,
      medical_notes: pet.medical_notes ?? null,
      vaccination_status: pet.vaccination_status ?? "unknown",
      waiver_status: waiverStatus,
      has_booking_hold: household?.booking_hold === true,
      has_payment_hold: household?.payment_hold === true,
      hold_reason: household?.hold_reason ?? null,
      base_price_locked: basePrice,
      tax_rate: taxRate,
      total_price: basePrice * (1 + taxRate),
      currency: "CHF",
      billing_line_item_ids: [] as string[],
      requires_transport: false,
      // Two-way link: the reservation stores morningDaycareBookingId; the
      // booking points back so both sides render and cancel together.
      source: "overnight_checkout" as const,
      overnight_reservation_id: reservation.id,
      created_by_id: userInfo.id,
      created_by_name: userInfo.name,
      created_at: now,
      updated_at: now,
    };

    await kv.set(`daycare:booking:${bookingId}`, booking);
    // Index keys mirror the staff create handler — dashboard list views and
    // per-pet/household lookups see this booking like any other.
    await kv.set(`daycare:booking:date:${locationId}:${date}:${bookingId}`, bookingId);
    await kv.set(`daycare:booking:pet:${petId}:${bookingId}`, bookingId);
    await kv.set(`daycare:booking:household:${householdId}:${bookingId}`, bookingId);

    const capacity = cap ?? {
      id: `cap_${locationId}_${date}`,
      location_id: locationId,
      date,
      max_capacity: location?.capacity?.maxDogs ?? FALLBACK_MAX_CAPACITY,
      current_bookings: 0,
    };
    capacity.current_bookings = (capacity.current_bookings ?? 0) + 1;
    capacity.available_slots = Math.max(
      0,
      (capacity.max_capacity ?? FALLBACK_MAX_CAPACITY) - capacity.current_bookings,
    );
    capacity.is_full = capacity.available_slots <= 0;
    capacity.updated_at = now;
    await kv.set(capKey, capacity);

    logInfo("overnights.morningDaycare.created", {
      reservationId: reservation.id,
      bookingId,
      date,
      choice,
    });
    return { status: "created", bookingId };
  } catch (err) {
    logError("overnights.morningDaycare.failed", err, { reservationId: reservation.id });
    return {
      status: "skipped_error",
      warning: "The check-out morning daycare day could not be booked — book it manually from Daycare.",
    };
  }
}

/**
 * Cancel the linked check-out-morning daycare booking when its overnight
 * reservation is cancelled. Only touches bookings this link created (source
 * overnight_checkout) that haven't started: a checked-in or staff-progressed
 * day is left alone.
 */
export async function cancelLinkedMorningDaycare(
  userInfo: { id: string; name: string },
  reservation: { id: string; morningDaycareBookingId?: string },
): Promise<void> {
  const bookingId = reservation.morningDaycareBookingId;
  if (!bookingId) return;
  try {
    const booking = await kv.get(`daycare:booking:${bookingId}`);
    if (
      !booking ||
      booking.source !== "overnight_checkout" ||
      booking.overnight_reservation_id !== reservation.id ||
      booking.booking_status === "cancelled" ||
      booking.booking_status === "completed" ||
      booking.check_in_status !== "not_checked_in"
    ) {
      return;
    }

    const now = new Date().toISOString();
    booking.booking_status = "cancelled";
    booking.cancelled_at = now;
    booking.cancelled_by_id = userInfo.id;
    booking.cancelled_by_name = userInfo.name;
    booking.cancellation_reason = "Linked overnight reservation cancelled";
    booking.updated_at = now;
    await kv.set(`daycare:booking:${bookingId}`, booking);

    // Free the slot, mirroring the daycare cancel route's capacity handling.
    const capKey = `daycare:capacity:${booking.location_id}:${booking.booking_date}`;
    const capacity = await kv.get(capKey);
    if (capacity) {
      capacity.current_bookings = Math.max(0, (capacity.current_bookings ?? 0) - 1);
      capacity.available_slots = Math.max(
        0,
        (capacity.max_capacity ?? FALLBACK_MAX_CAPACITY) - capacity.current_bookings,
      );
      capacity.is_full = false;
      capacity.updated_at = now;
      await kv.set(capKey, capacity);
    }

    logInfo("overnights.morningDaycare.cancelled", {
      reservationId: reservation.id,
      bookingId,
    });
  } catch (err) {
    logError("overnights.morningDaycare.cancelFailed", err, {
      reservationId: reservation.id,
      bookingId,
    });
  }
}
