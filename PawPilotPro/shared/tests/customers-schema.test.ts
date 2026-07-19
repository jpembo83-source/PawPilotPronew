import { describe, it, expect } from "vitest";
import {
  householdSchema,
  contactSchema,
  petSchema,
  customerDocumentSchema,
  householdNoteSchema,
  householdFlagSchema,
  customerActivitySchema,
} from "../schemas/customers";

const NOW = "2026-06-01T08:00:00.000Z";

describe("customers record contract", () => {
  it("accepts a staff-created household (hh_ id, sparse optionals)", () => {
    const r = householdSchema.safeParse({
      id: "hh_1717000000_ab12",
      tenant_id: "demo-tenant-001",
      name: "The Smith Family",
      created_at: NOW,
      updated_at: NOW,
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.status).toBe("active");
      expect(r.data.vip).toBe(false);
    }
  });

  it("rejects a contact without a last name", () => {
    const r = contactSchema.safeParse({
      id: "con_1",
      tenant_id: "demo-tenant-001",
      household_id: "hh_1",
      first_name: "Sam",
      last_name: "",
      created_at: NOW,
      updated_at: NOW,
    });
    expect(r.success).toBe(false);
  });

  it("accepts an owner-added pet awaiting verification (portal UUID id)", () => {
    const r = petSchema.safeParse({
      id: "6f9619ff-8b86-4d01-b42d-00cf4fc964ff",
      tenant_id: "demo-tenant-001",
      household_id: "hh_1",
      name: "Biscuit",
      owner_added: true,
      verification_status: "pending_staff_review",
      created_at: NOW,
      updated_at: NOW,
    });
    expect(r.success).toBe(true);
  });

  it("defaults non_billable to false — legacy pets without the field are billable", () => {
    const r = petSchema.safeParse({
      id: "pet_1",
      tenant_id: "demo-tenant-001",
      household_id: "hh_1",
      name: "Biscuit",
      created_at: NOW,
      updated_at: NOW,
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.non_billable).toBe(false);
  });

  it("carries an explicit house-dog marker through", () => {
    const r = petSchema.safeParse({
      id: "pet_house",
      tenant_id: "demo-tenant-001",
      household_id: "hh_1",
      name: "Office Dog",
      non_billable: true,
      created_at: NOW,
      updated_at: NOW,
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.non_billable).toBe(true);
  });

  it("rejects an unknown pet verification_status", () => {
    const r = petSchema.safeParse({
      id: "pet_1",
      tenant_id: "demo-tenant-001",
      household_id: "hh_1",
      name: "Biscuit",
      verification_status: "maybe",
      created_at: NOW,
      updated_at: NOW,
    });
    expect(r.success).toBe(false);
  });

  it("defaults document type/size/mime like the route does", () => {
    const r = customerDocumentSchema.safeParse({
      id: "doc_1",
      tenant_id: "demo-tenant-001",
      household_id: "hh_1",
      uploaded_at: NOW,
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.document_type).toBe("other");
      expect(r.data.file_size).toBe(0);
      expect(r.data.mime_type).toBe("application/octet-stream");
    }
  });

  it("rejects a note with an invalid category and strips denormalised names", () => {
    const bad = householdNoteSchema.safeParse({
      id: "note_1",
      tenant_id: "demo-tenant-001",
      household_id: "hh_1",
      content: "Prefers morning drop-off",
      category: "gossip",
      created_at: NOW,
      updated_at: NOW,
    });
    expect(bad.success).toBe(false);

    // Legacy KV note blobs carry created_by_name; the frozen contract drops
    // denormalised names (ratified §7.7) so parsing strips the field.
    const legacy = householdNoteSchema.safeParse({
      id: "note_2",
      tenant_id: "demo-tenant-001",
      household_id: "hh_1",
      content: "Gate code 1234",
      category: "general",
      created_by_name: "Jess on the desk",
      created_at: NOW,
      updated_at: NOW,
    });
    expect(legacy.success).toBe(true);
    if (legacy.success) expect("created_by_name" in legacy.data).toBe(false);
  });

  it("rejects an unknown flag key but accepts the documented set", () => {
    const base = {
      id: "flag_1",
      tenant_id: "demo-tenant-001",
      household_id: "hh_1",
      severity: "warn",
      created_at: NOW,
      updated_at: NOW,
    };
    expect(householdFlagSchema.safeParse({ ...base, flag_key: "vip" }).success).toBe(true);
    expect(householdFlagSchema.safeParse({ ...base, flag_key: "naughty" }).success).toBe(false);
    expect(
      householdFlagSchema.safeParse({ ...base, flag_key: "vip", severity: "critical" }).success,
    ).toBe(false);
  });

  it("keeps created_by_name on activities (append-only feed)", () => {
    const r = customerActivitySchema.safeParse({
      id: "act_1",
      tenant_id: "demo-tenant-001",
      household_id: "hh_1",
      activity_type: "document_uploaded",
      title: "Document Uploaded",
      created_by_name: "Jess on the desk",
      occurred_at: NOW,
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.created_by_name).toBe("Jess on the desk");
  });
});
