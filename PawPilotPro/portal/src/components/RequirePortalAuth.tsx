import { Navigate, useLocation } from "react-router-dom";
import { ReactNode } from "react";
import { useAuth } from "@/context/AuthContext";
import { usePortalQuery } from "@/hooks/usePortalQuery";
import { ApiError } from "@shared/api/client";

export function RequirePortalAuth({ children }: { children: ReactNode }) {
  const { status, session, signOut } = useAuth();
  const loc = useLocation();

  // A signed-in Auth user is not necessarily a portal user (staff accounts,
  // suspended households, invites never accepted). The server rejects those
  // with 401/403 on every endpoint — probe once per signed-in user so the
  // app answers with a clear screen instead of rendering nothing (or, before
  // the cache fix, another account's stale data). Network failures don't
  // throw ApiError, so being offline never locks a valid user out.
  const probe = usePortalQuery<{ householdId: string }>(
    ["portal", "me", session?.user?.id ?? "anon"],
    "/portal/me",
    { enabled: status === "authed", retry: false, staleTime: Infinity },
  );

  if (status === "loading") return <FullPageSpinner />;
  if (status === "anonymous") {
    return <Navigate to={`/login?next=${encodeURIComponent(loc.pathname)}`} replace />;
  }
  const err = probe.error;
  if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
    return <PortalAccessBlocked message={err.message} onSignOut={() => void signOut()} />;
  }
  return <>{children}</>;
}

function PortalAccessBlocked({ message, onSignOut }: { message: string; onSignOut: () => void }) {
  return (
    <div className="min-h-dvh grid place-items-center px-6">
      <div className="w-full max-w-sm bg-white rounded-2xl border border-black/10 shadow-sm p-6 text-center space-y-4">
        <h1 className="text-lg font-bold">This account doesn&apos;t have portal access</h1>
        <p className="text-sm text-black/60">{message}</p>
        <p className="text-sm text-black/60">
          If your daycare sent you an invite, open the invite link to activate this account — or sign in
          with the email the invite was sent to.
        </p>
        <button
          onClick={onSignOut}
          className="w-full h-12 rounded-xl bg-black text-white text-sm font-semibold"
        >
          Sign in with a different account
        </button>
      </div>
    </div>
  );
}

function FullPageSpinner() {
  return (
    <div className="min-h-dvh grid place-items-center">
      <div className="size-6 rounded-full border-2 border-muted border-t-foreground animate-spin" aria-label="Loading" />
    </div>
  );
}
