import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ChevronLeft, MapPin, Users, PawPrint } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { usePortalQuery } from "@/hooks/usePortalQuery";
import { Skeleton } from "@/components/Skeleton";
import { getPortalApi } from "@/lib/api";
import type { HouseholdResponse } from "@shared/types/household";

/**
 * Household hub — shows the address (editable inline) and link cards to
 * the people on the household and the "add a new pet" flow. The household
 * NAME is intentionally read-only: staff own that field (it appears on
 * invoices etc.) — the owner can change everything else.
 */
export function HouseholdScreen() {
  const nav = useNavigate();
  const queryClient = useQueryClient();
  const { data, isLoading } = usePortalQuery<HouseholdResponse>(
    ["portal", "household"],
    "/portal/household",
  );

  const [address, setAddress] = useState("");
  const [dirty, setDirty] = useState(false);

  // Hydrate the field once the query lands, but never overwrite an in-progress
  // edit — that would feel like the input "rejecting" the user's keystrokes.
  useEffect(() => {
    if (data?.household && !dirty) setAddress(data.household.address ?? "");
  }, [data?.household, dirty]);

  const save = useMutation({
    mutationFn: (next: string) =>
      getPortalApi().patch<{ ok: boolean }>("/portal/household", { address: next.trim() || null }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["portal", "household"] });
      queryClient.invalidateQueries({ queryKey: ["portal", "account"] });
      setDirty(false);
      toast.success("Address saved");
    },
    onError: (e: any) => toast.error(e?.message ?? "Couldn't save address"),
  });

  const contactCount = data?.contacts.length ?? 0;
  const primary = data?.contacts.find((co) => co.is_primary);

  return (
    <main className="px-5 pt-4 pb-8 max-w-md mx-auto">
      <BackHeader title="Your household" onBack={() => nav(-1)} />

      {/* HOUSEHOLD NAME ---------------------------------------------- */}
      <section className="anim-fade-in mb-5">
        <p className="text-eyebrow mb-2">Household</p>
        {isLoading || !data ? (
          <Skeleton className="h-7 w-44" />
        ) : (
          <h1 className="text-display-sm leading-tight">{data.household.name || "Your home"}</h1>
        )}
      </section>

      {/* ADDRESS CARD ------------------------------------------------ */}
      <section className="rounded-2xl bg-card border border-border p-5 mb-3 anim-slide-up">
        <header className="flex items-center gap-2.5 mb-3">
          <MapPin size={16} strokeWidth={2.2} className="text-muted-foreground" />
          <h2 className="text-eyebrow">Home address</h2>
        </header>
        <textarea
          value={address}
          onChange={(e) => { setAddress(e.target.value); setDirty(true); }}
          placeholder="Street, city, postcode"
          rows={3}
          className="w-full rounded-xl border border-input bg-input-background text-foreground text-[15px] p-3.5 leading-relaxed focus:outline-none focus:border-primary focus:ring-2 focus:ring-ring/30 transition-shadow resize-none"
        />
        <div className="flex items-center justify-end gap-2.5 mt-3">
          {dirty && (
            <button
              type="button"
              onClick={() => {
                setAddress(data?.household.address ?? "");
                setDirty(false);
              }}
              className="press text-[13px] text-muted-foreground hover:text-foreground px-3 py-2"
            >
              Cancel
            </button>
          )}
          <button
            type="button"
            disabled={!dirty || save.isPending}
            onClick={() => save.mutate(address)}
            className="press inline-flex items-center justify-center h-10 px-5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed shadow-[var(--shadow-xs)]"
          >
            {save.isPending ? "Saving…" : dirty ? "Save" : "Saved"}
          </button>
        </div>
      </section>

      {/* PEOPLE LINK ------------------------------------------------- */}
      <Link
        to="/account/people"
        className="press group flex items-center gap-4 bg-card border border-border rounded-2xl p-4 mb-3 shadow-[var(--shadow-xs)] hover:border-primary/40 hover:shadow-[var(--shadow-md)] anim-slide-up"
        style={{ animationDelay: "60ms" }}
      >
        <div className="size-11 rounded-xl bg-secondary text-secondary-foreground grid place-items-center shrink-0">
          <Users size={18} strokeWidth={2} />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-[15px] leading-tight">People on this household</h3>
          <p className="text-[13px] text-muted-foreground mt-0.5 truncate">
            {isLoading
              ? "Loading…"
              : primary
                ? `${primary.first_name} ${primary.last_name} · primary${contactCount > 1 ? ` + ${contactCount - 1}` : ""}`
                : `${contactCount} ${contactCount === 1 ? "person" : "people"}`}
          </p>
        </div>
        <span className="text-[12px] font-semibold text-primary tracking-tight">Manage</span>
      </Link>

      {/* ADD PET LINK ------------------------------------------------ */}
      <Link
        to="/pets/add"
        className="press group flex items-center gap-4 bg-card border border-border rounded-2xl p-4 shadow-[var(--shadow-xs)] hover:border-primary/40 hover:shadow-[var(--shadow-md)] anim-slide-up"
        style={{ animationDelay: "120ms" }}
      >
        <div className="size-11 rounded-xl bg-secondary text-secondary-foreground grid place-items-center shrink-0">
          <PawPrint size={18} strokeWidth={2} />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-[15px] leading-tight">Add a new pet</h3>
          <p className="text-[13px] text-muted-foreground mt-0.5">
            Tell the team about a new family member.
          </p>
        </div>
        <span className="text-[12px] font-semibold text-primary tracking-tight">Add</span>
      </Link>
    </main>
  );
}

function BackHeader({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <header className="flex items-center gap-2 mb-5 -ml-2 anim-fade-in">
      <button
        type="button"
        onClick={onBack}
        className="press p-2 rounded-full hover:bg-secondary/60"
        aria-label="Back"
      >
        <ChevronLeft size={20} strokeWidth={2.2} />
      </button>
      <span className="text-[15px] font-semibold tracking-tight">{title}</span>
    </header>
  );
}
