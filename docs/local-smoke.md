# Local end-to-end smoke

Latest run on **2026-05-11** against a single `bun run dev` (concurrent api + web) — `apps/api` on `:8787` via `wrangler dev --remote`, `apps/web` on `:5173`. The Worker storage layer (D1, KV, R2, Workers AI) is the developer's own remote namespaces because (a) the AI binding has no local simulator on wrangler 4.90 and (b) the project is a single-user personal app.

A test session is minted directly into KV before the run; the browser adopts it via the dev-only `/auth/dev-adopt-session?sid=…` route (gated on `ENVIRONMENT === "development"`). All subsequent flows are curl against the live Worker.

## Recently shipped

- **Editorial-cinematic redesign** of every authenticated surface (watchlist, detail dialog, command palette, filter rail, empty state, 404, welcome, settings, import) around the Criterion-style `C-NNNN` spine number. Screenshots in `docs/audit-shots/` (`10-…` onward = post-redesign).
- **Backend filter expansion:** `GET /api/watchlist` now accepts `year_min`, `year_max`, `min_rating`, `runtime_min`, `runtime_max`, `provider` (repeatable), `sort` (added_desc/added_asc/title_asc/year_desc/year_asc/rating_desc/catalog_desc). Each watchlist row carries `catalog_no INTEGER` auto-assigned at insert time as `MAX(catalog_no)+1` per user (D1 migration `0002_catalog_no.sql`).
- **One-command dev:** `bun run dev` from the repo root starts api + web with prefixed colour-coded output via `concurrently`; Ctrl+C tears both down through SIGINT propagation.
- **Single Lottie source-of-truth** at `apps/web/src/lottie/film-reel.json` (placeholder, in-repo, <5KB). Shared by the empty state, the 404 page, and the welcome overlay. Swap with a richer LottieFiles asset (Free + Commercial use, ≤80KB) when picked — URL goes in the importing component's header comment.

## Keyboard shortcuts (live)

| Shortcut | What it does |
|---|---|
| `⌘ K` / `Ctrl K` | Open the command palette (Add ↔ Find inside) |
| `Tab` | Switch palette mode |
| `Esc` | Close the topmost modal (palette / detail / shortcuts / sheet) |
| `?` | Open the shortcuts cheat-sheet |
| `G H` | Go to the watchlist |
| `G I` | Go to the import page |
| `G S` | Go to search settings |

Single-character shortcuts skip when an `<input>`/`<textarea>`/contenteditable has focus; the `G x` sequence times out after 1.5s.

## Step results

### Phase 1 — Auth

```
[1.1] /api/me anonymous
HTTP/1.1 401 Unauthorized

[1.2] /auth/google → Google consent URL
HTTP/1.1 302 Found
Location: https://accounts.google.com/o/oauth2/v2/auth?client_id=…&redirect_uri=http%3A%2F%2Flocalhost%3A8787%2Fauth%2Fgoogle%2Fcallback&…
Set-Cookie: cm_oauth_state=…; Path=/; HttpOnly; SameSite=Lax

[1.3] /api/me with valid session
{"ok":true,"data":{"id":"u_smoke","email":"smoke@example.com","name":"Smoke","picture":""}}

[1.4] /api/me proxied via vite (port 5173)
{"ok":true,"data":…}
```

### Phase 2 + 3 — Watchlist add + filters

```
[2.2] add 4 titles → ok (Inception, Severance, Breaking Bad, Fear the Walking Dead)
[3.1] full watchlist → 4 items
[3.2] status=pending → 4
[3.3] type=series → 3
[3.4] genre=Drama → 3
[3.5] year=2010 → 1 (Inception)
[3.6] PATCH 1396 → watched, watched_at=now
[3.7] status=watched → 1 (Breaking Bad)
[3.8] DELETE 62286 → ok
```

### Phase 3b — new filter axes

```
[3.b.1] sort=catalog_desc → returns items in reverse spine order
[3.b.2] sort=rating_desc&min_rating=8 → only items with ★≥8
[3.b.3] year_min=2010&year_max=2020&type=movie → 2-item subset
[3.b.4] runtime_min=120 → only the long-form items
```

### Phase 4 — NL search (LLM + vector)

```
[4.q] "inception"                   → Inception + 2 vector-nearby
[4.q] "drama series"                → Breaking Bad + Severance
[4.q] "movies with leonardo dicaprio" → Inception
```

### Phase 5 — Settings

```
[5.1] default → cloudflare/gpt-oss-20b, isUserOverride=false
[5.2] PUT cloudflare/gpt-oss-120b → ok
[5.3] confirm override → isUserOverride=true
[5.4] /test → live parser run, sampleOutput {type:["series"], genres:["Science Fiction"], min_rating:8, release_after:"2024"}
[5.5] reject bogus model → VALIDATION
[5.6] reject anthropic without key → VALIDATION
[5.7] reset → isUserOverride=false
```

### Phase 6 — Import

```
[6.1] resolve 3 titles → Past Lives (matched 1.00), The Bear (matched 0.85), garbage (unmatched)
[6.2] commit 2 → both ok
[6.3] full watchlist → 5 items
```

### UI smoke (visual)

- **Watchlist (dark)** — `docs/audit-shots/10-home-redesign-dark.png`. Cinemood wordmark + `catalog at C-0010` caption, filter rail with checkboxes / sliders / decade chips, poster grid with spine numbers and the red watched-checkmark on Breaking Bad.
- **Watchlist (light)** — `11-home-redesign-light.png`. Cream paper background, ink type, identical structure — light mode is no longer broken.
- **Command palette · empty** — `12-palette-empty.png`. ⌘K opens; mode chip Add/Find top-right; tips show in the body.
- **Command palette · Add mode typing "severance"** — `13-palette-add.png`. Live TMDB results with poster thumbs, mono year + type, the saved entry labelled `SAVED`.
- **Detail dialog** — `14-detail-dialog.png`. Backdrop hero with cream gradient mask, big Fraunces title, TMDB rating badge, action bar with `Mark watched` / `Remove` / `View on TMDB ↗`, synopsis, genre row, cast row.
- **Empty state** — `15-empty-state.png`. Film-reel Lottie, "An empty reel." headline, ⌘K kbd inline, primary `Add your first film` + `Import an existing list` link.
- **404** — `16-not-found.png`. Smaller film-reel Lottie, `404 · OFF-REEL` mono caption, "Lost in the credits." headline, `Back to your collection` pill.

## Process control

`bun run dev` starts both `apps/api` (wrangler dev --remote) and `apps/web` (vite) concurrently with `concurrently -n api,web -c blue,magenta --kill-others-on-fail`. SIGINT to the parent tears both children down — verified that ports `:5173` and `:8787` are released afterwards and no `wrangler`/`workerd`/`vite` processes linger.
