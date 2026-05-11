# Cinemood — design plan (v2)

The watchlist is the page. Everything else is an icon or a modal. The aesthetic is committed to up front; the motion contract is one source of truth; the empty state is welcoming; the avatar isn't broken. This document is the contract — implementation starts only after explicit approval (per Step 4).

---

## a. Aesthetic direction

**Direction: editorial-cinematic, Criterion-catalog backbone.**

Imagine a private cinephile's library shelved by an obsessive curator. Each title is *numbered* like a Criterion spine, presented as an object of attention rather than a feed item. The chrome is restrained; the typography does the work. The single unforgettable detail is the spine number.

### Typography pair
| Role | Family | Why |
|---|---|---|
| Display (page titles, modal titles, signature wordmark) | **Fraunces** (Google Fonts, variable: `opsz` 9–144, `wght` 100–900, `soft` 0–100) | Editorial serif with optical sizing — the same family looks delicate at 12px and weighty at 96px. Carries warmth without going Playfair-pastiche. |
| Body (all UI text — buttons, descriptions, menu items) | **Fraunces** at `opsz` 14, `wght` 400, `soft` 40 *or* a paired sans **IBM Plex Sans** (Google Fonts) when copy density gets too long for serif. | Single-family-first keeps the editorial voice consistent. Fallback to Plex Sans on long synopsis copy / API output / form fields where serif would tire the eye. |
| Mono (catalog numbers, year, runtime, rating, command-palette hints) | **JetBrains Mono** (Google Fonts, `wght` 400 / 600) | Sharp, characterful, no-nonsense. Used exclusively for *artifacts* — never for sentence copy. |

Weight extremes are real: page titles render at Fraunces 144/8/40 (opsz/wght100/soft); body at Fraunces 14/4/40; section labels at Fraunces 9/6 ALL CAPS with `letter-spacing: 0.14em`.

### Color palette

Two themes. Same accent. CSS variables map every literal.

**Dark (default in low-light, the cinema-room mode):**
- `--ink`: `#0A0908` — true black with a hair of warmth.
- `--paper`: `#F2EBDD` — warm cream foreground / surface text.
- `--paper-dim`: `#F2EBDD` at 70%.
- `--paper-faint`: `#F2EBDD` at 38% (captions, dividers).
- `--rule`: `#F2EBDD` at 14% (hairline rules).
- `--surface-1`: `#13110E` (cards on dark ink).
- `--surface-2`: `#1A1814` (elevated panels, command palette).
- `--accent`: `#C8302A` — vintage projection-lamp red. Used SPARINGLY: focus ring, active filter chip, watched-status checkmark glyph, command-palette caret.
- `--accent-glow`: `#C8302A` at 22% (focus halo only).

**Light (the matinée mode):**
- `--ink`: `#F2EBDD` → swapped role: cream as the page; ink as the type.
- `--paper`: `#1A1814` (text).
- `--paper-dim`: `#1A1814` at 72%.
- `--paper-faint`: `#1A1814` at 44%.
- `--rule`: `#1A1814` at 12%.
- `--surface-1`: `#EFE7D6`.
- `--surface-2`: `#E6DCC7`.
- `--accent`: `#A8221C` — slightly darkened red for AA contrast on cream.
- `--accent-glow`: `#A8221C` at 18%.

System default: `prefers-color-scheme`. Toggle cycles `system → light → dark`.

Both themes must hit WCAG AA on body copy.

### The ONE unforgettable thing

**Spine numbers.** Every saved title is assigned an auto-incrementing catalog number scoped to the user (`C-0001`, `C-0002`, …). The number is stamped in JetBrains Mono on the poster card's lower-left, on the detail modal header, and inside the command palette result rows. It persists through filtering and sorting. The watchlist isn't a list — it's *your collection*, numbered.

(Implementation: store `catalog_no INTEGER` on the `watchlist` row, auto-assigned at insert via `MAX(catalog_no)+1` per user; render as `C-${str.padStart(4,'0')}`.)

---

## b. Page anatomy

The watchlist is the page. The chrome is a single icon-only top bar; the entry points for search and add are condensed into one shadcn `<Command>` palette opened by `⌘K` / `Ctrl K`. The page consists of three regions, in this stack:

