# PawPilotPro Client Portal — Design Spec

**Date:** 2026-05-25
**Author:** Brainstorming session with Jason
**Status:** Approved for planning

## 1. Overview

A mobile-first responsive web app that lets pet owners self-serve booking requests against an existing PawPilotPro daycare business. Owners log in to manage their pet profiles, upload vaccination records, request bookings across all four services (daycare, grooming, overnights, transport), and track booking status with realtime updates.

This is the dog daycare's customer-facing brand surface. Visual quality is a first-class requirement — the portal must feel closer to Linear / Cash App polish than typical small-business portals.

## 2. Goals & non-goals

**Goals**
- Pet owners can request bookings for daycare, grooming, overnights, and transport
- Owners see all their pets, view and upload vaccination records, see booking history
- Staff approve or decline booking requests in the existing PawPilotPro staff app
- Status changes propagate to owners in realtime + by email
- Premium visual quality — design tokens, motion, type, micro-interactions tuned for brand

**Non-goals (v1)**
- Self-signup — owners are invited by staff only
- Online payment, invoice viewing, or balance management
- Live pet diary (photos/notes during stays)
- Native mobile apps (iOS / Android stores)
- PWA installability and push notifications (deferred to v1.1)
- Multi-tenant white-label (deferred — single tenant only at launch)
- Hard real-time capacity booking (everything is request → staff confirms)

## 3. Architecture

**New app location:** `PawPilotPro/portal/` — sibling to the existing `PawPilotPro/project/` staff app. Independent Vite 6 + React 18 + TypeScript setup, mobile-first Tailwind v4 config, thin shadcn subset (button, input, dialog, sheet, badge, skeleton — no desktop-oriented data tables).

**Shared code:** `PawPilotPro/shared/` peer directory holding pure-TS modules consumed by both apps:
- `shared/types/` — `Booking`, `Pet`, `Customer`, `Vaccination`, `Service`, `Location`, `NotificationEvent`
- `shared/schemas/` — Zod schemas for cross-app validation
- `shared/api/` — typed wrapper around the Edge Function URL + auth header construction

Wired via tsconfig `paths` (`@shared/*`) and Vite alias. No `pnpm` / `turbo` monorepo conversion — keep tooling minimal.

**Backend:** Reuse the existing Supabase Edge Function `make-server-fc003b23`. Add a `/portal/*` route group in the Hono router. New owner-specific KV namespaces (see §8). Existing entities (`bookings:*`, `customers:*`, `pets:*`, `vaccinations:*`) are reused as-is with scoped read/write helpers.

**Deployment:** Second Netlify site, separate build (`portal/`), recommended subdomain `portal.<daycare-domain>`. New `netlify.toml` inside `portal/` mirroring the staff app's security headers (X-Frame-Options DENY, nosniff, asset caching).

## 4. Auth model

**Identity provider:** Supabase Auth (matches staff app).

**Owner accounts** carry `user_metadata.portal_user === true` and link to a `customer_id` via `portal_users:{tenantId}:{customerId}`. Staff users (`portal_user !== true`) are rejected by every `/portal/*` route at the server. Portal users are rejected by every existing staff route. Server-side enforcement, never client-side trust.

**Account creation flow** — invite-only:
1. Staff opens a customer detail page in the staff app and clicks **Send portal invite**
2. Server generates a single-use token, stores `portal_invites:{tenantId}:{token}` (24h expiry, contains `customer_id`), sends an invite email via Resend. **No Supabase Auth user is created at this step** — the invite is a pending claim, not an account.
3. Owner clicks the link → `/accept-invite?token=…` → server validates token, prompts owner to set a password
4. Server creates the Supabase Auth user on submit with `email_confirmed=true` (the invite link proves email ownership) and `user_metadata.portal_user=true`, writes `portal_users:{tenantId}:{customerId}` linking the auth user to the customer, marks the invite consumed
5. Owner lands on the home tab with their data pre-populated

**Returning users:** standard `/login` (email + password). Forgot password via Supabase Auth's built-in email flow.

**Staff control:** customer detail in the staff app has a "Portal Activity" tab showing linked auth user info, pending invites, and buttons to **Resend invite** or **Revoke access**.

## 5. Screens & navigation

**Bottom tab bar — 4 tabs, always visible:**

