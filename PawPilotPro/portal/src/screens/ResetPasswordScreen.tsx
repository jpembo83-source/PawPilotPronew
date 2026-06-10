import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ChevronLeft, KeyRound, CheckCircle2 } from "lucide-react";
import { getSupabase } from "@/lib/supabase";

/**
 * Owner-side password reset — the landing page for the link in the
 * reset email. Supabase Auth puts a `type=recovery` query in the URL
 * fragment which the client SDK parses automatically on load and turns
 * into a short-lived recovery session. Once that session exists,
 * `updateUser({ password })` swaps the password atomically.
 *
 * If the user navigates here directly without a recovery session
 * (bookmark, refresh after expiry), we explain the link is dead and
 * point them back to /forgot-password.
 *
 * Note: the email link opens at the public Netlify URL, not the native
 * app — that's deliberate for v1 (universal-link routing would be a
 * separate piece of work). User resets in the browser, returns to the
 * app to log in.
 */
export function ResetPasswordScreen() {
  const supabase = getSupabase();
  const nav = useNavigate();
  const [ready, setReady] = useState<"loading" | "valid" | "expired">("loading");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  // The Supabase client picks up the recovery token from the URL fragment
  // synchronously during init. By the time React mounts there should be
  // a PASSWORD_RECOVERY session OR the fragment is gone. We treat any
  // active session as valid — the password update will fail clearly if
  // it isn't actually a recovery context.
  useEffect(() => {
    let cancelled = false;

    // Subscribe to auth state — Supabase fires PASSWORD_RECOVERY when the
    // recovery link is processed. Some browsers race the mount, so we also
    // poll once on landing.
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (cancelled) return;
      if (event === "PASSWORD_RECOVERY" || (event === "INITIAL_SESSION" && session)) {
        setReady("valid");
      }
    });

    (async () => {
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      if (data.session) setReady("valid");
      else {
        // Give the SDK a beat to ingest the URL fragment before declaring expired.
        setTimeout(async () => {
          if (cancelled) return;
          const { data: again } = await supabase.auth.getSession();
          setReady(again.session ? "valid" : "expired");
        }, 500);
      }
    })();

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, [supabase]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (password.length < 10) {
      setErr("Use at least 10 characters");
      return;
    }
    if (password !== confirm) {
      setErr("Passwords don't match");
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setDone(true);
      // Brief pause so the success screen lands, then sign out + back to
      // login. Signing out is intentional — the user might have done this
      // on a shared device (the whole "I forgot" scenario implies that),
      // so don't leave a live session behind.
      setTimeout(async () => {
        try { await supabase.auth.signOut(); } catch {}
        nav("/login", { replace: true });
      }, 1800);
    } catch (e: any) {
      setErr(e?.message ?? "Couldn't update password");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="relative min-h-dvh w-full bg-background flex flex-col">
      <header
        className="flex items-center gap-2 px-3 -ml-2"
        style={{ paddingTop: "calc(0.75rem + var(--safe-top))" }}
      >
        <Link
          to="/login"
          className="press p-2 rounded-full hover:bg-secondary/60"
          aria-label="Back to sign in"
        >
          <ChevronLeft size={20} strokeWidth={2.2} />
        </Link>
        <span className="text-[15px] font-semibold tracking-tight">New password</span>
      </header>

      <div className="flex-1 px-5 pt-8 pb-10 max-w-md mx-auto w-full">
        {ready === "loading" && (
          <p className="text-[14px] text-muted-foreground anim-fade-in">Verifying reset link…</p>
        )}

        {ready === "expired" && (
          <section className="anim-fade-in">
            <h1 className="text-display-sm leading-tight mb-2">This link has expired</h1>
            <p className="text-[14.5px] text-muted-foreground leading-relaxed mb-7">
              Password reset links work once and stay valid for an hour. Request a fresh one
              and we'll send a new email.
            </p>
            <Link
              to="/forgot-password"
              className="press inline-flex items-center justify-center w-full h-12 rounded-xl bg-primary text-primary-foreground font-semibold shadow-[var(--shadow-sm)]"
            >
              Send a new link
            </Link>
          </section>
        )}

        {ready === "valid" && done && (
          <section className="anim-fade-in">
            <div className="size-14 rounded-2xl bg-secondary text-secondary-foreground grid place-items-center mb-5">
              <CheckCircle2 size={26} strokeWidth={2} />
            </div>
            <h1 className="text-display-sm leading-tight mb-2">Password set</h1>
            <p className="text-[14.5px] text-muted-foreground leading-relaxed">
              Taking you back to sign in…
            </p>
          </section>
        )}

        {ready === "valid" && !done && (
          <section className="anim-fade-in">
            <div className="size-14 rounded-2xl bg-secondary text-secondary-foreground grid place-items-center mb-5">
              <KeyRound size={26} strokeWidth={2} />
            </div>
            <h1 className="text-display-sm leading-tight mb-2">Choose a new password</h1>
            <p className="text-[14.5px] text-muted-foreground leading-relaxed mb-7">
              At least 10 characters. Something a manager couldn't guess.
            </p>

            <form onSubmit={submit} className="space-y-4">
              <label htmlFor="new-password" className="block">
                <span className="text-eyebrow block mb-1.5">New password</span>
                <input
                  id="new-password"
                  type="password"
                  required
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full h-12 px-3.5 rounded-xl border border-input bg-input-background text-foreground text-[15px] focus:outline-none focus:border-primary focus:ring-2 focus:ring-ring/30 transition-shadow"
                />
              </label>

              <label htmlFor="confirm-password" className="block">
                <span className="text-eyebrow block mb-1.5">Confirm</span>
                <input
                  id="confirm-password"
                  type="password"
                  required
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  className="w-full h-12 px-3.5 rounded-xl border border-input bg-input-background text-foreground text-[15px] focus:outline-none focus:border-primary focus:ring-2 focus:ring-ring/30 transition-shadow"
                />
              </label>

              {err && (
                <p role="alert" className="text-[13px] text-destructive font-medium anim-fade-in">
                  {err}
                </p>
              )}

              <button
                disabled={busy}
                type="submit"
                className="press relative flex items-center justify-center w-full h-12 mt-2 rounded-xl bg-primary text-primary-foreground font-semibold shadow-[var(--shadow-sm)] disabled:opacity-50"
              >
                {busy ? "Saving…" : "Set new password"}
              </button>
            </form>
          </section>
        )}
      </div>
    </main>
  );
}
