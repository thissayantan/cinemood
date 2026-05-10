# Local end-to-end smoke

Run on **2026-05-10** against a single `bun run dev` (concurrent api + web) — `apps/api` on `:8787` via `wrangler dev --remote`, `apps/web` on `:5173`. The Worker Storage layer (D1, KV, R2, Workers AI) is the developer's own remote namespaces because (a) the AI binding has no local simulator on wrangler 4.90 and (b) the project is a single-user personal app where the developer's dev hits the same resources they'll use in prod.

The user `u_smoke` and a session cookie are minted directly into KV before the run because the OAuth round-trip needs an actual browser. Everything else is curl against the live Worker.

Three real bugs were uncovered and fixed in-flight before the steps below all passed:

1. **Concurrent index updates corrupted Orama** — multiple `addTitleToIndex` waitUntils hit the shared module-scope cache and Orama instance simultaneously, leaving the first item's vector empty. Fixed by a per-user `Promise` queue (`serializePerUser`) so index mutations run one at a time per userId.
2. **Orama mutated docs in place** — `insert(db, doc)` rewrites the `embedding` field into a typed array; the same reference stored in `cached.docs` then JSON-serialised back to R2 as `null`. Fixed by passing `structuredClone(doc)` to Orama and keeping the original IndexDoc in our cache.
3. **`mode: "hybrid"` in Orama 3.x silently dropped where-filtered results** — `inception` worked but `drama series` and `movies with leonardo dicaprio` returned zero hits even with valid embeddings and matching filters. Fixed by switching to `mode: "vector"` whenever a query embedding is available (semantic match + where filter), `mode: "fulltext"` for term-only, and a filter-only path otherwise.

All three bugs and their fixes are recorded as Learned Rules in `CLAUDE.md`.

---

## Step results

```
===== PHASE 1: Auth =====
[1.1] /api/me anonymous (expect 401)
HTTP/1.1 401 Unauthorized

[1.2] /auth/google → Google consent URL
HTTP/1.1 302 Found
Location: https://accounts.google.com/o/oauth2/v2/auth?client_id=…&redirect_uri=http%3A%2F%2Flocalhost%3A8787%2Fauth%2Fgoogle%2Fcallback&response_type=code&scope=openid+email+profile&state=lpb9c…&access_type=online&prompt=select_account
Set-Cookie: cm_oauth_state=lpb9c…; Path=/; HttpOnly; SameSite=Lax; Max-Age=600

[1.3] /api/me with valid session
{"ok":true,"data":{"id":"u_smoke","email":"smoke@example.com","name":"Smoke","picture":""}}

[1.4] /api/me proxied via vite (port 5173)
{"ok":true,"data":{"id":"u_smoke","email":"smoke@example.com","name":"Smoke","picture":""}}
```
**PASS** — anon 401, OAuth start emits the correct consent URL with `state` cookie, authed `/api/me` returns the user, vite proxy passes the cookie through.

The actual `/auth/google/callback` redirect cannot be exercised from CLI (Google needs a browser-clicked consent), so the manual cookie injection stands in.

```
===== PHASE 2: TMDB search + watchlist add =====
[2.1] TMDB search 'severance'
ok: True
count: 8
  - 95396 Severance series 2022
  - 5072 Severance movie 2006
  - 549624 Severance movie 1988

[2.2] add 4 titles
  POST tmdb_id=27205 type=movie  -> ok title: Inception
  POST tmdb_id=95396 type=series -> ok title: Severance
  POST tmdb_id=1396  type=series -> ok title: Breaking Bad
  POST tmdb_id=62286 type=series -> ok title: Fear the Walking Dead
```
**PASS** — TMDB search is KV-cached, all four `POST /api/watchlist` round-trips return the upserted title.

