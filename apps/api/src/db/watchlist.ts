import type {
  WatchStatus,
  WatchlistFilters,
  WatchlistItem,
} from "@cinemood/shared";
import { rowToTitle, type TitleRow } from "./titles";

interface WatchlistRow extends TitleRow {
  status: WatchStatus;
  added_at: number;
  started_at: number | null;
  watched_at: number | null;
  notes: string | null;
  catalog_no: number | null;
}

const SELECT_BASE = `
  SELECT t.id, t.type, t.title, t.original_title, t.overview, t.release_date,
         t.poster_path, t.backdrop_path, t.vote_average, t.vote_count, t.runtime,
         t.genres, t.cast_json, t.keywords, t.providers, t.imdb_id, t.imdb_rating,
         w.status, w.added_at, w.started_at, w.watched_at, w.notes, w.catalog_no
    FROM watchlist w
    INNER JOIN titles t ON t.id = w.title_id
   WHERE w.user_id = ?1`;

function rowToItem(row: WatchlistRow): WatchlistItem {
  return {
    title: rowToTitle(row),
    status: row.status,
    added_at: row.added_at,
    started_at: row.started_at,
    watched_at: row.watched_at,
    notes: row.notes,
    catalog_no: row.catalog_no ?? 0,
  };
}

const SORT_SQL: Record<NonNullable<WatchlistFilters["sort"]>, string> = {
  added_desc: "w.added_at DESC",
  added_asc: "w.added_at ASC",
  title_asc: "t.title COLLATE NOCASE ASC",
  year_desc: "substr(t.release_date,1,4) DESC, t.title ASC",
  year_asc: "substr(t.release_date,1,4) ASC, t.title ASC",
  rating_desc: "t.vote_average DESC, t.title ASC",
  catalog_desc: "w.catalog_no DESC",
  started_desc: "w.started_at DESC NULLS LAST, w.added_at DESC",
};

export async function listWatchlist(
  db: D1Database,
  userId: string,
  filters: WatchlistFilters = {},
): Promise<WatchlistItem[]> {
  const clauses: string[] = [];
  const binds: unknown[] = [userId];
  // Adds `AND <clause>` with `?N` placeholders for each value bound; N is
  // the 1-based index of the just-pushed bind.
  const where = (clause: (...placeholders: string[]) => string, ...values: unknown[]) => {
    const placeholders = values.map((v) => {
      binds.push(v);
      return `?${binds.length}`;
    });
    clauses.push(`AND ${clause(...placeholders)}`);
  };

  if (filters.status) where((p) => `w.status = ${p}`, filters.status);
  if (filters.type) where((p) => `t.type = ${p}`, filters.type);
  if (filters.year) where((p) => `substr(t.release_date,1,4) = ${p}`, filters.year);
  if (typeof filters.year_min === "number")
    where((p) => `CAST(substr(t.release_date,1,4) AS INTEGER) >= ${p}`, filters.year_min);
  if (typeof filters.year_max === "number")
    where((p) => `CAST(substr(t.release_date,1,4) AS INTEGER) <= ${p}`, filters.year_max);
  if (filters.genre) where((p) => `t.genres LIKE ${p}`, `%"${filters.genre}"%`);
  if (typeof filters.min_rating === "number")
    where((p) => `t.vote_average >= ${p}`, filters.min_rating);
  if (typeof filters.runtime_min === "number")
    where((p) => `t.runtime >= ${p}`, filters.runtime_min);
  if (typeof filters.runtime_max === "number")
    where((p) => `t.runtime <= ${p}`, filters.runtime_max);
  if (filters.providers && filters.providers.length > 0) {
    // Providers is a JSON blob; do a LIKE-OR on provider names (region-agnostic).
    const likeValues = filters.providers.map((p) => `%"${p}"%`);
    where(
      (...ps) => `(${ps.map((p) => `t.providers LIKE ${p}`).join(" OR ")})`,
      ...likeValues,
    );
  }

  const orderBy = (filters.sort && SORT_SQL[filters.sort]) ?? SORT_SQL.added_desc;
  const sql = `${SELECT_BASE} ${clauses.join(" ")} ORDER BY ${orderBy} LIMIT 500`;
  const result = await db
    .prepare(sql)
    .bind(...binds)
    .all<WatchlistRow>();

  return (result.results ?? []).map(rowToItem);
}

export async function getWatchlistItem(
  db: D1Database,
  userId: string,
  titleId: number,
): Promise<WatchlistItem | null> {
  const row = await db
    .prepare(`${SELECT_BASE} AND w.title_id = ?2 LIMIT 1`)
    .bind(userId, titleId)
    .first<WatchlistRow>();
  return row ? rowToItem(row) : null;
}

async function nextCatalogNo(
  db: D1Database,
  userId: string,
): Promise<number> {
  const row = await db
    .prepare(`SELECT COALESCE(MAX(catalog_no), 0) + 1 AS n FROM watchlist WHERE user_id = ?1`)
    .bind(userId)
    .first<{ n: number }>();
  return row?.n ?? 1;
}

