import { describe, it, expect } from 'vitest';
import './setup';
import { derivePortalStatus, portalStatusPresentation } from '../../src/app/modules/customers/portalStatus';

// Pins the shared portal-status derivation used by both the household-header
// chip and PortalActivityTab. Link beats invites; pending beats expired;
// expired is distinct from never-invited.

const NOW = new Date('2026-07-10T12:00:00Z');
const hoursFromNow = (h: number) => new Date(NOW.getTime() + h * 3_600_000).toISOString();

describe('derivePortalStatus', () => {
  it('linked and not suspended → active', () => {
    expect(derivePortalStatus({ link: { authUserId: 'u1' }, pendingInvites: [] }, NOW))
      .toEqual({ state: 'active' });
  });

  it('linked and suspended → paused', () => {
    expect(derivePortalStatus({ link: { authUserId: 'u1' }, pendingInvites: [], suspended: true }, NOW))
      .toEqual({ state: 'paused' });
  });

  it('link wins over outstanding invites', () => {
    expect(derivePortalStatus(
      { link: { authUserId: 'u1' }, pendingInvites: [{ expiresAt: hoursFromNow(5) }] },
      NOW,
    )).toEqual({ state: 'active' });
  });

  it('unexpired invite → invite_pending with hours to the latest expiry', () => {
    const status = derivePortalStatus(
      { link: null, pendingInvites: [{ expiresAt: hoursFromNow(3) }, { expiresAt: hoursFromNow(18) }] },
      NOW,
    );
    expect(status).toEqual({ state: 'invite_pending', hoursLeft: 18 });
  });

  it('expired invites (server field) → invite_expired', () => {
    expect(derivePortalStatus(
      { link: null, pendingInvites: [], expiredInvites: [{ expiresAt: hoursFromNow(-2) }] },
      NOW,
    )).toEqual({ state: 'invite_expired' });
  });

  it('stale "pending" payload whose invite has lapsed → invite_expired, never pending', () => {
    expect(derivePortalStatus(
      { link: null, pendingInvites: [{ expiresAt: hoursFromNow(-1) }] },
      NOW,
    )).toEqual({ state: 'invite_expired' });
  });

  it('pending wins over expired when both exist', () => {
    expect(derivePortalStatus(
      {
        link: null,
        pendingInvites: [{ expiresAt: hoursFromNow(4) }],
        expiredInvites: [{ expiresAt: hoursFromNow(-30) }],
      },
      NOW,
    )).toEqual({ state: 'invite_pending', hoursLeft: 4 });
  });

  it('no link, no invites → not_invited', () => {
    expect(derivePortalStatus({ link: null, pendingInvites: [] }, NOW))
      .toEqual({ state: 'not_invited' });
  });
});

describe('portalStatusPresentation', () => {
  it('maps every state to the staff-facing label and tone', () => {
    expect(portalStatusPresentation({ state: 'active' })).toEqual({ label: 'Portal: Active', tone: 'positive' });
    expect(portalStatusPresentation({ state: 'paused' })).toEqual({ label: 'Paused', tone: 'warning' });
    expect(portalStatusPresentation({ state: 'invite_pending', hoursLeft: 7 }))
      .toEqual({ label: 'Invite pending · expires in 7h', tone: 'warning' });
    expect(portalStatusPresentation({ state: 'invite_pending', hoursLeft: 0 }))
      .toEqual({ label: 'Invite pending · expires soon', tone: 'warning' });
    expect(portalStatusPresentation({ state: 'invite_expired' })).toEqual({ label: 'Invite expired', tone: 'critical' });
    expect(portalStatusPresentation({ state: 'not_invited' })).toEqual({ label: 'Not invited', tone: 'neutral' });
  });
});
