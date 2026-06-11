import { describe, it, expect } from 'vitest';
import './setup';
import { metaField } from '../../supabase/functions/server/_shared/auth.ts';

describe('metaField — app_metadata-only authorization reads', () => {
  it('reads app_metadata and ignores client-writable user_metadata', () => {
    const u = { app_metadata: { tenant_id: 'server-tenant' }, user_metadata: { tenant_id: 'spoofed' } };
    expect(metaField(u as any, 'tenant_id')).toBe('server-tenant');
  });
  it('never falls back to user_metadata (post-backfill: app_metadata only)', () => {
    const u = { app_metadata: {}, user_metadata: { templateId: 'tpl-driver' } };
    expect(metaField(u as any, 'templateId')).toBeUndefined();
  });
  it('returns undefined when app_metadata lacks the field', () => {
    expect(metaField({ app_metadata: {}, user_metadata: {} } as any, 'tenant_id')).toBeUndefined();
  });
});
