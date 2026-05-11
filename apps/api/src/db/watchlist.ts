import type {
  WatchStatus,
  WatchlistFilters,
  WatchlistItem,
} from "@cinemood/shared";
import { rowToTitle, type TitleRow } from "./titles";

interface WatchlistRow extends TitleRow {
  status: WatchStatus;
  added_at: number;
  watched_at: number | null;
  notes: string | null;
  catalog_no: number | null;
}

const SELECT_BASE = `
  SELECT t.id, t.type, t.title, t.original_title, t.overview, t.release_date,
         t.poster_path, t.backdrop_path, t.vote_average, t.vote_count, t.runtime,
         t.genres, t.cast_json, t.keywords, t.providers, t.imdb_id, t.imdb_rating,
         w.status, w.added_at, w.watched_at, w.notes, w.catalog_no
    FROM watchlist w
    INNER JOIN titles t ON t.id = w.title_id
   WHERE w.user_id = ?1`;

function rowToItem(row: WatchlistRow): WatchlistItem {
  return {
    title: rowToTitle(row),
    status: row.status,
    added_at: row.added_at,
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
};

export async function listWatchlist(
  db: D1Database,
  userId: string,
  filters: WatchlistFilters = {},
): Promise<WatchlistItem[]> {
  const clauses: string[] = [];
  const binds: unknown[] = [userId];
  const bind = (v: unknown) => {
    binds.push(v);
    return binds.length;
  };

  if (filters.status) clauses.push(`AND w.status = ?${bind(filters.status)}`);
  if (filters.type) clauses.push(`AND t.type = ?${bind(filters.type)}`);
  if (filters.year)
    clauses.push(`AND substr(t.release_date,1,4) = ?${bind(filters.year)}`);
  if (typeof filters.year_min === "number")
    clauses.push(
      `AND CAST(substr(t.release_date,1,4) AS INTEGER) >= ?${bind(filters.year_min)}`,
    );
  if (typeof filters.year_max === "number")
    clauses.push(
      `AND CAST(substr(t.release_date,1,4) AS INTEGER) <= ?${bind(filters.year_max)}`,
    );
  if (filters.genre)
    clauses.push(`AND t.genres LIKE ?${bind(`%"${filters.genre}"%`)}`);
  if (typeof filters.min_rating === "number")
    clauses.push(`AND t.vote_average >= ?${bind(filters.min_rating)}`);
  if (typeof filters.runtime_min === "number")
    clauses.push(`AND t.runtime >= ?${bind(filters.runtime_min)}`);
  if (typeof filters.runtime_max === "number")
    clauses.push(`AND t.runtime <= ?${bind(filters.runtime_max)}`);
  if (filters.providers && filters.providers.length > 0) {
    // Providers is a JSON blob; do a LIKE-OR on provider names (region-agnostic).
    const ors = filters.providers
      .map((p) => `t.providers LIKE ?${bind(`%"${p}"%`)}`)
      .join(" OR ");
    clauses.push(`AND (${ors})`);
  }

  const sort = filters.sort && SORT_SQL[filters.sort];
  const orderBy = sort ?? SORT_SQL.added_desc;

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
    .prepare(
      `INSERT INTO watchlist (user_id, title_id, status, added_at, catalog_no)
       VALUES (?1, ?2, 'pending', ?3, ?4)
       ON CONFLICT(user_id, title_id) DO NOTHING`,
    )
    .bind(userId, titleId, now, next)
    .run();
}

/** Bulk-insert N watchlist rows in a single D1 batch round-trip. Catalog
 *  numbers are pre-allocated MAX+1, MAX+2, … so we issue exactly one read
 *  + one batch instead of N round-trips. Used by the import path. */
export async function addManyToWatchlist(
  db: D1Database,
  userId: string,
  titleIds: number[],
): Promise<void> {
  if (titleIds.length === 0) return;
  const start = await nextCatalogNo(db, userId);
  const now = Math.floor(Date.now() / 1000);
  const stmts = titleIds.map((id, i) =>
    db
      .prepare(
        `INSERT INTO watchlist (user_id, title_id, status, added_at, catalog_no)
         VALUES (?1, ?2, 'pending', ?3, ?4)
         ON CONFLICT(user_id, title_id) DO NOTHING`,
      )
      .bind(userId, id, now, start + i),
  );
  await db.batch(stmts);
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
  const watchedAt = status === "watched" ? Math.floor(Date.now() / 1000) : null;
  await db
    .prepare(
      `UPDATE watchlist
          SET status = ?3,
              watched_at = ?4
        WHERE user_id = ?1 AND title_id = ?2`,
    )
    .bind(userId, titleId, status, watchedAt)
    .run();
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
