> **Archived 2026-05-12.** The critical audit of the first Cinemood build that motivated the editorial-cinematic redesign. The audit's findings have all been addressed; this document remains for context on the design pivot.

# Design audit — current watchlist page

Screenshots in `docs/audit-shots/` taken at 1440×900 against the running dev server (`bun run dev`) with the seeded `u_smoke` session.

| # | File | Surface |
|---|------|---------|
| 1 | `01-landing.png` | Logged-out landing, **light** theme (system default) — exposes the broken light theming |
| 2 | `02-home-populated.png` | Watchlist with 8 titles, **light** theme — illustrates the same break on the main page |
| 3 | `03-home-populated-dark.png` | Watchlist with 8 titles, **dark** theme — what the previous build optimised for |
| 4 | `04-settings-dark.png` | `/settings/search` |
| 5 | `05-import-dark.png` | `/import` |
| 6 | `06-404-dark.png` | 404 page |
| 7 | `07-home-empty-dark.png` | Watchlist empty state |

---

## a. The page's ONE primary job

**Show the user's watchlist.** Search and Add are how content gets in; finding-by-mood is how content gets back out. Both are means, not ends. The watchlist itself is the artifact the user comes back for.

The current home page makes "Find by mood" and "Add to your watchlist" co-equal headlined sections, with "My watchlist" as a third equal section beneath them. The hierarchy is inverted.

---

## b. What gets visual priority right now vs. what should

| | Now (rank by vertical position + heading weight) | Should be |
|---|---|---|
| 1 | "Find by mood" header + big NL search bar | The watchlist grid, full-width |
| 2 | "Add to your watchlist" header + big TMDB search bar | A faceted filter rail and active-chip strip |
| 3 | "My watchlist" header + filter chips + grid | An icon-only top bar with: brand, ⌘K palette trigger, theme toggle, avatar |
| 4 | (no detail surface) | Detail modal opened by clicking a poster |

The two stacked search bars (NL search and TMDB add) take up the entire viewport above the fold at 1440×900 — the user has to scroll past them to see anything from their actual watchlist.

---

## c. Every problem worth naming

