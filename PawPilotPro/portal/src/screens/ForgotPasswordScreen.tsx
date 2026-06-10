import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ChevronLeft, Mail } from "lucide-react";
import { getSupabase } from "@/lib/supabase";

/**
 * Owner-initiated password reset (entry point).
 *
 * Replaces the previous LoginScreen toast ("Contact your daycare and
 * they'll help you reset your password"). The reset email lands the
 * user on /reset-password — that route is unauthed and handled by
 * ResetPasswordScreen.
 *
 * Redirect target: VITE_PORTAL_PUBLIC_URL when set (Netlify prod URL),
 * otherwise window.location.origin (dev). For native iOS TestFlight
 * users, the reset link opens in Safari at the public URL — they reset
 * password in the browser, then come back to the app to log in.
 */
function getPublicUrl(): string {
  const env = (import.meta.env.VITE_PORTAL_PUBLIC_URL ?? "").toString().trim();
  if (env) return env.replace(/\/+$/, "");
  return window.location.origin;
}

export function ForgotPasswordScreen() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const nav = useNavigate();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      const { error } = await getSupabase().auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${getPublicUrl()}/reset-password`,
      });
      if (error) throw error;
      setSent(true);
    } catch (e: any) {
      setErr(e?.message ?? "Couldn't send reset email — try again");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="relative min-h-dvh w-full bg-background flex flex-col">
      <header className="flex items-center gap-2 px-3 -ml-2" style={{ paddingTop: "calc(0.75rem + var(--safe-top))" }}>
        <button
          type="button"
          onClick={() => nav(-1)}
          className="press p-2 rounded-full hover:bg-secondary/60"
          aria-label="Back"
        >
          <ChevronLeft size={20} strokeWidth={2.2} />
        </button>
        <span className="text-[15px] font-semibold tracking-tight">Reset password</span>
      </header>

      <div className="flex-1 px-5 pt-8 pb-10 max-w-md mx-auto w-full">
        {sent ? (
          <section className="anim-fade-in">
            <div className="size-14 rounded-2xl bg-secondary text-secondary-foreground grid place-items-center mb-5">
              <Mail size={26} strokeWidth={2} />
            </div>
            <h1 className="text-display-sm leading-tight mb-2">Check your inbox</h1>
            <p className="text-[14.5px] text-muted-foreground leading-relaxed mb-7">
              If <span className="font-semibold text-foreground">{email}</span> is on file with
              your daycare, you'll get an email with a link to set a new password. The link
              expires in 1 hour.
            </p>
            <Link
              to="/login"
              className="press inline-flex items-center justify-center w-full h-12 rounded-xl bg-primary text-primary-foreground font-semibold shadow-[var(--shadow-sm)]"
            >
              Back to sign in
            </Link>
          </section>
        ) : (
          <section className="anim-fade-in">
            <p className="text-eyebrow mb-2">Forgot password</p>
            <h1 className="text-display-sm leading-tight mb-2">Reset by email</h1>
            <p className="text-[14.5px] text-muted-foreground leading-relaxed mb-7">
              Pop in the email you use to sign in and we'll send a fresh password link.
            </p>

            <form onSubmit={submit} className="space-y-4">
              <label htmlFor="reset-email" className="block">
                <span className="text-eyebrow block mb-1.5">Email</span>
                <input
                  id="reset-email"
                  type="email"
                  required
                  autoComplete="email"
                  inputMode="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full h-12 px-3.5 rounded-xl border border-input bg-input-background text-foreground text-[15px] focus:outline-none focus:border-primary focus:ring-2 focus:ring-ring/30 transition-shadow"
                  placeholder="you@example.com"
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
                {busy ? "Sending…" : "Send reset link"}
              </button>

              <Link
                to="/login"
                className="press block text-center text-[13px] text-muted-foreground hover:text-foreground underline underline-offset-2 pt-1"
              >
                Back to sign in
              </Link>
            </form>
          </section>
        )}
      </div>
    </main>
  );
}
