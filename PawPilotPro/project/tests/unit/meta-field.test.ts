import { describe, it, expect } from 'vitest';
import './setup';
import { metaField } from '../../supabase/functions/server/_shared/auth.ts';

describe('metaField — app_metadata-first authorization reads', () => {
  it('prefers app_metadata over client-writable user_metadata', () => {
    const u = { app_metadata: { tenant_id: 'server-tenant' }, user_metadata: { tenant_id: 'spoofed' } };
    expect(metaField(u as any, 'tenant_id')).toBe('server-tenant');
  });
  it('falls back to user_metadata only when app_metadata lacks the field (transitional)', () => {
    const u = { app_metadata: {}, user_metadata: { templateId: 'tpl-driver' } };
    expect(metaField(u as any, 'templateId')).toBe('tpl-driver');
  });
  it('returns undefined when neither has it', () => {
    expect(metaField({ app_metadata: {}, user_metadata: {} } as any, 'tenant_id')).toBeUndefined();
  });
});
