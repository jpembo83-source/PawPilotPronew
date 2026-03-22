# Realtime Synchronisation Audit — Paw Pilot Pro
**Date:** March 22, 2026  
**Scope:** Full platform — all operational modules  
**Audit Type:** Realtime Infrastructure & Behaviour Validation

---

## Executive Summary

Paw Pilot Pro has a **partially live** realtime architecture. The core infrastructure is correctly built using Supabase Broadcast over WebSockets (event-driven, not polling-only), and it functions well for the modules that are fully wired in. However, **several critical operational modules only broadcast outgoing mutations but never subscribe to incoming events from other users**, meaning those views do not auto-update in a multi-user environment without a manual refresh or periodic poll expiring.

Additionally, there are **structural gaps** in location-scoping and role-scoping within the realtime layer that represent architectural risk and potential data leakage.

---

## Realtime Synchronisation Status — Per Module

| Module | Broadcasts Changes | Subscribes to Changes | Polling Fallback | Live Status |
|---|---|---|---|---|
| **Daycare Attendance** | Yes | Yes (`useModuleRealtimeSync`) | 120s | **Fully live** |
| **Daycare Dashboard** | Yes (via store) | No | 60s (clock tick only) | **Partially live** |
| **Grooming** | Yes | **No** | 60s (data + clock) | **Partially live (polling only)** |
| **Transport (Manager view)** | Yes | **No** | None | **Not live / refresh required** |
| **Transport (Driver mobile)** | Yes | **No** | 30s | **Partially live (polling only)** |
| **Overnights** | Yes | **No** | None | **Not live / refresh required** |
| **Billing** | Yes | **No** | None | **Not live / refresh required** |
| **Customers & Pets** | Yes | **No** | None | **Not live / refresh required** |
| **Staff & Rotas** | Yes | **No** | None | **Not live / refresh required** |
| **Dashboard (Widgets)** | N/A | Yes (`useRealtimeDashboard`) | None | **Fully live** |
| **Calendar** | No | **No** | None | **Not live / refresh required** |
| **Capacity Dashboard** | No | **No** | None | **Not live / refresh required** |
| **Incidents** | No | **No** | None | **Not live / refresh required** |
| **Messaging** | No | **No** | None | **Not live / refresh required** |
| **Reporting / Reports** | No | **No** | None | **Not live / refresh required** |

---

## Infrastructure Validation

### ✅ Realtime Infrastructure Exists and is Event-Driven

The platform uses a `RealtimeManager` singleton (`src/app/lib/realtime.ts`) that manages Supabase Broadcast channels following the naming pattern:

```
sync:{tenantId}:{module}
```

Channels are subscribed to via:
```typescript
channel.on('broadcast', { event: 'sync' }, callback).subscribe()
```

This confirms updates are **event-driven via WebSocket**, not polling-only. Polling is used only as a fallback safety net in specific views.

### ✅ Broadcast Helper Present and Used Consistently in Stores

All operational Zustand stores (`daycare`, `grooming`, `transport`, `overnights`, `billing`, `customers`, `staff`) call `broadcastMutation()` after successful mutations. This correctly notifies all other connected clients via Supabase Broadcast.

### ✅ No Self-Loop

The manager is configured with `{ broadcast: { self: false } }` and additionally filters out events matching the originating `clientId`. The mutating client uses its local store state directly, which is correct.

### ✅ Subscription Cleanup Handled

The `subscribe()` method returns an unsubscribe function, and all hooks (`useRealtimeSync`, `useModuleRealtimeSync`, `useRealtimeDashboard`) correctly clean up on unmount. Channel teardown also occurs when the last listener is removed.

### ✅ Dashboard is Fully Live

`Dashboard.tsx` uses `useRealtimeDashboard`, which subscribes to all 7 operational module channels simultaneously. Any change to daycare, grooming, transport, overnights, customers, staff, or billing will trigger `refreshAllWidgets()` immediately. Dashboard widgets are fully synchronised.

---

## Test Scenario Results

### Scenario 1 — Multi-User Live Attendance Test

- **User A checks in a dog** → `daycare` store broadcasts a `daycare:attendance:updated` event.
- **User B (Daycare Attendance page)** → `useModuleRealtimeSync` is active on this page. User B receives the broadcast and `loadAttendance()` is called immediately.
- **Result: PASS** — Attendance updates propagate live to other users on the same page.
- **Caveat:** User B only receives updates if they are on the `DaycareAttendance` page. Other daycare sub-pages do not independently subscribe.

---

### Scenario 2 — Cross-Feature Live Update: Transport Job Creation

- **User A creates a transport job** → `transport` store broadcasts `transport:job:created`.
- **Driver Mobile View (`DriverMobileView.tsx`)** → Does NOT subscribe to realtime. The driver sees the change only when the 30-second polling interval fires, or on manual refresh.
- **Manager Transport View** → Does NOT subscribe to realtime. No auto-update. Manual refresh required.
- **Dashboard widgets** → `useRealtimeDashboard` is subscribed. Dashboard updates immediately.
- **Result: PARTIAL FAIL** — Dashboard widget updates live. Driver and Manager views do not.

