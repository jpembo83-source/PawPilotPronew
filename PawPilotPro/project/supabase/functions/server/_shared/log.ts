// Structured logger with redaction + generic client error responses.
//
// Repo rules this enforces (CLAUDE.md):
//   - No secrets, tokens, emails, or request bodies in logs.
//   - No `error.message` returned to clients. Generic message + correlation
//     ID; full detail server-side only.
//
// Usage in route handlers:
//
//   import { logError, logInfo, internalError } from './_shared/log.ts';
//
//   } catch (err) {
//     return internalError(c, 'billing.createInvoice', err);
//   }
//
// `internalError` logs the full error server-side with a correlation ID and
// returns `{ error: 'internal_error', correlationId }` (500) to the client.
// Operators grep the function logs for the correlationId a user reports.

type Level = 'info' | 'warn' | 'error';

// Keys whose values must never appear in logs, matched case-insensitively
// and on substring (so `credential_value`, `accessToken`, `userEmail` all hit).
const REDACT_PATTERNS = [
  'password', 'secret', 'token', 'authorization', 'apikey', 'api_key',
  'credential', 'email', 'phone', 'body',
];

function redact(fields: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(fields)) {
    const kl = k.toLowerCase();
    if (REDACT_PATTERNS.some((p) => kl.includes(p))) {
      out[k] = '[REDACTED]';
    } else if (typeof v === 'object' && v !== null && !Array.isArray(v)) {
      out[k] = redact(v as Record<string, unknown>);
    } else {
      out[k] = v;
    }
  }
  return out;
}

function emit(level: Level, msg: string, fields: Record<string, unknown> = {}): void {
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    level,
    msg,
    ...redact(fields),
  });
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
}

export const logInfo = (msg: string, fields?: Record<string, unknown>) => emit('info', msg, fields);
export const logWarn = (msg: string, fields?: Record<string, unknown>) => emit('warn', msg, fields);

export function logError(msg: string, err: unknown, fields: Record<string, unknown> = {}): string {
  const correlationId = crypto.randomUUID();
  emit('error', msg, {
    ...fields,
    correlationId,
    errorMessage: err instanceof Error ? err.message : String(err),
    // Stack stays server-side only; truncated to keep log lines sane.
    stack: err instanceof Error ? err.stack?.split('\n').slice(0, 6).join(' | ') : undefined,
  });
  return correlationId;
}

/**
 * Standard 500 response: full detail logged server-side, generic message +
 * correlation ID to the client. `where` is a stable route tag like
 * 'daycare.createBooking' so logs are greppable.
 */
// deno-lint-ignore no-explicit-any
export function internalError(c: any, where: string, err: unknown) {
  const correlationId = logError(`${where}.failed`, err);
  return c.json({ error: 'internal_error', correlationId }, 500);
}