1. **Top bar (sticky, 64px).**
   - Left: wordmark `Cinemood` in Fraunces 24/8, followed by a `C-####` showing the user's latest spine number ("currently at C-0042" — tiny mono caption).
   - Center: an unobtrusive `⌘K` chip — "Search or add… ⌘K" — that opens the command palette on click.
   - Right: theme cycler (`Auto/Light/Dark`), avatar menu (fixed).
2. **Active-filter chip strip (auto-hide when empty).** A row that shows currently-active filters as removable chips above the grid. When no filters are active, the strip collapses to a single-line summary: `42 titles · sorted by recently added`.
3. **The watchlist itself.** On desktop, a *split layout*: 280px persistent filter rail on the left, fluid poster grid on the right (2 / 3 / 4 / 5 columns at sm/md/lg/xl). On mobile, the filter rail becomes a sheet opened by a filter icon in the top bar; the grid takes full width at 2 / 3 columns.

The command palette (single component handling both adding AND finding) is the page's input affordance. The user opens it with `⌘K`, gets a mode chip at the top right showing `Add` (TMDB search → add) or `Find` (NL search of your watchlist), toggled with `Tab` or by clicking the chip. The same input string drives whichever mode is active.

Nothing else gets a heading-sized section. There is no separate `/import` route in the chrome — Import is invoked from the avatar menu and surfaces as a full-screen modal sheet.

---

## c. Keyboard shortcuts (complete list)

| Shortcut | Surface | Action | Notes |
|---|---|---|---|
| `⌘K` / `Ctrl K` | Anywhere | Open command palette | Same handler regardless of focus context. Restores last mode (Add / Find). |
| `Tab` | Inside palette | Toggle Add ↔ Find mode | Cycles through the two modes; doesn't blur the input. |
| `Esc` | Palette / modal / sheet | Close the topmost modal | Returns focus to the previously-focused element. |
| `/` | Watchlist page | Focus the filter rail's quick-search input | Mirrors GitHub / many editorial tools; doesn't conflict with palette. |
| `W` | Focused card | Toggle watched / pending | Only when a card has visible focus (keyboard nav). Letter is mnemonic for "watched". Not capturable inside an input. |
| `Del` / `Backspace` | Focused card | Remove from watchlist (with confirm) | Confirm via inline Sheet, not a native confirm dialog. |
| `↑` `↓` `←` `→` | Watchlist grid | Move focus between cards | Standard keyboard grid nav via roving tabindex. |
| `Enter` / `Space` | Focused card | Open detail modal | Mirrors `aria-haspopup="dialog"`. |
| `G` then `H` | Anywhere | Go Home (watchlist) | Two-key sequence; mnemonic for "Go Home". |
| `G` then `I` | Anywhere | Go to Import | "Go Import". |
| `G` then `S` | Anywhere | Go to Settings | "Go Settings". |
| `?` | Anywhere | Open the shortcuts cheat-sheet modal | Shift+/ on US keyboards; alternative is `Shift K`. |

**Conflict check:** `W`, `/`, `?` are single-character shortcuts; they only fire when no `<input>` / `<textarea>` / `[contenteditable]` has focus. The two-key `G` sequence uses a 1.5s timeout — a stale `G` quietly times out. `⌘K` and `Esc` always fire. `Tab` only re-routes inside the palette; outside, native tab navigation works untouched.

---

## d. Filters — a real faceted rail

Desktop: persistent 280px rail on the left of the grid. Mobile: shadcn `<Sheet>` opened from a filter icon in the top bar; same component, same state, same chips.

| Filter | Type | UI | Backend |
|---|---|---|---|
| **Type** | enum | Two-pill toggle: `Movies` / `Series` (multi-select; both off = both on). | `?type=movie` or `?type=series` (or both). |
| **Status** | enum | Three pills: `All` / `To watch` / `Watched`. | `?status=pending` or `?status=watched`. |
| **Genres** | enum[] multi | Stacked checkbox list of all genres seen in the user's watchlist (derived client-side from loaded titles), with a "show 5 more" expand. | `?genre=` extended to accept comma-separated; backend handles `containsAny`. |
| **Release year** | range | Range slider 1920–current year + decade quick-chips below (`'70s · '80s · '90s · '00s · '10s · '20s`). | `?year_min=` `&year_max=` (new); decade chips set both. |
| **Rating** | range | Single slider 0–10 with a `≥ X` label that updates as you drag. Also TMDB or IMDb selector (defaults to TMDB). | `?min_rating=` (new). |
| **Runtime** | range | Range slider 0–240 min, snap to 15-min steps. | `?runtime_min=` `&runtime_max=` (new). |
| **Providers** | enum[] multi | List built from the union of `titles.providers` JSON across the user's watchlist, with provider icon + name. | `?provider=` repeatable (new). |
| **Sort** | enum | Select: `Recently added` (default) / `Title A–Z` / `Year (newest)` / `Year (oldest)` / `Rating (highest)` / `Spine number`. | `?sort=` (new). |

