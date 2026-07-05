import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Info, PawPrint, ArrowRight, ScanFace, MailCheck } from "lucide-react";
import { getSupabase } from "@/lib/supabase";
import { brandDisplayName, useBranding } from "@/lib/branding";
import { PasswordInput } from "@/components/PasswordInput";
import { ConfirmSheet } from "@/components/ConfirmSheet";
import {
  biometricEnabled,
  biometricLogin,
  biometricOffered,
  biometricSupported,
  enableBiometric,
  markBiometricOffered,
} from "@/lib/biometric";

// Hero photo. Forest-teal gradient sits behind as graceful fallback.
const HERO_PHOTO =
  "https://images.unsplash.com/photo-1633722715463-d30f4f325e24?q=80&w=1400&auto=format&fit=crop";

const loginSchema = z.object({
  email: z.email("Enter a valid email address"),
  password: z.string().min(1, "Enter your password"),
});
type LoginForm = z.infer<typeof loginSchema>;

export function LoginScreen() {
  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({ resolver: zodResolver(loginSchema) });
  const [err, setErr] = useState<string | null>(null);
  const [photoOk, setPhotoOk] = useState(true);
  const nav = useNavigate();
  const [params] = useSearchParams();
  const next = params.get("next") ?? "/";
  const reused = params.get("reused") === "1";

  // Biometric fast-path: available when the user opted in on this device.
  const [bioAvailable, setBioAvailable] = useState(false);
  const [bioBusy, setBioBusy] = useState(false);
  const [offerBio, setOfferBio] = useState(false);
  const [offerBusy, setOfferBusy] = useState(false);
  const autoPrompted = useRef(false);

  useEffect(() => {
    if (!biometricEnabled()) return;
    setBioAvailable(true);
    // Auto-prompt once so a returning owner reaches Home without typing.
    if (!autoPrompted.current) {
      autoPrompted.current = true;
      void tryBiometric();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function tryBiometric() {
    setErr(null);
    setBioBusy(true);
    try {
      await biometricLogin();
      nav(next, { replace: true });
    } catch (e: any) {
      if (e?.message !== "cancelled") {
        setErr(e?.message ?? "Quick unlock failed — please sign in with your password.");
        setBioAvailable(biometricEnabled());
      }
    } finally {
      setBioBusy(false);
    }
  }

  async function submit({ email, password }: LoginForm) {
    setErr(null);
    const { error } = await getSupabase().auth.signInWithPassword({ email, password });
    if (error) { setErr(error.message); return; }
    // One-time offer to switch on biometric unlock, native shell only.
    if (!biometricOffered() && !biometricEnabled() && (await biometricSupported())) {
      setOfferBio(true);
      return;
    }
    nav(next, { replace: true });
  }

  async function acceptBiometricOffer() {
    setOfferBusy(true);
    try {
      await enableBiometric();
    } catch {
      // Prompt cancelled or store failed — continue signed in without it.
    } finally {
      markBiometricOffered();
      setOfferBusy(false);
      setOfferBio(false);
      nav(next, { replace: true });
    }
  }

  function declineBiometricOffer() {
    markBiometricOffered();
    setOfferBio(false);
    nav(next, { replace: true });
  }

  return (
    <main className="relative min-h-dvh w-full overflow-hidden flex flex-col">
      {/* Photographic background */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary to-secondary" aria-hidden="true">
        {photoOk && (
          <img
            src={HERO_PHOTO}
            alt=""
            onError={() => setPhotoOk(false)}
            className="absolute inset-0 w-full h-full object-cover anim-fade-in"
            style={{ animationDuration: "1.2s" }}
          />
        )}
        {/* Editorial scrim — strong at top for wordmark, dramatic vertical gradient
            for the headline, soft fade into the card. Three stops for an art-direction feel. */}
        <div className="absolute inset-0" style={{
          background: `
            linear-gradient(180deg,
              rgba(28,25,22,0.55) 0%,
              rgba(28,25,22,0.05) 20%,
              rgba(28,25,22,0.0) 38%,
              rgba(28,25,22,0.0) 50%,
              rgba(28,25,22,0.55) 78%,
              rgba(28,25,22,0.78) 100%
            )
          `,
        }} />
      </div>

      <BrandWordmark />

      {/* Editorial headline — anchored to the lower-middle of the photo */}
      <section
        className="relative z-10 px-6 mt-auto mb-6 text-white anim-fade-in"
        style={{ animationDelay: "200ms", animationDuration: "900ms" }}
      >
        <p className="text-[10px] tracking-[0.32em] uppercase font-medium opacity-80 mb-3">
          Welcome
        </p>
        <h1
          className="font-display leading-[0.95] tracking-[-0.02em]"
          style={{ fontSize: "clamp(48px, 13vw, 64px)" }}
        >
          Your dog,
          <br/>
          <span className="italic font-display opacity-90">considered.</span>
        </h1>
        <p className="text-[13px] mt-4 max-w-[26ch] opacity-85 leading-relaxed">
          Sign in to see how they are today — heart, paws, and every moment in between.
        </p>
      </section>

      {/* Card */}
      <div
        className="relative z-10 mx-3 anim-slide-up"
        style={{ marginBottom: "calc(0.75rem + var(--safe-bottom))" }}
      >
        <div
          className="bg-card rounded-3xl p-7 max-w-sm mx-auto w-full"
          style={{ boxShadow: "var(--shadow-lg)" }}
        >
          <form onSubmit={handleSubmit(submit)} noValidate className="space-y-3.5">
            {bioAvailable && (
              <>
                <button
                  type="button"
                  onClick={() => void tryBiometric()}
                  disabled={bioBusy}
                  className="press flex items-center justify-center gap-2.5 w-full h-12 rounded-xl bg-primary text-primary-foreground font-semibold shadow-[var(--shadow-sm)] disabled:opacity-50"
                >
                  <ScanFace size={18} strokeWidth={2.2} />
                  {bioBusy ? "Unlocking…" : "Unlock with Face ID / fingerprint"}
                </button>
                <div className="flex items-center gap-3" aria-hidden="true">
                  <span className="h-px flex-1 bg-border" />
                  <span className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">or</span>
                  <span className="h-px flex-1 bg-border" />
                </div>
              </>
            )}
            {reused && (
              <div
                role="status"
                className="flex items-start gap-2.5 rounded-xl bg-secondary text-secondary-foreground text-[13px] p-3.5 border border-primary/20"
              >
                <Info size={16} strokeWidth={2.2} className="shrink-0 mt-px" />
                <p className="leading-relaxed">
                  Your account already exists — portal access has been added. Sign in with your existing password.
                </p>
              </div>
            )}

            <label htmlFor="email" className="block">
              <span className="text-[10px] tracking-[0.18em] uppercase font-medium text-muted-foreground block mb-1.5">
                Email address
              </span>
              <input
                id="email"
                type="email"
                {...register("email")}
                aria-invalid={errors.email ? true : undefined}
                className="w-full h-12 px-3.5 rounded-xl border border-input bg-input-background text-foreground text-[15px] focus:outline-none focus:border-primary focus:ring-2 focus:ring-ring/30 transition-shadow"
                autoComplete="username"
                placeholder="you@dogday.com"
              />
              {errors.email && (
                <p role="alert" className="text-[13px] text-destructive font-medium anim-fade-in mt-1.5">
                  {errors.email.message}
                </p>
              )}
            </label>

            <label htmlFor="password" className="block">
              <span className="text-[10px] tracking-[0.18em] uppercase font-medium text-muted-foreground block mb-1.5">
                Password
              </span>
              <PasswordInput
                id="password"
                {...register("password")}
                aria-invalid={errors.password ? true : undefined}
                className="w-full h-12 px-3.5 rounded-xl border border-input bg-input-background text-foreground text-[15px] focus:outline-none focus:border-primary focus:ring-2 focus:ring-ring/30 transition-shadow"
                autoComplete="current-password"
              />
              {errors.password && (
                <p role="alert" className="text-[13px] text-destructive font-medium anim-fade-in mt-1.5">
                  {errors.password.message}
                </p>
              )}
            </label>

            {err && (
              <p role="alert" className="text-[13px] text-destructive font-medium anim-fade-in">
                {err}
              </p>
            )}

            <button
              disabled={isSubmitting}
              type="submit"
              className="press group relative flex items-center justify-center gap-2 w-full h-12 mt-1 rounded-xl bg-foreground text-background font-medium disabled:opacity-50 disabled:cursor-not-allowed overflow-hidden"
              style={{ boxShadow: "var(--shadow-sm)" }}
            >
              <span className="absolute inset-x-0 top-0 h-px bg-white/10 pointer-events-none" aria-hidden="true" />
              <span className="tracking-[-0.005em]">{isSubmitting ? "Signing in…" : "Sign in"}</span>
              {!isSubmitting && <ArrowRight size={16} strokeWidth={2.2} className="opacity-70 transition-transform group-hover:translate-x-0.5" />}
            </button>

            <div className="flex items-center justify-center gap-4 pt-1">
              <Link
                to="/forgot-password"
                className="press text-[12px] text-muted-foreground hover:text-foreground tracking-wide"
              >
                Forgot password?
              </Link>
              <span className="text-muted-foreground/40 text-[12px]" aria-hidden="true">·</span>
              <button
                type="button"
                onClick={() =>
                  nav(`/login/code?email=${encodeURIComponent(getValues("email") ?? "")}`)
                }
                className="press inline-flex items-center gap-1.5 text-[12px] text-muted-foreground hover:text-foreground tracking-wide"
              >
                <MailCheck size={13} strokeWidth={2.2} />
                Email me a sign-in code
              </button>
            </div>
          </form>
        </div>
      </div>

      <ConfirmSheet
        open={offerBio}
        onClose={declineBiometricOffer}
        onConfirm={() => void acceptBiometricOffer()}
        title="Unlock with Face ID next time?"
        body="Skip the password on this device — your face or fingerprint signs you in. You can change this anytime in Account."
        confirmLabel="Turn on quick unlock"
        cancelLabel="Not now"
        tone="primary"
        busy={offerBusy}
      />
    </main>
  );
}

function BrandWordmark() {
  const brand = useBranding((s) => s.brand);
  const name = brandDisplayName(brand);
  return (
    <header
      className="relative z-10 px-6 flex items-center gap-2.5 text-white anim-fade-in"
      style={{ paddingTop: "calc(1.25rem + var(--safe-top))" }}
    >
      <span className="size-8 rounded-full bg-white grid place-items-center overflow-hidden ring-1 ring-white/30 shadow-[var(--shadow-sm)]">
        {brand.logoUrl ? (
          <img src={brand.logoUrl} alt="" className="w-full h-full object-contain p-0.5" />
        ) : (
          <PawPrint size={15} strokeWidth={2.2} className="text-foreground/70" />
        )}
      </span>
      <span className="font-medium tracking-tight text-[14px] drop-shadow-sm">{name}</span>
    </header>
  );
}
