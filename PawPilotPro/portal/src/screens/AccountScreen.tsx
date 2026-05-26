import { useAuth } from "@/context/AuthContext";

export function AccountScreen() {
  const { session, signOut } = useAuth();
  return (
    <main className="px-5 pt-6 max-w-md mx-auto">
      <h1 className="text-xl font-semibold mb-4">Account</h1>
      <section className="rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 p-4 text-sm mb-4">
        <p className="text-neutral-500 text-xs mb-1">Signed in as</p>
        <p className="font-medium">{session?.user.email ?? "—"}</p>
      </section>
      <button
        onClick={signOut}
        className="w-full h-12 rounded-xl border border-neutral-200 dark:border-neutral-800 text-sm font-medium"
      >
        Sign out
      </button>
    </main>
  );
}