A "Reset filters" button at the foot of the rail clears all of the above. Active filters render as removable chips above the grid (region 2). Each chip's `×` is keyboard-accessible.

---

## e. Card design

2 : 3 poster ratio (TMDB native). The card is the poster image plus a slim 36px metadata strip below.

**Visible at rest:**
- Poster image (objectfit: cover, lazy-load).
- Top-left: catalog number badge — JetBrains Mono 11/600, cream on a translucent ink chip with a hairline rule (`C-0042`).
- Top-right: type glyph — film reel (movie) or TV monitor (series), 14px line icon, no fill.
- Bottom-right (over poster, 8/8 inset): watched indicator — a small monogram `✓` in the accent red, draw-in animation on first watch.
- Below poster, 36px strip: title (Fraunces 14/600, opsz 14) on left, year + rating in mono (`2010 · ★ 8.4`) on right.

**Hover (desktop, ≥768px):**
- 150ms ease-out scale to 1.015 — *not* 1.05; we are not a casino.
- A tinted ink gradient (`linear-gradient(180deg, transparent 0%, rgba(10,9,8,0.92) 50%, rgba(10,9,8,0.97) 100%)`) overlays the poster.
- Synopsis truncated to ~3 lines in Fraunces body, plus a mono row with runtime + provider chips.
- Two quick-action icon buttons (`Watched`, `Remove`) appear in the upper-right of the overlay, never on the poster portion that matters.
- Cursor becomes the focus indicator on the entire card.

**Long-press (touch):** Same overlay surfaces, fades in at 200ms; tap-outside or another tap dismisses.

**Watched state:** card poster desaturates to 0.65 saturation + tinted ink wash; the catalog-number chip darkens to half-opacity; the rating row becomes mono in `--paper-faint`. *Pre-attentive* — you can tell a watched card from a pending one without reading the chip.

**Focus state:** a 2px `--accent` ring at `outset` with 6px `--accent-glow` halo. The poster doesn't move on focus (motion belongs to hover).

---

## f. Detail modal

Click / Enter on a card → shadcn `<Dialog>` opens with a **Framer Motion shared-layout transition** from the card poster to the modal's hero. The modal occupies a centred 920px container on desktop, full-bleed on mobile.

**Modal anatomy (top to bottom):**

1. **Backdrop image** — TMDB `backdrop_path` rendered as a 1920×540 hero with a `linear-gradient` mask that fades the bottom half into `--surface-1`. Subtle, low-contrast — does not compete with copy.
2. **Header row** (overlaying the bottom of the backdrop):
   - Left: poster at 132×198, with the spine number badge in the top-left.
   - Center: Fraunces 56/800, title; below it Fraunces 14/400 italic, original title (if different).
   - Right: a vertical stack of small mono labels — year, runtime, type, IMDb tag.
3. **Action bar** — right-aligned icon buttons: `Mark watched` / `Unmark watched`, `Remove`, `Open on TMDB` (external link with anti-clickjack rel attrs).
4. **Synopsis** — Fraunces 16/400, soft 40, max 720px wide. No truncation.
5. **Ratings panel** — small horizontal bar showing TMDB rating, IMDb rating (when present), and vote count, each in mono with a tiny sparkline-style filled bar.
6. **Genres** — mono uppercase chips (`SCIENCE FICTION · DRAMA · MYSTERY`), separated by interpunct.
7. **Cast** — top-six actors in a flex-wrap row, each as a small avatar (or a Fraunces initial fallback) + name + character in muted mono.
8. **Streaming providers** — small grayscale provider icons (TMDB watch-provider URLs) in a row, with a region selector chip (`Showing: US · change`).

