// portal_users link helpers — one household, MANY portal logins.
//
// History: the link record stored a single `authUserId`, so a household
// could only ever have one working portal login; a second accepted invite
// silently replaced the first (locking that person out). The record now
// carries `authUserIds: string[]`. `authUserId` is retained as the FIRST
// linked user ("primary") so existing readers — staff activity UI,
// password reset, notification enrichment — keep working unchanged.
//
// Pure module: no Deno / kv imports, so it is unit-testable under vitest.

export interface PortalUsersLink {
  tenantId: string;
  householdId: string;
  /** Primary (first-linked) auth user — kept for backward compatibility. */
  authUserId?: string;
  /** Every auth user allowed to sign into this household's portal. */
  authUserIds?: string[];
  notificationPrefs?: Record<string, boolean>;
  createdAt?: string;
  [key: string]: unknown;
}

/** All auth user ids linked to a household, tolerating legacy records. */
export function linkedUserIds(link: unknown): string[] {
  if (!link || typeof link !== "object") return [];
  const l = link as PortalUsersLink;
  const ids = Array.isArray(l.authUserIds) ? l.authUserIds.filter((id) => typeof id === "string") : [];
  if (typeof l.authUserId === "string" && l.authUserId && !ids.includes(l.authUserId)) {
    ids.unshift(l.authUserId);
  }
  return ids;
}

/** Authorization check used by every portal endpoint guard. */
export function isLinkedPortalUser(link: unknown, userId: string): boolean {
  if (!userId) return false;
  return linkedUserIds(link).includes(userId);
}

/**
 * Returns the link with `userId` added (idempotent). Creates the record when
 * none exists; never discards fields an existing record already carries
 * (notification prefs, createdAt) and never demotes the existing primary.
 */
export function withLinkedUser(
  link: unknown,
  base: { tenantId: string; householdId: string },
  userId: string,
): PortalUsersLink {
  const existing = link && typeof link === "object" ? (link as PortalUsersLink) : null;
  const ids = existing ? linkedUserIds(existing) : [];
  if (!ids.includes(userId)) ids.push(userId);
  return {
    ...(existing ?? { createdAt: new Date().toISOString() }),
    tenantId: base.tenantId,
    householdId: base.householdId,
    authUserId: ids[0],
    authUserIds: ids,
  };
}

/**
 * Returns the link with `userId` removed, or null when no linked users
 * remain (caller should delete the record in that case).
 */
export function withoutLinkedUser(link: unknown, userId: string): PortalUsersLink | null {
  const existing = link && typeof link === "object" ? (link as PortalUsersLink) : null;
  if (!existing) return null;
  const ids = linkedUserIds(existing).filter((id) => id !== userId);
  if (ids.length === 0) return null;
  return { ...existing, authUserId: ids[0], authUserIds: ids };
}
