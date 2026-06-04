# PawPilotPro — Remediation Prompt Book

**Purpose:** Fix every finding in the 2026-06-04 code review *without breaking the working solution*, in a sequence that is safe to run against a live system, and remove bloat along the way.
**Audience:** Claude Code (each prompt is copy-paste ready), reviewed by a human before merge.
**Golden rule:** Never change runtime behaviour without first having a way to detect a regression.

> **Assumptions** (correct me before starting if wrong): monorepo with `portal/`, `project/`, `shared/` packages; `project/` is the Staff Dashboard (Vite/React) + Supabase Edge Functions (Hono on Deno); `portal/` is the customer app (Capacitor); package manager is **npm** for `project/` (it has `package-lock.json`). Adjust commands if a workspace tool (pnpm/turbo) is actually in use.

---

## How to use this book

1. Work **one phase at a time**, one branch per item or tight group of items. Small, reviewable PRs only.
2. Drop the `CLAUDE.md` from **Appendix A** into the repo root *first*. It encodes the invariants so Claude Code inherits them on every prompt.
3. Run the **verification gate** (Appendix B) before opening a PR. A PR that doesn't pass the gate doesn't merge.
4. Do the **secret rotation runbook** (Appendix C) *today*, independent of everything else.

---

## Operating principles (the safety contract)

Every prompt assumes these. They are also written into `CLAUDE.md`.

- **Branch + small diff.** One concern per branch. Never bundle a security fix with a refactor.
- **Characterise before you change.** If touching auth, check-in, or billing, a smoke test must capture *current* behaviour first, so the change is provably behaviour-preserving.
- **Replicate, don't invent.** When fixing a broken pattern, copy the codebase's own correct implementation (e.g. `settings_rbac.ts` for auth). Cite the source file in the PR.
- **No deletion without proof.** Before removing any dependency, file, or route, `grep`-confirm zero references. Paste the grep output in the PR.
- **Fail fast, never silently degrade.** Removing a fallback is a feature, not a regression.
- **Guardrails are gates.** `lint`, `typecheck`, `build`, and the smoke suite must pass. No `// eslint-disable` to get green — fix or explicitly waive with a comment and reason.

---

# Phase 0 — Guardrails (zero behaviour change)

Goal: make every later phase safe and detectable. Nothing here changes what the app does at runtime. This phase should take ~1 day and is a hard prerequisite for Phase 1's auth rewrites.

### 0.1 — Stabilise the build: align Zod (Finding #13)

```
Branch: chore/align-zod
We have a Zod major-version conflict across packages: portal/ ^3.23.0, project/ ^4.2.1, shared/ ^3.25.76. shared/ is imported by portal/, so v3 schemas are being consumed by a v4 caller (or vice versa) — currently compiling by luck.

Do this:
1. Read shared/package.json, portal/package.json, project/package.json and confirm the versions.
2. Read shared/schemas/*.ts and identify whether the schema syntax used is v3- or v4-compatible.
3. Standardise ALL THREE packages on a single Zod major. Default to the version shared/ is written for, since it's the common dependency. If shared/ needs v4 syntax changes, make the minimal edits.
4. Reinstall, then run typecheck and build in every package.

Constraints: do not change any schema's runtime validation behaviour — only the version and any syntax required to compile. Show me the dependency diffs and any schema edits.
```

### 0.2 — Add tooling: ESLint + Prettier + tsconfig, baselined (Findings #24, #25)

```
Branch: chore/add-toolchain
None of the three packages has lint/format config, and project/ has no TypeScript check (build script lacks tsc --noEmit).

Do this:
1. Add a shared ESLint flat config + Prettier config at the repo root, extended by each package. Use @typescript-eslint with recommended-type-checked.
2. Add/repair tsconfig.json in project/ with "noEmit": true and add "typecheck": "tsc --noEmit" to its package.json scripts. Do the same for portal/ and shared/ if missing.
3. DO NOT fix violations yet. Generate a baseline so the build stays green: run eslint with --output-file an eslint-baseline.json (or use the lint tool's built-in baseline). The goal is visibility, not a 500-error wall.
4. Add scripts to each package: "lint", "format", "format:check", "typecheck".

Constraints: zero source-code behaviour changes in this branch. Only config + scripts + a baseline file. Report the total count of lint errors and type errors per package so we can size the cleanup.
```

