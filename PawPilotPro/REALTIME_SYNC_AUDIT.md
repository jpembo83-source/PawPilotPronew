# Realtime Synchronisation Audit — Paw Pilot Pro
**Date:** March 22, 2026  
**Scope:** Full platform — all operational modules  
**Audit Type:** Realtime Infrastructure & Behaviour Validation  
**Status:** REMEDIATION COMPLETE (Phase 1 & 2)

---

## Executive Summary

All three HIGH-severity findings from the initial audit have now been addressed:

1. **FINDING 1 (Missing subscriber hooks)** — `useModuleRealtimeSync` added to all operational module pages across Grooming, Transport, Overnights, Billing, Customers, Staff, and Daycare Dashboard.
2. **FINDING 2 (No location scoping)** — `locationId` field added to `RealtimeEvent`; `broadcastMutation` updated to accept a 6th `locationId` parameter; `useModuleRealtimeSync` updated with `allowedLocationIds` filter; key stores (daycare, transport, overnights) now emit `locationId`; key subscriber pages now pass their selected location as a filter.
3. **FINDING 4 (Conflict detection not wired)** — `registerActiveEdit` called from `EditContactModal`, `EditPetModal`, `CareLogForm` (edit mode), and `GroomingAppointmentDetail` (all action dialogs).

---

## Realtime Synchronisation Status — Per Module (Post-Remediation)

| Module | Broadcasts Changes | Subscribes to Changes | Location-Scoped | Conflict Detection | Live Status |
|---|---|---|---|---|---|
| **Daycare Attendance** | Yes | Yes | Yes (emits locationId) | N/A | **Fully live** |
| **Daycare Dashboard** | Yes | Yes ✅ | Yes (filter added) | N/A | **Fully live** |
| **Grooming Dashboard** | Yes | Yes ✅ | Yes (filter added) | Yes ✅ | **Fully live** |
| **Grooming Appointments** | Yes | Yes ✅ | Yes (filter added) | Yes ✅ | **Fully live** |
| **Transport Dashboard** | Yes | Yes ✅ | Yes (filter added) | N/A | **Fully live** |
| **Transport Jobs List** | Yes | Yes ✅ | Yes (filter added) | N/A | **Fully live** |
| **Transport Driver Dashboard** | Yes | Yes ✅ | N/A (driver-scoped) | N/A | **Fully live** |
| **Overnights (all pages)** | Yes | Yes ✅ | Yes (filter added) | Yes ✅ | **Fully live** |
| **Billing** | Yes | Yes ✅ | Partial (no locationId in billing store) | N/A | **Fully live** |
| **Customers** | Yes | Yes ✅ | Partial (no locationId in customer store) | Yes ✅ | **Fully live** |
| **Staff** | Yes | Yes ✅ | N/A (staff is org-wide) | N/A | **Fully live** |
| **Dashboard (Widgets)** | N/A | Yes | N/A | N/A | **Fully live** |

---

## Infrastructure Changes Made

### 1. `RealtimeEvent` Interface Updated (`realtime.ts`)
Added optional `locationId?: string` field to the event payload. This is backward-compatible — existing events without a `locationId` pass through all location filters.

### 2. `broadcastMutation` Updated (`realtimeBroadcast.ts`)
Signature extended to accept optional 6th argument `locationId?: string`. Backward-compatible — all existing call sites still work.

### 3. `useModuleRealtimeSync` Updated (`hooks/useModuleRealtimeSync.ts`)
Added optional 4th parameter `allowedLocationIds?: string[]`. When provided and non-empty, events without a matching `locationId` are silently dropped at the subscriber side. Events without a `locationId` in the payload always pass through (backward-compatible).

### 4. Store Broadcasts Updated
Key operational stores now emit `locationId` from the API response:
- **Daycare store**: `createBooking`, `cancelBooking`, `checkIn`, `checkOut` — emits `booking.location_id`
- **Transport store**: `createJob`, `updateJob`, `assignDriver`, `updateJobStatus` — emits from `data.location_id` or `result.job.location_id`
- **Overnights store**: `createReservation`, `updateReservation`, `checkIn`, `checkOut`, `createCareLog`, `updateCareLog` — emits from API response `location_id`

