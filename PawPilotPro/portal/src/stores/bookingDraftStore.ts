import { create } from "zustand";
import type { Service } from "@shared/types/booking";

/**
 * Cross-sell add-ons (Phase D). Each is an opt-in chip the wizard offers
 * after the primary service + dates are picked. Times default to the
 * primary booking's window so the owner doesn't have to set them again
 * — they can refine if needed via the optional override fields.
 *
 *   transport: pickup+drop-off using the primary daycare/overnight window
 *   grooming:  same-day groom slot during the primary daycare window
 *
 * Grooming as an add-on is only offered when the primary is daycare;
 * transport is offered for daycare AND overnights.
 */
export type AddOnState = "off" | "on";

interface AddOns {
  transport: AddOnState;
  grooming: AddOnState;
}

const EMPTY_ADD_ONS: AddOns = { transport: "off", grooming: "off" };

interface BookingDraft {
  service: Service | null;
  petIds: string[];
  /** Tenant location (Manegg / Social Sausage / Seefeld for MDC). */
  locationId: string | null;
  startAt: string | null;
  endAt: string | null;
  notes: string;
  addOns: AddOns;
  requestId: string;
  setService: (s: Service) => void;
  setPetIds: (ids: string[]) => void;
  setLocationId: (id: string | null) => void;
  setDates: (start: string, end: string) => void;
  setNotes: (n: string) => void;
  setAddOn: (kind: keyof AddOns, value: AddOnState) => void;
  isComplete: () => boolean;
  /** True if at least one add-on is on. Drives bundle-vs-single submit. */
  hasAddOns: () => boolean;
  reset: () => void;
}

function newRequestId() { return crypto.randomUUID(); }

export const useBookingDraftStore = create<BookingDraft>((set, get) => ({
  service: null,
  petIds: [],
  locationId: null,
  startAt: null,
  endAt: null,
  notes: "",
  addOns: EMPTY_ADD_ONS,
  requestId: newRequestId(),
  setService: (s) => set({ service: s, addOns: EMPTY_ADD_ONS }),
  setPetIds: (ids) => set({ petIds: ids }),
  setLocationId: (id) => set({ locationId: id }),
  setDates: (startAt, endAt) => set({ startAt, endAt }),
  setNotes: (n) => set({ notes: n }),
  setAddOn: (kind, value) => set((st) => ({ addOns: { ...st.addOns, [kind]: value } })),
  isComplete: () => {
    const s = get();
    // locationId intentionally NOT required for isComplete — the staff queue
    // can assign a location at confirmation if the owner skipped picking
    // one. Only the must-have wizard fields gate "complete" here.
    return !!(s.service && s.petIds.length > 0 && s.startAt && s.endAt);
  },
  hasAddOns: () => {
    const a = get().addOns;
    return a.transport === "on" || a.grooming === "on";
  },
  reset: () => set({
    service: null,
    petIds: [],
    locationId: null,
    startAt: null,
    endAt: null,
    notes: "",
    addOns: EMPTY_ADD_ONS,
    requestId: newRequestId(),
  }),
}));
