export type NotificationType =
  | "booking.received"
  | "booking.confirmed"
  | "booking.declined"
  | "booking.cancelled"
  | "vax.approved"
  | "vax.rejected"
  | "vax.expiring";

export interface NotificationEvent<T = unknown> {
  id: string;
  tenantId: string;
  customerId: string;
  type: NotificationType;
  payload: T;
  link: string | null;
  readAt: string | null;
  createdAt: string;
}
