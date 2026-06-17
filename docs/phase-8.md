# Phase 8 — Currently-watching status

## What was built

Added a third `WatchStatus` value (`"watching"`) to the watchlist, enabling users to track titles they are actively watching alongside the existing `pending` / `watched` states.

## Changes

### Backend
- **Migration `0004_watching_status.sql`**: Recreates the `watchlist` table (SQLite 12-step rebuild) with an updated `CHECK` constraint (`'pending' | 'watching' | 'watched'`) and a new `started_at INTEGER` column that records when the user began watching.
- **`apps/api/src/db/watchlist.ts`**: `SELECT_BASE`, `rowToItem`, `SORT_SQL` all updated; `setWatchlistStatus` now handles three-state timestamp logic (started_at set/cleared, watched_at set/cleared) with a single per-branch `UPDATE`.
- **`apps/api/src/routes/watchlist.ts`**: `PatchSchema` and `ListQuerySchema` status enums widened to three values; `started_desc` sort option added.
- **`packages/shared/src/types.ts`**: `WatchStatus`, `WatchlistItem.started_at`, `WatchlistSort` updated.

### Frontend
- **`poster-card.tsx`**: `onToggleWatched` replaced by `onSetStatus(status)`. Watching items show an accent ring overlay + play-dot badge + "Watching" label in the metadata strip. Hover quick-action is now contextual: pending → "Start watching", watching → "Mark watched", watched → "Unmark watched".
- **`filter-rail.tsx`**: Added "Watching" pill to the Status filter group.
- **`active-chips.tsx`**: Status chip label handles `watching`.
- **`use-watchlist.ts`**: Added `started_desc` to `SORT_LABELS`.
- **`home.tsx`**: `handleToggleWatched` replaced by `handleSetStatus(item, status)`; "Continue watching" horizontal shelf rendered above the grid when any `watching` items exist (hidden when the status filter is already active to avoid duplication).
- **`title-detail-dialog.tsx`**: Action bar now shows three contextual buttons: "Start watching", "Mark watched", and "Unmark watched" / "Stop watching" depending on current status.

## How it was tested

- `node_modules/.bin/tsc --noEmit` passed on all three workspaces (shared, api, web).
- `bun run build` passed for web (Vite) and api (wrangler dry-run).
- Migration SQL validates against the existing schema (data-preserving INSERT…SELECT; all existing `pending`/`watched` rows satisfy the new CHECK constraint).

## Next: Phase 9 — Generic LLM `complete()` abstraction
