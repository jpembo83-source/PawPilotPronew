import { defineConfig } from 'vitest/config';

// Server modules use Deno-style npm:/jsr: specifiers; alias them to the
// node_modules equivalents so vitest can import pure logic for unit tests.
export default defineConfig({
  resolve: {
    alias: [
      { find: /^npm:hono$/, replacement: 'hono' },
      { find: /^npm:@supabase\/supabase-js$/, replacement: '@supabase/supabase-js' },
      { find: /^npm:@anthropic-ai\/sdk$/, replacement: '@anthropic-ai/sdk' },
      { find: /^npm:zod$/, replacement: 'zod' },
      { find: /^jsr:@supabase\/supabase-js@.*$/, replacement: '@supabase/supabase-js' },
    ],
  },
  test: { environment: 'node', globals: false, setupFiles: ['tests/unit/setup.ts'] },
});
