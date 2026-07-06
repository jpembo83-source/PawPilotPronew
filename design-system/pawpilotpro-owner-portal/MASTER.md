# PawPilotPro Owner Portal — Design System (as built)

> **This document is DERIVED FROM CODE.** Every value below is cited to the
> file and line that defines it (paths relative to `PawPilotPro/portal/`).
> If this doc and the code disagree, the code wins — fix the doc.
> Sources of truth: `src/styles/tokens.css` (palette, radius, mobile
> utilities) and `src/styles/index.css` (fonts, type scale, motion, shadows).
>
> The previous version of this file was an unrelated generated template
> (Orbitron/cyberpunk/claymorphism). Nothing like that ever shipped.

**Project:** PawPilotPro Owner Portal (customer app — React + Capacitor iOS)
**Feel:** warm editorial — cream surfaces, forest-green primary, Fraunces serif display over Inter body. Calm, tactile, native-leaning.

---

## Color palette

Light mode (`src/styles/tokens.css:3-42`):

| Role | Value | Token |
|---|---|---|
| Background (cream) | `#F4F3EF` | `--background` (tokens.css:5) |
| Foreground (warm near-black) | `#1C1916` | `--foreground` (tokens.css:6) |
| Card / popover | `#FFFFFF` | `--card` (tokens.css:7) |
| Primary (forest green) | `#177C5E` | `--primary` (tokens.css:11) |
| Secondary (mint tint; icon-circle bg) | `#EBF7F2` | `--secondary` (tokens.css:13) |
| Secondary foreground | `#177C5E` | `--secondary-foreground` (tokens.css:14) |
| Muted surface | `#EDE9E3` | `--muted` (tokens.css:15) |
| Muted foreground | `#6B6762` | `--muted-foreground` (tokens.css:16) |
| Destructive | `#C03030` | `--destructive` (tokens.css:19) |
| Border | `#E2DED8` | `--border` (tokens.css:21) |
| Input border / bg | `#D6D2CB` / `#FFFFFF` | `--input`, `--input-background` (tokens.css:22-23) |
| Focus ring | `#177C5E` | `--ring` (tokens.css:27) |

**Dark mode** is a full parallel block (`tokens.css:44-79`): background `#141210`, card `#1E1B18`, foreground `#F0EDE8`, secondary flips to deep green `#1A2E27` with light-mint foreground `#6ECFAB`. Dark variant is class-driven: `@custom-variant dark (&:is(.dark *))` (tokens.css:1).

Tokens are bridged to Tailwind v4 utilities via `@theme inline` (tokens.css:81-120 and index.css:5-32) — style with `bg-card`, `text-muted-foreground`, etc., never raw hexes.

---

## Typography

Fonts declared at `src/styles/index.css:27-31`, loaded in `index.html:19` (Google Fonts):

- `--font-display`: **"Fraunces"**, ui-serif fallback — editorial serif for hero greetings and screen titles only.
- `--font-sans`: **"Inter"**, system fallback — everything else. Body gets `font-feature-settings: "ss01", "cv11"` (index.css:94).
- `--font-mono`: ui-monospace stack (index.css:31).

Type scale utilities (`index.css:132-156`):

| Class | Spec | Use |
|---|---|---|
| `.text-display` | Fraunces 30px / 1.05 / -0.024em / 600 (index.css:133-139) | screen h1 |
| `.text-display-sm` | Fraunces 24px / 1.1 / -0.02em / 600 (index.css:140-146) | wizard/step h1 |
| `.text-eyebrow` | 11px / caps / 0.12em tracking / 600 / muted-foreground (index.css:147-154) | section + field labels |
| `.text-tabular` | tabular numerals (index.css:155) | times, counters, prices |

Base element sizes (h1-h4, label, button, input) come from `tokens.css:122-189`.

---

## Radius, shadows, spacing

- Radius scale: `--radius: 0.75rem` (tokens.css:33) with sm/md/lg/xl steps derived at tokens.css:108-111. In practice: cards `rounded-2xl`, inputs/buttons `rounded-xl` or `rounded-2xl` for the big CTA, avatar circles `rounded-full`.
- Shadows (warm-tinted, layered): `--shadow-xs/sm/md/lg` at index.css:64-67; ambient `--shadow-diffusion` and `--shadow-card-soft` at tokens.css:268-272 (dark variants tokens.css:275-281). Use via `shadow-[var(--shadow-sm)]` etc.
- Safe areas: `--safe-top/bottom/left/right` map `env(safe-area-inset-*)` (index.css:45-48); utility classes `.safe-area-*` (tokens.css:196-210). Tab bar height reserved via `--tab-bar-height: 5.5rem` (index.css:52).
- Touch targets: `.touch-target` 44px, `.touch-target-lg` 56px minimums (tokens.css:392-400).