> **Severity: HIGH** — Transport is an operational-critical, time-sensitive module. A driver not seeing a new job assignment for up to 30 seconds is an operational risk. A manager's transport view not updating without a manual refresh is unacceptable for live operational control.

---

### Scenario 3 — Dashboard Synchronisation Test

- Any change to daycare, grooming, transport, overnights, customers, staff, or billing triggers `refreshAllWidgets()` via `useRealtimeDashboard`.
- **Result: PASS** — Dashboard is fully synchronised for all listed modules.
- **Exception:** Calendar, Capacity, Incidents, Reporting, Messaging changes do not trigger dashboard updates because these modules do not broadcast mutations at all.

---

### Scenario 4 — Location-Scoped Live Updates

**FAIL — Location scoping is not implemented.**

The Supabase channel naming pattern is:
```
sync:{tenantId}:{module}
```

There is **no `locationId` component** in the channel name, and no location filter is applied within the `RealtimeManager` or any subscriber hook. This means:

- All users in the same tenant on the same module channel receive **all broadcasts from all locations**.
- A check-in at Location A is broadcast to users who only have access to Location B.
- The frontend store/UI may filter the data on render (based on `selectedLocationId`), but **the raw event still arrives at every client**.

> **Severity: HIGH** — This is both an operational noise issue (users see irrelevant update toasts) and a potential data integrity risk. A user at Location B could have their store inadvertently refreshed with cross-location data if the refetch is not correctly scoped.

---

### Scenario 5 — Role-Scoped Live Updates

**FAIL — Role scoping is not implemented in the realtime layer.**

The Supabase channel has no role filter. All authenticated users in the same tenant who are subscribed to a module channel receive all broadcast events for that module, regardless of their role (Staff, Manager, Admin). The payload includes the `entity`, `action`, `recordId`, and `userId` of the mutation.

- Staff members receive the same broadcast events as Admins.
- The notification toast shown (`notifyRealtimeUpdate`) does not filter by role — any user sees "Billing invoice added" toasts even if they have no billing access.

> **Severity: MEDIUM** — While UI rendering respects RBAC, the broadcast events themselves leak operational metadata (what changed, when, what entity) to all subscribers. This is an information disclosure issue.

---

### Scenario 6 — Conflict Handling

**PARTIAL PASS — Warning only, no enforcement.**

The `ConflictNotification.tsx` component provides a conflict warning mechanism:

1. Components can call `registerActiveEdit(module, entity, recordId)` to mark that a user is currently editing a record.
2. When a broadcast arrives for that exact `module:entity:recordId`, a `toast.warning()` is shown telling the user their changes may overwrite another user's recent changes.

**What works:**
- Conflict detection is in place for concurrent edits on the same record.
- The warning message is clear and actionable.

**What is missing:**
- `registerActiveEdit` is available but it is **not called from any actual edit form** in the codebase. The conflict detection system exists but is not wired into the forms.
- No optimistic locking, no server-side versioning, no `updatedAt` check before save.
- Silent overwrites **can and do occur** — the later save wins with no server-side validation of concurrent edits.

> **Severity: HIGH** — Conflict detection UI exists but is not connected to forms. Silent overwrites are possible. For operational records (attendance, transport job status), this is a data integrity risk.

---

### Scenario 7 — Realtime Infrastructure Validation

| Validation Point | Status | Notes |
|---|---|---|
| Subscriptions correctly configured | **Partial** | Channels exist and subscribe correctly, but most modules are missing the subscriber hook in their UI layer |
| Updates are event-driven | **Yes** | Supabase Broadcast (WebSocket) is used — not polling-only |
| Polling exists as fallback | **Yes** | Transport (30s), Grooming (60s), Attendance (120s) |
| No stale UI states after mutation for self | **Yes** | Local store update is immediate; broadcast targets other clients |
| No stale UI states after mutation for other users | **No** | Only Attendance and Dashboard are fully live for incoming events |
| Location-scoped updates | **No** | Channel has no location dimension |
| Role-scoped updates | **No** | All subscribers receive all events |

---

## Detailed Findings & Recommendations

### FINDING 1 — Missing Subscriber Hooks in Operational Modules
**Severity: HIGH**

**Affected modules:** Grooming, Transport (manager view), Overnights, Billing, Customers, Staff

**Description:** Each of these modules correctly broadcasts mutations via `broadcastMutation()` in their Zustand stores, but no page or component in these modules calls `useModuleRealtimeSync` or `useRealtimeSync` to subscribe to incoming events from other clients.

**Impact:** A multi-user team will not see each other's changes in real time on these pages. User B must manually refresh, wait for the polling interval (if applicable), or navigate away and back.

**Recommendation:** Add `useModuleRealtimeSync(module, refetchFn)` to the primary page component in each of these modules, following the exact pattern already implemented in `DaycareAttendance.tsx`:

```typescript
// Example for GroomingDashboard.tsx
useModuleRealtimeSync('grooming', loadData);
```

