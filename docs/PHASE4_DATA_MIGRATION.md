# Phase 4 — KV → Postgres Data Migration Design

> **STATUS: DRAFT DESIGN — NOTHING IN THIS DOCUMENT HAS BEEN APPLIED.**
> No production change, no schema change, no code change. This document and the
> draft DDL under `PawPilotPro/project/supabase/migrations_drafts/` exist to be
> reviewed and decided upon by the owner before any work begins.

Addresses external review items **#10** and **#14** (KV-store-as-database) per
`REMEDIATION_PLAN.md` Phase 4.

---

## 1. Current state

All business data lives in **one table**:

```sql
CREATE TABLE kv_store_fc003b23 (
  key   TEXT NOT NULL PRIMARY KEY,
  value JSONB NOT NULL
);
```

Accessed exclusively through `PawPilotPro/project/supabase/functions/server/kv_store.tsx`
(`get / set / del / mget / mset / mdel / getByPrefix`) using the
**SERVICE_ROLE_KEY** — no RLS, no foreign keys, no transactions, no typed
columns. A grep of the server route files finds **~1,166 KV call sites** across
~330 distinct key patterns.

Structural consequences observed in route code:

- **Load-everything list operations.** Every list endpoint is
  `getByPrefix(...)` followed by in-memory filter/sort. E.g. the portal
  bookings list loads *every* booking for the tenant on each request
  (`portal_bookings.ts:180`); updating a contact loads *all* contacts for the
  tenant to find one ID (`customers_routes.tsx:490`).
- **Hand-rolled secondary indexes.** Daycare maintains its own index keys
  (`daycare:booking:date:{loc}:{date}:{id}`, `daycare:booking:pet:{petId}:{id}`,
  `daycare:booking:household:{hh}:{id}`, `daycare:attendance:active:{loc}:{id}`,
  `daycare:event:booking:{bookingId}:{id}`) whose values are just the primary
  ID. These are exactly what real B-tree indexes replace.
- **Multi-key writes with no transaction.** A daycare booking create writes
  the booking + three index keys + a read-modify-write capacity counter
  (`daycare_routes.tsx:965–974`) — five sequential upserts that can partially
  fail and that race under concurrency. A portal bundle booking writes a
  parent + N children (`portal_bookings.ts:318,352`). Flipping a primary
  contact rewrites every contact in the household plus the household record
  (`customers_routes.tsx:521–540`).
- **Stored aggregates that drift.** `daycare:capacity:{loc}:{date}` stores
  `current_bookings` / `current_checked_in` counters updated read-modify-write
  with no locking — a classic lost-update hazard.
- **Inconsistent tenancy.** Some families are tenant-prefixed
  (`customer:{tenantId}:…`, `portal_booking:{tenantId}:…`,
  `overnight:{tenantId}:…`, `staff:{tenantId}:…`); others are global
  (`invoice:{id}`, `daycare:booking:{id}`, `incident:main:{id}`,
  `policy:doc:{id}`, `service:{id}`, `location:{id}`, `message_thread:{id}`).
  `DaycareBooking.tenant_id` is *optional* in its own interface. A literal
  `demo-tenant-001` appears in seed-adjacent code.
- **Mixed ID formats.** Portal code uses `crypto.randomUUID()`; staff CRUD
  uses `generateId('hh') → "hh_<epoch>_<rand>"`. Any target schema must use
  `TEXT` primary keys, not `UUID`.

---

## 2. Entity catalogue

Key patterns observed in route code (template literals shown with `{}` for
interpolated values). Priority: **P1** migrate first (high volume, relational,
race-prone) → **P3** migrate last / maybe never.

