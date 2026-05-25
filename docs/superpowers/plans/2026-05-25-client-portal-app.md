# Client Portal App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the v1 pet-owner client portal app for PawPilotPro — mobile-first responsive web app, invite-only auth, request-then-staff-confirms booking across 4 services, premium brand-grade UI.

**Architecture:** New `PawPilotPro/portal/` Vite app, `PawPilotPro/shared/` peer for typed contracts, new `/portal/*` route group inside the existing Supabase Edge Function. Realtime via Supabase Broadcast on per-customer channels. Email via Resend. Deployed as a second Netlify site.

**Tech Stack:** React 18 + TS, Vite 6, Tailwind v4, shadcn (thin subset), React Router v7, Zustand, TanStack Query, Zod, Supabase Auth + KV + Storage + Realtime, Hono on Deno (Edge Function), Resend, Vitest + MSW, Playwright.

**Spec:** [docs/superpowers/specs/2026-05-25-client-portal-app-design.md](../specs/2026-05-25-client-portal-app-design.md)

**Working tree:** This plan executes inside the `/Users/jasonpemberton/Downloads/PawPilotPronew-portal` worktree on branch `feat/client-portal-app`.

---

## Phase index

| # | Phase | Ships |
|---|-------|-------|
| 1 | Foundation | Empty deployable portal app, `/portal/health` returns 200 |
| 2 | Auth | Owner can accept invite, set password, log in, sign out |
| 3 | Home + Pets (read-only) | Bottom tab nav, Home, Pets list, Pet detail |
| 4 | Vax upload + Review queue | Owner uploads vax, staff approves, vax record promoted |
| 5 | Booking + Pending Requests | Owner submits booking request, staff approves, status flips realtime |
| 6 | Notifications + email | In-app feed, transactional emails for all events |
| 7 | Visual polish pass | Custom tokens, motion, micro-interactions, dark mode, photography |
| 8 | Test hardening | Playwright portal project, critical E2E, visual regression baseline |

**Checkpoint discipline:** stop after each phase, verify the end-state, commit a phase tag (`portal-v1-phase-N-complete`), then proceed.

---

# PHASE 1 — Foundation

**Goal:** A scaffolded, deployable portal app that imports shared types and pings the new `/portal/health` backend route. No UI yet beyond a hello screen. Establishes every piece of plumbing the later phases depend on.

**Files this phase creates:**
- `PawPilotPro/shared/package.json` — minimal package for type imports
- `PawPilotPro/shared/tsconfig.json`
- `PawPilotPro/shared/types/index.ts`
- `PawPilotPro/shared/types/booking.ts`
- `PawPilotPro/shared/types/pet.ts`
- `PawPilotPro/shared/types/customer.ts`
- `PawPilotPro/shared/types/vaccination.ts`
- `PawPilotPro/shared/types/notification.ts`
- `PawPilotPro/shared/schemas/booking.ts`
- `PawPilotPro/shared/api/client.ts`
- `PawPilotPro/portal/package.json`
- `PawPilotPro/portal/tsconfig.json`
- `PawPilotPro/portal/vite.config.ts`
- `PawPilotPro/portal/tailwind.config.js`
- `PawPilotPro/portal/postcss.config.mjs`
- `PawPilotPro/portal/index.html`
- `PawPilotPro/portal/netlify.toml`
- `PawPilotPro/portal/src/main.tsx`
- `PawPilotPro/portal/src/App.tsx`
- `PawPilotPro/portal/src/styles/tokens.css`
- `PawPilotPro/portal/src/styles/index.css`
- `PawPilotPro/portal/src/lib/api.ts`
- `PawPilotPro/portal/src/lib/supabase.ts`
- `PawPilotPro/portal/tests/setup.ts`
- `PawPilotPro/portal/tests/lib/api.test.ts`
- `PawPilotPro/project/supabase/functions/server/portal_routes.tsx`
- `PawPilotPro/project/supabase/functions/server/portal_auth.ts`

**Files this phase modifies:**
- `PawPilotPro/project/supabase/functions/server/index.tsx` — register portal routes
- `PawPilotPro/project/tsconfig.json` — add `@shared/*` path alias

---

### Task 1.1: Create `shared/` package skeleton

**Files:**
- Create: `PawPilotPro/shared/package.json`
- Create: `PawPilotPro/shared/tsconfig.json`
- Create: `PawPilotPro/shared/types/index.ts`

- [ ] **Step 1: Write the failing test** (smoke test that `shared` resolves)

Create `PawPilotPro/shared/tests/smoke.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import * as shared from "../types";

describe("shared package", () => {
  it("exports a namespace", () => {
    expect(typeof shared).toBe("object");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd PawPilotPro/shared && npx vitest run tests/smoke.test.ts
```

Expected: FAIL with `Cannot find module '../types'`.

- [ ] **Step 3: Create `shared/package.json`**

```json
{
  "name": "@pawpilot/shared",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "./types/index.ts",
  "exports": {
    "./types": "./types/index.ts",
    "./types/*": "./types/*.ts",
    "./schemas/*": "./schemas/*.ts",
    "./api/*": "./api/*.ts"
  },
  "devDependencies": {
    "typescript": "^5.4.0",
    "vitest": "^1.6.0"
  }
}
```

- [ ] **Step 4: Create `shared/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "isolatedModules": true,
    "noUncheckedIndexedAccess": true,
    "declaration": true,
    "outDir": "./dist"
  },
  "include": ["types", "schemas", "api"]
}
```

- [ ] **Step 5: Create `shared/types/index.ts`**

```ts
export * from "./booking";
export * from "./pet";
export * from "./customer";
export * from "./vaccination";
export * from "./notification";
```

(Files referenced will be created in Task 1.2; export will resolve once they exist.)

- [ ] **Step 6: Install deps and rerun the test (expected: still fails until 1.2)**

```bash
cd PawPilotPro/shared && npm install
npx vitest run tests/smoke.test.ts
```

Expected: FAIL with module not found for `./booking`. Move on; Task 1.2 fixes it.

- [ ] **Step 7: Commit**

```bash
git add PawPilotPro/shared/package.json PawPilotPro/shared/tsconfig.json PawPilotPro/shared/types/index.ts PawPilotPro/shared/tests/smoke.test.ts
git commit -m "feat(shared): scaffold shared package"
```

---

### Task 1.2: Define shared types

**Files:**
- Create: `PawPilotPro/shared/types/booking.ts`
- Create: `PawPilotPro/shared/types/pet.ts`
- Create: `PawPilotPro/shared/types/customer.ts`
- Create: `PawPilotPro/shared/types/vaccination.ts`
- Create: `PawPilotPro/shared/types/notification.ts`
- Create: `PawPilotPro/shared/tests/types.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expectTypeOf } from "vitest";
import type { Booking, BookingStatus, Service, Pet, Customer, Vaccination, NotificationEvent } from "../types";

describe("shared types", () => {
  it("Booking has status union", () => {
    expectTypeOf<BookingStatus>().toEqualTypeOf<"pending" | "confirmed" | "declined" | "cancelled">();
  });
  it("Service has 4 members", () => {
    expectTypeOf<Service>().toEqualTypeOf<"daycare" | "grooming" | "overnights" | "transport">();
  });
  it("Pet has required fields", () => {
    const p: Pet = { id: "p1", customerId: "c1", name: "Bella", breed: "Lab", dob: "2020-01-01", weightKg: 22, photoUrl: null, notes: null, tenantId: "t1" };
    expectTypeOf<typeof p>().toMatchTypeOf<Pet>();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd PawPilotPro/shared && npx vitest run tests/types.test.ts
```

Expected: FAIL — types not defined.

- [ ] **Step 3: Create `shared/types/booking.ts`**

```ts
export type Service = "daycare" | "grooming" | "overnights" | "transport";
export type BookingStatus = "pending" | "confirmed" | "declined" | "cancelled";

export interface Booking {
  id: string;
  tenantId: string;
  customerId: string;
  petIds: string[];
  service: Service;
  startAt: string; // ISO
  endAt: string;   // ISO
  status: BookingStatus;
  notes: string | null;
  ownerSubmitted: boolean;
  requestId: string | null; // idempotency key
  declineReason?: string | null;
  statusChangedAt?: string | null;
  staffId?: string | null;
  createdAt: string;
  updatedAt: string;
}
```

- [ ] **Step 4: Create `shared/types/pet.ts`**

```ts
export interface Pet {
  id: string;
  tenantId: string;
  customerId: string;
  name: string;
  breed: string;
  dob: string; // ISO date
  weightKg: number;
  photoUrl: string | null;
  notes: string | null;
}
```

- [ ] **Step 5: Create `shared/types/customer.ts`**

```ts
export interface Customer {
  id: string;
  tenantId: string;
  householdName: string;
  primaryContactName: string;
  primaryEmail: string;
  primaryPhone: string;
  petIds: string[];
}
```

- [ ] **Step 6: Create `shared/types/vaccination.ts`**

```ts
export type VaxStatus = "current" | "expiring" | "expired";
export type VaxType = "rabies" | "dhpp" | "bordetella" | "leptospirosis" | "influenza" | "other";

export interface Vaccination {
  id: string;
  tenantId: string;
  petId: string;
  vaxType: VaxType;
  certificateUrl: string;
  issuedAt: string; // ISO
  expiresAt: string; // ISO
  boosterDueAt: string | null;
  approvedBy: string | null;
  approvedAt: string | null;
}
```

- [ ] **Step 7: Create `shared/types/notification.ts`**

```ts
export type NotificationType =
  | "booking.received"
  | "booking.confirmed"
  | "booking.declined"
  | "booking.cancelled"
  | "vax.approved"
  | "vax.rejected"
  | "vax.expiring";

export interface NotificationEvent<T = unknown> {
  id: string;
  tenantId: string;
  customerId: string;
  type: NotificationType;
  payload: T;
  link: string | null;
  readAt: string | null;
  createdAt: string;
}
```

- [ ] **Step 8: Run test to verify pass**

```bash
cd PawPilotPro/shared && npx vitest run tests/types.test.ts
```

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add PawPilotPro/shared/types/ PawPilotPro/shared/tests/types.test.ts
git commit -m "feat(shared): define Booking, Pet, Customer, Vaccination, Notification types"
```

---

### Task 1.3: Shared booking schema (Zod)

**Files:**
- Create: `PawPilotPro/shared/schemas/booking.ts`
- Create: `PawPilotPro/shared/tests/booking-schema.test.ts`

- [ ] **Step 1: Add Zod dependency**

```bash
cd PawPilotPro/shared && npm install zod@^3.23.0
```

- [ ] **Step 2: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { newBookingRequestSchema } from "../schemas/booking";

describe("newBookingRequestSchema", () => {
  it("accepts a valid daycare request", () => {
    const r = newBookingRequestSchema.safeParse({
      service: "daycare",
      petIds: ["p1"],
      startAt: "2026-06-01T08:00:00.000Z",
      endAt: "2026-06-01T17:00:00.000Z",
      notes: null,
      requestId: "11111111-1111-1111-1111-111111111111",
    });
    expect(r.success).toBe(true);
  });
  it("rejects empty petIds", () => {
    const r = newBookingRequestSchema.safeParse({
      service: "daycare",
      petIds: [],
      startAt: "2026-06-01T08:00:00.000Z",
      endAt: "2026-06-01T17:00:00.000Z",
      notes: null,
      requestId: "11111111-1111-1111-1111-111111111111",
    });
    expect(r.success).toBe(false);
  });
  it("rejects endAt before startAt", () => {
    const r = newBookingRequestSchema.safeParse({
      service: "grooming",
      petIds: ["p1"],
      startAt: "2026-06-01T17:00:00.000Z",
      endAt: "2026-06-01T08:00:00.000Z",
      notes: null,
      requestId: "11111111-1111-1111-1111-111111111111",
    });
    expect(r.success).toBe(false);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

```bash
cd PawPilotPro/shared && npx vitest run tests/booking-schema.test.ts
```

Expected: FAIL — schema not defined.

- [ ] **Step 4: Implement schema**

`PawPilotPro/shared/schemas/booking.ts`:

```ts
import { z } from "zod";

export const serviceEnum = z.enum(["daycare", "grooming", "overnights", "transport"]);

export const newBookingRequestSchema = z.object({
  service: serviceEnum,
  petIds: z.array(z.string().min(1)).min(1).max(10),
  startAt: z.string().datetime(),
  endAt: z.string().datetime(),
  notes: z.string().max(500).nullable(),
  requestId: z.string().uuid(),
}).refine(d => new Date(d.endAt) > new Date(d.startAt), {
  message: "endAt must be after startAt",
  path: ["endAt"],
});

export type NewBookingRequest = z.infer<typeof newBookingRequestSchema>;
```

- [ ] **Step 5: Run test to verify pass**

```bash
cd PawPilotPro/shared && npx vitest run tests/booking-schema.test.ts
```

Expected: PASS (3/3).

- [ ] **Step 6: Commit**

```bash
git add PawPilotPro/shared/package.json PawPilotPro/shared/schemas/ PawPilotPro/shared/tests/booking-schema.test.ts
git commit -m "feat(shared): zod schema for new booking request"
```

---

### Task 1.4: Shared API client wrapper

**Files:**
- Create: `PawPilotPro/shared/api/client.ts`
- Create: `PawPilotPro/shared/tests/api-client.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, vi } from "vitest";
import { createPortalApi } from "../api/client";

describe("createPortalApi", () => {
  it("builds the URL with projectId + path", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    const api = createPortalApi({
      projectId: "abc123",
      anonKey: "anon",
      getAccessToken: async () => "jwt-token",
      fetch: fetchMock,
    });
    await api.get("/portal/health");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://abc123.supabase.co/functions/v1/make-server-fc003b23/portal/health");
    expect((init as RequestInit).headers).toMatchObject({
      "Authorization": "Bearer anon",
      "X-User-Token": "Bearer jwt-token",
    });
  });
  it("throws ApiError on non-2xx with message body", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: "nope" }), { status: 403 }));
    const api = createPortalApi({ projectId: "p", anonKey: "a", getAccessToken: async () => "t", fetch: fetchMock });
    await expect(api.get("/portal/home")).rejects.toThrow(/nope/);
  });
});
```

- [ ] **Step 2: Run to verify fail**

```bash
cd PawPilotPro/shared && npx vitest run tests/api-client.test.ts
```

Expected: FAIL — `createPortalApi` not defined.

- [ ] **Step 3: Implement client**

`PawPilotPro/shared/api/client.ts`:

```ts
export interface PortalApiOptions {
  projectId: string;
  anonKey: string;
  getAccessToken: () => Promise<string | null>;
  fetch?: typeof fetch;
}

export class ApiError extends Error {
  constructor(public status: number, message: string, public body: unknown) {
    super(message);
    this.name = "ApiError";
  }
}

const FUNCTION_NAME = "make-server-fc003b23";

export function createPortalApi(opts: PortalApiOptions) {
  const f = opts.fetch ?? fetch;
  const base = `https://${opts.projectId}.supabase.co/functions/v1/${FUNCTION_NAME}`;

  async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
    const token = await opts.getAccessToken();
    const res = await f(`${base}${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${opts.anonKey}`,
        ...(token ? { "X-User-Token": `Bearer ${token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    const parsed = text ? safeJson(text) : null;
    if (!res.ok) {
      const msg = (parsed && typeof parsed === "object" && "error" in parsed && typeof (parsed as any).error === "string")
        ? (parsed as any).error
        : `HTTP ${res.status}`;
      throw new ApiError(res.status, msg, parsed);
    }
    return parsed as T;
  }

  function safeJson(text: string): unknown {
    try { return JSON.parse(text); } catch { return text; }
  }

  return {
    get: <T>(path: string) => call<T>("GET", path),
    post: <T>(path: string, body?: unknown) => call<T>("POST", path, body),
    patch: <T>(path: string, body?: unknown) => call<T>("PATCH", path, body),
    del:  <T>(path: string) => call<T>("DELETE", path),
  };
}

export type PortalApi = ReturnType<typeof createPortalApi>;
```

- [ ] **Step 4: Run to verify pass**

```bash
cd PawPilotPro/shared && npx vitest run tests/api-client.test.ts
```

Expected: PASS (2/2).

- [ ] **Step 5: Commit**

```bash
git add PawPilotPro/shared/api/ PawPilotPro/shared/tests/api-client.test.ts
git commit -m "feat(shared): typed portal API client wrapper with error handling"
```

---

### Task 1.5: Wire `@shared/*` alias into the staff app's tsconfig

**Files:**
- Modify: `PawPilotPro/project/tsconfig.json`

- [ ] **Step 1: Read existing tsconfig**

```bash
cat PawPilotPro/project/tsconfig.json
```

- [ ] **Step 2: Add path alias under `compilerOptions.paths`**

If `paths` already exists, add `"@shared/*": ["../shared/*"]`. If not, add the whole `paths` block:

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"],
      "@shared/*": ["../shared/*"]
    }
  }
}
```

- [ ] **Step 3: Verify staff app still typechecks**

```bash
cd PawPilotPro/project && npx tsc --noEmit
```

Expected: same result as before the change (no new errors introduced).

- [ ] **Step 4: Commit**

```bash
git add PawPilotPro/project/tsconfig.json
git commit -m "feat(staff): add @shared/* path alias"
```

---

### Task 1.6: Scaffold the portal Vite app

**Files:**
- Create: `PawPilotPro/portal/package.json`
- Create: `PawPilotPro/portal/tsconfig.json`
- Create: `PawPilotPro/portal/tsconfig.node.json`
- Create: `PawPilotPro/portal/vite.config.ts`
- Create: `PawPilotPro/portal/index.html`
- Create: `PawPilotPro/portal/src/main.tsx`
- Create: `PawPilotPro/portal/src/App.tsx`

- [ ] **Step 1: Create `portal/package.json`**

```json
{
  "name": "@pawpilot/portal",
  "private": true,
  "version": "0.0.1",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc --noEmit && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "@pawpilot/shared": "file:../shared",
    "@supabase/supabase-js": "^2.89.0",
    "@tanstack/react-query": "^5.40.0",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-router-dom": "^7.12.0",
    "zod": "^3.23.0",
    "zustand": "^5.0.9"
  },
  "devDependencies": {
    "@tailwindcss/vite": "^4.0.0",
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.0",
    "jsdom": "^24.0.0",
    "msw": "^2.3.0",
    "tailwindcss": "^4.0.0",
    "typescript": "^5.4.0",
    "vite": "^6.4.1",
    "vitest": "^1.6.0"
  }
}
```

- [ ] **Step 2: Create `portal/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"],
      "@shared/*": ["../shared/*"]
    }
  },
  "include": ["src", "tests"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

- [ ] **Step 3: Create `portal/tsconfig.node.json`**

```json
{
  "compilerOptions": {
    "composite": true,
    "skipLibCheck": true,
    "module": "ESNext",
    "moduleResolution": "bundler",
    "allowSyntheticDefaultImports": true
  },
  "include": ["vite.config.ts"]
}
```

- [ ] **Step 4: Create `portal/vite.config.ts`**

```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { host: "0.0.0.0", port: 5175, strictPort: true },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@shared": path.resolve(__dirname, "../shared"),
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: "./tests/setup.ts",
  },
});
```

- [ ] **Step 5: Create `portal/index.html`**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
    <meta name="theme-color" content="#0a0a0a" media="(prefers-color-scheme: dark)" />
    <meta name="theme-color" content="#ffffff" media="(prefers-color-scheme: light)" />
    <title>PawPilotPro</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 6: Create `portal/src/main.tsx`**

```tsx
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles/index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
```

- [ ] **Step 7: Create `portal/src/App.tsx`**

```tsx
export default function App() {
  return (
    <main className="min-h-screen grid place-items-center">
      <p className="text-sm text-neutral-500">Portal coming online…</p>
    </main>
  );
}
```

- [ ] **Step 8: Install and run dev**

```bash
cd PawPilotPro/portal && npm install
npm run dev
```

Expected: Vite dev server on `http://localhost:5175` rendering "Portal coming online…". Ctrl-C to stop after verifying.

- [ ] **Step 9: Commit**

```bash
git add PawPilotPro/portal/package.json PawPilotPro/portal/tsconfig.json PawPilotPro/portal/tsconfig.node.json PawPilotPro/portal/vite.config.ts PawPilotPro/portal/index.html PawPilotPro/portal/src/main.tsx PawPilotPro/portal/src/App.tsx PawPilotPro/portal/package-lock.json
git commit -m "feat(portal): scaffold vite + react + tailwind"
```

---

### Task 1.7: Base design tokens + Tailwind v4 config

**Files:**
- Create: `PawPilotPro/portal/src/styles/tokens.css`
- Create: `PawPilotPro/portal/src/styles/index.css`
- Create: `PawPilotPro/portal/postcss.config.mjs`

- [ ] **Step 1: Create `portal/src/styles/tokens.css`**

```css
/* Base portal design tokens. Phase 7 (polish) tunes these further. */
@layer base {
  :root {
    --bg: 250 250 250;
    --surface: 255 255 255;
    --text: 17 17 17;
    --text-muted: 100 100 100;
    --border: 229 229 229;
    --accent: 26 115 232;
    --accent-fg: 255 255 255;
    --danger: 220 38 38;
    --success: 21 128 61;
    --warning: 161 98 7;

    --radius-sm: 8px;
    --radius-md: 12px;
    --radius-lg: 16px;
    --radius-xl: 24px;

    --shadow-sm: 0 1px 2px rgb(0 0 0 / 0.04);
    --shadow-md: 0 4px 12px rgb(0 0 0 / 0.06);

    --duration-fast: 120ms;
    --duration-base: 200ms;
    --ease-out: cubic-bezier(0.2, 0.8, 0.2, 1);

    --safe-top: env(safe-area-inset-top);
    --safe-bottom: env(safe-area-inset-bottom);
  }

  @media (prefers-color-scheme: dark) {
    :root {
      --bg: 10 10 10;
      --surface: 20 20 20;
      --text: 245 245 245;
      --text-muted: 160 160 160;
      --border: 38 38 38;
      --accent: 96 165 250;
      --accent-fg: 10 10 10;
    }
  }
}
```

- [ ] **Step 2: Create `portal/src/styles/index.css`**

```css
@import "tailwindcss";
@import "./tokens.css";

@theme {
  --color-bg: rgb(var(--bg));
  --color-surface: rgb(var(--surface));
  --color-text: rgb(var(--text));
  --color-text-muted: rgb(var(--text-muted));
  --color-border: rgb(var(--border));
  --color-accent: rgb(var(--accent));
  --color-accent-fg: rgb(var(--accent-fg));
  --color-danger: rgb(var(--danger));
  --color-success: rgb(var(--success));
  --color-warning: rgb(var(--warning));
}

html, body { background: rgb(var(--bg)); color: rgb(var(--text)); }
body { font-family: -apple-system, BlinkMacSystemFont, "Inter", system-ui, sans-serif; -webkit-font-smoothing: antialiased; }
* { box-sizing: border-box; }

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; }
}
```

- [ ] **Step 3: Create `portal/postcss.config.mjs`**

```js
export default { plugins: { "@tailwindcss/postcss": {} } };
```

(If `@tailwindcss/postcss` isn't installed, add it: `npm install -D @tailwindcss/postcss`.)

- [ ] **Step 4: Verify by rebuilding dev**

```bash
cd PawPilotPro/portal && npm run dev
```

Expected: page renders with dark/light mode honoring system preference, no console errors.

- [ ] **Step 5: Commit**

```bash
git add PawPilotPro/portal/src/styles/ PawPilotPro/portal/postcss.config.mjs PawPilotPro/portal/package.json PawPilotPro/portal/package-lock.json
git commit -m "feat(portal): base design tokens + tailwind v4 theme"
```

---

### Task 1.8: Supabase client + API wrapper bound to env

**Files:**
- Create: `PawPilotPro/portal/.env.example`
- Create: `PawPilotPro/portal/src/lib/supabase.ts`
- Create: `PawPilotPro/portal/src/lib/api.ts`
- Create: `PawPilotPro/portal/tests/setup.ts`
- Create: `PawPilotPro/portal/tests/lib/api.test.ts`

- [ ] **Step 1: Create `portal/.env.example`**

```
VITE_SUPABASE_PROJECT_ID=your-project-id
VITE_SUPABASE_ANON_KEY=your-anon-key
```

- [ ] **Step 2: Write the failing test**

`PawPilotPro/portal/tests/lib/api.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { getPortalApi } from "@/lib/api";

describe("getPortalApi", () => {
  beforeEach(() => {
    import.meta.env.VITE_SUPABASE_PROJECT_ID = "proj";
    import.meta.env.VITE_SUPABASE_ANON_KEY = "anon";
  });
  it("returns a singleton wired to env", async () => {
    const a = getPortalApi();
    const b = getPortalApi();
    expect(a).toBe(b);
  });
});
```

`PawPilotPro/portal/tests/setup.ts`:

```ts
import "@testing-library/jest-dom/vitest";
```

(Add `@testing-library/jest-dom` to devDependencies: `npm install -D @testing-library/jest-dom @testing-library/react`.)

- [ ] **Step 3: Run to verify fail**

```bash
cd PawPilotPro/portal && npm run test
```

Expected: FAIL — module not defined.

- [ ] **Step 4: Implement supabase client**

`PawPilotPro/portal/src/lib/supabase.ts`:

```ts
import { createClient, SupabaseClient } from "@supabase/supabase-js";

let _client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (_client) return _client;
  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (!projectId || !anonKey) throw new Error("Missing VITE_SUPABASE_PROJECT_ID / VITE_SUPABASE_ANON_KEY");
  _client = createClient(`https://${projectId}.supabase.co`, anonKey, {
    auth: { persistSession: true, autoRefreshToken: true, storage: window.localStorage },
  });
  return _client;
}
```

- [ ] **Step 5: Implement api singleton**

`PawPilotPro/portal/src/lib/api.ts`:

```ts
import { createPortalApi, PortalApi } from "@shared/api/client";
import { getSupabase } from "./supabase";

let _api: PortalApi | null = null;

