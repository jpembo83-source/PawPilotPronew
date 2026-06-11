// Server modules are written for the Deno edge runtime and fail fast at
// import when auth env is missing. Provide a shim + dummy env for unit tests.
process.env.SUPABASE_URL ||= 'http://localhost:54321';
process.env.SUPABASE_SERVICE_ROLE_KEY ||= 'test-service-key-unit-tests-only';
(globalThis as any).Deno ??= {
  env: { get: (k: string) => process.env[k] },
};
