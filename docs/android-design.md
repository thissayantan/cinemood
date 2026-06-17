# Cinemood Android — Design Document

> Written before any Kotlin. Per CLAUDE.md, the design doc (with a second critical self-review pass) precedes all implementation.

---

## Vision

The Android app is a thin client over the Cinemood API. Every screen is a direct projection of data the API already returns; no business logic is duplicated. The paper-&-ink editorial aesthetic (cream + ink + crimson) translates to Compose via a custom Material3 theme; it does not look like a generic dark-glossy streaming app.

The app's primary job: *help you decide what to watch tonight and act on that decision in two taps.* Every navigation decision and layout choice flows from that.

---

## IA & Navigation (Google TV learnings applied)

Studied the live Google TV app first-hand (see phase-16 teardown table). We adopt the IA, not the visual language:

```
Bottom nav (floating glass pill):
  Home (For You)   ·   Watchlist   ·   Decide   ·   Settings

Top bar (persistent):
  Cinemood wordmark (left)   ·   Search+mic pill (right)
```

### Tabs

| Tab | Key screens | Notes |
|-----|-------------|-------|
| **Home** | For-You shelf stack | AI-driven; Google TV inspired. Top shelf = Continue Watching. |
| **Watchlist** | Poster grid | Type chips (All · Movies · Shows) + status chips. |
| **Decide** | Mood picker / Compare / Swipe deck | The feature Google TV doesn't have. |
| **Settings** | LLM provider, Account, Tokens | |

---

## Screens (spec level)

### 1. Splash / Auth

- If no token stored: show a single "Sign in with Google" button (triggers Custom Tab to `https://cinemood.sayantan.cloud/auth/google?device=android`).
- On OAuth success, the web callback mints a PAT, wraps it in a short-lived one-time code, and redirects to the App Link `cinemood://auth?code=<OTC>`. The app exchanges the OTC for the PAT via `POST /api/auth/device-exchange?code=<OTC>`.
- PAT stored in Android EncryptedSharedPreferences (never in plaintext).
- After auth: navigate to Home.

### 2. Home — "For You"

Vertical scroll of horizontal shelves:

```
┌─ Continue watching (status: watching) ──────────────────────────────────┐
│  [16:9 card]  [16:9 card]  [16:9 card]  → horizontal scroll             │
└──────────────────────────────────────────────────────────────────────────┘
┌─ Top picks for tonight ─────────────────────────────────────────────────┐
│  [card + AI reason caption]  [card + AI reason]  …                      │
└──────────────────────────────────────────────────────────────────────────┘
┌─ Quick watches (< 100 min) ─────────────────────────────────────────────┐
│  [card]  [card]  [card]  …                                               │
└──────────────────────────────────────────────────────────────────────────┘
```

- "Top picks" = `POST /api/recommend` with `status: "pending"`, limit 10. Each card shows the per-title `reason` as a one-line caption — this is what Google TV doesn't have.
- "Quick watches" = client-side filter on `runtime < 100`, no LLM call.
- Pull-to-refresh re-runs `/api/recommend`.
- Cache last recommend response in-memory with a 5-min TTL; no LLM call on repeat navigations.

### 3. Watchlist

```
[All] [Movies] [Shows]          ← segmented type filter (chips)
[Pending] [Watching] [Watched]  ← status filter (chips)

┌──────────┐  ┌──────────┐  ┌──────────┐
│ poster   │  │ poster   │  │ poster   │
│ ★8.4     │  │ ★7.1     │  │ ★9.0     │
│ [+badge] │  │ [+badge] │  │ [+badge] │
└──────────┘  └──────────┘  └──────────┘
```

- 2-column staggered grid of portrait poster cards.
- Each card: poster image (Coil), rating chip (vote_average), provider chip, status badge.
- Long-press → status quick-action bottom sheet.
- Fab (+) → Search/Add screen.

### 4. Title Detail

- Full-bleed backdrop (from TMDB backdrop_path).
- Title, year, runtime, certification.
- Provider "where to watch" chips (from `providers`).
- Status row: [Pending] [Watching] [Watched] segmented + [Remove].
- Overview text (3 lines, expandable).
- Back button.

### 5. Search / Add

- Top: search input with `SpeechRecognizer` mic button.
- Empty state: genre quick-entry tiles (maps to watchlist genre filter) — inspired by Google TV.
- Results: TMDB results (vertical list) + watchlist matches (if already added, shows status badge).
- Quick-add: tap a TMDB result → confirm sheet → `POST /api/watchlist`.

### 6. Decide Hub

