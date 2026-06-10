/**
 * StepLocation — pick the daycare branch the booking is for.
 *
 * Sits between StepPets and StepDates in the wizard.  Reads from
 * GET /portal/locations (filtered server-side to the household's tenant)
 * and surfaces each location with whatever owner-facing rules copy the
 * staff have published — typically a one-liner like "small to medium
 * dogs only" or "dachshunds only".
 *
 * Picking a location is recommended but not strictly required — owners
 * can skip and the staff queue will assign a location at confirmation.
 * That keeps the wizard moving when a tenant hasn't set up location
 * rules yet, and matches the legacy behaviour for installs that pre-date
 * this step.  If only one location is bookable we auto-select and skip.
 *
 * Trust + safety: the location rules aren't enforced here (a pug owner
 * could pick The Social Sausage and submit anyway) — they're surfaced
 * so owners can make an informed pick, and staff still has the final
 * yes/no at the queue.
 */
import { useEffect } from "react";
import { Check, MapPin, Users } from "lucide-react";
import { useBookingDraftStore } from "@/stores/bookingDraftStore";
import { usePortalQuery } from "@/hooks/usePortalQuery";
import { Skeleton } from "@/components/Skeleton";

interface PortalLocation {
  id: string;
  name: string;
  address: string | null;
  rulesCopy: string | null;
  sizeRule: string | null;
  breedRule: string | string[] | null;
  capacity: number | null;
}

function ruleSummary(loc: PortalLocation): string | null {
  if (loc.rulesCopy && loc.rulesCopy.trim().length > 0) return loc.rulesCopy;
  if (loc.sizeRule) return `${loc.sizeRule} dogs`;
  if (loc.breedRule) {
    if (Array.isArray(loc.breedRule)) return `${loc.breedRule.join(", ")} only`;
    return loc.breedRule;
  }
  return null;
}

export function StepLocation({ onNext }: { onNext: () => void }) {
  const { locationId, setLocationId } = useBookingDraftStore();
  const { data, isLoading } = usePortalQuery<{ locations: PortalLocation[] }>(
    ["portal", "locations"],
    "/portal/locations",
  );
  const locations = data?.locations ?? [];

  // Auto-advance when there's a single bookable location — no point
  // making the owner tap "continue" through a single-option list.
  useEffect(() => {
    if (!isLoading && locations.length === 1 && !locationId) {
      setLocationId(locations[0]!.id);
    }
  }, [isLoading, locations, locationId, setLocationId]);

  if (isLoading) {
    return (
      <>
        <header className="mb-6 anim-fade-in">
          <p className="text-eyebrow mb-2">Step 3</p>
          <h1 className="text-display-sm">Which branch?</h1>
        </header>
        <ul className="space-y-2.5">
          <li><Skeleton className="h-[88px] rounded-2xl" /></li>
          <li><Skeleton className="h-[88px] rounded-2xl opacity-70" /></li>
          <li><Skeleton className="h-[88px] rounded-2xl opacity-50" /></li>
        </ul>
      </>
    );
  }

  if (locations.length === 0) {
    // Defensive fallback — empty staff configuration shouldn't block bookings,
    // we just skip the picker entirely and let the staff queue assign one.
    return (
      <>
        <header className="mb-6 anim-fade-in">
          <p className="text-eyebrow mb-2">Step 3</p>
          <h1 className="text-display-sm">Which branch?</h1>
          <p className="text-[14px] text-muted-foreground mt-1.5">
            The team will choose the right one for you. Skip on through.
          </p>
        </header>
        <button
          onClick={onNext}
          className="press group relative flex items-center justify-center gap-2 w-full h-14 rounded-2xl bg-primary text-primary-foreground font-semibold shadow-[var(--shadow-sm)] hover:shadow-[var(--shadow-md)] overflow-hidden"
        >
          <span className="tracking-[-0.005em]">Continue</span>
        </button>
      </>
    );
  }

  return (
    <>
      <header className="mb-6 anim-fade-in">
        <p className="text-eyebrow mb-2">Step 3</p>
        <h1 className="text-display-sm mb-1.5">Which branch?</h1>
        <p className="text-[14px] text-muted-foreground">
          Each branch caters to different pups. Pick the one that fits yours.
        </p>
      </header>

      <ul className="space-y-2.5 mb-7">
        {locations.map((loc, i) => {
          const selected = locationId === loc.id;
          const rule = ruleSummary(loc);
          return (
            <li
              key={loc.id}
              className="anim-slide-up"
              style={{ animationDelay: `${i * 50}ms` }}
            >
              <button
                onClick={() => setLocationId(loc.id)}
                aria-pressed={selected}
                className={`press w-full p-4 rounded-2xl border bg-card text-left hover:shadow-[var(--shadow-md)] ${
                  selected
                    ? "border-primary ring-2 ring-primary/15 shadow-[var(--shadow-sm)]"
                    : "border-border hover:border-primary/40"
                }`}
              >
                <div className="flex items-start gap-3.5">
                  <div
                    className="size-11 rounded-xl bg-secondary text-secondary-foreground grid place-items-center shrink-0"
                    aria-hidden="true"
                  >
                    <MapPin size={18} strokeWidth={2} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-[15px] leading-tight">{loc.name}</p>
                    {rule && (
                      <p className="text-[12.5px] text-muted-foreground mt-1 leading-snug">
                        {rule}
                      </p>
                    )}
                    {loc.address && (
                      <p className="text-[11.5px] text-muted-foreground/80 mt-1 truncate">
                        {loc.address}
                      </p>
                    )}
                    {typeof loc.capacity === "number" && (
                      <p className="inline-flex items-center gap-1.5 mt-2 text-[11.5px] text-muted-foreground">
                        <Users size={12} strokeWidth={2.2} />
                        Up to {loc.capacity} dogs / day
                      </p>
                    )}
                  </div>
                  <div
                    className={`size-6 rounded-full grid place-items-center shrink-0 transition-colors mt-0.5 ${
                      selected ? "bg-primary text-primary-foreground" : "border border-border"
                    }`}
                    aria-hidden="true"
                  >
                    {selected && <Check size={14} strokeWidth={3} />}
                  </div>
                </div>
              </button>
            </li>
          );
        })}
      </ul>

      <button
        disabled={!locationId}
        onClick={onNext}
        className="press group relative flex items-center justify-center gap-2 w-full h-14 rounded-2xl bg-primary text-primary-foreground font-semibold shadow-[var(--shadow-sm)] hover:shadow-[var(--shadow-md)] disabled:opacity-50 disabled:cursor-not-allowed overflow-hidden"
      >
        <span
          className="absolute inset-x-0 top-0 h-px bg-white/20 pointer-events-none"
          aria-hidden="true"
        />
        <span className="tracking-[-0.005em]">Continue</span>
      </button>

      <p className="mt-3 text-center text-[12px] text-muted-foreground">
        Not sure? Pick the closest one — staff can move you if it's a better fit.
      </p>
    </>
  );
}
