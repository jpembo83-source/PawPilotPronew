import { Check, Clock, PawPrint } from "lucide-react";
import { useBookingDraftStore } from "@/stores/bookingDraftStore";
import { usePortalQuery } from "@/hooks/usePortalQuery";
import { Skeleton } from "@/components/Skeleton";
import type { Pet } from "@shared/types/pet";

export function StepPets({ onNext }: { onNext: () => void }) {
  const { service, petIds, setPetIds } = useBookingDraftStore();
  const { data, isLoading } = usePortalQuery<{ pets: Pet[] }>(["portal", "pets"], "/portal/pets");
  const multi = service === "daycare" || service === "overnights";

  // Owner-added pets sit in 'pending_staff_review' until the team verifies
  // identity / microchip. They show in the pets list but must not be
  // selectable for bookings yet.  We render them in a separate "awaiting
  // verification" block so the owner can SEE the pet they just added
  // (rather than wondering if it submitted) and understand why it can't
  // be picked.
  const bookablePets = (data?.pets ?? []).filter(
    (p) => (p.verificationStatus ?? "verified") === "verified",
  );
  const pendingPets = (data?.pets ?? []).filter(
    (p) => (p.verificationStatus ?? "verified") !== "verified",
  );
  const pendingCount = pendingPets.length;

  function toggle(id: string) {
    if (multi) setPetIds(petIds.includes(id) ? petIds.filter((p) => p !== id) : [...petIds, id]);
    else setPetIds([id]);
  }

  if (isLoading || !data) {
    return (
      <>
        <header className="mb-6 anim-fade-in">
          <p className="text-eyebrow mb-2">Step 2</p>
          <h1 className="text-display-sm">Which pets?</h1>
        </header>
        <ul className="space-y-2.5">
          <li><Skeleton className="h-[72px] rounded-2xl" /></li>
          <li><Skeleton className="h-[72px] rounded-2xl opacity-60" /></li>
        </ul>
      </>
    );
  }

  if (bookablePets.length === 0) {
    return (
      <>
        <header className="mb-6 anim-fade-in">
          <p className="text-eyebrow mb-2">Step 2</p>
          <h1 className="text-display-sm">No bookable pets yet</h1>
        </header>
        <div className="rounded-2xl border border-dashed border-border bg-card/40 px-5 py-8 text-center">
          <p className="text-[13px] text-muted-foreground">
            {pendingCount > 0
              ? "Your new pet is awaiting team verification. We'll let you know as soon as bookings open."
              : "Add a pet to your household, then come back here to book."}
          </p>
        </div>
      </>
    );
  }

  return (
    <>
      <header className="mb-6 anim-fade-in">
        <p className="text-eyebrow mb-2">Step 2</p>
        <h1 className="text-display-sm mb-1.5">{multi ? "Which pets?" : "Which pet?"}</h1>
        <p className="text-[14px] text-muted-foreground">{multi ? "Pick one or more." : "Pick one."}</p>
      </header>

      <ul className="space-y-2.5 mb-4">
        {bookablePets.map((p, i) => {
          const selected = petIds.includes(p.id);
          return (
            <li
              key={p.id}
              className="anim-slide-up"
              style={{ animationDelay: `${i * 50}ms` }}
            >
              <button
                onClick={() => toggle(p.id)}
                aria-pressed={selected}
                className={`press w-full p-3.5 rounded-2xl border bg-card flex items-center gap-3.5 hover:shadow-[var(--shadow-md)] ${
                  selected
                    ? "border-primary ring-2 ring-primary/15 shadow-[var(--shadow-sm)]"
                    : "border-border hover:border-primary/40"
                }`}
              >
                {p.photoUrl ? (
                  <img
                    src={p.photoUrl}
                    alt=""
                    className="size-14 rounded-full object-cover shrink-0 ring-1 ring-border"
                  />
                ) : (
                  <div
                    className="size-14 rounded-full bg-secondary text-secondary-foreground grid place-items-center shrink-0"
                    aria-hidden="true"
                  >
                    <PawPrint size={24} strokeWidth={2} />
                  </div>
                )}
                <div className="flex-1 text-left min-w-0">
                  <p className="font-semibold text-[15px] leading-tight truncate">{p.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">{p.breed || "—"}</p>
                </div>
                <div
                  className={`size-6 rounded-full grid place-items-center shrink-0 transition-colors ${
                    selected
                      ? "bg-primary text-primary-foreground"
                      : "border border-border"
                  }`}
                  aria-hidden="true"
                >
                  {selected && <Check size={14} strokeWidth={3} />}
                </div>
              </button>
            </li>
          );
        })}
      </ul>

      {/* Pending verification — visible but not selectable. So owners
          can confirm the pet they JUST added actually got recorded
          rather than wondering if the add silently failed. */}
      {pendingCount > 0 && (
        <section className="mb-7">
          <p className="text-eyebrow mb-2.5 inline-flex items-center gap-1.5 text-muted-foreground">
            <Clock size={11} strokeWidth={2.4} />
            Awaiting team verification
          </p>
          <ul className="space-y-2.5">
            {pendingPets.map((p, i) => (
              <li
                key={p.id}
                className="anim-slide-up"
                style={{ animationDelay: `${(bookablePets.length + i) * 50}ms` }}
              >
                <div
                  aria-disabled="true"
                  className="w-full p-3.5 rounded-2xl border border-dashed border-border bg-card/40 flex items-center gap-3.5 opacity-80"
                >
                  {p.photoUrl ? (
                    <img
                      src={p.photoUrl}
                      alt=""
                      className="size-14 rounded-full object-cover shrink-0 ring-1 ring-border grayscale"
                    />
                  ) : (
                    <div
                      className="size-14 rounded-full bg-secondary text-secondary-foreground/70 grid place-items-center shrink-0"
                      aria-hidden="true"
                    >
                      <PawPrint size={24} strokeWidth={2} />
                    </div>
                  )}
                  <div className="flex-1 text-left min-w-0">
                    <p className="font-medium text-[15px] leading-tight truncate">{p.name}</p>
                    <p className="text-[12px] text-muted-foreground mt-0.5">
                      Bookings open after the team verifies — usually within a working day.
                    </p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <button
        disabled={petIds.length === 0}
        onClick={onNext}
        className="press group relative flex items-center justify-center gap-2 w-full h-14 rounded-2xl bg-primary text-primary-foreground font-semibold shadow-[var(--shadow-sm)] hover:shadow-[var(--shadow-md)] disabled:opacity-50 disabled:cursor-not-allowed overflow-hidden"
      >
        <span
          className="absolute inset-x-0 top-0 h-px bg-white/20 pointer-events-none"
          aria-hidden="true"
        />
        <span className="tracking-[-0.005em]">Continue</span>
      </button>
    </>
  );
}
