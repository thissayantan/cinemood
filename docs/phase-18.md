# Phase 18 — Cast Photos, Actor Screen, App-wide Icons

## What was done

### 1. Cast photos (self-healing stale D1 cache)

**Root cause:** Cast was cached as a JSON blob in D1 at watchlist-add time, before `profile_path` and actor `id` were included in the cast map. Old rows served blank cast cards.

**Fix:**
- Added `id: number` to `TmdbDetail.cast` in `apps/api/src/lib/tmdb.ts` and threaded it end-to-end through shared types and Android models.
- Added `opts?: { force?: boolean }` to `fetchTmdbDetail` to bypass the 7-day KV cache when staleness is detected.
- `GET /api/title/:type/:id` now checks for staleness (`cast[].id == null`) and forces a fresh TMDB fetch + D1 re-upsert on the first request for any stale row. Second request comes from freshly warmed cache.
- Graceful degradation: if TMDB fails on a stale row, returns the cached row rather than a 502.
- Android `DetailScreen` uses a `LaunchedEffect(item.title.id)` fresh-fetch merge — renders instantly from watchlist cache, upgrades cast silently when the refreshed title arrives.

### 2. Clickable cast cards → actor detail screen

**New backend endpoint:** `GET /api/person/:id`
- Calls TMDB `/person/{id}?append_to_response=combined_credits`.
- Dedupes credits by id, sorts by popularity desc, caps at 20.
- KV-cached with same TTL as title detail.

**New Android screen:** `PersonScreen`
- 320dp hero photo with gradient scrim + back button + name/meta overlay.
- Expandable biography section (collapses to 5 lines).
- "Known for" horizontal `LazyRow` filmography rail — poster, year chip, title, character.
- Back navigates to the detail page; FAB hidden while on this screen.
- `CastCard` is clickable only when `member.id != 0` (guards stale pre-self-heal rows).

**Nav:** `Screen.Person("person/{personId}")` added to `NavGraph.kt` and wired in `MainActivity`.

### 3. Icons throughout the app

All icons from the already-present `material-icons-extended` dependency — no new dependency added.

| Location | Icon |
|---|---|
| Status: Want to watch | `Icons.Rounded.BookmarkAdd` |
| Status: Watching | `Icons.Rounded.PlayArrow` |
| Status: Watched | `Icons.Rounded.CheckCircle` |
| Section: Where to watch | `Icons.Rounded.LiveTv` |
| Section: Overview | `Icons.AutoMirrored.Rounded.Notes` |
| Section: Cast | `Icons.Rounded.Groups` |
| Section: Genres | `Icons.Rounded.Theaters` |
| Remove from library | `Icons.Rounded.DeleteOutline` (error tint) |
| PersonScreen: Biography | `Icons.Rounded.Person` |
| PersonScreen: Known for | `Icons.Rounded.LocalMovies` |

### 4. Emulator setup

- Existing AVD `Wallora_Pixel6Pro` (Pixel 6 Pro, android-35, google_apis/x86_64) used.
- Launched headless with `-gpu swiftshader_indirect` (no KVM group access).
- Physical phone (`19271FDEE00B6A`) later connected; APK installed and verified.

## What was tested

- Detail page for "The Man in the High Castle": cast headshots render (self-heal confirmed).
- Status control shows icons next to all three labels.
- Section headers show icons.
- App launches, home screen loads, Decide and Settings tabs navigate correctly.
- PersonScreen code verified by inspection; manual cast-card tap needed on device.

## Files changed

| File | Change |
|---|---|
| `packages/shared/src/types.ts` | Added `id` to `Title.cast` element type |
| `apps/api/src/lib/tmdb.ts` | `force` opt, `cast[].id`, new `getPersonDetail` |
| `apps/api/src/routes/title.ts` | Staleness check + forced refetch + graceful degradation |
| `apps/api/src/routes/person.ts` | New `GET /api/person/:id` |
| `apps/api/src/index.ts` | Mount person route |
| `apps/android/.../data/model/Models.kt` | `CastMember.id`, `PersonDetail`, `PersonCredit` |
| `apps/android/.../data/api/CinemoodApi.kt` | `getTitle`, `getPerson` |
| `apps/android/.../navigation/NavGraph.kt` | `Screen.Person` |
| `apps/android/.../MainActivity.kt` | Person route + `navigateToPerson` + `onPersonClick` |
| `apps/android/.../ui/screens/DetailScreen.kt` | Fresh-fetch merge, clickable `CastCard`, icons |
| `apps/android/.../ui/screens/PersonScreen.kt` | New actor detail screen |
