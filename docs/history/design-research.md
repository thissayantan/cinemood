> **Archived 2026-05-12.** Dribbble / Letterboxd / Criterion-Collection research that shaped the editorial-cinematic direction. Reference notes only.

# Design research — what to borrow, what to skip

Compiled before committing to an aesthetic direction. Each reference gets one line on what's worth lifting and one on what to avoid.

## Watchlist / library product patterns

1. **Letterboxd film grid** — [letterboxd.com/films](https://letterboxd.com/films/) and any user's `/watchlist`.
   *Borrow:* the poster-grid-as-gallery (films represented by poster art, not text-heavy rows); the "eye" icon at the grid header that opens a comprehensive filter rail with a slash through it when filters are active; hover-state colour codes (green = watched, blue = in watchlist) so status is pre-attentive even at a glance.
   *Skip:* the dense filter accordion stuffed with social/visibility toggles that aren't relevant for a personal app; the heavy reliance on the user's avatar-grid in the chrome.

2. **Letterboxd Grid/List view toggle on lists** — [a real 2026 watchlist list](https://letterboxd.com/glitterw1tch/list/2026-watchlist/).
   *Borrow:* a single toggle between gallery grid and a denser list view so the same watchlist can be browsed either way. Default to grid.
   *Skip:* list view becoming the de-facto default for power users — keep grid as the primary surface.

3. **Trakt watchlist** — generic UI, dense list, columns for year + rating + runtime. Couldn't deep-link via WebFetch (`403`) but the public pattern is well known.
   *Borrow:* visible-rating in a fixed column or chip; the affordance of seeing runtime at a glance for "I have 40 minutes" decisions.
   *Skip:* the cramped row density and dated brand chrome.

4. **Criterion Collection shop / catalog** — [criterion.com/shop/browse/list?sort=spine_number](https://www.criterion.com/shop/browse/list?sort=spine_number), and the [history of the spine number](https://oncriterion.wordpress.com/2015/11/16/criterionblogathon-criterion-collection-and-the-spine-number/).
   *Borrow:* THE spine number as identity. Every title in the Criterion Collection carries a numeric spine that loosely tracks release order — it makes each title feel cataloged and collectible. The site lets you sort by spine number specifically because that's the artifact people actually want. **Cinemood will steal this wholesale**: every watchlist add gets a monospace catalog number (e.g. `C-0042`) that becomes the single unforgettable visual signature.
   *Skip:* the commerce-shop framing and the editorial essay sidebars.

5. **Criterion typography** — see [Fonts In Use](https://fontsinuse.com/tags/417/criterion-collection).
   *Borrow:* the editorial-serif + monospace combination Criterion has used across packaging for decades; the catalog feels typographic, not photographic.
   *Skip:* trying to reproduce the exact Criterion typeface (URW's "Criterion" by Phil Martin is paid).

6. **Plex library** — [Using the Library View | Plex Support](https://support.plex.tv/articles/200392126-using-the-library-view/) and the [filter docs](https://support.plex.tv/articles/200484203-interface-overview/).
   *Borrow:* the quick-filter dropdown that exposes common axes (genre, year, status), with a "custom" escape hatch that builds compound filters ("unplayed × Drama × 2013"). The multi-select gesture on poster cards (hover → top-left circle) for bulk operations.
   *Skip:* the marketing-heavy hub layout above the library; the always-present sidebar.

7. **Apple TV+ catalog** — direct fetch blocked; pattern is well-known.
   *Borrow:* the ambient backdrop image lifted from the focused title (a soft, low-contrast wash behind the grid that subtly shifts as the user hovers), and large-poster grid with restrained typography.
   *Skip:* the autoplaying trailer previews on hover — way too loud for a watchlist tool, and a §9 motion violation.

8. **Netflix library rows** — pattern is well-known.
   *Borrow:* almost nothing for a personal watchlist. The horizontal-rail-of-rails forces a recommendation feed, which is the opposite of what Cinemood is for.
   *Skip:* hover-autoplay trailers, every "Top 10" / "Trending" rail, the entire chrome.

9. **Mobbin library / movie-app screen sets** — [mobbin.com](https://dribbble.com/mobbindesign) (their Dribbble showcases the same sets).
   *Borrow:* a single tasteful command surface (search + filter + sort condensed into one bar); detail modal opened by tapping a card; quick actions surfaced on hover/long-press.
   *Skip:* iOS-specific chromes that don't translate to a desktop-first web app.

10. **Dribbble — Movie / Movie App / Watchlist tags** — collated landing pages [movie-list](https://dribbble.com/tags/movie-list), [movie-app-design](https://dribbble.com/tags/movie-app-design), [watch-list](https://dribbble.com/tags/watch-list).
    *Borrow:* the recurring editorial-pairing of a serif display face (Playfair, Fraunces, Cormorant) against either a mono or a refined sans, on a near-black background with a single warm accent.
    *Skip:* the concept-shot conventions (oversized hero with no real chrome, fake metadata, no empty / error states) — those are mood boards, not real UIs.

## Aesthetics cookbook (Anthropic Frontend Aesthetics Cookbook)

Notebook: [`coding/prompting_for_frontend_aesthetics.ipynb`](https://github.com/anthropics/claude-cookbooks/blob/main/coding/prompting_for_frontend_aesthetics.ipynb). The fetched cells call out:

- **Avoid:** Inter, Roboto, Open Sans, Lato, system fonts; purple-gradient-on-white; centred-stack landing pages; "Space Grotesk for everything" as a recurring AI default.
- **Impact font choices by tone:** Editorial → *Playfair Display, Crimson Pro, Fraunces*. Code → *JetBrains Mono, Fira Code, Space Grotesk*. Editorial-distinctive → *Newsreader*. Startup → *Clash Display, Satoshi, Cabinet Grotesk*.
- **Pairing principle:** high contrast wins (display + monospace; serif + geometric sans; variable font across optical sizes).
- **Weight extremes:** 100/200 vs 800/900, not 400 vs 600. Size jumps 3× or more, not 1.5×.
- **Page-load orchestration > scattered micro-interactions:** one well-staged entrance lands harder than ten ambient hovers.
- **Backgrounds:** atmosphere via layered gradients, subtle noise/grain, geometric pattern — not flat fills, not radial-mesh defaults.

## The aesthetic direction this points to

The references converge on one direction with character: **editorial-cinematic, structured around a Criterion-style catalog numbering**. A variable serif display (Fraunces) doing the heavy lifting across optical sizes, JetBrains Mono for catalog numbers and metadata badges, a near-black ink background with a single restrained warm accent (cinema red), and the unforgettable detail — every saved title gets a `C-NNNN` spine number that turns the watchlist into the user's personal Criterion shelf.

Sources:
- [Letterboxd: Cinema as Social Object](https://blakecrosley.com/guides/design/letterboxd)
- [The Criterion Collection — Shop All Films](https://www.criterion.com/shop/browse/list?sort=spine_number)
- [Criterion Collection on Fonts In Use](https://fontsinuse.com/tags/417/criterion-collection)
- [Plex Library View](https://support.plex.tv/articles/200392126-using-the-library-view/)
- [Plex Interface Overview](https://support.plex.tv/articles/200484203-interface-overview/)
- [Mobbin design library on Dribbble](https://dribbble.com/mobbindesign)
- [Dribbble Movie App Design tag](https://dribbble.com/tags/movie-app-design)
- [Anthropic Frontend Aesthetics Cookbook](https://github.com/anthropics/claude-cookbooks/blob/main/coding/prompting_for_frontend_aesthetics.ipynb)
