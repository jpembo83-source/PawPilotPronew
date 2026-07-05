import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ChevronLeft, MailCheck } from "lucide-react";
import { getSupabase } from "@/lib/supabase";

/**
 * Passwordless sign-in with an emailed one-time code (Supabase email OTP).
 * The code length is a Supabase dashboard setting (6–10 digits), so the UI
 * never claims a specific length — this project currently sends 8.
 *
 * Invite-only guard: `shouldCreateUser: false` makes Supabase refuse to mint
 * a user for an unknown email, so this can never become a self-signup back
 * door — only existing portal accounts can receive codes. The UI copy is the
 * same whether or not the email exists, so the form can't be used to probe
 * which addresses have accounts.
 *
 * A code (typed into the app) rather than a tappable link is deliberate:
 * it works identically inside the Capacitor WebView, with no universal-link
 * platform config, and the email + the app are usually on the same phone.
 */
export function LoginCodeScreen() {
  const nav = useNavigate();
  const [params] = useSearchParams();
  const [email, setEmail] = useState(params.get("email") ?? "");
  const [phase, setPhase] = useState<"request" | "verify">("request");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function requestCode(e: React.FormEvent) {
    e.preventDefault();
    const target = email.trim();
    if (!target) {
      setErr("Enter your email address first.");
      return;
    }
    setErr(null);
    setBusy(true);
    try {
      // shouldCreateUser:false = invite-only. Errors (including "no such
      // user") are deliberately swallowed: same next screen either way, so
      // the form can't be used to enumerate accounts.
      await getSupabase().auth.signInWithOtp({
        email: target,
        options: { shouldCreateUser: false },
      });
    } catch {
      // Network failures land here too; the verify screen's resend covers it.
    } finally {
      setBusy(false);
      setPhase("verify");
    }
  }

  async function verifyCode(e: React.FormEvent) {
    e.preventDefault();
    if (code.trim().length < 6) {
      setErr("Enter the full code from the email.");
      return;
    }
    setErr(null);
    setBusy(true);
    const { error } = await getSupabase().auth.verifyOtp({
      email: email.trim(),
      token: code.trim(),
      type: "email",
    });
    setBusy(false);
    if (error) {
      setErr("That code didn't work — check it, or request a fresh one.");
      return;
    }
    nav("/", { replace: true });
  }

  return (
    <main className="min-h-dvh flex flex-col px-6 pt-14 pb-10 max-w-sm mx-auto">
      <Link
        to="/login"
        className="press inline-flex items-center gap-0.5 -ml-1 mb-6 h-8 pr-2 pl-1 rounded-lg text-sm font-medium text-primary self-start"
      >
        <ChevronLeft size={16} strokeWidth={2.5} />
        Back to sign in
      </Link>

      <header className="mb-7 anim-fade-in">
        <div className="size-12 rounded-2xl bg-secondary text-secondary-foreground grid place-items-center mb-4">
          <MailCheck size={22} strokeWidth={2} />
        </div>
        <h1 className="text-display-sm leading-tight mb-2">
          {phase === "request" ? "Sign in with a code" : "Check your email"}
        </h1>
        <p className="text-[14px] text-muted-foreground leading-relaxed">
          {phase === "request"
            ? "No password needed — we'll email you a sign-in code."
            : `If ${email.trim()} has a portal account, a sign-in code is on its way. It's valid for a few minutes.`}
        </p>
      </header>

      {phase === "request" ? (
        <form onSubmit={requestCode} noValidate className="space-y-4 anim-slide-up">
          <label htmlFor="otp-email" className="block">
            <span className="text-eyebrow block mb-1.5">Email address</span>
            <input
              id="otp-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
              autoFocus
              placeholder="you@dogday.com"
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
            className="press flex items-center justify-center w-full h-12 rounded-xl bg-primary text-primary-foreground font-semibold shadow-[var(--shadow-sm)] disabled:opacity-50"
          >
            {busy ? "Sending…" : "Email me a code"}
          </button>
        </form>
      ) : (
        <form onSubmit={verifyCode} noValidate className="space-y-4 anim-slide-up">
          <label htmlFor="otp-code" className="block">
            <span className="text-eyebrow block mb-1.5">Code from the email</span>
            <input
              id="otp-code"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={10}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              autoComplete="one-time-code"
              autoFocus
              placeholder="12345678"
              className="w-full h-12 px-3.5 rounded-xl border border-input bg-input-background text-foreground text-[19px] tracking-[0.35em] text-tabular focus:outline-none focus:border-primary focus:ring-2 focus:ring-ring/30 transition-shadow"
            />
          </label>

          {err && (
            <p role="alert" className="text-[13px] text-destructive font-medium anim-fade-in">
              {err}
            </p>
          )}

          <button
            disabled={busy || code.length < 6}
            type="submit"
            className="press flex items-center justify-center w-full h-12 rounded-xl bg-primary text-primary-foreground font-semibold shadow-[var(--shadow-sm)] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {busy ? "Checking…" : "Sign in"}
          </button>

          <button
            type="button"
            onClick={() => {
              setCode("");
              setPhase("request");
            }}
            className="press block mx-auto text-center text-[12px] text-muted-foreground hover:text-foreground tracking-wide pt-1"
          >
            Didn't get it? Send another code
          </button>
        </form>
      )}
    </main>
  );
}