| # | Entity family | KV key pattern(s) | Source file(s) | Proposed table(s) | Write pattern | Read pattern | Priority | Risk | Effort |
|---|--------------|-------------------|----------------|-------------------|---------------|--------------|----------|------|--------|
| 1 | Households / contacts / pets / documents | `customer:{t}:household:{id}`, `customer:{t}:contact:{hh}:{id}`, `customer:{t}:pet:{hh}:{id}`, `customer:{t}:document:{hh}:{id}`, `customer:{t}:household:{hh}:note:{id}`, `…:flag:{id}`, `customer:{t}:note:{noteId}:pet:{petId}` | customers_routes.tsx, portal_routes.tsx | `households`, `contacts`, `pets`, `customer_documents`, `household_notes`, `household_flags`, `note_pets` | Multi-key (primary-contact flip rewrites N contacts + household; cascade delete walks 11 prefixes) | Point + prefix-scan; several tenant-wide scans to find one record | **P1** | High — referenced by everything | L |
| 2 | Portal bookings | `portal_booking:{t}:{id}` (kinds: single, `bundle_parent`, `bundle_child` via `childIds[]`/`parentBookingId`) | portal_bookings.ts, portal_routes.tsx | `bookings` (self-referencing `parent_booking_id`) + `booking_pets` | Multi-key (bundle = parent + N children, needs a transaction); idempotency by `requestId` scan | Tenant prefix-scan filtered by household/status/date on every list | **P1** | High — customer-facing | M |
| 3 | Daycare operations | `daycare:booking:{id}` + index keys `daycare:booking:date:{loc}:{date}:{id}`, `…:pet:{petId}:{id}`, `…:household:{hh}:{id}`; `daycare:capacity:{loc}:{date}`; `daycare:attendance:{id}` + `daycare:attendance:active:{loc}:{id}` + `daycare:attendance:booking:{bookingId}`; `daycare:event:{id}` + 2 index families | daycare_routes.tsx | `daycare_bookings`, `daycare_attendance`, `daycare_events`; capacity becomes a **view/derived count** (or advisory row with atomic `UPDATE … SET n = n + 1`) | Worst offender: 5-key booking create; 6-key check-in; counter races | Full-table prefix scans (`getByPrefix('daycare:booking:')`) then filter | **P1** | High — check-in is in the smoke-suite-protected path | L |
| 4 | Invoices / payments / subscriptions | `invoice:{id}` (no tenant prefix), `payment:{id}`, `subscription:{id}`, `billing:invoice_settings:{loc}`, `billing:audit:{id}`, `billing:approval:{id}`, `billing:export_record:{id}` | billing_routes.tsx, billing_finance_settings.ts | `invoices`, `invoice_line_items`, `payments`, `subscriptions` | Single-key mostly; invoice + line items embedded in one blob | Prefix scans for lists; point reads | **P2** (P1 if billing accuracy is the next complaint) | High — money; needs tenant_id backfilled from household | L |
| 5 | Overnights | `overnight:{t}:reservation:{id}`, `…:event:{id}`, `…:handover:{id}`, `…:carelog:{id}`, `…:carer:{id}`, `…:area:{id}`, `…:capacity:{date}` | overnights_routes.tsx | `overnight_reservations`, `overnight_events`, `overnight_handovers`, `overnight_carelogs`, `overnight_carers`, `overnight_areas` | Mostly single-key + event append | Tenant prefix-scans | **P2** | Medium | M |
| 6 | Grooming | `grooming-apt:{t}:{id}`, `groomer:{t}:{id}` | grooming_routes.tsx | `grooming_appointments`, `groomers` | Single-key | Tenant prefix-scan | **P2** | Medium | S |
| 7 | Transport | `transport_job:{t}:{id}`, `transport_event:{t}:{id}`, `transport_vehicle:{t}:{id}` | transport_routes.tsx | `transport_jobs`, `transport_events`, `transport_vehicles` | Single-key; jobs auto-created from daycare bookings (cross-entity, wants a transaction) | Tenant prefix-scan | **P2** | Medium | S |
| 8 | Staff / rotas / shifts | `staff:{t}:member:{id}`, `staff:{t}:member:user:{userId}`, `staff:{t}:rota:{id}`, `staff:{t}:rota:{rotaId}:shift:{id}`, `staff:{t}:shift:user:{userId}:{id}`, `staff:{t}:policy:{id}` (+ `:version:{v}`), `staff:{t}:assignment:*`, `staff:{t}:acknowledgement:*`, `staff:{t}:audit:{id}` | staff_routes_new.tsx | `staff_members`, `rotas`, `shifts`, `staff_policies`, `staff_policy_versions`, `staff_assignments`, `staff_acknowledgements` | Multi-key (shift indexed by rota and by user) | Tenant prefix-scans | **P2** | Medium | L |
| 9 | Policies (company) | `policy:doc:{id}`, `policy:assignment:{id}` + `policy:assignment:user:{u}:{id}` + `policy:assignment:policy:{p}:{id}`, `policy:ack:*` | policies_routes.tsx | `policy_documents`, `policy_assignments`, `policy_acknowledgements` | Triple-write per assignment (record + 2 indexes) | Global prefix-scans | **P2** | Low–Medium | M |
| 10 | Incidents | `incident:main:{id}`, `incident:notes:{id}:*`, `incident:people:{id}:*`, `incident:actions:{id}:{n}`, `incident:attachments:{id}:*`, `incident:audit:*`, status/severity index keys `incident:status:{s}:{id}`, `incident:severity:{sev}:{id}` | incidents_routes.tsx | `incidents`, `incident_notes`, `incident_people`, `incident_actions`, `incident_attachments` | Multi-key (status change = del old index + set new) | Global prefix-scans | **P2** | Medium — safeguarding data | M |
| 11 | Pricing engine | `service:{id}`, `pricing:service:{id}`, `price-book:{id}`, `price-book-version:{id}`, `price-entry:*`, `fee-rule:{id}`, `discount-rule:{id}`, `multi-dog-rule:{id}`, `membership:{id}`, `package:{id}`, `approval:{id}`, `location-override:{id}`, `location-override-proposal:{id}`, `pricing-audit:*` | pricing_routes.tsx, pricing_approvals_routes.tsx | `services`, `price_books`, `price_book_versions`, `price_entries`, `pricing_rules` (discriminated), `pricing_approvals` | Single-key; versioned snapshots | Global prefix-scans; low volume | **P3** | Low — small, mostly-static config | M |
| 12 | Messaging / notifications | `message_thread:{id}`, `message:{id}`, `message_template:{id}`, `notification:{t}:{hh}:{id}`, `delivery_log:{id}`, `contact_consent:{id}`; comms settings `{t}:templates:{id}`, `{t}:channels:{id}`, `{t}:automation:{id}`, `{t}:slas:{id}`, `{t}:sender_identities:{id}` | messaging.ts, communications_settings.ts, portal lib | `message_threads`, `messages`, `notifications`, `delivery_logs` | Append-heavy | Prefix-scan per thread/household | **P2** (notifications grow unboundedly) | Medium | M |
| 13 | Portal identity | `portal_users:{t}:{hh}` (auth-user ↔ household link), `portal_invites:{t}:{token}`, `portal_pet_verification:{t}:{petId}`, `vet_share:{t}:{hh}:{id}`, `vet_share_by_token:{token}` | portal_routes.tsx, portal_invites.ts | `portal_users`, `portal_invites`, `pet_verifications`, `vet_shares` | Single-key | Point reads (token lookups) | **P1** (small but it is the RLS keystone — `portal_users` is how a JWT maps to a household) | Medium | S |
| 14 | Vaccinations | `vaccination:{t}:{petId}:{id}`, `vax_review_queue:{t}:{id}` | vaccinations_routes.tsx | `vaccinations`, `vaccination_reviews` | Single-key | Prefix per pet | **P2** | Medium — compliance gates check-in | S |
| 15 | Audit / activity logs | `billing:audit:{id}`, `{area}:audit:{id}`, `compliance:audit:{id}`, `integration:audit:{id}`, `system:audit:*`, `audit:reorder:*`, `audit:policy:*`, `rule_audit:*`, `view_as:audit:*`, `customer:{t}:activity:{hh}:{id}` | everywhere | One append-only `audit_events` table (`area`, `tenant_id`, `actor_id`, `entity_type`, `entity_id`, `payload JSONB`, `created_at`) | Append-only | Rare reads | **P2** — easy win, one table absorbs ~10 key families | Low | S |
| 16 | Settings / system / ops config (STAYS IN KV) | `settings:org`, `settings:location:{id}`, `settings:global-modules`, `system:module:*`, `system:feature_flag:*`, `system:default:*`, `system:environment_settings`, `system:job:{id}`, `system:job_execution:{id}`, `system:organisation:{id}`, `location:{id}`, `user:{id}`, `user:{t}:profile:{id}`, `operational_rule:{id}`, `rule_override:{loc}:{id}`, `integration:*`, `view_as:session:*`, `compliance:request:*`, `compliance:breach:*` | system.ts, settings_rbac.ts, integrations_settings.ts, operational_rules.ts, view_as.ts, data_compliance.ts | — (keep KV) | Single-key | Point reads, tiny cardinality | **Stay** | n/a | n/a |

