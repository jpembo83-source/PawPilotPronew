# Engineering rules for this repo (PawPilotPro)
## Non-negotiables
- Every backend route MUST go through the shared `requireAuth` middleware. No exceptions, no ad-hoc auth.
- Token validation uses SERVICE_ROLE_KEY server-side (see settings_rbac.ts as reference). ANON_KEY NEVER validates JWTs.
- User role comes from `app_metadata` only. `user_metadata` is client-writable and untrusted.
- No auth fallbacks. On failure, fail fast (401/503) and log. Never decode tokens locally without signature verification.
- No secrets, tokens, emails, or request bodies in logs. Use the structured logger with redaction.
- No `error.message` returned to clients. Generic message + correlation ID; full detail server-side only.
- No debug/seed routes in code paths reachable in production. Seed only via CLI guarded by SEED_ENABLED.
## Before any change (think before coding)
- Branch per concern. Small diffs. No mixing security fixes with refactors.
- Make the smallest surgical change that fixes the issue. Prefer the simplest abstraction; do not refactor beyond the stated task.
- If touching auth/check-in/billing, the smoke suite must cover it first.
- Never delete a dep/file/route without grep-proving zero references — run /safe-delete and paste proof in the PR.
## Gate (must pass before merge)
- lint, typecheck, build, smoke suite — all green. No new `any`. No `eslint-disable` to get green.
- The gate is enforced sequentially by the Spartan gate skill: a failing step blocks the next.
## Skills active in this repo
- repo-auth — auto-loads when touching auth/routes; the canonical auth pattern.
- safe-delete — run before removing any dep/file/route.
## UI floors (check before merge — grep, don't trust memory)
- No `text-xs` for operational information (times, names, alerts); `text-xs` is for true captions only. Alert/medical-adjacent text is ≥14px (`text-sm`). Check touched files: `grep -n "text-xs\|text-\[1[01]px\]" <files>` and justify each hit.
- Secondary/tertiary text uses theme tokens (`--muted-foreground`, `--tertiary-foreground` — both ≥4.5:1 on `--background`), never raw grey hexes. Check: `grep -rn "#9E9B97" src/` must stay at zero.
- Interactive targets on mobile are ≥44px. shadcn buttons get this from the `body.mobile-shell` floor in theme.css; bespoke controls must meet it themselves (`.touch-target` helper).
## Patterns to copy (the parts already done right)
- Auth: settings_rbac.ts (SERVICE_ROLE_KEY validation)
- Supabase init: Portal singleton (lazy, env-validated)
- Validation: shared/schemas/* (Zod, discriminated unions) — use server- AND client-side
- Bounds: kv_store.ts mset() bounds check
