import { Check } from "lucide-react";
import { useBookingDraftStore } from "@/stores/bookingDraftStore";
import { SERVICES, stepsFor } from "./bookingSteps";

export function StepService({ onNext }: { onNext: () => void }) {
  const { service, setService } = useBookingDraftStore();
  return (
    <>
      <header className="mb-6 anim-fade-in">
        <p className="text-eyebrow mb-2">Step 1</p>
        <h1 className="text-display-sm mb-1.5">What are we booking?</h1>
        <p className="text-[14px] text-muted-foreground">Pick a service to start.</p>
      </header>

      <ul className="grid grid-cols-1 gap-2.5">
        {SERVICES.map((s, i) => {
          const selected = service === s.id;
          return (
            <li
              key={s.id}
              className="anim-slide-up"
              style={{ animationDelay: `${i * 50}ms` }}
            >
              <button
                onClick={() => { setService(s.id); onNext(); }}
                aria-pressed={selected}
                className={`press group w-full text-left p-4 rounded-2xl border hover:shadow-[var(--shadow-md)] ${
                  selected
                    ? "border-primary ring-2 ring-primary/15 bg-secondary shadow-[var(--shadow-sm)]"
                    : "bg-card border-border hover:border-primary/40"
                }`}
              >
                <div className="flex items-center gap-3.5">
                  <div
                    className="size-12 rounded-full bg-secondary text-secondary-foreground grid place-items-center text-2xl shrink-0"
                    aria-hidden="true"
                  >
                    {s.emoji}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-[15px] leading-tight">{s.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{s.subtitle}</p>
                    {/* Wizard length up front — the count is live from
                        stepsFor, so it can't drift from the real flow. */}
                    <p className="text-[11px] text-muted-foreground/80 mt-1 text-tabular">
                      {stepsFor(s.id).length} quick steps
                    </p>
                  </div>
                  {selected && (
                    <div className="size-6 rounded-full bg-primary text-primary-foreground grid place-items-center shrink-0">
                      <Check size={14} strokeWidth={3} />
                    </div>
                  )}
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </>
  );
}
