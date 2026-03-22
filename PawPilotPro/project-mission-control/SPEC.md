# Mission Control for OpenClaw/Jeff
## Product & Engineering Specification

**Version:** 1.0 Draft  
**Date:** 2026-02-07  
**Author:** Jeff (Product + Engineering Lead)

---

# Executive Summary

Mission Control is a local desktop application for orchestrating an AI agent ("Jeff") running on a remote VPS. It provides mission decomposition, intelligent scheduling, real-time monitoring, and resilient connectivity—all through a clean, futuristic dark UI.

**Core Value Proposition:**  
"Define the mission once. Jeff handles the rest. You stay in control."

---

# A. Product Specification

## A.1 Key User Journeys

### Journey 1: Mission Definition
```
User opens Mission Control → Creates new Mission → 
Writes high-level prompt → System decomposes into Sprints → 
User reviews/adjusts → Sprints decompose into Tasks → 
Tasks become schedulable Prompts → User approves schedule
```

### Journey 2: Monitoring Active Work
```
User sees Dashboard → Views active Runs in real-time → 
Clicks into Run for live console stream → 
Sees Jeff's thinking/output as it happens → 
Gets notified on completion or failure
```

### Journey 3: Handling Failures
```
Run fails → Appears in Incident Log → User reviews error → 
Chooses: Retry / Modify Prompt / Skip / Escalate → 
System executes decision → Updates dependent tasks
```

### Journey 4: Offline Resilience
```
Connection drops → UI shows "Reconnecting" → 
User continues creating schedules (queued locally) → 
Connection restores → Pending dispatches execute in order → 
Logs resume from cursor (no gaps)
```

### Journey 5: Health Check
```
User notices yellow status indicator → Opens Health Centre → 
Sees: high error rate, queue depth growing → 
Drills into metrics → Identifies cause → Takes action
```

---

## A.2 Screen List

| Screen | Purpose | Key Components |
|--------|---------|----------------|
| **Dashboard** | At-a-glance status | Connection status, active runs, next scheduled, recent completions, health sparklines |
| **Missions** | Mission library | List of missions, status badges, search/filter, create new |
| **Mission Detail** | Drill into mission | Sprint tree, task breakdown, progress bars, timeline view |
| **Prompt Editor** | Edit individual prompts | Rich text editor, variable injection, test run, schedule config |
| **Schedule Builder** | Configure when/how prompts run | Cron builder, dependency graph, time windows, concurrency settings |
| **Run History** | All runs with filters | Sortable table, status filters, duration, output preview |
| **Run Detail** | Single run deep dive | Full logs, Jeff Console stream, timing breakdown, output artifacts |
| **Jeff Console** | Live stream from Jeff | Real-time output, command input (if enabled), pause/resume scroll |
| **Health Centre** | Observability hub | Liveness/readiness, metrics charts, resource gauges, alert config |
| **Incidents** | Failures requiring attention | Incident list, triage actions, resolution tracking |
| **Settings** | Configuration | Connection settings, auth, notification preferences, theme |

---

## A.3 Data Model

```
┌─────────────────────────────────────────────────────────────────┐
│                         MISSION                                  │
│  id, name, description, raw_prompt, status, created_at          │
└─────────────────────────────────────────────────────────────────┘
                              │ 1:N
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                         SPRINT                                   │
│  id, mission_id, name, goal, sequence, status, created_at       │
└─────────────────────────────────────────────────────────────────┘
                              │ 1:N
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                          TASK                                    │
│  id, sprint_id, name, description, sequence, status             │
└─────────────────────────────────────────────────────────────────┘
                              │ 1:N
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                         PROMPT                                   │
│  id, task_id, content, variables, version, status               │
└─────────────────────────────────────────────────────────────────┘
                              │ 1:1
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                        SCHEDULE                                  │
│  id, prompt_id, schedule_type (once|cron), cron_expr,           │
│  next_run_at, time_window_start, time_window_end,               │
│  max_retries, retry_delay_ms, concurrency_group,                │
│  concurrency_limit, requires_approval, enabled                  │
└─────────────────────────────────────────────────────────────────┘
          │                                    │
          │ depends_on (N:M)                   │ triggers
          ▼                                    ▼
┌─────────────────────────────────────────────────────────────────┐
│                           RUN                                    │
│  id, schedule_id, prompt_snapshot, status, queued_at,           │
│  started_at, completed_at, exit_code, output_summary,           │
│  log_cursor, retry_count, error_message                         │
└─────────────────────────────────────────────────────────────────┘
                              │ 1:N
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                        RUN_LOG                                   │
│  id, run_id, timestamp, level, message, sequence_num            │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                    HEALTH_SNAPSHOT                               │
│  id, timestamp, agent_status, version, uptime_seconds,          │
│  restart_count, queue_depth, error_rate_1m, avg_latency_ms,     │
│  cpu_percent, memory_percent, disk_percent, last_event_at       │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                       INCIDENT                                   │
│  id, run_id, type, severity, message, acknowledged,             │
│  resolved, created_at, resolved_at, resolution_notes            │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                      ALERT_RULE                                  │
│  id, name, condition_type, threshold, window_seconds,           │
│  notify_method, enabled                                         │
└─────────────────────────────────────────────────────────────────┘
```

