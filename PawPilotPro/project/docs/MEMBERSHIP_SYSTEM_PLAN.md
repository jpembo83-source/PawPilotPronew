# Membership System — Assessment & Phased Remediation Plan

_Assessed 2026-07-18. Phase 1 implemented on branch `claude/membership-system-assessment-206076`._

## Where we started (assessment summary)

Membership rendered across the platform but was a facade. Five partial,
disconnected implementations existed:

1. **Plan definitions** at `/pricing/memberships` (KV `membership:{id}`) — real
   CRUD, but both admin UIs for it are unreachable (settings
   `ServicesAndPricing.tsx` is never routed; the services-pricing "Memberships"
   tab renders `null` in `ServicesPricingPage.tsx`).
2. **Hardcoded catalog** MO01–MO05 in `src/app/modules/packages/membership-plans.ts`
   — the only catalog staff actually see (`/packages`, beta-gated).
3. **Billing subscriptions** (KV `subscription:{id}`) — persisted
   household/pet links, but `plan_id` is unvalidated and nothing in booking or
   pricing reads them.
4. **The `/customer-packages` client contract** (`packages/store.ts`,
   `AssignMembershipDialog`, `HouseholdDetailPage`, daycare
   `CreateBookingDialog` membership lookup) — called four endpoints that did
   not exist server-side. Every call 404'd; assignment always failed; booking
   lookups silently degraded to PAYG.
5. **`service_type: 'membership'`** on daycare bookings — a display label only;
   the server prices such bookings at the full PAYG rate
   (`daycare_routes.tsx`, default 99.00 + tax).