Effort key: S < 1 week · M 1–2 weeks · L 2–4 weeks (per entity, including
dual-write window and verification, not elapsed calendar time).

---

## 3. Target architecture recommendation

### Recommended: real tables + `tenant_id` everywhere + RLS enabled, with edge functions remaining the sole writer (service-role)

Two candidate end-states were considered:

| | **A. Tables + RLS, service-role writes (recommended)** | B. Tables, service-role only, no RLS |
|---|---|---|
| Access path | All reads/writes stay in the Hono edge functions through `requireAuth`; service role bypasses RLS so route code keeps working unchanged during migration | Same |
| RLS role | Defence in depth + enables future direct PostgREST/Realtime reads | None — one leaked anon query path away from full data exposure |
| Tenant isolation | Enforced twice: in route code (as today) *and* by policy | Route code only |
| Portal reads | Optional later: portal client reads its own household's rows directly via anon key + JWT claims (`tenant_id`, `household_id` in `app_metadata`), removing a chunk of portal GET routes | Not possible |
| Cost | Slightly more design effort up front (policies per table) | Cheaper now, pays for it later |

**Recommendation: A.** RLS is enabled on every migrated table from day one,
but no client talks to Postgres directly in Phase 4 — the edge functions keep
the SERVICE_ROLE_KEY and bypass RLS, exactly as the CLAUDE.md auth rules
require. The policies are a safety net and an option for later, not a
dependency of the migration. This means RLS policy bugs cannot break
production during the migration window.