Closes on `Esc`, on backdrop click, or on the explicit `×` icon top-right. Returns focus to the card that opened it.

---

## g. Empty state

When `watchlist.length === 0`, instead of a glass card, the grid region shows:

- A 320×320 Lottie animation: a film reel slowly unspooling.
- Fraunces 36/800 copy: **"An empty reel."**
- Fraunces 16/400 sub-copy: **"Your collection starts here. Press ⌘K to add your first film."**
- A subtle "or" divider with a small `Import` link below.

The Lottie loops slowly (4.5s cycle) at 0.7× speed, pauses at frame 0 if `prefers-reduced-motion: reduce`. Lazy-loaded via dynamic import so it doesn't block initial paint.

---

## h. Motion specification, per surface

Single source of truth at `apps/web/src/lib/motion.ts`. Exports `useMotionConfig()` which checks `useReducedMotion()` and returns a frozen config object. Every Framer Motion site imports from this — no hardcoded `transition={...}`.

| Surface | Duration | Easing | What animates | Reduced-motion fallback |
|---|---|---|---|---|
| Page / route transition | 200ms | `cubic-bezier(0.16, 1, 0.3, 1)` | Cross-fade `opacity` only | 0ms (instant) |
| Modal / dialog open | 220ms | spring `{stiffness:240, damping:24}` | Scale `0.96 → 1`, opacity `0 → 1`, backdrop blur `0 → 14px` | Snap, blur instant |
| Modal close | 160ms | `cubic-bezier(0.4, 0, 1, 1)` | Reverse open | Snap |
| Command palette open | 220ms | spring | Content slides up 12px + opacity in; backdrop blur ramps in | Snap, blur instant |
| Card hover (desktop) | 150ms | ease-out | Scale 1 → 1.015 + box-shadow lift | None |
| Card tap (mobile) | 100ms | ease-out | Scale 1 → 0.98, release back to 1 over 120ms | None |
| Card hover overlay | 180ms | ease-out | Overlay opacity 0 → 1 | Overlay opacity 1 (always visible) |
| Filter chip add / remove | 200ms | `LayoutGroup` reflow | Layout shift + chip opacity | Instant reflow |
| Grid mount stagger | 60ms per item, capped at 240ms total | spring | `y: 8px → 0` + opacity `0 → 1` | All items appear at once |
| Watched / unwatched toggle | 250ms | ease-out | Checkmark `pathLength: 0 → 1` draw-in; card desaturation cross-fade | Instant cross-fade |
| Theme toggle | 250ms | ease-in-out | Full-surface cross-fade between two `<html>` class snapshots | 0ms cross-fade |
| Toast / status feedback | 200ms in, 150ms out, auto-dismiss 3s | spring in, ease-out out | Slide-in from top 12px + opacity | Snap |
| Lottie (empty / 404 / welcome) | Native (Lottie JSON timing) | n/a | Loop / play-once as specified | Frozen on frame 0 |

**Reduced-motion contract:**
- `useReducedMotion()` is read at the App root and passed via React Context (`MotionConfigProvider`).
- Every motion site calls `useMotionConfig()` which returns `{ duration, easing, stagger, fadeY, scaleHover, blurOpen }`.
- When `reduced === true`, `duration` collapses to 0, `stagger` to 0, `fadeY` to 0, `scaleHover` to 1, `blurOpen` to 0.

No floating shapes. No moving gradients. No pulsing CTAs. No idle rotations. No parallax. No scroll-triggered wow reveals.

---

## i. Lottie placements

| Placement | Required by | Search query / specific source | Looping | Reduced-motion |
|---|---|---|---|---|
| **Empty watchlist** | §9 | LottieFiles → "film reel unspool" or "vintage projector loop", filter Free + Commercial, ≤80KB. *Implementing component records the final URL in a code comment.* | Yes, 4.5s cycle | Pause on frame 0 |
| **404 page** | §9 | LottieFiles → "broken film strip" or "cinema seat empty", same filters. | Yes | Pause on frame 0 |
| **First-time sign-in welcome** | §9 | LottieFiles → "marquee lights flicker on" or "curtain opening", same filters. Plays once, then `localStorage.setItem('cm_welcome_seen','1')`. | Play once | Frozen first frame |
| **Optional — add success toast** | §9 optional | LottieFiles → "checkmark ribbon"; ≤2s; ≤30KB. Only used if a static check would feel inert. | Once | Skip the Lottie, use a CSS check |
| **Optional — NL search waiting** | §9 optional | Only if the LLM call takes >500ms (measured client-side); use a "thinking cursor" or "loading reel" ≤40KB. Otherwise a CSS shimmer. | Loop while pending | Replace with shimmer |

