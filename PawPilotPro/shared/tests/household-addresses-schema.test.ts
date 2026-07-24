import { describe, it, expect } from "vitest";
import {
  savedAddressSchema,
  savedAddressesUpdateSchema,
  householdSavedAddressesRecordSchema,
} from "../schemas/household_addresses";

const NOW = "2026-07-24T08:00:00.000Z";

const home = {
  id: "addr-1",
  label: "Home",
  line1: "12 Meadow Lane",
  city: "Sheffield",
  postcode: "S1 2AB",
};

describe("household saved addresses contract", () => {
  it("accepts a minimal address (label + line1 only)", () => {
    expect(
      savedAddressSchema.safeParse({ id: "a", label: "Vet", line1: "1 High St" })
        .success,
    ).toBe(true);
  });

  it("rejects an address without a label or without line1", () => {
    expect(
      savedAddressSchema.safeParse({ id: "a", label: "", line1: "1 High St" })
        .success,
    ).toBe(false);
    expect(
      savedAddressSchema.safeParse({ id: "a", label: "Home", line1: "" })
        .success,
    ).toBe(false);
  });

  it("trims label and line1", () => {
    const parsed = savedAddressSchema.parse({
      id: "a",
      label: "  Office ",
      line1: " 3 Works Rd ",
    });
    expect(parsed.label).toBe("Office");
    expect(parsed.line1).toBe("3 Works Rd");
  });

  it("update payload is strict and bounded to 20 addresses", () => {
    expect(
      savedAddressesUpdateSchema.safeParse({ addresses: [home] }).success,
    ).toBe(true);
    expect(
      savedAddressesUpdateSchema.safeParse({ addresses: [home], extra: 1 })
        .success,
    ).toBe(false);
    const many = Array.from({ length: 21 }, (_, i) => ({ ...home, id: `a${i}` }));
    expect(savedAddressesUpdateSchema.safeParse({ addresses: many }).success).toBe(
      false,
    );
  });

  it("accepts the stored KV record shape", () => {
    expect(
      householdSavedAddressesRecordSchema.safeParse({
        tenant_id: "demo-tenant-001",
        household_id: "hh_1",
        addresses: [home],
        updated_at: NOW,
      }).success,
    ).toBe(true);
  });

  it("an empty list is a valid record (all addresses removed)", () => {
    expect(
      householdSavedAddressesRecordSchema.safeParse({
        tenant_id: "demo-tenant-001",
        household_id: "hh_1",
        addresses: [],
        updated_at: NOW,
      }).success,
    ).toBe(true);
  });
});