Schema conventions (used in the draft DDL):

- `tenant_id TEXT NOT NULL` on every table (TEXT because existing tenant IDs
  include strings such as `demo-tenant-001`).
- `id TEXT PRIMARY KEY` (mixed `uuid` / `hh_…` legacy formats; new rows may
  default to `gen_random_uuid()::text`).
- Soft FKs with `ON DELETE` behaviour mirroring today's manual cascade walk;
  added as `NOT VALID` first so dirty KV data cannot block the backfill, then
  `VALIDATE CONSTRAINT` after cleanup.
- JWT claim helpers (`app_metadata.tenant_id`, `app_metadata.household_id`,
  `app_metadata.role`) wrapped in SQL functions so policies stay readable.
- Every table keeps a `legacy_kv_key TEXT` column during the migration window
  for parity auditing; dropped at the end.
- Multi-key write flows (bundle create, check-in, primary-contact flip) become
  single Postgres transactions via RPC functions or PostgREST batch upserts.
- The capacity counter is **deleted as stored state** and becomes a query
  (`COUNT(*) … WHERE booking_date = $1 AND location_id = $2 AND status IN (…)`)
  or a materialised view if measured to be hot.

### What STAYS in KV, and why

The KV store is genuinely the right tool for some of this data — small
cardinality, point-read access, schemaless by nature:

1. **Settings & configuration** — `settings:*`, `system:module:*`,
   `system:feature_flag:*`, `system:default:*`, `system:environment_settings`,
   `integration:*` config/scopes, communications settings. Tens of keys, read
   whole, no relations, shapes change often.