---

## A.4 State Machines

### Prompt Lifecycle
```
                    ┌──────────┐
                    │  DRAFT   │
                    └────┬─────┘
                         │ save
                         ▼
                    ┌──────────┐
              ┌─────│  READY   │─────┐
              │     └────┬─────┘     │
              │ archive  │ schedule  │ edit
              ▼          ▼           │
        ┌──────────┐ ┌──────────┐    │
        │ ARCHIVED │ │SCHEDULED │────┘
        └──────────┘ └────┬─────┘
                          │ all runs complete
                          ▼
                    ┌──────────┐
                    │ COMPLETE │
                    └──────────┘
```

### Run Lifecycle
```
┌──────────────┐
│   PENDING    │ (created, waiting for dispatch)
└──────┬───────┘
       │ dispatch (connection available)
       ▼
┌──────────────┐
│   QUEUED     │ (sent to Jeff, waiting in agent queue)
└──────┬───────┘
       │ agent picks up
       ▼
┌──────────────┐
│   RUNNING    │ (actively executing, streaming logs)
└──────┬───────┘
       │
       ├─────────────────┬─────────────────┐
       │ success         │ failure         │ timeout
       ▼                 ▼                 ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│  COMPLETED   │  │    FAILED    │  │   TIMED_OUT  │
└──────────────┘  └──────┬───────┘  └──────┬───────┘
                         │                  │
                         │ retry available  │
                         ▼                  │
                  ┌──────────────┐          │
                  │   RETRYING   │──────────┘
                  └──────────────┘
                         │ max retries exceeded
                         ▼
                  ┌──────────────┐
                  │   ABORTED    │
                  └──────────────┘
```

### Connection Lifecycle
```
                    ┌──────────────┐
       ┌───────────▶│  CONNECTED   │◀───────────┐
       │            └──────┬───────┘            │
       │                   │                    │
       │                   │ heartbeat miss /   │
       │                   │ stream error       │
       │                   ▼                    │
       │            ┌──────────────┐            │
       │            │   DEGRADED   │            │
       │            └──────┬───────┘            │
       │                   │                    │
       │ success           │ full disconnect    │ success
       │                   ▼                    │
       │            ┌──────────────┐            │
       └────────────│ RECONNECTING │────────────┘
                    └──────┬───────┘
                           │ max attempts / 
                           │ user cancel
                           ▼
                    ┌──────────────┐
                    │   OFFLINE    │
                    │  (+ reason)  │
                    └──────────────┘
                           │ manual reconnect
                           └───────────▶ RECONNECTING
```

---

# B. Technical Architecture

