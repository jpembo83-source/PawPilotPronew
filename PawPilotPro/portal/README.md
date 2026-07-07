# PawPilotPro Owner Portal

Customer-facing app (React + Vite + Capacitor iOS). Owners book daycare,
grooming, overnights and transport, see their dogs' day, and manage their
household.

## Design system — read this first

**The canonical design doc is
[`design-system/pawpilotpro-owner-portal/MASTER.md`](../../design-system/pawpilotpro-owner-portal/MASTER.md)**
(repo root). It is derived from the shipped code with file:line citations —
palette/dark mode, Fraunces/Inter type scale, radius/shadows/safe-areas,
motion + reduced-motion policy, and the card/eyebrow/skeleton/empty-state
idioms, plus the hard rules (no emoji as icons, skeletons not spinners,
tokens not hexes, 44px touch targets).

Tokens live in `src/styles/tokens.css` and `src/styles/index.css`; when the
doc and the code disagree, the code wins — update the doc.

## Development

```sh
npm ci --ignore-scripts   # sharp's postinstall needs network; not required for dev
npm run dev               # requires VITE_SUPABASE_PROJECT_ID / VITE_SUPABASE_ANON_KEY
npm test                  # vitest unit tests
npm run build             # production bundle (used by Xcode Cloud ci_post_clone.sh)
```

iOS builds run on Xcode Cloud (`ios/App/ci_scripts/ci_post_clone.sh` builds
the web bundle and runs `cap sync` on Apple's machines).
