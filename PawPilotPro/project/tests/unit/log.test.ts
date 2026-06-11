import { describe, it, expect, vi } from 'vitest';
import './setup';
import { logError, internalError } from '../../supabase/functions/server/_shared/log.ts';

describe('logError redaction', () => {
  it('returns a correlation id and redacts sensitive keys', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const cid = logError('test.failed', new Error('boom'), {
      password: 'hunter2',
      accessToken: 'abc',
      userEmail: 'a@b.c',
      credential_value: 'xyz',
      requestBody: { password: 'p' },
      safeId: 'id-1',
      nested: { apiKey: 'k', count: 3 },
    });
    expect(cid).toMatch(/^[0-9a-f-]{36}$/);
    const line = spy.mock.calls[0][0] as string;
    expect(line).not.toContain('hunter2');
    expect(line).not.toContain('a@b.c');
    expect(line).not.toContain('xyz');
    expect(line).toContain('[REDACTED]');
    expect(line).toContain('id-1');          // safe fields survive
    expect(line).toContain('"count":3');     // nested safe fields survive
    expect(line).toContain('boom');          // error detail stays server-side
    spy.mockRestore();
  });
});

describe('internalError', () => {
  it('returns generic message + correlationId, never the error text', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    let captured: any, status: any;
    const c = { json: (body: unknown, s: number) => { captured = body; status = s; return 'resp'; } };
    const r = internalError(c, 'mod.route', new Error('secret detail'));
    expect(r).toBe('resp');
    expect(status).toBe(500);
    expect(captured.error).toBe('internal_error');
    expect(captured.correlationId).toMatch(/^[0-9a-f-]{36}$/);
    expect(JSON.stringify(captured)).not.toContain('secret detail');
    spy.mockRestore();
  });
});