Three cards:
1. **Mood picker** → text input → `POST /api/recommend` → ranked list.
2. **Compare** → choose 2–6 from a mini-grid → `POST /api/compare` → comparison table.
3. **Swipe Q&A** → `POST /api/decide/questions` → card deck → `POST /api/decide/pick` → reveal.

### 7. Settings

- LLM provider (provider selector + API key input, same logic as web `/settings/search`).
- Account (user info, sign out).
- API tokens (list + create + revoke — calls `/api/settings/tokens`, cookie-only guard means this must be blocked on Bearer auth; instead show a "manage from the web" link since the app uses Bearer auth).

---

## Component Kit

| Component | Description |
|-----------|-------------|
| `PosterCard` | Compose Card: poster image (Coil), rating chip, provider chip, status badge. Used everywhere. |
| `BackdropHeader` | Full-bleed backdrop + gradient scrim for title detail. |
| `ShelfRow` | Horizontal `LazyRow` of cards with a header label. |
| `StatusChips` | Row of `FilterChip` for status. |
| `HazeBottomNav` | Floating rounded pill nav bar using Haze. |
| `HazeTopBar` | Persistent top bar using Haze (optional — may use opaque). |
| `GenreQuickEntry` | 3×N grid of genre tiles for search empty state. |
| `ProviderChip` | Small chip with provider name (+ logo if available). |
| `DecideCard` | Card for each mode in the Decide hub. |
| `SwipeCard` | Draggable question card (Compose `draggable` + offset). |

---

## Compose Theme

The paper-&-ink palette mapped to Material3 semantic tokens:

```kotlin
val CineMoodPaper  = Color(0xFFF5F0E8)  // --paper
val CineMoodInk    = Color(0xFF1A1613)  // --ink
val CineMoodAccent = Color(0xFFB91C1C)  // --accent (crimson)
val CineMoodDim    = Color(0xFF6B6560)  // --paper-dim
val CineMoodRule   = Color(0xFFE5E0D5)  // --rule

// Material3 ColorScheme
colorScheme = lightColorScheme(
  primary          = CineMoodAccent,
  onPrimary        = CineMoodPaper,
  background       = CineMoodPaper,
  onBackground     = CineMoodInk,
  surface          = CineMoodPaper,
  onSurface        = CineMoodInk,
  surfaceVariant   = Color(0xFFEDE8DE),  // --paper-2
  outline          = CineMoodRule,
)
```

Typography: Lato (body/UI) + a serif display (for h1/h2 moments, same editorial spirit as web Fraunces).

Motion: `LocalReducedMotion` composition local; durations 150–300ms; spring-based enter; no decorative loops. Respect `Settings.Global.ANIMATOR_DURATION_SCALE == 0`.

---

## Floating Liquid-Glass Bottom Nav — Design Spec

