# Phase 17 — Android: AI Assistant (Phase A) + Library Filters (Phase B)

## What was done

### Phase A — AI assistant rebuild + `/api/discover`

#### Backend
- Added `POST /api/discover` (`apps/api/src/routes/discover.ts`) — LLM-parses the user query via the
  existing `provider.parseQuery()` pipeline, then calls TMDB `discover/movie` and/or `discover/tv` using
  structured filter fields (genre IDs, rating, year range); falls back to keyword search for pure semantic
  queries.
- Extended `apps/api/src/lib/tmdb.ts` with: `MOVIE_GENRE_IDS` and `TV_GENRE_IDS` name→TMDB-id maps,
  `resolveGenreIds()` helper, `discoverTmdb()` function with KV cache (1-day TTL).
- Mounted the new route in `apps/api/src/index.ts`.
- Deployed to production: `cinemood.sayantan.cloud`.

#### Android — models + API client
- Added `ParsedQueryFilters`, `ParsedQuery`, `DiscoverResult` models with `@Serializable` + `@SerialName`.
- Fixed `SearchResult`: renamed `hits` → `results` (`@SerialName("results")`) so NL library search no
  longer silently returns empty.
- Added `CinemoodApi.discover()` using `bodyAsText() + json.decodeFromString` (CLAUDE.md learned rule for
  non-2xx generic Ktor paths).
- Fixed `CinemoodApi.nlSearch()` to the same `bodyAsText` pattern.

#### Android — UI
- **`AiSearchIcon`** (new): search glyph with `AutoAwesome` sparkle overlay at top-right — every AI-
  powered search surface shows this icon instead of a plain magnifier.
- **`AssistantFab`**: replaced plain `Icons.Rounded.Search` with `AiSearchIcon`.
- **`AssistantSheet`** (completely rebuilt, ~550 lines): full-screen `Dialog` (not a bottom sheet);
  `AssistantMode.Discover` / `Library` toggle; `AssistantState` sealed hierarchy (`Idle`, `Listening`,
  `Thinking`, `DiscoverResults`, `LibraryResults`, `NoResults`, `Error`); parsed-understanding chips row;
  shimmer thinking state; staggered card reveal (60ms per item); live voice listening state; conversational
  empty/no-result copy with mode-switch CTA. Reduced-motion honored throughout.

### Phase B — Library filters to full web parity

All filtering is **client-side** against the 500-item preload — no extra API calls.

#### New files
| File | Purpose |
|---|---|
| `ui/components/FilterSheet.kt` | 8-dimension `ModalBottomSheet`: Type, Status, Sort (8 modes), Genre chip cloud (faceted), Year RangeSlider + decade pills, Min Rating Slider, Runtime RangeSlider, Streaming provider chips (faceted ≤12) |
| `ui/components/ActiveChips.kt` | Horizontal removable chip bar with match count badge + Reset all |

#### Modified files
| File | Change |
|---|---|
| `ui/screens/WatchlistScreen.kt` | Full rewrite: `LibraryFilters` + `LibraryFacets` data classes, `SORT_LABELS` (8 sorts), `WatchlistViewModel` with `updateAllItems()` / `deriveFacets()` / `applyFilters()` / `sortItems()` / `removeItem()`, filter badge button, `ActiveChips` bar, live match count, grid |
| `ui/screens/DetailScreen.kt` | Added `onRemove?: (() -> Unit)` param + confirm `AlertDialog` + "Remove from library" button at bottom |
| `MainActivity.kt` | `updateAllItems(shared)` instead of `allItems = shared` (triggers facet recomputation); `removeFromCache()` helper; `onRemove` wiring to `DetailScreen` |

## Filter dimensions (web parity)

| Dimension | Web | Android (Phase B) |
|---|---|---|
| Type | ✅ | ✅ |
| Status | ✅ | ✅ |
| Sort (8 modes) | ✅ | ✅ |
| Genre (faceted) | ✅ | ✅ |
| Year range + decade pills | ✅ | ✅ |
| Min rating | ✅ | ✅ |
| Runtime range | ✅ | ✅ |
| Streaming providers (faceted ≤12) | ✅ | ✅ |
| Active chips + match count + reset | ✅ | ✅ |
| Remove from watchlist | ✅ | ✅ |

## Compile gate

```
./gradlew assembleDebug → BUILD SUCCESSFUL
```
One deprecation warning (`menuAnchor()` overload in FilterSheet) — harmless, API is stable.

## Lessons learned (appended to CLAUDE.md)

- `var x by mutableStateOf` + `fun setX()` → JVM signature clash. Fix: remove the explicit function and
  use the property setter only (or use private `_x` backing field if external callers need both styles).
- `FlowRow`/`FlowRowScope` still require `@OptIn(ExperimentalLayoutApi::class)` in Compose BOM 2024.12.01.
- Smart/curly quotes inside Kotlin string literals (`"`) cause parse errors — always use `\"` escapes.

## On-device QA checklist (deferred — device detached)

1. Discover mode: "dark sci-fi after 2015" → parsed chips (genre, type, year) + new addable titles streaming in with staggered reveal
2. Library mode: "comedies I saved" → library results (no empty results bug)
3. Voice: tap mic → live pulsing listening state → auto-runs on recognition
4. Library filter sheet: set genre + year decade + rating + streaming provider + sort → active chips bar + live match count; Reset all clears chips
5. Remove: open Detail → "Remove from library" → confirm dialog → item removed from Library + Home
6. AI glyph: sparkle+magnifier visible on FAB and assistant input field
