# Paw Pilot Pro — Replit Agent Guide

## Overview

Paw Pilot Pro is a production-grade dog daycare operations platform built for internal staff use. It manages the full operational lifecycle of a dog daycare business: customer and pet management, daily attendance/check-in, grooming appointments, overnight boarding, transport logistics, billing, staff management, and reporting.

The project originated in Figma Make and is a Vite + React + TypeScript frontend that connects to a Supabase backend (Edge Functions + KV store). The frontend runs on port 5000. All API calls go to a single Supabase Edge Function endpoint.

**Primary project directory:** `PawPilotPro/project/`

---

## User Preferences

Preferred communication style: Simple, everyday language.

Additional preferences observed:
- British English throughout the UI (use "Overnights" not "Boarding", etc.)
- No mock/seed data buttons in production UI — production-grade only
- No placeholder widgets, "coming soon" tabs, or dead UI elements
- Actions should be bold internally, cautious externally (no accidental data mutations)
- Write decisions and context to memory files so they persist across sessions
- The user is Jason (CET timezone). Address them as Jason.

---

## System Architecture

### Frontend

- **Framework:** React 18 + TypeScript, bundled with Vite
- **Port:** 5000 (strict, host `0.0.0.0`)
- **Entry point:** `PawPilotPro/project/src/main.tsx` → `App.tsx`
- **Routing:** React Router v6, all routes defined in `App.tsx`
- **Styling:** Tailwind CSS v4 (via `@tailwindcss/vite`), shadcn/ui components (Radix UI primitives), custom CSS variables for theming
- **UI components:** shadcn/ui (`@radix-ui/*`), MUI icons, Lucide icons
- **Theme:** Warm terracotta palette (`--primary: #BA7E74`), defined in `src/styles/theme.css`, dynamically updated via `ThemeManager.tsx` from org settings
- **Forms:** React Hook Form + Zod (`@hookform/resolvers`)
- **Notifications:** Sonner toasts
- **Charts:** Recharts (used in dashboard widgets)
- **PWA:** Manifest + service worker ready (`public/manifest.json`)

### State Management

- **Zustand** stores per module (e.g., `modules/grooming/store.ts`, `modules/daycare/store.ts`)
- Stores handle all API calls directly (no separate API layer in most modules)
- Persist middleware used for some stores (e.g., sidebar collapse state in dashboard store)
- `useViewAsStore` for View As admin feature

### Module Structure

All feature modules live under `PawPilotPro/project/src/app/modules/`:

| Module | Status | Notes |
|---|---|---|
| `dashboard` | Production | Widgets, quick actions bar, collapsible sidebar |
| `daycare` | Production | Check-in/out, bookings, attendance |
| `grooming` | Production | Appointments, grooming lifecycle, queue |
| `overnights` | Production | Reservations, capacity, care logs |
| `transport` | Production | Driver status, route management |
| `customers` | Production | Households, pets, contacts, vaccinations |
| `billing` | Beta (admin only) | |
| `messaging` | Beta (admin only) | |
| `staff` | Beta (admin only) | |
| `packages` | Beta (admin only) | |
| `settings` | Production | Org, locations, RBAC, pricing, integrations |
| `reports` | Production | |
| `calendar` | Production | |
| `incidents` | Production | |

Beta modules are gated by `BetaRoute` component and `useBetaFeatures` hook. Currently, beta = admin role (not email whitelist).

### Backend

- **Platform:** Supabase Edge Functions (Deno)
- **Function name:** `make-server-fc003b23`
- **Base URL pattern:** `https://${projectId}.supabase.co/functions/v1/make-server-fc003b23`
- **Framework inside Edge Function:** Hono
- **Storage:** Supabase KV store (not Postgres tables) — this is key. Data is stored as KV key-value pairs, not relational tables.
- **Auth headers required on all API calls:**
  - `Authorization: Bearer ${publicAnonKey}` (Supabase anon key)
  - `X-User-Token: Bearer ${session.access_token}` (user JWT)