### 0.3 — CI pipeline (Findings #26)

```
Branch: chore/ci
There is no CI. tests/README.md references .github/workflows/test.yml which does not exist.

Create .github/workflows/ci.yml that, on PR and push to main:
- installs deps (cache the lockfile)
- runs lint, typecheck, build, and the test suite for every package
Use a matrix over packages if practical. Make the smoke tests (added in 0.4) required to pass; allow the lint baseline to pass while we burn it down.

Constraints: the pipeline must pass on the current main once 0.1–0.4 are merged. Do not add deploy steps yet.
```

### 0.4 — Characterisation smoke tests for critical paths (Findings #27)

```
Branch: test/critical-path-smoke
Project (Staff Dashboard, 373 files) has ZERO unit tests. Before we touch auth/check-in/billing we need tests that capture CURRENT behaviour so refactors are provably safe.

Do this:
1. Add a Playwright (or existing E2E framework) smoke suite covering, against a seeded test environment:
   - successful staff login and role-gated route access
   - one customer check-in flow end to end
   - one billing/invoice read + create flow
2. These tests assert on observable behaviour, NOT internal implementation. They are a safety net, not a spec.
3. Replace any page.waitForTimeout(...) with proper expect/locator waits in tests you touch.

Constraints: tests must pass against the code AS IT IS TODAY (vulnerabilities included). We are recording the baseline, not fixing yet. If a flow can't be tested without the debug/seed routes, note it — we'll preserve a test-only seed path in Phase 1.
```

**Phase 0 exit gate:** lint/typecheck/build run in CI; smoke suite green on current `main`; Zod aligned. Now changes are detectable.

---

# Phase 1 — Critical security ("negligent in production")

Maps to review priority items 1–6 plus CORS/default-password/fake-hash. Split into **1A immediate removals** (do now, low risk) and **1B auth rewrite** (needs Phase 0 green).

## 1A — Immediate, near-zero-regression removals

### 1A.1 — Remove debug/seed routes from production (Findings #8, #34)

```
Branch: security/remove-debug-routes
Debug routes ship to production with no admin guard: /test-post, /check-env, /debug-users, /debug-auth-users, /sync-users (Edge Function), and App.tsx routes "debug-kv", "debug-customer" (behind PrivateRoute only — any staff user reaches them).

Do this:
1. grep the entire repo for each route path and list every definition + reference.
2. Delete the routes outright. If the smoke suite (0.4) needs a seed path, replace /sync-users with a seed script run via CLI in non-prod only (guarded by an explicit SEED_ENABLED env that is unset in prod), NOT an HTTP route.
3. Remove the App.tsx debug routes and their now-unused components (grep-confirm the components aren't imported elsewhere before deleting).

Constraints: paste grep output proving zero remaining references. Smoke suite must stay green. Show the diff.
```

### 1A.2 — Tighten CORS (Findings #7)

```
Branch: security/cors-allowlist
index.tsx line ~43 sets origin: "*". Combined with broken auth this exposes all data to any origin.

Do this:
1. Replace the wildcard with an allowlist driven by an ALLOWED_ORIGINS env var (comma-separated): the Staff Dashboard origin and the Portal origin only.
2. Reject disallowed origins; do not reflect arbitrary Origin headers.

Constraints: add the real origins to the env config and document them. Verify the Staff Dashboard and Portal still load and call the API (smoke suite).
```

### 1A.3 — Remove default password + test credentials (Findings #4, #6)

```
Branch: security/remove-default-creds
Two issues:
- tests/e2e/auth.setup.ts lines 3-4 hardcode a real email + password as fallbacks.
- index.tsx line 643 sets password: password || 'tempPass123!' on user creation.

Do this:
1. Remove the hardcoded fallback in auth.setup.ts. Require TEST_EMAIL/TEST_PASSWORD from env; fail the test run loudly if unset.
2. In user creation: never default a password. If none is supplied, require a server-generated cryptographically-random password OR reject the request. No guessable defaults, ever.
3. grep for 'tempPass123', 'Daytona2022', and the test email across the whole repo; report every hit.

Constraints: this branch does NOT rotate the live secrets — that's the runbook in Appendix C, do it separately and first. Here we only remove them from code.
```

