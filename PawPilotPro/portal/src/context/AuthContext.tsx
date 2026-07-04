import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
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
  const [session, setSession] = useState<Session | null>(null);
  const [status, setStatus] = useState<AuthStatus>("loading");

  useEffect(() => {
    // Keeps the biometric-unlock refresh token current across Supabase's
    // token rotation. No-op on web builds or when quick unlock is off.
    initBiometricTokenSync();

    let mounted = true;
    getSupabase().auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      setStatus(data.session ? "authed" : "anonymous");
    });
    const { data } = getSupabase().auth.onAuthStateChange((_evt, sess) => {
      setSession(sess);
      setStatus(sess ? "authed" : "anonymous");
    });
    return () => {
      mounted = false;
      data.subscription.unsubscribe();
    };
  }, []);

  return (
    <AuthCtx.Provider
      value={{
        status,
        session,
        signOut: async () => {
          await getSupabase().auth.signOut();
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
