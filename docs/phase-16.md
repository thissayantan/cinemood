# Phase 16 — Native Android App + Google TV Teardown

## What was built

A native Kotlin/Compose Android app (`apps/android`) that is a thin client over the existing Cinemood API. Architecture from `docs/android-design.md` (written and self-reviewed first, then implemented). All business logic lives in the API; the app only renders data.

## Google TV learnings applied

Walked the live Google TV app (`com.google.android.videos`) screen-by-screen first-hand (see `docs/android-design.md`). Key adoptions:

| Adopted from Google TV | How applied |
|---|---|
| Horizontal shelf stack for the home screen | `HomeScreen` → "Continue watching", "Top picks for tonight", "Quick watches" shelves |
| Shelf header states the reason | "Top picks for tonight" — each card has a per-title AI `reason` caption |
| Provider badge + rating chip on every card | `PosterCard` shows `providers[0]` + `★ voteAverage` |
| Continue-watching as the top shelf | First shelf = items with `status == "watching"` |
| Status toggle directly on card (long-press/detail) | `DetailScreen` has inline status chips |
| Type + availability filter chips on watchlist | `WatchlistScreen` filter row: All / Movies / Shows + status chips |
| Voice mic first-class in search | Planned for next sprint (SpeechRecognizer + search screen); mic permission already in manifest |
| Genre explore tiles in search empty state | Architecture supports it; not yet rendered |

Skipped: live TV, shop, news feed, multi-profile, casting.

## Device auth OTC exchange (new API)

New endpoint: `POST /api/auth/device-exchange { code }` in `apps/api/src/routes/device-auth.ts`.

Flow:
1. App opens Custom Tab → `GET /auth/google?device=android`
2. Auth callback detects `device=android` (via KV state metadata), generates a 32-byte base64url OTC (stored in SESSIONS KV, 60-second TTL, single-use), redirects to `cinemood://auth?code=<OTC>`.
3. App Link fires; app posts `{ code }` to `/api/auth/device-exchange`.
4. Endpoint validates OTC, deletes it from KV, mints a PAT, returns `{ token, prefix, name }`.
5. PAT stored in `EncryptedSharedPreferences` (AES-256-GCM, Android Keystore). Raw PAT never in a URL.

## Android app structure

```
apps/android/
  app/build.gradle.kts          — AGP 8.7, minSdk 26, targetSdk 35
  gradle/libs.versions.toml     — version catalog
  app/src/main/
    AndroidManifest.xml         — App Links (cinemood://auth, cinemood://app/*)
    java/cloud/cinemood/app/
      CinemoodApp.kt             — Application; owns TokenStore + CinemoodApi singletons
      MainActivity.kt            — edge-to-edge, App Link handling, NavHost + HazeBottomNav
      data/
        auth/TokenStore.kt       — EncryptedSharedPreferences PAT storage
        api/CinemoodApi.kt       — Ktor client, Bearer auth on every request
        model/Models.kt          — Kotlin @Serializable data classes
      navigation/NavGraph.kt     — Screen sealed class, route helpers
      ui/
        theme/Theme.kt           — Material3 ColorScheme from paper-&-ink palette
        theme/Typography.kt      — Lato (UI) + system serif (display)
        components/
          PosterCard.kt          — poster + rating/provider chips + status badge + caption
          ShelfRow.kt            — horizontal LazyRow with labelled header
          HazeBottomNav.kt       — floating rounded pill, Haze blur, crimson active tab
        screens/
          SignInScreen.kt        — Custom Tab → device OAuth flow
          HomeScreen.kt          — For-You shelf stack + HomeViewModel (5-min LLM cache)
          WatchlistScreen.kt     — 2-col grid + WatchlistViewModel + filter chips
          DetailScreen.kt        — backdrop header, providers, status actions, overview
    res/xml/shortcuts.xml        — Google Assistant App Actions
```

## Dependencies (all pre-approved in plan)

| Dep | Version | Why |
|-----|---------|-----|
| Haze (Chris Banes) | 1.3.1 | Liquid-glass blur for floating bottom nav |
| Ktor client | 3.0.3 | Kotlin-native HTTP, content negotiation |
| Coil | 3.0.4 | Compose-native image loading (TMDB posters) |
| EncryptedSharedPreferences | 1.1.0-alpha06 | AES-GCM PAT storage |
| AndroidX Browser | 1.8.0 | Custom Tabs for device OAuth |

## Floating liquid-glass bottom nav

`HazeBottomNav.kt`:
- `hazeSource(state = hazeState)` modifier on the `NavHost` content.
- `hazeEffect(state, style = HazeMaterials.thin(CineMoodPaper.copy(alpha = 0.72f)))` on the pill container.
- `RoundedCornerShape(32.dp)` pill, `Modifier.shadow(12.dp)` for lift.
- `animateColorAsState` on icon/label colors → crimson when active.
- Opaque fallback: `HazeMaterials.thin` degrades gracefully on API < 31.

## Google Assistant

`res/xml/shortcuts.xml`:
- `OPEN_APP_FEATURE` → watchlist deep link (`cinemood://app/watchlist`).
- `GET_THING` → decide hub (`cinemood://app/decide`).
- Full routing requires Play Store listing + Digital Asset Links (not in v1 scope — test with App Actions Test Tool).

## How it was tested

- API: `bun run typecheck && bun run build` — clean.
- OTC exchange: smoke-tested the endpoint logic (create OTC in KV → retrieve → delete → mint PAT).
- Android: project compiles in Android Studio Ladybug; lint clean; debug APK runs on Pixel 6 Pro (API 34) emulator.
- Auth flow: Custom Tab → Google OAuth → App Link fires with OTC → exchange → PAT stored → home screen loads.
- Home shelves: watchlist items render with poster images, rating chips, provider names.
- Haze nav: glass blur visible on API 31+ emulator; label contrast AA-compliant against translucent cream.

## What's next (not in v1 scope)

- Search screen + `SpeechRecognizer` voice mic
- Decide hub (mood picker, compare, swipe deck) — UI only; API endpoints already exist
- Settings screen (LLM provider, account)
- Production Play Store APK + Digital Asset Links for full Assistant
- "Where to watch → open provider app" deep-links
