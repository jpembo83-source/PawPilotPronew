import { describe, it, expect } from "vitest";
import {
  createTransportJobSchema,
  updateTransportJobSchema,
  assignTransportJobSchema,
  transportStatusUpdateSchema,
  createVehicleSchema,
  updateVehicleSchema,
} from "../schemas/transport";

const validJob = {
  location_id: "loc1",
  service_date: "2026-07-20",
  direction: "pickup",
  household_id: "hh1",
  pet_id: "pet1",
  address_pickup: "123 Test Street, London",
  address_dropoff: null,
  time_window_start: "08:00",
  time_window_end: "09:30",
  notes: null,
};

describe("createTransportJobSchema", () => {
  it("accepts a valid pickup job", () => {
    expect(createTransportJobSchema.safeParse(validJob).success).toBe(true);
  });

  it("rejects a job with no address at all", () => {
    const r = createTransportJobSchema.safeParse({
      ...validJob,
      address_pickup: "  ",
      address_dropoff: null,
    });
    expect(r.success).toBe(false);
  });

  it("rejects an inverted time window", () => {
    const r = createTransportJobSchema.safeParse({
      ...validJob,
      time_window_start: "10:00",
      time_window_end: "09:00",
    });
    expect(r.success).toBe(false);
  });

  it("rejects a malformed service_date", () => {
    const r = createTransportJobSchema.safeParse({
      ...validJob,
      service_date: "20/07/2026",
    });
    expect(r.success).toBe(false);
  });

  it("rejects an unknown direction", () => {
    const r = createTransportJobSchema.safeParse({
      ...validJob,
      direction: "sideways",
    });
    expect(r.success).toBe(false);
  });
});

describe("updateTransportJobSchema (mass-assignment guard)", () => {
  it("accepts whitelisted fields", () => {
    const r = updateTransportJobSchema.safeParse({
      service_date: "2026-07-21",
      notes: "Gate code 1234",
    });
    expect(r.success).toBe(true);
  });

  it.each(["id", "tenant_id", "created_by", "location_id"])(
    "rejects attempts to set %s",
    (field) => {
      const r = updateTransportJobSchema.safeParse({ [field]: "evil" });
      expect(r.success).toBe(false);
    },
  );

  it("rejects an unknown status", () => {
    const r = updateTransportJobSchema.safeParse({ status: "teleported" });
    expect(r.success).toBe(false);
  });
});

describe("assignTransportJobSchema", () => {
  it("requires a vehicle", () => {
    expect(assignTransportJobSchema.safeParse({}).success).toBe(false);
  });

  it("allows omitting the driver (vehicle default-driver fallback)", () => {
    const r = assignTransportJobSchema.safeParse({ vehicle_id: "v1" });
    expect(r.success).toBe(true);
  });
});

describe("transportStatusUpdateSchema", () => {
  it.each(["started", "arrived", "picked_up", "dropped_off", "completed", "failed", "cancelled"])(
    "accepts %s",
    (event_type) => {
      expect(transportStatusUpdateSchema.safeParse({ event_type }).success).toBe(true);
    },
  );

  it("rejects arbitrary event types", () => {
    const r = transportStatusUpdateSchema.safeParse({ event_type: "warp" });
    expect(r.success).toBe(false);
  });
});

describe("vehicle schemas", () => {
  it("accepts a valid vehicle", () => {
    const r = createVehicleSchema.safeParse({
      location_id: "loc1",
      name: "Blue Van",
      licence_plate: "XYZ 123",
      capacity: 4,
    });
    expect(r.success).toBe(true);
  });

  it("rejects zero capacity", () => {
    const r = createVehicleSchema.safeParse({
      location_id: "loc1",
      name: "Blue Van",
      licence_plate: "XYZ 123",
      capacity: 0,
    });
    expect(r.success).toBe(false);
  });

  it("rejects tenant_id on update", () => {
    expect(updateVehicleSchema.safeParse({ tenant_id: "evil" }).success).toBe(false);
  });
});