### 1A.4 — Real secret hashing (Findings #21)

```
Branch: security/fix-hashsecret
integrations_settings.ts lines 19-21 "hash" secrets by reversing the string. This is not protection.

Do this:
1. Determine what these secrets are and whether they need to be RECOVERABLE.
   - If they must be readable later (e.g. API keys for outbound calls): do NOT hash — encrypt at rest with a KMS/managed key, or store in Supabase Vault. Hashing is the wrong tool.
   - If they only need verification (e.g. webhook secrets): use a proper KDF (argon2id / bcrypt) with per-secret salt.
2. Migrate existing stored values: read the current reversed strings, recover the plaintext, re-store under the correct scheme, in a one-off migration guarded by SEED_ENABLED.
3. Remove hashSecret().

Constraints: tell me which path (encrypt vs hash) you chose per secret type and why. Do not leave plaintext or reversed values anywhere after migration.
```

## 1B — Auth rewrite (Phase 0 must be green)

The canonical correct pattern already exists in `settings_rbac.ts` line 257 (`SERVICE_ROLE_KEY`). Everything below replicates it.

### 1B.1 — Centralised auth middleware (Findings #1, #11 — fixes missing auth AND the 14× DRY violation at once)

```
Branch: security/requireauth-middleware
messaging.ts (12+ routes), system.ts (25+ routes), data_compliance.ts (22 routes) have ZERO auth. getUserFromToken() is defined in messaging.ts line 15 but never called. Separately, getAuthHeaders() is copy-pasted into 14 module stores.

Do this:
1. Read settings_rbac.ts (esp. line 257) as the reference for correct token validation with SERVICE_ROLE_KEY.
2. Create ONE shared Hono middleware, e.g. shared server util requireAuth(c, next):
   - extract the Bearer token
   - validate it server-side via a SERVICE_ROLE_KEY Supabase client (supabase.auth.getUser(token)) — never decode-only
   - on failure, return 401 immediately (no fallback — see 1B.2)
   - attach the validated user to context
   - read role from app_metadata ONLY (see 1B.3)
3. Apply requireAuth to EVERY route in messaging.ts, system.ts, data_compliance.ts and any other unauthenticated route (grep for route registrations without a guard; the review counts 60+ unauthenticated endpoints — enumerate them all).
4. Create ONE shared client-side getAuthHeaders() utility and replace all 14 copies (billing, capacity, customers, daycare, grooming, incidents, overnights, packages, policies, reporting, services-pricing, settings, staff, transport). The header must NOT send SUPABASE_ANON_KEY as the Authorization bearer — send the user's access token.
5. Delete the dead getUserFromToken() in messaging.ts.

Constraints: enumerate every route you added the guard to, grouped by module, with a count. Smoke suite must still pass for LEGITIMATE authenticated flows — if a smoke test breaks, the fix is to authenticate the test correctly, not to weaken the guard. Show me the full list of now-protected routes.
```

### 1B.2 — Replace ANON_KEY JWT validation + remove fallback (Findings #2, #3, #5)

```
Branch: security/jwt-service-role
Two linked problems:
- 7 modules create their Supabase client with SUPABASE_ANON_KEY and "validate" JWTs with it. ANON_KEY cannot verify signatures — any forged token is accepted. Files: customers_routes.tsx:33, daycare_routes.tsx:126, overnights_routes.tsx:24, transport_routes.tsx:28, grooming_routes.tsx:84, incidents_routes.tsx:180, policies_routes.tsx:~125.
- settings_rbac.ts:297-329 falls back to local Base64 JWT decoding after 3 failed auth calls — an attacker who disrupts the connection can impersonate anyone.
- index.tsx:71-72 silently degrades to ANON_KEY when SERVICE_ROLE_KEY is missing.

Do this:
1. Route all server-side auth through the requireAuth middleware from 1B.1 (which uses SERVICE_ROLE_KEY validation). Remove the ad-hoc ANON_KEY validation in all 7 modules.
2. Delete the Base64 fallback in settings_rbac.ts entirely. On repeated auth failure: return 503/401 and log it — FAIL FAST.
3. In index.tsx: if SERVICE_ROLE_KEY is missing, throw on startup. Never fall back to ANON_KEY for privileged operations.

Constraints: after this, a forged/expired token must be rejected. Add a smoke test that sends a tampered token and asserts 401. Show the diff per file.
```

