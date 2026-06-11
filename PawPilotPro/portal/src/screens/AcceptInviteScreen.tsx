import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Mail, ShieldAlert } from "lucide-react";
import { getPortalApi } from "@/lib/api";
import { getSupabase } from "@/lib/supabase";

interface AcceptResponse {
  ok: boolean;
  session?: { accessToken: string; refreshToken: string };
  message?: string;
  reusedExistingAccount?: boolean;
}

// Mirrors the server's acceptSchema (portal_routes.tsx): min 10, max 128.
const setPasswordSchema = z.object({
  password: z
    .string()
    .min(10, "Password must be at least 10 characters")
    .max(128, "Password must be 128 characters or fewer"),
});
type SetPasswordForm = z.infer<typeof setPasswordSchema>;

export function AcceptInviteScreen() {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SetPasswordForm>({ resolver: zodResolver(setPasswordSchema) });
  const [err, setErr] = useState<string | null>(null);
  const nav = useNavigate();

  if (!token) {
    return (
      <main className="min-h-dvh flex flex-col px-6 pt-16 pb-10 max-w-sm mx-auto">
        <header className="mb-7 anim-fade-in">
          <p className="text-eyebrow mb-3">PawPilotPro</p>
          <h1 className="text-display">Invite link looks off</h1>
        </header>
        <div className="rounded-2xl border border-border bg-card p-5 anim-slide-up">
          <div className="size-11 rounded-xl bg-secondary text-secondary-foreground grid place-items-center mb-3.5">
            <ShieldAlert size={20} strokeWidth={2.2} />
          </div>
          <h2 className="font-semibold text-[15px] mb-1.5">This link can't be used</h2>
          <p className="text-[13px] text-muted-foreground leading-relaxed mb-4">
            It might have expired or already been used. Ask your daycare to resend your invite.
          </p>
          <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
            <Mail size={14} strokeWidth={2.2} />
            Check your inbox for the latest invite email.
          </div>
        </div>
      </main>
    );
  }

  async function submit({ password }: SetPasswordForm) {
    setErr(null);
    try {
      const r = await getPortalApi().post<AcceptResponse>("/portal/auth/accept-invite", { token, password });
      if (r.session) {
        await getSupabase().auth.setSession({
          access_token: r.session.accessToken,
          refresh_token: r.session.refreshToken,
        });
        nav("/", { replace: true });
      } else if (r.reusedExistingAccount) {
        nav("/login?reused=1", { replace: true });
      } else {
        nav("/login", { replace: true });
      }
    } catch (e: any) {
      setErr(e?.message ?? "Couldn't set up account");
    }
  }

  return (
    <main className="min-h-dvh flex flex-col px-6 pt-16 pb-10 max-w-sm mx-auto">
      <header className="mb-9 anim-fade-in">
        <p className="text-eyebrow mb-3">Welcome</p>
        <h1 className="text-display">Set your password</h1>
        <p className="text-[14px] text-muted-foreground mt-2 leading-relaxed">
          Choose a password at least 10 characters long. You'll use this every time you sign in.
        </p>
      </header>

      <form
        onSubmit={handleSubmit(submit)}
        noValidate
        className="space-y-4 anim-slide-up"
        style={{ animationDelay: "60ms" }}
      >
        <label htmlFor="password" className="block">
          <span className="text-eyebrow block mb-2">Password</span>
          <input
            id="password"
            type="password"
            {...register("password")}
            aria-invalid={errors.password ? true : undefined}
            className="w-full h-12 px-3.5 rounded-xl border border-input bg-input-background text-foreground text-[15px] focus:outline-none focus:border-primary focus:ring-2 focus:ring-ring/30 transition-shadow"
            autoComplete="new-password"
            placeholder="At least 10 characters"
          />
          {errors.password && (
            <p role="alert" className="text-[13px] text-destructive font-medium anim-fade-in mt-2">
              {errors.password.message}
            </p>
          )}
        </label>

        {err && (
          <p
            role="alert"
            className="text-[13px] text-destructive font-medium anim-fade-in"
          >
            {err}
          </p>
        )}

        <button
          disabled={isSubmitting}
          type="submit"
          className="press group relative flex items-center justify-center w-full h-12 mt-2 rounded-xl bg-primary text-primary-foreground font-semibold shadow-[var(--shadow-sm)] hover:shadow-[var(--shadow-md)] disabled:opacity-50 disabled:cursor-not-allowed overflow-hidden"
        >
          <span
            className="absolute inset-x-0 top-0 h-px bg-white/20 pointer-events-none"
            aria-hidden="true"
          />
          <span className="tracking-[-0.005em]">
            {isSubmitting ? "Setting up…" : "Set up my account"}
          </span>
        </button>
      </form>
    </main>
  );
}
