import { z } from "zod";

export const serviceEnum = z.enum(["daycare", "grooming", "overnights", "transport"]);

export const newBookingRequestSchema = z.object({
  service: serviceEnum,
  petIds: z.array(z.string().min(1)).min(1).max(10),
  startAt: z.string().datetime(),
  endAt: z.string().datetime(),
  notes: z.string().max(500).nullable(),
  requestId: z.string().uuid(),
}).refine(d => new Date(d.endAt) > new Date(d.startAt), {
  message: "endAt must be after startAt",
  path: ["endAt"],
});

export type NewBookingRequest = z.infer<typeof newBookingRequestSchema>;