```
===== PHASE 3: Watchlist filters + status + remove =====
[3.1] full watchlist count: 4 (all pending)
[3.2] status=pending count: 4
[3.3] type=series   count: 3 (Fear the Walking Dead, Breaking Bad, Severance)
[3.4] genre=Drama   count: 3 (same three series — all carry Drama in TMDB)
[3.5] year=2010     count: 1 (Inception)
[3.6] PATCH 1396 → status=watched, watched_at=1778438569
[3.7] status=watched count: 1 (Breaking Bad)
[3.8] DELETE 62286   -> {"ok":true,"data":{"removed":62286}}
```
**PASS** — every D1-side filter (`status`, `type`, `genre` LIKE, `year` substr) returns the right subset, status mutation sets `watched_at`, and DELETE removes cleanly.

```
===== PHASE 4: NL search (LLM + vector) =====
[4.q] inception
  parsed: {"filters": {}, "semantic_query": "inception"}
    - Inception (movie)
    - Severance (series)
    - Breaking Bad (series)

[4.q] drama series
  parsed: {"filters": {"type": ["series"], "genres": ["Drama"]}, "semantic_query": "drama"}
    - Breaking Bad (series)
    - Severance (series)

[4.q] movies with leonardo dicaprio
  parsed: {"filters": {"type": ["movie"], "cast": ["Leonardo DiCaprio"]}, "semantic_query": "Leonardo DiCaprio films"}
    - Inception (movie)
```
**PASS** — three distinct queries: bare-title, decade-free type+genre, cast-filter. The LLM produces the expected `ParsedQuery` shape every time, `mode:"vector"` + where pulls the right docs, JS-side `exclude_genres` filter is bypassed correctly when empty. (`inception` returns Inception first plus two close vector matches — expected vector-search behavior with similarity=0.)

```
===== PHASE 5: Settings page =====
[5.1] GET default            -> cloudflare/@cf/openai/gpt-oss-20b, isUserOverride=false
[5.2] PUT cloudflare/gpt-oss-120b -> ok, saved.hasKey=false
[5.3] GET                    -> effective gpt-oss-120b, isUserOverride=true
[5.4] POST /test cloudflare/gpt-oss-20b
       outer ok=true, inner ok=true, sampleOutput =
         {"filters":{"type":["series"],"genres":["Science Fiction"],"min_rating":8,"release_after":"2024"},
          "semantic_query":"time travel"}
[5.5] PUT openai/not-a-real-model      -> 400 VALIDATION (refine: Unknown model for provider)
[5.6] PUT anthropic/claude-haiku-4-5   -> 400 VALIDATION (missing_api_key)
[5.7] DELETE                           -> ok, isUserOverride=false, effective back to gpt-oss-20b
```
**PASS** — encrypted-at-rest per-user override round-trips, `Test connection` runs the parser live and returns a valid `ParsedQuery`, both validation guards (model whitelist + required key) reject correctly, `Reset to default` clears the override.

```
===== PHASE 6: Bulk import (textarea path) =====
[6.1] /api/import/resolve
  - Past Lives (2023)                   matched    1.00  Past Lives (movie 2023)
  - The Bear                            matched    0.85  The Bear (series 2022)
  - definitely-fake-xyzzy               unmatched  0.00  —
[6.2] /api/import/commit (2 picks)
  -> {tmdb_id: 666277, type: movie,  ok: true}
  -> {tmdb_id: 136315, type: series, ok: true}
[6.3] full watchlist after import
  count: 5
    - Past Lives movie pending
    - The Bear series pending
    - Breaking Bad series watched
    - Severance series pending
    - Inception movie pending
```
**PASS** — textarea path: 3 candidates resolved (year+type hint match, series-only hint match, garbage rejected), commit pipeline upserts titles + adds to watchlist + queues a serialised `addTitleToIndex` per item, final list reflects both imports merged with the existing entries.

---

## Process control

`bun run dev` starts both `apps/api` (wrangler dev --remote) and `apps/web` (vite) concurrently with `concurrently -n api,web -c blue,magenta --kill-others-on-fail`. SIGINT to the parent (Ctrl+C in a terminal, `kill -INT -<pgid>` here) tears both children down — verified that ports `:5173` and `:8787` are released afterwards and no `wrangler`/`workerd`/`vite` processes linger.