**CRITICAL:** Never use `import.meta.env.VITE_SUPABASE_URL` — it is undefined. Always build the URL using `projectId` from `utils/supabase/info.ts`:
```typescript
import { projectId, publicAnonKey } from '../../../../utils/supabase/info';
const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-fc003b23`;
```

### Authentication & Authorisation

- **Auth provider:** Supabase Auth (`@supabase/supabase-js`)
- **Context:** `AuthContext.tsx` wraps the app; provides `user`, `login`, `logout`, `hasPermission`
- **Roles:** `admin`, `manager`, `assistant_manager`, `staff`
- **RBAC:** Permission resolution order: Admin bypass → User overrides → Template permissions → Role defaults
- **Permission gate:** `PermissionGate` component for declarative UI gating; `usePermissions` hook for imperative checks
- **"View As":** Admins can impersonate other users via `ViewAsContext` + `useViewAsStore` + `view-as` API module
- **Session handling:** "Stay logged in" uses localStorage; temp sessions use sessionStorage flag

### Realtime Synchronisation

- **Transport:** Supabase Realtime Broadcast channels (NOT Postgres Changes)
- **Channel naming:** `sync:{tenantId}:{module}` (e.g., `sync:demo-tenant-001:daycare`)
- **Deduplication:** Each tab generates a unique `CLIENT_ID`; own events are ignored
- **Location scoping:** `locationId` field on `RealtimeEvent`; subscribers filter by `allowedLocationIds`
- **Conflict detection:** `registerActiveEdit(module, entity, recordId)` called from edit modals; triggers warning toast if same record edited by another user
- **Core files:**
  - `src/app/lib/realtime.ts` — `RealtimeManager` singleton
  - `src/app/lib/realtimeBroadcast.ts` — `broadcastMutation(tenantId, module, action, entity, recordId?, locationId?)`
  - `src/app/hooks/useModuleRealtimeSync.ts` — per-module subscriber hook
  - `src/app/components/ConflictNotification.tsx` — conflict detection logic
  - `src/app/context/RealtimeContext.tsx` — provider that initialises the manager on login

All production module pages must call `useModuleRealtimeSync` to subscribe to live updates.

### Pricing Architecture

Four-layer model:
1. **Service Definitions** — what is sold (per module: Daycare, Grooming, Transport, Boutique)
2. **Price Books** — base pricing
3. **Location Overrides** — per-location price adjustments
4. **Commercial Modifiers** — memberships, packages, penalties

All pricing changes are audit-logged.

### Feature Enablement

Features are gated at two levels:
1. **Tenant level** — org-wide entitlement
2. **Location level** — per-location toggle

If a feature is disabled, ALL UI references must disappear (no dead buttons, empty tabs, or broken links).

### Testing

- **E2E:** Playwright (`tests/e2e/`)
- **Config:** `playwright.config.ts` — baseURL defaults to `http://localhost:5173`, uses saved auth state
- **Seed data script:** `scripts/seed-test-data.ts` (run via `npm run seed:test`)

---

## External Dependencies

### Supabase
- **Project ID:** Stored in `VITE_SUPABASE_PROJECT_ID` env var (read via `utils/supabase/info.ts`)
- **Anon Key:** Stored in `VITE_SUPABASE_ANON_KEY` env var
- **Services used:**
  - Supabase Auth (user authentication)
  - Supabase Realtime (broadcast channels for live sync)
  - Supabase Edge Functions (all backend API logic)
  - Supabase KV store (primary data storage — not Postgres)
  - Supabase Storage (file/photo uploads)
- **Client:** `project/utils/supabase/client.ts`

### NPM Packages (key ones)
- `@supabase/supabase-js` ^2.89.0
- `react` + `react-dom` 18.3.1
- `react-router` (v6 — note: import from `react-router`, not `react-router-dom`)
- `zustand` — state management
- `sonner` — toast notifications
- `react-hook-form` + `@hookform/resolvers` + `zod` — forms and validation
- `date-fns` 3.6.0 — date utilities
- `exceljs` — Excel export
- `embla-carousel-react` — carousels
- `cmdk` — command palette
- Full Radix UI suite (`@radix-ui/*`)
- `@mui/material` + `@mui/icons-material` — supplementary icons/components
- `@playwright/test` — E2E testing

### PWA
- Manifest at `public/manifest.json`
- App name: "Paw Pilot Pro", short name: "PawPilot"
- Theme colour: `#BA7E74`

### Build Tooling
- Vite with `@vitejs/plugin-react` and `@tailwindcss/vite`
- Path alias: `@` → `./src`
- TypeScript throughout

---

## Cross-Feature Operational Workflows (implemented)

The following cross-feature wiring was added as part of the operational workflow spec:

### Location-Gated Feature Visibility
- **Transport checkbox in CreateBookingDialog** — only renders when `selectedLocation.enabledModules` includes `'transport'`
- **"Transition to Overnight?" in DaycareCheckOut** — only renders when `selectedLocation.enabledModules` includes `'overnights'`; calls `transitionFromDaycare(petId, locationId, sourceBookingId)` in the overnights store

### Daycare ↔ Transport Live Linking
- **DaycareDashboard** fetches today's transport jobs (via `useTransportStore.fetchJobs`) when transport is enabled at the selected location
- Transport column badge now reflects live job status: Scheduled / Unassigned / En Route / Delivered / Cancelled
- Status badges are clickable and navigate to `/transport/jobs/:id`
- Falls back to a static "Transport" badge if job data isn't available

### Dashboard Quick Actions
- **QuickTransportModal** replaced with real navigation: "Transport Dashboard" → `/transport`, "View All Jobs" → `/transport/jobs`
- **MessagingWidget** "Open Messages" link navigates to `/messaging`

### Dog Details Panel
- Removed dead "Message Owner" button (messaging module has no per-dog context)
- Removed dead "Report Incident" button (incidents flow is separate)

### Transport Job Notes
- `JobsList.tsx` shows an amber warning triangle + note text under the pet name when `job.notes` is set

### Billing Tab Cleanup
- Removed "coming soon" tabs: Payments, Subscriptions, Credits & Refunds, Fees & Adjustments
- Billing page retains: Overview, Invoices, Settings tabs (all functional)

### Communications Settings Dialogs
- `TemplateBuilderDialog`, `AutomationRuleDialog`, `SLADialog` no longer show "coming soon"/"under construction" content
- Now show professional information panels explaining what the feature does, with a Close button
- Trigger buttons remain so admins are aware the capability exists