export function getPortalApi(): PortalApi {
  if (_api) return _api;
  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID!;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY!;
  _api = createPortalApi({
    projectId,
    anonKey,
    getAccessToken: async () => {
      const { data } = await getSupabase().auth.getSession();
      return data.session?.access_token ?? null;
    },
  });
  return _api;
}
```

- [ ] **Step 6: Run test to verify pass**

```bash
cd PawPilotPro/portal && npm run test
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add PawPilotPro/portal/.env.example PawPilotPro/portal/src/lib/ PawPilotPro/portal/tests/ PawPilotPro/portal/package.json PawPilotPro/portal/package-lock.json
git commit -m "feat(portal): supabase client + portal api singleton"
```

---

### Task 1.9: Backend `portal_auth` middleware

**Files:**
- Create: `PawPilotPro/project/supabase/functions/server/portal_auth.ts`

- [ ] **Step 1: Inspect existing auth pattern**

```bash
grep -n "requireAuth" PawPilotPro/project/supabase/functions/server/settings_rbac.ts | head
```

Note signature and how it sets `c.set('user', ...)`. The portal middleware mirrors it but enforces `user_metadata.portal_user === true`.

- [ ] **Step 2: Implement `portal_auth.ts`**

```ts
import { createClient } from "npm:@supabase/supabase-js";
import type { Context, MiddlewareHandler } from "npm:hono";

export interface PortalUserCtx {
  authUserId: string;
  email: string;
  tenantId: string;
  customerId: string;
}

declare module "npm:hono" {
  interface ContextVariableMap {
    portalUser: PortalUserCtx;
  }
}

export const requirePortalUser: MiddlewareHandler = async (c: Context, next) => {
  const userTokenHeader = c.req.header("X-User-Token");
  if (!userTokenHeader?.startsWith("Bearer ")) return c.json({ error: "Missing user token" }, 401);
  const token = userTokenHeader.slice("Bearer ".length);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(supabaseUrl, serviceKey);

  const { data: userResp, error } = await admin.auth.getUser(token);
  if (error || !userResp.user) return c.json({ error: "Invalid session" }, 401);
  const u = userResp.user;

  if (u.user_metadata?.portal_user !== true) {
    return c.json({ error: "Not a portal account" }, 403);
  }

  const tenantId = u.user_metadata?.tenantId as string | undefined;
  const customerId = u.user_metadata?.customerId as string | undefined;
  if (!tenantId || !customerId) return c.json({ error: "Portal account not linked" }, 403);

  c.set("portalUser", {
    authUserId: u.id,
    email: u.email!,
    tenantId,
    customerId,
  });
  await next();
};
```

- [ ] **Step 3: Commit (no tests run yet — backend deploy validates later)**

```bash
git add PawPilotPro/project/supabase/functions/server/portal_auth.ts
git commit -m "feat(server): requirePortalUser middleware"
```

---

### Task 1.10: Backend `/portal/health` route

**Files:**
- Create: `PawPilotPro/project/supabase/functions/server/portal_routes.tsx`
- Modify: `PawPilotPro/project/supabase/functions/server/index.tsx`

- [ ] **Step 1: Implement `portal_routes.tsx`**

```tsx
import { Hono } from "npm:hono";
import { requirePortalUser } from "./portal_auth.ts";

const portal = new Hono();

// Public health check — no auth.
portal.get("/health", (c) => c.json({ ok: true, scope: "portal", ts: Date.now() }));

// Authed echo — proves the middleware chain works end-to-end.
portal.get("/me", requirePortalUser, (c) => {
  const u = c.get("portalUser");
  return c.json({ authUserId: u.authUserId, customerId: u.customerId, tenantId: u.tenantId });
});

export default portal;
```

- [ ] **Step 2: Register in `index.tsx`**

Open `PawPilotPro/project/supabase/functions/server/index.tsx`. After the existing route imports, add:

```ts
import portalRoutes from "./portal_routes.tsx";
```

Find the existing route-mounting block (e.g. `app.route("/", appRoutes);`) and add:

```ts
app.route("/portal", portalRoutes);
```

- [ ] **Step 3: Deploy edge function locally and probe `/portal/health`**

```bash
cd PawPilotPro/project/supabase && npx supabase functions serve make-server-fc003b23 --no-verify-jwt
```

In another shell:

```bash
curl -s -H "Authorization: Bearer $(grep VITE_SUPABASE_ANON_KEY PawPilotPro/project/.env | cut -d= -f2)" \
  http://localhost:54321/functions/v1/make-server-fc003b23/portal/health
```

Expected: `{"ok":true,"scope":"portal","ts":...}`. Stop the server with Ctrl-C.

- [ ] **Step 4: Commit**

```bash
git add PawPilotPro/project/supabase/functions/server/portal_routes.tsx PawPilotPro/project/supabase/functions/server/index.tsx
git commit -m "feat(server): /portal/health + /portal/me endpoints"
```

---

### Task 1.11: Portal app calls `/portal/health` on load

**Files:**
- Modify: `PawPilotPro/portal/src/App.tsx`
- Create: `PawPilotPro/portal/tests/App.test.tsx`

- [ ] **Step 1: Write failing test**

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import App from "@/App";

vi.mock("@/lib/api", () => ({
  getPortalApi: () => ({
    get: vi.fn().mockResolvedValue({ ok: true, scope: "portal", ts: 123 }),
  }),
}));

describe("App", () => {
  it("renders health status from /portal/health", async () => {
    render(<App />);
    await waitFor(() => expect(screen.getByText(/Portal online/i)).toBeInTheDocument());
  });
});
```

- [ ] **Step 2: Run to verify fail**

```bash
cd PawPilotPro/portal && npm run test
```

Expected: FAIL — text not present, current App says "Portal coming online…".

- [ ] **Step 3: Update `App.tsx`**

```tsx
import { useEffect, useState } from "react";
import { getPortalApi } from "@/lib/api";

export default function App() {
  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading");

  useEffect(() => {
    getPortalApi().get<{ ok: boolean }>("/portal/health")
      .then(r => setStatus(r.ok ? "ok" : "error"))
      .catch(() => setStatus("error"));
  }, []);

  return (
    <main className="min-h-screen grid place-items-center px-6">
      <div className="text-center space-y-2">
        <p className="text-xs uppercase tracking-widest text-neutral-500">PawPilotPro</p>
        <h1 className="text-2xl font-semibold">
          {status === "loading" && "Connecting…"}
          {status === "ok" && "Portal online"}
          {status === "error" && "Backend unreachable"}
        </h1>
      </div>
    </main>
  );
}
```

- [ ] **Step 4: Run test to verify pass**

```bash
cd PawPilotPro/portal && npm run test
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add PawPilotPro/portal/src/App.tsx PawPilotPro/portal/tests/App.test.tsx
git commit -m "feat(portal): hello-world calls /portal/health"
```

---

### Task 1.12: Netlify config for the portal site

**Files:**
- Create: `PawPilotPro/portal/netlify.toml`

- [ ] **Step 1: Create config**

```toml
[build]
  base = "PawPilotPro/portal"
  publish = "PawPilotPro/portal/dist"
  command = "npm install && npm run build"

[build.environment]
  NODE_VERSION = "20"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200

[[headers]]
  for = "/*"
  [headers.values]
    X-Frame-Options = "DENY"
    X-Content-Type-Options = "nosniff"
    Referrer-Policy = "strict-origin-when-cross-origin"
    Permissions-Policy = "camera=(), microphone=(), geolocation=()"

[[headers]]
  for = "/assets/*"
  [headers.values]
    Cache-Control = "public, max-age=31536000, immutable"
```

- [ ] **Step 2: Verify local build**

```bash
cd PawPilotPro/portal && npm run build
```

Expected: clean build, `dist/` populated.

- [ ] **Step 3: Commit + tag the phase**

```bash
git add PawPilotPro/portal/netlify.toml
git commit -m "feat(portal): netlify config for second site"
git tag portal-v1-phase-1-complete
```

---

**Phase 1 done.** Stop here, verify:

- [ ] `cd PawPilotPro/portal && npm run dev` shows "Portal online"
- [ ] `cd PawPilotPro/shared && npx vitest run` all green
- [ ] `cd PawPilotPro/portal && npm run test` all green
- [ ] `cd PawPilotPro/portal && npm run build` clean
- [ ] `git tag --list | grep portal` shows `portal-v1-phase-1-complete`

Confirm before moving to Phase 2.

---

# PHASE 2 — Auth

**Goal:** Staff click "Send portal invite" on a customer record → owner gets an email → opens link → sets password → lands authed in the empty portal. Owner can log in / log out on return visits.

**Files this phase creates:**
- `PawPilotPro/project/supabase/functions/server/lib/email.ts` — Resend wrapper
- `PawPilotPro/project/supabase/functions/server/lib/email_templates/invite.ts`
- `PawPilotPro/project/supabase/functions/server/portal_invites.ts` — staff endpoints
- `PawPilotPro/project/supabase/functions/server/portal_auth_routes.ts` — accept-invite + me
- `PawPilotPro/project/src/app/modules/customers/PortalActivityTab.tsx`
- `PawPilotPro/project/src/app/modules/customers/SendPortalInviteButton.tsx`
- `PawPilotPro/portal/src/context/AuthContext.tsx`
- `PawPilotPro/portal/src/components/RequirePortalAuth.tsx`
- `PawPilotPro/portal/src/screens/LoginScreen.tsx`
- `PawPilotPro/portal/src/screens/AcceptInviteScreen.tsx`
- `PawPilotPro/portal/src/router.tsx`
- `PawPilotPro/portal/tests/screens/LoginScreen.test.tsx`
- `PawPilotPro/portal/tests/screens/AcceptInviteScreen.test.tsx`

**Files this phase modifies:**
- `PawPilotPro/portal/src/App.tsx` — wire router
- `PawPilotPro/project/supabase/functions/server/index.tsx` — register new portal routes
- `PawPilotPro/project/src/app/modules/customers/CustomerDetail.tsx` (or equivalent) — add button + tab

---

### Task 2.1: Resend email wrapper

**Files:**
- Create: `PawPilotPro/project/supabase/functions/server/lib/email.ts`
- Create: `PawPilotPro/project/supabase/functions/server/lib/email_templates/invite.ts`

- [ ] **Step 1: Add `RESEND_API_KEY` to Supabase secrets**

```bash
cd PawPilotPro/project && npx supabase secrets set RESEND_API_KEY=re_xxx
```

(Use the real key from the Resend dashboard. Document in `DEPLOYMENT_GUIDE.md` later — out of scope for this task.)

- [ ] **Step 2: Implement `email.ts`**

```ts
export interface EmailMessage {
  to: string;
  from?: string;
  subject: string;
  html: string;
  text?: string;
}

export interface EmailSender {
  send(msg: EmailMessage): Promise<{ id: string }>;
}

class ResendSender implements EmailSender {
  constructor(private apiKey: string, private defaultFrom: string) {}
  async send(msg: EmailMessage) {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: msg.from ?? this.defaultFrom,
        to: msg.to,
        subject: msg.subject,
        html: msg.html,
        text: msg.text,
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Resend ${res.status}: ${body}`);
    }
    return res.json();
  }
}

export function getEmailSender(): EmailSender {
  const key = Deno.env.get("RESEND_API_KEY");
  const from = Deno.env.get("PORTAL_EMAIL_FROM") ?? "PawPilotPro <hello@pawpilotpro.app>";
  if (!key) throw new Error("RESEND_API_KEY not configured");
  return new ResendSender(key, from);
}
```

- [ ] **Step 3: Implement invite template**

```ts
export function inviteEmail(args: {
  ownerName: string;
  tenantName: string;
  acceptUrl: string;
  expiresInHours: number;
}) {
  const subject = `${args.tenantName} — set up your portal account`;
  const html = `
    <div style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;max-width:480px;margin:0 auto;padding:24px;">
      <p style="font-size:14px;color:#888;letter-spacing:0.08em;text-transform:uppercase;margin:0 0 8px;">${args.tenantName}</p>
      <h1 style="font-size:24px;color:#111;margin:0 0 16px;">Hi ${args.ownerName}, your portal's ready.</h1>
      <p style="font-size:15px;line-height:1.5;color:#444;">
        We've set up a self-service portal for your pet's bookings, vaccinations, and account. Click below to set your password — the link expires in ${args.expiresInHours} hours.
      </p>
      <p style="margin:24px 0;">
        <a href="${args.acceptUrl}" style="background:#1a73e8;color:#fff;text-decoration:none;padding:14px 24px;border-radius:12px;font-weight:600;display:inline-block;">Set up my account</a>
      </p>
      <p style="font-size:12px;color:#888;">If the button doesn't work, paste this link into your browser:<br/>${args.acceptUrl}</p>
    </div>
  `;
  const text = `${args.tenantName}\n\nHi ${args.ownerName}, your portal's ready. Set your password (link expires in ${args.expiresInHours}h):\n\n${args.acceptUrl}`;
  return { subject, html, text };
}
```

- [ ] **Step 4: Commit**

```bash
git add PawPilotPro/project/supabase/functions/server/lib/
git commit -m "feat(server): resend email wrapper + invite template"
```

---

### Task 2.2: Backend — send invite endpoint (staff-callable)

**Files:**
- Create: `PawPilotPro/project/supabase/functions/server/portal_invites.ts`
- Modify: `PawPilotPro/project/supabase/functions/server/index.tsx`

- [ ] **Step 1: Implement invites route**

```ts
import { Hono } from "npm:hono";
import { z } from "npm:zod";
import * as kv from "./kv_store.tsx";
import { requireAuth, requirePermission } from "./settings_rbac.ts";
import { getEmailSender } from "./lib/email.ts";
import { inviteEmail } from "./lib/email_templates/invite.ts";

const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

const invites = new Hono();

invites.post(
  "/customers/:customerId/portal-invite",
  requireAuth,
  requirePermission("customers", "update"),
  async (c) => {
    const { customerId } = c.req.param();
    const user = c.get("user");
    const tenantId = user.tenantId;

    const customerKey = `customers:${tenantId}:${customerId}`;
    const customer = await kv.get(customerKey);
    if (!customer) return c.json({ error: "Customer not found" }, 404);

    // Reject if already linked
    const existingLink = await kv.get(`portal_users:${tenantId}:${customerId}`);
    if (existingLink) return c.json({ error: "Customer already has portal access" }, 409);

    const token = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
    const expiresAt = new Date(Date.now() + TWENTY_FOUR_HOURS_MS).toISOString();
    await kv.set(`portal_invites:${tenantId}:${token}`, {
      customerId,
      tenantId,
      createdBy: user.id,
      createdAt: new Date().toISOString(),
      expiresAt,
      consumedAt: null,
    });

    const portalBase = Deno.env.get("PORTAL_BASE_URL") ?? "https://portal.pawpilotpro.app";
    const acceptUrl = `${portalBase}/accept-invite?token=${token}`;

    const tenant = await kv.get(`tenants:${tenantId}`);
    const tenantName = (tenant as any)?.name ?? "PawPilotPro";

    const { subject, html, text } = inviteEmail({
      ownerName: (customer as any).primaryContactName,
      tenantName,
      acceptUrl,
      expiresInHours: 24,
    });
    await getEmailSender().send({ to: (customer as any).primaryEmail, subject, html, text });

    return c.json({ ok: true, expiresAt });
  },
);

invites.get(
  "/customers/:customerId/portal-activity",
  requireAuth,
  requirePermission("customers", "view"),
  async (c) => {
    const { customerId } = c.req.param();
    const user = c.get("user");
    const link = await kv.get(`portal_users:${user.tenantId}:${customerId}`);
    const allInvites = await kv.getAllByPrefix(`portal_invites:${user.tenantId}:`);
    const pending = (allInvites as any[]).filter(i => i.customerId === customerId && !i.consumedAt && new Date(i.expiresAt) > new Date());
    return c.json({ link, pendingInvites: pending });
  },
);

invites.post(
  "/customers/:customerId/portal-revoke",
  requireAuth,
  requirePermission("customers", "update"),
  async (c) => {
    const { customerId } = c.req.param();
    const user = c.get("user");
    const link = (await kv.get(`portal_users:${user.tenantId}:${customerId}`)) as any;
    if (!link) return c.json({ error: "No portal link" }, 404);
    // Disable in Supabase Auth
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const { createClient } = await import("npm:@supabase/supabase-js");
    const admin = createClient(supabaseUrl, serviceKey);
    await admin.auth.admin.updateUserById(link.authUserId, { ban_duration: "876000h" });
    await kv.del(`portal_users:${user.tenantId}:${customerId}`);
    return c.json({ ok: true });
  },
);

export default invites;
```

- [ ] **Step 2: Mount in `index.tsx`**

```ts
import portalInvites from "./portal_invites.ts";
// ...
app.route("/portal-admin", portalInvites);
```

- [ ] **Step 3: Manual smoke test**

```bash
# Replace TOKEN with a real staff JWT from the staff app's localStorage
curl -X POST -H "Authorization: Bearer $ANON" -H "X-User-Token: Bearer $STAFF_JWT" \
  http://localhost:54321/functions/v1/make-server-fc003b23/portal-admin/customers/CUST_ID/portal-invite
```

Expected: `{"ok":true,"expiresAt":"..."}` and an invite email in your inbox.

- [ ] **Step 4: Commit**

```bash
git add PawPilotPro/project/supabase/functions/server/portal_invites.ts PawPilotPro/project/supabase/functions/server/index.tsx
git commit -m "feat(server): portal invite create / activity / revoke endpoints"
```

---

### Task 2.3: Backend — accept invite endpoint

**Files:**
- Create: `PawPilotPro/project/supabase/functions/server/portal_auth_routes.ts`
- Modify: `PawPilotPro/project/supabase/functions/server/index.tsx`

- [ ] **Step 1: Implement accept-invite**

```ts
import { Hono } from "npm:hono";
import { z } from "npm:zod";
import * as kv from "./kv_store.tsx";
import { createClient } from "npm:@supabase/supabase-js";

const authRoutes = new Hono();

const acceptSchema = z.object({
  token: z.string().min(40),
  password: z.string().min(10).max(128),
});

authRoutes.post("/accept-invite", async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = acceptSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: parsed.error.format() }, 400);
  const { token, password } = parsed.data;

  // Locate invite by scanning (token is unique, but we don't know the tenantId)
  const allInvites = await kv.getAllByPrefix(`portal_invites:`);
  const found = (allInvites as any[]).find(i => i.token === token || i.id === token);
  // Note: the key already contains the token, so we look up by exact key composition.
  // Better: track tenantId in the token payload itself. For now, scan.
  // Replace this scan with a lookup key once we add tenant prefix to the URL.
  if (!found) return c.json({ error: "Invalid or expired link" }, 410);
  if (found.consumedAt) return c.json({ error: "Link already used" }, 410);
  if (new Date(found.expiresAt).getTime() < Date.now()) return c.json({ error: "Link expired" }, 410);

  const { tenantId, customerId } = found;
  const customer = (await kv.get(`customers:${tenantId}:${customerId}`)) as any;
  if (!customer) return c.json({ error: "Customer record missing" }, 410);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(supabaseUrl, serviceKey);

  const { data: created, error } = await admin.auth.admin.createUser({
    email: customer.primaryEmail,
    password,
    email_confirm: true,
    user_metadata: { portal_user: true, tenantId, customerId },
  });
  if (error || !created.user) return c.json({ error: error?.message ?? "Account creation failed" }, 500);

  await kv.set(`portal_users:${tenantId}:${customerId}`, {
    authUserId: created.user.id,
    customerId,
    tenantId,
    notificationPrefs: { booking: true, vax: true, marketing: false },
    createdAt: new Date().toISOString(),
  });
  await kv.set(`portal_invites:${tenantId}:${token}`, { ...found, consumedAt: new Date().toISOString() });

  // Sign in to return the session (matches set-password-then-land-in-app UX)
  const { data: signIn, error: signInErr } = await admin.auth.signInWithPassword({
    email: customer.primaryEmail,
    password,
  });
  if (signInErr || !signIn.session) return c.json({ error: "Signed up but sign-in failed; please log in" }, 200);

  return c.json({
    ok: true,
    session: { accessToken: signIn.session.access_token, refreshToken: signIn.session.refresh_token },
  });
});

export default authRoutes;
```

- [ ] **Step 2: Mount in `index.tsx`**

```ts
import portalAuthRoutes from "./portal_auth_routes.ts";
// ...
app.route("/portal/auth", portalAuthRoutes);
```

- [ ] **Step 3: Commit**

```bash
git add PawPilotPro/project/supabase/functions/server/portal_auth_routes.ts PawPilotPro/project/supabase/functions/server/index.tsx
git commit -m "feat(server): /portal/auth/accept-invite endpoint"
```

---

### Task 2.4: Staff app — "Send portal invite" button + Portal Activity tab

**Files:**
- Create: `PawPilotPro/project/src/app/modules/customers/SendPortalInviteButton.tsx`
- Create: `PawPilotPro/project/src/app/modules/customers/PortalActivityTab.tsx`
- Modify: `PawPilotPro/project/src/app/modules/customers/CustomerDetail.tsx` (or actual file — locate first)

- [ ] **Step 1: Locate the customer detail file**

```bash
grep -rn "CustomerDetail\b" PawPilotPro/project/src/app/modules/customers/ | head -5
```

- [ ] **Step 2: Implement `SendPortalInviteButton.tsx`**

```tsx
import { useState } from "react";
import { toast } from "sonner";
import { callApi } from "@/utils/api"; // existing staff API helper — confirm exact import path

export function SendPortalInviteButton({ customerId, hasPortalAccess, onSent }: { customerId: string; hasPortalAccess: boolean; onSent: () => void; }) {
  const [busy, setBusy] = useState(false);
  if (hasPortalAccess) return <span className="text-xs text-neutral-500">Portal active</span>;
  return (
    <button
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          await callApi(`/portal-admin/customers/${customerId}/portal-invite`, { method: "POST" });
          toast.success("Invite sent");
          onSent();
        } catch (e: any) {
          toast.error(e?.message ?? "Failed to send invite");
        } finally {
          setBusy(false);
        }
      }}
      className="px-3 py-1.5 rounded-md bg-blue-600 text-white text-sm font-medium disabled:opacity-50"
    >
      {busy ? "Sending…" : "Send portal invite"}
    </button>
  );
}
```

- [ ] **Step 3: Implement `PortalActivityTab.tsx`**

```tsx
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { callApi } from "@/utils/api";

export function PortalActivityTab({ customerId }: { customerId: string }) {
  const [data, setData] = useState<{ link: any; pendingInvites: any[] } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = () => callApi(`/portal-admin/customers/${customerId}/portal-activity`).then(setData);
  useEffect(() => { load(); }, [customerId]);

  if (!data) return <div className="p-4 text-sm text-neutral-500">Loading…</div>;
  return (
    <div className="p-4 space-y-4 text-sm">
      <div>
        <h4 className="font-medium mb-1">Portal account</h4>
        {data.link ? (
          <div className="space-y-1">
            <p>Linked: <code className="text-xs">{data.link.authUserId}</code></p>
            <p>Created: {new Date(data.link.createdAt).toLocaleString()}</p>
            <button
              disabled={busy}
              onClick={async () => {
                if (!confirm("Revoke this customer's portal access?")) return;
                setBusy(true);
                try {
                  await callApi(`/portal-admin/customers/${customerId}/portal-revoke`, { method: "POST" });
                  toast.success("Access revoked");
                  load();
                } catch (e: any) { toast.error(e?.message ?? "Failed"); } finally { setBusy(false); }
              }}
              className="mt-2 px-3 py-1.5 rounded-md border border-red-300 text-red-700 text-sm">
              Revoke access
            </button>
          </div>
        ) : <p className="text-neutral-500">No portal account</p>}
      </div>

      <div>
        <h4 className="font-medium mb-1">Pending invites ({data.pendingInvites.length})</h4>
        {data.pendingInvites.map((i, idx) => (
          <div key={idx} className="border rounded-md p-2">
            <p className="text-xs">Expires {new Date(i.expiresAt).toLocaleString()}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Wire into `CustomerDetail.tsx`**

Add the button next to the email field and the tab to the existing tab strip. Adjust to existing structure — do NOT restructure unrelated code.

- [ ] **Step 5: Manual test**

Run staff dev, open a customer, click Send portal invite, verify toast + invite email lands.

- [ ] **Step 6: Commit**

```bash
git add PawPilotPro/project/src/app/modules/customers/SendPortalInviteButton.tsx PawPilotPro/project/src/app/modules/customers/PortalActivityTab.tsx PawPilotPro/project/src/app/modules/customers/CustomerDetail.tsx
git commit -m "feat(staff): send portal invite + portal activity tab"
```

---

### Task 2.5: Portal — AuthContext + Zustand session store

**Files:**
- Create: `PawPilotPro/portal/src/context/AuthContext.tsx`
- Create: `PawPilotPro/portal/tests/context/AuthContext.test.tsx`

- [ ] **Step 1: Failing test**

```tsx
import { render, screen, act } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { AuthProvider, useAuth } from "@/context/AuthContext";

vi.mock("@/lib/supabase", () => {
  const listeners: Function[] = [];
  return {
    getSupabase: () => ({
      auth: {
        getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
        onAuthStateChange: (cb: Function) => { listeners.push(cb); return { data: { subscription: { unsubscribe() {} } } }; },
        signOut: vi.fn().mockResolvedValue({ error: null }),
      },
    }),
  };
});

function Probe() {
  const { status } = useAuth();
  return <p>auth:{status}</p>;
}

describe("AuthContext", () => {
  it("starts in loading then transitions to anonymous when no session", async () => {
    render(<AuthProvider><Probe /></AuthProvider>);
    expect(screen.getByText("auth:loading")).toBeInTheDocument();
    await act(async () => { await Promise.resolve(); });
    expect(screen.getByText("auth:anonymous")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run to fail**

```bash
cd PawPilotPro/portal && npm run test
```

- [ ] **Step 3: Implement context**

```tsx
import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { getSupabase } from "@/lib/supabase";

type AuthStatus = "loading" | "anonymous" | "authed";
interface AuthShape {
  status: AuthStatus;
  session: Session | null;
  signOut: () => Promise<void>;
}
const AuthCtx = createContext<AuthShape | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [status, setStatus] = useState<AuthStatus>("loading");

  useEffect(() => {
    let mounted = true;
    getSupabase().auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      setStatus(data.session ? "authed" : "anonymous");
    });
    const { data } = getSupabase().auth.onAuthStateChange((_evt, sess) => {
      setSession(sess);
      setStatus(sess ? "authed" : "anonymous");
    });
    return () => { mounted = false; data.subscription.unsubscribe(); };
  }, []);

  return (
    <AuthCtx.Provider value={{ status, session, signOut: async () => { await getSupabase().auth.signOut(); } }}>
      {children}
    </AuthCtx.Provider>
  );
}

export function useAuth() {
  const v = useContext(AuthCtx);
  if (!v) throw new Error("useAuth outside AuthProvider");
  return v;
}
```

- [ ] **Step 4: Run to pass**

```bash
cd PawPilotPro/portal && npm run test
```

- [ ] **Step 5: Commit**

```bash
git add PawPilotPro/portal/src/context/ PawPilotPro/portal/tests/context/
git commit -m "feat(portal): AuthContext with session lifecycle"
```

---

### Task 2.6: Portal — Router + RequirePortalAuth wrapper

**Files:**
- Create: `PawPilotPro/portal/src/router.tsx`
- Create: `PawPilotPro/portal/src/components/RequirePortalAuth.tsx`
- Modify: `PawPilotPro/portal/src/App.tsx`

- [ ] **Step 1: Implement `RequirePortalAuth.tsx`**

```tsx
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { ReactNode } from "react";

export function RequirePortalAuth({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const loc = useLocation();
  if (status === "loading") return <FullPageSpinner />;
  if (status === "anonymous") return <Navigate to={`/login?next=${encodeURIComponent(loc.pathname)}`} replace />;
  return <>{children}</>;
}

function FullPageSpinner() {
  return (
    <div className="min-h-screen grid place-items-center">
      <div className="size-6 rounded-full border-2 border-neutral-300 border-t-neutral-700 animate-spin" />
    </div>
  );
}
```

- [ ] **Step 2: Implement `router.tsx`**

```tsx
import { createBrowserRouter } from "react-router-dom";
import { RequirePortalAuth } from "@/components/RequirePortalAuth";
import { LoginScreen } from "@/screens/LoginScreen";
import { AcceptInviteScreen } from "@/screens/AcceptInviteScreen";
import { HomeScreen } from "@/screens/HomeScreen"; // stub for now

export const router = createBrowserRouter([
  { path: "/login", element: <LoginScreen /> },
  { path: "/accept-invite", element: <AcceptInviteScreen /> },
  {
    path: "/",
    element: <RequirePortalAuth><HomeScreen /></RequirePortalAuth>,
  },
  { path: "*", element: <RequirePortalAuth><HomeScreen /></RequirePortalAuth> },
]);
```

- [ ] **Step 3: Create stub `HomeScreen.tsx`**

```tsx
// Replaced in Phase 3.
export function HomeScreen() {
  return <main className="p-6">Home (stub)</main>;
}
```

- [ ] **Step 4: Update `App.tsx`**

```tsx
import { RouterProvider } from "react-router-dom";
import { AuthProvider } from "@/context/AuthContext";
import { router } from "@/router";

export default function App() {
  return (
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  );
}
```

- [ ] **Step 5: Commit**

```bash
git add PawPilotPro/portal/src/components/ PawPilotPro/portal/src/router.tsx PawPilotPro/portal/src/screens/HomeScreen.tsx PawPilotPro/portal/src/App.tsx
git commit -m "feat(portal): router + RequirePortalAuth wrapper"
```

---

### Task 2.7: Portal — LoginScreen

**Files:**
- Create: `PawPilotPro/portal/src/screens/LoginScreen.tsx`
- Create: `PawPilotPro/portal/tests/screens/LoginScreen.test.tsx`

- [ ] **Step 1: Failing test**

```tsx
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { LoginScreen } from "@/screens/LoginScreen";

const signInMock = vi.fn().mockResolvedValue({ data: { session: { access_token: "t" } }, error: null });
vi.mock("@/lib/supabase", () => ({ getSupabase: () => ({ auth: { signInWithPassword: signInMock } }) }));

describe("LoginScreen", () => {
  it("submits credentials", async () => {
    render(<MemoryRouter><LoginScreen /></MemoryRouter>);
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: "sarah@example.com" } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: "password123" } });
    fireEvent.click(screen.getByRole("button", { name: /sign in/i }));
    await waitFor(() => expect(signInMock).toHaveBeenCalledWith({ email: "sarah@example.com", password: "password123" }));
  });
});
```

- [ ] **Step 2: Implement**

```tsx
import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { getSupabase } from "@/lib/supabase";

