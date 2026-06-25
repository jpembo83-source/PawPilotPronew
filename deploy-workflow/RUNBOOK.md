# Staging → Production Workflow Runbook (PawPilotProNew)

Two-stage pipeline: feature branch → PR (CI + Netlify Deploy Preview on staging
Supabase) → merge to `main` → production.

| Layer    | Production                              | Staging                                          |
|----------|-----------------------------------------|--------------------------------------------------|
| Frontend | Netlify site `mdcpppro` → mdc.pawpilotpro.com | Deploy Previews (PRs) + `staging` branch deploy |
| Backend  | Supabase **MDC** `ruahrxkfgfyshuxykiay` | Supabase **MDC-staging** `ihdbnwlmqhsrslstbbqn`  |
| Env vars | prod values (`production` ctx)          | staging values (`deploy-preview` + `branch-deploy`) |

App: `PawPilotPro/project/`. Backend: edge function `make-server-fc003b23`.

> Note: `main` already had a healthy CI (`.github/workflows/ci.yml`: build +
> Playwright smoke + baseline-gated lint/typecheck), `react` in real
> dependencies, and the typecheck/lint scripts. This workflow change does **not**
> touch those — it adds only what was missing for staging isolation.

---

## ✅ Provisioned in this session (live now)

1. **Staging Supabase project** — `MDC-staging` (`ihdbnwlmqhsrslstbbqn`,
   eu-central-2, $10/mo). Active.
2. **Staging schema** — active app schema applied (kv_store + `app` JWT/RLS
   helpers + 8 customer tables + RLS). Security advisor clean. Captured in
   `supabase/migrations/20260625120000_active_schema_baseline.sql`.
3. **Netlify env wiring** on site `mdcpppro`
   (`996cc853-3d8b-433a-a8a7-5b742822c77b`), per context:
   - `production` → prod project / prod URL / prod anon (unchanged)
   - `deploy-preview` + `branch-deploy` → staging project / staging URL / staging anon
   Vars: `VITE_SUPABASE_PROJECT_ID`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.

## ✅ In this PR (repo changes against current `main`)

- **Externalized Supabase config** — `utils/supabase/info.ts` now reads
  `VITE_SUPABASE_PROJECT_ID` / `VITE_SUPABASE_ANON_KEY` from env, **falling back
  to the current prod values** so production is unchanged. This is what makes the
  per-context env wiring actually take effect (previously hardcoded to prod).
- **`.env.example`** documenting the three frontend vars.
- **`.github/workflows/deploy-functions.yml`** — deploys `make-server-fc003b23`
  via the Supabase CLI: push to `staging` → staging, push to `main` → prod.
  Requires a `SUPABASE_ACCESS_TOKEN` repo secret.
- **Migrations** — the two live prod hardening migrations captured exactly, plus
  the active-schema baseline + a README documenting the real migration state.

---

## ⚠️ Latent issue this fixes
Several modules (e.g. `CapacityWidget.tsx`, `QuickNoteModal.tsx`) call
`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/...` with **no fallback**, but
prod's Netlify did not set `VITE_SUPABASE_URL`. Setting it per context (done)
both fixes those calls on future prod deploys and makes them staging-aware.
(Optional cleanup: refactor those modules to derive the URL from `projectId`
for a single source of truth.)

## Your action items (need GitHub admin / a token)
- **A. Edge function → staging.** Add a `SUPABASE_ACCESS_TOKEN` repo secret
  (Settings → Secrets and variables → Actions). Then the deploy-functions
  workflow deploys it (push to `staging` / `main`, or run via "Run workflow").
  First-time staging deploy can also be done locally:
  `cd PawPilotPro/project && SUPABASE_ACCESS_TOKEN=… supabase functions deploy make-server-fc003b23 --project-ref ihdbnwlmqhsrslstbbqn`
- **B. Netlify branch deploys.** Site `mdcpppro` → Build & deploy → Branches →
  add `staging`.
- **C. Branch protection on `main`** → require the CI **build** check
  (Settings → Branches).
- **D. Base directory.** Confirm site `mdcpppro`'s Base directory and delete the
  redundant `netlify.toml` (root vs `PawPilotPro/`).
- Create the `staging` branch from `main` after this merges.

## Branch strategy
`main` → production. `staging` → staging branch deploy. Feature branches → PR →
Deploy Preview (staging Supabase) + CI.

## Migration discipline
Every schema change is a new file in `PawPilotPro/project/supabase/migrations/`,
never ad-hoc dashboard SQL. Full prod parity (incl. invoxia/legacy): see that
folder's README (`supabase db pull`).
