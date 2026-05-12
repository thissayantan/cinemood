# Import notes

The import flow at `/import` takes one of three inputs (paste, CSV, Google Takeout JSON), parses it into candidates, resolves each candidate against TMDB, and lets you review picks before committing them to your watchlist. This doc is the honest version of how that pipeline behaves on real-world data — particularly Google Takeout, which is where most of the rough edges live.

## What the parser accepts

- **Paste:** one title per line. Year in parentheses optional (`Past Lives (2023)`, `Severance`).
- **CSV:** Letterboxd, Trakt, IMDb, and a generic name+year shape are auto-detected. Header row required.
- **Google Takeout JSON:** the parser walks recursively and picks up `title` / `name` / `originalTitle` / `displayName` fields anywhere in the document, deduplicating by case-insensitive title.

## The numbers you may see

Real Takeout exports often produce three different counts at three different stages, which can be confusing:

- **Items in the file** — what the JSON contains, which can include "interactions" (impressions, scroll events, etc.), not just titles you saved.
- **Candidates after parse** — what the parser distilled into actual title strings, deduped.
- **Unique TMDB ids after resolve + dedupe** — how many distinct films/series the candidate titles map to. Many Takeout exports collapse to a smaller number here because the same title appears under multiple Google surfaces (Google Play, YouTube Watchlist, Google TV) with slight formatting variations.

A 631-item export might parse to 360 candidates and commit 223 inserts. That's not a bug; it's three counts answering different questions. The review screen shows all three in its header (`N ready to add · M already in your catalog · K unmatched · D duplicate picks collapsed`).

## Resolver heuristics

`apps/api/src/lib/import-resolve.ts` does the title → TMDB matching. Highlights:

- **Query expansion** for the common Takeout suffix shapes: `Joe Pickett (TV)` → also try `Joe Pickett`; `Dahan: Raakan Ka Rahasya (Marathi)` → also try the bare title; non-Latin primary with Latin fallback in parens → try both directions.
- **Token Jaccard similarity** with normalisation (`&` → `and`, apostrophes stripped, lowercase) for fuzzy comparisons.
- **Scoring**: title similarity up to `+0.85`, year confirmation up to `+0.10`, type confirmation `+0.05`, position bonus `+0.05`. Single-candidate exact-title matches short-circuit to `1.0`. Multi-candidate matches with no year/type signal cap at `0.90` — the right number for "the title is exact but there are alternatives."

If a row doesn't match, the resolver flags it `unmatched` rather than silently dropping it. The review screen shows the row with a "no match" badge so you can spot what's missing.

## When commits "succeed but don't import"

The commit endpoint is honest about three outcomes per row:

- `inserted: true` — a brand-new row was created in the watchlist.
- `inserted: false, ok: true` — the title row was upserted but the watchlist insert hit `ON CONFLICT(user_id, title_id) DO NOTHING` (you already had it).
- `ok: false` — TMDB/OMDB fetch failed (`fetch_failed`) or the title row didn't make it to D1 (`missing_title`).

The review UI surfaces all three. A re-import of the same Takeout file is *expected* to show 0 inserts + N "already in your catalog" — that's correct, not a failure.

## Failure resilience

The whole review state (resolved candidates, picks, last error, per-row failure reasons) is persisted to `localStorage` on every change. If a commit partially fails, the page stays on the review screen with `failed · <reason>` badges on the rows that didn't make it, and reloading the page offers a "Resume your last import" banner instead of making you re-resolve from scratch.