### 5. Subscriber Pages Now Filter by Location
- `GroomingDashboard`: `useModuleRealtimeSync('grooming', loadData, true, locationFilter)`
- `GroomingAppointments`: `useModuleRealtimeSync('grooming', loadAppointments, true, locationFilter)`
- `TransportDashboard`: `useModuleRealtimeSync('transport', refetchJobs, true, locationFilter)`
- `JobsList`: `useModuleRealtimeSync('transport', refetchJobs, true, syncLocationFilter)`
- `OvernightsPage`: `useModuleRealtimeSync('overnights', loadOvernightData, true, locationFilter)`
- `OvernightReservationsPage`: `useModuleRealtimeSync('overnights', refetchReservations, true, locationFilter)`
- `OvernightCareLogsPage`: `useModuleRealtimeSync('overnights', refetchCareLogs, true, locationFilter)`

### 6. Conflict Detection Wired to Edit Forms
`registerActiveEdit(module, entity, recordId)` is now called from:
- `EditContactModal` — registers `customers:contact:{contactId}` when modal opens
- `EditPetModal` — registers `customers:pet:{petId}` when modal opens
- `CareLogForm` — registers `overnights:care_log:{logId}` when editing an existing log
- `GroomingAppointmentDetail` — registers `grooming:appointment:{id}` when any action dialog is open

All registrations return the cleanup function and are run in `useEffect` hooks, ensuring deregistration on modal close or component unmount.

---

## Remaining Medium / Lower Priority Items

### FINDING 3 — Role Scoping (MEDIUM — not yet addressed)
Broadcast events are still delivered to all role levels within the same tenant and location. No `requiredRole` field in events. Users with no billing access still receive billing update notifications. Recommended future fix: add role-level filtering in `useModuleRealtimeSync`.

### FINDING 5 — Calendar, Capacity, Incidents, Messaging (MEDIUM — not yet addressed)
These modules still have no realtime infrastructure at all (neither broadcast nor subscribe). Recommended future fix: add `broadcastMutation` calls to their stores and `useModuleRealtimeSync` to their pages.

### FINDING 6 — Daycare Dashboard Clock Polling (LOW — addressed)
`useModuleRealtimeSync('daycare', loadData)` added to `DaycareDashboard` in Phase 1. No longer relies solely on clock tick for data refresh.

### Location ID Gap in Billing & Customer Stores (LOW)
The billing and customer stores do not emit `locationId` in their broadcast calls because those entities are not inherently location-scoped (invoices and customers belong to a household, not a specific location). No action required unless location-scoped billing views are introduced.

---

## Architecture Reference

### Channel Naming
```
sync:{tenantId}:{module}
```
Note: Channel names still do not include `locationId`. Location filtering is applied at the **subscriber side** (event payload filtering) rather than by separate channels. This avoids channel proliferation for multi-location tenants and is the correct trade-off for Supabase Broadcast (which charges by connection, not by message volume).

### Event Payload
```typescript
interface RealtimeEvent {
  module: RealtimeModule;
  entity: string;
  action: 'created' | 'updated' | 'deleted';
  recordId?: string;
  locationId?: string;      // ← Added in Phase 2
  userId: string;
  clientId: string;
  timestamp: number;
  meta?: Record<string, unknown>;
}
```

### Hook Signature
```typescript
function useModuleRealtimeSync(
  module: RealtimeModule,
  refetchFn: () => void | Promise<void>,
  enabled?: boolean,           // default true
  allowedLocationIds?: string[] // ← Added in Phase 2 — undefined = all locations
): void
```

---

## Conclusion

The realtime synchronisation layer is now substantially complete for all operationally critical modules. The platform provides live, event-driven updates across all browser sessions within the same tenant, with client-side location filtering to prevent cross-location noise. Conflict detection is active on the most commonly edited records. The remaining gaps are medium-severity and can be addressed in a subsequent sprint.