export function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const nav = useNavigate();
  const [params] = useSearchParams();
  const next = params.get("next") ?? "/";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null); setBusy(true);
    const { error } = await getSupabase().auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) { setErr(error.message); return; }
    nav(next, { replace: true });
  }

  return (
    <main className="min-h-screen grid place-items-center px-6">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4">
        <header className="text-center space-y-1">
          <p className="text-xs uppercase tracking-widest text-neutral-500">PawPilotPro</p>
          <h1 className="text-2xl font-semibold">Welcome back</h1>
        </header>
        <label className="block text-sm">
          <span className="block mb-1 text-neutral-700">Email</span>
          <input id="email" type="email" required value={email} onChange={e => setEmail(e.target.value)}
            className="w-full h-12 px-3 rounded-xl border border-neutral-200 bg-white" autoComplete="email" />
        </label>
        <label className="block text-sm">
          <span className="block mb-1 text-neutral-700">Password</span>
          <input id="password" type="password" required value={password} onChange={e => setPassword(e.target.value)}
            className="w-full h-12 px-3 rounded-xl border border-neutral-200 bg-white" autoComplete="current-password" />
        </label>
        {err && <p role="alert" className="text-sm text-red-600">{err}</p>}
        <button disabled={busy} type="submit"
          className="w-full h-12 rounded-xl bg-blue-600 text-white font-semibold disabled:opacity-50">
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </main>
  );
}
```

- [ ] **Step 3: Run tests**

```bash
cd PawPilotPro/portal && npm run test
```

- [ ] **Step 4: Commit**

```bash
git add PawPilotPro/portal/src/screens/LoginScreen.tsx PawPilotPro/portal/tests/screens/LoginScreen.test.tsx
git commit -m "feat(portal): login screen"
```

---

### Task 2.8: Portal — AcceptInviteScreen

**Files:**
- Create: `PawPilotPro/portal/src/screens/AcceptInviteScreen.tsx`
- Create: `PawPilotPro/portal/tests/screens/AcceptInviteScreen.test.tsx`

- [ ] **Step 1: Failing test**

```tsx
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { AcceptInviteScreen } from "@/screens/AcceptInviteScreen";

const postMock = vi.fn().mockResolvedValue({ ok: true, session: { accessToken: "a", refreshToken: "b" } });
vi.mock("@/lib/api", () => ({ getPortalApi: () => ({ post: postMock }) }));
const setSession = vi.fn();
vi.mock("@/lib/supabase", () => ({ getSupabase: () => ({ auth: { setSession } }) }));

describe("AcceptInviteScreen", () => {
  it("submits token + password", async () => {
    render(
      <MemoryRouter initialEntries={["/accept-invite?token=abcd1234567890abcd1234567890abcd1234567890"]}>
        <Routes><Route path="/accept-invite" element={<AcceptInviteScreen />} /></Routes>
      </MemoryRouter>
    );
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: "long-enough-pw" } });
    fireEvent.click(screen.getByRole("button", { name: /set up/i }));
    await waitFor(() => expect(postMock).toHaveBeenCalledWith("/portal/auth/accept-invite", {
      token: "abcd1234567890abcd1234567890abcd1234567890",
      password: "long-enough-pw",
    }));
    await waitFor(() => expect(setSession).toHaveBeenCalledWith({ access_token: "a", refresh_token: "b" }));
  });
});
```

- [ ] **Step 2: Implement**

```tsx
import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { getPortalApi } from "@/lib/api";
import { getSupabase } from "@/lib/supabase";

export function AcceptInviteScreen() {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const nav = useNavigate();

  if (!token) return (
    <main className="min-h-screen grid place-items-center px-6">
      <div className="text-center space-y-2">
        <h1 className="text-xl font-semibold">Invalid link</h1>
        <p className="text-neutral-500 text-sm">Ask the daycare to resend your invite.</p>
      </div>
    </main>
  );

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr(null);
    try {
      const r = await getPortalApi().post<{ session?: { accessToken: string; refreshToken: string } }>("/portal/auth/accept-invite", { token, password });
      if (r.session) {
        await getSupabase().auth.setSession({ access_token: r.session.accessToken, refresh_token: r.session.refreshToken });
        nav("/", { replace: true });
      } else {
        nav("/login", { replace: true });
      }
    } catch (e: any) {
      setErr(e?.message ?? "Couldn't set up account");
    } finally { setBusy(false); }
  }

  return (
    <main className="min-h-screen grid place-items-center px-6">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4">
        <header className="text-center space-y-1">
          <p className="text-xs uppercase tracking-widest text-neutral-500">PawPilotPro</p>
          <h1 className="text-2xl font-semibold">Set your password</h1>
          <p className="text-sm text-neutral-500">Choose a password at least 10 characters long.</p>
        </header>
        <label className="block text-sm">
          <span className="block mb-1 text-neutral-700">Password</span>
          <input id="password" type="password" minLength={10} required value={password} onChange={e => setPassword(e.target.value)}
            className="w-full h-12 px-3 rounded-xl border border-neutral-200 bg-white" autoComplete="new-password" />
        </label>
        {err && <p role="alert" className="text-sm text-red-600">{err}</p>}
        <button disabled={busy} type="submit"
          className="w-full h-12 rounded-xl bg-blue-600 text-white font-semibold disabled:opacity-50">
          {busy ? "Setting up…" : "Set up my account"}
        </button>
      </form>
    </main>
  );
}
```

- [ ] **Step 3: Run tests**

```bash
cd PawPilotPro/portal && npm run test
```

- [ ] **Step 4: Commit + phase tag**

```bash
git add PawPilotPro/portal/src/screens/AcceptInviteScreen.tsx PawPilotPro/portal/tests/screens/AcceptInviteScreen.test.tsx
git commit -m "feat(portal): accept invite screen"
git tag portal-v1-phase-2-complete
```

---

**Phase 2 done.** End-to-end manual test:

1. In staff app, send invite to a test customer
2. Open the email, click the link, set a password
3. You land at `/` and see the Home stub
4. Sign out (manually clear localStorage for now — sign-out UI lands in Phase 3)
5. Sign in via `/login` with the password you set

Confirm before Phase 3.

---

# PHASE 3 — Home + Pets (read-only)

**Goal:** Authed owner lands on Home and sees their greeting, upcoming bookings, alerts. Bottom tab bar navigates to Pets list and Pet detail (read-only with Request edit). Account tab has sign-out.

**Files this phase creates:**
- `PawPilotPro/portal/src/components/BottomTabBar.tsx`
- `PawPilotPro/portal/src/components/AppShell.tsx`
- `PawPilotPro/portal/src/components/StatusBadge.tsx`
- `PawPilotPro/portal/src/components/Skeleton.tsx`
- `PawPilotPro/portal/src/components/EmptyState.tsx`
- `PawPilotPro/portal/src/hooks/usePortalQuery.ts` — TanStack Query wrapper
- `PawPilotPro/portal/src/screens/HomeScreen.tsx` (replaces stub)
- `PawPilotPro/portal/src/screens/BookingsScreen.tsx` (stub for Phase 5)
- `PawPilotPro/portal/src/screens/PetsScreen.tsx`
- `PawPilotPro/portal/src/screens/PetDetailScreen.tsx`
- `PawPilotPro/portal/src/screens/AccountScreen.tsx`
- `PawPilotPro/portal/src/screens/components/RequestEditSheet.tsx`
- `PawPilotPro/portal/tests/screens/HomeScreen.test.tsx`
- `PawPilotPro/portal/tests/screens/PetsScreen.test.tsx`
- `PawPilotPro/project/supabase/functions/server/portal_home_routes.ts`
- `PawPilotPro/project/supabase/functions/server/portal_pets_routes.ts`

**Files this phase modifies:**
- `PawPilotPro/portal/src/router.tsx` — add tab routes
- `PawPilotPro/portal/src/App.tsx` — add QueryClientProvider
- `PawPilotPro/project/supabase/functions/server/index.tsx` — mount new routes

---

### Task 3.1: TanStack Query provider + query hook

**Files:**
- Create: `PawPilotPro/portal/src/hooks/usePortalQuery.ts`
- Modify: `PawPilotPro/portal/src/App.tsx`

- [ ] **Step 1: Implement hook**

```ts
import { useQuery, UseQueryOptions } from "@tanstack/react-query";
import { getPortalApi } from "@/lib/api";

export function usePortalQuery<T>(key: readonly unknown[], path: string, opts?: Omit<UseQueryOptions<T>, "queryKey" | "queryFn">) {
  return useQuery<T>({
    queryKey: key,
    queryFn: () => getPortalApi().get<T>(path),
    staleTime: 30_000,
    ...opts,
  });
}
```

- [ ] **Step 2: Wrap App with QueryClientProvider**

```tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "react-router-dom";
import { AuthProvider } from "@/context/AuthContext";
import { router } from "@/router";

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } } });

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </QueryClientProvider>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add PawPilotPro/portal/src/hooks/usePortalQuery.ts PawPilotPro/portal/src/App.tsx
git commit -m "feat(portal): tanstack query provider + portal query hook"
```

---

### Task 3.2: Shared UI primitives — Skeleton, EmptyState, StatusBadge

**Files:**
- Create: `PawPilotPro/portal/src/components/Skeleton.tsx`
- Create: `PawPilotPro/portal/src/components/EmptyState.tsx`
- Create: `PawPilotPro/portal/src/components/StatusBadge.tsx`

- [ ] **Step 1: `Skeleton.tsx`**

```tsx
export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`bg-neutral-200/70 dark:bg-neutral-800/70 rounded animate-pulse ${className}`} aria-hidden="true" />;
}
```

- [ ] **Step 2: `EmptyState.tsx`**

```tsx
import { ReactNode } from "react";
export function EmptyState({ icon, title, body, action }: { icon?: ReactNode; title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="px-6 py-12 text-center space-y-3">
      {icon && <div className="mx-auto text-3xl opacity-60">{icon}</div>}
      <h3 className="text-base font-semibold">{title}</h3>
      {body && <p className="text-sm text-neutral-500 max-w-xs mx-auto">{body}</p>}
      {action}
    </div>
  );
}
```

- [ ] **Step 3: `StatusBadge.tsx`**

```tsx
import type { BookingStatus } from "@shared/types/booking";

const STYLES: Record<BookingStatus, string> = {
  pending:   "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  confirmed: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  declined:  "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300",
  cancelled: "bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400",
};
const LABELS: Record<BookingStatus, string> = { pending: "Pending", confirmed: "Confirmed", declined: "Declined", cancelled: "Cancelled" };