2. **Operational rules** — `operational_rule:{id}`, `rule_override:*`: a rules
   engine reading its whole rule set into memory; a table buys nothing.
3. **Ephemeral session state** — `view_as:session:*` (support impersonation
   sessions), short-lived token lookups. TTL-style data; KV is fine.
4. **Job bookkeeping** — `system:job:*`, `system:job_execution:*`,
   `compliance:job_execution:*` until/unless a proper job queue is adopted.
5. **One-off token indirections** — `vet_share_by_token:{token}` may stay as a
   pure token→id lookup even after `vet_shares` becomes a table (or become a
   unique-indexed column; either is acceptable).

Everything else — anything with volume, relations, filtering, or counters —
moves.

---

## 4. Incremental migration strategy

One entity family at a time, in priority order. Each family goes through the
same five-stage pipeline; at no point is there a big-bang cutover, and every
stage has a rollback.

### Proposed order

1. **Customers** (households / contacts / pets / documents) — everything else
   has FKs into it.
2. **Portal identity** (`portal_users`, `portal_invites`) — small; the RLS
   keystone.
3. **Bookings** (portal bookings + daycare bookings/attendance/events) — the
   highest-volume, most race-prone family.
4. **Billing** (invoices/payments) — after bookings so line items can
   reference them.
5. **Audit events** — one table, mechanical.
6. Overnights → Grooming → Transport → Staff → Incidents → Vaccinations →
   Messaging → Policies → Pricing.

### Per-entity pipeline

| Stage | Action | Verification | Rollback |
|---|---|---|---|
| 0. Prepare | Apply DDL (table + indexes + RLS, no readers/writers). Freeze the entity's Zod schema in `shared/schemas/` as the single shape contract for both KV and table writes. | Migration applies cleanly on a Supabase branch DB | Drop table — nothing references it |
| 1. Backfill | One-off SQL backfill from `kv_store_fc003b23` (queries included, commented, in the draft DDL). Rows carry `legacy_kv_key`. | Row count vs KV key count; per-row JSONB checksum comparison; sample diff | Truncate table |
| 2. Dual-write | Route writes go to **both** KV and the table (table write first, in a transaction where the flow is multi-key; KV write retained as today). Reads still KV. | Nightly parity job: count + checksum drift report must be zero for N days | Remove table write; KV was never not authoritative |
| 3. Read cutover | Flip reads to the table behind a per-entity flag (`system:feature_flag:read_from_pg:<entity>` — the KV flag store earns its keep). Lists become real `WHERE`/`ORDER BY`/`LIMIT` queries. | Smoke suite (mandatory — bookings/check-in/billing are gate-protected paths); shadow-read sampling comparing KV vs PG responses | Flip flag back; KV still receiving writes |
| 4. Decommission | Stop KV writes; KV keys for the entity exported to cold storage then deleted; drop `legacy_kv_key`. | Grep-proven zero references to the entity's key prefixes (`/safe-delete` per repo rules) | Restore from export + re-enable dual-write (last resort) |

Rules of engagement (repo CLAUDE.md compliant):

- Branch per entity family; no mixing with refactors.
- Smoke suite runs before touching the bookings/check-in/billing stages.
- Dual-write window: minimum one full business cycle (one week) per entity,
  longer for billing.
- Edge function remains the only data access path throughout; no client-direct
  reads are introduced in Phase 4.

---

## 5. OWNER DECISIONS required before work starts

1. **RLS model.** Confirm Option A (RLS on, service-role writes, no
   client-direct access in Phase 4). The draft policies assume JWT claims
   `app_metadata.tenant_id` / `app_metadata.household_id` / `app_metadata.role`
   — `household_id` is **not currently stamped** into portal users'
   `app_metadata` (the link lives in `portal_users:{t}:{hh}`); stamping it at
   invite-accept time is a prerequisite for any future portal-direct reads.
   Decide: stamp now (cheap, in the accept-invite route) or defer.
