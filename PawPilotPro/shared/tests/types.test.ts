import { describe, it, expectTypeOf } from "vitest";
import type { Booking, BookingStatus, Service, Pet, Customer, Vaccination, NotificationEvent } from "../types";

describe("shared types", () => {
  it("Booking has status union", () => {
    expectTypeOf<BookingStatus>().toEqualTypeOf<"pending" | "confirmed" | "declined" | "cancelled">();
  });
  it("Service has 4 members", () => {
    expectTypeOf<Service>().toEqualTypeOf<"daycare" | "grooming" | "overnights" | "transport">();
  });
  it("Pet has required fields", () => {
    const p: Pet = { id: "p1", customerId: "c1", name: "Bella", breed: "Lab", dob: "2020-01-01", weightKg: 22, photoUrl: null, notes: null, tenantId: "t1" };
    expectTypeOf<typeof p>().toMatchTypeOf<Pet>();
  });
});