### Home (`/`)
- Greeting with owner's first name and the tenant's brand mark
- Notification bell (top right) with unread count
- "Up next" — next 1–3 upcoming bookings, condensed cards
- Primary CTA: **+ Book a service**
- "Things to check" strip — vax expiring within 30 days, requests pending over 24h, etc.
- Single batched data load via `GET /portal/home`

### Bookings (`/bookings`)
- Segmented control: **Upcoming** / **Past**
- Row: service icon, date, pet name(s), status badge (Pending / Confirmed / Declined / Cancelled)
- Tap row → **Booking detail** (`/bookings/:id`): full info, status timeline, staff note (if declined), **Cancel** button enabled only while status is `pending`

### Pets (`/pets`)
- Household pet list with photo, name, breed, age
- Tap → **Pet detail** (`/pets/:id`): profile fields (read-only with "Request edit" button → opens sheet, emails staff), Vax sub-section showing status pills (Current / Expiring ≤30d / Expired) and an **Upload vax** button

### Account (`/account`)
- Profile (name / email / phone, read-only with "Request edit")
- Notification preferences (email on/off per event type)
- Help & contact — daycare phone, hours, address
- Logout

**New booking flow** (`/book/*`) — full-screen sheet, 4 steps with progress bar:
1. **Service** — 4 large cards (daycare / grooming / overnights / transport)
2. **Pet(s)** — multi-select for daycare/overnights, single for grooming/transport. Pets with expired vax are visibly blocked with a deep link to upload
3. **Dates & times** — varies by service:
   - Daycare: day picker (single or multiple days)
   - Overnights: check-in date + check-out date
   - Grooming: date + slot from staff calendar availability (`GET /portal/availability`)
   - Transport: pickup window + add-on to which other booking
4. **Notes & review** — optional free text, summary card, **Submit request**

Submit → confirmation screen → back to Home with new `pending` booking visible at the top of "Up next".

**Vax upload modal sheet:** file picker (PDF/JPG/PNG, ≤10MB), vax type dropdown, expiry date, optional booster-due date, **Submit**. Uploads to Supabase Storage under `tenant/{tenantId}/pets/{petId}/vax/` and enters the staff review queue.

**Public routes:** `/login`, `/accept-invite`. **Authed routes** wrapped by `<RequirePortalAuth>`: everything else. 404 redirects to `/`.

## 6. Booking lifecycle & data flow

```
Owner taps "Submit"
  → POST /portal/bookings { service, petIds, dates, notes, request_id (client-generated UUID) }
  → server validates: pets belong to owner's customer, vax current, dates valid, service enabled
  → idempotency: if request_id already exists, return existing booking
  → creates bookings:{tenantId}:{bookingId} with status=pending, owner_submitted=true, request_id
  → enqueues notifications:{tenantId}:{customerId}:{ulid}
  → broadcasts on sync:{tenantId}:bookings (staff app realtime)
  → fires email "Booking request received" via Resend
  → returns booking object

Staff approves or declines from Pending Requests inbox
  → server updates booking status, writes status_changed_at + staff_id + reason (if declined)
  → broadcasts on TWO channels:
      sync:{tenantId}:bookings              (staff app)
      sync:{tenantId}:portal:{customerId}   (owner's portal)
  → enqueues notification + fires email ("Confirmed" or "Declined + reason")
  → owner's portal updates booking row in place, badge flips
```

Cancellation by owner follows the same broadcast pattern. Cancellation by staff (booking already confirmed) does too.

## 7. Backend changes

**New `/portal/*` routes** (mounted in the existing Edge Function under the Hono router):

| Method | Path                            | Purpose                                           |
| ------ | ------------------------------- | ------------------------------------------------- |
| POST   | `/portal/auth/accept-invite`    | Token → set password, consume invite              |
| GET    | `/portal/home`                  | Batched: greeting + upcoming bookings + alerts    |
| GET    | `/portal/bookings`              | Query `?scope=upcoming\|past`                     |
| GET    | `/portal/bookings/:id`          | Full booking detail                               |
| POST   | `/portal/bookings`              | Create booking request (idempotent via request_id)|
| POST   | `/portal/bookings/:id/cancel`   | Cancel — pending only                             |
| GET    | `/portal/pets`                  | Household pet list                                |
| GET    | `/portal/pets/:id`              | Single pet detail                                 |
| POST   | `/portal/pets/:id/edit-request` | Sends edit request to staff (email)               |
| GET    | `/portal/availability`          | Slot availability for grooming/overnight pickers  |
| POST   | `/portal/vax`                   | Multipart upload to Storage + review queue entry  |
| GET    | `/portal/notifications`         | Owner's in-app feed                               |
| POST   | `/portal/notifications/:id/read`| Mark read                                         |
| PATCH  | `/portal/account`               | Notification preferences only                     |

