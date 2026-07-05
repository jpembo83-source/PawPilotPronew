import { createContext, useContext, useEffect, useRef, useState, ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { useQueryClient } from "@tanstack/react-query";
import { getSupabase } from "@/lib/supabase";
import { initBiometricTokenSync } from "@/lib/biometric";

type AuthStatus = "loading" | "anonymous" | "authed";

interface AuthShape {
  status: AuthStatus;
  session: Session | null;
  signOut: () => Promise<void>;
}

const AuthCtx = createContext<AuthShape | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [session, setSession] = useState<Session | null>(null);
  const [status, setStatus] = useState<AuthStatus>("loading");
  // undefined = no session observed yet (the first callback must not clear)
  const lastUserIdRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    // Keeps the biometric-unlock refresh token current across Supabase's
    // token rotation. No-op on web builds or when quick unlock is off.
    initBiometricTokenSync();

    let mounted = true;

    const applySession = (sess: Session | null) => {
      const nextUserId = sess?.user?.id ?? null;
      // Drop every cached query the moment the signed-in user changes
      // (including sign-out). Without this, the next account on a shared
      // device is shown the previous account's cached household — and when
      // the server rejects the new account (403), the failed refetches never
      // overwrite that stale data.
      if (lastUserIdRef.current !== undefined && lastUserIdRef.current !== nextUserId) {
        queryClient.clear();
      }
      lastUserIdRef.current = nextUserId;
      setSession(sess);
      setStatus(sess ? "authed" : "anonymous");
    };

    getSupabase().auth.getSession().then(({ data }) => {
      if (!mounted) return;
      applySession(data.session);
    });
    const { data } = getSupabase().auth.onAuthStateChange((_evt, sess) => {
      applySession(sess);
    });
    return () => {
      mounted = false;
      data.subscription.unsubscribe();
    };
  }, [queryClient]);

  return (
    <AuthCtx.Provider
      value={{
        status,
        session,
        signOut: async () => {
          await getSupabase().auth.signOut();
          // onAuthStateChange also clears via applySession; doing it here too
          // guarantees the cache is empty before the login screen mounts.
          queryClient.clear();
        },
      }}
    >
      {children}
    </AuthCtx.Provider>
  );
}

export function useAuth() {
  const v = useContext(AuthCtx);
  if (!v) throw new Error("useAuth outside AuthProvider");
  return v;
}