**Motivation (from the user's explicit request):** A floating, rounded bottom-nav pill with a liquid-glass / frosted-glass material. Content scrolls behind it; the bar floats.

**Library:** [Haze](https://chrisbanes.github.io/haze/) by Chris Banes.
- `hazeSource(state)` modifier on the scrollable `LazyColumn`/`LazyRow`.
- `hazeEffect(state, style = HazeMaterials.thin(CinemoodTint))` on the floating nav container.
- `CinemoodTint = CineMoodPaper.copy(alpha = 0.72f)` — warm translucent over the cream palette.
- `shape = RoundedCornerShape(32.dp)` — pill shape.
- Outer shadow: `BoxShadow` or `Modifier.shadow(elevation = 8.dp, shape = pill, ambientColor = CineMoodInk.copy(alpha=0.12f))`.
- Specular highlight border: 1dp border with `LinearGradient(white/30% → transparent)`.

**Opaque fallback:** when `BlurEffect` / `RenderEffect` is unavailable (API < 31) or when `isReduceTransparencyEnabled`, the nav uses `Color(0xF0F5F0E8)` (92% opaque cream) with a `Divider` line at top, no blur.

**Active tab:** crimson icon + label; inactive = `CineMoodDim`. Transition: `AnimatedVisibility` crossfade on the active indicator (instant when reduced motion).

**Accessibility:** ink-on-glass contrast checked at WCAG AA (crimson on translucent cream: ratio ≥ 4.5:1 for normal text at 12sp).

---

## Auth Flow — Device Code Exchange

To avoid pasting a raw token (poor UX):

1. App opens a Custom Tab to `https://cinemood.sayantan.cloud/auth/google?device=android&redirect_uri=cinemood://auth`.
2. User completes Google OAuth in the browser.
3. The web auth callback detects `device=android`, mints a PAT, wraps it in a short-lived OTC (30-second TTL, stored in KV with `cmt_{random}_otc` key), and redirects to `cinemood://auth?code=<OTC>` (not the raw token).
4. The App Link fires; the app reads `code`, calls `POST /api/auth/device-exchange { code }`, receives the PAT.
5. PAT stored in EncryptedSharedPreferences. OTC deleted from KV on first use.
6. All subsequent API calls use `Authorization: Bearer <PAT>`.

New API endpoint required: `POST /api/auth/device-exchange` (no auth required — OTC is the credential; rate-limited to 3 attempts by IP before invalidation).

---

## Google Assistant (App Actions)

`res/xml/shortcuts.xml`:
```xml
<shortcuts>
  <capability android:name="actions.intent.OPEN_APP_FEATURE">
    <intent android:action="android.intent.action.VIEW"
            android:targetPackage="cloud.cinemood.app"
            android:targetClass="cloud.cinemood.app.MainActivity">
      <parameter android:name="feature" android:value="watchlist"/>
    </intent>
  </capability>
</shortcuts>
```

Intents:
- "Open my watchlist on Cinemood" → deep-link to Watchlist tab.
- "What should I watch on Cinemood" → deep-link to Decide hub.
- "Add [film] to Cinemood" → deep-link to Search/Add with prefilled query.

Test: App Actions Test Tool in Android Studio. Full Assistant routing requires Play Store listing + Digital Asset Links (not in v1 scope).

---

## Critical Self-Review (2nd pass)

### Risk 1: LLM cost on every Home open
**Problem:** `POST /api/recommend` calls an LLM; opening the app 10×/day = 10 LLM calls.
**Mitigation:** In-memory 5-min cache. If TTL not expired, skip the API call and show cached shelves with a subtle "last updated" timestamp. Pull-to-refresh bypasses the cache. Also pre-populate the fallback "Quick watches" shelf without LLM (client-side runtime filter).

### Risk 2: Scope creep — "For You" home is the most novel/risky screen
**Problem:** It's also the most Google-TV-inspired and requires the most AI work.
**Mitigation:** Ship a vertical slice first (auth → watchlist → detail → set status), then layer in the For-You home. The watchlist tab alone is a useful app. Mandate the shelf approach but defer AI-shelves until watchlist is stable.

### Risk 3: Token delivery via deep link (OTC in URL)
**Problem:** OTC could appear in browser history, server logs, or redirect intermediaries.
**Mitigation:** OTC in URL query param (standard practice, comparable to OAuth authorization codes). Short TTL (30s), single-use, HTTPS only. The OTC is not the PAT — if intercepted, it can only be exchanged once; subsequent tries fail. The PAT itself never appears in a URL.

### Risk 4: Haze blur performance on fast-scrolling lists
**Problem:** `hazeSource` on a long `LazyColumn` with many images + backdrop blur = GPU pressure.
**Mitigation:** Confine `hazeSource` to the main scroll container only; do not nest it inside shelf rows. Use `Modifier.graphicsLayer { renderEffect = ... }` only on the overlay layer (bottom nav). Cap `blurRadius = 18.dp`. Profile on Pixel 6 Pro in release mode before shipping.

### Risk 5: Device-exchange endpoint is a new API feature
**Problem:** This endpoint doesn't exist yet. Android auth is blocked without it.
**Mitigation:** Build it in Phase 16 as the first API task (before any Kotlin). It's a small KV-backed endpoint (< 50 LOC). Until then, the auth flow falls back to "paste your token" mode in a debug build.

### Risk 6: Compose animation vs. Framer Motion parity
**Problem:** The web has a mature motion system; the Android app must not feel inconsistent.
**Mitigation:** Compose's `AnimatedVisibility`, `animate*AsState`, and `spring()` are sufficient for the design. Document the parallels in the component kit comments. Do not over-engineer — the app's motion contract is: enter with a spring, exit with a fade, nothing spins or pulses.

### What we cut from the plan (scope discipline)
- Explicit Like/Dislike taste feedback (deferred, no API)
- "Where to watch → open provider app" deep-links (deferred)
- Google Assistant full routing requiring Play listing (test-tool only in v1)
- "Highlights" news feed (Google TV's; irrelevant to Cinemood)
- Multiple profiles (single-user-per-account)

---

## Build Order (by deliverable)

1. `apps/api` — `POST /api/auth/device-exchange` endpoint + KV OTC store
2. `apps/android` — Gradle/Compose project scaffold, theme, component kit
3. Watchlist tab (auth → list → detail → set status) — vertical slice, shippable
4. Search/Add screen + voice mic
5. Home / For-You shelves (with recommendation cache)
6. Decide hub (mood, compare, swipe)
7. Settings screen
8. Floating Haze glass nav
9. Google Assistant App Actions
10. QA on Pixel 6 Pro, document in phase-16.md