### 1B.3 — Read role from `app_metadata` (Findings #9)

```
Branch: security/role-from-app-metadata
AuthContext.tsx:139 reads role from user_metadata, which is CLIENT-WRITABLE — a user can set their own role to admin.

Do this:
1. Change the role source to app_metadata (server-controlled) everywhere role is read — grep for 'user_metadata' and 'metadata.role' across portal/ and project/.
2. Ensure roles are SET only server-side (admin SDK / SERVICE_ROLE_KEY), never from the client.
3. The server-side requireAuth (1B.1) already reads app_metadata — make the client trust the server's role response, not its own decoded token.

Constraints: add a smoke test asserting a user who sets user_metadata.role=admin does NOT gain admin access. Enumerate every read site you changed.
```

**Phase 1 exit gate:** every route guarded; forged-token and self-promotion smoke tests pass; no fallbacks; secrets rotated (Appendix C). This clears the "must do before production" bar (review items 1–6).

---

# Phase 2 — Architecture (bigger, do carefully)

### 2.1 — Pull the live schema into version control (Findings #14)

```
Branch: chore/capture-schema
6 of 10 migration files are empty placeholders; the real schema lives only on the remote Supabase instance.

Do this:
1. Run supabase db pull (or db diff) against the remote to generate a migration representing the CURRENT schema.
2. Commit it. From now on, schema changes go through migrations + review.
3. Add a CI check that fails if the local migrations don't reproduce the remote schema (db diff is non-empty).

Constraints: this is read-only against prod — capture, don't mutate. Verify a fresh local supabase db reset reproduces a working schema.
```

### 2.2 — Split the monolithic Edge Function (Findings #12)

```
Branch: refactor/split-server
make-server-fc003b23 is one 25,145-line Hono server; index.tsx alone is 834 lines mixing debug, seed, sync, and user management.

Do this INCREMENTALLY, one module at a time, behaviour-preserving:
1. Map the 27+ route modules and their registration in index.tsx.
2. Extract route groups into their own files mounted via app.route('/prefix', subRouter). Move shared concerns (the requireAuth middleware, the single getAuthHeaders server util, error handling) into a shared/ server module.
3. index.tsx becomes a thin composition root: env validation, middleware, mounting.

Constraints: ONE module per commit. Smoke suite green after each. No logic changes — pure mechanical extraction. If you find logic that needs changing, leave a TODO and a separate issue; do not fix it here.
```

### 2.3 — KV Store → relational, via strangler-fig (Findings #10) — PLAN FIRST, DO NOT REWRITE IN ONE PASS

```
Branch: docs/kv-migration-plan
ALL business data sits in a single kv_store_fc003b23 JSONB table: no FKs, no constraints, no transactions, no RLS (uses SERVICE_ROLE_KEY, bypassing row security), and N+1 loops (customers_routes.tsx:1496-1518 loads contacts per household).

PRODUCE A PLAN ONLY in this branch — a markdown doc — covering:
1. Entity inventory and which need relational integrity MOST: customers, bookings, invoices, incidents, compliance records.
2. A strangler-fig sequence per entity: (a) create relational table + RLS policies, (b) dual-write (write to both KV and table), (c) backfill, (d) migrate reads to the table, (e) verify parity, (f) stop writing to KV, (g) drop KV usage for that entity.
3. Which entity to migrate FIRST (recommend the highest-integrity / lowest-volume one as the pilot — likely invoices or compliance records).
4. RLS policy design so we STOP bypassing row security with SERVICE_ROLE_KEY for normal reads.
5. Fix for the N+1 in customers_routes.tsx as part of the customers migration.

Constraints: output is a plan + the pilot entity's table DDL and RLS, NOT a migration of live data. We execute one entity at a time in later branches, each behind the smoke suite + a parity check.
```

---

# Phase 3 — Code quality

### 3.1 — Structured logging, no leaked errors (Findings #17, #18)

