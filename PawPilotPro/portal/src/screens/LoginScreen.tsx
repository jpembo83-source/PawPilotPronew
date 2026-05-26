import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { getSupabase } from "@/lib/supabase";

export function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const nav = useNavigate();
  const [params] = useSearchParams();
  const next = params.get("next") ?? "/";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    const { error } = await getSupabase().auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) {
      setErr(error.message);
      return;
    }
    nav(next, { replace: true });
  }

  return (
    <main className="min-h-screen grid place-items-center px-6">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4">
        <header className="text-center space-y-1">
          <p className="text-xs uppercase tracking-widest text-neutral-500">PawPilotPro</p>
          <h1 className="text-2xl font-semibold">Welcome back</h1>
        </header>
        <label className="block text-sm">
          <span className="block mb-1 text-neutral-700 dark:text-neutral-300">Email</span>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full h-12 px-3 rounded-xl border border-neutral-200 bg-white text-neutral-900"
            autoComplete="email"
          />
        </label>
        <label className="block text-sm">
          <span className="block mb-1 text-neutral-700 dark:text-neutral-300">Password</span>
          <input
            id="password"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full h-12 px-3 rounded-xl border border-neutral-200 bg-white text-neutral-900"
            autoComplete="current-password"
          />
        </label>
        {err && <p role="alert" className="text-sm text-red-600">{err}</p>}
        <button
          disabled={busy}
          type="submit"
          className="w-full h-12 rounded-xl bg-blue-600 text-white font-semibold disabled:opacity-50"
        >
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </main>
  );
}
