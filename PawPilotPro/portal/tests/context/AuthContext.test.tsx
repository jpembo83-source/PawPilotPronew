import { render, act } from "@testing-library/react";
// @ts-ignore - screen is exported at runtime by @testing-library/react v16 but types lag
import { screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider, useAuth } from "@/context/AuthContext";

const hoisted = vi.hoisted(() => ({ listeners: [] as ((evt: string, sess: unknown) => void)[] }));

vi.mock("@/lib/supabase", () => {
  return {
    getSupabase: () => ({
      auth: {
        getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
        onAuthStateChange: (cb: (evt: string, sess: unknown) => void) => {
          hoisted.listeners.push(cb);
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

function renderWithClient() {
  const queryClient = new QueryClient();
  render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Probe />
      </AuthProvider>
    </QueryClientProvider>,
  );
  return queryClient;
}

const sessionFor = (id: string) => ({ user: { id } });

describe("AuthContext", () => {
  beforeEach(() => {
    // Listeners registered by a previous test's (unmounted) provider must not
    // receive events fired in the next test.
    hoisted.listeners.length = 0;
  });

  it("starts in loading then transitions to anonymous when no session", async () => {
    renderWithClient();
    expect(screen.getByText("auth:loading")).toBeInTheDocument();
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.getByText("auth:anonymous")).toBeInTheDocument();
  });

  it("clears the query cache when the signed-in user changes", async () => {
    const queryClient = renderWithClient();
    await act(async () => {
      await Promise.resolve();
    });
    // User A signs in and the app caches their household data
    await act(async () => {
      hoisted.listeners.forEach((cb) => cb("SIGNED_IN", sessionFor("user-a")));
    });
    queryClient.setQueryData(["portal", "home"], { pets: ["Meg", "Askya"] });

    // User B signs in on the same device — A's cached data must be gone,
    // otherwise B is shown A's household until (and unless) a refetch lands.
    await act(async () => {
      hoisted.listeners.forEach((cb) => cb("SIGNED_IN", sessionFor("user-b")));
    });
    expect(queryClient.getQueryData(["portal", "home"])).toBeUndefined();
  });

  it("keeps the cache across token refreshes for the same user", async () => {
    const queryClient = renderWithClient();
    await act(async () => {
      await Promise.resolve();
    });
    await act(async () => {
      hoisted.listeners.forEach((cb) => cb("SIGNED_IN", sessionFor("user-a")));
    });
    queryClient.setQueryData(["portal", "home"], { pets: ["Meg", "Askya"] });

    // Hourly TOKEN_REFRESHED events re-fire with the same user — clearing
    // here would needlessly nuke the offline cache.
    await act(async () => {
      hoisted.listeners.forEach((cb) => cb("TOKEN_REFRESHED", sessionFor("user-a")));
    });
    expect(queryClient.getQueryData(["portal", "home"])).toEqual({ pets: ["Meg", "Askya"] });
  });

  it("clears the query cache on sign-out", async () => {
    const queryClient = renderWithClient();
    await act(async () => {
      await Promise.resolve();
    });
    await act(async () => {
      hoisted.listeners.forEach((cb) => cb("SIGNED_IN", sessionFor("user-a")));
    });
    queryClient.setQueryData(["portal", "home"], { pets: ["Meg", "Askya"] });

    await act(async () => {
      hoisted.listeners.forEach((cb) => cb("SIGNED_OUT", null));
    });
    expect(queryClient.getQueryData(["portal", "home"])).toBeUndefined();
  });
});