```
Branch: quality/logging-and-errors
240+ console.log (incl. full session objects with tokens at settings/store.ts:14-30, user emails/IDs, request bodies). Every catch returns error.message to the client, leaking stack traces / SQL / internal names.

Do this:
1. Add a structured logger (levels, redaction of tokens/emails/secrets). Replace console.log/error in the backend with it; strip frontend console.log used as "features".
2. Standardise catch blocks: log full detail server-side at error level; return a generic message + a correlation ID to the client. Never return error.message verbatim.

Constraints: grep to confirm no session/token/secret is logged anywhere after this. Add a test asserting an internal error returns a generic body, not a stack trace.
```

### 3.2 — Remove fake-async "features" (Findings #19)

```
Branch: quality/real-async
data_compliance.ts:231-241, system.ts:417-425, messaging.ts:323-337 use setTimeout to SIMULATE async work, swallow errors, and return "success". These are deceptive — the operation never happens.

For each: either implement the real operation (with real error handling and an honest response) or, if the feature isn't ready, return a clear "not implemented" and remove the fake success path. Do not ship a toast that lies.

Constraints: list each fake path and state which you implemented vs disabled. No silent success anywhere.
```

### 3.3 — Burn down `any` (Findings #15, #16)

```
Branch: quality/types-<module>   (one branch PER module — do not do all 567 at once)
567 any in the backend, 88+ in frontend. Now that tsconfig + typecheck exist (Phase 0), tighten incrementally.

For the module named in the branch:
1. Replace request-body any with the existing shared/ Zod schemas — parse at the boundary with c.req.json() then schema.parse(). The schemas already exist and are well-built; use them server-side.
2. Type the obvious cases: (h: any) filter chains, (b as any).petNames (add the field to the Booking type instead of casting), data?: any in interfaces, error: any in catch (use unknown + narrowing).
3. Enable @typescript-eslint/no-explicit-any as warn for this module, error once clean.

Constraints: ONE module per PR so reviews stay sane. Smoke suite green each time. Don't introduce new any to "make it compile".
```

### 3.4 — Wire Portal form validation + ErrorBoundary (Findings #22, #23)

```
Branch: quality/portal-forms-and-errorboundary
react-hook-form and zod are dependencies but no Portal form uses them — validation is manual useState + toast.error. The shared/schemas/booking.ts schemas exist but are only used server-side. The Portal (Capacitor app) has NO ErrorBoundary, so any render error crashes the whole app.

Do this:
1. Add a top-level ErrorBoundary in the Portal with a recovery UI. Add per-route boundaries for the heaviest screens.
2. Convert Portal forms to react-hook-form + zodResolver using the EXISTING shared schemas. Remove the manual useState validation.

Constraints: reuse shared schemas verbatim — do not duplicate validation logic. Verify each converted form still submits correctly (smoke/E2E).
```

### 3.5 — Break up oversized files (Findings #20)

```
Branch: refactor/split-<file>   (one file per branch)
Oversized: customers/store.ts (1,037 lines, 20+ async actions), NotesTab.tsx (786), PetDetailScreen.tsx (773, with 8 inline sub-components), WhereaboutsScreen.tsx (607), HomeScreen.tsx (609).

For the file named in the branch: extract sub-components into their own files; split the store into feature slices. Behaviour-preserving only.

Constraints: pure structural extraction, no logic change. Smoke suite green. One file per PR.
```

---

# Phase 4 — Bloat removal

> Discipline: **grep-confirm zero imports before deleting anything.** The review claims these are unused — verify, don't trust.

### 4.1 — Remove dead dependencies (Findings #28, #29) — ~80KB+ gzipped

```
Branch: chore/remove-dead-deps
Claimed unused: @mui/material, @mui/icons-material, @emotion/react, @emotion/styled (~80KB+), react-slick, react-responsive-masonry, uuid, @popperjs/core, react-popper.

Do this:
1. For EACH package, grep the full source for any import/usage. Paste results.
2. Remove only those with zero hits. For uuid, if you find usage, replace with crypto.randomUUID() and then remove. For popper, confirm Radix covers it before removing.
3. Reinstall, build, and check bundle size before/after.

Constraints: do NOT remove anything still imported. Report the before/after bundle size and the removed list with grep proof.
```