All Lottie JSONs are loaded via `@lottiefiles/react-lottie-player` and dynamically imported (`React.lazy` + `Suspense`). The 80KB cap is checked at PR time via the file-size linter (a simple `bun run check:lottie` script greps `apps/web/src/lottie/*.json` and fails if any exceeds 80×1024 bytes).

---

## j. Avatar fix

Two layers of defence; both ship.

```tsx
// apps/web/src/components/avatar-menu.tsx — header pill
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";

<Avatar className="h-8 w-8 rounded-full">
  {user.picture ? (
    <AvatarImage
      src={user.picture}
      alt={user.name ?? user.email}
      referrerPolicy="no-referrer"
    />
  ) : null}
  <AvatarFallback className="bg-[var(--surface-2)] text-[var(--paper-dim)] font-mono text-[11px] uppercase">
    {(user.name ?? user.email).slice(0, 2)}
  </AvatarFallback>
</Avatar>
```

- `referrerPolicy="no-referrer"` makes `lh3.googleusercontent.com` accept the request (no cross-origin Referer header).
- shadcn's `<AvatarFallback>` automatically renders if the `<img>` fails to load (in addition to when `src` is null), so a 403'd image still shows initials.
- The fallback uses mono so it visually rhymes with the catalog numbers.

The same `<Avatar>` shows up in the detail-modal cast row (where each actor's TMDB profile photo is also a `referrerPolicy="no-referrer"` image with first-initials fallback).

---

## k. Tab title and favicon

- `<title>Cinemood — your watchlist, by mood</title>` in `apps/web/index.html`. Dynamic per-route titles via a small `<RouteTitle>` component: `/` → "Cinemood — your watchlist", `/import` → "Import · Cinemood", `/settings/search` → "Search settings · Cinemood".
- Favicon: a new SVG generated from the aesthetic — a single Fraunces-rendered `C` with the spine-number underline. 32×32 raster fallback from a `favicon.io` upload. Source file at `apps/web/public/favicon.svg`. Apple-touch-icon at 180×180 PNG.

---

## l. ASCII wireframe — desktop, populated watchlist

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  Cinemood   c-0042   ⌘K Search or add…                  ◐ Auto    [A] Sanyam│  ← top bar, 64px
├──────────────────────────────────────────────────────────────────────────────┤
│  Type: Movies × | Status: To watch × | Genres: Sci-Fi × Drama × | 1990–2025 ×│  ← active chips
│  42 titles · sorted by recently added                                Reset all│
├────────────┬─────────────────────────────────────────────────────────────────┤
│ FILTERS    │   ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐                  │
│            │   │poster│ │poster│ │poster│ │poster│ │poster│                  │
│ Type       │   │C-0042│ │C-0041│ │C-0040│ │C-0039│ │C-0038│                  │
│ [M] [S]    │   │      │ │      │ │      │ │      │ │      │                  │
│            │   └──────┘ └──────┘ └──────┘ └──────┘ └──────┘                  │
│ Status     │    Title    Title    Title    Title    Title                    │
│ All To Wat │    2010 ★8  2013 ★7  …                                          │
│ Watched    │                                                                 │
│            │   ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐                  │
│ Genres     │   │poster│ │poster│ │poster│ │poster│ │poster│                  │
│ □ Action   │   │      │ │      │ │      │ │      │ │      │                  │
│ □ Comedy   │   │      │ │      │ │      │ │      │ │      │                  │
│ ☑ Drama    │   └──────┘ └──────┘ └──────┘ └──────┘ └──────┘                  │
│ ☑ Sci-Fi   │                                                                 │
│ + show 4   │   …                                                             │
│            │                                                                 │
│ Year       │                                                                 │
│ [1990──2025]│                                                                │
│ '70s '80s  │                                                                 │
│ '90s '00s  │                                                                 │
│ '10s '20s  │                                                                 │
│            │                                                                 │
│ Rating     │                                                                 │
│ ≥ 7.0      │                                                                 │
│ [────●──]  │                                                                 │
│            │                                                                 │
│ Runtime    │                                                                 │
│ [──●───●─] │                                                                 │
│ 90–180min  │                                                                 │
│            │                                                                 │
│ Providers  │                                                                 │
│ ☐ Netflix  │                                                                 │
│ ☑ Apple TV+│                                                                 │
│ ☐ Max      │                                                                 │
│            │                                                                 │
│ Reset all  │                                                                 │
└────────────┴─────────────────────────────────────────────────────────────────┘
```

**Command palette (⌘K) wireframe — overlaid on the page:**

```
                       ┌───────────────────────────────────────────────┐
                       │ ⌘ ▍ inception 2010                  [Add | Find]│   ← mode chip top-right
                       │                                                │
                       │ ADD TO WATCHLIST                               │   ← Fraunces 9/600 caps
                       │ ┌──┐                                           │
                       │ │  │ Inception                  2010 · movie  │   ← TMDB result, mono right
                       │ └──┘                                           │
                       │ ┌──┐                                           │
                       │ │  │ Inception: The Cobol Job   2010 · short  │
                       │ └──┘                                           │
                       │                                                │
                       │ Tab → switch to Find · Esc → close             │   ← caption row
                       └───────────────────────────────────────────────┘
```

**Mobile filter sheet** (Sheet from right, 88vw):

```
┌───────────────────────────┐
│ FILTERS                ✕ │
├───────────────────────────┤
│ Type    [Movies] [Series] │
│ Status  [All][To watch][W]│
│ Genres  ☑ Drama ☑ Sci-Fi  │
│ Year    [1990 ─ 2025]     │
│ Rating  ≥ 7.0             │
│ Runtime [90 ─ 180]        │
│ Providers ☑ Apple TV+    │
│ Reset all                 │
└───────────────────────────┘
```

---

## Implementation checklist (for Step 5, once approved)

- [ ] Add `apps/web/src/lib/motion.ts` with `useMotionConfig()` + `MotionConfigProvider` reading `useReducedMotion()`.
- [ ] Add Fraunces + JetBrains Mono to `index.html` `<link rel="stylesheet">`; remove the existing Google Sans `<link>`.
- [ ] Rewrite `globals.css` with the two-theme CSS-variable system (no Tailwind-literal whites in components).
- [ ] Migrate `home.tsx` to the new layout (top bar + filter rail + grid; no stacked sections).
- [ ] New `command-palette.tsx` (shadcn `<Command>`); Add ↔ Find mode toggle.
- [ ] New `filter-rail.tsx` (desktop persistent) and mirror it in a shadcn `<Sheet>` for mobile.
- [ ] New `poster-card.tsx` with overlay + quick actions + spine-number chip.
- [ ] New `title-detail-dialog.tsx` (shadcn `<Dialog>`); shared-layout transition from card.
- [ ] New `empty-watchlist.tsx` with the Lottie + copy.
- [ ] New `not-found.tsx` revision with the Lottie.
- [ ] New `welcome-overlay.tsx` (first-sign-in only).
- [ ] Replace `avatar-menu.tsx` with shadcn `<Avatar>` and the `referrerPolicy="no-referrer"` fix.
- [ ] Add `<RouteTitle>` to set `<title>` per route; ship `apps/web/public/favicon.svg`.
- [ ] Add D1 migration `0002_catalog_no.sql` + the `MAX(catalog_no)+1` insert path; thread `catalog_no` through `WatchlistItem`.
- [ ] Extend `GET /api/watchlist` with `?year_min`, `?year_max`, `?min_rating`, `?runtime_min`, `?runtime_max`, `?provider` (repeatable), `?sort`.
- [ ] Keyboard hook: `useKeyboardShortcuts` registering the table from §c, respecting input-focus context.
- [ ] Add Lottie loader util with `prefers-reduced-motion` freeze; size-cap lint script `bun run check:lottie`.
- [ ] Update `docs/local-smoke.md` to include the new shortcuts and the spine-number invariant.

Per the autonomous-mode protocol, none of this code is written until Step 4 approval lands.
