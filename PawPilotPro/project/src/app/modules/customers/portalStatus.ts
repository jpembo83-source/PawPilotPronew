// Shared portal-status derivation — the single source of truth for turning a
// portal-activity payload into one of the five staff-facing states. Used by
// PortalActivityTab (tab header badge) and the household-header chip
// (PortalStatusChip); pure so it stays unit-testable without the auth chain.

export interface PortalInviteLike {
  expiresAt: string;
}

export interface PortalActivitySnapshot {
  link: object | null;
  pendingInvites: PortalInviteLike[];
  /** Unconsumed invites past expiry — older servers omit this field. */
  expiredInvites?: PortalInviteLike[];
  suspended?: boolean;
}

export type PortalStatus =
  | { state: 'active' }
  | { state: 'paused' }
  | { state: 'invite_pending'; hoursLeft: number }
  | { state: 'invite_expired' }
  | { state: 'not_invited' };

export function derivePortalStatus(data: PortalActivitySnapshot, now: Date = new Date()): PortalStatus {
  if (data.link) {
    return data.suspended ? { state: 'paused' } : { state: 'active' };
  }

  // The server already excludes expired invites from pendingInvites, but
  // re-check here so a stale payload can't render "pending" for a dead link.
  const pending = (data.pendingInvites ?? []).filter((i) => new Date(i.expiresAt) > now);
  if (pending.length > 0) {
    const latestExpiry = Math.max(...pending.map((i) => new Date(i.expiresAt).getTime()));
    const hoursLeft = Math.max(0, Math.round((latestExpiry - now.getTime()) / 3_600_000));
    return { state: 'invite_pending', hoursLeft };
  }

  const expired = [
    ...(data.expiredInvites ?? []),
    ...(data.pendingInvites ?? []).filter((i) => new Date(i.expiresAt) <= now),
  ];
  if (expired.length > 0) {
    return { state: 'invite_expired' };
  }

  return { state: 'not_invited' };
}

export type PortalStatusTone = 'positive' | 'warning' | 'critical' | 'neutral';

export function portalStatusPresentation(status: PortalStatus): { label: string; tone: PortalStatusTone } {
  switch (status.state) {
    case 'active':
      return { label: 'Portal: Active', tone: 'positive' };
    case 'paused':
      return { label: 'Paused', tone: 'warning' };
    case 'invite_pending':
      return {
        label: status.hoursLeft === 0
          ? 'Invite pending · expires soon'
          : `Invite pending · expires in ${status.hoursLeft}h`,
        tone: 'warning',
      };
    case 'invite_expired':
      return { label: 'Invite expired', tone: 'critical' };
    case 'not_invited':
      return { label: 'Not invited', tone: 'neutral' };
  }
}
