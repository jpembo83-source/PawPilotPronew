import { z } from "zod";

// ============================================================================
// Transport module schemas — canonical definitions.
// The Deno edge function keeps a runtime-side mirror in
// project/supabase/functions/server/transport_routes.tsx (same pattern as
// shared/schemas/booking.ts ↔ portal_bookings.ts). Keep the two in sync.
// ============================================================================

export const transportDirectionEnum = z.enum(["pickup", "dropoff", "roundtrip"]);

// 'failed' is a driver-reported unsuccessful attempt (customer not home,
// wrong address, …). Distinct from 'cancelled' (dispatcher/manager decision)
// so failed stops remain visible and re-schedulable.
export const transportJobStatusEnum = z.enum([
  "scheduled",
  "in_progress",
  "completed",
  "failed",
  "cancelled",
]);

export const transportStatusEventEnum = z.enum([
  "started",
  "arrived",
  "picked_up",
  "dropped_off",
  "completed",
  "failed",
  "cancelled",
]);

export const bookingTypeEnum = z.enum(["daycare", "grooming", "overnight"]);

const serviceDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "expected YYYY-MM-DD");

const timeOfDay = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "expected HH:MM");

const optionalTime = timeOfDay.nullable().optional();

/** start < end whenever both ends of the window are provided. */
function timeWindowOrdered(d: {
  time_window_start?: string | null;
  time_window_end?: string | null;
}): boolean {
  if (!d.time_window_start || !d.time_window_end) return true;
  return d.time_window_start < d.time_window_end;
}

export const createTransportJobSchema = z
  .object({
    location_id: z.string().min(1),
    service_date: serviceDate,
    direction: transportDirectionEnum,
    household_id: z.string().min(1),
    pet_id: z.string().min(1),
    address_pickup: z.string().max(500).nullable().optional(),
    address_dropoff: z.string().max(500).nullable().optional(),
    time_window_start: optionalTime,
    time_window_end: optionalTime,
    notes: z.string().max(2000).nullable().optional(),
    booking_id: z.string().max(200).nullable().optional(),
    booking_type: bookingTypeEnum.nullable().optional(),
    driver_user_id: z.string().max(200).nullable().optional(),
    vehicle_id: z.string().max(200).nullable().optional(),
  })
  .refine((d) => !!(d.address_pickup?.trim() || d.address_dropoff?.trim()), {
    message: "At least one address (pickup or dropoff) is required",
    path: ["address_pickup"],
  })
  .refine(timeWindowOrdered, {
    message: "time_window_start must be before time_window_end",
    path: ["time_window_end"],
  });

/**
 * PATCH whitelist. Deliberately excludes id, tenant_id, created_by,
 * created_at and location_id (a job never moves between locations — delete
 * and recreate instead; this keeps the per-location KV indexes consistent).
 * .strict() rejects any key outside the whitelist (mass-assignment guard).
 */
export const updateTransportJobSchema = z
  .object({
    service_date: serviceDate.optional(),
    direction: transportDirectionEnum.optional(),
    status: transportJobStatusEnum.optional(),
    address_pickup: z.string().max(500).nullable().optional(),
    address_dropoff: z.string().max(500).nullable().optional(),
    time_window_start: optionalTime,
    time_window_end: optionalTime,
    assigned_driver_user_id: z.string().max(200).nullable().optional(),
    assigned_vehicle_id: z.string().max(200).nullable().optional(),
    notes: z.string().max(2000).nullable().optional(),
  })
  .strict()
  .refine(timeWindowOrdered, {
    message: "time_window_start must be before time_window_end",
    path: ["time_window_end"],
  });

export const assignTransportJobSchema = z.object({
  vehicle_id: z.string().min(1),
  // Optional: when omitted the server falls back to the vehicle's default
  // driver (assigned_driver_user_id on the vehicle record).
  driver_user_id: z.string().max(200).nullable().optional(),
});

export const transportStatusUpdateSchema = z.object({
  event_type: transportStatusEventEnum,
  notes: z.string().max(2000).nullable().optional(),
});

export const createVehicleSchema = z.object({
  location_id: z.string().min(1),
  name: z.string().min(1).max(100),
  licence_plate: z.string().min(1).max(20),
  capacity: z.number().int().min(1).max(50),
  notes: z.string().max(2000).nullable().optional(),
  assigned_driver_user_id: z.string().max(200).nullable().optional(),
  is_active: z.boolean().optional(),
});

/** PATCH whitelist for vehicles — excludes id/tenant_id/created_at. */
export const updateVehicleSchema = z
  .object({
    location_id: z.string().min(1).optional(),
    name: z.string().min(1).max(100).optional(),
    licence_plate: z.string().min(1).max(20).optional(),
    capacity: z.number().int().min(1).max(50).optional(),
    notes: z.string().max(2000).nullable().optional(),
    assigned_driver_user_id: z.string().max(200).nullable().optional(),
    is_active: z.boolean().optional(),
  })
  .strict();

export type CreateTransportJobInput = z.infer<typeof createTransportJobSchema>;
export type UpdateTransportJobInput = z.infer<typeof updateTransportJobSchema>;
export type AssignTransportJobInput = z.infer<typeof assignTransportJobSchema>;
export type TransportStatusUpdateInput = z.infer<typeof transportStatusUpdateSchema>;
export type CreateVehicleInput = z.infer<typeof createVehicleSchema>;
export type UpdateVehicleInput = z.infer<typeof updateVehicleSchema>;
