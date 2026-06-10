import { Link } from "react-router-dom";
import {
  LogOut, Home, Users, Plus, ChevronRight,
  Bell, Mail, Megaphone, FolderOpen, Sparkles, Navigation,
} from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { usePortalQuery } from "@/hooks/usePortalQuery";
import { Skeleton } from "@/components/Skeleton";
import { getPortalApi } from "@/lib/api";
import type { HouseholdResponse } from "@shared/types/household";

interface AccountData {
  profile: { name: string; email: string; phone: string };
  notificationPrefs: {
    booking: boolean;
    vax: boolean;
    marketing?: boolean;
    /** Tracker / collar events (battery, geofence, walk, transport, zoomies). */
    tracker?: boolean;
  };
}

/**
 * Account = the owner's hub. Two clear sections:
 *
 *   "You"            — your own profile card, notification preferences,
 *                       sign out.
 *   "Your household" — link cards to address, people, and "add a pet".
 *
 * The screen never edits address/contacts itself — those have dedicated
 * focused screens. Keeps this hub calm and scannable.
 */
export function AccountScreen() {
  const { session, signOut } = useAuth();
  const queryClient = useQueryClient();
  const { data: account, isLoading: accountLoading } = usePortalQuery<AccountData>(
    ["portal", "account"],
    "/portal/account",
  );
  const { data: household, isLoading: householdLoading } = usePortalQuery<HouseholdResponse>(
    ["portal", "household"],
    "/portal/household",
  );

  const name = account?.profile.name?.trim() || "Your account";
  const email = account?.profile.email || session?.user.email || "—";
  const phone = account?.profile.phone;
  const initial = (name && name !== "Your account" ? name : email).charAt(0).toUpperCase();
  const contactCount = household?.contacts.length ?? 0;

  const updatePrefs = useMutation({
    mutationFn: (prefs: AccountData["notificationPrefs"]) =>
      getPortalApi().patch("/portal/account", { notificationPrefs: prefs }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["portal", "account"] }),
    onError: (e: any) => toast.error(e?.message ?? "Couldn't save preferences"),
  });

  function togglePref(k: "booking" | "vax" | "marketing" | "tracker", v: boolean) {
    if (!account) return;
    updatePrefs.mutate({ ...account.notificationPrefs, [k]: v });
  }

  return (
    <main className="px-5 pt-8 pb-4 max-w-md mx-auto">
      {/* HEADER -------------------------------------------------------- */}
      <header className="mb-7 anim-fade-in">
        <p className="text-[10px] tracking-[0.22em] uppercase font-medium text-muted-foreground mb-2">
          Profile
        </p>
        <h1 className="font-display leading-[0.95] tracking-[-0.015em]" style={{ fontSize: 40 }}>
          Account
        </h1>
      </header>

      {/* YOU ----------------------------------------------------------- */}
      <section className="rounded-2xl bg-card border border-border p-5 mb-3 anim-slide-up">
        {accountLoading ? (
          <div className="flex items-center gap-4">
            <Skeleton className="size-16 rounded-full" />
            <div className="flex-1">
              <Skeleton className="h-4 w-32 mb-2" />
              <Skeleton className="h-3 w-44" />
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-4">
            <div
              className="size-16 rounded-full bg-secondary text-secondary-foreground grid place-items-center text-2xl font-semibold shrink-0"
              aria-hidden="true"
            >
              {initial}
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-base leading-tight truncate">{name}</p>
              <p className="text-[13px] text-muted-foreground truncate mt-1">{email}</p>
              {phone && (
                <p className="text-[13px] text-muted-foreground truncate mt-0.5 text-tabular">{phone}</p>
              )}
            </div>
          </div>
        )}
      </section>

      {/* NOTIFICATIONS PREFS ----------------------------------------- */}
      <section className="rounded-2xl bg-card border border-border p-5 mb-7 anim-slide-up" style={{ animationDelay: "40ms" }}>
        <header className="flex items-center gap-2.5 mb-3.5">
          <Bell size={16} strokeWidth={2.2} className="text-muted-foreground" />
          <h2 className="text-eyebrow">Notifications</h2>
        </header>
        <div className="space-y-3.5">
          <PrefRow
            icon={Mail}
            label="Booking updates"
            hint="When the team confirms, changes, or sends reminders."
            checked={account?.notificationPrefs.booking ?? true}
            onChange={(v) => togglePref("booking", v)}
          />
          <PrefRow
            icon={Bell}
            label="Vaccination reminders"
            hint="Heads-up when a vax is approaching its expiry."
            checked={account?.notificationPrefs.vax ?? true}
            onChange={(v) => togglePref("vax", v)}
          />
          <PrefRow
            icon={Navigation}
            label="Tracker activity"
            hint="Walks, transport, zoomies, geofence, battery — only when your pet has a collar."
            checked={account?.notificationPrefs.tracker ?? true}
            onChange={(v) => togglePref("tracker", v)}
          />
          <PrefRow
            icon={Megaphone}
            label="Offers & news"
            hint="Occasional updates from your daycare."
            checked={account?.notificationPrefs.marketing ?? false}
            onChange={(v) => togglePref("marketing", v)}
          />
        </div>
      </section>

      {/* YOUR PLAN --------------------------------------------------- */}
      {/* One link card surfacing the memberships screen. Sits above the
          household section because it's an account-level concern (billing,
          not pets) — and because the upsell only works if owners actually
          see it. */}
      <p className="text-eyebrow mb-2.5">Your plan</p>
      <Link
        to="/memberships?from=account"
        className="press group relative flex items-center gap-4 bg-card border border-border rounded-2xl p-4 mb-7 shadow-[var(--shadow-xs)] hover:border-primary/40 hover:shadow-[var(--shadow-md)] anim-slide-up overflow-hidden"
        style={{ animationDelay: "50ms" }}
      >
        {/* Subtle brand-tinted wash so this card reads as the aspirational
            row, distinct from the utility household links below. */}
        <span
          aria-hidden="true"
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(120% 80% at 100% 0%, color-mix(in srgb, var(--primary) 12%, transparent) 0%, transparent 60%)",
          }}
        />
        <div className="relative size-11 rounded-xl bg-secondary text-secondary-foreground grid place-items-center shrink-0">
          <Sparkles size={18} strokeWidth={2} />
        </div>
        <div className="relative flex-1 min-w-0">
          <h3 className="font-semibold text-[15px] leading-tight">Memberships</h3>
          <p className="text-[13px] text-muted-foreground mt-0.5 truncate">
            Five plans, real pricing, no commitment. See if one fits.
          </p>
        </div>
        <ChevronRight size={18} strokeWidth={2} className="relative text-muted-foreground/70 shrink-0 group-hover:text-primary transition-colors" />
      </Link>

      {/* YOUR HOUSEHOLD ---------------------------------------------- */}
      <p className="text-eyebrow mb-2.5">Your household</p>

      <Link
        to="/account/household"
        className="press group flex items-center gap-4 bg-card border border-border rounded-2xl p-4 mb-2.5 shadow-[var(--shadow-xs)] hover:border-primary/40 hover:shadow-[var(--shadow-md)] anim-slide-up"
        style={{ animationDelay: "60ms" }}
      >
        <div className="size-11 rounded-xl bg-secondary text-secondary-foreground grid place-items-center shrink-0">
          <Home size={18} strokeWidth={2} />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-[15px] leading-tight">Home & address</h3>
          <p className="text-[13px] text-muted-foreground mt-0.5 truncate">
            {householdLoading
              ? "Loading…"
              : household?.household.address?.split("\n")[0] || "Add your address"}
          </p>
        </div>
        <ChevronRight size={18} strokeWidth={2} className="text-muted-foreground/70 shrink-0 group-hover:text-primary transition-colors" />
      </Link>

      <Link
        to="/account/people"
        className="press group flex items-center gap-4 bg-card border border-border rounded-2xl p-4 mb-2.5 shadow-[var(--shadow-xs)] hover:border-primary/40 hover:shadow-[var(--shadow-md)] anim-slide-up"
        style={{ animationDelay: "100ms" }}
      >
        <div className="size-11 rounded-xl bg-secondary text-secondary-foreground grid place-items-center shrink-0">
          <Users size={18} strokeWidth={2} />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-[15px] leading-tight">People we can contact</h3>
          <p className="text-[13px] text-muted-foreground mt-0.5 truncate">
            {householdLoading
              ? "Loading…"
              : `${contactCount} ${contactCount === 1 ? "person" : "people"} on this household`}
          </p>
        </div>
        <ChevronRight size={18} strokeWidth={2} className="text-muted-foreground/70 shrink-0 group-hover:text-primary transition-colors" />
      </Link>

      <Link
        to="/account/documents"
        className="press group flex items-center gap-4 bg-card border border-border rounded-2xl p-4 mb-2.5 shadow-[var(--shadow-xs)] hover:border-primary/40 hover:shadow-[var(--shadow-md)] anim-slide-up"
        style={{ animationDelay: "120ms" }}
      >
        <div className="size-11 rounded-xl bg-secondary text-secondary-foreground grid place-items-center shrink-0">
          <FolderOpen size={18} strokeWidth={2} />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-[15px] leading-tight">Documents</h3>
          <p className="text-[13px] text-muted-foreground mt-0.5 truncate">
            Insurance, vet records, ID — yours and the team's.
          </p>
        </div>
        <ChevronRight size={18} strokeWidth={2} className="text-muted-foreground/70 shrink-0 group-hover:text-primary transition-colors" />
      </Link>

      <Link
        to="/pets/add"
        className="press group flex items-center gap-4 bg-card border border-border rounded-2xl p-4 mb-7 shadow-[var(--shadow-xs)] hover:border-primary/40 hover:shadow-[var(--shadow-md)] anim-slide-up"
        style={{ animationDelay: "160ms" }}
      >
        <div className="size-11 rounded-xl bg-secondary text-secondary-foreground grid place-items-center shrink-0">
          <Plus size={18} strokeWidth={2.2} />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-[15px] leading-tight">Add a new pet</h3>
          <p className="text-[13px] text-muted-foreground mt-0.5">
            The team will verify before bookings open.
          </p>
        </div>
        <ChevronRight size={18} strokeWidth={2} className="text-muted-foreground/70 shrink-0 group-hover:text-primary transition-colors" />
      </Link>

      {/* SIGN OUT ----------------------------------------------------- */}
      <button
        onClick={signOut}
        className="press inline-flex items-center justify-center gap-2 w-full h-12 rounded-2xl border border-border bg-card text-sm font-semibold hover:border-destructive/40 hover:text-destructive"
      >
        <LogOut size={16} strokeWidth={2.2} />
        Sign out
      </button>
    </main>
  );
}

function PrefRow({
  icon: Icon, label, hint, checked, onChange,
}: {
  icon: typeof Bell;
  label: string;
  hint: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-start gap-3 cursor-pointer">
      <Icon size={15} strokeWidth={2} className="mt-1 text-muted-foreground shrink-0" />
      <span className="flex-1 min-w-0">
        <span className="block text-[14px] font-medium leading-tight">{label}</span>
        <span className="block text-[12.5px] text-muted-foreground mt-0.5 leading-relaxed">{hint}</span>
      </span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-1 size-5 rounded border-2 border-border accent-primary cursor-pointer shrink-0"
      />
    </label>
  );
}
