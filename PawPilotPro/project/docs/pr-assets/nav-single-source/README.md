# Nav single-source refactor — snapshot evidence

`nav-before.json` / `nav-after.json`: for each role (admin, manager,
assistant_manager, staff), the rendered desktop sidebar groups, mobile bottom
bar, and mobile drawer sections, scraped from the running app with
`nav-snapshot.mjs` (fixture backend; daycare/grooming/transport/overnights/
packages globally enabled, boutique disabled, location ALL).

## Invariants proven (before == after)

- **Desktop sidebar: byte-identical for all four roles.**
- **Staff role: identical on every surface** (desktop, bottom bar, drawer).
- Admin bottom bar: identical.

## Every difference is one of the listed reconciliations

| # | Reconciliation | Who it affects |
|---|---|---|
| 1 | Mobile drawer gains full desktop parity: Portal Inbox, Capacity, Reports, Policies, Packages (and Boutique when enabled) were desktop-only | all roles with those permissions |
| 2 | `incidents` section: mobile had it under **Team**, desktop under **Business** → **Business** everywhere | drawer layout |
| 3 | Business order: mobile had Billing before Messages; desktop order (Customers, Messages, Billing, Incidents, Reports) is canonical | drawer layout |
| 4 | **Beta filtering now applies on mobile** (it was desktop-only): managers/assistant managers no longer see beta modules (Billing, Messages, Staff, Grooming, Packages) on mobile that desktop already hides from them — incl. the Grooming bottom-bar tab, whose slot backfills with Customers | manager, assistant_manager |
| 5 | Location-level module enablement now applies on mobile as on desktop (with the same explicit-permission override for e.g. drivers) | specific-location views |
| 6 | Mobile Settings drawer item was labelled **"Gear"** (a bug — the icon name leaked into the label) → "Settings" | all roles |
| 7 | Icons unified to the desktop set (mobile: Dashboard Gauge→GridFour, Daycare Dog→PawPrint, Transport Truck→Van, Messages ChatTeardrop→ChatCircleDots) | mobile visuals |
| 8 | Bottom-bar "Home" label kept via `shortLabel` on the dashboard entry; drawer/desktop say "Dashboard" as before | none (preserves current UX) |

Diff them yourself: both JSONs are committed; the comparison script is the
last section of `nav-snapshot.mjs`'s output fed through the diff snippet in
the PR description.

## Mobile-detection consolidation proof

```
$ grep -rn "function useIsMobile" src/
src/app/components/ui/use-mobile.ts:10:export function useIsMobile()
```

Three copies before (ui/use-mobile.ts matchMedia-only; App.tsx and
Transportation.tsx innerWidth+UA) → one, keeping the innerWidth+UA semantics.
