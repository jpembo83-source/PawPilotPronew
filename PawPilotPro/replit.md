# MDC Operations Centre - Dog Daycare Platform ("Paw Pilot Pro")

## Overview
A Vite + React frontend application for managing dog daycare operations (daycare, grooming, overnights, transport, billing, reporting). Connects to a Supabase backend with Edge Functions.

## Architecture
- **Frontend**: React + TypeScript + Vite, runs on port 5000
- **Backend**: Supabase Edge Functions at `https://ruahrxkfgfyshuxykiay.supabase.co/functions/v1/make-server-fc003b23`
- **State Management**: Zustand stores per module
- **UI**: shadcn/ui components

## Project Structure
```
project/
├── src/app/modules/       # Feature modules (dashboard, daycare, grooming, overnights, transport, etc.)
├── utils/supabase/        # Supabase client config and project info
│   ├── client.ts          # Supabase client
│   └── info.ts            # Project ID and anon key exports
├── supabase/functions/    # Edge function code (deployed separately)
└── vite.config.ts
```

## Modules
- **Daycare**: Full production module — check-in/out, bookings, attendance
- **Grooming**: Full production module — appointments, check-in, grooming workflow (start/complete/checkout), queue management, groomer status, pricing with additional charges
- **Overnights**: Full production module — reservations, capacity, care logs
- **Transport**: Full production module — driver status, route management
- **Dashboard**: Widgets for all modules, quick actions bar
- **Beta modules**: billing, messaging, staff, packages (hidden from non-beta users)

## Grooming Module
- **Routes**: `/grooming` (dashboard), `/grooming/appointments` (list), `/grooming/appointments/new` (create), `/grooming/appointments/:id` (detail), `/grooming/check-in/:id` (check-in flow)
- **Store**: `modules/grooming/store.ts` — Zustand store with full CRUD, check-in validation, grooming lifecycle (start/complete/checkout)
- **Pages**: GroomingDashboard, GroomingAppointments, NewGroomingAppointment, GroomingAppointmentDetail, GroomingCheckIn
- **Dashboard integration**: `grooming_today` widget, "Grooming" quick action (no beta flag)

## API URL Pattern
All API calls must use the `projectId` from `utils/supabase/info.ts`:
```typescript
import { projectId } from '../../../../utils/supabase/info';
const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-fc003b23`;
```
Do NOT use `import.meta.env.VITE_SUPABASE_URL` — it is not defined.

## Realtime Synchronisation
- **Architecture**: Supabase Realtime Broadcast channels (not Postgres Changes)
- **Channel naming**: `sync:{tenantId}:{module}` (e.g. `sync:demo-tenant-001:daycare`)
- **Client deduplication**: Each browser tab generates a unique CLIENT_ID; own events are ignored
- **Core files**:
  - `src/app/lib/realtime.ts` — RealtimeManager singleton (channel lifecycle, subscribe/broadcast)
  - `src/app/lib/realtimeBroadcast.ts` — `broadcastMutation()` helper used in all stores
  - `src/app/hooks/useRealtimeSync.ts` — Low-level hook for subscribing to a module channel
  - `src/app/hooks/useModuleRealtimeSync.ts` — Higher-level hook (subscribe + toast + refetch)
  - `src/app/hooks/useRealtimeDashboard.ts` — Dashboard hook subscribing to all operational modules
  - `src/app/context/RealtimeContext.tsx` — Provider that initialises manager with tenant ID on login
  - `src/app/components/ConflictNotification.tsx` — Toast notifications + conflict detection for concurrent edits
- **Instrumented stores**: daycare, grooming, transport, overnights, customers, staff, billing
- **Provider location**: `App.tsx` — `<RealtimeProvider>` wraps inside `<AuthProvider>`, outside `<ViewAsProvider>`

## Vaccination System (Simplified Swiss-Standard)
- **Approach**: Simple checkbox + expiry date per vaccine (replaces old per-record CRUD)
- **Swiss standard vaccines**: Rabies (legally required), SHP (Staupe/Hepatitis/Parvo), Leptospirosis, Kennel Cough
- **Types**: `PetVaccinations`, `VaccinationEntry`, `SWISS_VACCINATIONS` constant in `customers/types.ts`
- **Component**: `VaccinationManager.tsx` — checkbox checklist with debounced saves via `updatePet`
- **Status computation**: Client-side from vaccination expiry dates → `up_to_date` | `expiring_soon` | `expired` | `unknown`
- **Dashboard widget**: `VaccinationExpiryWidget.tsx` — fetches all households→pets to find expiring/expired vaccinations
- **Integration points**: `vaccination_status` field used in daycare check-in, grooming details, quick book modal, dashboard alerts

## Key Configuration
- Dev server port: 5000
- Workflow: `cd project && npm run dev`
- Vite: 6.4.1
- Excel export: `exceljs` (replaced `xlsx` due to unpatched vulnerabilities)
- Security overrides in package.json: rollup@4.59.0, tar@7.5.11