## B.1 Architecture Diagram (Text)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        LOCAL MACHINE (Mission Control)                   │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                         TAURI SHELL                              │    │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │    │
│  │  │   System    │  │   Native    │  │     Secure Storage      │  │    │
│  │  │    Tray     │  │   Notifs    │  │  (keychain/credential)  │  │    │
│  │  └─────────────┘  └─────────────┘  └─────────────────────────┘  │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                    │                                     │
│                                    │ IPC                                 │
│                                    ▼                                     │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                       RUST BACKEND                               │    │
│  │  ┌───────────────┐  ┌───────────────┐  ┌───────────────────┐   │    │
│  │  │  Connection   │  │   Scheduler   │  │    SQLite DB      │   │    │
│  │  │   Manager     │  │   (tokio)     │  │   (sqlx/rusqlite) │   │    │
│  │  │  - SSE client │  │  - cron eval  │  │   - all entities  │   │    │
│  │  │  - reconnect  │  │  - job queue  │  │   - offline queue │   │    │
│  │  │  - cursor     │  │  - dispatch   │  │   - log cache     │   │    │
│  │  └───────────────┘  └───────────────┘  └───────────────────────┘   │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                    │                                     │
│                                    │ IPC                                 │
│                                    ▼                                     │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                      WEBVIEW (React + Vite)                      │    │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │    │
│  │  │    Zustand  │  │    React    │  │      TailwindCSS        │  │    │
│  │  │    Store    │  │   Router    │  │   + Framer Motion       │  │    │
│  │  └─────────────┘  └─────────────┘  └─────────────────────────┘  │    │
│  │  ┌─────────────────────────────────────────────────────────────┐│    │
│  │  │  Components: Dashboard, Missions, Console, Health, etc.     ││    │
│  │  └─────────────────────────────────────────────────────────────┘│    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ HTTPS + SSE (TLS)
                                    │ Auth: Signed requests (HMAC-SHA256)
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                          VPS (OpenClaw/Jeff)                             │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                    OpenClaw Gateway                              │    │
│  │  ┌───────────────┐  ┌───────────────┐  ┌───────────────────┐   │    │
│  │  │  /mc/health   │  │  /mc/runs     │  │  /mc/stream       │   │    │
│  │  │  /mc/submit   │  │  /mc/cancel   │  │  (SSE endpoint)   │   │    │
│  │  └───────────────┘  └───────────────┘  └───────────────────────┘   │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                    │                                     │
│                                    ▼                                     │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                        Jeff Agent                                │    │
│  │            (processes prompts, returns results)                  │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## B.2 API Contract (UI ↔ Jeff)

### Authentication
All requests include:
```
X-MC-Timestamp: <unix_ms>
X-MC-Signature: HMAC-SHA256(secret, method + path + timestamp + body)
```

### Endpoints

#### Health & Status
```
GET /mc/health
Response: {
  status: "healthy" | "degraded" | "unhealthy",
  version: "2026.2.3",
  uptime_seconds: 86400,
  restart_count: 0,
  queue_depth: 3,
  error_rate_1m: 0.02,
  avg_latency_ms: 450,
  last_event_at: "2026-02-07T14:00:00Z",
  resources: {
    cpu_percent: 15,
    memory_percent: 42,
    disk_percent: 28
  }
}

GET /mc/health/live   → 200 OK | 503
GET /mc/health/ready  → 200 OK | 503
```

#### Run Management
```
POST /mc/runs
Body: {
  prompt: "string",
  variables: { key: value },
  timeout_seconds: 300,
  priority: "normal" | "high",
  idempotency_key: "uuid"
}
Response: {
  run_id: "run_abc123",
  status: "queued",
  queued_at: "2026-02-07T14:00:00Z"
}

GET /mc/runs/:id
Response: {
  run_id: "run_abc123",
  status: "running",
  started_at: "...",
  log_cursor: "cursor_xyz",
  output_preview: "..."
}

POST /mc/runs/:id/cancel
Response: { success: true }

GET /mc/runs?status=running&limit=50&cursor=...
Response: {
  runs: [...],
  next_cursor: "..."
}
```

#### Streaming
```
GET /mc/stream?cursor=<last_cursor>
Headers: Accept: text/event-stream

SSE Events:
  event: log
  data: {"run_id":"...","level":"info","message":"...","seq":123}

  event: status
  data: {"run_id":"...","status":"completed","output":"..."}

  event: health
  data: {"queue_depth":2,"error_rate":0.01}

  event: heartbeat
  data: {"ts":"..."}
  id: cursor_456  ← for Last-Event-ID on reconnect
```

---

## B.3 Streaming Recommendation: SSE

**Recommendation: Server-Sent Events (SSE)**

| Factor | SSE | WebSocket |
|--------|-----|-----------|
| Simplicity | ✅ Built on HTTP, trivial to implement | ❌ Separate protocol, more complex |
| Reconnect | ✅ Native Last-Event-ID support | ❌ Must implement manually |
| Firewalls | ✅ Just HTTPS | ⚠️ Some corporate proxies block |
| Bidirectional | ❌ Server→Client only | ✅ Full duplex |
| Our need | Server→Client (logs, status) | Not needed for this use case |

**Verdict:** SSE is simpler, has built-in cursor/reconnect semantics, and we only need server→client push. Commands go via REST POST.

---

## B.4 Security Approach

### Recommended: HMAC-SHA256 Signed Requests

