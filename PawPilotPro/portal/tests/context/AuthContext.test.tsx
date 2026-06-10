import { render, act } from "@testing-library/react";
// @ts-ignore - screen is exported at runtime by @testing-library/react v16 but types lag
import { screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { AuthProvider, useAuth } from "@/context/AuthContext";

vi.mock("@/lib/supabase", () => {
  const listeners: Function[] = [];
  return {
    getSupabase: () => ({
      auth: {
        getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
        onAuthStateChange: (cb: Function) => {
          listeners.push(cb);
          return { data: { subscription: { unsubscribe() {} } } };
        },
        signOut: vi.fn().mockResolvedValue({ error: null }),
      },
    }),
  };
});

function Probe() {
  const { status } = useAuth();
  return <p>auth:{status}</p>;
}

describe("AuthContext", () => {
  it("starts in loading then transitions to anonymous when no session", async () => {
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );
    expect(screen.getByText("auth:loading")).toBeInTheDocument();
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.getByText("auth:anonymous")).toBeInTheDocument();
  });
});
