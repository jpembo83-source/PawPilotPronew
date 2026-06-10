import { Navigate, useLocation } from "react-router-dom";
import { ReactNode } from "react";
import { useAuth } from "@/context/AuthContext";

export function RequirePortalAuth({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const loc = useLocation();
  if (status === "loading") return <FullPageSpinner />;
  if (status === "anonymous") {
    return <Navigate to={`/login?next=${encodeURIComponent(loc.pathname)}`} replace />;
  }
  return <>{children}</>;
}

function FullPageSpinner() {
  return (
    <div className="min-h-dvh grid place-items-center">
      <div className="size-6 rounded-full border-2 border-muted border-t-foreground animate-spin" aria-label="Loading" />
    </div>
  );
}
