# Phase 11 — Compare Table

## What was built

Side-by-side title comparison that lets the user select 2–6 films or series from their watchlist and see them compared in one view — deterministic metadata on top, AI-generated "feel" analysis below a sparkle divider.

### Backend

**`POST /api/compare`** (`apps/api/src/routes/compare.ts`)
- Accepts `{ title_ids: number[] (2–6) }`.
- Resolves items via `getWatchlistItems` (user-scoped, prevents comparing titles not in their watchlist).
- Builds deterministic columns from stored TMDB data: title, year, type, runtime, genres, providers (via `selectProviderNames`), vote_average, imdb_rating.
- Calls `completeJson(provider, CompareAiSchema, messages, {maxTokens:2000})` for four subjective columns per title: **mood**, **pacing**, **tone**, **critical_consensus**, **watch_if_you_liked**.
- Merges by title_id; missing AI rows fall back to empty strings — the table always renders, even if the LLM returns partial data or fails entirely.
- Returns `{ rows: CompareCell[] }` in request order.

**`apps/api/src/llm/compare.ts`**
- `CompareAiSchema` (zod) — validates AI output; `mood`/`pacing`/`tone`/`critical_consensus`/`watch_if_you_liked` all have `.default("")` so partial responses parse cleanly.
- `buildCompareMessages()` — instructs the model to produce a JSON comparison table with one row per title; concise, cell-appropriate values.

**`apps/api/src/lib/providers.ts`** — new server-side `selectProviderNames()` helper (mirrors the web helper but returns `string[]` instead of `ProviderRow[]`).

### Frontend

**`apps/web/src/components/decide/compare-table.tsx`**
- **Desktop (≥ md):** horizontally scrollable table with a **frozen label column** (sticky `left-0`). Columns = titles (portrait poster thumbnail + name). Rows = attributes. Hairline `border-t border-[var(--rule)]` between rows. AI rows sit below a sparkle `─── AI analysis ───` divider.
- **Mobile (< md):** stacked card per title; deterministic rows first, then an "AI analysis" subheading, then AI rows. Same data, different layout.
- Fetches on mount via `useState` callback; shows "Analysing…" skeleton then fades to data.

**`apps/web/src/components/poster-card.tsx`**
- Added `selected?: boolean` and `onSelect?: () => void` props.
- Semi-transparent checkbox in the top-left corner, visible on hover (`group-hover:opacity-100`) and always when `selected`.
- Sky-500 ring around the card when selected.
- Main poster click (`onOpen`) is **unchanged** — selection is only triggered by the checkbox, not the card itself.

**`apps/web/src/pages/home.tsx`**
- `selectedIds: Set<number>` state; `toggleSelect` (caps at 6) and `clearSelection`.
- All grid `PosterCard`s receive `onSelect={() => toggleSelect(id)}` — the checkbox appears on hover from the start; selection mode is entered the moment the user checks the first card.
- **Floating selection toolbar** — fixed-bottom pill that slides up from `y:100%` when `selectedIds.size > 0`; shows count + "Clear" + "Compare N" (active when ≥ 2 selected).
- `CompareTable` dialog rendered alongside the other dialogs; closing it clears the selection.

## How it was tested

- TypeScript typecheck: `bun run typecheck` — all clean.
- Build: `bun run build` — passes, no TS errors.
- Manual flow smoke-tested: hover over 2+ cards → checkboxes appear → select → toolbar slides up → "Compare N" appears at ≥2 selections → compare dialog renders.
- API unit: `POST /api/compare` with a mock body returns expected `{ ok, data: { rows } }` shape.

## Design decisions

- Closed-set only: `getWatchlistItems` enforces user ownership — you can only compare titles in your own watchlist.
- LLM non-fatal: AI columns fall back to `""` rather than erroring the table; deterministic data is never gated on AI.
- 6-title maximum: keeps the table legible on desktop and prevents excessively large LLM prompts.
- Sticky first column: only the label column is frozen (not the poster header row) to keep the scrollable area clean.
