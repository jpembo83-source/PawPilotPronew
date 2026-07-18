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

## Phase 2 — One plan catalog, managed in the UI

- Move the catalog into KV behind the existing `/pricing/memberships` CRUD
  (seed MO01–MO05 via the CLI-guarded seed path, `SEED_ENABLED`).
- Route ONE management UI (recommend the settings
  `MembershipsAndPackages.tsx`, which already has working CRUD wiring) and
  delete the dead surfaces via `/safe-delete`: the null-rendering
  services-pricing tab, the unrouted `ServicesAndPricing.tsx` page, and the
  hardcoded client catalog (replaced by a fetch).
- Add `DELETE /pricing/memberships/:id` (archive, not hard delete — audit
  trail stays).
- Reconcile the duplicate stores (`services-pricing/store.ts` vs
  `pricing/store.ts`) down to one.

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

## Phase 4 — Renewal, rollover, and billing

- Monthly renewal job: on `next_billing_date`, top up credits per plan with
  rollover (plans carry unused days; MO05 unlimited exempt), advance the
  billing date, emit a billing event.
- Connect to billing: membership charge surfaces as a subscription invoice;
  reconcile the `subscription:` records in `billing_routes.tsx` with
  `customer_membership:` (one system — recommend migrating billing reads to
  the membership records rather than maintaining both).
- Pause/resume semantics (billing rules already exist in
  `billing:membership_billing_rules`).

## Phase 5 — Portal surface

- `GET /portal/memberships` — the signed-in owner's active plan, credits,
  renewal date (portal auth pattern, read-only).
- `MembershipsScreen` shows the real current plan above the marketing tiers;
  keep enquiry flow for non-members.
- Portal quote (`/portal/quote`) checks the household's membership and, when
  credits cover the session, says so instead of the generic caveat (still
  `estimate: true`).

## Sequencing rationale

Phases are strictly dependency-ordered: 3 needs 1 (a ledger to draw from),
4 needs 3 (renewal without consumption is meaningless), 5 needs 3–4 (the
portal must not promise what the booking path doesn't honour). Phase 2 is
independent of 3–5 and can run in parallel.
