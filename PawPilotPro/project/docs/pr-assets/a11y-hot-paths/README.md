# A11y hot-paths audit evidence

Axe (axe-core via `@axe-core/playwright`, WCAG 2.1 A/AA + best-practice tags)
run over the four hot-path screens — dashboard, check-in, check-out, pet
profile — at desktop (1280×900) and mobile (390×844) viewports, against the
same fixture harness the visual-diff screenshots use.

## Result: 0 critical / 0 serious violations on all 8 screen×viewport combinations

`a11y-report.json` is the full machine output. `a11y-audit.mjs` reproduces it:

```sh
npm i -D @axe-core/playwright   # not a committed dep — evidence tooling only
cp docs/pr-assets/a11y-hot-paths/a11y-audit.mjs node_modules/.a11y-audit.mjs
npx vite --port 5175 &          # dev server
node node_modules/.a11y-audit.mjs report.json http://localhost:5175
```

`a11y-verify.mjs` is the semantic spot-check suite (11 checks, all passing):
accessible names on check-in cards including flag state, dialog
naming/describedby wiring, warning group labelling, live regions, collapsed
sidebar tooltips + labels.

## Violations found by the initial pass, and their fixes

| Screen | Rule (impact) | Node | Fix |
|---|---|---|---|
| pet profile | `button-name` (critical) | icon-only back arrow | `aria-label="Back to household"` |
| dashboard | `color-contrast` (serious) ×5 | capacity-card texts at `white/40–80` on `--primary` (2.1–3.9:1) | raised to `white/92–95` (≥4.6:1) |
| check-in | `color-contrast` (serious) ×3 | "· Late" in `amber-600` on white (3.4:1) | `amber-700` (5.0:1) |
| pet profile | `color-contrast` (serious) | default Badge `text-primary` on `bg-primary/10` (4.0–4.5:1) | new `--primary-strong` token (#0F5D45, 5.7:1 on the tint) used by the Badge default variant |

Remaining moderate/minor findings (`heading-order`, `region` landmarks) are
pre-existing page-structure items outside this branch's acceptance bar,
left for a follow-up.