const INSERT_WATCHLIST_SQL = `INSERT INTO watchlist (user_id, title_id, status, added_at, catalog_no)
   VALUES (?1, ?2, 'pending', ?3, ?4)
   ON CONFLICT(user_id, title_id) DO NOTHING`;

export async function addToWatchlist(
  db: D1Database,
  userId: string,
  titleId: number,
): Promise<void> {
  const now = Math.floor(Date.now() / 1000);
  // Reserve a fresh catalog number if no row exists yet. ON CONFLICT keeps
  // any prior catalog_no so re-adds stay stable.
  const next = await nextCatalogNo(db, userId);
  await db
    .prepare(INSERT_WATCHLIST_SQL)
    .bind(userId, titleId, now, next)
    .run();
}

/** Bulk-insert N watchlist rows in a single D1 batch round-trip. Catalog
 *  numbers are pre-allocated MAX+1, MAX+2, … so we issue exactly one read
 *  + one batch instead of N round-trips. Used by the import path.
 *
 *  Returns the subset of `titleIds` that produced an actual INSERT (a
 *  `changes === 1` in the D1 result meta). Duplicates that hit ON CONFLICT
 *  DO NOTHING return `changes === 0` and are omitted, so callers can
 *  honestly report "X added · Y already in catalog" to the user. */
export async function addManyToWatchlist(
  db: D1Database,
  userId: string,
  titleIds: number[],
): Promise<number[]> {
  if (titleIds.length === 0) return [];
  const start = await nextCatalogNo(db, userId);
  const now = Math.floor(Date.now() / 1000);
  const stmts = titleIds.map((id, i) =>
    db.prepare(INSERT_WATCHLIST_SQL).bind(userId, id, now, start + i),
  );
  const results = await db.batch(stmts);
  const inserted: number[] = [];
  results.forEach((res, i) => {
    if ((res.meta?.changes ?? 0) > 0) inserted.push(titleIds[i]!);
  });
  return inserted;
}

export async function removeFromWatchlist(
  db: D1Database,
  userId: string,
  titleId: number,
): Promise<void> {
  await db
    .prepare(`DELETE FROM watchlist WHERE user_id = ?1 AND title_id = ?2`)
    .bind(userId, titleId)
    .run();
}

export async function setWatchlistStatus(
  db: D1Database,
  userId: string,
  titleId: number,
  status: WatchStatus,
): Promise<void> {
  const now = Math.floor(Date.now() / 1000);
  // Timestamp rules:
  //   watching → started_at = COALESCE(existing, now), clear watched_at
  //   watched  → watched_at = now, leave started_at intact
  //   pending  → clear both timestamps
  let sql: string;
  let binds: unknown[];
  if (status === "watching") {
    sql = `UPDATE watchlist
              SET status = ?3,
                  started_at = COALESCE(started_at, ?4),
                  watched_at = NULL
            WHERE user_id = ?1 AND title_id = ?2`;
    binds = [userId, titleId, status, now];
  } else if (status === "watched") {
    sql = `UPDATE watchlist
              SET status = ?3,
                  watched_at = ?4
            WHERE user_id = ?1 AND title_id = ?2`;
    binds = [userId, titleId, status, now];
  } else {
    sql = `UPDATE watchlist
              SET status = ?3,
                  started_at = NULL,
                  watched_at = NULL
            WHERE user_id = ?1 AND title_id = ?2`;
    binds = [userId, titleId, status];
  }
  await db.prepare(sql).bind(...binds).run();
}

export async function listWatchlistTitleIds(
  db: D1Database,
  userId: string,
): Promise<number[]> {
  const result = await db
    .prepare(`SELECT title_id FROM watchlist WHERE user_id = ?1`)
    .bind(userId)
    .all<{ title_id: number }>();
  return (result.results ?? []).map((r) => r.title_id);
}

export async function getMaxCatalogNo(
  db: D1Database,
  userId: string,
): Promise<number> {
  const row = await db
    .prepare(`SELECT COALESCE(MAX(catalog_no), 0) AS n FROM watchlist WHERE user_id = ?1`)
    .bind(userId)
    .first<{ n: number }>();
  return row?.n ?? 0;
}

/**
 * Fetch a specific subset of the user's watchlist items by title id.
 * Used by the AI feature routes (recommend, compare, decide) so they
 * can hydrate a caller-supplied `title_ids` array into full WatchlistItems
 * while maintaining the user-scoping invariant.
 *
 * Items whose id is not in the user's watchlist are silently omitted
 * (no error) — callers should treat absent ids as removed/invalid.
 */
export async function getWatchlistItems(
  db: D1Database,
  userId: string,
  titleIds: number[],
): Promise<WatchlistItem[]> {
  if (titleIds.length === 0) return [];
  // Build positional placeholders: ?2, ?3, … (userId is ?1).
  const placeholders = titleIds.map((_, i) => `?${i + 2}`).join(", ");
  const sql = `${SELECT_BASE} AND w.title_id IN (${placeholders})`;
  const result = await db
    .prepare(sql)
    .bind(userId, ...titleIds)
    .all<WatchlistRow>();
  return (result.results ?? []).map(rowToItem);
}
