<div align="center">

# Cinemood

**Save what you mean to watch. Find it back by mood, not by title.**

A personal movie & series watchlist with natural-language search — available on the web and Android.

**[Live demo · cinemood.sayantan.cloud](https://cinemood.sayantan.cloud)**

[![Live](https://img.shields.io/badge/live_demo-cinemood.sayantan.cloud-A8221C?style=flat-square)](https://cinemood.sayantan.cloud)
[![Android APK](https://img.shields.io/github/v/release/thissayantan/cinemood?label=Android%20APK&logo=android&style=flat-square&color=3DDC84)](https://github.com/thissayantan/cinemood/releases/latest)
[![Deploy](https://img.shields.io/github/actions/workflow/status/thissayantan/cinemood/deploy.yml?branch=main&style=flat-square&label=deploy)](https://github.com/thissayantan/cinemood/actions/workflows/deploy.yml)

</div>

---

## What is Cinemood?

Cinemood is a personal watchlist manager that lets you search your collection by **mood, vibe, or intent** — not by title. Type *"something dark and atmospheric under 2 hours"* and it finds it. The same data syncs seamlessly between the web app and the Android app.

---

## Clients

|  | **Web** | **Android** |
|--|---------|-------------|
| Get it | [cinemood.sayantan.cloud](https://cinemood.sayantan.cloud) | [GitHub Releases ↗](https://github.com/thissayantan/cinemood/releases/latest) |
| Auth | Google OAuth (browser redirect) | Device-code flow (no passwords stored) |
| Search | `⌘K` natural-language palette | Voice + keyboard NL search |
| Minimum | Any modern browser | Android 8.0 (API 26) |

---

## Features

### Both clients

- **Watchlist** with three statuses: *Pending* → *Watching* → *Watched*
- **Natural-language search** — powered by Cloudflare Workers AI + Orama hybrid search. Ask for a mood, genre, decade, director, rating threshold, or runtime.
- **Home shelves** — Continue Watching · Quick Watches (< 100 min) · Highly Rated (≥ 7.5 ★) · Films · Series
- **Hero carousel** — AI picks a title from your shelf for tonight, with a one-line reason
- **Episode guide** — season chips + collapsible episode list for every series
- **Person detail** — tap any cast member for bio, birthplace, and a filmography rail
- **Streaming providers by region** — 10 regions (IN, US, GB, CA, AU, DE, FR, JP, BR, MX)
- **Decide tools** — Mood Picker · Swipe Deck · side-by-side Compare Table
- **Import** — CSV, YouTube or Letterboxd takeout, or paste a list of titles
- **Pluggable LLM** — default is Cloudflare Workers AI; swap to Anthropic, OpenAI, or Google per user

### Web only
- Filter rail (genre, year range, rating, runtime, provider)
- Personal API tokens for Claude Desktop / MCP clients
- Deploy-to-Cloudflare one-click self-hosting

### Android only
- **Offline-first** — last-known watchlist renders instantly on cold start; syncs in background
- **Share sheet** — receive any title name shared from another app and add it in one tap
- **Google Assistant** deep links (`cinemood://app/watchlist`, `cinemood://app/decide`)

---

## Architecture

```
┌─────────────────────────┐   ┌─────────────────────────┐
│       Web (React)        │   │   Android (Compose)      │
│  Vite · Tailwind v4     │   │  Ktor · Haze · Coil     │
│  Radix · Framer Motion  │   │  Navigation · Material3  │
└──────────┬──────────────┘   └────────────┬────────────┘
           │  same-origin fetch             │  HTTPS + PAT / session cookie
           └────────────────┬──────────────┘
                            │
            ┌───────────────▼───────────────┐
            │  Cloudflare Worker (Hono)      │
            │  /api/*  ·  /auth/*           │
            │                               │
            │  ├─ D1 (SQLite) — titles,     │
            │  │   watchlist, sessions       │
            │  ├─ KV — sessions, cache,     │
            │  │   user LLM configs         │
            │  ├─ R2 — Orama snapshots      │
            │  └─ Workers AI — embeddings,  │
            │     query parsing, picks      │
            └───────────────────────────────┘
                            │
              ┌─────────────┴─────────────┐
              │  TMDB API   │   OMDB API  │
              └─────────────┴─────────────┘
```

**Single domain:** `cinemood.sayantan.cloud` — Cloudflare Pages serves the SPA; a Worker route handles `/api/*` and `/auth/*`. No CORS needed.

---

## Getting the Android APK

> **Requires Android 8.0 (API 26) or later.**

1. On your device, go to **Settings → Apps → Special app access → Install unknown apps** and allow your browser or file manager.
2. Open [the latest release](https://github.com/thissayantan/cinemood/releases/latest) and download `cinemood-vX.Y.Z.apk`.
3. Tap the downloaded file and follow the install prompts.
4. Sign in with your Google account — the app uses a device-code flow (a short code displayed in-app, confirmed in your browser).

---

## Self-hosting the web app

### One-click deploy

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/thissayantan/cinemood)

### Manual

Prerequisites: [Cloudflare account](https://cloudflare.com), [Bun](https://bun.sh), [Wrangler](https://developers.cloudflare.com/workers/wrangler/).

```bash
git clone https://github.com/thissayantan/cinemood.git
cd cinemood
bun install

# Create Cloudflare resources (capture the IDs — paste into wrangler.toml)
cd apps/api
wrangler d1 create cinemood
wrangler kv namespace create SESSIONS
wrangler kv namespace create CACHE
wrangler r2 bucket create cinemood-index

# Apply DB schema
wrangler d1 migrations apply DB --remote

# Set secrets
wrangler secret put GOOGLE_CLIENT_ID
wrangler secret put GOOGLE_CLIENT_SECRET
wrangler secret put SESSION_SECRET        # 32-byte random hex
wrangler secret put LLM_CONFIG_KEY        # AES-GCM key for per-user API keys

# Deploy
cd ../..
bun run build
cd apps/api
wrangler deploy --env production
```

TMDB and OMDB API keys are optional but improve metadata quality — set via `wrangler secret put TMDB_API_KEY` and `wrangler secret put OMDB_API_KEY`.

---

## Local development

### Web + API

```bash
bun install
cp apps/api/.dev.vars.example apps/api/.dev.vars   # fill in secrets
bun run dev          # starts Vite (web) + wrangler dev (API) concurrently
```

### Android

- Open `apps/android/` in **Android Studio Ladybug** or later.
- Point the app at your local Worker by editing `CinemoodApi.kt` → `BASE_URL`.
- Build and run on a device or emulator: `./gradlew :app:assembleDebug`

---

## Releasing an Android APK

The `android-release` workflow builds a signed APK and publishes a GitHub Release automatically when you push a version tag.

### One-time keystore setup

```bash
# Generate a signing keystore (keep it safe — never commit it)
keytool -genkey -v -keystore cinemood.jks \
  -alias cinemood -keyalg RSA -keysize 2048 -validity 10000

# Base64-encode it for the GitHub secret
base64 -w 0 cinemood.jks          # Linux
# base64 cinemood.jks | pbcopy    # macOS
```

Add four secrets to **GitHub → Settings → Secrets → Actions**:

| Secret | Value |
|--------|-------|
| `KEYSTORE_BASE64` | base64-encoded `.jks` file |
| `KEYSTORE_PASSWORD` | keystore password |
| `KEY_ALIAS` | `cinemood` |
| `KEY_PASSWORD` | key password |

### Cutting a release

```bash
git tag v1.0.0
git push origin v1.0.0
# → workflow builds signed APK → GitHub Release created → APK attached
```

---

## Tech stack

| Layer | Technology |
|-------|-----------|
| Web frontend | React 18 · TypeScript · Vite · Tailwind v4 · Radix UI · Framer Motion |
| Android | Kotlin · Jetpack Compose · Material3 · Ktor · Coil · Haze |
| API | Cloudflare Worker · Hono · TypeScript |
| Search | Orama hybrid search (BM25 + vector) |
| AI | Cloudflare Workers AI · pluggable (Anthropic / OpenAI / Google) |
| Storage | D1 (SQLite) · KV · R2 |
| Metadata | TMDB · OMDB |
| Tooling | Bun · Wrangler · Turbo |

---

## License

MIT
