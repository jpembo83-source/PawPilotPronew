// Booking wizard step metadata — shared by BookingFlow (progress header)
// and StepService (per-service step counts on the cards). Moved out of
// BookingFlow so both can import it without a component-module cycle.
import { Sun, Scissors, Moon, Bus, type LucideIcon } from "lucide-react";
import type { Service } from "@shared/types/booking";

export type Step = "service" | "pets" | "location" | "dates" | "addons" | "review";

export const STEP_LABEL: Record<Step, string> = {
  service: "Service",
  pets: "Pets",
  location: "Where",
  dates: "When",
  addons: "Add-ons",
  review: "Review",
};

/** Add-ons step appears only for primary services that have cross-sells. */
export function supportsAddOns(service: string | null): boolean {
  return service === "daycare" || service === "overnights";
}

/**
 * Compute the live step list. We have to derive it from current draft
 * state instead of hard-coding because StepAddOns disappears the moment
 * the owner picks grooming/transport as primary — wizard goes from
 * 5 steps to 4, progress bar shrinks accordingly.
 */
export function stepsFor(service: string | null): Step[] {
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

// Icon primitives, not emoji — MASTER.md anti-pattern rule ("Emojis as
// icons — use SVG"), same rule stripEmoji() enforces on server copy.
export const SERVICES: { id: Service; title: string; subtitle: string; icon: LucideIcon }[] = [
  { id: "daycare",    title: "Daycare",    subtitle: "Drop-off & pick-up the same day", icon: Sun },
  { id: "grooming",   title: "Grooming",   subtitle: "Bath, full groom, nail trim",     icon: Scissors },
  { id: "overnights", title: "Overnights", subtitle: "Multi-night boarding",            icon: Moon },
  { id: "transport",  title: "Transport",  subtitle: "Pickup / drop-off add-on",        icon: Bus },
];

/** Display title for the context bar ("Daycare · Rex & Luna"). */
export function serviceTitle(service: string | null): string | null {
  return SERVICES.find((s) => s.id === service)?.title ?? null;
}

/** "Rex", "Rex & Luna", "Rex, Luna & Alfie" */
export function joinPetNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} & ${names[names.length - 1]!}`;
}
