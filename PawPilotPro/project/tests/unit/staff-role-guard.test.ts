// resolveStaffRole: the staff-surface admission guard. A verified JWT alone
// is not a staff token — customer portal accounts (portal_user) and
// role-less accounts must be rejected, never defaulted to 'staff'.
import { describe, it, expect } from 'vitest';
import './setup';
import { resolveStaffRole } from '../../supabase/functions/server/_shared/auth.ts';

describe('resolveStaffRole — staff-surface admission', () => {
  it('rejects customer portal accounts (created without a role)', () => {
    // Portal accept-invite sets only portal_user/tenant/household — no role.
    expect(resolveStaffRole({ portal_user: true })).toBeNull();
    expect(resolveStaffRole({ portal_user: true, tenant_id: 't1', household_id: 'hh-1' })).toBeNull();
  });

  it('dual accounts (staff who also accepted a portal invite) keep their staff role', () => {
    expect(resolveStaffRole({ portal_user: true, role: 'admin' })).toBe('admin');
    expect(resolveStaffRole({ portal_user: true, role: 'staff' })).toBe('staff');
  });

  it('rejects accounts with no role — never defaults to staff', () => {
    expect(resolveStaffRole({})).toBeNull();
    expect(resolveStaffRole(undefined)).toBeNull();
    expect(resolveStaffRole(null)).toBeNull();
    expect(resolveStaffRole({ tenant_id: 't1' })).toBeNull();
  });

  it('rejects unknown or non-string roles', () => {
    expect(resolveStaffRole({ role: 'superuser' })).toBeNull();
    expect(resolveStaffRole({ role: 42 })).toBeNull();
    expect(resolveStaffRole({ role: null })).toBeNull();
    expect(resolveStaffRole({ role: ['admin'] })).toBeNull();
  });

  it('admits each valid staff role', () => {
    expect(resolveStaffRole({ role: 'admin' })).toBe('admin');
    expect(resolveStaffRole({ role: 'manager' })).toBe('manager');
    expect(resolveStaffRole({ role: 'assistant_manager' })).toBe('assistant_manager');
    expect(resolveStaffRole({ role: 'staff' })).toBe('staff');
  });

  it('the role decides — portal_user flag alone neither grants nor blocks', () => {
    expect(resolveStaffRole({ portal_user: false, role: 'manager' })).toBe('manager');
    expect(resolveStaffRole({ portal_user: false })).toBeNull();
  });
});