2. **Tenant canonicalisation.** Several families have **no tenant in the key**
   (`invoice:{id}`, `daycare:booking:{id}`, `incident:main:{id}`,
   `policy:doc:{id}`, `service:{id}`, `location:{id}`). Is production
   genuinely single-tenant today? If yes, decide the canonical tenant ID to
   stamp during backfill (and what to do with `demo-tenant-001` data — migrate
   or drop). If no, those families need a tenant-resolution step (e.g. via
   `household_id`) before backfill.
3. **Migration ordering.** Approve the order in §4, or re-prioritise (e.g.
   billing before bookings if invoice accuracy is the more urgent pain).
4. **Downtime tolerance.** The pipeline is designed for zero downtime
   (dual-write), at the cost of a longer calendar window. If brief windows
   (minutes, per entity, out of hours) are acceptable, stages 2–3 can collapse
   into write-freeze → backfill-delta → cutover, roughly halving elapsed time
   per entity. Decide per entity, especially for daycare check-in (must not be
   down during opening hours).
5. **Supabase cost implications.** Dual-write roughly doubles write volume for
   the window; tables + indexes add storage alongside the untouched KV table
   until stage 4; a Supabase **branch database** (recommended for rehearsing
   each backfill) is a paid add-on; consider enabling **PITR** before the
   first backfill (also paid). Approve the spend or accept rehearsal on a
   local stack only.
6. **FK strictness.** Backfilled KV data may contain orphans (e.g. bookings
   referencing deleted pets — today's cascade delete is best-effort). Decide:
   quarantine orphans into `*_orphaned` tables, or keep FKs `NOT VALID`
   indefinitely. Recommendation: quarantine + validate.
7. **Denormalised name fields.** KV blobs embed `household_name`, `pet_name`,
   `location_name`, `petNames[]` at write time. Decide: drop and join (correct
   names forever, slightly more query work — recommended) or keep as cached
   columns (faithful migration, names continue to go stale).
8. **Audit log consolidation.** Approve folding the ~10 `*audit*` key families
   into one append-only `audit_events` table, or keep per-area tables.

---

## 6. Draft DDL deliverables

| File | Covers |
|---|---|
| `PawPilotPro/project/supabase/migrations_drafts/0001_bookings.sql` | `bookings` (portal, incl. bundles), `booking_pets`, `daycare_bookings`, `daycare_attendance`, `daycare_events`, capacity view, indexes, RLS, commented backfill |
| `PawPilotPro/project/supabase/migrations_drafts/0002_customers.sql` | `households`, `contacts`, `pets`, `customer_documents`, `household_notes`, `note_pets`, `household_flags`, `customer_activities`, indexes, RLS, commented backfill |

Both files are headed **DRAFT — NOT APPLIED** and live outside
`supabase/migrations/` precisely so no tooling can pick them up by accident.

---

## 7. RATIFIED DECISIONS (owner, 2026-06-11)

1. **RLS**: Option A — RLS on every migrated table from day one; edge functions
   remain the sole writer (service-role). `household_id` IS stamped into portal
   users' `app_metadata` at invite-accept, starting now.
2. **Tenant**: production is single-tenant; canonical tenant ID stays
   `demo-tenant-001`, stamped onto unprefixed families at backfill.
3. **Order**: as §4 — Customers → Portal identity → Bookings → Billing →
   Audit → remainder.
4. **Downtime**: hybrid — out-of-hours freeze windows for most entities;
   full dual-write for daycare check-in and billing.
5. **Cost**: approved — enable PITR before first backfill; use a Supabase
   branch database to rehearse each backfill.
6. **Orphans**: quarantine into `*_orphaned` tables, then VALIDATE constraints.
7. **Denormalised names**: drop and join.
8. **Audit**: single append-only `audit_events` table.

Phase 4 execution may begin. First branch: `feat/phase4-customers`
(stage 0 DDL + household_id stamping + PITR/branch-DB setup checks).
