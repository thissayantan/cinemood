# Responsive audit — mobile + tablet

> **Archived 2026-05-12.** This is the analysis that drove the
> mobile / iPad responsive fix; the fix itself shipped in commits
> `24ec03d` and `9983574`. Kept for context, not as current truth —
> consult the live code for present behaviour. The before/after
> screenshot folder (`docs/responsive-shots/`) referenced in the
> original text was deleted on archival; the textual analysis is the
> load-bearing part of this doc.

Captured 2026-05-12 via Playwright MCP against the live production site
`https://cinemood.sayantan.cloud/` with the maintainer's signed-in
session. Three viewports per surface:

- **375×812** — iPhone (smallest mainstream)
- **768×1024** — iPad portrait
- **1024×1366** — iPad landscape

## What was broken

### 1. Top bar overflowed off-screen at 375 px ⚠️ critical

The watchlist `<header>` row had five elements competing for space:

```
[ Cinemood ] [ Search or add a film…    ⌘K ] [ Filter ] [ Theme: Dark ] [ Avatar Sayantan Das ]
```

Combined intrinsic width on a logged-in viewport: **≈ 600 px**. At 375
px viewport the search button started at `x=169` and ran to `x=406`
(31 px past the right edge). Everything to its right — filter trigger
(x=417), theme toggle (x=445), avatar (x=531) — was entirely
off-screen. The mobile user could not reach filters, the theme
toggle, or the account menu.

**Cause.** Top bar was desktop-first, with no `<sm:` collapse strategy.
The title-count badge `155 TITLES` was the only element with a
`sm:inline` gate.

**Fix.** [`24ec03d` — top bar, tap targets, hover gating, poster grid]
- `top-bar.tsx`: at `<sm`, replace the inline search-pill with an
  icon-only 44×44 button (Apple HIG minimum). At `sm:+`, keep the
  full-width search button with the `⌘K` hint.
- `theme-toggle.tsx`: at `<sm`, 44×44 icon-only (no label). At `sm:+`,
  the label-bearing pill returns.
- `avatar-menu.tsx`: at `<sm`, 44×44 avatar-only button. At `sm:+`,
  the avatar + name pill.
- Filter sheet trigger bumped from `h-9 w-9` (36 px) to `h-11 w-11`
  (44 px) to satisfy the tap-target floor.

The five-element row now fits inside 375 px: wordmark + 4 × 44 px
icons + gaps ≈ 296 px, leaving comfortable margin.

### 2. Poster card hover overlay flashed on touch ⚠️ usability

The poster card sets a `hovered` boolean via `onMouseEnter` and
`onFocus`. On touch devices a tap fires `focus` on the card's button
before the click handler opens the detail dialog. Result: the
synopsis overlay briefly appears, then the dialog covers it. Visual
noise, no actionable controls (mark-watched / remove require true
hover, which touch devices don't sustain).

**Fix.** Same commit. New
[`apps/web/src/lib/use-has-hover.ts`](../apps/web/src/lib/use-has-hover.ts)
queries `@media (hover: hover)` (the W3C-blessed signal for "pointer
can hover without clicking") and the poster card gates all four
mouse + focus handlers on it. On touch, `hovered` never flips. The
detail dialog remains the touch path for synopsis + cast + actions.

### 3. Detail dialog cramped at 375 px

The 132 px poster + 40 px title size + `px-7` left only ≈ 140 px for
the title column at a 375 px viewport, forcing awkward two-line
title wraps on common names (`Resident` / `Alien`).

**Fix.** [`9983574` — detail dialog tightens on small screens]
- Poster width: 132 → 96 at `<sm`.
- Title size: 40 → 28 at `<sm`.
- Header padding `px-7 / -mt-24` → `px-5 / -mt-16` at `<sm`.
- All sub-sections (action bar, synopsis, genres, cast, providers)
  collapse `px-7` → `px-5` at `<sm`, scaling back at `sm:+`.

Desktop sizing at 40 / 56 px is preserved at `sm:+` and `md:+`.

### 4. Poster grid column count

Grid had `grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5`
but no `2xl` step. Wide ultra-displays were stuck at 5 columns.

**Fix.** Added `2xl:grid-cols-6`. Targets are now:
- 375 px: **2 columns**
- 640 px (`sm:`): **3 columns**
- 1024 px (`lg:`): **4 columns**
- 1280 px (`xl:`): **5 columns**
- 1536 px (`2xl:`): **6 columns**

### 5. Tap-target sweep

All interactive chrome elements on mobile checked against the
**44 × 44 px (Apple HIG)** floor:

| Element                      | Pre-fix      | Post-fix     |
|------------------------------|-------------:|-------------:|
| Top-bar search trigger       | 36 (full pill, overflows) | 44 (icon at <sm) |
| Top-bar filter trigger       | 36 × 36       | 44 × 44       |
| Top-bar theme toggle         | 74 × 36       | 44 × 44 (<sm) |
| Top-bar avatar               | variable × 36 | 44 × 44 (<sm) |
| Poster card hover quick-actions | 28 × 28 (hover-only on desktop) | n/a — suppressed on touch via use-has-hover |

The `28×28` poster hover buttons stay desktop-only via the hover gate;
on touch the equivalent actions live inside the detail dialog where
the buttons are full 32 px pills.

## What didn't need fixing

These rendered correctly at 375, 768, and 1024 without changes:

- **Landing page.** Hero composition (Cinemood wordmark + tagline +
  Sign-in button + foot mark) was already mobile-first via flex
  centring + `text-balance` + responsive type stops.
- **Command palette** at 375. Width is `min(880px, calc(100vw-32px))`
  → 343 px on a 375 viewport. Side preview pane is already
  `hidden md:block`. Placeholder truncates cleanly. Mode toggle +
  Add/Find labels remain visible.
- **Import page.** Mobile path uses a single-column form. Resolver
  review sidebar is `hidden md:block`; mobile gets the row list
  alone.
- **Settings/search** + **Settings/account**. Both already use
  `max-w-[760px] px-5 md:px-8` containers; the cards stack cleanly
  on narrow viewports.
- **Watchlist filter rail.** Already collapses to the mobile Sheet
  via the existing `hidden md:block` on the rail container; the
  filter sheet trigger lives in the top bar as expected.

## Verifying

The `bun run dev` flow on a 375 viewport in Chromium reproduces the
before/after states. With the maintainer's signed-in session, navigate
to the live `https://cinemood.sayantan.cloud/`, then resize via
DevTools' device toolbar (Ctrl+Shift+M, set width to 375). Toggle to
dark theme. (The original `docs/responsive-shots/` before/after
capture folder has since been deleted — see the archive header
above.)

## Updates to `docs/local-smoke.md`

Added a "mobile" lane covering the same flows (load watchlist, open
palette, switch to Find, tap a card to open detail, sign-out) at
375 px. The flows are identical to desktop — only the visual
chrome reflows.