### 4.2 — Dedupe and fix package hygiene (Findings #30, #31, #32, #33)

```
Branch: chore/package-hygiene
Several small fixes:
1. project/utils/supabase/info.ts and info.tsx are identical — keep one (grep imports to see which extension is referenced; standardise on it), delete the other, update imports.
2. project/package.json name is "@figma/my-make-file" (scaffold leftover) — rename to @pawpilot/project.
3. project/ defines pnpm.overrides but uses npm (package-lock.json present) — either remove pnpm.overrides, or, if those overrides matter, migrate to npm "overrides". Decide based on whether the pinned versions are actually needed; report which.
4. react + react-dom are listed as optional:true peerDependencies in an APP package — they're hard runtime deps. Move to dependencies (or remove the peer block).

Constraints: one logical fix per commit within the branch. Build + smoke green. For #3, tell me which way you went and why.
```

---

# Appendix A — `CLAUDE.md` to drop in the repo root

```markdown
# Engineering rules for this repo (PawPilotPro)

## Non-negotiables
- Every backend route MUST go through the shared `requireAuth` middleware. No exceptions, no ad-hoc auth.
- Token validation uses SERVICE_ROLE_KEY server-side (see settings_rbac.ts as reference). ANON_KEY NEVER validates JWTs.
- User role comes from `app_metadata` only. `user_metadata` is client-writable and untrusted.
- No auth fallbacks. On failure, fail fast (401/503) and log. Never decode tokens locally without signature verification.
- No secrets, tokens, emails, or request bodies in logs. Use the structured logger with redaction.
- No `error.message` returned to clients. Generic message + correlation ID; full detail server-side only.
- No debug/seed routes in code paths reachable in production. Seed only via CLI guarded by SEED_ENABLED.

## Before any change
- Branch per concern. Small diffs. No mixing security fixes with refactors.
- If touching auth/check-in/billing, the smoke suite must cover it first.
- Never delete a dep/file/route without grep-proving zero references (paste proof in the PR).

## Gate (must pass before merge)
- `lint`, `typecheck`, `build`, smoke suite — all green. No new `any`. No `eslint-disable` to get green.

## Patterns to copy (the parts already done right)
- Auth: settings_rbac.ts (SERVICE_ROLE_KEY validation)
- Supabase init: Portal singleton (lazy, env-validated)
- Validation: shared/schemas/* (Zod, discriminated unions) — use server- AND client-side
- Bounds: kv_store.ts mset() bounds check
```

---

# Appendix B — Verification gate checklist

Run before every PR. CI (0.3) enforces the automated ones.

- [ ] `lint` passes (no new errors above baseline)
- [ ] `typecheck` passes (no new `any`, no new errors)
- [ ] `build` succeeds in every affected package
- [ ] Smoke suite green (login, check-in, billing)
- [ ] For security PRs: forged-token test → 401; self-promotion test → denied
- [ ] For deletions: grep output proving zero references is in the PR description
- [ ] PR cites the source-of-truth pattern it replicated (where applicable)
- [ ] Diff is one concern only

---

# Appendix C — Secret rotation runbook (DO THIS FIRST, independent of code)

These are exposed in source and git history; removing from `HEAD` is insufficient.

1. **Rotate the leaked user password** (`Daytona2022`, account `jason.pemberton@me.com`) — change it now anywhere it was reused, enable MFA.
2. **Rotate the Supabase service-role and anon keys** in the Supabase dashboard (the anon key + a `SERVICE_...` key prefix are hardcoded in `index.tsx:71-72`). Update the deployment env. Old keys are now burned.
3. **Rotate any integration secrets** that passed through the fake `hashSecret()` (they were never protected).
4. **Purge from history** if the repo is private and history can be rewritten: use `git filter-repo` to strip the secrets, force-push, and notify collaborators. If history can't be rewritten, rotation (steps 1–3) is the mitigation — treat every exposed value as compromised.
5. **Add a secret scanner** (e.g. gitleaks) to CI so this can't recur.

> Order of operations overall: **Appendix C now** → **Phase 0** → **Phase 1A in parallel with 0** → **Phase 1B** → Phases 2–4.

---

*End of prompt book.*