---

## Motion

Tokens at index.css:55-61: durations instant 80ms / fast 140ms / base 220ms / slow 360ms; easings `--ease-out`, `--ease-out-quart`, `--ease-spring`.

Utilities (index.css:160-174): `.anim-fade-in`, `.anim-slide-up`, `.anim-pop`, `.anim-hero-zoom` (login hero, owns fade+zoom in one declaration — two animation classes on one element override, they don't combine: index.css:163-171), `.press` (scale 0.985 on :active — the standard button/card press affordance, index.css:172-174). Staggered list entrances use `animationDelay: i * 50ms` inline (e.g. `src/screens/booking/StepService.tsx`).

**Reduced-motion policy:** `@media (prefers-reduced-motion: reduce)` collapses all animations/transitions to 0.01ms and disables press-scale (index.css:180-191); ambient loops (`animate-breathe`, `animate-pulse-dot`, `animate-drift-dash`, `animate-shimmer`, `animate-banner-settle`, defined tokens.css:283-336) are hard-disabled at tokens.css:339-347.

**Viewport lock** (Capacitor WKWebView): html/body/#root are clipped on x and sized to the dynamic viewport — see the commented block at index.css:70-113 before touching layout that could overflow.

---

## Component idioms (copy these, don't invent)

- **Card:** `p-4 rounded-2xl border border-border bg-card` + `hover:shadow-[var(--shadow-md)]`; selected state `border-primary ring-2 ring-primary/15 bg-secondary` (`src/screens/booking/StepService.tsx`, `StepPets.tsx`).
- **Tonal icon circle** (card leading visual / avatar fallback): `size-12`–`size-14 rounded-full bg-secondary text-secondary-foreground grid place-items-center` containing a **Lucide icon** at `strokeWidth` ≈ 2 (pet fallback: `PawPrint`, `StepPets.tsx`).
- **Eyebrow label:** `.text-eyebrow` above the value/field (`StepDates.tsx` Field).
- **Primary CTA:** full-width `h-14 rounded-2xl bg-primary text-primary-foreground font-semibold` + `.press` + top highlight hairline (`StepPets.tsx` Continue button).
- **Inputs:** `h-12 px-3.5 rounded-xl border border-input bg-input-background text-[15px]` with `focus:border-primary focus:ring-2 focus:ring-ring/30` (`LoginScreen.tsx`, `StepDates.tsx`). Native date/time pickers stay native — styled trigger row with the real input stretched invisibly on top (`StepDates.tsx` NativePickerRow).
- **Skeletons, not spinners:** loading states render shaped `<Skeleton>` placeholders (`src/components/Skeleton.tsx` — `bg-muted/70 rounded animate-pulse`) matching the final layout (`StepPets.tsx` loading branch). A spinner is reserved for inline "working…" affordances inside a control, not for page/section loads.
- **Empty state:** dashed tonal card — `rounded-2xl border border-dashed border-border bg-card/40 px-5 py-8 text-center` with `text-[13px] text-muted-foreground` copy (`StepPets.tsx` "No bookable pets yet").

---

## Hard rules

- **No emoji as UI iconography.** Use Lucide (or Phosphor) SVG primitives at deliberate stroke weights. Server-supplied prose is scrubbed at the render boundary with `stripEmoji()` (`src/lib/text.ts` — the rationale comment there is canonical). Typographic arrows (→ ↑ ↓) in text are typography, not emoji, and are allowed.
- **Skeletons over spinners** for anything layout-shaped (see idiom above).
- **Tokens, not hexes** — new colors go into `tokens.css` with a dark-mode counterpart, then get used via the Tailwind bridge.
- **44px touch minimum** on interactive elements (`.touch-target`).
- **Respect reduced motion** — any new looping/entrance animation must be covered by the reduced-motion blocks (index.css:180-191, tokens.css:339-347).
- **Focus visible** — inputs/buttons keep the `--ring` focus treatment; never remove outlines without a replacement.
- **Contrast ≥ 4.5:1** for text at body sizes (the staff app repo enforces the same floor; see repo CLAUDE.md "UI floors").
