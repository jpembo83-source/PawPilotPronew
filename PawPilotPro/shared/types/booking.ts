export type Service = "daycare" | "grooming" | "overnights" | "transport";
export type BookingStatus = "pending" | "confirmed" | "declined" | "cancelled";

export interface Booking {
  id: string;
  tenantId: string;
  /**
   * Owning household. Was previously typed as `customerId` to match older
   * staff CRM language, but every record on the wire (portal_bookings.ts
   * writes) uses `householdId`. Renamed here to match — no consumer was
   * reading `customerId` so the rename is non-breaking.
   */
  householdId: string;
  petIds: string[];
  service: Service;
  startAt: string; // ISO
  endAt: string;   // ISO
  status: BookingStatus;
  notes: string | null;
  ownerSubmitted: boolean;
  requestId: string | null; // idempotency key
  declineReason?: string | null;
  statusChangedAt?: string | null;
  staffId?: string | null;
  createdAt: string;
  updatedAt: string;
}
