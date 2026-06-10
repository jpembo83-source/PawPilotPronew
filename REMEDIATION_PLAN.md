# PawPilotPro Remediation Plan

Status as of 2026-06-10. Source: external code review (2026-06-04, 34 items) + session audit.
Scorecard: 17/34 review items closed — all 9 critical security items done (deployed as
edge function v365, admin credential rotated). Remaining items are architecture,
quality, and tooling.

## Phase 0 — One source of truth (BLOCKS EVERYTHING)

**0.1 Reconcile the two code lineages.**
The main repo (`PawPilotPronew`, security hardening) and the portal worktree's nested
checkout (`PawPilotPronew-portal/PawPilotPro/portal/PawPilotPro`, all portal/invoxia/booking
feature work, source of edge function v363) diverged with no shared git history.
~20 server files + frontend files differ. The 2026-06-09 incident (deploying one lineage
removed the other's routes in production) recurs until merged.

- Import `portal/`, `shared/`, invoxia edge functions into the main repo (new dirs, no conflict)
- Per diverged file: identify nested feature changes vs main's pre-hardening base (8dc9518);
  port features onto the hardened versions — never regress auth patterns
- Retire the nested repo afterward; single repo, branch-per-concern from then on

## Phase 1 — Finish security

- **1.1** `hashSecret` string-reversal → AES-GCM (Web Crypto), key from env secret (review #21)
- **1.2** Move `tenantId` / `templateId` / `permissions` / `portal_user` from client-writable
  `user_metadata` to server-set `app_metadata`; extend `scripts/backfill-app-metadata-role.ts`;
  update all readers (`_shared/auth.ts`, transport gate, portal auth)
- **1.3** Migrate remaining frontend modules still sending ANON key as bearer
  (messaging, view-as, communications-settings, calendar, system) to shared `getAuthHeaders()`

## Phase 2 — Make quality enforcement real

- **2.1** Tag auth/billing/daycare e2e specs `@smoke`; CI must run `test:smoke`
  (currently matches zero tests — the CLAUDE.md gate passes vacuously) (review #27)
- **2.2** Structured logger with redaction; generic client errors + correlation IDs across
  ~184 `error.message` leak sites; remove sensitive console.log (reviews #17, #18)
- **2.3** Unit tests for pure logic: auth helpers, booking dedupe, pricing math

## Phase 3 — Quality debt

- **3.1** Portal: ErrorBoundary at router level; wire react-hook-form + shared Zod schemas
  into forms; align Zod to ONE major version across portal/project/shared (reviews #13, #22, #23)
- **3.2** Hygiene sweep (one commit): remove dead deps (MUI stack, react-slick, masonry, uuid,
  react-popper ~80KB); rename `@figma/my-make-file`; delete duplicate `utils/supabase/info.tsx`;
  drop ignored `pnpm.overrides`; delete dead `KVDebug`/`CustomerDebug`; gitignore `supabase/.temp`
  (reviews #28–#32, #34)
- **3.3** Baseline burndown: type the Zustand stores (most of the 4,901 baselined lint errors),
  split 1,000-line stores/components, replace `setTimeout` fake-async stubs (reviews #15, #16, #19, #20)

## Phase 4 — Architecture (decision needed)

- KV-store-as-database (reviews #10, #14): migrate high-volume entities (bookings, customers,
  invoices) to real Postgres tables with schema in `supabase/migrations/` and RLS; keep KV for
  low-volume settings. Incremental, entity-by-entity, weeks not days.
- Monolith split (review #12): optional, ride along with the KV migration.

## Standing rules (from CLAUDE.md, enforced as of Phase 2)

Branch per concern · smallest surgical change · smoke suite before touching auth/check-in/billing ·
gate = lint + typecheck + build + smoke, sequentially · no new `any` · no `eslint-disable` to get green.
