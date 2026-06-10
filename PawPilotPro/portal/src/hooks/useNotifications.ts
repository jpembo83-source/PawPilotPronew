import { usePortalQuery } from "./usePortalQuery";

export interface PortalNotification {
  id: string;
  type: string;
  payload: Record<string, unknown>;
  link: string | null;
  readAt: string | null;
  createdAt: string;
}

export function useNotifications() {
  return usePortalQuery<{ notifications: PortalNotification[] }>(
    ["portal", "notifications"],
    "/portal/notifications",
    { staleTime: 10_000 },
  );
}