**Every authed route enforces** (server-side, in a single middleware):
1. Supabase JWT is valid
2. `user_metadata.portal_user === true`
3. Any `customer_id` referenced in the request matches the JWT subject's linked customer (no cross-customer access, ever)

**New KV namespaces** (additive — no migration of existing data):
- `portal_invites:{tenantId}:{token}` → `{ customer_id, expires_at, consumed_at? }`
- `portal_users:{tenantId}:{customerId}` → `{ auth_user_id, notification_prefs, created_at }`
- `notifications:{tenantId}:{customerId}:{ulid}` → `{ type, payload, link, read_at?, created_at }`
- `vax_review_queue:{tenantId}:{ulid}` → `{ pet_id, customer_id, storage_path, vax_type?, expiry?, submitted_at }`

**Realtime channel naming:** `sync:{tenantId}:portal:{customerId}` — scoped per owner so other customers' events never leak. Channel events: `booking.status_changed`, `notification.new`, `vax.reviewed`.

## 8. Staff-side changes (minimum surface)

All under existing admin/manager RBAC:

1. **Customer detail → "Send portal invite" button** — disabled if a portal user is already linked
2. **Customer detail → "Portal Activity" tab** — linked auth user, last-login, pending invites, **Resend invite** / **Revoke access** actions
3. **New module: Pending Requests inbox** (`src/app/modules/portal-requests/`) — list of `bookings` where `owner_submitted && status=pending`, time-since-submitted badge (red over 4h), detail panel with **Approve** / **Decline (reason required)**
4. **New module: Vax Review queue** — list of `vax_review_queue:*`, viewer for uploaded PDF/image, **Approve** (promotes to `vaccinations:*` record) / **Reject (reason)**
5. **Settings → Portal section** — tenant-level toggles per service (which services accept portal bookings), business-rule guards (min-advance-notice hours per service, max-pets-per-booking, blackout dates), editable email template subjects + above-fold copy, brand assets (logo + accent color)

## 9. Notifications & email

**Channels:** transactional email (Resend) + in-app notification feed (Supabase Realtime). No SMS, no web push in v1.

**Email events:** invite, password-reset (via Supabase Auth), booking_received, booking_confirmed, booking_declined (with reason), vax_approved, vax_rejected, vax_expiring (cron, ≤30d), edit_request_received (to staff).

**Templates:** new `lib/email/` module in the Edge Function. Subjects + above-fold copy editable per-tenant from Settings → Portal. `RESEND_API_KEY` stored in Supabase secrets. Email module behind a small interface so SendGrid / Postmark can drop in later.

**In-app feed:** notification bell on Home. Tap → drawer with grouped list (today / earlier this week / older). Tap an item → deep link to the relevant screen (booking detail, pet detail, etc).

## 10. Visual quality standard

This portal is the daycare's brand-facing customer surface. Generic shadcn-default look is unacceptable. Implementation phase will invoke, in order:

1. **`impeccable`** — `craft` flow to plan and produce premium production-grade interfaces, avoiding generic AI aesthetics
2. **`emil-design-eng`** — Emil Kowalski's playbook for component polish, animation decisions, the invisible details
3. **`design-taste-frontend`** / **`high-end-visual-design`** — taste enforcement and high-end visual rules

**Hard standards (binding constraints on implementation):**
- Custom design tokens — color, typography scale, spacing, motion, radius. *Not* stock shadcn defaults.
- Real type hierarchy — display / heading / body / caption with proper line-height and tracking
- Considered micro-interactions on every primary action: sheet open, tab switch, status flip, vax upload progress, button press, list-row tap
- Skeletons (not spinners) for every loading state; honest empty states with art + copy + a CTA
- Animations honor `prefers-reduced-motion`
- Photography of pets used as warmth, not garnish — owner sees their dog's face in the booking flow and on the home screen
- Touch targets ≥ 44×44 pt; safe-area-respecting on mobile (notch, home indicator)
- Dark mode in v1 — not optional

