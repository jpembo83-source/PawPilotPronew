// flag_gate: operational-flag → check-in blocker/warning derivation.
import { describe, it, expect } from 'vitest';
import { flagCheckInIssues, flagLabel } from '../../supabase/functions/server/lib/flag_gate';

const flag = (overrides: Record<string, unknown> = {}) => ({
  id: 'flag-1',
  flag_key: 'behaviour_caution',
  severity: 'warn',
  is_active: true,
  pet_id: null,
  reason: 'Reactive around large dogs',
  ...overrides,
});

describe('flagLabel', () => {
  it('title-cases the flag key', () => {
    expect(flagLabel('behaviour_caution')).toBe('Behaviour Caution');
    expect(flagLabel('vip')).toBe('Vip');
  });
});

describe('flagCheckInIssues', () => {
  it('returns nothing for an empty list', () => {
    expect(flagCheckInIssues([], 'pet-1')).toEqual({ blockers: [], warnings: [] });
  });

  it('turns an active warn flag into a warning carrying the reason text', () => {
    const { blockers, warnings } = flagCheckInIssues([flag()], 'pet-1');
    expect(blockers).toHaveLength(0);
    expect(warnings).toHaveLength(1);
    expect(warnings[0].message).toBe('Behaviour Caution: Reactive around large dogs');
  });

  it('turns an active block flag into a blocker', () => {
    const { blockers, warnings } = flagCheckInIssues([flag({ severity: 'block' })], 'pet-1');
    expect(warnings).toHaveLength(0);
    expect(blockers).toHaveLength(1);
    expect(blockers[0].message).toContain('Behaviour Caution: Reactive around large dogs');
    expect(blockers[0].message).toContain('Clear this flag');
  });

  it('never gates on info flags', () => {
    const { blockers, warnings } = flagCheckInIssues([flag({ severity: 'info' })], 'pet-1');
    expect(blockers).toHaveLength(0);
    expect(warnings).toHaveLength(0);
  });

  it('ignores inactive flags', () => {
    const { blockers, warnings } = flagCheckInIssues(
      [flag({ severity: 'block', is_active: false })],
      'pet-1',
    );
    expect(blockers).toHaveLength(0);
    expect(warnings).toHaveLength(0);
  });

  it('scopes pet-linked flags to that pet only', () => {
    const petFlag = flag({ pet_id: 'pet-2', severity: 'block' });
    expect(flagCheckInIssues([petFlag], 'pet-1').blockers).toHaveLength(0);
    expect(flagCheckInIssues([petFlag], 'pet-2').blockers).toHaveLength(1);
  });

  it('applies household-wide flags (no pet_id) to every pet', () => {
    expect(flagCheckInIssues([flag({ severity: 'block' })], 'any-pet').blockers).toHaveLength(1);
  });

  it('omits the reason clause when reason is empty', () => {
    const { warnings } = flagCheckInIssues([flag({ reason: '  ' })], 'pet-1');
    expect(warnings[0].message).toBe('Behaviour Caution');
  });

  it('skips payment_hold flags when the caller already reported the hold', () => {
    const hold = flag({ flag_key: 'payment_hold', severity: 'block' });
    expect(flagCheckInIssues([hold], 'pet-1', { skipPaymentHold: true }).blockers).toHaveLength(0);
    expect(flagCheckInIssues([hold], 'pet-1').blockers).toHaveLength(1);
  });

  it('fails closed on malformed records', () => {
    const { blockers, warnings } = flagCheckInIssues(
      [null, 42, {}, { flag_key: 7, is_active: true }],
      'pet-1',
    );
    expect(blockers).toHaveLength(0);
    expect(warnings).toHaveLength(0);
  });
});