```
┌─────────────────────────────────────────────────────────────────┐
│  On first setup:                                                 │
│  1. User generates shared secret in OpenClaw config             │
│  2. User enters secret in Mission Control settings              │
│  3. Secret stored in OS keychain (never on disk in plain text)  │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  On each request:                                                │
│  1. Client builds: payload = method + path + timestamp + body   │
│  2. Client computes: sig = HMAC-SHA256(secret, payload)         │
│  3. Client sends: X-MC-Timestamp + X-MC-Signature headers       │
│  4. Server validates signature and timestamp (±60s window)      │
└─────────────────────────────────────────────────────────────────┘
```

**Why not mTLS?**
- Requires certificate management (renewal, distribution)
- More complex setup for end users
- Overkill for single-user local app

**Why not WireGuard?**
- Great for always-on VPN, but adds system-level dependency
- User may already have VPN needs that conflict
- Consider as optional "hardened" mode

**Pragmatic default:** HMAC + HTTPS provides strong auth with minimal user friction. Add WireGuard docs for paranoid users.

---

# C. Sprint Plan

## Phase Overview
```
MVP (6 weeks)     → Core value: schedule prompts, see runs, basic health
V1  (4 weeks)     → Mission decomposition, dependency graph, incidents
V2  (4 weeks)     → Polish, alerts, advanced scheduling, hardening
```

---

## Sprint 1: Foundation (Weeks 1-2)
**Goal:** Skeleton app with connection to VPS

### Deliverables
- [ ] Tauri project scaffolding (Rust + React + Vite)
- [ ] SQLite schema for core entities
- [ ] Connection manager with states (Connected/Reconnecting/Offline)
- [ ] Settings screen with VPS URL + secret input
- [ ] Basic dashboard shell (empty state)
- [ ] Health endpoint integration (single fetch)

### Acceptance Criteria
- App launches and shows connection status
- User can configure VPS URL and secret
- App displays "Connected" when VPS reachable
- App displays "Offline" with reason when not

---

## Sprint 2: Prompt & Run Basics (Weeks 3-4)
**Goal:** Create and execute single prompts

### Deliverables
- [ ] Prompt editor (create/edit/delete)
- [ ] Run submission to Jeff
- [ ] Run list view with status
- [ ] Run detail view with output
- [ ] Local persistence of prompts/runs

### Acceptance Criteria
- User can create a prompt and submit it
- Run appears in list with status updates
- Completed run shows output
- Data persists across app restart

---

## Sprint 3: Streaming & Resilience (Weeks 5-6)
**Goal:** Live console + robust reconnection

### Deliverables
- [ ] SSE client with cursor tracking
- [ ] Jeff Console screen (live log stream)
- [ ] Auto-reconnect with backoff + jitter
- [ ] Resume from cursor on reconnect
- [ ] Offline queue for scheduling
- [ ] "Pending dispatch" indicator

### Acceptance Criteria
- Console shows live logs during run
- Disconnect WiFi → reconnect → logs resume without gaps
- Schedule created while offline dispatches after reconnect
- Reconnect attempts shown in UI with countdown

**🎯 MVP COMPLETE**

---

## Sprint 4: Mission Decomposition (Weeks 7-8)
**Goal:** Mission → Sprint → Task → Prompt hierarchy

### Deliverables
- [ ] Mission creation wizard
- [ ] AI-assisted decomposition (call Jeff to break down mission)
- [ ] Sprint/Task tree view
- [ ] Prompt generation from tasks
- [ ] Mission progress tracking

### Acceptance Criteria
- User enters mission prompt, gets suggested sprints/tasks
- User can adjust hierarchy before confirming
- Progress bar reflects completed prompts
- Mission status aggregates from children

---

## Sprint 5: Advanced Scheduling (Weeks 9-10)
**Goal:** Cron, dependencies, concurrency

### Deliverables
- [ ] Cron expression builder UI
- [ ] Dependency graph editor (prompt A → prompt B)
- [ ] Time window configuration
- [ ] Concurrency groups + limits
- [ ] Schedule validation (circular deps, conflicts)

### Acceptance Criteria
- User can set "every Monday 9am"
- Prompt B waits for Prompt A to complete
- Prompts in same group respect concurrency limit
- Circular dependency shows error

**🎯 V1 COMPLETE**

---

## Sprint 6: Health & Incidents (Weeks 11-12)
**Goal:** Observability + failure management