export function StatusBadge({ status }: { status: BookingStatus }) {
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${STYLES[status]}`}>{LABELS[status]}</span>;
}
```

- [ ] **Step 4: Commit**

```bash
git add PawPilotPro/portal/src/components/
git commit -m "feat(portal): skeleton, empty state, status badge primitives"
```

---

### Task 3.3: AppShell + BottomTabBar

**Files:**
- Create: `PawPilotPro/portal/src/components/AppShell.tsx`
- Create: `PawPilotPro/portal/src/components/BottomTabBar.tsx`
- Create: `PawPilotPro/portal/tests/components/BottomTabBar.test.tsx`

- [ ] **Step 1: Failing test**

```tsx
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect } from "vitest";
import { BottomTabBar } from "@/components/BottomTabBar";

describe("BottomTabBar", () => {
  it("highlights the active tab", () => {
    render(<MemoryRouter initialEntries={["/pets"]}><BottomTabBar /></MemoryRouter>);
    const pets = screen.getByRole("link", { name: /pets/i });
    expect(pets).toHaveAttribute("aria-current", "page");
  });
});
```

- [ ] **Step 2: Implement `BottomTabBar.tsx`**

```tsx
import { NavLink } from "react-router-dom";
import { Home, Calendar, PawPrint, User } from "lucide-react";

const TABS = [
  { to: "/", label: "Home", Icon: Home, end: true },
  { to: "/bookings", label: "Bookings", Icon: Calendar, end: false },
  { to: "/pets", label: "Pets", Icon: PawPrint, end: false },
  { to: "/account", label: "Account", Icon: User, end: false },
] as const;

export function BottomTabBar() {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 bg-white/95 backdrop-blur border-t border-neutral-200 dark:bg-neutral-950/95 dark:border-neutral-800"
         style={{ paddingBottom: "var(--safe-bottom)" }}>
      <ul className="grid grid-cols-4 max-w-md mx-auto">
        {TABS.map(({ to, label, Icon, end }) => (
          <li key={to} className="flex">
            <NavLink to={to} end={end}
              className={({ isActive }) =>
                `flex-1 flex flex-col items-center justify-center gap-1 py-2 text-[11px] min-h-[56px] transition-colors ${
                  isActive ? "text-blue-600 dark:text-blue-400 font-semibold" : "text-neutral-500 dark:text-neutral-400"
                }`
              }
              aria-current={undefined /* set via isActive */}
            >
              {({ isActive }) => (
                <>
                  <Icon size={20} aria-hidden="true" />
                  <span>{label}</span>
                  {/* sneak aria-current onto the link via dataset for the test */}
                  {isActive && <span hidden data-active />}
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
```

> **Note:** `aria-current="page"` is automatically set by `NavLink` when active. Adjust the test if needed to match its actual rendering — check with `screen.debug()` if the test still fails.

- [ ] **Step 3: Add `lucide-react` to deps**

```bash
cd PawPilotPro/portal && npm install lucide-react
```

- [ ] **Step 4: Implement `AppShell.tsx`**

```tsx
import { Outlet } from "react-router-dom";
import { BottomTabBar } from "./BottomTabBar";

export function AppShell() {
  return (
    <div className="min-h-screen pb-24" style={{ paddingTop: "var(--safe-top)" }}>
      <Outlet />
      <BottomTabBar />
    </div>
  );
}
```

- [ ] **Step 5: Update `router.tsx` to wrap authed routes in AppShell**

```tsx
import { createBrowserRouter } from "react-router-dom";
import { RequirePortalAuth } from "@/components/RequirePortalAuth";
import { AppShell } from "@/components/AppShell";
import { LoginScreen } from "@/screens/LoginScreen";
import { AcceptInviteScreen } from "@/screens/AcceptInviteScreen";
import { HomeScreen } from "@/screens/HomeScreen";
import { BookingsScreen } from "@/screens/BookingsScreen";
import { PetsScreen } from "@/screens/PetsScreen";
import { PetDetailScreen } from "@/screens/PetDetailScreen";
import { AccountScreen } from "@/screens/AccountScreen";

export const router = createBrowserRouter([
  { path: "/login", element: <LoginScreen /> },
  { path: "/accept-invite", element: <AcceptInviteScreen /> },
  {
    element: <RequirePortalAuth><AppShell /></RequirePortalAuth>,
    children: [
      { path: "/", element: <HomeScreen /> },
      { path: "/bookings", element: <BookingsScreen /> },
      { path: "/pets", element: <PetsScreen /> },
      { path: "/pets/:id", element: <PetDetailScreen /> },
      { path: "/account", element: <AccountScreen /> },
    ],
  },
]);
```

- [ ] **Step 6: Run tests**

```bash
cd PawPilotPro/portal && npm run test
```

- [ ] **Step 7: Commit**

```bash
git add PawPilotPro/portal/src/components/AppShell.tsx PawPilotPro/portal/src/components/BottomTabBar.tsx PawPilotPro/portal/src/router.tsx PawPilotPro/portal/tests/components/ PawPilotPro/portal/package.json PawPilotPro/portal/package-lock.json
git commit -m "feat(portal): app shell with bottom tab bar"
```

---

### Task 3.4: Backend — `/portal/home` batched endpoint

**Files:**
- Create: `PawPilotPro/project/supabase/functions/server/portal_home_routes.ts`
- Modify: `PawPilotPro/project/supabase/functions/server/index.tsx`

- [ ] **Step 1: Implement**

```ts
import { Hono } from "npm:hono";
import * as kv from "./kv_store.tsx";
import { requirePortalUser } from "./portal_auth.ts";

const home = new Hono();

home.get("/home", requirePortalUser, async (c) => {
  const u = c.get("portalUser");
  const customer = await kv.get(`customers:${u.tenantId}:${u.customerId}`);
  const tenant = await kv.get(`tenants:${u.tenantId}`);

  // Upcoming bookings for this customer
  const allBookings = await kv.getAllByPrefix(`bookings:${u.tenantId}:`) as any[];
  const now = Date.now();
  const upcoming = allBookings
    .filter(b => b.customerId === u.customerId && new Date(b.startAt).getTime() >= now && b.status !== "cancelled")
    .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime())
    .slice(0, 3);

  // Vax expiring within 30 days for this customer's pets
  const pets = (await kv.getAllByPrefix(`pets:${u.tenantId}:`) as any[]).filter(p => p.customerId === u.customerId);
  const petIds = new Set(pets.map(p => p.id));
  const vax = (await kv.getAllByPrefix(`vaccinations:${u.tenantId}:`) as any[]).filter(v => petIds.has(v.petId));
  const expiringSoon = vax.filter(v => {
    const dt = new Date(v.expiresAt).getTime();
    return dt > now && dt - now < 30 * 24 * 60 * 60 * 1000;
  });

  return c.json({
    greeting: { firstName: (customer as any)?.primaryContactName?.split(" ")[0] ?? "there", tenantName: (tenant as any)?.name ?? "PawPilotPro" },
    upcoming,
    alerts: {
      vaxExpiring: expiringSoon.map(v => ({ petId: v.petId, vaxType: v.vaxType, expiresAt: v.expiresAt })),
      pendingRequests: upcoming.filter(b => b.status === "pending").length,
    },
  });
});

export default home;
```

- [ ] **Step 2: Mount under `/portal`**

In `index.tsx`, alongside existing `app.route("/portal", portalRoutes)`:

```ts
import portalHome from "./portal_home_routes.ts";
app.route("/portal", portalHome);
```

(Hono supports multiple `route` calls under the same prefix.)

- [ ] **Step 3: Commit**

```bash
git add PawPilotPro/project/supabase/functions/server/portal_home_routes.ts PawPilotPro/project/supabase/functions/server/index.tsx
git commit -m "feat(server): /portal/home batched endpoint"
```

---

### Task 3.5: Portal — HomeScreen

**Files:**
- Create: `PawPilotPro/portal/src/screens/HomeScreen.tsx` (replaces stub)
- Create: `PawPilotPro/portal/tests/screens/HomeScreen.test.tsx`

- [ ] **Step 1: Failing test**

```tsx
import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HomeScreen } from "@/screens/HomeScreen";

vi.mock("@/lib/api", () => ({
  getPortalApi: () => ({ get: vi.fn().mockResolvedValue({
    greeting: { firstName: "Sarah", tenantName: "Pawsome" },
    upcoming: [{ id: "b1", service: "daycare", startAt: "2026-06-01T08:00:00Z", endAt: "2026-06-01T17:00:00Z", status: "confirmed", petIds: ["p1"] }],
    alerts: { vaxExpiring: [], pendingRequests: 0 },
  }) }),
}));

const wrap = (ui: React.ReactNode) => (
  <MemoryRouter><QueryClientProvider client={new QueryClient()}>{ui}</QueryClientProvider></MemoryRouter>
);

describe("HomeScreen", () => {
  it("renders greeting and upcoming booking", async () => {
    render(wrap(<HomeScreen />));
    await waitFor(() => expect(screen.getByText(/Hi, Sarah/)).toBeInTheDocument());
    expect(screen.getByText(/Daycare/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Implement**

```tsx
import { Link } from "react-router-dom";
import { Bell, Plus } from "lucide-react";
import { usePortalQuery } from "@/hooks/usePortalQuery";
import { Skeleton } from "@/components/Skeleton";
import { EmptyState } from "@/components/EmptyState";
import { StatusBadge } from "@/components/StatusBadge";
import type { Booking } from "@shared/types/booking";

interface HomeData {
  greeting: { firstName: string; tenantName: string };
  upcoming: Booking[];
  alerts: { vaxExpiring: Array<{ petId: string; vaxType: string; expiresAt: string }>; pendingRequests: number };
}

const SERVICE_LABEL: Record<string, string> = { daycare: "Daycare", grooming: "Grooming", overnights: "Overnights", transport: "Transport" };

export function HomeScreen() {
  const { data, isLoading } = usePortalQuery<HomeData>(["portal", "home"], "/portal/home");

  return (
    <main className="px-5 pt-6 max-w-md mx-auto">
      <header className="flex items-start justify-between mb-6">
        <div>
          {isLoading
            ? <><Skeleton className="h-5 w-24 mb-1" /><Skeleton className="h-3 w-16" /></>
            : <>
                <h1 className="text-xl font-semibold">Hi, {data!.greeting.firstName}</h1>
                <p className="text-xs uppercase tracking-widest text-neutral-500 mt-1">{data!.greeting.tenantName}</p>
              </>
          }
        </div>
        <button aria-label="Notifications" className="size-10 grid place-items-center rounded-full bg-neutral-100 dark:bg-neutral-800">
          <Bell size={18} />
        </button>
      </header>

      <section className="mb-6">
        <h2 className="text-xs uppercase tracking-widest text-neutral-500 mb-3">Up next</h2>
        {isLoading
          ? <Skeleton className="h-20 w-full rounded-2xl" />
          : data!.upcoming.length === 0
            ? <EmptyState title="Nothing booked yet" body="Your upcoming bookings will appear here." />
            : <ul className="space-y-2">
                {data!.upcoming.map(b => (
                  <li key={b.id}>
                    <Link to={`/bookings/${b.id}`} className="block bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-4">
                      <div className="flex items-center justify-between mb-1">
                        <h3 className="font-medium text-sm">{SERVICE_LABEL[b.service]} · {new Date(b.startAt).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" })}</h3>
                        <StatusBadge status={b.status} />
                      </div>
                      <p className="text-xs text-neutral-500">{new Date(b.startAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} — {new Date(b.endAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</p>
                    </Link>
                  </li>
                ))}
              </ul>
        }
      </section>

      <Link to="/book" className="flex items-center justify-center gap-2 w-full h-14 rounded-2xl bg-blue-600 text-white font-semibold mb-6">
        <Plus size={18} /> Book a service
      </Link>

      {!isLoading && data!.alerts.vaxExpiring.length > 0 && (
        <section className="rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 p-4 text-sm">
          <h3 className="font-medium mb-1 text-amber-900 dark:text-amber-200">Vaccinations need attention</h3>
          <p className="text-amber-800 dark:text-amber-300">{data!.alerts.vaxExpiring.length} expiring in the next 30 days.</p>
          <Link to="/pets" className="mt-2 inline-block text-amber-900 dark:text-amber-200 font-medium underline underline-offset-2">Review</Link>
        </section>
      )}
    </main>
  );
}
```

- [ ] **Step 3: Run tests + manual**

```bash
cd PawPilotPro/portal && npm run test && npm run dev
```

- [ ] **Step 4: Commit**

```bash
git add PawPilotPro/portal/src/screens/HomeScreen.tsx PawPilotPro/portal/tests/screens/HomeScreen.test.tsx
git commit -m "feat(portal): home screen with greeting, up next, alerts"
```

---

### Task 3.6: Backend — `/portal/pets` and `/portal/pets/:id`

**Files:**
- Create: `PawPilotPro/project/supabase/functions/server/portal_pets_routes.ts`
- Modify: `PawPilotPro/project/supabase/functions/server/index.tsx`

- [ ] **Step 1: Implement**

```ts
import { Hono } from "npm:hono";
import * as kv from "./kv_store.tsx";
import { requirePortalUser } from "./portal_auth.ts";

const pets = new Hono();

pets.get("/pets", requirePortalUser, async (c) => {
  const u = c.get("portalUser");
  const list = (await kv.getAllByPrefix(`pets:${u.tenantId}:`) as any[]).filter(p => p.customerId === u.customerId);
  return c.json({ pets: list });
});

pets.get("/pets/:id", requirePortalUser, async (c) => {
  const u = c.get("portalUser");
  const id = c.req.param("id");
  const pet = (await kv.get(`pets:${u.tenantId}:${id}`)) as any;
  if (!pet || pet.customerId !== u.customerId) return c.json({ error: "Not found" }, 404);
  const vax = (await kv.getAllByPrefix(`vaccinations:${u.tenantId}:`) as any[]).filter(v => v.petId === id);
  return c.json({ pet, vaccinations: vax });
});

pets.post("/pets/:id/edit-request", requirePortalUser, async (c) => {
  const u = c.get("portalUser");
  const id = c.req.param("id");
  const body = await c.req.json().catch(() => null);
  if (!body?.note) return c.json({ error: "note required" }, 400);
  const pet = (await kv.get(`pets:${u.tenantId}:${id}`)) as any;
  if (!pet || pet.customerId !== u.customerId) return c.json({ error: "Not found" }, 404);
  // Stash request for staff inbox + email staff (implementation expanded in phase 6)
  const reqId = crypto.randomUUID();
  await kv.set(`portal_edit_requests:${u.tenantId}:${reqId}`, {
    id: reqId, petId: id, customerId: u.customerId, note: body.note, submittedAt: new Date().toISOString(), status: "open",
  });
  return c.json({ ok: true, id: reqId });
});

export default pets;
```

- [ ] **Step 2: Mount + commit**

```ts
import portalPets from "./portal_pets_routes.ts";
app.route("/portal", portalPets);
```

```bash
git add PawPilotPro/project/supabase/functions/server/portal_pets_routes.ts PawPilotPro/project/supabase/functions/server/index.tsx
git commit -m "feat(server): /portal/pets list/detail/edit-request"
```

---

### Task 3.7: Portal — PetsScreen + PetDetailScreen + RequestEditSheet + BookingsScreen stub + AccountScreen

**Files:**
- Create: `PawPilotPro/portal/src/screens/PetsScreen.tsx`
- Create: `PawPilotPro/portal/src/screens/PetDetailScreen.tsx`
- Create: `PawPilotPro/portal/src/screens/BookingsScreen.tsx`
- Create: `PawPilotPro/portal/src/screens/AccountScreen.tsx`
- Create: `PawPilotPro/portal/src/screens/components/RequestEditSheet.tsx`
- Create: `PawPilotPro/portal/tests/screens/PetsScreen.test.tsx`

- [ ] **Step 1: `PetsScreen.tsx`**

```tsx
import { Link } from "react-router-dom";
import { usePortalQuery } from "@/hooks/usePortalQuery";
import { Skeleton } from "@/components/Skeleton";
import { EmptyState } from "@/components/EmptyState";
import type { Pet } from "@shared/types/pet";

export function PetsScreen() {
  const { data, isLoading } = usePortalQuery<{ pets: Pet[] }>(["portal", "pets"], "/portal/pets");
  return (
    <main className="px-5 pt-6 max-w-md mx-auto">
      <h1 className="text-xl font-semibold mb-4">My pets</h1>
      {isLoading
        ? <div className="space-y-2"><Skeleton className="h-20 rounded-2xl" /><Skeleton className="h-20 rounded-2xl" /></div>
        : data!.pets.length === 0
          ? <EmptyState title="No pets on file" body="Contact your daycare to add a pet." />
          : <ul className="space-y-2">
              {data!.pets.map(p => (
                <li key={p.id}>
                  <Link to={`/pets/${p.id}`} className="flex gap-3 items-center bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-3">
                    {p.photoUrl
                      ? <img src={p.photoUrl} alt="" className="size-14 rounded-xl object-cover" />
                      : <div className="size-14 rounded-xl bg-neutral-200 dark:bg-neutral-800 grid place-items-center text-xl">🐶</div>}
                    <div className="flex-1">
                      <h3 className="font-medium">{p.name}</h3>
                      <p className="text-xs text-neutral-500">{p.breed} · {ageFrom(p.dob)} · {p.weightKg} kg</p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
      }
    </main>
  );
}
function ageFrom(dob: string): string {
  const years = (Date.now() - new Date(dob).getTime()) / (365.25 * 86_400_000);
  return years < 1 ? `${Math.round(years * 12)} mo` : `${Math.floor(years)} yr`;
}
```

- [ ] **Step 2: `PetDetailScreen.tsx`**

```tsx
import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { usePortalQuery } from "@/hooks/usePortalQuery";
import { Skeleton } from "@/components/Skeleton";
import { RequestEditSheet } from "./components/RequestEditSheet";
import type { Pet } from "@shared/types/pet";
import type { Vaccination, VaxStatus } from "@shared/types/vaccination";

interface PetDetailData { pet: Pet; vaccinations: Vaccination[]; }

function vaxStatus(v: Vaccination): VaxStatus {
  const exp = new Date(v.expiresAt).getTime();
  const now = Date.now();
  if (exp < now) return "expired";
  if (exp - now < 30 * 86_400_000) return "expiring";
  return "current";
}

const VAX_STYLE: Record<VaxStatus, string> = {
  current: "bg-emerald-100 text-emerald-800",
  expiring: "bg-amber-100 text-amber-800",
  expired: "bg-rose-100 text-rose-800",
};

export function PetDetailScreen() {
  const { id } = useParams();
  const { data, isLoading } = usePortalQuery<PetDetailData>(["portal", "pets", id], `/portal/pets/${id}`);
  const [editOpen, setEditOpen] = useState(false);

  if (isLoading || !data) return <main className="p-5"><Skeleton className="h-40" /></main>;

  return (
    <main className="px-5 pt-6 max-w-md mx-auto pb-12">
      <Link to="/pets" className="text-sm text-blue-600 mb-3 inline-block">← All pets</Link>
      <div className="flex gap-4 items-start mb-6">
        {data.pet.photoUrl
          ? <img src={data.pet.photoUrl} alt="" className="size-20 rounded-2xl object-cover" />
          : <div className="size-20 rounded-2xl bg-neutral-200 grid place-items-center text-3xl">🐶</div>}
        <div>
          <h1 className="text-xl font-semibold">{data.pet.name}</h1>
          <p className="text-sm text-neutral-500">{data.pet.breed}</p>
          <p className="text-xs text-neutral-400 mt-1">{data.pet.weightKg} kg · born {new Date(data.pet.dob).toLocaleDateString()}</p>
        </div>
      </div>

      {data.pet.notes && (
        <section className="mb-5 p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-900 text-sm">{data.pet.notes}</section>
      )}

      <section className="mb-6">
        <header className="flex items-center justify-between mb-3">
          <h2 className="text-xs uppercase tracking-widest text-neutral-500">Vaccinations</h2>
          <Link to={`/pets/${id}/vax/upload`} className="text-sm text-blue-600 font-medium">Upload</Link>
        </header>
        {data.vaccinations.length === 0
          ? <p className="text-sm text-neutral-500">None on file.</p>
          : <ul className="space-y-2">
              {data.vaccinations.map(v => {
                const s = vaxStatus(v);
                return (
                  <li key={v.id} className="flex items-center justify-between p-3 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800">
                    <div>
                      <p className="text-sm font-medium capitalize">{v.vaxType}</p>
                      <p className="text-xs text-neutral-500">Expires {new Date(v.expiresAt).toLocaleDateString()}</p>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${VAX_STYLE[s]}`}>{s === "current" ? "Current" : s === "expiring" ? "Expiring" : "Expired"}</span>
                  </li>
                );
              })}
            </ul>
        }
      </section>

      <button onClick={() => setEditOpen(true)} className="w-full h-12 rounded-xl border border-neutral-200 dark:border-neutral-800 text-sm font-medium">
        Request profile edit
      </button>

      <RequestEditSheet open={editOpen} onClose={() => setEditOpen(false)} petId={data.pet.id} />
    </main>
  );
}
```

- [ ] **Step 3: `RequestEditSheet.tsx`**

```tsx
import { useState } from "react";
import { toast } from "sonner";
import { getPortalApi } from "@/lib/api";

export function RequestEditSheet({ open, onClose, petId }: { open: boolean; onClose: () => void; petId: string }) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  if (!open) return null;

  async function submit() {
    setBusy(true);
    try {
      await getPortalApi().post(`/portal/pets/${petId}/edit-request`, { note });
      toast.success("Sent — staff will review.");
      onClose();
    } catch (e: any) { toast.error(e?.message ?? "Failed to send"); } finally { setBusy(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white dark:bg-neutral-950 rounded-t-3xl w-full max-w-md p-5 pb-8" onClick={e => e.stopPropagation()}
           style={{ paddingBottom: "calc(2rem + var(--safe-bottom))" }}>
        <header className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">Request profile edit</h2>
          <button onClick={onClose} className="text-sm text-neutral-500">Cancel</button>
        </header>
        <textarea value={note} onChange={e => setNote(e.target.value)} rows={4} placeholder="What needs to change?"
                  className="w-full p-3 rounded-xl border border-neutral-200 dark:border-neutral-800 text-sm" />
        <button disabled={busy || !note.trim()} onClick={submit}
                className="mt-3 w-full h-12 rounded-xl bg-blue-600 text-white font-semibold disabled:opacity-50">
          {busy ? "Sending…" : "Send request"}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: `BookingsScreen.tsx` (stub)**

```tsx
import { EmptyState } from "@/components/EmptyState";
export function BookingsScreen() {
  return (
    <main className="px-5 pt-6 max-w-md mx-auto">
      <h1 className="text-xl font-semibold mb-4">Bookings</h1>
      <EmptyState title="Coming in Phase 5" body="Booking list ships with the booking flow." />
    </main>
  );
}
```

- [ ] **Step 5: `AccountScreen.tsx`**

```tsx
import { useAuth } from "@/context/AuthContext";

export function AccountScreen() {
  const { session, signOut } = useAuth();
  return (
    <main className="px-5 pt-6 max-w-md mx-auto">
      <h1 className="text-xl font-semibold mb-4">Account</h1>
      <section className="rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 p-4 text-sm mb-4">
        <p className="text-neutral-500 text-xs mb-1">Signed in as</p>
        <p className="font-medium">{session?.user.email}</p>
      </section>
      <button onClick={signOut} className="w-full h-12 rounded-xl border border-neutral-200 dark:border-neutral-800 text-sm font-medium">
        Sign out
      </button>
    </main>
  );
}
```

- [ ] **Step 6: Install sonner toast**

```bash
cd PawPilotPro/portal && npm install sonner
```

Then add `<Toaster />` at the bottom of `App.tsx`:

```tsx
import { Toaster } from "sonner";
// ...
return (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <RouterProvider router={router} />
      <Toaster position="top-center" />
    </AuthProvider>
  </QueryClientProvider>
);
```

- [ ] **Step 7: Run + commit + phase tag**

```bash
cd PawPilotPro/portal && npm run test
git add PawPilotPro/portal/src/screens/ PawPilotPro/portal/tests/screens/ PawPilotPro/portal/src/App.tsx PawPilotPro/portal/package.json PawPilotPro/portal/package-lock.json
git commit -m "feat(portal): pets list, pet detail, account, bookings stub, request-edit sheet"
git tag portal-v1-phase-3-complete
```

---

**Phase 3 done.** Manual E2E:

1. Sign in
2. Land on Home, see greeting + (empty) upcoming
3. Tap Pets — list of household pets renders
4. Tap a pet — detail with vax status pills
5. Tap Request profile edit — sheet opens, send a note, see toast
6. Tap Account → Sign out — back to /login

Confirm before Phase 4.

---

# PHASE 4 — Vax upload + Vax Review queue

**Goal:** Owner uploads a vax certificate from the pet detail screen → file lands in Supabase Storage + a queue entry. Staff reviews in the new Vax Review module, fills in vax type/expiry/booster, approves → entry promoted to a `vaccinations:*` record + owner notified. Or rejects with reason.

**Files this phase creates:**
- `PawPilotPro/project/supabase/functions/server/portal_vax_routes.ts` — owner upload + staff queue endpoints
- `PawPilotPro/portal/src/screens/VaxUploadScreen.tsx`
- `PawPilotPro/portal/tests/screens/VaxUploadScreen.test.tsx`
- `PawPilotPro/project/src/app/modules/vax-review/VaxReviewModule.tsx`
- `PawPilotPro/project/src/app/modules/vax-review/VaxReviewItem.tsx`
- `PawPilotPro/project/src/app/modules/vax-review/api.ts`

**Files this phase modifies:**
- `PawPilotPro/portal/src/router.tsx` — add `/pets/:id/vax/upload`
- `PawPilotPro/project/supabase/functions/server/index.tsx` — mount vax routes
- Staff app's module registry / sidebar to include Vax Review

---

### Task 4.1: Backend — Storage bucket + owner upload endpoint

**Files:**
- Create: `PawPilotPro/project/supabase/functions/server/portal_vax_routes.ts`
- Modify: `PawPilotPro/project/supabase/functions/server/index.tsx`

- [ ] **Step 1: Create Storage bucket (one-time)**

In the Supabase dashboard (or SQL editor): create a private bucket named `vax-uploads`. Add an RLS policy: only the service role can read/write (the Edge Function authenticates with the service key).

- [ ] **Step 2: Implement vax routes**

```ts
import { Hono } from "npm:hono";
import { z } from "npm:zod";
import { createClient } from "npm:@supabase/supabase-js";
import * as kv from "./kv_store.tsx";
import { requirePortalUser } from "./portal_auth.ts";
import { requireAuth, requirePermission } from "./settings_rbac.ts";

const vax = new Hono();

const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED_MIME = new Set(["application/pdf", "image/jpeg", "image/png"]);

const submitSchema = z.object({
  petId: z.string().min(1),
  vaxType: z.enum(["rabies", "dhpp", "bordetella", "leptospirosis", "influenza", "other"]),
  issuedAt: z.string().datetime().optional(),
  expiresAt: z.string().datetime().optional(),
});

// Owner uploads vax cert
vax.post("/portal/vax", requirePortalUser, async (c) => {
  const u = c.get("portalUser");
  const form = await c.req.formData();
  const file = form.get("file");
  const metaRaw = form.get("meta");
  if (!(file instanceof File)) return c.json({ error: "file required" }, 400);
  if (file.size > MAX_BYTES) return c.json({ error: "file too large (max 10MB)" }, 413);
  if (!ALLOWED_MIME.has(file.type)) return c.json({ error: "PDF/JPG/PNG only" }, 415);
  if (typeof metaRaw !== "string") return c.json({ error: "meta required" }, 400);
  const parsed = submitSchema.safeParse(JSON.parse(metaRaw));
  if (!parsed.success) return c.json({ error: parsed.error.format() }, 400);
  const meta = parsed.data;

  // Verify pet ownership
  const pet = (await kv.get(`pets:${u.tenantId}:${meta.petId}`)) as any;
  if (!pet || pet.customerId !== u.customerId) return c.json({ error: "Not your pet" }, 403);

  const id = crypto.randomUUID();
  const ext = file.name.split(".").pop() ?? "bin";
  const path = `tenant/${u.tenantId}/pets/${meta.petId}/vax/${id}.${ext}`;

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { error: upErr } = await admin.storage.from("vax-uploads").upload(path, file, { contentType: file.type, upsert: false });
  if (upErr) return c.json({ error: `Upload failed: ${upErr.message}` }, 500);

  await kv.set(`vax_review_queue:${u.tenantId}:${id}`, {
    id,
    tenantId: u.tenantId,
    petId: meta.petId,
    customerId: u.customerId,
    storagePath: path,
    mimeType: file.type,
    proposedVaxType: meta.vaxType,
    proposedIssuedAt: meta.issuedAt ?? null,
    proposedExpiresAt: meta.expiresAt ?? null,
    submittedAt: new Date().toISOString(),
    status: "pending",
  });

  return c.json({ ok: true, id });
});

// Staff lists pending reviews
vax.get("/portal-admin/vax-queue", requireAuth, requirePermission("vaccinations", "update"), async (c) => {
  const user = c.get("user");
  const items = (await kv.getAllByPrefix(`vax_review_queue:${user.tenantId}:`) as any[]).filter(i => i.status === "pending");
  // Generate signed URLs for staff to view files
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const enriched = await Promise.all(items.map(async i => {
    const { data: signed } = await admin.storage.from("vax-uploads").createSignedUrl(i.storagePath, 60 * 30);
    return { ...i, viewUrl: signed?.signedUrl ?? null };
  }));
  return c.json({ items: enriched });
});

const approveSchema = z.object({
  vaxType: z.enum(["rabies", "dhpp", "bordetella", "leptospirosis", "influenza", "other"]),
  issuedAt: z.string().datetime(),
  expiresAt: z.string().datetime(),
  boosterDueAt: z.string().datetime().nullable(),
});

vax.post("/portal-admin/vax-queue/:id/approve", requireAuth, requirePermission("vaccinations", "update"), async (c) => {
  const id = c.req.param("id");
  const user = c.get("user");
  const body = await c.req.json().catch(() => null);
  const parsed = approveSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: parsed.error.format() }, 400);

  const entry = (await kv.get(`vax_review_queue:${user.tenantId}:${id}`)) as any;
  if (!entry || entry.status !== "pending") return c.json({ error: "Not found or already handled" }, 404);

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: signed } = await admin.storage.from("vax-uploads").createSignedUrl(entry.storagePath, 60 * 60 * 24 * 365 * 5);
  const certificateUrl = signed?.signedUrl ?? "";

  const vaxId = crypto.randomUUID();
  await kv.set(`vaccinations:${user.tenantId}:${vaxId}`, {
    id: vaxId,
    tenantId: user.tenantId,
    petId: entry.petId,
    vaxType: parsed.data.vaxType,
    certificateUrl,
    issuedAt: parsed.data.issuedAt,
    expiresAt: parsed.data.expiresAt,
    boosterDueAt: parsed.data.boosterDueAt,
    approvedBy: user.id,
    approvedAt: new Date().toISOString(),
  });
  await kv.set(`vax_review_queue:${user.tenantId}:${id}`, { ...entry, status: "approved", reviewedBy: user.id, reviewedAt: new Date().toISOString(), promotedTo: vaxId });

  // Notification stub — full pipeline in Phase 6
  await kv.set(`notifications:${user.tenantId}:${entry.customerId}:${crypto.randomUUID()}`, {
    tenantId: user.tenantId, customerId: entry.customerId,
    type: "vax.approved", payload: { petId: entry.petId, vaxType: parsed.data.vaxType },
    link: `/pets/${entry.petId}`, readAt: null, createdAt: new Date().toISOString(),
  });

  return c.json({ ok: true, vaccinationId: vaxId });
});

const rejectSchema = z.object({ reason: z.string().min(3).max(500) });
vax.post("/portal-admin/vax-queue/:id/reject", requireAuth, requirePermission("vaccinations", "update"), async (c) => {
  const id = c.req.param("id");
  const user = c.get("user");
  const body = await c.req.json().catch(() => null);
  const parsed = rejectSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: parsed.error.format() }, 400);
  const entry = (await kv.get(`vax_review_queue:${user.tenantId}:${id}`)) as any;
  if (!entry || entry.status !== "pending") return c.json({ error: "Not found or already handled" }, 404);
  await kv.set(`vax_review_queue:${user.tenantId}:${id}`, { ...entry, status: "rejected", reviewedBy: user.id, reviewedAt: new Date().toISOString(), rejectionReason: parsed.data.reason });
  await kv.set(`notifications:${user.tenantId}:${entry.customerId}:${crypto.randomUUID()}`, {
    tenantId: user.tenantId, customerId: entry.customerId,
    type: "vax.rejected", payload: { petId: entry.petId, reason: parsed.data.reason },
    link: `/pets/${entry.petId}`, readAt: null, createdAt: new Date().toISOString(),
  });
  return c.json({ ok: true });
});

export default vax;
```

- [ ] **Step 3: Mount**

```ts
import portalVax from "./portal_vax_routes.ts";
app.route("/", portalVax); // routes already include /portal and /portal-admin prefixes
```

- [ ] **Step 4: Commit**

```bash
git add PawPilotPro/project/supabase/functions/server/portal_vax_routes.ts PawPilotPro/project/supabase/functions/server/index.tsx
git commit -m "feat(server): vax upload + staff review queue + approve/reject"
```

---

### Task 4.2: Portal — VaxUploadScreen

**Files:**
- Create: `PawPilotPro/portal/src/screens/VaxUploadScreen.tsx`
- Create: `PawPilotPro/portal/tests/screens/VaxUploadScreen.test.tsx`
- Modify: `PawPilotPro/portal/src/router.tsx`

- [ ] **Step 1: Failing test**

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { VaxUploadScreen } from "@/screens/VaxUploadScreen";

const apiFetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true, id: "v1" }), { status: 200 }));
vi.mock("@/lib/api", () => ({ getPortalApi: () => ({ post: vi.fn(), }), }));
vi.mock("@/lib/supabase", () => ({ getSupabase: () => ({ auth: { getSession: () => Promise.resolve({ data: { session: { access_token: "jwt" } } }) } }) }));
// Replace global fetch for the multipart call inside the screen
(globalThis as any).fetch = apiFetch;
(import.meta.env as any).VITE_SUPABASE_PROJECT_ID = "p";
(import.meta.env as any).VITE_SUPABASE_ANON_KEY = "a";

const wrap = (ui: React.ReactNode) => (
  <MemoryRouter initialEntries={["/pets/p1/vax/upload"]}>
    <QueryClientProvider client={new QueryClient()}>
      <Routes><Route path="/pets/:id/vax/upload" element={ui} /></Routes>
    </QueryClientProvider>
  </MemoryRouter>
);

describe("VaxUploadScreen", () => {
  it("rejects oversize files client-side", async () => {
    render(wrap(<VaxUploadScreen />));
    const huge = new File(["x".repeat(11 * 1024 * 1024)], "huge.pdf", { type: "application/pdf" });
    const input = screen.getByLabelText(/certificate/i) as HTMLInputElement;
    Object.defineProperty(input, "files", { value: [huge] });
    fireEvent.change(input);
    await waitFor(() => expect(screen.getByText(/too large/i)).toBeInTheDocument());
    expect(apiFetch).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Implement**

```tsx
import { useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { toast } from "sonner";
import { getSupabase } from "@/lib/supabase";

const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED = ["application/pdf", "image/jpeg", "image/png"];

const VAX_TYPES = ["rabies", "dhpp", "bordetella", "leptospirosis", "influenza", "other"] as const;

export function VaxUploadScreen() {
  const { id } = useParams();
  const nav = useNavigate();
  const [file, setFile] = useState<File | null>(null);
  const [vaxType, setVaxType] = useState<typeof VAX_TYPES[number]>("rabies");
  const [issuedAt, setIssuedAt] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function pickFile(f: File | null) {
    setErr(null);
    if (!f) { setFile(null); return; }
    if (f.size > MAX_BYTES) { setErr("File too large (max 10MB)."); return; }
    if (!ALLOWED.includes(f.type)) { setErr("PDF, JPG, or PNG only."); return; }
    setFile(f);
  }

  async function submit() {
    if (!file) return;
    setBusy(true); setErr(null);
    try {
      const { data: sess } = await getSupabase().auth.getSession();
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      const url = `https://${projectId}.supabase.co/functions/v1/make-server-fc003b23/portal/vax`;
      const fd = new FormData();
      fd.append("file", file);
      fd.append("meta", JSON.stringify({ petId: id, vaxType, issuedAt: issuedAt || undefined, expiresAt: expiresAt || undefined }));
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${anonKey}`,
          "X-User-Token": `Bearer ${sess.session?.access_token ?? ""}`,
        },
        body: fd,
      });
      if (!res.ok) { setErr((await res.json()).error ?? `Upload failed (${res.status})`); return; }
      toast.success("Uploaded — staff will review.");
      nav(`/pets/${id}`);
    } catch (e: any) {
      setErr(e?.message ?? "Upload failed");
    } finally { setBusy(false); }
  }

  return (
    <main className="px-5 pt-6 max-w-md mx-auto pb-12">
      <Link to={`/pets/${id}`} className="text-sm text-blue-600 mb-3 inline-block">← Back</Link>
      <h1 className="text-xl font-semibold mb-4">Upload vaccination</h1>

      <label className="block mb-4">
        <span className="block text-sm font-medium mb-1">Certificate (PDF / JPG / PNG, ≤10MB)</span>
        <input id="vax-file" type="file" accept=".pdf,image/jpeg,image/png"
               onChange={e => pickFile(e.target.files?.[0] ?? null)}
               className="block w-full text-sm" />
      </label>

      <label className="block mb-4">
        <span className="block text-sm font-medium mb-1">Vaccination type</span>
        <select value={vaxType} onChange={e => setVaxType(e.target.value as typeof VAX_TYPES[number])}
                className="w-full h-12 px-3 rounded-xl border border-neutral-200 bg-white capitalize">
          {VAX_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </label>

      <label className="block mb-4">
        <span className="block text-sm font-medium mb-1">Issued on (optional)</span>
        <input type="date" value={issuedAt ? issuedAt.slice(0, 10) : ""} onChange={e => setIssuedAt(e.target.value ? new Date(e.target.value).toISOString() : "")}
               className="w-full h-12 px-3 rounded-xl border border-neutral-200 bg-white" />
      </label>

      <label className="block mb-6">
        <span className="block text-sm font-medium mb-1">Expires on (optional)</span>
        <input type="date" value={expiresAt ? expiresAt.slice(0, 10) : ""} onChange={e => setExpiresAt(e.target.value ? new Date(e.target.value).toISOString() : "")}
               className="w-full h-12 px-3 rounded-xl border border-neutral-200 bg-white" />
      </label>

      {err && <p role="alert" className="text-sm text-red-600 mb-3">{err}</p>}

      <button disabled={!file || busy} onClick={submit} className="w-full h-12 rounded-xl bg-blue-600 text-white font-semibold disabled:opacity-50">
        {busy ? "Uploading…" : "Submit for review"}
      </button>
    </main>
  );
}
```

- [ ] **Step 3: Register route**

In `router.tsx` children:

```tsx
{ path: "/pets/:id/vax/upload", element: <VaxUploadScreen /> },
```

Import `VaxUploadScreen` at top.

- [ ] **Step 4: Tests + commit**

```bash
cd PawPilotPro/portal && npm run test
git add PawPilotPro/portal/src/screens/VaxUploadScreen.tsx PawPilotPro/portal/tests/screens/VaxUploadScreen.test.tsx PawPilotPro/portal/src/router.tsx
git commit -m "feat(portal): vax upload screen with client-side validation"
```

---

### Task 4.3: Staff app — Vax Review module

**Files:**
- Create: `PawPilotPro/project/src/app/modules/vax-review/VaxReviewModule.tsx`
- Create: `PawPilotPro/project/src/app/modules/vax-review/VaxReviewItem.tsx`
- Create: `PawPilotPro/project/src/app/modules/vax-review/api.ts`
- Modify: staff app route registry to include the module

- [ ] **Step 1: Locate route registry**

```bash
grep -rn "modules/customers" PawPilotPro/project/src/app/App.tsx PawPilotPro/project/src/app/router*.tsx 2>/dev/null | head
```

Identify how modules are registered (route table or sidebar config).

- [ ] **Step 2: Implement `api.ts`**

```ts
import { callApi } from "@/utils/api";

export interface VaxQueueItem {
  id: string;
  tenantId: string;
  petId: string;
  customerId: string;
  storagePath: string;
  mimeType: string;
  proposedVaxType: string;
  proposedIssuedAt: string | null;
  proposedExpiresAt: string | null;
  submittedAt: string;
  viewUrl: string | null;
}

export const fetchVaxQueue = () => callApi<{ items: VaxQueueItem[] }>("/portal-admin/vax-queue");
export const approveVax = (id: string, body: { vaxType: string; issuedAt: string; expiresAt: string; boosterDueAt: string | null }) =>
  callApi<{ ok: true; vaccinationId: string }>(`/portal-admin/vax-queue/${id}/approve`, { method: "POST", body: JSON.stringify(body) });
export const rejectVax = (id: string, reason: string) =>
  callApi<{ ok: true }>(`/portal-admin/vax-queue/${id}/reject`, { method: "POST", body: JSON.stringify({ reason }) });
```

- [ ] **Step 3: Implement `VaxReviewItem.tsx`**

```tsx
import { useState } from "react";
import { toast } from "sonner";
import { approveVax, rejectVax, VaxQueueItem } from "./api";

const VAX_TYPES = ["rabies", "dhpp", "bordetella", "leptospirosis", "influenza", "other"] as const;

export function VaxReviewItem({ item, onResolved }: { item: VaxQueueItem; onResolved: () => void }) {
  const [vaxType, setVaxType] = useState(item.proposedVaxType);
  const [issuedAt, setIssuedAt] = useState(item.proposedIssuedAt?.slice(0, 10) ?? "");
  const [expiresAt, setExpiresAt] = useState(item.proposedExpiresAt?.slice(0, 10) ?? "");
  const [boosterDueAt, setBoosterDueAt] = useState("");
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  async function approve() {
    if (!issuedAt || !expiresAt) { toast.error("Issued + expires required"); return; }
    setBusy(true);
    try {
      await approveVax(item.id, {
        vaxType,
        issuedAt: new Date(issuedAt).toISOString(),
        expiresAt: new Date(expiresAt).toISOString(),
        boosterDueAt: boosterDueAt ? new Date(boosterDueAt).toISOString() : null,
      });
      toast.success("Approved");
      onResolved();
    } catch (e: any) { toast.error(e?.message ?? "Failed"); } finally { setBusy(false); }
  }

  async function reject() {
    if (reason.length < 3) { toast.error("Reason required (3+ chars)"); return; }
    setBusy(true);
    try { await rejectVax(item.id, reason); toast.success("Rejected"); onResolved(); }
    catch (e: any) { toast.error(e?.message ?? "Failed"); } finally { setBusy(false); }
  }

  return (
    <div className="border border-neutral-200 rounded-xl p-4 grid grid-cols-2 gap-4">
      <div>
        {item.viewUrl
          ? <iframe src={item.viewUrl} className="w-full h-80 rounded-md border" title="Certificate" />
          : <p className="text-sm text-neutral-500">No preview</p>}
        <p className="text-xs text-neutral-500 mt-1">{item.mimeType} · submitted {new Date(item.submittedAt).toLocaleString()}</p>
      </div>
      <div className="space-y-2 text-sm">
        <label className="block">
          <span className="block text-xs mb-1">Vax type</span>
          <select value={vaxType} onChange={e => setVaxType(e.target.value)} className="w-full h-9 px-2 rounded border capitalize">
            {VAX_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="block text-xs mb-1">Issued</span>
          <input type="date" value={issuedAt} onChange={e => setIssuedAt(e.target.value)} className="w-full h-9 px-2 rounded border" />
        </label>
        <label className="block">
          <span className="block text-xs mb-1">Expires</span>
          <input type="date" value={expiresAt} onChange={e => setExpiresAt(e.target.value)} className="w-full h-9 px-2 rounded border" />
        </label>
        <label className="block">
          <span className="block text-xs mb-1">Booster due (optional)</span>
          <input type="date" value={boosterDueAt} onChange={e => setBoosterDueAt(e.target.value)} className="w-full h-9 px-2 rounded border" />
        </label>

        <div className="flex gap-2 pt-2">
          <button disabled={busy} onClick={approve} className="flex-1 h-9 rounded bg-emerald-600 text-white font-medium disabled:opacity-50">Approve</button>
          <button disabled={busy} onClick={() => setRejecting(true)} className="flex-1 h-9 rounded border border-rose-300 text-rose-700 font-medium">Reject…</button>
        </div>

        {rejecting && (
          <div className="pt-2">
            <textarea value={reason} onChange={e => setReason(e.target.value)} placeholder="Reason (visible to owner)" rows={2}
                      className="w-full p-2 rounded border text-sm" />
            <div className="flex gap-2 mt-1">
              <button disabled={busy} onClick={reject} className="flex-1 h-9 rounded bg-rose-600 text-white text-sm">Confirm reject</button>
              <button onClick={() => setRejecting(false)} className="flex-1 h-9 rounded border text-sm">Cancel</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Implement `VaxReviewModule.tsx`**

```tsx
import { useEffect, useState } from "react";
import { fetchVaxQueue, VaxQueueItem } from "./api";
import { VaxReviewItem } from "./VaxReviewItem";

export function VaxReviewModule() {
  const [items, setItems] = useState<VaxQueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const load = () => { setLoading(true); fetchVaxQueue().then(r => setItems(r.items)).finally(() => setLoading(false)); };
  useEffect(load, []);
  return (
    <main className="p-6 max-w-5xl mx-auto">
      <header className="mb-4">
        <h1 className="text-xl font-semibold">Vaccination Review</h1>
        <p className="text-sm text-neutral-500">{items.length} pending</p>
      </header>
      {loading
        ? <p className="text-sm text-neutral-500">Loading…</p>
        : items.length === 0
          ? <p className="text-sm text-neutral-500">Queue empty.</p>
          : <ul className="space-y-4">
              {items.map(it => <li key={it.id}><VaxReviewItem item={it} onResolved={load} /></li>)}
            </ul>
      }
    </main>
  );
}
```

- [ ] **Step 5: Register module in staff app**

Add to staff app's route table and sidebar (mirror how an existing module like Daycare is registered). Path `/vax-review`. Permission gate: `vaccinations.update`.

- [ ] **Step 6: Manual smoke + commit + phase tag**

```bash
git add PawPilotPro/project/src/app/modules/vax-review/ PawPilotPro/project/src/app/App.tsx
git commit -m "feat(staff): vax review module"
git tag portal-v1-phase-4-complete
```

---

**Phase 4 done.** End-to-end:

1. Owner uploads a vax PDF on `/pets/:id/vax/upload`
2. Staff opens Vax Review, sees the cert in an iframe
3. Staff fills issued/expires, clicks Approve
4. Owner's pet detail now shows a Current vax pill for that type
5. Reject path: owner sees rejection note (full notification surfacing in Phase 6)

Confirm before Phase 5.

---

# PHASE 5 — Booking flow + Pending Requests inbox

**Goal:** Owner submits a booking request through a 4-step wizard. Staff sees it in a Pending Requests inbox, approves or declines with reason. Owner's bookings list updates in realtime via Supabase Broadcast.

**Files this phase creates:**
- `PawPilotPro/project/supabase/functions/server/portal_bookings_routes.ts`
- `PawPilotPro/project/supabase/functions/server/portal_pending_requests_routes.ts`
- `PawPilotPro/project/supabase/functions/server/portal_availability_routes.ts`
- `PawPilotPro/portal/src/screens/BookingsScreen.tsx` (replaces stub)
- `PawPilotPro/portal/src/screens/BookingDetailScreen.tsx`
- `PawPilotPro/portal/src/screens/booking/BookingFlow.tsx`
- `PawPilotPro/portal/src/screens/booking/StepService.tsx`
- `PawPilotPro/portal/src/screens/booking/StepPets.tsx`
- `PawPilotPro/portal/src/screens/booking/StepDates.tsx`
- `PawPilotPro/portal/src/screens/booking/StepReview.tsx`
- `PawPilotPro/portal/src/stores/bookingDraftStore.ts`
- `PawPilotPro/portal/src/hooks/usePortalRealtime.ts`
- `PawPilotPro/portal/tests/screens/booking/BookingFlow.test.tsx`
- `PawPilotPro/portal/tests/stores/bookingDraftStore.test.ts`
- `PawPilotPro/project/src/app/modules/portal-requests/PendingRequestsModule.tsx`
- `PawPilotPro/project/src/app/modules/portal-requests/api.ts`
- `PawPilotPro/project/src/app/modules/portal-requests/PendingRequestRow.tsx`

**Files this phase modifies:**
- `PawPilotPro/portal/src/router.tsx` — add `/book`, `/bookings/:id`
- `PawPilotPro/project/supabase/functions/server/index.tsx` — mount new routes
- Staff app route/sidebar registry — add Pending Requests module

---

### Task 5.1: Backend — `/portal/availability` (grooming/overnights slot picker)

**Files:**
- Create: `PawPilotPro/project/supabase/functions/server/portal_availability_routes.ts`

- [ ] **Step 1: Implement**

```ts
import { Hono } from "npm:hono";
import * as kv from "./kv_store.tsx";
import { requirePortalUser } from "./portal_auth.ts";

const availability = new Hono();

availability.get("/portal/availability", requirePortalUser, async (c) => {
  const u = c.get("portalUser");
  const service = c.req.query("service");
  const date = c.req.query("date"); // YYYY-MM-DD
  if (!service || !date) return c.json({ error: "service + date required" }, 400);

  // Staff schedule for that date — pull existing bookings, return open slots.
  // For v1, return business hours minus existing bookings of the same service.
  const dayStart = new Date(`${date}T00:00:00.000Z`).getTime();
  const dayEnd = dayStart + 24 * 3600 * 1000;
  const allBookings = (await kv.getAllByPrefix(`bookings:${u.tenantId}:`) as any[])
    .filter(b => b.service === service && b.status !== "cancelled" && b.status !== "declined")
    .filter(b => new Date(b.startAt).getTime() >= dayStart && new Date(b.startAt).getTime() < dayEnd);

  const tenant = (await kv.get(`tenants:${u.tenantId}`)) as any;
  const openHour = tenant?.businessHours?.open ?? 8;
  const closeHour = tenant?.businessHours?.close ?? 17;
  const slotMinutes = service === "grooming" ? 60 : 30;

  const slots: { startAt: string; endAt: string; available: boolean }[] = [];
  for (let h = openHour * 60; h < closeHour * 60; h += slotMinutes) {
    const start = new Date(dayStart + h * 60 * 1000);
    const end = new Date(start.getTime() + slotMinutes * 60 * 1000);
    const taken = allBookings.some(b => {
      const bs = new Date(b.startAt).getTime();
      const be = new Date(b.endAt).getTime();
      return start.getTime() < be && end.getTime() > bs;
    });
    slots.push({ startAt: start.toISOString(), endAt: end.toISOString(), available: !taken });
  }
  return c.json({ slots });
});

export default availability;
```

- [ ] **Step 2: Mount in `index.tsx`**

```ts
import portalAvailability from "./portal_availability_routes.ts";
app.route("/", portalAvailability);
```

- [ ] **Step 3: Commit**

```bash
git add PawPilotPro/project/supabase/functions/server/portal_availability_routes.ts PawPilotPro/project/supabase/functions/server/index.tsx
git commit -m "feat(server): /portal/availability slot picker"
```

---

### Task 5.2: Backend — booking CRUD + idempotency + realtime broadcast

**Files:**
- Create: `PawPilotPro/project/supabase/functions/server/portal_bookings_routes.ts`
- Modify: `PawPilotPro/project/supabase/functions/server/index.tsx`

- [ ] **Step 1: Implement bookings routes**

```ts
import { Hono } from "npm:hono";
import { z } from "npm:zod";
import { createClient } from "npm:@supabase/supabase-js";
import * as kv from "./kv_store.tsx";
import { requirePortalUser } from "./portal_auth.ts";

const bookings = new Hono();

const serviceEnum = z.enum(["daycare", "grooming", "overnights", "transport"]);
const createSchema = z.object({
  service: serviceEnum,
  petIds: z.array(z.string()).min(1).max(10),
  startAt: z.string().datetime(),
  endAt: z.string().datetime(),
  notes: z.string().max(500).nullable(),
  requestId: z.string().uuid(),
}).refine(d => new Date(d.endAt) > new Date(d.startAt), "endAt must be after startAt");

function broadcastCustomer(tenantId: string, customerId: string, event: string, payload: unknown) {
  // Fire-and-forget — Supabase Realtime via channel send
  const url = Deno.env.get("SUPABASE_URL")!;
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(url, key, { realtime: { params: { eventsPerSecond: 10 } } });
  const ch = admin.channel(`sync:${tenantId}:portal:${customerId}`);
  return ch.subscribe(async (status) => {
    if (status === "SUBSCRIBED") {
      await ch.send({ type: "broadcast", event, payload });
      admin.removeChannel(ch);
    }
  });
}

bookings.get("/portal/bookings", requirePortalUser, async (c) => {
  const u = c.get("portalUser");
  const scope = c.req.query("scope") ?? "upcoming";
  const all = (await kv.getAllByPrefix(`bookings:${u.tenantId}:`) as any[]).filter(b => b.customerId === u.customerId);
  const now = Date.now();
  const filtered = scope === "past"
    ? all.filter(b => new Date(b.endAt).getTime() < now || b.status === "cancelled" || b.status === "declined").sort((a, b) => new Date(b.startAt).getTime() - new Date(a.startAt).getTime())
    : all.filter(b => new Date(b.endAt).getTime() >= now && b.status !== "cancelled" && b.status !== "declined").sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());
  return c.json({ bookings: filtered });
});

bookings.get("/portal/bookings/:id", requirePortalUser, async (c) => {
  const u = c.get("portalUser");
  const id = c.req.param("id");
  const b = (await kv.get(`bookings:${u.tenantId}:${id}`)) as any;
  if (!b || b.customerId !== u.customerId) return c.json({ error: "Not found" }, 404);
  return c.json({ booking: b });
});

bookings.post("/portal/bookings", requirePortalUser, async (c) => {
  const u = c.get("portalUser");
  const body = await c.req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: parsed.error.format() }, 400);
  const data = parsed.data;

  // Idempotency
  const existing = (await kv.getAllByPrefix(`bookings:${u.tenantId}:`) as any[]).find(b => b.requestId === data.requestId);
  if (existing) return c.json({ booking: existing, deduped: true });

  // Validate pets belong to customer + vax current
  const pets = await Promise.all(data.petIds.map(pid => kv.get(`pets:${u.tenantId}:${pid}`)));
  if (pets.some(p => !p || (p as any).customerId !== u.customerId)) return c.json({ error: "Invalid pet selection" }, 403);
  const vaxByPet = new Map<string, any[]>();
  const allVax = (await kv.getAllByPrefix(`vaccinations:${u.tenantId}:`) as any[]).filter(v => data.petIds.includes(v.petId));
  for (const v of allVax) {
    const arr = vaxByPet.get(v.petId) ?? [];
    arr.push(v);
    vaxByPet.set(v.petId, arr);
  }
  const requiredTypes = ["rabies", "dhpp"];
  for (const pid of data.petIds) {
    const vs = vaxByPet.get(pid) ?? [];
    for (const t of requiredTypes) {
      const v = vs.find(x => x.vaxType === t);
      if (!v || new Date(v.expiresAt).getTime() < Date.now()) {
        return c.json({ error: `Vax missing/expired: ${t}`, petId: pid }, 409);
      }
    }
  }

  // Business rules — min advance hours
  const tenant = (await kv.get(`tenants:${u.tenantId}`)) as any;
  const minAdvanceHours = tenant?.portal?.minAdvanceHours?.[data.service] ?? 12;
  if (new Date(data.startAt).getTime() - Date.now() < minAdvanceHours * 3600 * 1000) {
    return c.json({ error: `Requires ${minAdvanceHours}h advance notice` }, 409);
  }

  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const booking = {
    id, tenantId: u.tenantId, customerId: u.customerId,
    service: data.service, petIds: data.petIds, startAt: data.startAt, endAt: data.endAt,
    status: "pending" as const, notes: data.notes ?? null,
    ownerSubmitted: true, requestId: data.requestId,
    createdAt: now, updatedAt: now,
  };
  await kv.set(`bookings:${u.tenantId}:${id}`, booking);
  await kv.set(`notifications:${u.tenantId}:${u.customerId}:${crypto.randomUUID()}`, {
    tenantId: u.tenantId, customerId: u.customerId,
    type: "booking.received", payload: { bookingId: id, service: data.service },
    link: `/bookings/${id}`, readAt: null, createdAt: now,
  });
  // Broadcast to staff app sync channel
  await broadcastCustomer(u.tenantId, "STAFF", "booking.created", { bookingId: id });
  return c.json({ booking });
});

bookings.post("/portal/bookings/:id/cancel", requirePortalUser, async (c) => {
  const u = c.get("portalUser");
  const id = c.req.param("id");
  const b = (await kv.get(`bookings:${u.tenantId}:${id}`)) as any;
  if (!b || b.customerId !== u.customerId) return c.json({ error: "Not found" }, 404);
  if (b.status !== "pending") return c.json({ error: "Only pending bookings can be cancelled" }, 409);
  const updated = { ...b, status: "cancelled", updatedAt: new Date().toISOString(), statusChangedAt: new Date().toISOString() };
  await kv.set(`bookings:${u.tenantId}:${id}`, updated);
  await broadcastCustomer(u.tenantId, u.customerId, "booking.status_changed", { bookingId: id, status: "cancelled" });
  return c.json({ booking: updated });
});

export default bookings;
```

- [ ] **Step 2: Mount + commit**

```ts
import portalBookings from "./portal_bookings_routes.ts";
app.route("/", portalBookings);
```

```bash
git add PawPilotPro/project/supabase/functions/server/portal_bookings_routes.ts PawPilotPro/project/supabase/functions/server/index.tsx
git commit -m "feat(server): portal bookings CRUD with idempotency + realtime"
```

---

### Task 5.3: Backend — Pending Requests admin endpoints

**Files:**
- Create: `PawPilotPro/project/supabase/functions/server/portal_pending_requests_routes.ts`
- Modify: `PawPilotPro/project/supabase/functions/server/index.tsx`

- [ ] **Step 1: Implement**

```ts
import { Hono } from "npm:hono";
import { z } from "npm:zod";
import { createClient } from "npm:@supabase/supabase-js";
import * as kv from "./kv_store.tsx";
import { requireAuth, requirePermission } from "./settings_rbac.ts";

const pending = new Hono();

async function broadcast(tenantId: string, customerId: string, event: string, payload: unknown) {
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const ch = admin.channel(`sync:${tenantId}:portal:${customerId}`);
  return ch.subscribe(async status => {
    if (status === "SUBSCRIBED") { await ch.send({ type: "broadcast", event, payload }); admin.removeChannel(ch); }
  });
}

pending.get("/portal-admin/pending-requests", requireAuth, requirePermission("bookings", "update"), async (c) => {
  const user = c.get("user");
  const all = (await kv.getAllByPrefix(`bookings:${user.tenantId}:`) as any[])
    .filter(b => b.ownerSubmitted && b.status === "pending")
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  return c.json({ requests: all });
});

pending.post("/portal-admin/bookings/:id/approve", requireAuth, requirePermission("bookings", "update"), async (c) => {
  const user = c.get("user");
  const id = c.req.param("id");
  const b = (await kv.get(`bookings:${user.tenantId}:${id}`)) as any;
  if (!b || b.status !== "pending") return c.json({ error: "Not found or already handled" }, 409);
  const updated = { ...b, status: "confirmed", statusChangedAt: new Date().toISOString(), staffId: user.id, updatedAt: new Date().toISOString() };
  await kv.set(`bookings:${user.tenantId}:${id}`, updated);
  await kv.set(`notifications:${user.tenantId}:${b.customerId}:${crypto.randomUUID()}`, {
    tenantId: user.tenantId, customerId: b.customerId,
    type: "booking.confirmed", payload: { bookingId: id, service: b.service },
    link: `/bookings/${id}`, readAt: null, createdAt: new Date().toISOString(),
  });
  await broadcast(user.tenantId, b.customerId, "booking.status_changed", { bookingId: id, status: "confirmed" });
  return c.json({ booking: updated });
});

const declineSchema = z.object({ reason: z.string().min(3).max(500) });
pending.post("/portal-admin/bookings/:id/decline", requireAuth, requirePermission("bookings", "update"), async (c) => {
  const user = c.get("user");
  const id = c.req.param("id");
  const body = await c.req.json().catch(() => null);
  const parsed = declineSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: parsed.error.format() }, 400);
  const b = (await kv.get(`bookings:${user.tenantId}:${id}`)) as any;
  if (!b || b.status !== "pending") return c.json({ error: "Not found or already handled" }, 409);
  const updated = { ...b, status: "declined", declineReason: parsed.data.reason, statusChangedAt: new Date().toISOString(), staffId: user.id, updatedAt: new Date().toISOString() };
  await kv.set(`bookings:${user.tenantId}:${id}`, updated);
  await kv.set(`notifications:${user.tenantId}:${b.customerId}:${crypto.randomUUID()}`, {
    tenantId: user.tenantId, customerId: b.customerId,
    type: "booking.declined", payload: { bookingId: id, reason: parsed.data.reason },
    link: `/bookings/${id}`, readAt: null, createdAt: new Date().toISOString(),
  });
  await broadcast(user.tenantId, b.customerId, "booking.status_changed", { bookingId: id, status: "declined", reason: parsed.data.reason });
  return c.json({ booking: updated });
});

export default pending;
```

- [ ] **Step 2: Mount + commit**

```ts
import portalPending from "./portal_pending_requests_routes.ts";
app.route("/", portalPending);
```

```bash
git add PawPilotPro/project/supabase/functions/server/portal_pending_requests_routes.ts PawPilotPro/project/supabase/functions/server/index.tsx
git commit -m "feat(server): pending requests admin endpoints (approve/decline)"
```

---

### Task 5.4: Portal — booking draft Zustand store

**Files:**
- Create: `PawPilotPro/portal/src/stores/bookingDraftStore.ts`
- Create: `PawPilotPro/portal/tests/stores/bookingDraftStore.test.ts`

- [ ] **Step 1: Failing test**

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { useBookingDraftStore } from "@/stores/bookingDraftStore";

describe("bookingDraftStore", () => {
  beforeEach(() => useBookingDraftStore.getState().reset());
  it("starts empty", () => {
    expect(useBookingDraftStore.getState().service).toBeNull();
  });
  it("sets service and pets", () => {
    useBookingDraftStore.getState().setService("daycare");
    useBookingDraftStore.getState().setPetIds(["p1", "p2"]);
    expect(useBookingDraftStore.getState().service).toBe("daycare");
    expect(useBookingDraftStore.getState().petIds).toEqual(["p1", "p2"]);
  });
  it("isComplete only when all set", () => {
    const s = useBookingDraftStore.getState();
    s.setService("grooming"); s.setPetIds(["p1"]); s.setDates("2026-06-01T10:00:00Z", "2026-06-01T11:00:00Z");
    expect(useBookingDraftStore.getState().isComplete()).toBe(true);
  });
});
```

- [ ] **Step 2: Run to fail; then implement**

```ts
import { create } from "zustand";
import type { Service } from "@shared/types/booking";

interface BookingDraft {
  service: Service | null;
  petIds: string[];
  startAt: string | null;
  endAt: string | null;
  notes: string;
  requestId: string;
  setService: (s: Service) => void;
  setPetIds: (ids: string[]) => void;
  setDates: (start: string, end: string) => void;
  setNotes: (n: string) => void;
  isComplete: () => boolean;
  reset: () => void;
}

function newRequestId() {
  return crypto.randomUUID();
}

export const useBookingDraftStore = create<BookingDraft>((set, get) => ({
  service: null,
  petIds: [],
  startAt: null,
  endAt: null,
  notes: "",
  requestId: newRequestId(),
  setService: (s) => set({ service: s }),
  setPetIds: (ids) => set({ petIds: ids }),
  setDates: (startAt, endAt) => set({ startAt, endAt }),
  setNotes: (n) => set({ notes: n }),
  isComplete: () => {
    const s = get();
    return !!(s.service && s.petIds.length > 0 && s.startAt && s.endAt);
  },
  reset: () => set({ service: null, petIds: [], startAt: null, endAt: null, notes: "", requestId: newRequestId() }),
}));
```

- [ ] **Step 3: Tests pass + commit**

```bash
cd PawPilotPro/portal && npm run test
git add PawPilotPro/portal/src/stores/ PawPilotPro/portal/tests/stores/
git commit -m "feat(portal): booking draft zustand store"
```

---

### Task 5.5: Portal — Booking flow 4-step wizard

**Files:**
- Create: `PawPilotPro/portal/src/screens/booking/BookingFlow.tsx`
- Create: `PawPilotPro/portal/src/screens/booking/StepService.tsx`
- Create: `PawPilotPro/portal/src/screens/booking/StepPets.tsx`
- Create: `PawPilotPro/portal/src/screens/booking/StepDates.tsx`
- Create: `PawPilotPro/portal/src/screens/booking/StepReview.tsx`
- Modify: `PawPilotPro/portal/src/router.tsx`

- [ ] **Step 1: `BookingFlow.tsx`**

```tsx
import { useNavigate, useSearchParams } from "react-router-dom";
import { StepService } from "./StepService";
import { StepPets } from "./StepPets";
import { StepDates } from "./StepDates";
import { StepReview } from "./StepReview";

const STEPS = ["service", "pets", "dates", "review"] as const;
type Step = typeof STEPS[number];

export function BookingFlow() {
  const [params, setParams] = useSearchParams();
  const nav = useNavigate();
  const step = (params.get("step") as Step) ?? "service";
  const idx = STEPS.indexOf(step);
  const setStep = (s: Step) => setParams({ step: s });

  return (
    <div className="min-h-screen bg-white dark:bg-neutral-950">
      <header className="sticky top-0 px-5 py-3 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between bg-white/95 dark:bg-neutral-950/95 backdrop-blur" style={{ paddingTop: "calc(0.75rem + var(--safe-top))" }}>
        <button onClick={() => idx === 0 ? nav("/") : setStep(STEPS[idx - 1])} className="text-sm text-blue-600">{idx === 0 ? "Cancel" : "Back"}</button>
        <div className="text-xs text-neutral-500">Step {idx + 1} of {STEPS.length}</div>
        <span className="text-sm invisible">Cancel</span>
      </header>
      <div className="h-1 bg-neutral-200 dark:bg-neutral-800">
        <div className="h-full bg-blue-600 transition-[width] duration-300" style={{ width: `${((idx + 1) / STEPS.length) * 100}%` }} />
      </div>
      <main className="px-5 py-6 max-w-md mx-auto">
        {step === "service" && <StepService onNext={() => setStep("pets")} />}
        {step === "pets"    && <StepPets onNext={() => setStep("dates")} />}
        {step === "dates"   && <StepDates onNext={() => setStep("review")} />}
        {step === "review"  && <StepReview />}
      </main>
    </div>
  );
}
```

- [ ] **Step 2: `StepService.tsx`**

```tsx
import { useBookingDraftStore } from "@/stores/bookingDraftStore";
import type { Service } from "@shared/types/booking";

const SERVICES: { id: Service; title: string; subtitle: string; emoji: string }[] = [
  { id: "daycare",    title: "Daycare",    subtitle: "Drop-off & pick-up the same day", emoji: "☀️" },
  { id: "grooming",   title: "Grooming",   subtitle: "Bath, full groom, nail trim",     emoji: "✂️" },
  { id: "overnights", title: "Overnights", subtitle: "Multi-night boarding",            emoji: "🌙" },
  { id: "transport",  title: "Transport",  subtitle: "Pickup / drop-off add-on",        emoji: "🚐" },
];

export function StepService({ onNext }: { onNext: () => void }) {
  const { service, setService } = useBookingDraftStore();
  return (
    <>
      <h1 className="text-2xl font-semibold mb-1">What are we booking?</h1>
      <p className="text-sm text-neutral-500 mb-6">Pick one service to start.</p>
      <ul className="grid grid-cols-1 gap-3">
        {SERVICES.map(s => (
          <li key={s.id}>
            <button onClick={() => { setService(s.id); onNext(); }}
              className={`w-full text-left p-4 rounded-2xl border-2 transition-colors ${
                service === s.id ? "border-blue-600 bg-blue-50 dark:bg-blue-950/30" : "border-neutral-200 dark:border-neutral-800"
              }`}>
              <div className="flex items-center gap-3">
                <span className="text-2xl">{s.emoji}</span>
                <div>
                  <p className="font-semibold">{s.title}</p>
                  <p className="text-xs text-neutral-500">{s.subtitle}</p>
                </div>
              </div>
            </button>
          </li>
        ))}
      </ul>
    </>
  );
}
```

- [ ] **Step 3: `StepPets.tsx`**

```tsx
import { useBookingDraftStore } from "@/stores/bookingDraftStore";
import { usePortalQuery } from "@/hooks/usePortalQuery";
import type { Pet } from "@shared/types/pet";

export function StepPets({ onNext }: { onNext: () => void }) {
  const { service, petIds, setPetIds } = useBookingDraftStore();
  const { data, isLoading } = usePortalQuery<{ pets: Pet[] }>(["portal", "pets"], "/portal/pets");
  const multi = service === "daycare" || service === "overnights";

  function toggle(id: string) {
    if (multi) setPetIds(petIds.includes(id) ? petIds.filter(p => p !== id) : [...petIds, id]);
    else setPetIds([id]);
  }

  if (isLoading || !data) return <p className="text-sm text-neutral-500">Loading pets…</p>;

  return (
    <>
      <h1 className="text-2xl font-semibold mb-1">{multi ? "Which pets?" : "Which pet?"}</h1>
      <p className="text-sm text-neutral-500 mb-6">{multi ? "Pick one or more." : "Pick one."}</p>
      <ul className="space-y-2 mb-6">
        {data.pets.map(p => {
          const selected = petIds.includes(p.id);
          return (
            <li key={p.id}>
              <button onClick={() => toggle(p.id)}
                className={`w-full p-3 rounded-2xl border-2 flex items-center gap-3 ${selected ? "border-blue-600 bg-blue-50 dark:bg-blue-950/30" : "border-neutral-200 dark:border-neutral-800"}`}>
                {p.photoUrl
                  ? <img src={p.photoUrl} alt="" className="size-12 rounded-xl object-cover" />
                  : <div className="size-12 rounded-xl bg-neutral-200 grid place-items-center">🐶</div>}
                <div className="flex-1 text-left">
                  <p className="font-medium">{p.name}</p>
                  <p className="text-xs text-neutral-500">{p.breed}</p>
                </div>
                {selected && <span className="text-blue-600">✓</span>}
              </button>
            </li>
          );
        })}
      </ul>
      <button disabled={petIds.length === 0} onClick={onNext}
        className="w-full h-12 rounded-xl bg-blue-600 text-white font-semibold disabled:opacity-50">
        Continue
      </button>
    </>
  );
}
```

- [ ] **Step 4: `StepDates.tsx`**

```tsx
import { useState } from "react";
import { useBookingDraftStore } from "@/stores/bookingDraftStore";
import { usePortalQuery } from "@/hooks/usePortalQuery";

export function StepDates({ onNext }: { onNext: () => void }) {
  const { service, startAt, endAt, setDates } = useBookingDraftStore();
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const needsSlot = service === "grooming";

  const { data } = usePortalQuery<{ slots: { startAt: string; endAt: string; available: boolean }[] }>(
    ["portal", "availability", service, date],
    `/portal/availability?service=${service}&date=${date}`,
    { enabled: needsSlot },
  );

  function handleDaycare() {
    const start = new Date(`${date}T08:00:00`); const end = new Date(`${date}T17:00:00`);
    setDates(start.toISOString(), end.toISOString()); onNext();
  }
  function handleOvernightsEnd(endDate: string) {
    const start = new Date(`${date}T17:00:00`); const end = new Date(`${endDate}T08:00:00`);
    if (end <= start) return;
    setDates(start.toISOString(), end.toISOString()); onNext();
  }
  function handleSlot(slot: { startAt: string; endAt: string }) { setDates(slot.startAt, slot.endAt); onNext(); }
  function handleTransport() {
    const start = new Date(`${date}T07:00:00`); const end = new Date(`${date}T09:00:00`);
    setDates(start.toISOString(), end.toISOString()); onNext();
  }

  return (
    <>
      <h1 className="text-2xl font-semibold mb-1">When?</h1>
      <p className="text-sm text-neutral-500 mb-6">Pick a date.</p>
      <label className="block mb-4">
        <span className="block text-xs uppercase tracking-widest text-neutral-500 mb-1">Date</span>
        <input type="date" value={date} onChange={e => setDate(e.target.value)} min={new Date().toISOString().slice(0, 10)}
               className="w-full h-12 px-3 rounded-xl border border-neutral-200 bg-white" />
      </label>

      {service === "daycare" && (
        <button onClick={handleDaycare} className="w-full h-12 rounded-xl bg-blue-600 text-white font-semibold">Continue (8:30–17:00)</button>
      )}

      {service === "overnights" && (
        <>
          <label className="block mb-4">
            <span className="block text-xs uppercase tracking-widest text-neutral-500 mb-1">Check-out date</span>
            <input type="date" min={date} onChange={e => handleOvernightsEnd(e.target.value)} className="w-full h-12 px-3 rounded-xl border border-neutral-200 bg-white" />
          </label>
          {startAt && endAt && <p className="text-sm text-neutral-500">{new Date(startAt).toLocaleDateString()} → {new Date(endAt).toLocaleDateString()}</p>}
        </>
      )}

      {service === "grooming" && (
        <>
          <p className="text-sm text-neutral-500 mb-2">Choose a slot</p>
          {!data ? <p className="text-sm">Loading slots…</p> :
            <ul className="grid grid-cols-3 gap-2">
              {data.slots.map(s => (
                <li key={s.startAt}>
                  <button disabled={!s.available} onClick={() => handleSlot(s)}
                    className={`w-full h-12 rounded-xl text-sm font-medium ${s.available ? "border border-neutral-200" : "bg-neutral-100 text-neutral-400 line-through"}`}>
                    {new Date(s.startAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </button>
                </li>
              ))}
            </ul>
          }
        </>
      )}

      {service === "transport" && (
        <button onClick={handleTransport} className="w-full h-12 rounded-xl bg-blue-600 text-white font-semibold">Continue (07:00–09:00 window)</button>
      )}
    </>
  );
}
```

- [ ] **Step 5: `StepReview.tsx`**

```tsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useBookingDraftStore } from "@/stores/bookingDraftStore";
import { getPortalApi } from "@/lib/api";
import { useQueryClient } from "@tanstack/react-query";

const SERVICE_LABEL: Record<string, string> = { daycare: "Daycare", grooming: "Grooming", overnights: "Overnights", transport: "Transport" };

export function StepReview() {
  const draft = useBookingDraftStore();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const nav = useNavigate();
  const qc = useQueryClient();

  async function submit() {
    if (!draft.isComplete()) return;
    setBusy(true); setErr(null);
    try {
      const r = await getPortalApi().post<{ booking: { id: string } }>("/portal/bookings", {
        service: draft.service, petIds: draft.petIds,
        startAt: draft.startAt, endAt: draft.endAt,
        notes: draft.notes || null, requestId: draft.requestId,
      });
      toast.success("Request sent");
      qc.invalidateQueries({ queryKey: ["portal", "home"] });
      qc.invalidateQueries({ queryKey: ["portal", "bookings"] });
      draft.reset();
      nav(`/bookings/${r.booking.id}`, { replace: true });
    } catch (e: any) {
      setErr(e?.message ?? "Submit failed");
    } finally { setBusy(false); }
  }

  return (
    <>
      <h1 className="text-2xl font-semibold mb-1">Review & submit</h1>
      <p className="text-sm text-neutral-500 mb-6">We'll send this to the daycare for approval.</p>
      <dl className="rounded-2xl border border-neutral-200 dark:border-neutral-800 p-4 text-sm space-y-2 mb-4">
        <div className="flex justify-between"><dt className="text-neutral-500">Service</dt><dd className="font-medium">{SERVICE_LABEL[draft.service!]}</dd></div>
        <div className="flex justify-between"><dt className="text-neutral-500">Pets</dt><dd className="font-medium">{draft.petIds.length}</dd></div>
        <div className="flex justify-between"><dt className="text-neutral-500">Start</dt><dd className="font-medium">{new Date(draft.startAt!).toLocaleString()}</dd></div>
        <div className="flex justify-between"><dt className="text-neutral-500">End</dt><dd className="font-medium">{new Date(draft.endAt!).toLocaleString()}</dd></div>
      </dl>
      <label className="block mb-6">
        <span className="block text-xs uppercase tracking-widest text-neutral-500 mb-1">Notes (optional)</span>
        <textarea value={draft.notes} onChange={e => draft.setNotes(e.target.value)} rows={3} className="w-full p-3 rounded-xl border border-neutral-200 text-sm" />
      </label>
      {err && <p className="text-sm text-red-600 mb-3">{err}</p>}
      <button disabled={busy} onClick={submit} className="w-full h-12 rounded-xl bg-blue-600 text-white font-semibold disabled:opacity-50">
        {busy ? "Sending…" : "Submit request"}
      </button>
    </>
  );
}
```

- [ ] **Step 6: Add `/book` to router**

```tsx
{ path: "/book", element: <BookingFlow /> },
```

- [ ] **Step 7: Commit**

```bash
git add PawPilotPro/portal/src/screens/booking/ PawPilotPro/portal/src/router.tsx
git commit -m "feat(portal): 4-step booking wizard"
```

---

### Task 5.6: Portal — Bookings list + detail + cancel + realtime subscription

**Files:**
- Create: `PawPilotPro/portal/src/screens/BookingDetailScreen.tsx`
- Create: `PawPilotPro/portal/src/hooks/usePortalRealtime.ts`
- Modify: `PawPilotPro/portal/src/screens/BookingsScreen.tsx` (replace Phase 3 stub)
- Modify: `PawPilotPro/portal/src/router.tsx` — add `/bookings/:id`

- [ ] **Step 1: Realtime hook**

```ts
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getSupabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";

export function usePortalRealtime() {
  const { session, status } = useAuth();
  const qc = useQueryClient();
  useEffect(() => {
    if (status !== "authed" || !session) return;
    const meta = session.user.user_metadata as { tenantId?: string; customerId?: string };
    if (!meta.tenantId || !meta.customerId) return;
    const ch = getSupabase().channel(`sync:${meta.tenantId}:portal:${meta.customerId}`);
    ch.on("broadcast", { event: "booking.status_changed" }, () => {
      qc.invalidateQueries({ queryKey: ["portal", "bookings"] });
      qc.invalidateQueries({ queryKey: ["portal", "home"] });
    });
    ch.on("broadcast", { event: "notification.new" }, () => {
      qc.invalidateQueries({ queryKey: ["portal", "notifications"] });
    });
    ch.subscribe();
    return () => { getSupabase().removeChannel(ch); };
  }, [status, session, qc]);
}
```

Add `usePortalRealtime()` call inside `AppShell.tsx` so it runs whenever the authed shell is mounted.

- [ ] **Step 2: Replace `BookingsScreen.tsx`**

```tsx
import { useState } from "react";
import { Link } from "react-router-dom";
import { usePortalQuery } from "@/hooks/usePortalQuery";
import { Skeleton } from "@/components/Skeleton";
import { EmptyState } from "@/components/EmptyState";
import { StatusBadge } from "@/components/StatusBadge";
import type { Booking } from "@shared/types/booking";

const SERVICE_LABEL: Record<string, string> = { daycare: "Daycare", grooming: "Grooming", overnights: "Overnights", transport: "Transport" };

export function BookingsScreen() {
  const [scope, setScope] = useState<"upcoming" | "past">("upcoming");
  const { data, isLoading } = usePortalQuery<{ bookings: Booking[] }>(["portal", "bookings", scope], `/portal/bookings?scope=${scope}`);

  return (
    <main className="px-5 pt-6 max-w-md mx-auto">
      <h1 className="text-xl font-semibold mb-4">Bookings</h1>
      <div className="inline-flex bg-neutral-100 dark:bg-neutral-900 rounded-full p-1 mb-4 text-sm">
        {(["upcoming", "past"] as const).map(s => (
          <button key={s} onClick={() => setScope(s)}
            className={`px-4 py-1.5 rounded-full font-medium capitalize ${scope === s ? "bg-white dark:bg-neutral-950 shadow-sm" : "text-neutral-500"}`}>
            {s}
          </button>
        ))}
      </div>
      {isLoading
        ? <div className="space-y-2"><Skeleton className="h-16 rounded-2xl" /><Skeleton className="h-16 rounded-2xl" /></div>
        : data!.bookings.length === 0
          ? <EmptyState title={scope === "upcoming" ? "No upcoming bookings" : "No past bookings"} body={scope === "upcoming" ? "Tap Home → Book a service to get started." : "Once you've completed bookings, they'll appear here."} />
          : <ul className="space-y-2">
              {data!.bookings.map(b => (
                <li key={b.id}>
                  <Link to={`/bookings/${b.id}`} className="block bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-4">
                    <div className="flex items-center justify-between mb-1">
                      <h3 className="font-medium text-sm">{SERVICE_LABEL[b.service]}</h3>
                      <StatusBadge status={b.status} />
                    </div>
                    <p className="text-xs text-neutral-500">{new Date(b.startAt).toLocaleString()} — {new Date(b.endAt).toLocaleString()}</p>
                  </Link>
                </li>
              ))}
            </ul>
      }
    </main>
  );
}
```

- [ ] **Step 3: `BookingDetailScreen.tsx`**

```tsx
import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { usePortalQuery } from "@/hooks/usePortalQuery";
import { Skeleton } from "@/components/Skeleton";
import { StatusBadge } from "@/components/StatusBadge";
import { getPortalApi } from "@/lib/api";
import type { Booking } from "@shared/types/booking";

const SERVICE_LABEL: Record<string, string> = { daycare: "Daycare", grooming: "Grooming", overnights: "Overnights", transport: "Transport" };

export function BookingDetailScreen() {
  const { id } = useParams();
  const { data, isLoading } = usePortalQuery<{ booking: Booking }>(["portal", "bookings", "detail", id], `/portal/bookings/${id}`);
  const [busy, setBusy] = useState(false);
  const qc = useQueryClient();

  async function cancel() {
    if (!confirm("Cancel this request?")) return;
    setBusy(true);
    try {
      await getPortalApi().post(`/portal/bookings/${id}/cancel`);
      toast.success("Cancelled");
      qc.invalidateQueries({ queryKey: ["portal", "bookings"] });
      qc.invalidateQueries({ queryKey: ["portal", "bookings", "detail", id] });
    } catch (e: any) { toast.error(e?.message ?? "Failed"); } finally { setBusy(false); }
  }

  if (isLoading || !data) return <main className="p-5"><Skeleton className="h-40" /></main>;
  const b = data.booking;

  return (
    <main className="px-5 pt-6 max-w-md mx-auto pb-12">
      <Link to="/bookings" className="text-sm text-blue-600 mb-3 inline-block">← All bookings</Link>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold">{SERVICE_LABEL[b.service]}</h1>
        <StatusBadge status={b.status} />
      </div>
      <dl className="rounded-2xl border border-neutral-200 dark:border-neutral-800 p-4 text-sm space-y-2 mb-4">
        <div className="flex justify-between"><dt className="text-neutral-500">Start</dt><dd>{new Date(b.startAt).toLocaleString()}</dd></div>
        <div className="flex justify-between"><dt className="text-neutral-500">End</dt><dd>{new Date(b.endAt).toLocaleString()}</dd></div>
        <div className="flex justify-between"><dt className="text-neutral-500">Pets</dt><dd>{b.petIds.length}</dd></div>
        {b.notes && <div className="pt-2 border-t border-neutral-200 dark:border-neutral-800"><dt className="text-neutral-500 mb-1">Notes</dt><dd>{b.notes}</dd></div>}
        {b.status === "declined" && b.declineReason && (
          <div className="pt-2 border-t border-neutral-200 dark:border-neutral-800">
            <dt className="text-neutral-500 mb-1">Reason for decline</dt>
            <dd className="text-rose-700">{b.declineReason}</dd>
          </div>
        )}
      </dl>
      {b.status === "pending" && (
        <button onClick={cancel} disabled={busy} className="w-full h-12 rounded-xl border border-rose-200 text-rose-700 font-medium disabled:opacity-50">
          {busy ? "Cancelling…" : "Cancel request"}
        </button>
      )}
    </main>
  );
}
```

- [ ] **Step 4: Add route**

```tsx
{ path: "/bookings/:id", element: <BookingDetailScreen /> },
```

- [ ] **Step 5: Commit**

```bash
git add PawPilotPro/portal/src/screens/BookingsScreen.tsx PawPilotPro/portal/src/screens/BookingDetailScreen.tsx PawPilotPro/portal/src/hooks/usePortalRealtime.ts PawPilotPro/portal/src/router.tsx PawPilotPro/portal/src/components/AppShell.tsx
git commit -m "feat(portal): bookings list/detail + realtime subscription"
```

---

### Task 5.7: Staff app — Pending Requests module

**Files:**
- Create: `PawPilotPro/project/src/app/modules/portal-requests/api.ts`
- Create: `PawPilotPro/project/src/app/modules/portal-requests/PendingRequestRow.tsx`
- Create: `PawPilotPro/project/src/app/modules/portal-requests/PendingRequestsModule.tsx`
- Modify: staff app route registry

- [ ] **Step 1: `api.ts`**

```ts
import { callApi } from "@/utils/api";
export interface PendingRequest {
  id: string; service: string; customerId: string; petIds: string[];
  startAt: string; endAt: string; notes: string | null; createdAt: string; status: string;
}
export const fetchPending = () => callApi<{ requests: PendingRequest[] }>("/portal-admin/pending-requests");
export const approveBooking = (id: string) => callApi(`/portal-admin/bookings/${id}/approve`, { method: "POST" });
export const declineBooking = (id: string, reason: string) => callApi(`/portal-admin/bookings/${id}/decline`, { method: "POST", body: JSON.stringify({ reason }) });
```

- [ ] **Step 2: `PendingRequestRow.tsx`**

```tsx
import { useState } from "react";
import { toast } from "sonner";
import { approveBooking, declineBooking, PendingRequest } from "./api";

const SERVICE_LABEL: Record<string, string> = { daycare: "Daycare", grooming: "Grooming", overnights: "Overnights", transport: "Transport" };

export function PendingRequestRow({ r, onResolved }: { r: PendingRequest; onResolved: () => void }) {
  const [declining, setDeclining] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const ageHours = (Date.now() - new Date(r.createdAt).getTime()) / 3600_000;
  const stale = ageHours > 4;
  return (
    <div className="border border-neutral-200 rounded-xl p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-medium">{SERVICE_LABEL[r.service]} — {new Date(r.startAt).toLocaleString()}</p>
          <p className="text-xs text-neutral-500">{r.petIds.length} pet(s) · submitted {Math.round(ageHours * 10) / 10}h ago{stale && <span className="text-rose-600 font-semibold"> · STALE</span>}</p>
          {r.notes && <p className="text-sm mt-2 text-neutral-700 italic">"{r.notes}"</p>}
        </div>
        <div className="flex gap-2">
          <button disabled={busy} onClick={async () => { setBusy(true); try { await approveBooking(r.id); toast.success("Approved"); onResolved(); } catch (e: any) { toast.error(e?.message); } finally { setBusy(false); } }}
            className="h-9 px-4 rounded bg-emerald-600 text-white text-sm font-medium disabled:opacity-50">Approve</button>
          <button onClick={() => setDeclining(true)} className="h-9 px-4 rounded border border-rose-300 text-rose-700 text-sm font-medium">Decline…</button>
        </div>
      </div>
      {declining && (
        <div className="mt-3">
          <textarea value={reason} onChange={e => setReason(e.target.value)} placeholder="Reason (visible to owner)" rows={2} className="w-full p-2 rounded border text-sm" />
          <div className="flex gap-2 mt-1">
            <button disabled={busy || reason.length < 3} onClick={async () => { setBusy(true); try { await declineBooking(r.id, reason); toast.success("Declined"); onResolved(); } catch (e: any) { toast.error(e?.message); } finally { setBusy(false); } }}
              className="h-9 px-4 rounded bg-rose-600 text-white text-sm disabled:opacity-50">Confirm decline</button>
            <button onClick={() => setDeclining(false)} className="h-9 px-4 rounded border text-sm">Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: `PendingRequestsModule.tsx`**

```tsx
import { useEffect, useState } from "react";
import { fetchPending, PendingRequest } from "./api";
import { PendingRequestRow } from "./PendingRequestRow";

export function PendingRequestsModule() {
  const [requests, setRequests] = useState<PendingRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const load = () => { setLoading(true); fetchPending().then(r => setRequests(r.requests)).finally(() => setLoading(false)); };
  useEffect(load, []);
  return (
    <main className="p-6 max-w-5xl mx-auto">
      <header className="mb-4">
        <h1 className="text-xl font-semibold">Pending Requests</h1>
        <p className="text-sm text-neutral-500">{requests.length} awaiting approval</p>
      </header>
      {loading ? <p className="text-sm text-neutral-500">Loading…</p> :
       requests.length === 0 ? <p className="text-sm text-neutral-500">Inbox empty.</p> :
       <ul className="space-y-3">{requests.map(r => <li key={r.id}><PendingRequestRow r={r} onResolved={load} /></li>)}</ul>}
    </main>
  );
}
```

- [ ] **Step 4: Register in staff route table (path `/pending-requests`, permission `bookings.update`)**

- [ ] **Step 5: Commit (phase tag comes after Task 5.8)**

```bash
git add PawPilotPro/project/src/app/modules/portal-requests/ PawPilotPro/project/src/app/App.tsx
git commit -m "feat(staff): pending requests inbox"
```

---

### Task 5.8: Settings → Portal tenant configuration

Spec §8 item 5: tenant-level business rules and brand assets. The booking endpoint already reads `tenant.portal.minAdvanceHours[service]` (Task 5.2). This task ships the staff UI + backend writes so the values aren't hard-coded.

**Files:**
- Create: `PawPilotPro/project/supabase/functions/server/portal_settings_routes.ts`
- Create: `PawPilotPro/project/src/app/modules/settings/PortalSettingsPanel.tsx`
- Modify: staff Settings page to add the panel
- Modify: `PawPilotPro/project/supabase/functions/server/index.tsx` — mount

- [ ] **Step 1: Backend route**

```ts
import { Hono } from "npm:hono";
import { z } from "npm:zod";
import * as kv from "./kv_store.tsx";
import { requireAuth, requirePermission } from "./settings_rbac.ts";

const settings = new Hono();

const portalConfigSchema = z.object({
  enabledServices: z.array(z.enum(["daycare", "grooming", "overnights", "transport"])),
  minAdvanceHours: z.object({
    daycare: z.number().int().min(0).max(720),
    grooming: z.number().int().min(0).max(720),
    overnights: z.number().int().min(0).max(720),
    transport: z.number().int().min(0).max(720),
  }),
  maxPetsPerBooking: z.number().int().min(1).max(10),
  blackoutDates: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
  emailTemplates: z.object({
    inviteSubject: z.string().max(200).optional(),
    bookingReceivedSubject: z.string().max(200).optional(),
    bookingConfirmedSubject: z.string().max(200).optional(),
  }).optional(),
  brand: z.object({
    logoUrl: z.string().url().nullable(),
    accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).nullable(),
  }).optional(),
});

settings.get("/portal-admin/settings", requireAuth, requirePermission("settings", "view"), async (c) => {
  const user = c.get("user");
  const tenant = (await kv.get(`tenants:${user.tenantId}`)) as any;
  return c.json({ portal: tenant?.portal ?? defaultPortalConfig() });
});

settings.put("/portal-admin/settings", requireAuth, requirePermission("settings", "update"), async (c) => {
  const user = c.get("user");
  const body = await c.req.json().catch(() => null);
  const parsed = portalConfigSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: parsed.error.format() }, 400);
  const tenant = (await kv.get(`tenants:${user.tenantId}`)) as any;
  await kv.set(`tenants:${user.tenantId}`, { ...tenant, portal: parsed.data });
  return c.json({ ok: true, portal: parsed.data });
});

function defaultPortalConfig() {
  return {
    enabledServices: ["daycare", "grooming", "overnights", "transport"],
    minAdvanceHours: { daycare: 12, grooming: 24, overnights: 48, transport: 12 },
    maxPetsPerBooking: 4,
    blackoutDates: [],
  };
}

export default settings;
```

Mount in `index.tsx`:

```ts
import portalSettings from "./portal_settings_routes.ts";
app.route("/", portalSettings);
```

Update the `POST /portal/bookings` validator (Task 5.2) to also check `tenant.portal.enabledServices.includes(data.service)` (return 409 if disabled), `data.petIds.length <= tenant.portal.maxPetsPerBooking`, and `!tenant.portal.blackoutDates.includes(data.startAt.slice(0,10))`.

- [ ] **Step 2: Staff panel**

```tsx
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { callApi } from "@/utils/api";

interface PortalConfig {
  enabledServices: ("daycare" | "grooming" | "overnights" | "transport")[];
  minAdvanceHours: Record<"daycare" | "grooming" | "overnights" | "transport", number>;
  maxPetsPerBooking: number;
  blackoutDates: string[];
  emailTemplates?: { inviteSubject?: string; bookingReceivedSubject?: string; bookingConfirmedSubject?: string };
  brand?: { logoUrl: string | null; accentColor: string | null };
}

const SERVICES = ["daycare", "grooming", "overnights", "transport"] as const;

export function PortalSettingsPanel() {
  const [cfg, setCfg] = useState<PortalConfig | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { callApi<{ portal: PortalConfig }>("/portal-admin/settings").then(r => setCfg(r.portal)); }, []);

  async function save() {
    if (!cfg) return;
    setBusy(true);
    try { await callApi("/portal-admin/settings", { method: "PUT", body: JSON.stringify(cfg) }); toast.success("Saved"); }
    catch (e: any) { toast.error(e?.message ?? "Failed"); } finally { setBusy(false); }
  }

  if (!cfg) return <p className="text-sm text-neutral-500">Loading…</p>;

  return (
    <div className="space-y-6 max-w-2xl">
      <section>
        <h3 className="text-sm font-semibold mb-2">Services owners can book</h3>
        <div className="grid grid-cols-2 gap-2">
          {SERVICES.map(s => (
            <label key={s} className="flex items-center gap-2 text-sm capitalize">
              <input type="checkbox" checked={cfg.enabledServices.includes(s)}
                onChange={e => setCfg({ ...cfg, enabledServices: e.target.checked ? [...cfg.enabledServices, s] : cfg.enabledServices.filter(x => x !== s) })} />
              {s}
            </label>
          ))}
        </div>
      </section>

      <section>
        <h3 className="text-sm font-semibold mb-2">Minimum advance notice (hours)</h3>
        <div className="grid grid-cols-2 gap-3">
          {SERVICES.map(s => (
            <label key={s} className="text-sm">
              <span className="block text-xs text-neutral-500 capitalize mb-1">{s}</span>
              <input type="number" min={0} max={720} value={cfg.minAdvanceHours[s]}
                onChange={e => setCfg({ ...cfg, minAdvanceHours: { ...cfg.minAdvanceHours, [s]: Number(e.target.value) } })}
                className="h-9 w-24 px-2 rounded border" />
            </label>
          ))}
        </div>
      </section>

      <section>
        <h3 className="text-sm font-semibold mb-2">Max pets per booking</h3>
        <input type="number" min={1} max={10} value={cfg.maxPetsPerBooking}
          onChange={e => setCfg({ ...cfg, maxPetsPerBooking: Number(e.target.value) })} className="h-9 w-24 px-2 rounded border" />
      </section>

      <section>
        <h3 className="text-sm font-semibold mb-2">Blackout dates (one per line, YYYY-MM-DD)</h3>
        <textarea rows={4} value={cfg.blackoutDates.join("\n")}
          onChange={e => setCfg({ ...cfg, blackoutDates: e.target.value.split("\n").map(s => s.trim()).filter(s => /^\d{4}-\d{2}-\d{2}$/.test(s)) })}
          className="w-full p-2 rounded border text-sm font-mono" />
      </section>

      <section>
        <h3 className="text-sm font-semibold mb-2">Brand</h3>
        <label className="block text-sm mb-2">
          <span className="block text-xs text-neutral-500 mb-1">Logo URL</span>
          <input type="url" value={cfg.brand?.logoUrl ?? ""} onChange={e => setCfg({ ...cfg, brand: { ...(cfg.brand ?? { logoUrl: null, accentColor: null }), logoUrl: e.target.value || null } })}
            className="h-9 w-full px-2 rounded border" placeholder="https://…" />
        </label>
        <label className="block text-sm">
          <span className="block text-xs text-neutral-500 mb-1">Accent color (hex)</span>
          <input type="text" value={cfg.brand?.accentColor ?? ""} onChange={e => setCfg({ ...cfg, brand: { ...(cfg.brand ?? { logoUrl: null, accentColor: null }), accentColor: e.target.value || null } })}
            className="h-9 w-32 px-2 rounded border font-mono" placeholder="#1a73e8" />
        </label>
      </section>

      <button onClick={save} disabled={busy} className="h-10 px-5 rounded bg-blue-600 text-white text-sm font-medium disabled:opacity-50">
        {busy ? "Saving…" : "Save settings"}
      </button>
    </div>
  );
}
```

- [ ] **Step 3: Mount the panel** in the staff Settings page (locate via `grep -n "settings/" PawPilotPro/project/src/app/modules/settings/*.tsx | head`). Add a tab labeled "Portal".

- [ ] **Step 4: Commit + phase tag**

```bash
git add PawPilotPro/project/supabase/functions/server/portal_settings_routes.ts PawPilotPro/project/supabase/functions/server/index.tsx PawPilotPro/project/supabase/functions/server/portal_bookings_routes.ts PawPilotPro/project/src/app/modules/settings/PortalSettingsPanel.tsx
git commit -m "feat(staff): portal settings panel (services, advance notice, blackout, brand)"
git tag portal-v1-phase-5-complete
```

---

**Phase 5 done.** End-to-end:

1. Owner taps `+ Book a service` on Home → 4-step wizard
2. Submits → lands on booking detail showing Pending
3. Staff opens Pending Requests → sees the request → Approve
4. Owner's app updates the badge to Confirmed *without reload* (realtime)
5. Decline path: owner sees the reason on booking detail

Confirm before Phase 6.

---

# PHASE 6 — Notifications + email

**Goal:** Wire the in-app notification feed (bell + drawer) and round-trip transactional emails for all events. Owners can manage notification preferences from Account.

**Files this phase creates:**
- `PawPilotPro/project/supabase/functions/server/portal_notifications_routes.ts`
- `PawPilotPro/project/supabase/functions/server/portal_account_routes.ts`
- `PawPilotPro/project/supabase/functions/server/lib/email_templates/booking_received.ts`
- `PawPilotPro/project/supabase/functions/server/lib/email_templates/booking_confirmed.ts`
- `PawPilotPro/project/supabase/functions/server/lib/email_templates/booking_declined.ts`
- `PawPilotPro/project/supabase/functions/server/lib/email_templates/vax_approved.ts`
- `PawPilotPro/project/supabase/functions/server/lib/email_templates/vax_rejected.ts`
- `PawPilotPro/project/supabase/functions/server/lib/email_templates/vax_expiring.ts`
- `PawPilotPro/project/supabase/functions/server/lib/notify.ts` — single helper that writes notification + fires email
- `PawPilotPro/portal/src/components/NotificationBell.tsx`
- `PawPilotPro/portal/src/components/NotificationDrawer.tsx`
- `PawPilotPro/portal/src/hooks/useNotifications.ts`
- `PawPilotPro/project/supabase/functions/vax-expiring-cron/index.ts` — scheduled job

**Files this phase modifies:**
- `portal_bookings_routes.ts`, `portal_pending_requests_routes.ts`, `portal_vax_routes.ts` — replace inline notification + email stubs with `notify()` calls
- `HomeScreen.tsx` — wire the bell to drawer
- `AccountScreen.tsx` — add notification preferences

---

### Task 6.1: Email templates + `notify()` helper

**Files:**
- Create: email templates listed above
- Create: `lib/notify.ts`

- [ ] **Step 1: One template — `booking_confirmed.ts` (others follow the same shape)**

```ts
export function bookingConfirmedEmail(args: { ownerName: string; tenantName: string; service: string; startAt: string; bookingUrl: string }) {
  const subject = `Confirmed — ${args.service} on ${new Date(args.startAt).toLocaleDateString()}`;
  const html = `
    <div style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;max-width:480px;margin:0 auto;padding:24px;">
      <p style="font-size:12px;color:#888;letter-spacing:0.08em;text-transform:uppercase;margin:0 0 8px;">${args.tenantName}</p>
      <h1 style="font-size:22px;color:#111;margin:0 0 12px;">You're confirmed, ${args.ownerName} 🎉</h1>
      <p style="color:#444;line-height:1.5;">Your ${args.service} booking on <strong>${new Date(args.startAt).toLocaleString()}</strong> is confirmed.</p>
      <p style="margin:20px 0;"><a href="${args.bookingUrl}" style="background:#1a73e8;color:#fff;text-decoration:none;padding:12px 20px;border-radius:10px;font-weight:600;display:inline-block;">View booking</a></p>
    </div>`;
  return { subject, html, text: `Confirmed: ${args.service} on ${args.startAt}. View: ${args.bookingUrl}` };
}
```

Implement `booking_received.ts`, `booking_declined.ts` (with reason), `vax_approved.ts`, `vax_rejected.ts`, `vax_expiring.ts` following the same pattern. Keep tone friendly, mobile-readable, button-prominent.

- [ ] **Step 2: `notify.ts` — single helper**

```ts
import * as kv from "../kv_store.tsx";
import { getEmailSender } from "./email.ts";
import type { NotificationType } from "../../../shared/types/notification.ts";

export async function notify(args: {
  tenantId: string;
  customerId: string;
  type: NotificationType;
  payload: Record<string, unknown>;
  link: string | null;
  email?: { to: string; subject: string; html: string; text?: string };
}) {
  await kv.set(`notifications:${args.tenantId}:${args.customerId}:${crypto.randomUUID()}`, {
    tenantId: args.tenantId, customerId: args.customerId,
    type: args.type, payload: args.payload, link: args.link,
    readAt: null, createdAt: new Date().toISOString(),
  });
  if (args.email) {
    // Check customer notification prefs
    const link = (await kv.get(`portal_users:${args.tenantId}:${args.customerId}`)) as any;
    const prefs = link?.notificationPrefs ?? { booking: true, vax: true };
    const category = args.type.startsWith("booking") ? "booking" : args.type.startsWith("vax") ? "vax" : "other";
    if (prefs[category] === false) return;
    try { await getEmailSender().send(args.email); } catch (e) { console.error("email failed", e); }
  }
}
```

- [ ] **Step 3: Refactor existing routes to use `notify()`**

In `portal_pending_requests_routes.ts` `approve` handler, replace the inline KV write + (missing) email with:

```ts
const customer = (await kv.get(`customers:${user.tenantId}:${b.customerId}`)) as any;
const tenant = (await kv.get(`tenants:${user.tenantId}`)) as any;
const portalBase = Deno.env.get("PORTAL_BASE_URL") ?? "https://portal.pawpilotpro.app";
await notify({
  tenantId: user.tenantId, customerId: b.customerId,
  type: "booking.confirmed",
  payload: { bookingId: id, service: b.service, startAt: b.startAt },
  link: `/bookings/${id}`,
  email: {
    to: customer.primaryEmail,
    ...bookingConfirmedEmail({
      ownerName: customer.primaryContactName.split(" ")[0],
      tenantName: tenant?.name ?? "PawPilotPro",
      service: b.service, startAt: b.startAt,
      bookingUrl: `${portalBase}/bookings/${id}`,
    }),
  },
});
```

Apply equivalent refactors to `decline`, `bookings POST`, `vax approve`, `vax reject`.

- [ ] **Step 4: Commit**

```bash
git add PawPilotPro/project/supabase/functions/server/lib/ PawPilotPro/project/supabase/functions/server/portal_bookings_routes.ts PawPilotPro/project/supabase/functions/server/portal_pending_requests_routes.ts PawPilotPro/project/supabase/functions/server/portal_vax_routes.ts
git commit -m "feat(server): notify() helper + transactional email templates"
```

---

### Task 6.2: Backend — `/portal/notifications` + `/portal/account`

**Files:**
- Create: `PawPilotPro/project/supabase/functions/server/portal_notifications_routes.ts`
- Create: `PawPilotPro/project/supabase/functions/server/portal_account_routes.ts`
- Modify: `index.tsx`

- [ ] **Step 1: Implement notifications routes**

```ts
import { Hono } from "npm:hono";
import * as kv from "./kv_store.tsx";
import { requirePortalUser } from "./portal_auth.ts";

const n = new Hono();

n.get("/portal/notifications", requirePortalUser, async (c) => {
  const u = c.get("portalUser");
  const all = (await kv.getAllByPrefix(`notifications:${u.tenantId}:${u.customerId}:`) as any[])
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 50);
  return c.json({ notifications: all });
});

n.post("/portal/notifications/:id/read", requirePortalUser, async (c) => {
  const u = c.get("portalUser");
  const id = c.req.param("id");
  const key = `notifications:${u.tenantId}:${u.customerId}:${id}`;
  const item = (await kv.get(key)) as any;
  if (!item) return c.json({ error: "Not found" }, 404);
  await kv.set(key, { ...item, readAt: new Date().toISOString() });
  return c.json({ ok: true });
});

n.post("/portal/notifications/read-all", requirePortalUser, async (c) => {
  const u = c.get("portalUser");
  const all = await kv.getAllByPrefix(`notifications:${u.tenantId}:${u.customerId}:`) as any[];
  const now = new Date().toISOString();
  await Promise.all(all.filter(x => !x.readAt).map(x =>
    kv.set(`notifications:${u.tenantId}:${u.customerId}:${x.id}`, { ...x, readAt: now })
  ));
  return c.json({ ok: true, marked: all.filter(x => !x.readAt).length });
});

export default n;
```

> **Important:** the notification helpers must write the synthetic `id` as both the key suffix *and* a field inside the value, so `getAllByPrefix` returns entries that can be looked up later. Update `notify()` in Task 6.1 step 2 to do this:
>
> ```ts
> const id = crypto.randomUUID();
> await kv.set(`notifications:${args.tenantId}:${args.customerId}:${id}`, {
>   id, /* …rest of payload */
> });
> ```
>
> Apply the same `id` field to the manual `kv.set` calls in Tasks 4.1 (`vax.approved` / `vax.rejected`) and 5.2 (`booking.received`) — they currently call `crypto.randomUUID()` inline and don't store it in the value. Update those at the same time as 6.1.

- [ ] **Step 2: Implement account routes**

```ts
import { Hono } from "npm:hono";
import { z } from "npm:zod";
import * as kv from "./kv_store.tsx";
import { requirePortalUser } from "./portal_auth.ts";

const account = new Hono();
const prefsSchema = z.object({
  notificationPrefs: z.object({
    booking: z.boolean(),
    vax: z.boolean(),
    marketing: z.boolean().optional(),
  }),
});

account.patch("/portal/account", requirePortalUser, async (c) => {
  const u = c.get("portalUser");
  const body = await c.req.json().catch(() => null);
  const parsed = prefsSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: parsed.error.format() }, 400);
  const link = (await kv.get(`portal_users:${u.tenantId}:${u.customerId}`)) as any;
  await kv.set(`portal_users:${u.tenantId}:${u.customerId}`, { ...link, notificationPrefs: parsed.data.notificationPrefs });
  return c.json({ ok: true });
});

account.get("/portal/account", requirePortalUser, async (c) => {
  const u = c.get("portalUser");
  const link = (await kv.get(`portal_users:${u.tenantId}:${u.customerId}`)) as any;
  const customer = (await kv.get(`customers:${u.tenantId}:${u.customerId}`)) as any;
  return c.json({
    profile: {
      name: customer?.primaryContactName,
      email: customer?.primaryEmail,
      phone: customer?.primaryPhone,
    },
    notificationPrefs: link?.notificationPrefs ?? { booking: true, vax: true, marketing: false },
  });
});

export default account;
```

- [ ] **Step 3: Mount + commit**

```ts
import portalNotifications from "./portal_notifications_routes.ts";
import portalAccount from "./portal_account_routes.ts";
app.route("/", portalNotifications);
app.route("/", portalAccount);
```

```bash
git add PawPilotPro/project/supabase/functions/server/portal_notifications_routes.ts PawPilotPro/project/supabase/functions/server/portal_account_routes.ts PawPilotPro/project/supabase/functions/server/index.tsx
git commit -m "feat(server): /portal/notifications + /portal/account endpoints"
```

---

### Task 6.3: Portal — Notification bell + drawer

**Files:**
- Create: `PawPilotPro/portal/src/hooks/useNotifications.ts`
- Create: `PawPilotPro/portal/src/components/NotificationBell.tsx`
- Create: `PawPilotPro/portal/src/components/NotificationDrawer.tsx`
- Modify: `PawPilotPro/portal/src/screens/HomeScreen.tsx` — replace bell button with `<NotificationBell />`

- [ ] **Step 1: `useNotifications.ts`**

```ts
import { usePortalQuery } from "./usePortalQuery";

export interface PortalNotification {
  id: string;
  type: string;
  payload: Record<string, unknown>;
  link: string | null;
  readAt: string | null;
  createdAt: string;
}

export function useNotifications() {
  return usePortalQuery<{ notifications: PortalNotification[] }>(["portal", "notifications"], "/portal/notifications", { staleTime: 10_000 });
}
```

- [ ] **Step 2: `NotificationBell.tsx`**

```tsx
import { useState } from "react";
import { Bell } from "lucide-react";
import { useNotifications } from "@/hooks/useNotifications";
import { NotificationDrawer } from "./NotificationDrawer";

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const { data } = useNotifications();
  const unread = data?.notifications.filter(n => !n.readAt).length ?? 0;
  return (
    <>
      <button onClick={() => setOpen(true)} className="relative size-10 grid place-items-center rounded-full bg-neutral-100 dark:bg-neutral-800" aria-label="Notifications">
        <Bell size={18} />
        {unread > 0 && <span className="absolute top-1 right-1 size-4 rounded-full bg-rose-600 text-white text-[10px] grid place-items-center">{unread > 9 ? "9+" : unread}</span>}
      </button>
      <NotificationDrawer open={open} onClose={() => setOpen(false)} />
    </>
  );
}
```

- [ ] **Step 3: `NotificationDrawer.tsx`**

```tsx
import { Link } from "react-router-dom";
import { useNotifications, PortalNotification } from "@/hooks/useNotifications";

