import { describe, it, expect, vi } from "vitest";
import { createPortalApi } from "../api/client";

describe("createPortalApi", () => {
  it("builds the URL with projectId + path", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    const api = createPortalApi({
      projectId: "abc123",
      anonKey: "anon",
      getAccessToken: async () => "jwt-token",
      fetch: fetchMock,
    });
    await api.get("/portal/health");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://abc123.supabase.co/functions/v1/make-server-fc003b23/portal/health");
    expect((init as RequestInit).headers).toMatchObject({
      "Authorization": "Bearer anon",
      "X-User-Token": "Bearer jwt-token",
    });
  });
  it("throws ApiError on non-2xx with message body", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: "nope" }), { status: 403 }));
    const api = createPortalApi({ projectId: "p", anonKey: "a", getAccessToken: async () => "t", fetch: fetchMock });
    await expect(api.get("/portal/home")).rejects.toThrow(/nope/);
  });
});