### Deliverables
- [ ] Health Centre with metrics charts
- [ ] Resource gauges (CPU/mem/disk)
- [ ] Alert rule configuration
- [ ] Incident list + triage UI
- [ ] Retry/Skip/Escalate actions

### Acceptance Criteria
- Health Centre shows 24h of metrics
- Alert fires when error rate > threshold
- Failed run creates incident
- User can retry from incident view

---

## Sprint 7: Polish & Hardening (Weeks 13-14)
**Goal:** Production-ready UX + edge cases

### Deliverables
- [ ] Dark theme refinement (Figma → code)
- [ ] Subtle animations (Framer Motion)
- [ ] Keyboard shortcuts
- [ ] Comprehensive error messages
- [ ] Offline mode improvements
- [ ] Stress testing (100+ runs, long streams)

### Acceptance Criteria
- UI matches design spec
- All flows smooth with animations
- No crashes under load
- Offline mode fully functional

**🎯 V2 COMPLETE**

---

## Test Strategy

### Unit Tests (Rust + React)
- Connection state machine transitions
- Cron expression parsing
- Signature generation
- Dependency graph validation

### Integration Tests
- SSE reconnection (mock server drops connection)
- Offline queue dispatch ordering
- Health polling intervals
- Database migrations

### E2E Tests (Playwright + Tauri)
- Full flow: create mission → schedule → run → view output
- Reconnection scenario: disconnect during run
- Alert trigger: inject failure, verify incident

### Manual QA Checklist
- [ ] Fresh install on macOS/Windows/Linux
- [ ] VPS unreachable at startup
- [ ] Long-running prompt (10+ minutes)
- [ ] Rapid-fire scheduling (20 prompts)
- [ ] Theme consistency across all screens

---

# D. Cost-Optimisation Guidance

## D.1 Build Cost Reduction Tactics

| Tactic | Savings | Implementation |
|--------|---------|----------------|
| **Schema-first API** | 20% | Define OpenAPI spec first; generate types for Rust + TS |
| **Reuse shadcn/ui** | 15% | Don't build custom components; use battle-tested primitives |
| **SQLite not Postgres** | 10% | Local DB, no server to manage, instant setup |
| **SSE not WebSocket** | 5% | Simpler protocol, native browser support |
| **Tauri not Electron** | 10% | Smaller bundle, less RAM, faster startup |
| **Minimal dependencies** | 5% | Audit each crate/package; prefer stdlib |

**Total estimated savings: ~30% effort reduction**

## D.2 Cut List (If Budget Tight)

### Cut First (Low Impact)
1. **Resource gauges** (CPU/mem/disk) — nice-to-have, not critical
2. **Keyboard shortcuts** — can add later
3. **Advanced animations** — subtle fade is enough
4. **Multiple themes** — dark only for MVP

### Cut Second (Medium Impact)
5. **Alert rules UI** — hardcode sensible defaults
6. **Concurrency groups** — default to global limit
7. **Time windows** — prompts run anytime

### Never Cut (Core Value)
- Connection resilience + reconnect
- Prompt scheduling (one-off minimum)
- Live log streaming
- Run history
- Basic health indicator

---

# E. Delivery Options

## Option A: "Lean MVP" — Minimal Viable Product

### Scope
| Included | Excluded |
|----------|----------|
| Single prompt execution | Mission decomposition |
| One-off scheduling | Cron/recurring |
| Live console | Dependency graph |
| Basic health check | Alerts, incidents |
| Reconnection | Resource monitoring |
| SQLite persistence | — |

### Architecture
- **Tauri** (Rust + React)
- **SQLite** local DB
- **SSE** streaming
- **HMAC** auth

### Effort: **25 person-days**

| Phase | Days | Scope |
|-------|------|-------|
| MVP | 25 | Everything above |

### Running Costs
- **Local app:** $0
- **VPS:** Existing OpenClaw VPS (no additional cost)
- **Total:** $0/month incremental

### Risks & Mitigations
| Risk | Mitigation |
|------|------------|
| No recurring schedules | Add cron in V1 |
| No mission hierarchy | Power users can manually create prompts |
| Limited observability | Basic health is enough for single user |

---

## Option B: "Balanced Build" — Recommended

### Scope
| Included | Excluded |
|----------|----------|
| All of Option A | Advanced alerts |
| Mission → Sprint → Task decomposition | Custom themes |
| Cron scheduling | Resource monitoring |
| Dependency graph | — |
| Incident management | — |
| Health Centre (basic) | — |