const LABELS: Record<string, string> = {
  "booking.received":  "Booking request received",
  "booking.confirmed": "Booking confirmed",
  "booking.declined":  "Booking declined",
  "vax.approved":      "Vaccination approved",
  "vax.rejected":      "Vaccination rejected",
  "vax.expiring":      "Vaccination expiring soon",
};

export function NotificationDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { data, isLoading } = useNotifications();
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white dark:bg-neutral-950 rounded-t-3xl w-full max-w-md max-h-[80vh] overflow-y-auto p-5" onClick={e => e.stopPropagation()}
           style={{ paddingBottom: "calc(1.25rem + var(--safe-bottom))" }}>
        <header className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Notifications</h2>
          <button onClick={onClose} className="text-sm text-neutral-500">Close</button>
        </header>
        {isLoading
          ? <p className="text-sm text-neutral-500">Loading…</p>
          : data!.notifications.length === 0
            ? <p className="text-sm text-neutral-500 py-8 text-center">All caught up.</p>
            : <ul className="space-y-2">
                {data!.notifications.map(n => <NotificationItem key={n.createdAt + n.type} n={n} onClick={onClose} />)}
              </ul>
        }
      </div>
    </div>
  );
}

function NotificationItem({ n, onClick }: { n: PortalNotification; onClick: () => void }) {
  const body = (
    <div className={`p-3 rounded-xl ${n.readAt ? "" : "bg-blue-50 dark:bg-blue-950/30"}`}>
      <p className="text-sm font-medium">{LABELS[n.type] ?? n.type}</p>
      <p className="text-xs text-neutral-500 mt-0.5">{new Date(n.createdAt).toLocaleString()}</p>
    </div>
  );
  return n.link ? <Link to={n.link} onClick={onClick}>{body}</Link> : body;
}
```

- [ ] **Step 4: Wire into `HomeScreen.tsx`**

Replace the existing `<button aria-label="Notifications">…</button>` with `<NotificationBell />`. Import at top.

- [ ] **Step 5: Commit**

```bash
git add PawPilotPro/portal/src/hooks/useNotifications.ts PawPilotPro/portal/src/components/NotificationBell.tsx PawPilotPro/portal/src/components/NotificationDrawer.tsx PawPilotPro/portal/src/screens/HomeScreen.tsx
git commit -m "feat(portal): notification bell + drawer"
```

---

### Task 6.4: Portal — Account notification preferences

**Files:**
- Modify: `PawPilotPro/portal/src/screens/AccountScreen.tsx`

- [ ] **Step 1: Extend AccountScreen**

```tsx
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { getPortalApi } from "@/lib/api";

