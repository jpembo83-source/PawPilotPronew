import { z } from "zod";

export const serviceEnum = z.enum(["daycare", "grooming", "overnights", "transport"]);

/** One line item inside a bundle — same shape as a standalone booking minus the wrapping fields. */
export const serviceRequestSchema = z
  .object({
    service: serviceEnum,
    petIds: z.array(z.string().min(1)).min(1).max(10),
    startAt: z.string().datetime(),
    endAt: z.string().datetime(),
  })
  .refine((d) => new Date(d.endAt) > new Date(d.startAt), {
    message: "endAt must be after startAt",
    path: ["endAt"],
  });

/**
 * POST /portal/bookings — accepts EITHER the original single-service shape
 * (back-compat for clients that haven't been updated) OR a bundle with
 * 2-4 service requests that the staff approves atomically.
 *
 * Discriminated by the presence of `bundle`. Validation rules:
 *   - single: requires service + petIds + startAt + endAt at top level
 *   - bundle: requires bundle[] (2-4 items); top-level service/dates absent
 *   - both forms share notes + requestId
 *
 * The server preserves idempotency on requestId across both shapes.
 */
export const newBookingRequestSchema = z.union([
  // Single — old shape, untouched
  z
    .object({
      service: serviceEnum,
      petIds: z.array(z.string().min(1)).min(1).max(10),
      startAt: z.string().datetime(),
      endAt: z.string().datetime(),
      notes: z.string().max(500).nullable(),
      requestId: z.string().uuid(),
      bundle: z.undefined(),
    })
    .refine((d) => new Date(d.endAt) > new Date(d.startAt), {
      message: "endAt must be after startAt",
      path: ["endAt"],
    }),
  // Bundle — new shape
  z.object({
    bundle: z.array(serviceRequestSchema).min(2).max(4),
    notes: z.string().max(500).nullable(),
    requestId: z.string().uuid(),
    service: z.undefined(),
    petIds: z.undefined(),
    startAt: z.undefined(),
    endAt: z.undefined(),
  }),
]);

export type ServiceRequest = z.infer<typeof serviceRequestSchema>;
export type NewBookingRequest = z.infer<typeof newBookingRequestSchema>;
