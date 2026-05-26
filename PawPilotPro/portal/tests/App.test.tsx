import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import App from "@/App";

vi.mock("@/lib/api", () => ({
  getPortalApi: () => ({
    get: vi.fn().mockResolvedValue({ ok: true, scope: "portal", ts: 123 }),
  }),
}));

describe("App", () => {
  it("renders health status from /portal/health", async () => {
    render(<App />);
    await waitFor(() => expect(screen.getByText(/Portal online/i)).toBeInTheDocument());
  });
});