**Hierarchy & information architecture**
1. Three stacked sections ("Find by mood" / "Add to your watchlist" / "My watchlist") is the canonical AI-slop layout — undifferentiated H2s with equal weight, equal whitespace, equal-width inputs. The watchlist (the page's job) is buried below two search inputs.
2. The two search inputs share a near-identical visual treatment (same height, same border, same backdrop blur). The user can't pre-attentively tell them apart; the only difference is the placeholder text.
3. There is no dedicated detail surface. Clicking a card slides a "Watched / Remove" panel down beneath it, which is a weird gesture and surfaces only the destructive actions. There's nowhere to see the synopsis, cast, runtime, or providers — even though the API already returns them.
4. The header is a tiny wordmark on the left and a pill on the right; the rest of the 1440-wide bar is empty. The page has no command surface, no search icon, no add icon, no shortcut hints.

**Affordances**
5. Filter chips are one undifferentiated row mixing semantic axes — status, type, genre, year — separated by a thin vertical divider. There's no faceted-filter pattern, no multi-select for genre, no range slider for year or rating, no provider filter, no decade quick-chips.
6. "Watched" status is communicated by a small green pill on the poster corner that is easy to miss; the rest of the card is identical to a pending one. Watched titles should desaturate or carry a clearer typographic signal.
7. There are no keyboard shortcuts anywhere. No `⌘K`, no `/` for filter focus, no `W` to mark watched, no `Esc` to close.
8. Cards have no hover synopsis, no quick actions on hover, no rating breakdown on hover. The poster is just a poster.

**Empty state**
9. Empty watchlist renders as a single glass card with the sentence "Your watchlist is empty. Search above to add something." There's no illustration, no Lottie, no first-run welcome. §9 of `claude-instructions.md` now *requires* a Lottie at empty state — the build has none.

**Motion**
10. There is no motion system. Framer Motion is used ad-hoc in `home.tsx`, `landing.tsx`, `nl-search.tsx`, `watchlist-grid.tsx`, etc., each hard-coding `transition={{ type: 'spring', stiffness: 240, damping: 24 }}` or a per-component stagger. There is **no `useReducedMotion()` integration anywhere** in `apps/web/src`. Users with `prefers-reduced-motion: reduce` still get the full animation suite, which §9's hard rules explicitly forbid.
11. The hover affordance on cards is a `motion.button whileHover={{ scale: 1.02 }}` — fine in isolation, but unmoderated by reduced-motion config.
12. Stagger delays are computed as `Math.min(i * 0.03, 0.4)` per item; with 50+ items the last items appear 400ms late on mount — borderline on the 300ms ceiling and worse with reduced motion turned on (since the cap doesn't apply at all).

**Theming / dark + light**
13. **Light mode is completely broken.** Every text class in the codebase is `text-white/...`. Light bg + white text = invisible. Shot 01 and 02 are essentially blank pages; only the cards themselves render. `globals.css` defines `--fg: #14141a` for light but no component reads from `var(--fg)` — they all read from `text-white/65` etc. The `dark:` variant counterparts are missing.
14. The avatar-menu dropdown is hardcoded dark-only (`bg-[#15151c]/90`, `border-white/15`, `text-white/50`); it would be unreadable in light theme even if the rest were fixed.
15. The theme toggle defaults to "Auto" — but a user on a light-mode system gets the broken light render and has to manually flip to "Dark" to see anything. The cycle button doesn't communicate "your current rendering looks broken; click here."

**Accessibility**
16. No focus styles beyond the browser default — visible-focus rings are missing on the search inputs, the filter chips, and the avatar button.
17. The avatar uses `alt=""` (decorative), which is right, but then the only fallback when the image fails is a single-letter initial in a circle — no `aria-label` on the button reflecting the user's actual name, no live-region for the menu open state.
18. Filter chips are `<button>` elements but the active state is communicated only via colour + border opacity, not `aria-pressed`. A screen-reader user can't tell which filter is active.

**SEO / metadata**
19. Tab title is just `Cinemood`. The user wants `Cinemood — your watchlist, by mood`.
20. The favicon is the placeholder gradient triangle from Phase 0 — fine but generic; not aligned with whatever final aesthetic the redesign commits to.

---

## d. Why the Google avatar isn't rendering

Confirmed by inspecting `apps/web/src/components/avatar-menu.tsx:21`:

```tsx
<img
  src={user.picture}
  alt=""
  className="h-7 w-7 rounded-full object-cover"
/>
```

There is **no `referrerPolicy` attribute** on the `<img>`. Chrome (and Firefox) default to `strict-origin-when-cross-origin`, so the request for `https://lh3.googleusercontent.com/...` goes out with `Referer: http://localhost:5173/`. Google's user-content CDN rejects that for many account pictures with a 403, the `<img>` errors silently, and the browser falls back to alt text — except `alt=""` means nothing renders. The grey-circle fallback I built only fires when `user.picture` is falsy, not when the image *fails to load*.

**Two fixes, applied together:**
1. Add `referrerPolicy="no-referrer"` to the `<img>` (or use shadcn `<Avatar>` whose `<AvatarImage referrerPolicy="no-referrer" />` does the same).
2. Wire `<AvatarFallback>` (or an `onError` handler that falls back to the initials block) so a missing or 403'd image still shows the initial. This is the second line of defence.

---

## e. What the current motion design does wrong vs. §9

Most concretely:

- **No `useReducedMotion()` anywhere.** Grep the codebase: zero hits. §9 says it must be respected globally; the build ignores it.
- **No motion config single source of truth.** Every Framer Motion site hard-codes `{ type: 'spring', stiffness: 240, damping: 24 }`. §9 prescribes a per-surface motion table; the build has none.
- **Stagger overshoots the duration ceiling.** `Math.min(i * 0.03, 0.4)` per item means the last visible card lands 400ms after mount — over the 300ms component ceiling.
- **No durations are explicit.** Spring physics is used everywhere, which makes per-surface tuning impossible. §9 wants explicit durations for fades and tweens; the build only uses springs.
- **No card-tap motion on mobile.** §9 specifies a 100ms scale-0.98 press; the build's `whileHover={{ scale: 1.02 }}` doesn't fire on touch.
- **The decorative gradient mesh** in `page-shell.tsx` is static (so it doesn't technically violate "no moving gradients"), but it occupies the entire viewport on every page including settings, import, and 404, which makes every screen feel like the same screen. §9 wants visual identity per surface; the build commits to one ambient background and reuses it everywhere.

In short: the build *uses* Framer Motion, but it has no motion *system*, no reduced-motion contract, and no concept of which motion fits which surface.

---

## What the redesign needs to do, in one sentence

Make the watchlist the page — turn search and add into icon affordances behind a `⌘K` command palette, replace the chip wall with a real faceted filter rail, give cards a hover synopsis and a click-to-open detail modal, fix the light theme so it's actually shippable, install a motion system gated through `useReducedMotion`, fix the Google avatar with `referrerPolicy="no-referrer"`, and commit to a single aesthetic direction with character — chosen with the `frontend-design` skill, not defaulted to glassmorphism.