### Architecture
- **Tauri** (Rust + React)
- **SQLite** local DB
- **SSE** streaming
- **HMAC** auth
- **AI decomposition** via Jeff calls

### Effort: **50 person-days**

| Phase | Days | Scope |
|-------|------|-------|
| MVP | 25 | Option A scope |
| V1 | 25 | Decomposition, cron, deps, incidents |

### Running Costs
- **Local app:** $0
- **VPS:** Existing OpenClaw VPS
- **Total:** $0/month incremental

### Risks & Mitigations
| Risk | Mitigation |
|------|------------|
| AI decomposition quality | User can manually adjust |
| Dependency cycles | Validation prevents save |
| Scope creep | Strict sprint boundaries |

---

## Option C: "Full Vision" — Complete Product

### Scope
| Included | Excluded |
|----------|----------|
| All of Option B | — |
| Alert rules + notifications | — |
| Resource monitoring (CPU/mem) | — |
| Advanced scheduling (time windows, concurrency) | — |
| Polish + animations | — |
| Multi-theme support | — |
| Comprehensive test suite | — |

### Architecture
- **Tauri** (Rust + React)
- **SQLite** local DB
- **SSE** streaming
- **HMAC** auth (WireGuard optional)
- **System tray** with notifications
- **Framer Motion** animations

### Effort: **70 person-days**

| Phase | Days | Scope |
|-------|------|-------|
| MVP | 25 | Foundation + basic runs |
| V1 | 25 | Decomposition, cron, deps |
| V2 | 20 | Alerts, polish, hardening |

### Running Costs
- **Local app:** $0
- **VPS:** Existing OpenClaw VPS
- **Optional:** Push notifications via ntfy.sh ($0) or Pushover ($5 one-time)
- **Total:** $0-5 incremental

### Risks & Mitigations
| Risk | Mitigation |
|------|------------|
| Longer timeline | Phased delivery maintains momentum |
| Feature bloat | "Cut list" ready to trim |
| Maintenance burden | Minimal deps, good tests |

---

## Recommendation

**Go with Option B (Balanced Build).**

Rationale:
- Delivers core value (scheduling, streaming, resilience) in MVP
- Adds mission hierarchy which differentiates from raw OpenClaw
- Avoids over-engineering while still being "futuristic"
- 50 days is achievable in ~10 weeks with focused effort
- V2 polish can be added based on real usage feedback

---

# Appendix: UI Mood Board (Text Description)

```
┌─────────────────────────────────────────────────────────────────┐
│  DESIGN PRINCIPLES                                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Colors:                                                         │
│    Background: #0a0a0f (near-black with blue tint)              │
│    Surface: #12121a (cards, panels)                              │
│    Border: #1e1e2e (subtle separators)                           │
│    Primary: #6366f1 (indigo — actions, focus)                    │
│    Success: #22c55e (green — healthy, complete)                  │
│    Warning: #f59e0b (amber — degraded, attention)                │
│    Error: #ef4444 (red — failed, offline)                        │
│    Text: #e2e8f0 (primary), #94a3b8 (secondary)                  │
│                                                                  │
│  Typography:                                                     │
│    Font: Inter (headings), JetBrains Mono (code/logs)           │
│    Sizes: 14px base, 12px secondary, 16px headings              │
│                                                                  │
│  Motion:                                                         │
│    Transitions: 150ms ease-out (fast, snappy)                   │
│    Status changes: subtle pulse animation                        │
│    Loading: skeleton shimmer, not spinners                       │
│    Modals: fade + scale from 95% to 100%                        │
│                                                                  │
│  Layout:                                                         │
│    Sidebar: 64px collapsed, 240px expanded                       │
│    Content max-width: 1200px, centered                           │
│    Spacing: 8px grid, 16px/24px gutters                          │
│    Border radius: 8px (cards), 6px (buttons), 4px (inputs)      │
│                                                                  │
│  Iconography:                                                    │
│    Lucide icons, 20px default, 16px inline                       │
│    Status indicators: 8px dots with glow effect                  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

# Assumptions

1. VPS runs OpenClaw with standard gateway API
2. VPS is reachable via HTTPS on a domain or IP:port
3. Single user (no multi-tenancy in local app)
4. Jeff can process prompts and return structured output
5. Jeff can expose `/mc/*` endpoints (may need gateway config)
6. User has macOS, Windows, or Linux laptop
7. User comfortable with initial secret setup
8. ~1000 runs/day is upper bound (local SQLite can handle)

---

*End of Specification*