interface AccountData { profile: { name: string; email: string; phone: string }; notificationPrefs: { booking: boolean; vax: boolean; marketing?: boolean }; }

export function AccountScreen() {
  const { signOut } = useAuth();
  const [data, setData] = useState<AccountData | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { getPortalApi().get<AccountData>("/portal/account").then(setData); }, []);

  async function savePrefs(next: AccountData["notificationPrefs"]) {
    if (!data) return;
    setBusy(true);
    try {
      await getPortalApi().patch("/portal/account", { notificationPrefs: next });
      setData({ ...data, notificationPrefs: next });
      toast.success("Saved");
    } catch (e: any) { toast.error(e?.message ?? "Failed"); } finally { setBusy(false); }
  }

  if (!data) return <main className="p-5"><p className="text-sm text-neutral-500">Loading…</p></main>;

  const Toggle = ({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) => (
    <label className="flex items-center justify-between py-3">
      <span className="text-sm">{label}</span>
      <button onClick={() => onChange(!value)} disabled={busy}
        className={`relative w-11 h-6 rounded-full transition-colors ${value ? "bg-blue-600" : "bg-neutral-300 dark:bg-neutral-700"}`}>
        <span className={`absolute top-0.5 ${value ? "left-5" : "left-0.5"} size-5 rounded-full bg-white transition-all`} />
      </button>
    </label>
  );

  return (
    <main className="px-5 pt-6 max-w-md mx-auto">
      <h1 className="text-xl font-semibold mb-4">Account</h1>
      <section className="rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 p-4 text-sm mb-4">
        <p className="text-neutral-500 text-xs mb-1">Signed in as</p>
        <p className="font-medium">{data.profile.email}</p>
        <p className="text-neutral-500 text-xs mt-2">{data.profile.name} · {data.profile.phone}</p>
      </section>

      <section className="rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 p-4 mb-4">
        <h2 className="text-xs uppercase tracking-widest text-neutral-500 mb-2">Email notifications</h2>
        <Toggle label="Booking updates"      value={data.notificationPrefs.booking} onChange={v => savePrefs({ ...data.notificationPrefs, booking: v })} />
        <Toggle label="Vaccination reminders" value={data.notificationPrefs.vax}     onChange={v => savePrefs({ ...data.notificationPrefs, vax: v })} />
      </section>

      <button onClick={signOut} className="w-full h-12 rounded-xl border border-neutral-200 dark:border-neutral-800 text-sm font-medium">
        Sign out
      </button>
    </main>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add PawPilotPro/portal/src/screens/AccountScreen.tsx
git commit -m "feat(portal): account notification preferences"
```

---

### Task 6.5: Vax-expiring nightly cron

**Files:**
- Create: `PawPilotPro/project/supabase/functions/vax-expiring-cron/index.ts`
- Create: cron schedule in Supabase dashboard (Edge Functions → Cron Jobs → daily at 09:00 tenant time)

- [ ] **Step 1: Implement**

```ts
import { createClient } from "npm:@supabase/supabase-js";
import * as kv from "../make-server-fc003b23/server/kv_store.tsx";
import { getEmailSender } from "../make-server-fc003b23/server/lib/email.ts";
import { vaxExpiringEmail } from "../make-server-fc003b23/server/lib/email_templates/vax_expiring.ts";

Deno.serve(async () => {
  const tenants = await kv.getAllByPrefix("tenants:") as any[];
  const now = Date.now();
  const window = 30 * 86_400_000; // 30 days

  for (const tenant of tenants) {
    const vax = await kv.getAllByPrefix(`vaccinations:${tenant.id}:`) as any[];
    const expiring = vax.filter(v => {
      const exp = new Date(v.expiresAt).getTime();
      return exp > now && exp - now < window;
    });
    const byCustomer = new Map<string, any[]>();
    for (const v of expiring) {
      const pet = (await kv.get(`pets:${tenant.id}:${v.petId}`)) as any;
      if (!pet) continue;
      const customer = (await kv.get(`customers:${tenant.id}:${pet.customerId}`)) as any;
      if (!customer) continue;
      const link = (await kv.get(`portal_users:${tenant.id}:${pet.customerId}`)) as any;
      if (!link) continue;
      const arr = byCustomer.get(pet.customerId) ?? [];
      arr.push({ ...v, petName: pet.name });
      byCustomer.set(pet.customerId, arr);
    }
    for (const [customerId, items] of byCustomer) {
      const customer = (await kv.get(`tenants:${tenant.id}:${customerId}`)) as any;
      const { subject, html, text } = vaxExpiringEmail({ ownerName: customer.primaryContactName.split(" ")[0], tenantName: tenant.name, items });
      await getEmailSender().send({ to: customer.primaryEmail, subject, html, text });
      await kv.set(`notifications:${tenant.id}:${customerId}:${crypto.randomUUID()}`, {
        tenantId: tenant.id, customerId, type: "vax.expiring",
        payload: { count: items.length }, link: "/pets",
        readAt: null, createdAt: new Date().toISOString(),
      });
    }
  }
  return new Response("ok");
});
```

- [ ] **Step 2: Deploy + schedule**

```bash
cd PawPilotPro/project/supabase && npx supabase functions deploy vax-expiring-cron --no-verify-jwt
```

In dashboard → Edge Functions → vax-expiring-cron → Cron → `0 9 * * *`.

- [ ] **Step 3: Commit + phase tag**

```bash
git add PawPilotPro/project/supabase/functions/vax-expiring-cron/
git commit -m "feat(server): vax-expiring nightly cron"
git tag portal-v1-phase-6-complete
```

---

**Phase 6 done.** End-to-end:

- Owner submits booking → receives "request received" email + sees in-app notification
- Staff approves → owner gets "confirmed" email + in-app + realtime badge flip
- Staff declines with reason → owner gets "declined + reason" email + in-app
- Vax uploaded → reviewed → email of outcome
- 30 days before expiry → cron emails owner

Confirm before Phase 7.

---

# PHASE 7 — Visual polish

**Goal:** Lift the portal from functional to brand-defining. Custom design tokens, considered motion, micro-interactions, dark mode, photography, real type hierarchy. This phase is iterative, skill-driven, and run **per screen** rather than per file.

**Skills invoked, in order:**
1. **`impeccable craft`** — overall shape & taste audit, generates premium UI proposals per screen
2. **`emil-design-eng`** — component polish & invisible details (sheet open easing, list-row tap, button feel)
3. **`design-taste-frontend`** / **`high-end-visual-design`** — taste enforcement, anti-generic rules

Each screen polish task follows this loop: invoke skill → review output → cherry-pick what improves the brand → commit. Reject anything that compromises usability or breaks accessibility.

---

### Task 7.1: Brand tokens — definitive palette + typography + motion

**Files:**
- Modify: `PawPilotPro/portal/src/styles/tokens.css`
- Create: `PawPilotPro/portal/src/styles/motion.css`

- [ ] **Step 1: Confirm brand tokens with stakeholder**

Before locking tokens, get a sign-off on:
- Primary accent color (the daycare's brand — extract from existing staff app's accent or design fresh)
- Display font (recommend Inter or Geist Sans — system-stack fallback always)
- Body font (Inter or system)
- Numeric font for dates/times (tabular-nums)

- [ ] **Step 2: Replace `tokens.css` with tuned values**

```css
@layer base {
  :root {
    /* Surface — warm off-white, not stark white */
    --bg: 251 250 248;
    --surface: 255 255 255;
    --surface-elevated: 255 255 255;
    --text: 18 18 20;
    --text-muted: 102 105 112;
    --text-subtle: 138 142 150;
    --border: 232 230 226;
    --border-strong: 215 213 208;

    /* Accent — replace with stakeholder-approved brand color */
    --accent: 32 84 147;
    --accent-fg: 255 255 255;
    --accent-soft: 232 240 250;

    /* Status — calibrated for accessibility AA on both light and dark */
    --success: 24 102 60;
    --success-soft: 220 240 228;
    --warning: 138 88 8;
    --warning-soft: 252 240 215;
    --danger: 178 38 38;
    --danger-soft: 250 222 222;

    /* Type scale — 1.2 ratio, line-height tuned per size */
    --text-xs: 12px;     --lh-xs: 16px;
    --text-sm: 14px;     --lh-sm: 20px;
    --text-base: 16px;   --lh-base: 24px;
    --text-lg: 18px;     --lh-lg: 26px;
    --text-xl: 22px;     --lh-xl: 28px;
    --text-2xl: 28px;    --lh-2xl: 34px;
    --text-display: 36px; --lh-display: 40px;
    --tracking-tight: -0.02em;
    --tracking-wider: 0.08em;

    /* Spacing scale — 4px base */
    --space-1: 4px;  --space-2: 8px;  --space-3: 12px;
    --space-4: 16px; --space-5: 20px; --space-6: 24px;
    --space-8: 32px; --space-10: 40px; --space-12: 48px;

    /* Radius — pill-friendly mobile rounding */
    --radius-sm: 8px;
    --radius-md: 12px;
    --radius-lg: 16px;
    --radius-xl: 24px;
    --radius-2xl: 32px;
    --radius-full: 9999px;

    /* Shadows — soft, not harsh */
    --shadow-xs: 0 1px 2px rgb(0 0 0 / 0.04);
    --shadow-sm: 0 2px 6px rgb(0 0 0 / 0.05), 0 1px 2px rgb(0 0 0 / 0.03);
    --shadow-md: 0 8px 24px rgb(0 0 0 / 0.07), 0 2px 6px rgb(0 0 0 / 0.04);
    --shadow-lg: 0 16px 40px rgb(0 0 0 / 0.1);

    /* Motion */
    --duration-instant: 80ms;
    --duration-fast: 160ms;
    --duration-base: 240ms;
    --duration-slow: 360ms;
    --ease-out: cubic-bezier(0.2, 0.8, 0.2, 1);
    --ease-out-quart: cubic-bezier(0.165, 0.84, 0.44, 1);
    --ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1);
  }

  @media (prefers-color-scheme: dark) {
    :root {
      --bg: 12 12 14;
      --surface: 22 22 26;
      --surface-elevated: 30 30 36;
      --text: 245 245 247;
      --text-muted: 165 168 175;
      --text-subtle: 115 118 125;
      --border: 38 38 44;
      --border-strong: 56 56 64;
      --accent: 122 168 230;
      --accent-fg: 12 12 14;
      --accent-soft: 30 40 60;
      --success: 80 184 130;
      --success-soft: 30 50 40;
      --warning: 218 168 80;
      --warning-soft: 50 40 22;
      --danger: 232 100 100;
      --danger-soft: 50 30 30;
    }
  }
}
```

- [ ] **Step 3: `motion.css` — reusable animation utilities**

```css
@layer utilities {
  .anim-fade-in { animation: fadeIn var(--duration-base) var(--ease-out) both; }
  .anim-slide-up { animation: slideUp var(--duration-base) var(--ease-out-quart) both; }
  .anim-pop { animation: pop var(--duration-slow) var(--ease-spring) both; }
}
@keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
@keyframes slideUp { from { opacity: 0; transform: translateY(8px) } to { opacity: 1; transform: translateY(0) } }
@keyframes pop { 0% { opacity: 0; transform: scale(0.92) } 60% { opacity: 1; transform: scale(1.04) } 100% { transform: scale(1) } }
```

Import in `index.css`:

```css
@import "./motion.css";
```

- [ ] **Step 4: Commit**

```bash
git add PawPilotPro/portal/src/styles/
git commit -m "feat(portal): tuned design tokens + motion utilities"
```

---

### Task 7.2: Polish loop — apply `impeccable craft` to each hero screen

**Hero screens** (polish in this order):

1. **HomeScreen** — greeting, "Up next", primary CTA, alerts strip
2. **BookingsScreen** — segmented control, list rows, empty state
3. **BookingDetailScreen** — status timeline visualization, decline reason styling
4. **PetsScreen** + **PetDetailScreen** — pet portrait, vax pills, request-edit affordance
5. **BookingFlow** — step transitions, service cards, slot grid, review summary
6. **LoginScreen** + **AcceptInviteScreen** — first impression
7. **VaxUploadScreen** — file pick affordance, progress, error states
8. **AccountScreen** — toggles feel, hierarchy

For **each screen**:

- [ ] **Step A: Invoke `impeccable` with `craft` action**

```
/impeccable craft

Polish PawPilotPro/portal/src/screens/<ScreenName>.tsx for premium feel.
Constraints (binding):
- Mobile-first, 375px viewport baseline
- Honor design tokens in src/styles/tokens.css — no inline hex
- Honor prefers-reduced-motion
- Touch targets ≥ 44×44 pt
- Dark mode must look intentional, not inverted
- Real type hierarchy (display/heading/body/caption from tokens)
- Considered micro-interactions only — no gratuitous parallax
- Keep accessibility: aria-labels, semantic HTML, focus rings

Avoid:
- Generic glassmorphism / blurry overlays
- Stock shadcn defaults
- Mid-2010s gradient buttons
- Loading spinners (use skeletons)
```

- [ ] **Step B: Review the proposal**

Reject any change that:
- Increases bundle size meaningfully
- Hurts mobile readability
- Adds dependencies (no new component libraries)
- Breaks dark mode
- Adds icons inline as SVG without lucide

- [ ] **Step C: Apply chosen changes, run the screen in dev, screenshot at 375×667 and 414×896**

```bash
cd PawPilotPro/portal && npm run dev
# Manually verify both viewports + dark mode
```

- [ ] **Step D: Invoke `emil-design-eng` for component polish on the same screen**

Specific targets: button press feel, sheet open/close motion, list row tap highlight, status badge transition. Apply only what genuinely improves.

- [ ] **Step E: Commit the polished screen**

```bash
git add PawPilotPro/portal/src/screens/<ScreenName>.tsx
git commit -m "polish(portal): brand polish pass on <ScreenName>"
```

Repeat A–E for each hero screen.

---

### Task 7.3: Pet photography & empty-state warmth

**Files:**
- Add real photography under `PawPilotPro/portal/public/illustrations/`
- Update `EmptyState.tsx` to use illustrations, not emoji

- [ ] **Step 1: Source 4 illustrated empty-state SVGs**

Brief: warm, calm, brand-aligned (mid-century-illustration style or hand-drawn line art). One per: no bookings, no pets, no notifications, no vax.

- [ ] **Step 2: Update `EmptyState.tsx` to take an `illustration` prop and render the SVG above the title**

- [ ] **Step 3: Replace emoji in all empty states with the appropriate illustration**

- [ ] **Step 4: Commit**

```bash
git add PawPilotPro/portal/public/illustrations/ PawPilotPro/portal/src/components/EmptyState.tsx PawPilotPro/portal/src/screens/
git commit -m "polish(portal): illustrated empty states"
```

---

### Task 7.4: Dark mode review

- [ ] **Step 1: Walk every screen in dark mode at the smallest supported viewport**
- [ ] **Step 2: Fix any contrast failure (AA: 4.5:1 for body, 3:1 for large text)**
- [ ] **Step 3: Verify status badges + accent button still read correctly**
- [ ] **Step 4: Commit any fixes**

```bash
git add PawPilotPro/portal/src/
git commit -m "polish(portal): dark mode contrast pass"
```

---

### Task 7.5: Motion + reduced-motion review

- [ ] **Step 1: Enable `prefers-reduced-motion` in macOS / browser DevTools**
- [ ] **Step 2: Verify all animations either gracefully degrade or drop entirely**
- [ ] **Step 3: Fix any visible regression (the global rule in `index.css` handles most; check JS-driven motion)**

- [ ] **Step 4: Commit + phase tag**

```bash
git commit --allow-empty -m "polish(portal): reduced-motion review complete"
git tag portal-v1-phase-7-complete
```

---

**Phase 7 acceptance:**

- [ ] Every hero screen passes a 5-second taste test (would you ship this from your own studio?)
- [ ] Dark mode is intentional, not inverted
- [ ] No stock-shadcn aesthetic anywhere
- [ ] All animations honor reduced-motion
- [ ] Touch targets ≥ 44×44 verified with browser inspector

Confirm before Phase 8.

---

# PHASE 8 — Test hardening

**Goal:** Playwright `portal` project added to the existing test config, critical-path E2E covering invite-accept → booking-realtime → vax-roundtrip flows, visual regression baseline on 5 hero screens, mobile viewport coverage.

**Files this phase creates:**
- `PawPilotPro/portal/playwright.config.ts`
- `PawPilotPro/portal/e2e/fixtures/test-tenant.ts`
- `PawPilotPro/portal/e2e/critical/accept-invite.spec.ts`
- `PawPilotPro/portal/e2e/critical/book-and-confirm.spec.ts`
- `PawPilotPro/portal/e2e/critical/vax-roundtrip.spec.ts`
- `PawPilotPro/portal/e2e/visual/hero-screens.spec.ts`
- `PawPilotPro/portal/scripts/seed-portal-test-data.ts`
- `.github/workflows/portal-e2e.yml` (if CI exists)

---

### Task 8.1: Playwright config + dev server

**Files:**
- Create: `PawPilotPro/portal/playwright.config.ts`

- [ ] **Step 1: Install Playwright**

```bash
cd PawPilotPro/portal && npm install -D @playwright/test
npx playwright install --with-deps
```

- [ ] **Step 2: Config**

```ts
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false, // realtime tests benefit from sequential
  retries: process.env.CI ? 2 : 0,
  use: {
    baseURL: process.env.PORTAL_URL ?? "http://localhost:5175",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "iphone-se", use: { ...devices["iPhone SE (3rd generation)"] } },
    { name: "iphone-11-pro-max", use: { ...devices["iPhone 11 Pro Max"] } },
  ],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:5175",
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
```

- [ ] **Step 3: Commit**

```bash
git add PawPilotPro/portal/playwright.config.ts PawPilotPro/portal/package.json PawPilotPro/portal/package-lock.json
git commit -m "test(portal): playwright config with mobile viewports"
```

---

### Task 8.2: Test fixtures — seed a tenant + owner + pets + vax

**Files:**
- Create: `PawPilotPro/portal/e2e/fixtures/test-tenant.ts`
- Create: `PawPilotPro/portal/scripts/seed-portal-test-data.ts`

- [ ] **Step 1: Seed script**

```ts
// Run with: tsx scripts/seed-portal-test-data.ts
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const admin = createClient(url, serviceKey);

