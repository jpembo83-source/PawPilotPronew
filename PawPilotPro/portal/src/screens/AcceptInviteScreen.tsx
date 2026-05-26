import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { getPortalApi } from "@/lib/api";
import { getSupabase } from "@/lib/supabase";

interface AcceptResponse {
  ok: boolean;
  session?: { accessToken: string; refreshToken: string };
  message?: string;
}

export function AcceptInviteScreen() {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const nav = useNavigate();

  if (!token) {
    return (
      <main className="min-h-screen grid place-items-center px-6">
        <div className="text-center space-y-2">
          <h1 className="text-xl font-semibold">Invalid link</h1>
          <p className="text-neutral-500 text-sm">Ask the daycare to resend your invite.</p>
        </div>
      </main>
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const r = await getPortalApi().post<AcceptResponse>("/portal/auth/accept-invite", { token, password });
      if (r.session) {
        await getSupabase().auth.setSession({
          access_token: r.session.accessToken,
          refresh_token: r.session.refreshToken,
        });
        nav("/", { replace: true });
      } else {
        nav("/login", { replace: true });
      }
    } catch (e: any) {
      setErr(e?.message ?? "Couldn't set up account");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen grid place-items-center px-6">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4">
        <header className="text-center space-y-1">
          <p className="text-xs uppercase tracking-widest text-neutral-500">PawPilotPro</p>
          <h1 className="text-2xl font-semibold">Set your password</h1>
          <p className="text-sm text-neutral-500">Choose a password at least 10 characters long.</p>
        </header>
        <label className="block text-sm">
          <span className="block mb-1 text-neutral-700 dark:text-neutral-300">Password</span>
          <input
            id="password"
            type="password"
            minLength={10}
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full h-12 px-3 rounded-xl border border-neutral-200 bg-white text-neutral-900"
            autoComplete="new-password"
          />
        </label>
        {err && <p role="alert" className="text-sm text-red-600">{err}</p>}
        <button
          disabled={busy}
          type="submit"
          className="w-full h-12 rounded-xl bg-blue-600 text-white font-semibold disabled:opacity-50"
        >
          {busy ? "Setting up…" : "Set up my account"}
        </button>
      </form>
    </main>
  );
}