Additional gaps: the pricing resolver's membership branch
(`pricing_routes.tsx /resolve`) is orphaned and stateless ("assume they have
credits available"); no credit ledger existed anywhere; the portal quote only
appends a static membership caveat; the portal MembershipsScreen is
lead-capture only.

## Phase 1 — Customer membership backend (DONE in this branch)

Goal: make "assign a membership to a household and see it everywhere" real,
by implementing the `/customer-packages` contract the frontend already calls.

- `supabase/functions/server/lib/membership_catalog.ts` — server source of
  truth for the MO01–MO05 catalog plus pure credit maths
  (`buildMembership`, `consumeCredits`). Unit-tested from
  `tests/unit/membership-catalog.test.ts`, including a sync check against the
  client catalog file.
- `supabase/functions/server/memberships_routes.ts` — mounted at the function
  root in `index.tsx`, behind shared `requireAuth`:
  - `GET  /customer-packages?customer_id=&status=` — list (tenant-scoped).
  - `POST /customer-packages` — assign a plan to a household
    (admin/manager only; validates plan id + household exists in tenant;
    rejects a second concurrent active membership with 409).
  - `POST /customer-packages/:id/use` — decrement credits, write a
    `membership_usage:` ledger entry, flip to `exhausted` at zero.
  - `POST /customer-packages/:id/cancel` — admin/manager only.
- KV keys: `customer_membership:{tenantId}:{id}` and
  `membership_usage:{tenantId}:{membershipId}:{usageId}`.
- Smoke: route added to `tests/e2e/auth-tampered-token.spec.ts`.

What now works with zero frontend changes: staff can assign a plan from
`/packages` (AssignMembershipDialog), the household Pets tab shows the active
plan and remaining credits, and the daycare CreateBookingDialog's membership
lookup finds the plan and enables membership billing for the booking.

Known Phase-1 limits (deliberate): catalog is still code, duplicated
client/server (sync-checked by unit test); credits are granted once at
assignment (no monthly renewal/rollover accrual yet); nothing decrements
credits automatically on booking yet.

## Phase 2 — One plan catalog, managed in the UI (DONE in this branch)

- Canonical plan model = the Layer-4 `MembershipPlan` from
  `services-pricing/types.ts` (accessType credits/unlimited, creditsPerMonth,
  creditUnit half/full day). `/pricing/memberships` CRUD is now Zod-validated
  against it, and `DELETE /pricing/memberships/:id` archives (isActive=false,
  audit-stamped) — never hard-deletes.
- Management UI: new `MembershipPlansTab` on the already-routed
  `/settings/services` page (create, edit, archive/reactivate), wired to the
  services-pricing store's existing CRUD actions.
- Plan resolution is KV-first with the compiled MO01–MO05 catalogue as
  per-id fallback (`resolveAssignablePlan` in memberships_routes;
  `normalizeCatalogPlan` maps the Layer-4 shape to the internal one). No
  seeding needed: a fresh deployment sells the built-ins; the managed
  catalogue takes over as records are created. An archived KV record blocks
  assignment — no silent fallback past an explicit admin decision.
- Coverage snapshot: assignments stamp `session_type` onto the customer
  membership; booking coverage reads the snapshot (compiled-catalogue
  fallback only for pre-snapshot records). Plan edits never retroactively
  change what an assigned member bought.
- Packages dashboard sells the managed catalogue when it has active
  day-based plans, built-ins otherwise; the staff booking dialog prefers the
  snapshot over a catalogue lookup.
- Deleted via /safe-delete (zero-reference proof): the null-rendering
  `MembershipsTab.tsx`, the unrouted `ServicesAndPricing.tsx`, and its only
  child `MembershipsAndPackages.tsx`. Lint baseline dropped 3807→3707 and
  typecheck 90→85; both re-recorded.
- Deferred: consolidating `pricing/store.ts` (the generic
  monthlyPrice/includedCredits model) out of existence — its membership
  actions lost their only UI with `MembershipsAndPackages.tsx`, but the
  store also carries packages/audit state used elsewhere; fold into a
  dedicated cleanup pass.

## Phase 3 — Membership applied at booking time (DONE in this branch)

- Staff daycare `POST /bookings` (`daycare_routes.tsx`): membership billing
  is client-requested (staff keep the deliberate PAYG-vs-membership choice —
  a customer may want to save credits) but server-verified — the server
  resolves the household's active `customer_membership` from its own
  tenant-scoped data and never trusts the claim. Session type derives from
  `service_id` (`sessionTypeForServiceId`); the coverage decision is the pure
  `membershipCoverage` (active + plan session match + credit available;
  unlimited covers free). Covered bookings are priced 0.00, stamped with
  `membership_id`/`membership_credits_used`, draw a credit, and write a
  `membership_usage:` ledger entry keyed to the booking. Uncovered claims
  (no membership, wrong session type, exhausted credits) fall back to PAYG
  at full price with an honest service_type — mid-multi-day exhaustion
  degrades gracefully instead of failing.
- `POST /bookings/:id/cancel` hands the credit back (`restoreCredits`:
  capped/floored, exhausted→active) and appends a compensating negative
  ledger entry — no ledger deletes.
- Smoke: `tests/e2e/memberships.spec.ts` guards the mount (404 = facade
  regression) and membership surfaces against 5xx.
- Deferred from the original Phase 3 sketch: un-orphaning `/pricing/resolve`.
  Its membership branch reads the disjoint `membership:` plan model that
  Phase 2 consolidates — integrating it before Phase 2 would wire bookings to
  the wrong catalog. Fold it into Phase 2's consolidation instead.

## Phase 4 — Renewal and rollover (DONE in this branch; invoicing deferred)

- **Lazy renewal** (`renewIfDue`, pure + unit-tested): there is no scheduler
  in this stack, so every live read path — staff list, credit use, booking
  coverage, portal reads — applies due renewals via
  `lib/membership_store.ts` (`withDueRenewal` /
  `activeMembershipForHousehold`) and persists the result. Catches up
  multiple missed periods; bounded against corrupt dates.
- **Full rollover**: unused days carry (MDC policy). `credits_total` is
  cumulative-granted so `remaining = total − used` and the restoreCredits
  cap stay correct across periods. `monthly_credits` is snapshotted at
  assignment (compiled-catalogue fallback for older records; records whose
  grant can't be known are left untouched, date included, so a later fix
  can still renew them).
- 'exhausted' flips back to 'active' when new credits arrive; booking
  coverage and assignment lookups treat exhausted as live for exactly this
  reason (a second plan can't be stacked on an exhausted one).
- Paused/cancelled/expired memberships never renew.
- **Deferred — invoicing**: surfacing the renewal as a billing invoice and
  reconciling billing's `subscription:` records into `customer_membership:`
  waits until the billing module's placeholder tabs (payments,
  subscriptions) become real; renewal currently logs a structured
  `memberships.renewed` event as the audit hook.

## Phase 5 — Portal surface (DONE in this branch)

- `GET /portal/memberships` — the signed-in owner's live (lazy-renewed)
  plan: name, type, session length, credits remaining, renewal date.
  Read-only, scoped to the household on the verified portal token.
- `MembershipsScreen` renders a "Your plan" card (name, remaining sessions
  or unlimited, renewal date) above the marketing tiers; the enquiry flow
  stays for non-members and upgrades. Purchase remains out-of-app by
  design.
- Portal quote (`/portal/quote`) now resolves the household's membership and
  replaces the generic "if you have a membership" hedge with the real
  position: unlimited → "covers these sessions"; credits → "can cover N of
  M (K credits left)"; empty balance → "billed at the standard rate".
  Session-type mismatch keeps the generic caveat. The quote never zeroes a
  line itself — coverage is applied by the staff booking path and the quote
  stays `estimate: true`.

## Sequencing rationale

Phases are strictly dependency-ordered: 3 needs 1 (a ledger to draw from),
4 needs 3 (renewal without consumption is meaningless), 5 needs 3–4 (the
portal must not promise what the booking path doesn't honour). Phase 2 is
independent of 3–5 and can run in parallel.