async function main() {
  const tenantId = "t_test";
  const customerId = "c_test";
  const petId = "p_test";

  await admin.from("kv_store_fc003b23").upsert([
    { key: `tenants:${tenantId}`, value: { id: tenantId, name: "Pawsome Daycare (Test)", businessHours: { open: 8, close: 17 } } },
    { key: `customers:${tenantId}:${customerId}`, value: { id: customerId, tenantId, householdName: "Test Family", primaryContactName: "Sarah Test", primaryEmail: "owner+e2e@example.com", primaryPhone: "555-0100", petIds: [petId] } },
    { key: `pets:${tenantId}:${petId}`, value: { id: petId, tenantId, customerId, name: "Bella", breed: "Lab", dob: "2020-01-01", weightKg: 22, photoUrl: null, notes: null } },
    { key: `vaccinations:${tenantId}:v1`, value: { id: "v1", tenantId, petId, vaxType: "rabies", certificateUrl: "", issuedAt: "2025-01-01T00:00:00Z", expiresAt: "2027-01-01T00:00:00Z", boosterDueAt: null, approvedBy: "s_test", approvedAt: "2025-01-01T00:00:00Z" } },
    { key: `vaccinations:${tenantId}:v2`, value: { id: "v2", tenantId, petId, vaxType: "dhpp", certificateUrl: "", issuedAt: "2025-01-01T00:00:00Z", expiresAt: "2027-01-01T00:00:00Z", boosterDueAt: null, approvedBy: "s_test", approvedAt: "2025-01-01T00:00:00Z" } },
  ]);

  // Create the portal user
  const { data: user, error } = await admin.auth.admin.createUser({
    email: "owner+e2e@example.com",
    password: "Pa55word!Test",
    email_confirm: true,
    user_metadata: { portal_user: true, tenantId, customerId },
  });
  if (error && error.message !== "User already registered") throw error;

  await admin.from("kv_store_fc003b23").upsert([
    { key: `portal_users:${tenantId}:${customerId}`, value: { authUserId: user?.user?.id, customerId, tenantId, notificationPrefs: { booking: true, vax: true, marketing: false }, createdAt: new Date().toISOString() } },
  ]);

  console.log("Seeded portal test data");
}
main().catch(e => { console.error(e); process.exit(1); });
```

- [ ] **Step 2: Fixture for tests to log in fast**

```ts
import { test as base, expect, Page } from "@playwright/test";
export { expect };
export const test = base.extend<{ ownerPage: Page }>({
  ownerPage: async ({ page }, use) => {
    await page.goto("/login");
    await page.getByLabel(/email/i).fill("owner+e2e@example.com");
    await page.getByLabel(/password/i).fill("Pa55word!Test");
    await page.getByRole("button", { name: /sign in/i }).click();
    await page.waitForURL("/");
    await use(page);
  },
});
```

- [ ] **Step 3: Commit**

```bash
git add PawPilotPro/portal/e2e/fixtures/ PawPilotPro/portal/scripts/
git commit -m "test(portal): seed script + login fixture"
```

---

### Task 8.3: Critical E2E — accept invite

**File:** `PawPilotPro/portal/e2e/critical/accept-invite.spec.ts`

- [ ] **Step 1: Test**

```ts
import { test, expect } from "../fixtures/test-tenant";