The `refetchFn` should be the existing data-load function already called on mount and in polling intervals.

---

### FINDING 2 — No Location Scoping in Realtime Channels
**Severity: HIGH**

**Description:** The channel name `sync:{tenantId}:{module}` broadcasts to all users of the tenant regardless of their assigned location. For a multi-location business, this causes operational noise and carries a risk of cross-location data surface.

**Recommendation:** Extend the channel naming pattern to include location:
```
sync:{tenantId}:{locationId}:{module}
```
The `broadcastMutation` helper and `RealtimeManager.init()` must accept a `locationId` parameter. Subscribers should only join channels for their accessible locations.

---

### FINDING 3 — No Role Scoping in Realtime Events
**Severity: MEDIUM**

**Description:** Broadcast events carry metadata (entity type, action, recordId) and are delivered to all subscribers on a channel, regardless of role.

**Recommendation:** Either:
- Extend the broadcast payload with a `requiredRole` field and have subscriber hooks filter events by the current user's role before notifying components.
- Use Supabase Row-Level Security on Postgres CDC subscriptions for authoritative server-side filtering (this requires migrating from Broadcast to Postgres CDC for sensitive modules).

---

### FINDING 4 — Conflict Detection Not Wired to Edit Forms
**Severity: HIGH**

**Description:** `registerActiveEdit()` from `ConflictNotification.tsx` exists but is not called by any form or edit dialog in the codebase. The conflict detection system is built but disconnected.

**Recommendation:** In every edit modal or inline editor, call:
```typescript
const deregister = registerActiveEdit(module, entity, recordId);
return () => deregister(); // cleanup on unmount
```
Additionally, consider adding server-side `updatedAt` optimistic locking — the client sends the `updatedAt` timestamp it last saw, and the server rejects the save if the record has since been updated by another user.

---

### FINDING 5 — Calendar, Capacity, Incidents, Messaging Modules Have No Realtime at All
**Severity: MEDIUM**

**Description:** These modules neither broadcast mutations nor subscribe to incoming events. They are entirely static between page loads.

**Recommendation:** Add `broadcastMutation` calls to any state-changing operations in these modules, and add `useModuleRealtimeSync` hooks to their primary pages. For Calendar, this is particularly important as booking status changes from other modules should reflect immediately.

---

### FINDING 6 — Daycare Dashboard Polling Ticks Clock But Does Not Refetch Data
**Severity: LOW**

**Description:** `DaycareDashboard.tsx` uses a 60-second `setInterval` that only updates `currentTime` (for the clock display). It does not refetch operational data.

**Recommendation:** Either add a data refetch call inside the interval, or add `useModuleRealtimeSync('daycare', loadData)` to the component.

---

## Areas Requiring Manual Refresh (Flagged)

The following areas currently require a manual browser refresh or navigation action for a second user to see changes made by a first user:

| Area | Reason | Severity |
|---|---|---|
| Grooming appointments (all views) | No subscriber hook on any grooming page | HIGH |
| Transport job board (manager view) | No subscriber hook | HIGH |
| Overnights allocation | No subscriber hook | HIGH |
| Billing (invoices, payments) | No subscriber hook | HIGH |
| Customer profiles, notes, flags | No subscriber hook | MEDIUM |
| Staff rotas and shifts | No subscriber hook | MEDIUM |
| Calendar | No realtime at all | MEDIUM |
| Capacity dashboard | No realtime at all | MEDIUM |
| Incidents | No realtime at all | MEDIUM |

---

## Summary of Realtime Synchronisation Status

| Area | Status |
|---|---|
| Dashboard widgets | **Fully live** |
| Daycare attendance | **Fully live** |
| Grooming | **Partially live** (polling only, 60s lag) |
| Transport driver view | **Partially live** (polling only, 30s lag) |
| Transport manager view | **Not live / refresh required** |
| Overnights | **Not live / refresh required** |
| Billing | **Not live / refresh required** |
| Customers | **Not live / refresh required** |
| Staff | **Not live / refresh required** |
| Calendar | **Not live / refresh required** |
| Capacity | **Not live / refresh required** |
| Incidents | **Not live / refresh required** |
| Location scoping | **Broken / not implemented** |
| Role scoping | **Broken / not implemented** |
| Conflict detection | **Broken / not wired to forms** |

---

## Conclusion

The realtime infrastructure in Paw Pilot Pro is architecturally sound — Supabase Broadcast channels, a clean `RealtimeManager`, well-structured hooks, and correct cleanup patterns are all in place. The core infrastructure passes validation. However, **the majority of operational modules do not subscribe to incoming events**, meaning the system behaves as a one-way notification bus rather than a true live operational control system for most views.

The highest-priority remediation actions are:

1. **Add `useModuleRealtimeSync` to Grooming, Transport, Overnights, Billing, Customers, and Staff pages** — this is a low-effort, high-impact fix that leverages the existing infrastructure.
2. **Wire `registerActiveEdit` into all edit forms** — conflict protection is built, it just needs connecting.
3. **Add location scoping to channel names** — prevents cross-location broadcast noise and data leakage.
