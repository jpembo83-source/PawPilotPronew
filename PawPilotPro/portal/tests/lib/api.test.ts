import { describe, it, expect, beforeEach } from "vitest";
import { getPortalApi } from "@/lib/api";

describe("getPortalApi", () => {
  beforeEach(() => {
    (import.meta.env as Record<string, string>).VITE_SUPABASE_PROJECT_ID = "proj";
    (import.meta.env as Record<string, string>).VITE_SUPABASE_ANON_KEY = "anon";
  });
  it("returns a singleton wired to env", async () => {
    const a = getPortalApi();
    const b = getPortalApi();
    expect(a).toBe(b);
  });
});