test("invite-link UX — invalid token", async ({ page }) => {
  await page.goto("/accept-invite?token=invalid");
  await page.getByRole("button", { name: /set up/i }).click();
  await page.getByLabel(/password/i).fill("Pa55word!Test");
  await page.getByRole("button", { name: /set up/i }).click();
  await expect(page.getByRole("alert")).toContainText(/invalid|expired/i);
});

test("missing token — friendly fallback", async ({ page }) => {
  await page.goto("/accept-invite");
  await expect(page.getByRole("heading", { name: /invalid link/i })).toBeVisible();
});
```

> Happy-path accept-invite needs a fresh, unconsumed token — generate one in the test via the admin endpoint, then exercise it. Stub left for the executor to fill in.

- [ ] **Step 2: Run + commit**

```bash
cd PawPilotPro/portal && npx playwright test e2e/critical/accept-invite.spec.ts
git add PawPilotPro/portal/e2e/critical/accept-invite.spec.ts
git commit -m "test(portal): accept-invite E2E"
```

---

### Task 8.4: Critical E2E — book → staff confirms → realtime flip

**File:** `PawPilotPro/portal/e2e/critical/book-and-confirm.spec.ts`

- [ ] **Step 1: Test**

```ts
import { test, expect } from "../fixtures/test-tenant";

test("owner books daycare; status flips to confirmed", async ({ ownerPage, request }) => {
  // 1. Submit via UI
  await ownerPage.getByRole("link", { name: /book a service/i }).click();
  await ownerPage.getByRole("button", { name: /daycare/i }).click();
  await ownerPage.getByRole("button", { name: /bella/i }).click();
  await ownerPage.getByRole("button", { name: /continue/i }).click();
  // Tomorrow:
  const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
  await ownerPage.getByLabel(/date/i).fill(tomorrow);
  await ownerPage.getByRole("button", { name: /continue.*8:30/i }).click();
  await ownerPage.getByRole("button", { name: /submit request/i }).click();
  await expect(ownerPage.getByText(/pending/i)).toBeVisible();
  const url = ownerPage.url();
  const bookingId = url.split("/bookings/")[1];

  // 2. Approve via admin API (simulating staff click)
  const STAFF_JWT = process.env.STAFF_JWT!;
  const ANON = process.env.SUPABASE_ANON_KEY!;
  await request.post(`${process.env.SUPABASE_FN_BASE}/portal-admin/bookings/${bookingId}/approve`, {
    headers: { "Authorization": `Bearer ${ANON}`, "X-User-Token": `Bearer ${STAFF_JWT}` },
  });

  // 3. Wait for realtime flip in the owner's page
  await expect(ownerPage.getByText(/confirmed/i)).toBeVisible({ timeout: 10_000 });
});
```

- [ ] **Step 2: Run + commit**

```bash
cd PawPilotPro/portal && npx playwright test e2e/critical/book-and-confirm.spec.ts
git add PawPilotPro/portal/e2e/critical/book-and-confirm.spec.ts
git commit -m "test(portal): book + realtime confirmation E2E"
```

---

### Task 8.5: Critical E2E — vax upload → approve roundtrip

**File:** `PawPilotPro/portal/e2e/critical/vax-roundtrip.spec.ts`

- [ ] **Step 1: Test**

```ts
import { test, expect } from "../fixtures/test-tenant";
import fs from "node:fs";
import path from "node:path";

test("vax upload → approve flow", async ({ ownerPage, request }) => {
  await ownerPage.goto("/pets/p_test/vax/upload");
  const samplePdf = path.join(__dirname, "../fixtures/sample-vax.pdf");
  if (!fs.existsSync(samplePdf)) test.skip(true, "Add a sample-vax.pdf fixture before running");
  await ownerPage.setInputFiles("input[type=file]", samplePdf);
  await ownerPage.selectOption("select", "rabies");
  await ownerPage.getByRole("button", { name: /submit for review/i }).click();
  await expect(ownerPage.getByText(/staff will review/i)).toBeVisible();

  // Staff approves via API
  const STAFF_JWT = process.env.STAFF_JWT!;
  const ANON = process.env.SUPABASE_ANON_KEY!;
  const queueRes = await request.get(`${process.env.SUPABASE_FN_BASE}/portal-admin/vax-queue`, {
    headers: { "Authorization": `Bearer ${ANON}`, "X-User-Token": `Bearer ${STAFF_JWT}` },
  });
  const { items } = await queueRes.json();
  expect(items.length).toBeGreaterThan(0);
  const queueId = items[items.length - 1].id;
  await request.post(`${process.env.SUPABASE_FN_BASE}/portal-admin/vax-queue/${queueId}/approve`, {
    headers: { "Authorization": `Bearer ${ANON}`, "X-User-Token": `Bearer ${STAFF_JWT}`, "Content-Type": "application/json" },
    data: { vaxType: "rabies", issuedAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 365*86400000).toISOString(), boosterDueAt: null },
  });

  await ownerPage.goto("/pets/p_test");
  await expect(ownerPage.getByText(/rabies/i)).toBeVisible();
  await expect(ownerPage.getByText(/current/i)).toBeVisible();
});
```

- [ ] **Step 2: Run + commit**

```bash
cd PawPilotPro/portal && npx playwright test e2e/critical/vax-roundtrip.spec.ts
git add PawPilotPro/portal/e2e/critical/vax-roundtrip.spec.ts
git commit -m "test(portal): vax upload/approve roundtrip E2E"
```

---

### Task 8.6: Visual regression — 5 hero screens

**File:** `PawPilotPro/portal/e2e/visual/hero-screens.spec.ts`

- [ ] **Step 1: Test**

```ts
import { test, expect } from "../fixtures/test-tenant";

test.describe("Hero screens visual baseline", () => {
  test("Home", async ({ ownerPage }) => {
    await ownerPage.goto("/");
    await ownerPage.waitForLoadState("networkidle");
    await expect(ownerPage).toHaveScreenshot("home.png", { fullPage: true, animations: "disabled" });
  });
  test("Bookings empty", async ({ ownerPage }) => {
    await ownerPage.goto("/bookings");
    await expect(ownerPage).toHaveScreenshot("bookings-empty.png", { fullPage: true, animations: "disabled" });
  });
  test("Pets list", async ({ ownerPage }) => {
    await ownerPage.goto("/pets");
    await expect(ownerPage).toHaveScreenshot("pets.png", { fullPage: true, animations: "disabled" });
  });
  test("Pet detail", async ({ ownerPage }) => {
    await ownerPage.goto("/pets/p_test");
    await expect(ownerPage).toHaveScreenshot("pet-detail.png", { fullPage: true, animations: "disabled" });
  });
  test("Booking step 1", async ({ ownerPage }) => {
    await ownerPage.goto("/book?step=service");
    await expect(ownerPage).toHaveScreenshot("book-step-service.png", { fullPage: true, animations: "disabled" });
  });
});
```

- [ ] **Step 2: Generate baseline**

```bash
cd PawPilotPro/portal && npx playwright test e2e/visual/ --update-snapshots
```

- [ ] **Step 3: Commit baseline + phase tag**

```bash
git add PawPilotPro/portal/e2e/ PawPilotPro/portal/playwright.config.ts
git commit -m "test(portal): visual regression baseline on hero screens"
git tag portal-v1-phase-8-complete
git tag portal-v1-shipped
```

---

**Phase 8 acceptance:**

- [ ] All critical specs pass on both `iphone-se` and `iphone-11-pro-max`
- [ ] Visual baselines committed
- [ ] CI workflow exists or is documented as a follow-up

---

# Done

`git tag portal-v1-shipped` exists. Ship it. Open a PR against `claude/frosty-panini` from `feat/client-portal-app`. Include in the PR description: the spec link, the phase tags timeline, the Phase 7 polish before/after screenshots, and any deferred items from the spec's section 13.
