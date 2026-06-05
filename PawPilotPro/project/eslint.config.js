// Phase 0.2 toolchain (PawPilotPro remediation prompt book).
// Baseline-first: this config makes problems VISIBLE; the baseline file
// (eslint-baseline.json) records the current count so CI stays green while
// the debt is burned down (Phase 3.3). Do not add eslint-disable to get green.
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';
import globals from 'globals';

export default tseslint.config(
  {
    ignores: [
      'node_modules/**',
      'dist/**',
      'test-results/**',
      'playwright-report/**',
      'eslint-baseline.json',
      // Deno edge functions — different runtime, checked via `deno check`/`deno lint`
      'supabase/**',
    ],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // Phase 3.3 will flip this to "error" module-by-module as each is cleaned.
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },
  // Config files and plain-JS scripts: lint without type information, Node globals.
  {
    files: ['*.config.js', '*.config.ts', '*.config.mjs', 'scripts/**/*.mjs'],
    ...tseslint.configs.disableTypeChecked,
    languageOptions: {
      globals: globals.node,
    },
  },
  prettier
);
