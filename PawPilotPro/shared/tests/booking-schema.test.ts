import { describe, it, expect } from "vitest";
import { newBookingRequestSchema } from "../schemas/booking";

describe("newBookingRequestSchema", () => {
  it("accepts a valid daycare request", () => {
    const r = newBookingRequestSchema.safeParse({
      service: "daycare",
      petIds: ["p1"],
      startAt: "2026-06-01T08:00:00.000Z",
      endAt: "2026-06-01T17:00:00.000Z",
      notes: null,
      // zod v4's .uuid() enforces RFC 4122 version/variant bits, so fixtures
      // must be structurally valid v4 UUIDs (clients use crypto.randomUUID()).
      requestId: "11111111-1111-4111-8111-111111111111",
    });
    expect(r.success).toBe(true);
  });
  it("rejects empty petIds", () => {
    const r = newBookingRequestSchema.safeParse({
      service: "daycare",
      petIds: [],
      startAt: "2026-06-01T08:00:00.000Z",
      endAt: "2026-06-01T17:00:00.000Z",
      notes: null,
      // zod v4's .uuid() enforces RFC 4122 version/variant bits, so fixtures
      // must be structurally valid v4 UUIDs (clients use crypto.randomUUID()).
      requestId: "11111111-1111-4111-8111-111111111111",
    });
    expect(r.success).toBe(false);
  });
  it("rejects endAt before startAt", () => {
    const r = newBookingRequestSchema.safeParse({
      service: "grooming",
      petIds: ["p1"],
      startAt: "2026-06-01T17:00:00.000Z",
      endAt: "2026-06-01T08:00:00.000Z",
      notes: null,
      // zod v4's .uuid() enforces RFC 4122 version/variant bits, so fixtures
      // must be structurally valid v4 UUIDs (clients use crypto.randomUUID()).
      requestId: "11111111-1111-4111-8111-111111111111",
    });
    expect(r.success).toBe(false);
  });
});
