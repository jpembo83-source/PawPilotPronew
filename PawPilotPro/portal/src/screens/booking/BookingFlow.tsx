import { useNavigate, useSearchParams } from "react-router-dom";
import { useEffect } from "react";
import { ChevronLeft, X } from "lucide-react";
import { useBookingDraftStore } from "@/stores/bookingDraftStore";
import { StepService } from "./StepService";
import { StepPets } from "./StepPets";
import { StepLocation } from "./StepLocation";
import { StepDates } from "./StepDates";
import { StepAddOns } from "./StepAddOns";
import { StepReview } from "./StepReview";

type Step = "service" | "pets" | "location" | "dates" | "addons" | "review";

const STEP_LABEL: Record<Step, string> = {
  service: "Service",
  pets: "Pets",
  location: "Where",
  dates: "When",
  addons: "Add-ons",
  review: "Review",
};

/** Add-ons step appears only for primary services that have cross-sells. */
function supportsAddOns(service: string | null): boolean {
  return service === "daycare" || service === "overnights";
}

/**
 * Compute the live step list. We have to derive it from current draft
 * state instead of hard-coding because StepAddOns disappears the moment
 * the owner picks grooming/transport as primary — wizard goes from
 * 5 steps to 4, progress bar shrinks accordingly.
 */
function stepsFor(service: string | null): Step[] {
  // Location is only meaningful for services that physically happen AT a
  // branch — daycare and overnights.  Grooming + transport (the latter
  // operates the pickup leg) don't need an "at which branch" pick today;
  // staff handles the routing. Skip the step for those to keep the
  // wizard short.
  const base: Step[] = ["service", "pets"];
  if (service === "daycare" || service === "overnights") base.push("location");
  base.push("dates");
  if (supportsAddOns(service)) base.push("addons");
  base.push("review");
  return base;
}

export function BookingFlow() {
  const [params, setParams] = useSearchParams();
  const nav = useNavigate();
  const draft = useBookingDraftStore();
  const steps = stepsFor(draft.service);
  const step = (params.get("step") as Step) ?? "service";
  // If the owner backtracks to "service" and changes the primary to one
  // that doesn't support add-ons, an "addons" query param in history
  // becomes invalid — fall back to review in that case.
  const safeStep: Step = steps.includes(step) ? step : "review";
  const idx = steps.indexOf(safeStep);
  const progress = ((idx + 1) / steps.length) * 100;

  useEffect(() => {
    if (!params.get("step")) draft.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setStep = (s: Step) => setParams({ step: s });
  const goBack = () => (idx === 0 ? nav("/") : setStep(steps[idx - 1]!));
  const goNext = () => setStep(steps[Math.min(idx + 1, steps.length - 1)]!);
  const isFirst = idx === 0;

  return (
    <div className="min-h-dvh bg-background">
      <header
        className="sticky top-0 z-30 px-3 py-3 bg-card/85 backdrop-blur-md border-b border-border/60"
        style={{ paddingTop: "calc(0.75rem + var(--safe-top))" }}
      >
        <div className="max-w-md mx-auto flex items-center justify-between gap-3">
          <button
            onClick={goBack}
            className="press inline-flex items-center gap-0.5 -ml-1 h-9 pr-3 pl-1.5 rounded-lg text-sm font-medium text-primary"
            aria-label={isFirst ? "Cancel booking" : "Back"}
          >
            {isFirst ? (
              <>
                <X size={16} strokeWidth={2.5} />
                <span className="ml-0.5">Cancel</span>
              </>
            ) : (
              <>
                <ChevronLeft size={16} strokeWidth={2.5} />
                Back
              </>
            )}
          </button>
          <div className="text-eyebrow text-tabular" style={{ color: "var(--muted-foreground)" }}>
            {STEP_LABEL[safeStep]} · {idx + 1}/{steps.length}
          </div>
          <span className="w-16 invisible" aria-hidden="true">spacer</span>
        </div>
      </header>

      {/* Progress bar -------------------------------------------------- */}
      <div
        className="h-1 bg-muted overflow-hidden"
        role="progressbar"
        aria-valuenow={idx + 1}
        aria-valuemin={1}
        aria-valuemax={steps.length}
        aria-label={`Booking step ${idx + 1} of ${steps.length}`}
      >
        <div
          className="h-full bg-gradient-to-r from-primary to-primary/80 transition-[width] duration-500"
          style={{ width: `${progress}%`, transitionTimingFunction: "var(--ease-out-quart)" }}
        />
      </div>

      <main key={safeStep} className="px-5 pt-7 pb-10 max-w-md mx-auto anim-fade-in">
        {safeStep === "service"  && <StepService  onNext={goNext} />}
        {safeStep === "pets"     && <StepPets     onNext={goNext} />}
        {safeStep === "location" && <StepLocation onNext={goNext} />}
        {safeStep === "dates"    && <StepDates    onNext={goNext} />}
        {safeStep === "addons"   && <StepAddOns   onNext={goNext} />}
        {safeStep === "review"   && <StepReview />}
      </main>
    </div>
  );
}