## 11. Error handling & edge cases

**Auth:**
- Invite token expired → friendly "Ask staff to resend" page with daycare phone visible
- Invite already consumed → "Sign in" deep link to `/login`
- Owner has no linked customer (data drift) → "Account not yet set up — contact daycare" + phone
- Owner deactivated by staff → next request 403s, client signs out with clear message

**Booking:**
- Dates in past / outside business hours → client-side validation + server re-check
- Pet not eligible (vax expired) → block with CTA to vax upload
- Service disabled at the tenant after picker loaded → server 409 → toast + reload service list
- Network drop mid-submit → optimistic "Sending…" with retry; idempotent via client `request_id`
- Race between staff approve/decline and owner cancel → first write wins, second gets 409 with current status

**Vax upload:**
- File > 10MB → reject client-side, show compression hint or "Send to staff" alternative
- Wrong file type → reject with allowed list (PDF/JPG/PNG)
- Upload succeeds, queue insert fails → nightly orphan-file sweeper
- PDF unreadable in viewer → fallback download link in staff review queue

**Network:** TanStack Query handles cache + retry. Persistent "You're offline" banner when navigator.onLine is false. v1 does not ship a service worker — the app degrades gracefully but is not installable yet.

## 12. Testing strategy

- **Unit:** Vitest (matches staff app) — hooks, utilities, Zod schemas, formatters
- **Integration:** Vitest + MSW — portal API client, Zustand store actions, auth context
- **E2E:** Playwright with two projects in `playwright.config.ts` — `staff` (existing) and `portal` (new). Critical paths:
  - Accept invite → set password → land on Home with pre-populated data
  - Submit booking request → realtime status update from staff approval
  - Vax upload → staff review → approval → status flips to Current
  - Mobile viewports: 375×667 (iPhone SE) and 414×896 (iPhone 11 Pro Max)
- **Visual regression:** Playwright screenshots on 5 hero screens (Home, Bookings list, Booking detail, Book step 1, Pet detail). Reviewed in CI on every PR.

## 13. Open questions / future work

**Deferred to v1.1+ (not blockers for v1):**
- PWA installability (manifest, service worker, install prompt, web push)
- Online payment + invoice viewing
- Live pet diary (photos/notes during stays)
- Native iOS / Android apps
- Multi-tenant white-label (branding swap by subdomain)
- Self-signup with staff verification flow
- SMS notifications (Twilio)
- Real-time hard-confirmed booking (not request-based)

**To resolve during planning (not now):**
- Concrete brand tokens (color palette, font choice) — drive from staff app's existing brand or design fresh? Confirm with stakeholder before tokens are locked.
- Whether vax upload accepts any image vs. requires a structured cert template
- Whether "request edit" on pet profile auto-applies trivial changes (e.g. weight) vs. always goes through staff

## 14. Suggested implementation phasing

This spec describes a v1 — too large for a single PR. Recommended sequence (writing-plans will refine):

1. **Foundation** — `shared/` folder, `portal/` Vite scaffold, Tailwind v4 + base tokens, Netlify config, `/portal/*` Hono router stub, server-side auth middleware
2. **Auth** — invite-send action (staff app), accept-invite + login screens (portal), `<RequirePortalAuth>` wrapper, email module + Resend integration
3. **Home + Pets (read-only)** — bottom tab navigation, Home screen with greeting and Up-next, Pets list + Pet detail screens, notification bell stub
4. **Vax upload + Vax Review queue** — owner-side upload sheet, Storage integration, staff-side review module — shipped as a pair
5. **Booking flow + Pending Requests inbox** — 4-step booking sheet (one service at a time first), staff-side Pending Requests module, end-to-end realtime status flip — shipped as a pair
6. **Notifications + email** — in-app feed drawer, email templates for all events, notification preferences in Account
7. **Visual polish pass** — invoke `impeccable` → `craft`, then `emil-design-eng`, then `design-taste-frontend` against every shipped screen. Custom design tokens, motion, micro-interactions, dark mode, empty states, skeletons
8. **Test hardening** — Playwright `portal` project, critical-path E2E, visual regression baseline on 5 hero screens
