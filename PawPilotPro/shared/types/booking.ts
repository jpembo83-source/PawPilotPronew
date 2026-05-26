export type Service = "daycare" | "grooming" | "overnights" | "transport";
export type BookingStatus = "pending" | "confirmed" | "declined" | "cancelled";

export interface Booking {
  id: string;
  tenantId: string;
  customerId: string;
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
